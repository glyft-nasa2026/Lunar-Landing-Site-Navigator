# Data contract

The one file both halves follow. **Only P1 edits it.** If it's wrong or missing something, tell
P1; don't work around it.

Conventions (also in `CLAUDE.md`): degrees; latitude north-positive; longitude east-positive,
-180 to 180; azimuth clockwise from north; UTC; Moon radius `R = 1737.4 km`; heights in metres
above that sphere; no atmospheric refraction.

## 1. Moon-fixed frame

All vectors are in the Moon's mean-Earth frame (Skyfield name `MOON_ME_DE421`), the frame LOLA
maps use.

- `+x` points at latitude 0, longitude 0 (the middle of the side facing Earth)
- `+y` points at latitude 0, longitude 90 E
- `+z` points at the north pole

## 2. Files in `web/public/data/`

### `ephemeris.bin` + `ephemeris.json` (made by T01)

`ephemeris.json`:

```json
{
  "start": "2026-01-01T00:00:00Z",
  "step_s": 3600,
  "rows": 87649,
  "frame": "MOON_ME_DE421",
  "columns": ["sun_x", "sun_y", "sun_z", "earth_x_km", "earth_y_km", "earth_z_km"],
  "source": "JPL DE421 via Skyfield"
}
```

`ephemeris.bin`: little-endian float32, 6 values per row, rows in time order.

- `sun_*`: unit vector from the Moon's centre to the Sun (apparent, light-time corrected)
- `earth_*_km`: vector from the Moon's centre to Earth's centre, in km

Earth is stored with its distance because it is close enough that the site's position on the
Moon shifts its direction by up to about 0.26 degrees. The Sun is too far for that to matter.

### `dem.bin` + `dem.json` (made by T04)

A square height grid in south polar stereographic projection, **in our own grid defined here**,
whatever layout the LOLA source file uses.

`dem.json`:

```json
{
  "size": 2534,
  "pixel_m": 240,
  "x_min_m": -304080,
  "y_max_m": 304080,
  "height_scale": 0.5,
  "nodata": -32768,
  "min_lat": -80,
  "source": "LOLA product name and version here"
}
```

`dem.bin`: little-endian int16, `size * size` values, row by row from the top row
(`y = y_max_m`). Height in metres = `value * height_scale`.

Projection (sphere, true scale at the pole):

```
c   = 90 + lat                      degrees from the south pole
r   = 2 * R * tan(c / 2)            metres
x   = r * sin(lon)
y   = r * cos(lon)                  longitude 0 points up, 90 E points right
col = (x - x_min_m) / pixel_m
row = (y_max_m - y) / pixel_m
```

Inverse: `r = hypot(x, y)`, `lat = 2 * atan(r / (2R)) - 90`, `lon = atan2(x, y)`.

`size` and `pixel_m` may change if T04 needs it; code reads them from `dem.json`, never
hard-codes them. File budget: 15 MB.

### `sites.json` (made by T07)

```json
[
  {
    "id": "apollo-11",
    "name": "Apollo 11",
    "lat": 0.0,
    "lon": 0.0,
    "agency": "NASA",
    "year": 1969,
    "status": "landed",
    "group": "apollo",
    "note": "One short line",
    "source": "https://..."
  }
]
```

`status`: `landed`, `planned` or `candidate`. `group`: `apollo`, `lander` or `south-pole`.

### `validation.json` (made by T03)

```json
{
  "checked_at": "2026-11-14T00:00:00Z",
  "tolerance_deg": 0.1,
  "max_diff_deg": 0.0,
  "cases": [
    { "lat": 0, "lon": 0, "t": "2027-01-01T00:00:00Z", "body": "sun",
      "ours": { "alt": 0, "az": 0 }, "horizons": { "alt": 0, "az": 0 }, "diff_deg": 0 }
  ]
}
```

### Fixtures: `web/src/core/__fixtures__/altaz.json` (made by T01)

At least 20 cases computed by Skyfield directly for a point on the Moon's surface, not through
our table. Tests in T02 compare against them.

```json
[
  { "lat": -89.5, "lon": 0, "t": "2027-01-01T00:00:00Z",
    "sun": { "alt": 0, "az": 0 }, "earth": { "alt": 0, "az": 0 } }
]
```

## 3. TypeScript: `web/src/core/`

`types.ts` (T00):

```ts
export type Site = { lat: number; lon: number; eye_m?: number };   // eye_m default 2
export type AltAz = { alt: number; az: number };
export type Skyline = { elev: Float32Array; terrain: boolean };    // 360 values, index = azimuth
export type Sample = {
  tMs: number;
  sun: AltAz; earth: AltAz;
  sunAbove: number;    // Sun centre minus skyline at its azimuth, degrees
  earthAbove: number;
  sunFrac: number;     // 0..1, fraction of the Sun's disc above the skyline, by height
  earthUp: boolean;
};
export type Flip = { type: 'rise' | 'set'; tMs: number } | null;
export type Summary = {
  litPct: number; longestLit_h: number; longestDark_h: number;
  earthPct: number; longestEarthGap_h: number;
};
export type CuratedSite = { id: string; name: string; lat: number; lon: number; agency: string;
  year: number; status: string; group: string; note: string; source: string };
```

| File | Task | Functions |
|---|---|---|
| `ephemeris.ts` | T00 | `loadEphemeris(): Promise<Ephemeris>` · `eph.startMs`, `eph.endMs` · `eph.vectorsAt(tMs): { sun: [x,y,z]; earthKm: [x,y,z] }` (straight-line step between rows; Sun re-normalised) |
| `dem.ts` | T00 | `loadDem(onProgress?): Promise<Dem>` · `dem.covers(lat, lon): boolean` · `dem.heightAt(lat, lon): number` (bilinear, metres; 0 outside) · `dem.meta` |
| `geometry.ts` | T02 | `sunAltAz(eph, site, groundM, tMs): AltAz` · `earthAltAz(eph, site, groundM, tMs): AltAz` · `destination(lat, lon, bearingDeg, distM): { lat, lon }` |
| `horizon.ts` | T05 | `skylineAt(dem: Dem | null, site: Site): Skyline` · `skylineElev(s: Skyline, az: number): number` (interpolated) |
| `windows.ts` | T06 | `series(eph, site, groundM, skyline, startMs, endMs, stepMs): Sample[]` · `nextFlip(eph, site, groundM, skyline, tMs, body, maxDays = 60): Flip` · `summary(samples: Sample[]): Summary` · `countdownText(...)`: the F4 wording |

### Geometry (T02)

```
n     = (cos lat cos lon, cos lat sin lon, sin lat)          site "up"
east  = (-sin lon, cos lon, 0)
north = (-sin lat cos lon, -sin lat sin lon, cos lat)
p     = (R + ground + eye) * n                               site position, km

Sun:   d = sun unit vector
Earth: d = normalise(earthKm - p)

alt = asin(d . n)
az  = atan2(d . east, d . north), wrapped to 0..360
```

### Skyline (T05)

For each azimuth 0..359, walk outward along the great circle from the site, from one grid cell
to 150 km. Step = the larger of half a cell and 1 % of the distance so far.

```
gamma = dist / R                          angle at the Moon's centre
r0    = R + ground(site) + eye
r1    = R + ground(point)
elev  = atan2(r1 cos(gamma) - r0, r1 sin(gamma))
skyline[az] = largest elev along that azimuth
```

`terrain = false` and all zeros when `dem` is null or the site is north of 85 S.

### Visibility (T06)

```
SUN_RADIUS = 0.267 degrees
sunAbove   = sun.alt - skylineElev(skyline, sun.az)
sunFrac    = clamp((sunAbove + SUN_RADIUS) / (2 * SUN_RADIUS), 0, 1)
lit        = sunFrac > 0
earthAbove = earth.alt - skylineElev(skyline, earth.az)
earthUp    = earthAbove > 0
```

`nextFlip` walks forward hourly, then halves the last interval until it is under one minute.

## 4. State: `web/src/state.ts` (T00, P1 only)

UI modules read state and call actions. They never call each other.

```ts
export type Scenario = { id: string; label: string; color: string; site: Site; tMs: number };
export type Range = '30d' | '90d' | '365d';
export type AppState = {
  live: Scenario; pinned: Scenario[]; ghost: Scenario | null;
  selectedId: string; range: Range; mode: '2d' | '3d';
  eph: Ephemeris | null; dem: Dem | null; sites: CuratedSite[];
};

getState(): AppState
subscribe(fn: (s: AppState) => void): () => void
setLiveSite(site: Site) · setLiveTime(tMs: number) · pin() · unpin(id) · select(id)
setRange(r: Range) · setGhost(s: Scenario | null) · setMode(m)

// computed once and cached here, so modules don't repeat the work
skylineFor(sc: Scenario): Skyline
samplesFor(sc: Scenario, range: Range): Sample[]     // hourly from sc.tMs
summaryFor(sc: Scenario): Summary                     // over 30 days from sc.tMs
```

## 5. Page slots: `web/index.html` (T00, P1 only)

| Element id | Module folder | Task |
|---|---|---|
| `#scene` | `web/src/scene/` | T12 |
| `#scenarios` | `web/src/ui/scenarios/` | T08 |
| `#readout` | `web/src/ui/readout/` | T08 |
| `#compare` | `web/src/ui/compare/` | T09 |
| `#timeline` | `web/src/ui/timeline/` | T10 |
| `#sky` | `web/src/ui/sky/` | T11 |
| `#nudge` | `web/src/ui/nudge/` | T13 |
| `#about` | `web/src/ui/about/` | T16 |

Each folder has `index.ts` exporting `mount(el)`, and its own CSS file. T00 wires all of them in
`main.ts` with placeholders, so no later task needs to touch `main.ts` or `index.html`.

## 6. Look: `web/src/ui/theme.css` (T00 creates, then T19 owns)

Modules use these names and never write a colour code, font or pixel size of their own. T19
changes the values; the names stay.

| Variable | For |
|---|---|
| `--bg`, `--panel`, `--panel-2`, `--border` | Page, cards, raised cards, lines |
| `--text`, `--muted` | Main text, secondary text |
| `--accent` | Primary button, selection |
| `--ok`, `--warn`, `--bad` | Best value in a row, caution, error message |
| `--scn-a`, `--scn-b`, `--scn-c`, `--scn-ghost` | Scenario colours (fixed: `#E69F00`, `#0072B2`, `#009E73`, grey) |
| `--sun`, `--earth` | Sun and Earth in charts (fixed: `#F0E442`, `#56B4E9`) |
| `--lit`, `--dark` | Filled and empty parts of the strips |
| `--space-1` … `--space-5` | Gaps: 4, 8, 12, 16, 24 px |
| `--radius` | Corner rounding |
| `--font`, `--font-num` | Text; fixed-width digits for numbers |
| `--fs-sm`, `--fs-md`, `--fs-lg`, `--fs-xl` | Type sizes |

Shared classes: `.card`, `.btn`, `.btn-primary`, `.field`, `.table`, `.badge`, `.muted`.

In the strips, a scenario keeps its own colour for both bars; the Sun bar is solid and the Earth
bar is the same colour at half strength. `--sun` and `--earth` are for single-scenario charts
(timeline, sky panorama).

Charts: every Plotly chart spreads `plotLayout()` from `web/src/ui/plotTheme.ts` into its layout.
`web/src/ui/layout.css` places the slots of section 5; modules style only their own insides.
