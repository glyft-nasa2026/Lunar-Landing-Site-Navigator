"""T04: resample the LOLA south-polar height grid into our own grid (docs/data-contract.md, 2).

Source: LRO LOLA gridded data record LDEM_75S_240M, product version V2.0,
data set LRO-L-LOLA-4-GDR-V1.0, from the PDS Geosciences Node:
https://pds-geosciences.wustl.edu/lro/lro-l-lola-3-rdr-v1/lrolol_1xxx/data/lola_gdr/polar/img/

Run from anywhere:
    python data-prep/make_dem.py            download (if needed), resample, write, check
    python data-prep/make_dem.py --png      also write data-prep/raw/dem_grey.png

The download (about 29 MB) goes into data-prep/raw/ (git-ignored). Everything about the source
layout is read from its PDS label, then checked against what this script expects; if the label
says something else the script stops rather than guess.

Source layout, from the label and the data set's projection catalogue (DSMAP_POLAR.CAT):
- int16, little-endian, 3812 x 3812, height = DN * 0.5 m above a 1737.4 km sphere (our datum).
- Polar stereographic on that sphere, true scale at the pole, 240 m per cell, pixel-registered.
- With 0-based column i and row j, and the label's projection offsets S0 = L0 = 1905.5:
      X = (i - S0) * 240        X grows to the right (longitude 90 E points right)
      Y = (L0 - j) * 240        row 0 is the top; longitude 0 points up
  This is the catalogue's line/sample -> lat/lon formula and its written description. (Its
  lat/lon -> line/sample formula has the opposite sign on X; check_orientation() below shows
  from named craters which one the data follows.)

Our grid uses the same sphere, projection and orientation, so a cell of ours maps to a fractional
LOLA cell by an offset only. Our cell centres sit half a LOLA cell off LOLA's, so heights are read
bilinearly from the four nearest LOLA cells.
"""

from __future__ import annotations

import argparse
import json
import math
import re
import sys
import urllib.request
from pathlib import Path

import numpy as np

HERE = Path(__file__).resolve().parent
RAW = HERE / "raw"
OUT = HERE.parent / "web" / "public" / "data"

BASE_URL = ("https://pds-geosciences.wustl.edu/lro/lro-l-lola-3-rdr-v1/lrolol_1xxx/"
            "data/lola_gdr/polar/img/")
PRODUCT = "LDEM_75S_240M"

R_M = 1737.4e3

# Our grid: contract section 2.
SIZE = 2534
PIXEL_M = 240
X_MIN_M = -304080
Y_MAX_M = 304080
HEIGHT_SCALE = 0.5
NODATA = -32768
MIN_LAT = -80
SOURCE = ("LRO LOLA LDEM_75S_240M, product version V2.0 (LRO-L-LOLA-4-GDR-V1.0, "
          "created 2017-06-15), PDS Geosciences Node")

# Crater centres from the IAU Gazetteer of Planetary Nomenclature, LOLA 2011 control network
# (https://planetarynames.wr.usgs.gov/Feature/<id>). Used only to check orientation and to
# pick Shackleton's floor and rim points.
#                 name           id     lat     lon   diameter km
GAZETTEER = [("Shackleton", 5450, -89.67, 129.78, 20.92),
             ("de Gerlache", 1439, -88.48, -88.34, 32.71),
             ("Shoemaker", 5494, -88.14, 45.91, 51.82),
             ("Faustini", 1919, -87.18, 84.31, 42.48),
             ("Haworth", 14502, -87.45, -5.17, 51.42)]


# --- Source --------------------------------------------------------------------------------------

def download(name: str) -> Path:
    RAW.mkdir(exist_ok=True)
    path = RAW / name
    if not path.exists():
        print(f"downloading {BASE_URL + name}")
        tmp = path.with_suffix(path.suffix + ".part")
        urllib.request.urlretrieve(BASE_URL + name, tmp)
        tmp.replace(path)
    return path


def read_label(path: Path) -> dict[str, str]:
    """Flat KEY = value pairs from a PDS3 label (comments and multi-line strings ignored)."""
    out: dict[str, str] = {}
    for line in path.read_text(encoding="ascii", errors="replace").splitlines():
        m = re.match(r"\s*([A-Z_^]+)\s*=\s*(.*?)\s*$", line)
        if m:
            out.setdefault(m.group(1), m.group(2))
    return out


def num(label: dict[str, str], key: str) -> float:
    return float(re.match(r"[-+]?[0-9.]+", label[key]).group(0))


def load_source() -> tuple[np.ndarray, dict]:
    lbl = read_label(download(PRODUCT.lower() + ".lbl"))
    img_path = download(PRODUCT.lower() + ".img")

    src = {
        "lines": int(num(lbl, "LINES")),
        "samples": int(num(lbl, "LINE_SAMPLES")),
        "scale": num(lbl, "SCALING_FACTOR"),
        "offset_m": num(lbl, "OFFSET"),
        "map_scale_m": num(lbl, "MAP_SCALE"),
        "line0": num(lbl, "LINE_PROJECTION_OFFSET"),
        "sample0": num(lbl, "SAMPLE_PROJECTION_OFFSET"),
        "radius_km": num(lbl, "A_AXIS_RADIUS"),
        "center_lat": num(lbl, "CENTER_LATITUDE"),
        "center_lon": num(lbl, "CENTER_LONGITUDE"),
        "rotation": num(lbl, "MAP_PROJECTION_ROTATION"),
    }
    expect = [
        (lbl["PRODUCT_VERSION_ID"].strip('"'), "V2.0"),
        (lbl["SAMPLE_TYPE"], "LSB_INTEGER"),
        (lbl["SAMPLE_BITS"], "16"),
        (lbl["MAP_PROJECTION_TYPE"].strip('"'), "POLAR STEREOGRAPHIC"),
        (lbl["POSITIVE_LONGITUDE_DIRECTION"].strip('"'), "EAST"),
        (src["radius_km"], 1737.4), (num(lbl, "C_AXIS_RADIUS"), 1737.4),
        (src["offset_m"], R_M), (src["center_lat"], -90.0), (src["center_lon"], 0.0),
        (src["rotation"], 0.0), (src["map_scale_m"], 240.0),
        (src["line0"], (src["lines"] - 1) / 2), (src["sample0"], (src["samples"] - 1) / 2),
    ]
    for got, want in expect:
        if got != want:
            sys.exit(f"label says {got!r}, script expects {want!r}: read the label again")

    raw = np.fromfile(img_path, dtype="<i2")
    if raw.size != src["lines"] * src["samples"]:
        sys.exit(f"{img_path} has {raw.size} values, label says {src['lines']}x{src['samples']}")
    return raw.reshape(src["lines"], src["samples"]), src


# --- Resample -----------------------------------------------------------------------------------

def resample(dn: np.ndarray, src: dict) -> np.ndarray:
    """Our int16 grid (0.5 m units) from the LOLA DN grid, bilinear."""
    heights = dn.astype(np.float64) * src["scale"]           # metres above 1737.4 km
    s = src["map_scale_m"]
    x = X_MIN_M + np.arange(SIZE) * PIXEL_M                  # our column centres
    y = Y_MAX_M - np.arange(SIZE) * PIXEL_M                  # our row centres, top first
    fi = x / s + src["sample0"]                              # fractional LOLA column
    fj = src["line0"] - y / s                                # fractional LOLA row
    i0 = np.floor(fi).astype(int)
    j0 = np.floor(fj).astype(int)
    if i0.min() < 0 or j0.min() < 0 or i0.max() + 1 >= src["samples"] or j0.max() + 1 >= src["lines"]:
        sys.exit("our grid reaches outside the LOLA grid")
    wi = (fi - i0)[None, :]
    wj = (fj - j0)[:, None]
    J, I = np.ix_(j0, i0)
    h = ((1 - wj) * ((1 - wi) * heights[J, I] + wi * heights[J, I + 1])
         + wj * ((1 - wi) * heights[J + 1, I] + wi * heights[J + 1, I + 1]))
    q = np.rint(h / HEIGHT_SCALE)
    if q.min() <= NODATA or q.max() > 32767:
        sys.exit("heights do not fit int16 at 0.5 m")
    return q.astype("<i2")


def write(grid: np.ndarray) -> None:
    OUT.mkdir(parents=True, exist_ok=True)
    (OUT / "dem.bin").write_bytes(grid.astype("<i2").tobytes(order="C"))
    meta = {"size": SIZE, "pixel_m": PIXEL_M, "x_min_m": X_MIN_M, "y_max_m": Y_MAX_M,
            "height_scale": HEIGHT_SCALE, "nodata": NODATA, "min_lat": MIN_LAT, "source": SOURCE}
    (OUT / "dem.json").write_text(json.dumps(meta, indent=2) + "\n", encoding="utf-8")


# --- Checks (read the written files back, the way the site does) --------------------------------

class Dem:
    def __init__(self) -> None:
        self.meta = json.loads((OUT / "dem.json").read_text(encoding="utf-8"))
        n = self.meta["size"]
        self.bytes = (OUT / "dem.bin").stat().st_size
        self.v = np.fromfile(OUT / "dem.bin", dtype="<i2").reshape(n, n)

    def xy(self, lat: float, lon: float) -> tuple[float, float]:
        c = math.radians(90 + lat)
        r = 2 * R_M * math.tan(c / 2)
        return r * math.sin(math.radians(lon)), r * math.cos(math.radians(lon))

    def at_xy(self, x: float, y: float) -> float:
        m = self.meta
        col = (x - m["x_min_m"]) / m["pixel_m"]
        row = (m["y_max_m"] - y) / m["pixel_m"]
        c0, r0 = math.floor(col), math.floor(row)
        n = m["size"]
        if not (0 <= c0 < n - 1 and 0 <= r0 < n - 1):
            return float("nan")
        cell = self.v[r0:r0 + 2, c0:c0 + 2].astype(float)
        if (cell == m["nodata"]).any():
            return float("nan")
        fc, fr = col - c0, row - r0
        top = cell[0, 0] * (1 - fc) + cell[0, 1] * fc
        bot = cell[1, 0] * (1 - fc) + cell[1, 1] * fc
        return (top * (1 - fr) + bot * fr) * m["height_scale"]

    def at(self, lat: float, lon: float) -> float:
        return self.at_xy(*self.xy(lat, lon))


def latlon(x: float, y: float) -> tuple[float, float]:
    r = math.hypot(x, y)
    return math.degrees(2 * math.atan(r / (2 * R_M))) - 90, math.degrees(math.atan2(x, y))


def ring(dem: Dem, lat: float, lon: float, radius_m: float, n: int = 72) -> list[tuple]:
    """(height, lat, lon) at n points on a circle round (lat, lon). Near the pole the projection
    is true to within 0.2 %, so a circle in the plane is a circle on the ground."""
    cx, cy = dem.xy(lat, lon)
    pts = []
    for k in range(n):
        a = 2 * math.pi * k / n
        x, y = cx + radius_m * math.sin(a), cy + radius_m * math.cos(a)
        pts.append((dem.at_xy(x, y), *latlon(x, y)))
    return pts


def check_orientation(dem: Dem) -> bool:
    """Each named crater's centre should sit well below its rim. The same test with the
    longitudes mirrored (what a flipped X axis would give) is shown for comparison."""
    print("\norientation: crater centre minus mean height at its rim (IAU Gazetteer centres)")
    print(f"  {'crater':12s} {'as read':>9s} {'mirrored':>9s}")
    good = True
    for name, _id, lat, lon, d_km in GAZETTEER:
        diffs = []
        for lo in (lon, -lon):
            rim = np.nanmean([h for h, *_ in ring(dem, lat, lo, d_km * 500)])
            diffs.append(dem.at(lat, lo) - rim)
        print(f"  {name:12s} {diffs[0]:9.0f} {diffs[1]:9.0f}")
        good &= diffs[0] < -1000 and diffs[0] < diffs[1]
    return good


def checks(png: bool) -> bool:
    dem = Dem()
    n = dem.meta["size"]
    ok = True

    def report(cond: bool, text: str) -> None:
        nonlocal ok
        ok &= bool(cond)
        print(("PASS " if cond else "FAIL ") + text)

    report(dem.bytes == n * n * 2 and dem.bytes <= 15 * 1024 * 1024,
           f"dem.bin is {dem.bytes} bytes; size*size*2 = {n * n * 2}; "
           f"{dem.bytes / 1024 / 1024:.2f} MiB ({dem.bytes / 1e6:.2f} MB) <= 15 MiB")

    v = dem.v
    valid = v != dem.meta["nodata"]
    h = v[valid] * dem.meta["height_scale"]
    # area inside 80 S only, as well as the whole square
    yy, xx = np.mgrid[0:n, 0:n]
    x = dem.meta["x_min_m"] + xx * dem.meta["pixel_m"]
    y = dem.meta["y_max_m"] - yy * dem.meta["pixel_m"]
    inside = np.hypot(x, y) <= 2 * R_M * math.tan(math.radians(5))
    h80 = v[inside & valid] * dem.meta["height_scale"]
    report(valid.all() and -9500 < h.min() < -3000 and 3000 < h.max() < 8500,
           f"heights: whole square {h.min():.1f} .. {h.max():.1f} m, inside 80 S "
           f"{h80.min():.1f} .. {h80.max():.1f} m, no-data cells {int((~valid).sum())}")
    # Stripes or blocks: a resampling bug shows as rows or columns that jump compared with
    # their neighbours. Largest mean step between neighbouring rows/columns, against typical.
    hm = v.astype(float) * dem.meta["height_scale"]
    rstep = np.abs(np.diff(hm, axis=0)).mean(axis=1)
    cstep = np.abs(np.diff(hm, axis=1)).mean(axis=0)
    print(f"     row-to-row mean step: median {np.median(rstep):.1f} m, max {rstep.max():.1f} m; "
          f"col-to-col: median {np.median(cstep):.1f} m, max {cstep.max():.1f} m")

    if png:
        g = np.clip((hm - h.min()) / (h.max() - h.min()) * 255, 0, 255).astype(np.uint8)
        from PIL import Image
        Image.fromarray(g, mode="L").save(RAW / "dem_grey.png")
        Image.fromarray(g, mode="L").resize((1024, 1024)).save(RAW / "dem_grey_1024.png")
        print(f"     grey image: {RAW / 'dem_grey.png'}")

    # Shackleton: floor at the Gazetteer centre, rim = highest point on the circle of its
    # Gazetteer radius.
    _, _, s_lat, s_lon, s_d = GAZETTEER[0]
    floor = dem.at(s_lat, s_lon)
    rim_h, rim_lat, rim_lon = max(ring(dem, s_lat, s_lon, s_d * 500, 360), key=lambda p: p[0])
    rim_lat, rim_lon = round(rim_lat, 3), round(rim_lon, 2)
    rim_h = dem.at(rim_lat, rim_lon)
    report(rim_h - floor >= 2500,
           f"Shackleton floor ({s_lat}, {s_lon}) = {floor:.1f} m; rim ({rim_lat}, {rim_lon}) = "
           f"{rim_h:.1f} m; rim - floor = {rim_h - floor:.1f} m")

    pts = [(-90.0, 0.0)] + [(-85.0, lo) for lo in (0.0, 90.0, 180.0, -90.0)]
    vals = [dem.at(*p) for p in pts]
    report(all(math.isfinite(z) for z in vals),
           "heights at " + ", ".join(f"({a}, {b}) = {z:.1f} m" for (a, b), z in zip(pts, vals)))

    report(check_orientation(dem), "named craters are low at their Gazetteer centres "
           "(compare the grey image with Quickmap by eye as well)")
    return ok


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--png", action="store_true", help="also write a grey image to data-prep/raw/")
    ap.add_argument("--check-only", action="store_true", help="skip resampling, check the files")
    args = ap.parse_args()
    if not args.check_only:
        dn, src = load_source()
        print(f"source {PRODUCT}: {src['lines']}x{src['samples']}, "
              f"DN {int(dn.min())}..{int(dn.max())}")
        write(resample(dn, src))
    sys.exit(0 if checks(args.png) else 1)


if __name__ == "__main__":
    main()
