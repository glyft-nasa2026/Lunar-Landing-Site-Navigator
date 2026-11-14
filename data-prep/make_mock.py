"""T20: write mock data files in the real formats (docs/data-contract.md, section 2).

Run from anywhere:  python data-prep/make_mock.py [--force]
NumPy only. No downloads. Writes into web/public/data/, then reads the files back and prints
the "Done when" checks from tasks/T20-mock-data.md. Exits with code 1 if any check fails.

It won't replace real data. If a later task has put its real file in web/public/data/ (T01's
table, T04's height map, T03's validation, T07's sites), it lists those files, changes nothing
and exits with code 2. --force writes the mock files over them anyway.

Every file says it is mock: "source": "mock" in ephemeris.json and dem.json, and
"checked_at": null in validation.json. Tests that need real data skip when they see this.
"""

from __future__ import annotations

import json
import math
import sys
from datetime import datetime, timezone
from pathlib import Path

import numpy as np

OUT = Path(__file__).resolve().parent.parent / "web" / "public" / "data"

R_M = 1737.4e3  # Moon radius, metres
DAY_S = 86400.0

# --- Ephemeris: 2026-2035, hourly, in one file ------------------------------------------------
# The real table is one file per decade now (contract section 2); the one-file form still loads.
START = datetime(2026, 1, 1, tzinfo=timezone.utc)
END = datetime(2036, 1, 1, tzinfo=timezone.utc)
STEP_S = 3600

SYNODIC_D = 29.53       # Sun goes once round the Moon's sky
SUN_TILT_DEG = 1.5      # Sun never more than this from the Moon's equator
SUN_TILT_PERIOD_D = 346.6  # how fast the Sun's height above the equator swings (mock value)
EARTH_KM = 384400.0
EARTH_WOBBLE_DEG = 7.0
EARTH_WOBBLE_D = 27.3

# --- Height grid ------------------------------------------------------------------------------
SIZE = 634
PIXEL_M = 960
X_MIN_M = -304320
Y_MAX_M = 304320
HEIGHT_SCALE = 0.5
NODATA = -32768
MIN_LAT = -80

CRATER = (-88.0, 45.0)
CRATER_R_M = 10_000.0
CRATER_FLOOR_M = -3000.0
RIM_M = 500.0
RIM = (-87.67, 45.0)          # 10 km from the centre, on the same meridian
FLAT_M = 1500.0               # half-width of the flat floor and the flat rim crest, so a
                              # bilinear read between 960 m cells still sees the exact height
OUTER_SLOPE_M = 5000.0        # outside the rim, the ground falls back to 0 over this distance

RIDGE = (-87.0, -120.0)
RIDGE_M = 1500.0
RIDGE_HALF_LEN_M = 10_000.0   # 20 km long
RIDGE_FULL_LEN_M = 7_000.0    # full height out to here, then tapers to 0 at RIDGE_HALF_LEN_M
RIDGE_HALF_WIDTH_M = 3_000.0

SITES = [
    {
        "id": "mock-floor", "name": "Mock crater floor", "lat": -88.0, "lon": 45.0,
        "agency": "Darksight mock", "year": 2026, "status": "reference", "group": "south-pole",
        "note": "Centre of the mock bowl crater, 3,000 m below the plain.",
        "source": "data-prep/make_mock.py",
    },
    {
        "id": "mock-rim", "name": "Mock crater rim", "lat": -87.67, "lon": 45.0,
        "agency": "Darksight mock", "year": 2026, "status": "reference", "group": "south-pole",
        "note": "Rim of the mock crater, 500 m above the plain, 10 km from its centre.",
        "source": "data-prep/make_mock.py",
    },
    {
        "id": "mock-equator", "name": "Mock equator point", "lat": 1.0, "lon": 23.0,
        "agency": "Darksight mock", "year": 2026, "status": "reference", "group": "apollo",
        "note": "A point outside the height map, near the Apollo 11 site.",
        "source": "data-prep/make_mock.py",
    },
]


def iso(dt: datetime) -> str:
    return dt.strftime("%Y-%m-%dT%H:%M:%SZ")


def write_json(name: str, obj) -> None:
    (OUT / name).write_text(json.dumps(obj, indent=2) + "\n", encoding="utf-8", newline="\n")


def project(lat_deg, lon_deg):
    """Contract projection: latitude, longitude to stereographic x, y in metres."""
    c = np.radians(90.0 + np.asarray(lat_deg, dtype=np.float64))
    r = 2.0 * R_M * np.tan(c / 2.0)
    lon = np.radians(np.asarray(lon_deg, dtype=np.float64))
    return r * np.sin(lon), r * np.cos(lon)


def smoothstep(e0: float, e1: float, x: np.ndarray) -> np.ndarray:
    t = np.clip((x - e0) / (e1 - e0), 0.0, 1.0)
    return t * t * (3.0 - 2.0 * t)


# --- Builders ---------------------------------------------------------------------------------

def make_ephemeris() -> int:
    rows = int((END - START).total_seconds() // STEP_S) + 1
    t_d = np.arange(rows, dtype=np.float64) * STEP_S / DAY_S

    # Sun: the subsolar longitude moves west (decreasing) once per synodic month, as on the real
    # Moon; its latitude swings within +-1.5 degrees.
    sun_lon = -2.0 * np.pi * t_d / SYNODIC_D
    sun_lat = np.radians(SUN_TILT_DEG) * np.sin(2.0 * np.pi * t_d / SUN_TILT_PERIOD_D)
    sun = np.stack([
        np.cos(sun_lat) * np.cos(sun_lon),
        np.cos(sun_lat) * np.sin(sun_lon),
        np.sin(sun_lat),
    ], axis=1)

    # Earth: near +x, wobbling 7 degrees either way in longitude and latitude over 27.3 days,
    # a quarter period apart (libration).
    w = 2.0 * np.pi * t_d / EARTH_WOBBLE_D
    e_lon = np.radians(EARTH_WOBBLE_DEG) * np.sin(w)
    e_lat = np.radians(EARTH_WOBBLE_DEG) * np.cos(w)
    earth = EARTH_KM * np.stack([
        np.cos(e_lat) * np.cos(e_lon),
        np.cos(e_lat) * np.sin(e_lon),
        np.sin(e_lat),
    ], axis=1)

    table = np.concatenate([sun, earth], axis=1).astype("<f4")
    (OUT / "ephemeris.bin").write_bytes(table.tobytes(order="C"))
    write_json("ephemeris.json", {
        "start": iso(START),
        "step_s": STEP_S,
        "rows": rows,
        "frame": "MOON_ME_DE421",
        "columns": ["sun_x", "sun_y", "sun_z", "earth_x_km", "earth_y_km", "earth_z_km"],
        "source": "mock",
    })
    return rows


def make_dem() -> np.ndarray:
    # A whole-number col and row is exactly on a stored value (contract projection).
    idx = np.arange(SIZE, dtype=np.float64)
    xs = X_MIN_M + idx * PIXEL_M
    ys = Y_MAX_M - idx * PIXEL_M
    x, y = np.meshgrid(xs, ys)  # row 0 is the top row, y = y_max_m

    h = np.zeros_like(x)

    # Bowl crater with a raised rim. Distances are measured in the projected plane; near the
    # pole the scale error is under 0.1 %, far below a cell.
    cx, cy = project(*CRATER)
    d = np.hypot(x - cx, y - cy)
    inner = CRATER_FLOOR_M + (RIM_M - CRATER_FLOOR_M) * smoothstep(FLAT_M, CRATER_R_M - FLAT_M, d)
    outer = RIM_M * (1.0 - smoothstep(CRATER_R_M + FLAT_M, CRATER_R_M + FLAT_M + OUTER_SLOPE_M, d))
    h += np.where(d <= CRATER_R_M, inner, outer)

    # Ridge: 20 km long, pointing at the pole, 1,500 m high along its middle.
    rx, ry = project(*RIDGE)
    rr = math.hypot(rx, ry)
    ux, uy = rx / rr, ry / rr                    # along the ridge
    s = (x - rx) * ux + (y - ry) * uy            # along
    n = -(x - rx) * uy + (y - ry) * ux           # across
    along = 1.0 - smoothstep(RIDGE_FULL_LEN_M, RIDGE_HALF_LEN_M, np.abs(s))
    across = 1.0 - smoothstep(0.0, RIDGE_HALF_WIDTH_M, np.abs(n))
    h += RIDGE_M * along * across

    grid = np.round(h / HEIGHT_SCALE).astype("<i2")
    (OUT / "dem.bin").write_bytes(grid.tobytes(order="C"))
    write_json("dem.json", {
        "size": SIZE,
        "pixel_m": PIXEL_M,
        "x_min_m": X_MIN_M,
        "y_max_m": Y_MAX_M,
        "height_scale": HEIGHT_SCALE,
        "nodata": NODATA,
        "min_lat": MIN_LAT,
        "source": "mock",
    })
    return grid


def make_sites() -> None:
    write_json("sites.json", SITES)


def make_validation() -> None:
    write_json("validation.json", {
        "checked_at": None,
        "tolerance_deg": 0.1,
        "max_diff_deg": None,
        "cases": [],
    })


# --- Read-back checks -------------------------------------------------------------------------

def height_at(meta: dict, grid: np.ndarray, lat: float, lon: float) -> float:
    """Same as dem.ts heightAt: contract projection, then bilinear between cells."""
    x, y = project(lat, lon)
    col = (float(x) - meta["x_min_m"]) / meta["pixel_m"]
    row = (meta["y_max_m"] - float(y)) / meta["pixel_m"]
    last = meta["size"] - 1
    if not (0 <= col <= last and 0 <= row <= last):
        return 0.0
    c0 = min(int(math.floor(col)), last - 1)
    r0 = min(int(math.floor(row)), last - 1)
    u, v = col - c0, row - r0

    def cell(r: int, c: int) -> float:
        val = int(grid[r, c])
        return 0.0 if val == meta["nodata"] else val * meta["height_scale"]

    top = cell(r0, c0) * (1 - u) + cell(r0, c0 + 1) * u
    bottom = cell(r0 + 1, c0) * (1 - u) + cell(r0 + 1, c0 + 1) * u
    return top * (1 - v) + bottom * v


def check() -> bool:
    ok = True

    def report(passed: bool, text: str) -> None:
        nonlocal ok
        ok = ok and passed
        print(f"  [{'PASS' if passed else 'FAIL'}] {text}")

    eph_meta = json.loads((OUT / "ephemeris.json").read_text(encoding="utf-8"))
    dem_meta = json.loads((OUT / "dem.json").read_text(encoding="utf-8"))
    sites = json.loads((OUT / "sites.json").read_text(encoding="utf-8"))
    val = json.loads((OUT / "validation.json").read_text(encoding="utf-8"))
    eph_bytes = (OUT / "ephemeris.bin").stat().st_size
    dem_bytes = (OUT / "dem.bin").stat().st_size

    print("1. File sizes")
    need = eph_meta["rows"] * 24
    report(eph_bytes == need, f"ephemeris.bin is {eph_bytes} bytes; rows * 24 = {need}")
    need = dem_meta["size"] ** 2 * 2
    report(dem_bytes == need, f"dem.bin is {dem_bytes} bytes; size * size * 2 = {need}")
    t0 = datetime.strptime(eph_meta["start"], "%Y-%m-%dT%H:%M:%SZ").replace(tzinfo=timezone.utc)
    last = t0.timestamp() + (eph_meta["rows"] - 1) * eph_meta["step_s"]
    last_iso = iso(datetime.fromtimestamp(last, tz=timezone.utc))
    report(eph_meta["start"] == iso(START) and last_iso == iso(END),
           f"table runs {eph_meta['start']} to {last_iso}, every {eph_meta['step_s']} s")

    print("2. Heights read back through the contract projection")
    grid = np.fromfile(OUT / "dem.bin", dtype="<i2").reshape(dem_meta["size"], dem_meta["size"])
    for lat, lon, want, tol in [(-88.0, 45.0, -3000.0, 50.0),
                                (-87.67, 45.0, 500.0, 100.0),
                                (-89.5, 0.0, 0.0, 0.0)]:
        got = height_at(dem_meta, grid, lat, lon)
        report(abs(got - want) <= tol,
               f"height at ({lat}, {lon}) = {got:.1f} m; want {want:.0f} within {tol:.0f}")
    got = height_at(dem_meta, grid, *RIDGE)
    print(f"  [info] ridge centre ({RIDGE[0]}, {RIDGE[1]}) = {got:.1f} m")

    print("3. Sun vectors")
    table = np.fromfile(OUT / "ephemeris.bin", dtype="<f4").astype(np.float64).reshape(-1, 6)
    lengths = np.linalg.norm(table[:, 0:3], axis=1)
    worst = float(np.max(np.abs(lengths - 1.0)))
    report(worst <= 1e-6, f"largest |length - 1| over {len(table)} rows = {worst:.2e}")
    sun_lat = np.degrees(np.arcsin(np.clip(table[:, 2] / lengths, -1, 1)))
    report(float(np.max(np.abs(sun_lat))) <= 1.5 + 1e-6,
           f"Sun latitude within +-{np.max(np.abs(sun_lat)):.4f} degrees (limit 1.5)")
    earth_d = np.linalg.norm(table[:, 3:6], axis=1)
    off_x = np.degrees(np.arccos(table[:, 3] / earth_d))
    report(abs(float(np.min(earth_d)) - EARTH_KM) < 1 and abs(float(np.max(earth_d)) - EARTH_KM) < 1,
           f"Earth distance {np.min(earth_d):.1f}..{np.max(earth_d):.1f} km; "
           f"up to {np.max(off_x):.2f} degrees from +x")

    print("4. sites.json")
    fields = ["id", "name", "lat", "lon", "agency", "year", "status", "group", "note", "source"]
    by_id = {s.get("id"): s for s in sites}
    for sid, lat, lon in [("mock-floor", -88.0, 45.0), ("mock-rim", -87.67, 45.0),
                          ("mock-equator", 1.0, 23.0)]:
        s = by_id.get(sid)
        has = s is not None and all(f in s for f in fields)
        right = has and s["lat"] == lat and s["lon"] == lon
        report(right, f"{sid} at ({lat}, {lon}) with all {len(fields)} contract fields")
    report(len(sites) == 3, f"{len(sites)} sites in the file")

    print("5. Mock markers")
    report(eph_meta.get("source") == "mock", f'ephemeris.json "source": {json.dumps(eph_meta.get("source"))}')
    report(dem_meta.get("source") == "mock", f'dem.json "source": {json.dumps(dem_meta.get("source"))}')
    report("checked_at" in val and val["checked_at"] is None,
           f'validation.json "checked_at": {json.dumps(val.get("checked_at"))}')
    report(val.get("cases") == [], f'validation.json "cases": {json.dumps(val.get("cases"))}')

    return ok


def real_files() -> list[str]:
    """What in web/public/data/ is real data, by the mock markers of contract section 2. A file
    that can't be read counts as real: better to stop than to write over it."""
    def read(name: str):
        path = OUT / name
        if not path.exists():
            return None
        try:
            return json.loads(path.read_text(encoding="utf-8"))
        except (OSError, ValueError):
            return "unreadable"

    def is_mock(data, test) -> bool:
        try:
            return bool(test(data))
        except (AttributeError, KeyError, TypeError):
            return False

    mock_ids = [s["id"] for s in SITES]
    found = []
    for name, shown, test in [
        ("ephemeris.json", "ephemeris.json and the Sun and Earth table", lambda d: d["source"] == "mock"),
        ("dem.json", "dem.json and dem.bin", lambda d: d["source"] == "mock"),
        ("validation.json", "validation.json", lambda d: d["checked_at"] is None),
        ("sites.json", "sites.json", lambda d: [s["id"] for s in d] == mock_ids),
    ]:
        data = read(name)
        if data is not None and not is_mock(data, test):
            found.append(shown)
    return found


def main() -> int:
    real = real_files()
    if real and "--force" not in sys.argv[1:]:
        print(f"Not written. These files in {OUT} hold real data, and the mock would replace them:")
        for name in real:
            print(f"  {name}")
        print("Nothing was changed. To write the mock files over them anyway:")
        print("  python data-prep/make_mock.py --force")
        return 2
    OUT.mkdir(parents=True, exist_ok=True)
    rows = make_ephemeris()
    make_dem()
    make_sites()
    make_validation()
    print(f"Wrote mock data to {OUT} ({rows} ephemeris rows)\n")
    ok = check()
    print("\nAll checks pass." if ok else "\nSome checks FAILED.")
    return 0 if ok else 1


if __name__ == "__main__":
    sys.exit(main())
