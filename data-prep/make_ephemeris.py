"""T01: hourly Sun and Earth table from Skyfield, plus altitude/azimuth fixtures.

Run from anywhere:  python data-prep/make_ephemeris.py
Needs skyfield and numpy (data-prep/requirements.txt). On first run Skyfield downloads its
JPL/NAIF kernels (about 20 MB) into data-prep/raw/, which is git-ignored.

Writes (docs/data-contract.md, section 2):
  web/public/data/ephemeris.bin + ephemeris.json
  web/src/core/__fixtures__/altaz.json
then reads them back and prints the "Done when" checks from tasks/T01-ephemeris.md.
Exits with code 1 if any check fails.

The Moon frame is built exactly as on the Skyfield page "Planetary Reference Frames"
(https://rhodesmill.org/skyfield/planetary.html): moon_080317.tf + pck00008.tpc +
moon_pa_de421_1900-2050.bpc, then pc.build_frame_named('MOON_ME_DE421').

The whole decade is computed in one vectorised Skyfield call (a Time array of 87,649 hours);
there is no Python loop over hours.
"""

from __future__ import annotations

import json
import math
import sys
from pathlib import Path

import numpy as np
from skyfield.api import Loader
from skyfield.planetarylib import PlanetaryConstants

HERE = Path(__file__).resolve().parent
ROOT = HERE.parent
RAW = HERE / "raw"
OUT = ROOT / "web" / "public" / "data"
FIX = ROOT / "web" / "src" / "core" / "__fixtures__"

FRAME = "MOON_ME_DE421"
START = (2026, 1, 1)
STEP_S = 3600
ROWS = 87649  # 2026-01-01T00Z .. 2036-01-01T00Z inclusive: 3652 days * 24 + 1
R_KM = 1737.4

# Fixture sites: polar, mid-latitude (both hemispheres) and equatorial, near and far side.
FIXTURE_SITES = [
    (-89.5, 0.0),     # south polar
    (-45.0, 120.0),   # southern mid-latitude
    (26.3, -46.8),    # northern mid-latitude (Aristarchus, the Skyfield docs example)
    (0.0, 0.0),       # equatorial, sub-Earth
    (1.0, 23.0),      # equatorial (the mock-equator site)
]
FIXTURE_TIMES_PER_SITE = 5  # 25 cases


def load_skyfield():
    RAW.mkdir(parents=True, exist_ok=True)
    load = Loader(str(RAW))
    ts = load.timescale()
    eph = load("de421.bsp")
    pc = PlanetaryConstants()
    pc.read_text(load("moon_080317.tf"))
    pc.read_text(load("pck00008.tpc"))
    pc.read_binary(load("moon_pa_de421_1900-2050.bpc"))
    frame = pc.build_frame_named(FRAME)
    return ts, eph, pc, frame


def make_table(ts, eph, frame) -> np.ndarray:
    """(ROWS, 6) float64: Sun unit vector, Earth vector in km, Moon-fixed frame."""
    hours = np.arange(ROWS, dtype=np.float64)
    t = ts.utc(*START, hours)  # one Time object holding every hour
    moon = eph["moon"].at(t)
    # Apparent (light-time, aberration, deflection) positions from the Moon's centre.
    sun = moon.observe(eph["sun"]).apparent().frame_xyz(frame).km      # (3, ROWS)
    earth = moon.observe(eph["earth"]).apparent().frame_xyz(frame).km  # (3, ROWS)
    sun_unit = sun / np.linalg.norm(sun, axis=0)
    return np.vstack([sun_unit, earth]).T


def fixture_times(ts):
    """Spread over the ten years, deliberately off the hour so they land between table rows."""
    n = len(FIXTURE_SITES) * FIXTURE_TIMES_PER_SITE
    span_h = (ROWS - 1) - 48
    minutes = np.round((24 + np.linspace(0, span_h, n) + 0.37) * 60.0 + 13.0 * np.arange(n) % 60)
    return ts.utc(*START, 0, minutes)


def make_fixtures(ts, eph, pc, frame) -> list[dict]:
    """Alt/az straight from Skyfield for a point on the surface. Never touches our table."""
    t_all = fixture_times(ts)
    moon, sun, earth = eph["moon"], eph["sun"], eph["earth"]
    cases = []
    k = len(FIXTURE_SITES)
    for i, (lat, lon) in enumerate(FIXTURE_SITES):  # loop over 5 sites, each vectorised in time
        t = t_all[i::k]  # interleaved, so every site's cases span the whole decade
        place = moon + pc.build_latlon_degrees(frame, lat, lon, elevation_m=0.0)
        obs = place.at(t)
        s_alt, s_az, _ = obs.observe(sun).apparent().altaz()
        e_alt, e_az, _ = obs.observe(earth).apparent().altaz()
        for j, iso in enumerate(t.utc_strftime("%Y-%m-%dT%H:%M:%SZ")):
            cases.append({
                "lat": lat, "lon": lon, "t": iso,
                "sun": {"alt": round(float(s_alt.degrees[j]), 6), "az": round(float(s_az.degrees[j]), 6)},
                "earth": {"alt": round(float(e_alt.degrees[j]), 6), "az": round(float(e_az.degrees[j]), 6)},
            })
    cases.sort(key=lambda c: c["t"])
    return cases


def write(table: np.ndarray, cases: list[dict]) -> None:
    OUT.mkdir(parents=True, exist_ok=True)
    FIX.mkdir(parents=True, exist_ok=True)
    table.astype("<f4").tofile(OUT / "ephemeris.bin")
    meta = {
        "start": "2026-01-01T00:00:00Z",
        "step_s": STEP_S,
        "rows": ROWS,
        "frame": FRAME,
        "columns": ["sun_x", "sun_y", "sun_z", "earth_x_km", "earth_y_km", "earth_z_km"],
        "source": "JPL DE421 via Skyfield",
    }
    (OUT / "ephemeris.json").write_text(json.dumps(meta, indent=2) + "\n", encoding="utf-8", newline="\n")
    (FIX / "altaz.json").write_text(json.dumps(cases, indent=2) + "\n", encoding="utf-8", newline="\n")


# --- Checks ("Done when" in tasks/T01-ephemeris.md), on the files as written --------------------

def contract_altaz(lat, lon, sun, earth_km):
    """Contract section 3 geometry, ground 0, eye 0 (vectorised over rows)."""
    la, lo = math.radians(lat), math.radians(lon)
    n = np.array([math.cos(la) * math.cos(lo), math.cos(la) * math.sin(lo), math.sin(la)])
    east = np.array([-math.sin(lo), math.cos(lo), 0.0])
    north = np.array([-math.sin(la) * math.cos(lo), -math.sin(la) * math.sin(lo), math.cos(la)])
    out = []
    for d in (sun, earth_km - R_KM * n):
        d = d / np.linalg.norm(d, axis=-1, keepdims=True)
        alt = np.degrees(np.arcsin(d @ n))
        az = np.degrees(np.arctan2(d @ east, d @ north)) % 360.0
        out.append((alt, az))
    return out


def check() -> bool:
    ok_all = True

    def report(ok: bool, text: str) -> None:
        nonlocal ok_all
        ok_all &= bool(ok)
        print(f"[{'PASS' if ok else 'FAIL'}] {text}")

    meta = json.loads((OUT / "ephemeris.json").read_text(encoding="utf-8"))
    raw = (OUT / "ephemeris.bin").read_bytes()
    rows = meta["rows"]
    report(len(raw) == rows * 24 and rows == ROWS,
           f"ephemeris.bin is {len(raw)} bytes = rows {rows} * 24 = {rows * 24}")
    a = np.frombuffer(raw, dtype="<f4").reshape(rows, 6).astype(np.float64)
    sun, earth = a[:, :3], a[:, 3:]

    sun_len = np.linalg.norm(sun, axis=1)
    err = np.abs(sun_len - 1.0).max()
    report(err <= 1e-6, f"Sun vector length: max |len - 1| = {err:.3e} (limit 1e-6)")

    dist = np.linalg.norm(earth, axis=1)
    report(dist.min() >= 356000 and dist.max() <= 407000,
           f"Earth distance: {dist.min():,.1f} .. {dist.max():,.1f} km (limit 356,000 .. 407,000)")

    sun_lat = np.degrees(np.arcsin(np.clip(sun[:, 2] / sun_len, -1, 1)))
    report(np.abs(sun_lat).max() <= 1.6,
           f"Sun latitude: {sun_lat.min():+.4f} .. {sun_lat.max():+.4f} deg (limit +-1.6)")

    e_lat = np.degrees(np.arcsin(earth[:, 2] / dist))
    e_lon = np.degrees(np.arctan2(earth[:, 1], earth[:, 0]))
    report(np.abs(e_lon).max() <= 8.2 and np.abs(e_lat).max() <= 6.9,
           f"Sub-Earth point: lon {e_lon.min():+.4f} .. {e_lon.max():+.4f} (limit +-8.2), "
           f"lat {e_lat.min():+.4f} .. {e_lat.max():+.4f} deg (limit +-6.9)")

    cases = json.loads((FIX / "altaz.json").read_text(encoding="utf-8"))
    keys_ok = all(
        set(c) == {"lat", "lon", "t", "sun", "earth"}
        and set(c["sun"]) == {"alt", "az"} and set(c["earth"]) == {"alt", "az"}
        and c["t"].endswith("Z") and -180 <= c["lon"] <= 180
        for c in cases
    )
    report(len(cases) >= 20 and keys_ok, f"altaz.json has {len(cases)} cases, contract format: {keys_ok}")

    # Extra (not in "Done when"): the table + contract geometry, interpolated the way the browser
    # does it, against Skyfield's own surface alt/az. Shows the two paths agree.
    worst = 0.0
    t0 = np.datetime64("2026-01-01T00:00:00")
    for c in cases:
        h = (np.datetime64(c["t"][:-1]) - t0) / np.timedelta64(1, "s") / STEP_S
        i, f = int(h), h - int(h)
        v = a[i] * (1 - f) + a[i + 1] * f
        (sa, sz), (ea, ez) = contract_altaz(c["lat"], c["lon"], v[:3], v[3:])
        for alt, az, ref in ((sa, sz, c["sun"]), (ea, ez, c["earth"])):
            daz = (az - ref["az"] + 180) % 360 - 180
            # angular separation on the sky, so azimuth near the zenith doesn't inflate it
            sep = math.degrees(math.acos(min(1.0,
                math.sin(math.radians(alt)) * math.sin(math.radians(ref["alt"]))
                + math.cos(math.radians(alt)) * math.cos(math.radians(ref["alt"])) * math.cos(math.radians(daz)))))
            worst = max(worst, sep)
    print(f"[info] table + contract geometry vs Skyfield surface alt/az: max separation {worst:.4f} deg")
    return ok_all


def main() -> int:
    ts, eph, pc, frame = load_skyfield()
    table = make_table(ts, eph, frame)
    cases = make_fixtures(ts, eph, pc, frame)
    write(table, cases)
    print(f"wrote {OUT / 'ephemeris.bin'} ({ROWS} rows), {OUT / 'ephemeris.json'}, "
          f"{FIX / 'altaz.json'} ({len(cases)} cases)")
    return 0 if check() else 1


if __name__ == "__main__":
    sys.exit(main())
