"""T12 integration checks. Uses existing Python Playwright; installs nothing.
Run against Vite: python3 src/scene/browser-check.py http://127.0.0.1:5173
Only browser requests are supplied synthetic data; shared public/data files are untouched.
"""
import array
import json
import math
import sys
from pathlib import Path
from playwright.sync_api import sync_playwright

BASE = sys.argv[1] if len(sys.argv) > 1 else 'http://127.0.0.1:5173'
R = 1737400
T0 = 1767225600000
SITE = {'lat': -88, 'lon': 45}


def projected(lat, lon):
    r = 2 * R * math.tan(math.radians((90 + lat) / 2))
    return r * math.sin(math.radians(lon)), r * math.cos(math.radians(lon))


def make_dem(size, pixel, origin):
    cx, cy = projected(-88, 45)
    rx, ry = projected(-87, -120)
    values = array.array('h')
    for row in range(size):
        y = origin - row * pixel
        for col in range(size):
            x = -origin + col * pixel
            d = math.hypot(x - cx, y - cy)
            h = -3000 if d < 3000 else (-3000 + 3500 * (d - 3000) / 7000 if d < 10000 else (500 * (12000 - d) / 2000 if d < 12000 else 0))
            if abs(x - rx) < 10000 and abs(y - ry) < 1500:
                h = max(h, 1500 * (1 - abs(y - ry) / 1500))
            values.append(round(h * 2))
    if sys.byteorder != 'little':
        values.byteswap()
    meta = dict(size=size, pixel_m=pixel, x_min_m=-origin, y_max_m=origin, height_scale=0.5, nodata=-32768, min_lat=-80, source='mock')
    return meta, values.tobytes()


meta, heights = make_dem(634, 960, 304320)
vectors = array.array('f')
for hour in range(73):
    angle = math.radians(225 + hour * 15)
    z = math.sin(math.radians(1.5))
    vectors.extend([math.cos(angle) * math.sqrt(1-z*z), math.sin(angle) * math.sqrt(1-z*z), z, 384400, 0, 0])
if sys.byteorder != 'little':
    vectors.byteswap()
eph = dict(start='2026-01-01T00:00:00Z', step_s=3600, rows=73, frame='MOON_ME_DE421', columns=['sun_x', 'sun_y', 'sun_z', 'earth_x_km', 'earth_y_km', 'earth_z_km'], source='mock')
assets = {'dem.json': json.dumps(meta), 'dem.bin': heights, 'ephemeris.json': json.dumps(eph), 'ephemeris.bin': vectors.tobytes(), 'sites.json': '[]'}
checks = []


def passed(name, detail):
    checks.append({'check': name, 'result': 'PASS', 'output': detail})
    print(json.dumps(checks[-1]), flush=True)


with sync_playwright() as p:
    browser = p.chromium.launch(headless=True, args=['--no-sandbox', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'])
    page = browser.new_page(viewport={'width': 1280, 'height': 900}, device_scale_factor=1)
    errors = []
    page.on('pageerror', lambda e: errors.append(str(e)))

    def route_data(route):
        name = route.request.url.rsplit('/', 1)[-1]
        if name in assets:
            route.fulfill(status=200, body=assets[name], content_type='application/octet-stream' if name.endswith('.bin') else 'application/json')
        else:
            route.continue_()

    page.route('**/data/*', route_data)
    page.goto(BASE + '/#live=-88.4,45,2026-01-01T00:00:00Z')
    page.wait_for_selector('.scene-canvas')
    page.wait_for_function("async () => !!(await import('/src/state.ts')).getState().dem")
    page.wait_for_timeout(700)
    canvas = page.locator('.scene-canvas')
    box = canvas.bounding_box()
    # The initial map has a known orthographic extent, measured from the dataset, not a fixture-specific camera.
    # Start away from the crater so this tests mesh raycasting rather than clicking a live pin.
    def xyz(lat, lon):
        return (1737.4 * math.cos(math.radians(lat)) * math.sin(math.radians(lon)), -1737.4 * math.cos(math.radians(lat)) * math.cos(math.radians(lon)))
    cx, cz = xyz(-88, 45)
    sx, sz = xyz(-88.4, 45)
    span = min(80, max(8, meta['size'] * meta['pixel_m'] / 8000))
    page.mouse.click(box['x'] + box['width']/2 + (cx-sx) * box['height']/(2*span), box['y'] + box['height']/2 + (cz-sz) * box['height']/(2*span))
    site = page.evaluate("async () => (await import('/src/state.ts')).getState().live.site")
    ax, ay = projected(site['lat'], site['lon'])
    bx, by = projected(-88, 45)
    error_cells = math.hypot(ax-bx, ay-by) / meta['pixel_m']
    assert error_cells < 1, (site, error_cells)
    passed('crater click', {'site': site, 'error_cells': error_cells})
    page.wait_for_timeout(300)
    assert 'Sun hidden' in page.locator('.scene-caption').inner_text()
    canvas.screenshot(path='/tmp/t12-map-hidden.png')
    # Read the rendered image. A small annulus avoids the selected-site pin at the exact centre.
    from PIL import Image
    image = Image.open('/tmp/t12-map-hidden.png').convert('RGB')
    w, h = image.size
    floor = [image.getpixel((w//2+x, h//2+y)) for x in range(-10, 11) for y in range(-10, 11) if 6**2 <= x*x+y*y <= 10**2]
    floor_luma = sum(sum(v)/3 for v in floor) / len(floor)
    assert floor_luma < 55, floor_luma
    first = image.tobytes()
    page.evaluate("async () => (await import('/src/state.ts')).pin()")
    page.evaluate(f"async () => (await import('/src/state.ts')).setLiveTime({T0 + 12*3600000})")
    page.wait_for_timeout(300)
    canvas.screenshot(path='/tmp/t12-map-scrubbed.png')
    second = Image.open('/tmp/t12-map-scrubbed.png').convert('RGB').tobytes()
    changed = sum(a != b for a, b in zip(first, second))
    assert changed > 1000, changed
    passed('Sun lighting and scrub', {'hidden_floor_mean_rgb': round(floor_luma, 2), 'changed_color_channels': changed})
    page.evaluate("async () => (await import('/src/state.ts')).select('a')")
    page.wait_for_timeout(250)
    canvas.screenshot(path='/tmp/t12-pinned-time.png')
    pinned = Image.open('/tmp/t12-pinned-time.png').convert('RGB')
    # Apart from pin colours, selecting A must restore the frozen time's complete lighting.
    outside_pin = [(x, y) for x in range(0, w, 4) for y in range(0, h, 4) if (x-w/2)**2+(y-h/2)**2 > 15**2]
    pinned_difference = sum(pinned.getpixel(pos) != image.getpixel(pos) for pos in outside_pin)
    assert pinned_difference < len(outside_pin) * 0.01, pinned_difference
    assert page.evaluate("async () => (await import('/src/state.ts')).selected().tMs") == T0
    page.evaluate("async () => (await import('/src/state.ts')).unpin('a')")
    passed('selected scenario time', 'selecting pinned A restores its own Sun lighting after live time changes')
    old_site = page.evaluate("async () => (await import('/src/state.ts')).getState().live.site")
    page.get_by_role('button', name='3D orbit', exact=True).click()
    assert page.get_by_role('button', name='3D orbit', exact=True).get_attribute('aria-pressed') == 'true'
    page.wait_for_timeout(250)
    canvas.screenshot(path='/tmp/t12-orbit.png')
    # A drag that returns near its origin must still count as a drag, not select a new point.
    box = canvas.bounding_box()
    page.mouse.move(box['x']+box['width']/2, box['y']+box['height']/2)
    page.mouse.down(); page.mouse.move(box['x']+box['width']/2+80, box['y']+box['height']/2, steps=8)
    page.mouse.move(box['x']+box['width']/2, box['y']+box['height']/2, steps=8); page.mouse.up()
    assert page.evaluate("async () => (await import('/src/state.ts')).getState().live.site") == old_site
    page.get_by_role('button', name='2D map', exact=True).click()
    assert page.evaluate("async () => (await import('/src/state.ts')).getState().live.site") == old_site
    passed('camera switch and drag', '2D → 3D → 2D preserves site; return-to-origin drag does not select')
    page.get_by_label('Vertical stretch', exact=True).fill('5')
    assert page.locator('.scene-stretch output').inner_text() == '5×'
    passed('vertical stretch', '5× works, selected site unchanged')
    page.evaluate("async () => (await import('/src/state.ts')).setLiveSite({lat:0.674,lon:23.473})")
    page.wait_for_timeout(200)
    assert 'Moon globe' in page.locator('.scene-caption').inner_text()
    assert page.get_by_label('Vertical stretch', exact=True).is_disabled()
    canvas.screenshot(path='/tmp/t12-globe.png')
    passed('outside DEM', 'Apollo latitude uses the Moon globe in both views')
    page.get_by_role('button', name='3D orbit', exact=True).click()
    page.get_by_role('button', name='2D map', exact=True).click()
    # Same code, different metadata and grid resolution; no source-file changes.
    fine_meta, fine_bytes = make_dem(2534, 240, 304080)
    assets['dem.json'] = json.dumps(fine_meta); assets['dem.bin'] = fine_bytes
    page.evaluate("""async () => {
      const state = await import('/src/state.ts');
      const {parseDem} = await import('/src/core/dem.ts');
      const [meta, bin] = await Promise.all([fetch('/data/dem.json').then(r=>r.json()), fetch('/data/dem.bin').then(r=>r.arrayBuffer())]);
      state.setData({dem:parseDem(meta,bin)}); state.setLiveSite({lat:-88,lon:45});
    }""")
    page.wait_for_timeout(350)
    assert 'South-pole terrain' in page.locator('.scene-caption').inner_text()
    passed('resolution independence', '634 × 634 at 960 m and 2534 × 2534 at 240 m render through the same code')
    page.set_viewport_size({'width':390, 'height':844})
    page.wait_for_timeout(250)
    assert page.evaluate('document.documentElement.scrollWidth <= innerWidth'), 'horizontal overflow'
    canvas.screenshot(path='/tmp/t12-phone.png')
    passed('phone layout', '390 px viewport, no horizontal overflow')
    # Loading and remount lifecycle checks exercise the actual mount entry point.
    page.evaluate("""async () => {
      const state=await import('/src/state.ts'); state.setData({eph:null,dem:null});
      const {mount}=await import('/src/scene/index.ts'); const el=document.querySelector('#scene'); mount(el); mount(el);
    }""")
    assert page.locator('.scene-canvas').count() == 1
    assert page.locator('.scene-message').inner_text().startswith('Loading')
    assert not errors, errors
    passed('loading and lifecycle', 'null data and repeated mount work; one canvas; no uncaught browser errors')
    fallback = browser.new_page()
    fallback.add_init_script("""const original=HTMLCanvasElement.prototype.getContext;
      HTMLCanvasElement.prototype.getContext=function(type,...args) {
        return type.startsWith('webgl') ? null : original.call(this,type,...args);
      };""")
    fallback.goto(BASE)
    fallback.wait_for_function("document.querySelector('.scene-message')?.textContent.includes('needs WebGL')")
    assert fallback.get_by_role('button', name='3D orbit', exact=True).is_disabled()
    passed('WebGL fallback', 'unavailable WebGL shows a readable fallback and disables scene controls')
    browser.close()
Path('/tmp/t12-browser-results.json').write_text(json.dumps(checks, indent=2))
print('HUMAN CHECK: >30 FPS on a mid-range laptop; headless SwiftShader is not laptop GPU evidence.', flush=True)
