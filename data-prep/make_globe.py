"""Issue #66: the whole-Moon height grid the 3D globe is coloured and shaded from
(docs/data-contract.md, 2: globe.bin + globe.json).

Source: LRO LOLA gridded data record LDEM_4 (4 cells per degree), product version V3.0,
data set LRO-L-LOLA-4-GDR-V1.0, from the PDS Geosciences Node:
https://pds-geosciences.wustl.edu/lro/lro-l-lola-3-rdr-v1/lrolol_1xxx/data/lola_gdr/cylindrical/img/

Run from anywhere:
    python data-prep/make_globe.py          download (if needed), re-order, write, check

The download (about 2 MB) goes into data-prep/raw/ (git-ignored). The source layout is read from
its PDS label and checked against what this script expects; if the label says something else the
script stops rather than guess.

Source layout, from the label: int16, little-endian, 720 rows x 1440 columns, height =
DN * 0.5 m above a 1737.4 km sphere (our datum). Simple cylindrical, row 0 at 90 N, longitude
0 to 360 east. Our grid has the same cells with longitude -180 to 180 (CLAUDE.md: never 0 to
360), so the columns are rotated by half the width and no height is resampled.
"""

from __future__ import annotations

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
            "data/lola_gdr/cylindrical/img/")
PRODUCT = "LDEM_4"
R_M = 1737.4e3
HEIGHT_SCALE = 0.5
SOURCE = ("LRO LOLA LDEM_4, product version V3.0 (LRO-L-LOLA-4-GDR-V1.0, "
          "created 2017-09-15), PDS Geosciences Node")

# Known heights, to check orientation: (name, lat, lon, lowest allowed m, highest allowed m).
# The Moon's highest ground is on the far side near 5.4 N 158.6 W (about +10.8 km) and its lowest
# is the floor of Antoniadi near 70.4 S 172.4 W (about -9.1 km); the maria are low plains. Positions
# are approximate and a 7.6 km cell averages a summit down, so the bounds are wide; a mirrored,
# flipped or shifted grid still fails them.
KNOWN = [("highest point (far side)", 5.44, -158.64, 8000, 10800),
         ("Antoniadi floor, lowest point", -70.36, -172.41, -9200, -7000),
         ("Mare Imbrium", 35.0, -15.0, -3500, -1500),
         ("Mare Crisium", 17.0, 59.1, -4500, -2500),
         ("Mare Orientale", -19.4, -92.8, -4000, -1500)]


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


def load_source() -> np.ndarray:
    lbl = read_label(download(PRODUCT.lower() + ".lbl"))
    img = download(PRODUCT.lower() + ".img")
    lines, samples = int(num(lbl, "LINES")), int(num(lbl, "LINE_SAMPLES"))
    expect = [
        (lbl["PRODUCT_VERSION_ID"].strip('"'), "V3.0"),
        (lbl["SAMPLE_TYPE"], "LSB_INTEGER"), (lbl["SAMPLE_BITS"], "16"),
        (lbl["MAP_PROJECTION_TYPE"].strip('"'), "SIMPLE CYLINDRICAL"),
        (lbl["POSITIVE_LONGITUDE_DIRECTION"].strip('"'), "EAST"),
        (num(lbl, "SCALING_FACTOR"), HEIGHT_SCALE), (num(lbl, "OFFSET"), R_M),
        (num(lbl, "A_AXIS_RADIUS"), 1737.4), (num(lbl, "C_AXIS_RADIUS"), 1737.4),
        (num(lbl, "MAP_RESOLUTION"), 4.0), (num(lbl, "MAXIMUM_LATITUDE"), 90.0),
        (num(lbl, "MINIMUM_LATITUDE"), -90.0), (num(lbl, "WESTERNMOST_LONGITUDE"), 0.0),
        (num(lbl, "EASTERNMOST_LONGITUDE"), 360.0), (num(lbl, "CENTER_LONGITUDE"), 180.0),
        (num(lbl, "LINE_PROJECTION_OFFSET"), (lines - 1) / 2),
        (num(lbl, "SAMPLE_PROJECTION_OFFSET"), (samples - 1) / 2),
        (samples, 2 * lines), (samples % 2, 0),
    ]
    for got, want in expect:
        if got != want:
            sys.exit(f"label says {got!r}, script expects {want!r}: read the label again")
    raw = np.fromfile(img, dtype="<i2")
    if raw.size != lines * samples:
        sys.exit(f"{img} has {raw.size} values, label says {lines}x{samples}")
    return raw.reshape(lines, samples)


def write(grid: np.ndarray) -> None:
    OUT.mkdir(parents=True, exist_ok=True)
    (OUT / "globe.bin").write_bytes(grid.astype("<i2").tobytes(order="C"))
    meta = {"width": grid.shape[1], "height": grid.shape[0], "height_scale": HEIGHT_SCALE,
            "source": SOURCE}
    (OUT / "globe.json").write_text(json.dumps(meta, indent=2) + "\n", encoding="utf-8")


class Globe:
    """The written files, read back the way the site reads them."""

    def __init__(self) -> None:
        self.meta = json.loads((OUT / "globe.json").read_text(encoding="utf-8"))
        self.bytes = (OUT / "globe.bin").stat().st_size
        self.v = np.fromfile(OUT / "globe.bin", dtype="<i2").reshape(self.meta["height"], self.meta["width"])

    def at(self, lat: float, lon: float) -> float:
        """Height of the cell holding the point, metres. Cell (row j, col i) is centred on
        latitude 90 - (j + 0.5) * 180 / height, longitude -180 + (i + 0.5) * 360 / width."""
        h, w = self.v.shape
        j = min(h - 1, max(0, math.floor((90 - lat) * h / 180)))
        i = math.floor((lon + 180) * w / 360) % w
        return float(self.v[j, i]) * self.meta["height_scale"]


def polar_height(lat: float, lon: float) -> float | None:
    """The same point in the south-pole height map (dem.bin), when that is the real one."""
    meta_path = OUT / "dem.json"
    if not meta_path.exists():
        return None
    m = json.loads(meta_path.read_text(encoding="utf-8"))
    if m["source"] == "mock":
        return None
    r = 2 * R_M * math.tan(math.radians(90 + lat) / 2)
    col = round((r * math.sin(math.radians(lon)) - m["x_min_m"]) / m["pixel_m"])
    row = round((m["y_max_m"] - r * math.cos(math.radians(lon))) / m["pixel_m"])
    v = np.memmap(OUT / "dem.bin", dtype="<i2", mode="r", shape=(m["size"], m["size"]))
    # Mean over about one globe cell (7.6 km), so the two grids are compared like for like.
    k = max(1, round(3800 / m["pixel_m"]))
    return float(v[row - k:row + k + 1, col - k:col + k + 1].mean()) * m["height_scale"]


def check() -> bool:
    g = Globe()
    ok = True

    def line(passed: bool, text: str) -> None:
        nonlocal ok
        ok = ok and passed
        print(("PASS  " if passed else "FAIL  ") + text)

    w, h = g.meta["width"], g.meta["height"]
    line(g.bytes == w * h * 2, f"globe.bin is {g.bytes} bytes = {w} x {h} x 2")
    line(g.bytes <= 3_000_000, f"file budget: {g.bytes / 1e6:.2f} MB of 3 MB")
    lo, hi = g.v.min() * HEIGHT_SCALE, g.v.max() * HEIGHT_SCALE
    line(-9500 < lo < -8000 and 9500 < hi < 11000, f"height range {lo:.0f} m to {hi:.0f} m")
    for name, lat, lon, low, high in KNOWN:
        v = g.at(lat, lon)
        line(low <= v <= high, f"{name} ({lat}, {lon}): {v:.0f} m, expected {low} to {high}")
    diffs = []
    for lat in (-81, -83, -85, -87):
        for lon in range(-180, 180, 30):
            p = polar_height(lat, lon)
            if p is not None:
                diffs.append(abs(g.at(lat, lon) - p))
    if diffs:
        line(float(np.median(diffs)) < 300 and max(diffs) < 1500,
             f"against dem.bin at {len(diffs)} points south of 80 S: median difference "
             f"{np.median(diffs):.0f} m, largest {max(diffs):.0f} m")
    else:
        print("SKIP  comparison with dem.bin (mock or missing)")
    return ok


def main() -> None:
    src = load_source()
    grid = np.roll(src, src.shape[1] // 2, axis=1)   # 0..360 becomes -180..180
    write(grid)
    print(f"wrote {OUT / 'globe.bin'} and globe.json")
    if not check():
        sys.exit(1)


if __name__ == "__main__":
    main()
