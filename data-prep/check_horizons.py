"""T03: check our Sun and Earth angles against JPL Horizons.

Run from anywhere:  python data-prep/check_horizons.py [--refresh]
Needs skyfield and numpy (data-prep/requirements.txt) and, on first run, the network.

For 3 sites x 3 times x 2 bodies (Sun, Earth) it asks Horizons for azimuth and elevation from
a point on the Moon, and computes ours with the same method as T01's fixtures (Skyfield,
apparent, surface point at 0 m; see make_ephemeris.py). Writes (docs/data-contract.md, sec. 2):
  web/public/data/validation.json
  web/src/core/__fixtures__/horizons.json
then prints the "Done when" checks from tasks/T03-horizons-check.md. Exits 1 if one fails.

Gentle on JPL: one request per site and body (6 in all, each holding that site's 3 times),
one at a time, with a pause between them. Replies are cached in data-prep/raw/horizons/
(git-ignored), so a re-run sends nothing unless --refresh is given.

Nothing here is tuned to make the numbers agree: sites and times are fixed below, chosen
before any reply was seen, and the difference is reported as it comes out.
"""

from __future__ import annotations

import json
import math
import re
import sys
import time
import urllib.parse
import urllib.request
from datetime import datetime, timezone
from pathlib import Path

import numpy as np

from make_ephemeris import OUT, FIX, RAW, contract_altaz, load_skyfield

API = "https://ssd.jpl.nasa.gov/api/horizons.api"
CACHE = RAW / "horizons"
PAUSE_S = 3.0
TOLERANCE_DEG = 0.1

BODIES = {"sun": "10", "earth": "399"}

# (lat, lon) north-positive / east-positive, and three UTC times each, spread over 2026-2035.
SITES = [
    ((-89.5, -45.0), ["2026-06-21T00:00:00Z", "2029-12-01T06:00:00Z", "2033-03-17T12:00:00Z"]),  # south polar
    ((-45.0, -60.0), ["2027-02-10T03:00:00Z", "2030-08-25T15:00:00Z", "2034-05-05T21:00:00Z"]),  # mid-latitude
    ((0.5, 75.0), ["2028-04-01T09:00:00Z", "2031-10-31T18:00:00Z", "2035-07-15T00:00:00Z"]),     # equatorial
]


def horizons_params(lat: float, lon: float, body: str, times: list[str]) -> dict[str, str]:
    """The settings from the task's Notes, plus output-format switches that change no numbers."""
    tlist = " ".join(f"'{t[:10]} {t[11:16]}'" for t in times)
    return {
        "format": "json",
        "COMMAND": f"'{BODIES[body]}'",
        "OBJ_DATA": "'NO'",
        "MAKE_EPHEM": "'YES'",
        "EPHEM_TYPE": "'OBSERVER'",
        "CENTER": "'coord@301'",
        "COORD_TYPE": "'GEODETIC'",
        "SITE_COORD": f"'{lon},{lat},0'",   # east longitude first, then latitude, height km
        "TLIST": tlist,
        "TIME_TYPE": "'UT'",
        "QUANTITIES": "'4'",
        "APPARENT": "'AIRLESS'",
        "ANG_FORMAT": "'DEG'",
        "CSV_FORMAT": "'YES'",
    }


def fetch(lat: float, lon: float, body: str, times: list[str], refresh: bool, state: dict) -> str:
    CACHE.mkdir(parents=True, exist_ok=True)
    cache = CACHE / f"{body}_{lat}_{lon}.json"
    params = horizons_params(lat, lon, body, times)
    if cache.exists() and not refresh:
        saved = json.loads(cache.read_text(encoding="utf-8"))
        if saved.get("params") == params:
            return saved["result"]
    if state["sent"]:
        time.sleep(PAUSE_S)
    url = API + "?" + urllib.parse.urlencode(params)
    req = urllib.request.Request(url, headers={"User-Agent": "darksight-data-prep/1.0"})
    for attempt in range(3):
        try:
            with urllib.request.urlopen(req, timeout=60) as resp:
                reply = json.loads(resp.read().decode("utf-8"))
            break
        except urllib.error.HTTPError as e:
            if e.code != 503 or attempt == 2:
                raise
            time.sleep(PAUSE_S * 5 * (attempt + 1))  # server busy: back off, then try again
    state["sent"] += 1
    if "error" in reply:
        raise RuntimeError(f"Horizons error for {body} at {lat},{lon}: {reply['error']}")
    cache.write_text(json.dumps({"params": params, "signature": reply.get("signature"),
                                 "result": reply["result"]}, indent=1), encoding="utf-8")
    return reply["result"]


HEADER_KEYS = re.compile(r"Center geodetic|Center radii|Center-site name|Target body name|"
                         r"Center body name|Reference frame|DE4\d\d|MEAN_ME|refract|airless|"
                         r"Azi_|Elev", re.IGNORECASE)


def parse(result: str, times: list[str]) -> tuple[list[tuple[float, float]], list[str]]:
    """Azimuth and elevation per time from the $$SOE..$$EOE table, plus the header lines worth reading."""
    head, _, rest = result.partition("$$SOE")
    table, _, _ = rest.partition("$$EOE")
    rows = [line for line in table.strip().splitlines() if line.strip()]
    if len(rows) != len(times):
        raise RuntimeError(f"expected {len(times)} rows, got {len(rows)}:\n{result}")
    out = []
    for line in rows:
        nums = []
        for field in line.split(",")[1:]:
            try:
                nums.append(float(field))
            except ValueError:
                pass
        if len(nums) < 2:
            raise RuntimeError(f"no azimuth/elevation in row: {line!r}")
        az, el = nums[-2], nums[-1]
        out.append((el, az))
    notes = [line.strip() for line in head.splitlines() if HEADER_KEYS.search(line)]
    return out, notes


def separation(a: dict, b: dict) -> float:
    """Angle on the sky between two alt/az directions, degrees. Fair near the zenith, where
    azimuth alone is meaningless."""
    a1, a2 = math.radians(a["alt"]), math.radians(b["alt"])
    daz = math.radians(a["az"] - b["az"])
    c = math.sin(a1) * math.sin(a2) + math.cos(a1) * math.cos(a2) * math.cos(daz)
    return math.degrees(math.acos(max(-1.0, min(1.0, c))))


def ours_skyfield(ts, eph, pc, frame, lat, lon, body, times):
    """Same method as T01's fixtures: Skyfield, surface point at 0 m, apparent alt/az."""
    t = ts.from_datetimes([parse_utc(x) for x in times])
    place = eph["moon"] + pc.build_latlon_degrees(frame, lat, lon, elevation_m=0.0)
    alt, az, _ = place.at(t).observe(eph[body]).apparent().altaz()
    return [{"alt": float(alt.degrees[i]), "az": float(az.degrees[i])} for i in range(len(times))]


def parse_utc(text: str) -> datetime:
    return datetime.strptime(text, "%Y-%m-%dT%H:%M:%SZ").replace(tzinfo=timezone.utc)


def table_row(meta: dict, t: datetime, files: dict) -> np.ndarray:
    """The table's six values at time t, with a straight-line step between rows as in
    ephemeris.ts. Reads the decade files listed under "chunks", or the one-file form
    (ephemeris.bin) when there are none. `files` keeps what was already read."""
    parts = meta.get("chunks") or [{"file": "ephemeris.bin", "start": meta["start"]}]
    begun = [p for p in parts if parse_utc(p["start"]) <= t]
    if not begun:
        raise RuntimeError(f"{t.isoformat()} is before the table starts ({meta['start']})")
    part = max(begun, key=lambda p: parse_utc(p["start"]))   # the last file starting at or before t
    if part["file"] not in files:
        files[part["file"]] = (np.fromfile(OUT / part["file"], dtype="<f4")
                               .reshape(-1, 6).astype(np.float64))
    a = files[part["file"]]
    h = (t - parse_utc(part["start"])).total_seconds() / meta["step_s"]
    if h > len(a) - 1:
        raise RuntimeError(f"{t.isoformat()} is after the table ends")
    i = min(int(h), len(a) - 2)
    f = h - i
    return a[i] * (1 - f) + a[i + 1] * f


def main() -> int:
    refresh = "--refresh" in sys.argv
    ts, eph, pc, frame = load_skyfield()
    state = {"sent": 0}
    cases = []
    for (lat, lon), times in SITES:
        for body in BODIES:
            result = fetch(lat, lon, body, times, refresh, state)
            hz, notes = parse(result, times)
            print(f"--- Horizons header, {body} from ({lat}, {lon}):")
            for n in notes:
                print("   ", n)
            ours = ours_skyfield(ts, eph, pc, frame, lat, lon, body, times)
            for t, (el, az), o in zip(times, hz, ours):
                h = {"alt": el, "az": az}
                cases.append({
                    "lat": lat, "lon": lon, "t": t, "body": body,
                    "ours": {"alt": round(o["alt"], 6), "az": round(o["az"], 6)},
                    "horizons": {"alt": round(h["alt"], 6), "az": round(h["az"], 6)},
                    "diff_deg": round(separation(o, h), 6),
                })
    print(f"requests sent to Horizons this run: {state['sent']}")

    max_diff = max(c["diff_deg"] for c in cases)
    validation = {
        "checked_at": datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ"),
        "tolerance_deg": TOLERANCE_DEG,
        "max_diff_deg": max_diff,
        "cases": cases,
    }
    fixtures = [{"lat": c["lat"], "lon": c["lon"], "t": c["t"], "body": c["body"],
                 "alt": c["horizons"]["alt"], "az": c["horizons"]["az"]} for c in cases]
    (OUT / "validation.json").write_text(json.dumps(validation, indent=2) + "\n",
                                         encoding="utf-8", newline="\n")
    FIX.mkdir(parents=True, exist_ok=True)
    (FIX / "horizons.json").write_text(json.dumps(fixtures, indent=2) + "\n",
                                       encoding="utf-8", newline="\n")
    return 0 if check() else 1


def check() -> bool:
    ok_all = True

    def report(ok: bool, text: str) -> None:
        nonlocal ok_all
        ok_all &= bool(ok)
        print(f"[{'PASS' if ok else 'FAIL'}] {text}")

    v = json.loads((OUT / "validation.json").read_text(encoding="utf-8"))
    cases = v["cases"]
    fmt = all(
        set(c) == {"lat", "lon", "t", "body", "ours", "horizons", "diff_deg"}
        and c["body"] in BODIES and c["t"].endswith("Z") and -180 <= c["lon"] <= 180
        and set(c["ours"]) == {"alt", "az"} and set(c["horizons"]) == {"alt", "az"}
        for c in cases
    )
    combos = {(c["lat"], c["lon"], c["t"], c["body"]) for c in cases}
    report(len(cases) == 18 and len(combos) == 18 and fmt and v["checked_at"],
           f"validation.json: {len(cases)} cases, {len(combos)} distinct, contract format: {fmt}")

    print("    site            time                  body   ours alt/az              horizons alt/az          diff")
    for c in cases:
        print(f"    ({c['lat']:6.1f},{c['lon']:6.1f}) {c['t']}  {c['body']:5s}  "
              f"{c['ours']['alt']:9.4f} {c['ours']['az']:9.4f}     "
              f"{c['horizons']['alt']:9.4f} {c['horizons']['az']:9.4f}     {c['diff_deg']:.4f}")
    report(v["max_diff_deg"] < TOLERANCE_DEG,
           f"max_diff_deg (Skyfield vs Horizons) = {v['max_diff_deg']:.4f} (limit < {TOLERANCE_DEG})")

    # The browser's path, mirrored in Python: our table + contract geometry (ground 0, eye 0),
    # interpolated like ephemeris.ts. horizons.test.ts runs the real TypeScript on the same cases.
    meta = json.loads((OUT / "ephemeris.json").read_text(encoding="utf-8"))
    if meta["source"] == "mock":
        print("[skip] ephemeris table is mock: no table-vs-Horizons check")
        return ok_all
    files: dict = {}
    worst = 0.0
    for c in cases:
        row = table_row(meta, parse_utc(c["t"]), files)
        (sa, sz), (ea, ez) = contract_altaz(c["lat"], c["lon"], row[:3], row[3:])
        mine = {"alt": float(sa), "az": float(sz)} if c["body"] == "sun" else {"alt": float(ea), "az": float(ez)}
        worst = max(worst, separation(mine, c["horizons"]))
    report(worst < TOLERANCE_DEG,
           f"table + contract geometry (Python mirror of the browser maths) vs Horizons: "
           f"max {worst:.4f} deg (limit < {TOLERANCE_DEG}); frame {meta['frame']}")
    return ok_all


if __name__ == "__main__":
    sys.exit(main())
