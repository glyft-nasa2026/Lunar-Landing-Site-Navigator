"""T01: hourly Sun and Earth table from Skyfield, plus altitude/azimuth fixtures.

Run from anywhere:  python data-prep/make_ephemeris.py
Needs skyfield and numpy (data-prep/requirements.txt). On first run it downloads the JPL/NAIF
kernels (about 50 MB) into data-prep/raw/, which is git-ignored.

Writes (docs/data-contract.md, section 2):
  web/public/data/ephemeris.json            the index: whole span plus one entry per decade
  web/public/data/ephemeris/<decade>.bin    1950.bin .. 2040.bin, hourly rows
  web/src/core/__fixtures__/altaz.json
then reads them back and prints the "Done when" checks from tasks/T01-ephemeris.md.
Exits with code 1 if any check fails.

The table covers 1950-01-01T00Z to 2051-01-01T00Z. It is split by decade so the browser
downloads only the decades it needs (2020s first). Each decade's file ends with the first hour
of the next decade, so any time inside a decade is served by that one file alone.

The Moon frame is built as on the Skyfield page "Planetary Reference Frames"
(https://rhodesmill.org/skyfield/planetary.html), with the DE440 kernels in place of DE421:
moon_de440_250416.tf + pck00011.tpc + moon_pa_de440_200625.bpc, frame MOON_ME_DE440_ME421
(the mean-Earth frame LOLA uses). DE421's Moon orientation file stops in 2050; DE440's runs
1550-2650.

Each decade is computed in one vectorised Skyfield call; there is no Python loop over hours.
"""

from __future__ import annotations

import json
import math
import sys
from datetime import datetime, timezone
from pathlib import Path

import numpy as np
from skyfield.api import Loader
from skyfield.planetarylib import PlanetaryConstants

HERE = Path(__file__).resolve().parent
ROOT = HERE.parent
RAW = HERE / "raw"
OUT = ROOT / "web" / "public" / "data"
CHUNK_DIR = "ephemeris"
FIX = ROOT / "web" / "src" / "core" / "__fixtures__"

NAIF = "https://naif.jpl.nasa.gov/pub/naif/generic_kernels/"
KERNELS = {
    "de440s.bsp": NAIF + "spk/planets/de440s.bsp",
    "moon_de440_250416.tf": NAIF + "fk/satellites/moon_de440_250416.tf",
    "pck00011.tpc": NAIF + "pck/pck00011.tpc",
    "moon_pa_de440_200625.bpc": NAIF + "pck/moon_pa_de440_200625.bpc",
}
FRAME = "MOON_ME_DE440_ME421"
SOURCE = "JPL DE440 via Skyfield"
FIRST_YEAR, LAST_YEAR = 1950, 2050        # inclusive; the table ends 2051-01-01T00Z
DECADES = list(range(FIRST_YEAR, LAST_YEAR, 10))  # 1950 .. 2040; the 2040s file runs to 2051
HOME = 2020                               # the decade the page loads first
STEP_S = 3600
R_KM = 1737.4
COLUMNS = ["sun_x", "sun_y", "sun_z", "earth_x_km", "earth_y_km", "earth_z_km"]

# Fixture sites: polar, mid-latitude (both hemispheres) and equatorial, near and far side.
FIXTURE_SITES = [
    (-89.5, 0.0),     # south polar
    (-45.0, 120.0),   # southern mid-latitude
    (26.3, -46.8),    # northern mid-latitude (Aristarchus, the Skyfield docs example)
    (0.0, 0.0),       # equatorial, sub-Earth
    (1.0, 23.0),      # equatorial (the mock-equator site)
]
FIXTURE_TIMES_PER_SITE = 6  # 30 cases, spread over the century


def utc(year: int) -> datetime:
    return datetime(year, 1, 1, tzinfo=timezone.utc)


def iso(year: int) -> str:
    return f"{year:04d}-01-01T00:00:00Z"


def decade_end(start: int) -> int:
    return LAST_YEAR + 1 if start == DECADES[-1] else start + 10


def hours_between(a: int, b: int) -> int:
    return int((utc(b) - utc(a)).total_seconds() // STEP_S)


TOTAL_ROWS = hours_between(FIRST_YEAR, LAST_YEAR + 1) + 1


def load_skyfield():
    RAW.mkdir(parents=True, exist_ok=True)
    load = Loader(str(RAW))
    for name, url in KERNELS.items():
        if not (RAW / name).exists():
            load.download(url, filename=name)
    ts = load.timescale()
    eph = load("de440s.bsp")
    pc = PlanetaryConstants()
    pc.read_text(load("moon_de440_250416.tf"))
    pc.read_text(load("pck00011.tpc"))
    pc.read_binary(load("moon_pa_de440_200625.bpc"))
    # The .bpc holds two segments (1550-2426 and 2426-2650). Skyfield keeps only the last one
    # per body, so hand it the segment that covers our span.
    pa = pc._get_assignment("FRAME_MOON_PA_DE440")
    t0, t1 = ts.utc(FIRST_YEAR - 1, 1, 1).tdb, ts.utc(LAST_YEAR + 2, 1, 1).tdb
    segment = next(s for s in pc._segment_list
                   if s.body == pa and s.initial_jd <= t0 and s.final_jd >= t1)
    frame = pc.build_frame(pc._get_assignment(f"FRAME_{FRAME}"), _segment=segment)
    return ts, eph, pc, frame


def make_table(ts, eph, frame, start: int, end: int) -> np.ndarray:
    """(rows, 6) float64 for start-01-01T00Z .. end-01-01T00Z inclusive, Moon-fixed frame."""
    hours = np.arange(hours_between(start, end) + 1)
    # Calendar day plus hour of day, not "hours since start": Skyfield counts an hour offset in
    # elapsed seconds, which would slip each row off the UTC hour by every leap second (9 s by
    # 1980). The browser reads row i as start + i * 3600 s of Unix time, which has no leap seconds.
    t = ts.utc(start, 1, 1 + hours // 24, hours % 24)  # one Time object holding every hour
    moon = eph["moon"].at(t)
    # Apparent (light-time, aberration, deflection) positions from the Moon's centre.
    sun = moon.observe(eph["sun"]).apparent().frame_xyz(frame).km      # (3, rows)
    earth = moon.observe(eph["earth"]).apparent().frame_xyz(frame).km  # (3, rows)
    sun_unit = sun / np.linalg.norm(sun, axis=0)
    return np.vstack([sun_unit, earth]).T


def fixture_times(ts):
    """Spread over the century, deliberately off the hour so they land between table rows."""
    n = len(FIXTURE_SITES) * FIXTURE_TIMES_PER_SITE
    span_h = (TOTAL_ROWS - 1) - 48
    minutes = np.round((24 + np.linspace(0, span_h, n) + 0.37) * 60.0 + 13.0 * np.arange(n) % 60)
    return ts.utc(FIRST_YEAR, 1, 1 + minutes // 1440, 0, minutes % 1440)


def make_fixtures(ts, eph, pc, frame) -> list[dict]:
    """Alt/az straight from Skyfield for a point on the surface. Never touches our table."""
    t_all = fixture_times(ts)
    moon, sun, earth = eph["moon"], eph["sun"], eph["earth"]
    cases = []
    k = len(FIXTURE_SITES)
    for i, (lat, lon) in enumerate(FIXTURE_SITES):  # loop over 5 sites, each vectorised in time
        t = t_all[i::k]  # interleaved, so every site's cases span the whole century
        place = moon + pc.build_latlon_degrees(frame, lat, lon, elevation_m=0.0)
        obs = place.at(t)
        s_alt, s_az, _ = obs.observe(sun).apparent().altaz()
        e_alt, e_az, _ = obs.observe(earth).apparent().altaz()
        for j, stamp in enumerate(t.utc_strftime("%Y-%m-%dT%H:%M:%SZ")):
            cases.append({
                "lat": lat, "lon": lon, "t": stamp,
                "sun": {"alt": round(float(s_alt.degrees[j]), 6), "az": round(float(s_az.degrees[j]), 6)},
                "earth": {"alt": round(float(e_alt.degrees[j]), 6), "az": round(float(e_az.degrees[j]), 6)},
            })
    cases.sort(key=lambda c: c["t"])
    return cases


def write_chunk(start: int, table: np.ndarray) -> dict:
    (OUT / CHUNK_DIR).mkdir(parents=True, exist_ok=True)
    table.astype("<f4").tofile(OUT / CHUNK_DIR / f"{start}.bin")
    return {"file": f"{CHUNK_DIR}/{start}.bin", "start": iso(start), "rows": len(table)}


def write_index(chunks: list[dict], cases: list[dict]) -> None:
    FIX.mkdir(parents=True, exist_ok=True)
    meta = {
        "start": iso(FIRST_YEAR),
        "step_s": STEP_S,
        "rows": TOTAL_ROWS,
        "frame": FRAME,
        "columns": COLUMNS,
        "source": SOURCE,
        "home": DECADES.index(HOME),
        "chunks": chunks,
    }
    (OUT / "ephemeris.json").write_text(json.dumps(meta, indent=2) + "\n", encoding="utf-8", newline="\n")
    (FIX / "altaz.json").write_text(json.dumps(cases, indent=2) + "\n", encoding="utf-8", newline="\n")
    old = OUT / "ephemeris.bin"  # the single-file table this split replaces
    if old.exists():
        old.unlink()


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
    chunks = meta["chunks"]
    parts = []
    joined = True
    expect_start = meta["start"]
    for c in chunks:
        raw = (OUT / c["file"]).read_bytes()
        ok = len(raw) == c["rows"] * 24 and c["start"] == expect_start
        joined &= ok
        if not ok:
            print(f"       {c['file']}: {len(raw)} bytes, rows {c['rows']}, start {c['start']}")
        parts.append(np.frombuffer(raw, dtype="<f4").reshape(c["rows"], 6).astype(np.float64))
        expect_start = iso(decade_end(int(c["start"][:4])))
    report(joined and len(chunks) == len(DECADES),
           f"{len(chunks)} decade files, each rows * 24 bytes, each starting where the last ends")
    # Neighbouring files share their boundary row: the last row of one is the first of the next.
    seams = max(float(np.abs(a[-1] - b[0]).max()) for a, b in zip(parts, parts[1:]))
    report(seams == 0.0, f"boundary rows match between decades (max difference {seams})")
    a = np.vstack([parts[0]] + [p[1:] for p in parts[1:]])
    report(len(a) == meta["rows"] == TOTAL_ROWS,
           f"{len(a)} rows in all = index rows {meta['rows']} ({iso(FIRST_YEAR)} .. {iso(LAST_YEAR + 1)})")
    report(chunks[meta["home"]]["start"] == iso(HOME), f"home decade starts {chunks[meta['home']]['start']}")
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
    t0 = np.datetime64(iso(FIRST_YEAR)[:-1])
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
    chunks = []
    for start in DECADES:
        table = make_table(ts, eph, frame, start, decade_end(start))
        chunks.append(write_chunk(start, table))
        print(f"wrote {OUT / chunks[-1]['file']} ({len(table)} rows)")
    cases = make_fixtures(ts, eph, pc, frame)
    write_index(chunks, cases)
    print(f"wrote {OUT / 'ephemeris.json'}, {FIX / 'altaz.json'} ({len(cases)} cases)")
    return 0 if check() else 1


if __name__ == "__main__":
    sys.exit(main())
