# Data contract

The one file both halves follow. Anyone can propose a contract change as part of a task.
Coordinate overlapping edits and tell contributors using the interface before changing it;
update the contract and affected code together.

Conventions (also in `CLAUDE.md`): degrees; latitude north-positive; longitude east-positive,
-180 to 180; azimuth clockwise from north; UTC; Moon radius `R = 1737.4 km`; heights in metres
above that sphere; no atmospheric refraction.

## 1. Moon-fixed frame

All vectors are in the Moon's mean-Earth frame (Skyfield name `MOON_ME_DE440_ME421`, built from
the DE440 kernels), the frame LOLA maps use.

- `+x` points at latitude 0, longitude 0 (the middle of the side facing Earth)
- `+y` points at latitude 0, longitude 90 E
- `+z` points at the north pole

## 2. Files in `web/public/data/`

### Mock data (made by T20, then replaced file by file by T01, T03, T04 and T07)

Same file names and formats as the real files, so the site runs before the real data exists.
A mock file says so: `"source": "mock"` in `ephemeris.json` and `dem.json`, and
`"checked_at": null` in `validation.json`. Tests that need real data skip when they see this.

| Mock feature | Where |
|---|---|
| Height grid | `size` 634, `pixel_m` 960, `x_min_m` -304320, `y_max_m` 304320; flat at 0 m apart from the features below |
| Bowl crater, 10 km radius, floor 3,000 m down | Centre: latitude -88.0, longitude 45.0 |
| Its rim, 500 m above the plain | 10 km from the centre. Due north of it: latitude -87.67, longitude 45.0 |
| Ridge, 1,500 m high, 20 km long | Centre: latitude -87.0, longitude -120.0 |
| Sun | Circles once per 29.53 days, never more than 1.5 degrees from the Moon's equator |
| Earth | 384,400 km away, near `+x`, wobbling 7 degrees either way over 27.3 days |
| `sites.json` | `mock-floor` (-88.0, 45.0), `mock-rim` (-87.67, 45.0), `mock-equator` (1.0, 23.0) |

When a task says "crater floor" or "crater rim", it means these points on mock data, and
`shackleton-floor` and `shackleton-rim` from `sites.json` on real data.

### `ephemeris.json` + `ephemeris/<decade>.bin` (made by T01)

One row every 3 hours, 1900-01-01T00Z to 2101-01-01T00Z, split into one file per decade so the page downloads
only what it needs: the 2020s (`home`) on load, any other decade the first time a scenario's
time needs it. `ephemeris.json` is the index:

```json
{
  "start": "1900-01-01T00:00:00Z",
  "step_s": 10800,
  "rows": 587313,
  "frame": "MOON_ME_DE440_ME421",
  "columns": ["sun_x", "sun_y", "sun_z", "earth_x_km", "earth_y_km", "earth_z_km"],
  "source": "JPL DE440 via Skyfield",
  "home": 12,
  "chunks": [
    { "file": "ephemeris/1900.bin", "start": "1900-01-01T00:00:00Z", "rows": 29217, "hash": "4087c9f312215c1f" },
    "... one per decade, 1900 to 2090 ...",
    { "file": "ephemeris/2090.bin", "start": "2090-01-01T00:00:00Z", "rows": 32137, "hash": "cfcf9e643a152242" }
  ]
}
```

Each decade file runs from its decade's first hour to the next decade's first hour inclusive,
so neighbouring files share one row and a time inside a decade needs that file alone. The
2090s file runs to 2101-01-01T00Z. `rows` counts each shared row once. Row `i` of a file is at
its `start` + `i` * `step_s` of Unix time (no leap seconds). About 0.7 MB per file, 14.1 MB in
all. `hash` is the first 16 hex digits of the file's SHA-256.

The browser keeps each decade file it downloads in Cache Storage, under the file's URL plus
`?v=<hash>`, and reads it from there on later visits; copies the index no longer lists are
removed. `ephemeris.json` itself is always asked for again (`no-cache`), so a regenerated table
is picked up on the next visit.

A 3-hour step is accurate enough: with the browser's straight-line step and re-normalised Sun,
the table agrees with Skyfield's own surface alt/az to 0.001 degrees (T02 allows 0.02).

A table without `chunks` is one file, `ephemeris.bin`, holding all `rows` (T20's mock and the
tests use this form).

Each `.bin`: little-endian float32, 6 values per row, rows in time order.

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

`status`: `landed`, `planned`, `candidate` or `reference` (a point used for checks and the demo,
not a landing site). `group`: `apollo`, `lander` or `south-pole`.

The real list always has `shackleton-floor` and `shackleton-rim` (both `reference`). The terrain
checks in T24 and the demo use them by id.

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

`ours` is the Python calculation (Skyfield for a surface point, as in T01's fixtures). The
browser's own maths is checked against the same Horizons numbers by the `horizons.json` fixture
below. In the mock file, `checked_at` is `null` and `cases` is empty.

### Fixtures: `web/src/core/__fixtures__/horizons.json` (made by T03)

The same cases, Horizons values only. A test owned by T03 runs `ephemeris.ts` and `geometry.ts`
on each case and fails above 0.1 degrees, so the badge on the About page is true of the code
the user runs.

```json
[
  { "lat": 0, "lon": 0, "t": "2027-01-01T00:00:00Z", "body": "sun", "alt": 0, "az": 0 }
]
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
export type Body = 'sun' | 'earth';
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
| `ephemeris.ts` | T00 | `loadEphemeris(): Promise<Ephemeris>` (index + home decade) · `loadEphemerisChunk(eph, i): Promise<ArrayBuffer>` · `indexEphemeris(meta): Ephemeris` and `parseEphemeris(meta, buffer: ArrayBuffer): Ephemeris` (no network; tests use them) · `eph.startMs`, `eph.endMs` (whole table), `eph.homeStartMs`, `eph.homeEndMs`, `eph.meta` · `eph.vectorsAt(tMs): { sun: [x,y,z]; earthKm: [x,y,z] }` (straight-line step between rows; Sun re-normalised) · `eph.missing(fromMs, toMs): number[]` (decades not yet loaded) · `eph.withChunk(i, buffer): Ephemeris` (a new value, one more decade) |
| `dem.ts` | T00 | `loadDem(onProgress?): Promise<Dem>` · `parseDem(meta, buffer: ArrayBuffer): Dem` (no network; tests use it) · `dem.covers(lat, lon): boolean` · `dem.heightAt(lat, lon): number` (bilinear, metres; 0 outside) · `dem.meta` |
| `geometry.ts` | T00 first pass, then T02 | `sunAltAz(eph, site, groundM, tMs): AltAz` · `earthAltAz(eph, site, groundM, tMs): AltAz` · `destination(lat, lon, bearingDeg, distM): { lat, lon }` |
| `horizon.ts` | T00 flat skyline, then T05 | `skylineAt(dem: Dem | null, site: Site): Skyline` · `skylineElev(s: Skyline, az: number): number` (interpolated) |
| `projection.ts` | T31 | `polarForward(lat, lon): { x, y }` and `polarInverse(x, y): { lat, lon }` (section 2's formulas, metres) · `cylForward(lat, lon, lon0 = 0): { x, y }` and `cylInverse(x, y, lon0 = 0): { lat, lon } \| null` (equidistant cylindrical, km, `x = R (lon - lon0) rad`, `y = R lat rad`; longitude wrapped to -180..180; null beyond a pole) · `MapView = { cx, cy, scale, width, height }` (map units at the centre, screen pixels per unit, canvas size in pixels; screen y grows down, map y grows up) · `viewToScreen(view, x, y)` and `screenToView(view, px, py)` |
| `shade.ts` | T31 | `shadePolar(dem, sun: Vec3, maxCells = 1300): PolarShade` (`{ size, stride, frac, cosI, height, heightRange }`: on every `stride`th cell of the height map, the fraction of the Sun's disc above the terrain, 0, 0.5 or 1, the cosine of the Sun's incidence on the ground, and the cell's height; NaN outside coverage) · `shadeGlobal(sun: Vec3, width, height): Float32Array` (cosine of the Sun's zenith angle at each cell centre of a latitude-longitude grid, row 0 at 90 N) · `subPoint(v: Vec3): { lat, lon }` (where a direction from the Moon's centre meets the surface). Illustration for the map only: lit and dark answers come from `windows.ts` |
| `panel.ts` | T15 | `panelPower(sample): { flat, upright }` (each 0..1 of full power: flat = `sunFrac * sin(alt)`, none below 0 degrees; upright and turned to the Sun = `sunFrac * cos(alt)`) · `panelAverage(samples): { flat, upright }` (mean, dark hours count as 0) |
| `windows.ts` | T00 first pass, then T06 | `series(eph, site, groundM, skyline, startMs, endMs, stepMs): Sample[]` · `nextFlip(eph, site, groundM, skyline, tMs, body: Body, maxDays = 60): Flip` · `summary(samples: Sample[]): Summary` · `countdownText(body: Body, upNow: boolean, flip: Flip, tMs: number, neverLit = false): string` |

**First pass** means T00 writes the function straight from the formulas below, with a few sanity
tests, so the site shows live numbers from the first hour. The follow-up task adds the real
tests and fixes what they find. These are task dependencies, not person assignments. Keep the
documented names and signatures unless a coordinated contract change updates their callers.

`countdownText` wording (F4). Durations read `3 d 4 h`, or `5 h 20 min` under one day.

| Case | Text |
|---|---|
| Sun up, a set found | `Sunset in 3 d 4 h` |
| Sun down, a rise found | `Sunrise in 3 d 4 h` |
| Sun up, no set found | `No sunset in the next 60 days` |
| Sun down, no rise found | `No sunrise in the next 60 days` |
| Sun down, `neverLit` true | `Permanently shadowed (until 2100)` |
| Earth up or down, a flip found | `Earthset in 3 d 4 h` or `Earthrise in 3 d 4 h` |
| Earth up, no flip found | `Earth always visible` |
| Earth down, no flip found | `Earth never visible` |

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

## 4. State: `web/src/state.ts` (created by T00)

UI modules read state and call actions. They never call each other.

```ts
export type Scenario = { id: string; label: string; color: string; site: Site; tMs: number };
// color is the name of a theme variable, for example '--scn-a'. Never a colour code.
export type Range = '30d' | '90d' | '365d';
export type AppState = {
  live: Scenario; pinned: Scenario[]; ghost: Scenario | null;
  selectedId: string; range: Range; mode: '2d' | '3d';
  windowStartMs: number;                 // left edge of the timeline for the live scenario
  eph: Ephemeris | null; dem: Dem | null; sites: CuratedSite[];
};

getState(): AppState
subscribe(fn: (s: AppState) => void): () => void
setLiveSite(site: Site) · setLiveTime(tMs: number) · pin() · unpin(id) · select(id)
setRange(r: Range) · shiftWindow(dir: -1 | 1) · setGhost(s: Scenario | null) · setMode(m)
selected(): Scenario                     // the live or pinned scenario named by selectedId

// computed once and cached here, so modules don't repeat the work
skylineFor(sc: Scenario): Skyline
samplesFor(sc: Scenario, range: Range): Sample[]     // hourly from sc.tMs: strips, sky paths
timelineFor(sc: Scenario, range: Range): Sample[]    // hourly from the window start: timeline
summaryFor(sc: Scenario): Summary                     // over 30 days from sc.tMs
flipFor(sc: Scenario, body: Body): Flip               // next rise or set after sc.tMs
neverLitFor(sc: Scenario): boolean                    // no sunlight there from sc.tMs to the end of 2100
```

**Selected and live.** `selectedId` is the live scenario's id or a pinned one's. The readout,
timeline, sky panorama and the 3D scene's Sun all show the selected scenario. Pinned scenarios
never change. `setLiveSite` and `setLiveTime` change the live scenario and select it. So an
edit made anywhere (map click, coordinate boxes, time box, timeline drag, nudge "Keep") lands
on live, and the view follows.

**First open (F19, T25).** When the page address names no scenario (no live one, none pinned)
and the site list arrives, state builds an example: live at the crater rim, the rim pinned as
A, the crater floor pinned as B, all at the current hour, live selected. The two sites are
found by id (section 2: `shackleton-rim` and `shackleton-floor`, or `mock-rim` and `mock-floor`).
An address that names any scenario opens exactly what it says. So a module may find two
scenarios pinned before the user has touched anything.

**Decades.** `eph` is null until the table has loaded, and null again while a decade that the
live scenario (its time plus 60 days, and its timeline window) or a pinned scenario (its time
plus 60 days or the range, whichever is longer) needs is still downloading. So a module that
shows "Loading" while `eph` is null needs nothing more. `state.ts` fetches each decade once; one
that fails to download reads as outside the table.

**Never lit.** `neverLitFor` is true when no part of the Sun's disc clears the skyline at any
hour from the scenario's time to the end of the table (2100-12-31), whatever time is chosen. It
is false at once, with no download, when the Sun is up or rises within 60 days. Otherwise it
needs every decade from the scenario's time to 2100: they download in the background without
holding the page on "Loading", and it reads false ("No sunrise in the next 60 days") until they
are in. It is also false within 60 days of the end of the table, where a few dark hours prove
nothing. The scan runs back from 2100 and is remembered per site, so a later call for an
earlier time only scans the new hours.

**Timeline window.** `timelineFor` starts at the scenario's own time for a pinned scenario and
at `windowStartMs` for live. `setLiveTime` leaves the window alone while the new time is inside
it, and restarts it at the new time otherwise. `shiftWindow` moves it by half the range. This
is what lets a drag move the marker without the chart sliding under the cursor.

**While data is loading** (`eph` is null), the accessors return empty arrays, `null` flips, a
flat skyline and zeros. Modules show "Loading" and must not crash.

## 5. Page slots: `web/index.html` (created by T00)

| Element id | Module folder | Task |
|---|---|---|
| `#scene` | `web/src/scene/` | T12 |
| `#scenarios` | `web/src/ui/scenarios/` | T08 |
| `#readout` | `web/src/ui/readout/` | T08 |
| `#compare` | `web/src/ui/compare/` | T09 |
| `#timeline` | `web/src/ui/timeline/` | T10 |
| `#sky` | `web/src/ui/sky/` | T11 |
| `#nudge` | `web/src/ui/nudge/` | T13 (made by `#scene`, see below) |
| `#about` | `web/src/ui/about/` | T16 |
| `#panel` | `web/src/ui/panel/` | T15 |

Each folder has `index.ts` exporting `mount(el)`, and its own CSS file. `main.ts` mounts each
one. T00 wired the first eight with placeholders; T15 added `#panel`. A task that adds a slot
includes `main.ts`, `index.html` and this contract in its scope, and coordinates with active
layout work.

`#about` is a thin bar across the top: the product name, the Horizons badge and an About button
that opens the About panel. `#panel` sits under `#readout`.

`#nudge` (issue #58) is not in `index.html`. The scene creates it inside its map viewport (the
`position: relative` box that holds the map canvas), before `main.ts` reaches it, so the nudge
panel is ordinary HTML floating over the map, never drawn in the canvas. The nudge places itself
in one of the viewport's four corners (`data-corner="tl" | "tr" | "bl" | "br"`, bottom left to
start). Any map control the scene puts inside the viewport marks its corner with
`data-map-corner="tl"` (and so on); the nudge then skips that corner for the next free one,
clockwise. The scene's toolbar sits above the viewport and claims no corner.

## 6. Look: `web/src/ui/theme.css` (T00 creates, T19 designs)

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
| `--terrain-lo`, `--terrain-hi` | The two ends of the height colour ramp in the 3D scene |
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

**Colours in JavaScript.** Plotly and three.js can't read `var(--sun)`; they need the real
value. `plotTheme.ts` also exports `themeColor(name: string): string`, which returns the current
value of a theme variable: `themeColor('--sun')`, `themeColor(sc.color)`. In CSS and inline
styles, write `var(--sun)` or `var(${sc.color})`.

**The one pixel value a module may write** is the phone breakpoint:
`@media (max-width: 800px)`. Everything else comes from the variables.

**CSS order.** A module's task writes its first CSS using the shared classes. T23 polishes it
after that task merges. Anyone can take either task; coordinate further code and CSS changes
with active work on the same files.
