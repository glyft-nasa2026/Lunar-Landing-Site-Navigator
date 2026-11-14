"""Issue #66: the heights the 3D globe is drawn from north of the south-pole height map
(docs/data-contract.md, 2: globe.bin + globe.json, north.bin + north.json, tiles.json + tiles/).

Source: the same LRO LOLA gridded data record as dem.bin (data set LRO-L-LOLA-4-GDR-V1.0, PDS
Geosciences Node, https://pds-geosciences.wustl.edu/lro/lro-l-lola-3-rdr-v1/lrolol_1xxx/data/lola_gdr/):
- cylindrical/img/LDEM_16 (16 cells per degree, V3.1) for the whole Moon;
- cylindrical/img/LDEM_64 (64 cells per degree, V3.1) for the finer tiles the page fetches
  only round the selected site (level of detail);
- polar/img/LDEM_75N_240M (240 m, V2.1), the northern twin of T04's LDEM_75S_240M, for the cap
  north of 80 N, where a latitude-longitude grid pinches together.

Run from anywhere:
    python data-prep/make_globe.py          download (if needed), resample, write, check

The downloads (33 MB, 531 MB and 29 MB) go into data-prep/raw/ (git-ignored). Each source layout is read
from its PDS label and checked against what this script expects; if a label says something else
the script stops rather than guess.

Whole Moon. Source: int16, little-endian, 2880 rows x 5760 columns, height = DN * 0.5 m above a
1737.4 km sphere (our datum), simple cylindrical, row 0 at 90 N, longitude 0 to 360 east. Ours:
each 2 x 2 block averaged (8 cells per degree, which keeps the file and the textures made from
it a size a phone can take), and the columns rotated so longitude runs -180 to 180 (CLAUDE.md:
never 0 to 360).

Tiles. LDEM_64 has the layout of LDEM_16 at 23040 x 11520. Ours: each 2 x 2 block averaged (32
cells per degree, about 950 m), columns rotated to -180..180, cut into 15-degree squares of
480 x 480 cells: tiles/rRRcCC.bin, tile row 0 at 90 N, tile column 0 at 180 W.

North cap. Source: int16, 3812 x 3812, polar stereographic about the north pole, 240 m a cell,
X = (i - 1905.5) * 240, Y = (1905.5 - j) * 240. Which way longitude 0 points is not taken on
trust: north_orientation() reads it off by comparing with the cylindrical grid. Ours: the mirror
image of dem.bin's grid (longitude 0 up, 90 E right), 1,200 m a cell, each value the mean of the
5 x 5 source cells' worth of ground around it.
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
R_M = 1737.4e3
HEIGHT_SCALE = 0.5
BLOCK = 2                      # source cells averaged per globe cell, each way
SOURCE = ("LRO LOLA LDEM_16, product version V3.1 (LRO-L-LOLA-4-GDR-V1.0, "
          "created 2019-03-15), 2 x 2 cells averaged, PDS Geosciences Node")

# The level-of-detail tiles (contract section 2).
T_BLOCK = 2                    # LDEM_64 cells averaged per tile cell, each way
T_CPD = 32
T_DEG = 15
T_SOURCE = ("LRO LOLA LDEM_64, product version V3.1 (LRO-L-LOLA-4-GDR-V1.0, "
            "created 2019-03-15), 2 x 2 cells averaged, PDS Geosciences Node")

# The north cap's grid: the mirror image of dem.bin's (contract section 2).
N_PIXEL_M = 1200
N_HALF = 254                   # cells from the pole to the edge: 304.8 km, just past 80 N
N_SIZE = 2 * N_HALF + 1
N_MIN_LAT = 80
N_NODATA = -32768
N_SOURCE = ("LRO LOLA LDEM_75N_240M, product version V2.1 (LRO-L-LOLA-4-GDR-V1.0, "
            "created 2016-09-15), averaged to 1200 m, PDS Geosciences Node")

# Known heights, to check orientation: (name, lat, lon, lowest allowed m, highest allowed m).
# The Moon's highest ground is on the far side near 5.4 N 158.6 W (about +10.8 km) and its lowest
# is the floor of Antoniadi near 70.4 S 172.4 W (about -9.1 km); the maria are low plains. Positions
# are approximate and a 3.8 km cell averages a summit down, so the bounds are wide; a mirrored,
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


def expect_label(pairs: list[tuple]) -> None:
    for got, want in pairs:
        if got != want:
            sys.exit(f"label says {got!r}, script expects {want!r}: read the label again")


def load_image(product: str, lbl: dict[str, str]) -> np.ndarray:
    img = download(product + ".img")
    lines, samples = int(num(lbl, "LINES")), int(num(lbl, "LINE_SAMPLES"))
    raw = np.fromfile(img, dtype="<i2")
    if raw.size != lines * samples:
        sys.exit(f"{img} has {raw.size} values, label says {lines}x{samples}")
    return raw.reshape(lines, samples)


def common(lbl: dict[str, str]) -> list[tuple]:
    return [(lbl["SAMPLE_TYPE"], "LSB_INTEGER"), (lbl["SAMPLE_BITS"], "16"),
            (lbl["POSITIVE_LONGITUDE_DIRECTION"].strip('"'), "EAST"),
            (num(lbl, "SCALING_FACTOR"), HEIGHT_SCALE), (num(lbl, "OFFSET"), R_M),
            (num(lbl, "A_AXIS_RADIUS"), 1737.4), (num(lbl, "C_AXIS_RADIUS"), 1737.4),
            (num(lbl, "MAP_PROJECTION_ROTATION"), 0.0)]


def load_cylindrical(product: str = "ldem_16", per_deg: float = 16.0) -> np.ndarray:
    """The whole Moon as the source has it: row 0 at 90 N, longitude 0 to 360."""
    lbl = read_label(download(product + ".lbl"))
    lines, samples = int(num(lbl, "LINES")), int(num(lbl, "LINE_SAMPLES"))
    expect_label(common(lbl) + [
        (lbl["PRODUCT_VERSION_ID"].strip('"'), "V3.1"),
        (lbl["MAP_PROJECTION_TYPE"].strip('"'), "SIMPLE CYLINDRICAL"),
        (num(lbl, "MAP_RESOLUTION"), per_deg), (num(lbl, "MAXIMUM_LATITUDE"), 90.0),
        (num(lbl, "MINIMUM_LATITUDE"), -90.0), (num(lbl, "WESTERNMOST_LONGITUDE"), 0.0),
        (num(lbl, "EASTERNMOST_LONGITUDE"), 360.0), (num(lbl, "CENTER_LONGITUDE"), 180.0),
        (num(lbl, "LINE_PROJECTION_OFFSET"), (lines - 1) / 2),
        (num(lbl, "SAMPLE_PROJECTION_OFFSET"), (samples - 1) / 2),
        (samples, 2 * lines), (lines, int(180 * per_deg)),
    ])
    return load_image(product, lbl)


def block_mean(src: np.ndarray, block: int) -> np.ndarray:
    """Each block x block square averaged, columns rotated so longitude runs -180 to 180."""
    h, w = src.shape
    out = np.empty((h // block, w // block), dtype="<i2")
    step = 720 * block                                       # in strips, to keep memory down
    for r in range(0, h, step):
        part = src[r:r + step].astype(np.float32)
        out[r // block:(r + step) // block] = np.rint(
            part.reshape(part.shape[0] // block, block, w // block, block).mean(axis=(1, 3)))
    return np.roll(out, out.shape[1] // 2, axis=1)


def write_tiles(grid: np.ndarray) -> None:
    t = T_DEG * T_CPD
    if grid.shape != (180 * T_CPD, 360 * T_CPD):
        sys.exit(f"tile grid is {grid.shape}, expected {(180 * T_CPD, 360 * T_CPD)}")
    folder = OUT / "tiles"
    folder.mkdir(parents=True, exist_ok=True)
    for old in folder.glob("r*c*.bin"):
        old.unlink()
    for row in range(180 // T_DEG):
        for col in range(360 // T_DEG):
            tile = grid[row * t:(row + 1) * t, col * t:(col + 1) * t]
            (folder / f"r{row:02d}c{col:02d}.bin").write_bytes(tile.astype("<i2").tobytes(order="C"))
    meta = {"cells_per_deg": T_CPD, "tile_deg": T_DEG, "height_scale": HEIGHT_SCALE, "source": T_SOURCE}
    (OUT / "tiles.json").write_text(json.dumps(meta, indent=2) + "\n", encoding="utf-8")


def make_globe(src: np.ndarray) -> np.ndarray:
    return block_mean(src, BLOCK)


def cyl_height(src: np.ndarray, lat: np.ndarray, lon: np.ndarray) -> np.ndarray:
    """Heights in metres from the cylindrical source, nearest cell."""
    h, w = src.shape
    j = np.clip(np.floor((90 - lat) * h / 180).astype(int), 0, h - 1)
    i = np.floor((lon % 360) * w / 360).astype(int) % w
    return src[j, i] * HEIGHT_SCALE


def load_north() -> tuple[np.ndarray, float, float]:
    lbl = read_label(download("ldem_75n_240m.lbl"))
    lines, samples = int(num(lbl, "LINES")), int(num(lbl, "LINE_SAMPLES"))
    expect_label(common(lbl) + [
        (lbl["PRODUCT_VERSION_ID"].strip('"'), "V2.1"),
        (lbl["MAP_PROJECTION_TYPE"].strip('"'), "POLAR STEREOGRAPHIC"),
        (num(lbl, "CENTER_LATITUDE"), 90.0), (num(lbl, "CENTER_LONGITUDE"), 0.0),
        (num(lbl, "MAP_SCALE"), 240.0),
        (num(lbl, "LINE_PROJECTION_OFFSET"), (lines - 1) / 2),
        (num(lbl, "SAMPLE_PROJECTION_OFFSET"), (samples - 1) / 2),
    ])
    return load_image("ldem_75n_240m", lbl), num(lbl, "SAMPLE_PROJECTION_OFFSET"), num(lbl, "LINE_PROJECTION_OFFSET")


def bilinear(heights: np.ndarray, fi: np.ndarray, fj: np.ndarray) -> np.ndarray:
    i0, j0 = np.floor(fi).astype(int), np.floor(fj).astype(int)
    if i0.min() < 0 or j0.min() < 0 or i0.max() + 1 >= heights.shape[1] or j0.max() + 1 >= heights.shape[0]:
        sys.exit("our grid reaches outside the LOLA grid")
    wi, wj = fi - i0, fj - j0
    return ((1 - wj) * ((1 - wi) * heights[j0, i0] + wi * heights[j0, i0 + 1])
            + wj * ((1 - wi) * heights[j0 + 1, i0] + wi * heights[j0 + 1, i0 + 1]))


def north_orientation(polar: np.ndarray, s0: float, l0: float, cyl: np.ndarray) -> int:
    """+1 if longitude 0 points up in the polar source (Y = r cos lon), -1 if down. Read off by
    comparing heights on three circles with the cylindrical grid, which has no such choice."""
    heights = polar.astype(np.float64) * HEIGHT_SCALE
    lat = np.repeat([81.0, 84.0, 87.0], 180)
    lon = np.tile(np.arange(-180.0, 180.0, 2.0), 3)
    want = cyl_height(cyl, lat, lon)
    r = 2 * R_M * np.tan(np.radians(90 - lat) / 2)
    score = {}
    for sign in (1, -1):
        x, y = r * np.sin(np.radians(lon)), sign * r * np.cos(np.radians(lon))
        got = bilinear(heights, x / 240 + s0, l0 - y / 240)
        score[sign] = float(np.median(np.abs(got - want)))
    best = min(score, key=score.get)
    print(f"north source orientation: median difference from the cylindrical grid is "
          f"{score[1]:.0f} m with longitude 0 up, {score[-1]:.0f} m with longitude 0 down")
    if score[best] > 300 or score[-best] < 3 * score[best]:
        sys.exit("cannot tell which way the north polar source faces")
    return best


def make_north(polar: np.ndarray, s0: float, l0: float, sign: int) -> np.ndarray:
    """Our north grid: x = r sin lon, y = r cos lon (longitude 0 up), top row first."""
    heights = polar.astype(np.float64) * HEIGHT_SCALE
    x = (-N_HALF + np.arange(N_SIZE)) * N_PIXEL_M
    y = (N_HALF - np.arange(N_SIZE)) * N_PIXEL_M
    X, Y = np.meshgrid(x, y)
    total = np.zeros_like(X, dtype=np.float64)
    offsets = (np.arange(5) - 2) * 240.0                     # 5 x 5 source cells' worth of ground
    for dx in offsets:
        for dy in offsets:
            total += bilinear(heights, (X + dx) / 240 + s0, l0 - sign * (Y + dy) / 240)
    q = np.rint(total / 25 / HEIGHT_SCALE)
    if q.min() <= N_NODATA or q.max() > 32767:
        sys.exit("heights do not fit int16 at 0.5 m")
    return q.astype("<i2")


def write(grid: np.ndarray, north: np.ndarray) -> None:
    OUT.mkdir(parents=True, exist_ok=True)
    (OUT / "globe.bin").write_bytes(grid.astype("<i2").tobytes(order="C"))
    meta = {"width": grid.shape[1], "height": grid.shape[0], "height_scale": HEIGHT_SCALE,
            "source": SOURCE}
    (OUT / "globe.json").write_text(json.dumps(meta, indent=2) + "\n", encoding="utf-8")
    (OUT / "north.bin").write_bytes(north.astype("<i2").tobytes(order="C"))
    nmeta = {"size": N_SIZE, "pixel_m": N_PIXEL_M, "x_min_m": -N_HALF * N_PIXEL_M,
             "y_max_m": N_HALF * N_PIXEL_M, "height_scale": HEIGHT_SCALE, "nodata": N_NODATA,
             "min_lat": N_MIN_LAT, "source": N_SOURCE}
    (OUT / "north.json").write_text(json.dumps(nmeta, indent=2) + "\n", encoding="utf-8")


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
    # Mean over about one globe cell (3.8 km), so the two grids are compared like for like.
    k = max(1, round(1900 / m["pixel_m"]))
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
    line(g.bytes <= 9_000_000, f"file budget: {g.bytes / 1e6:.2f} MB of 9 MB")
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

    # The north cap, read back, against the globe grid just written: two separate LOLA products.
    nm = json.loads((OUT / "north.json").read_text(encoding="utf-8"))
    nv = np.fromfile(OUT / "north.bin", dtype="<i2").reshape(nm["size"], nm["size"])
    line(nv.size * 2 == (OUT / "north.bin").stat().st_size and nv.size * 2 <= 1_000_000,
         f"north.bin is {nv.size * 2} bytes = {nm['size']} x {nm['size']} x 2, of 1 MB")
    edge = 2 * R_M * math.tan(math.radians(90 - nm["min_lat"]) / 2)
    line(-nm["x_min_m"] >= edge and nm["y_max_m"] >= edge,
         f"north grid reaches {nm['y_max_m'] / 1000:.1f} km from the pole; {nm['min_lat']} N is at {edge / 1000:.1f} km")
    ndiffs = []
    for lat in (81, 83, 85, 87, 89):
        for lon in range(-180, 180, 15):
            r = 2 * R_M * math.tan(math.radians(90 - lat) / 2)
            col = round((r * math.sin(math.radians(lon)) - nm["x_min_m"]) / nm["pixel_m"])
            row = round((nm["y_max_m"] - r * math.cos(math.radians(lon))) / nm["pixel_m"])
            ndiffs.append(abs(float(nv[row, col]) * nm["height_scale"] - g.at(lat, lon)))
    line(float(np.median(ndiffs)) < 300,
         f"north.bin against globe.bin at {len(ndiffs)} points north of 80 N: median difference "
         f"{np.median(ndiffs):.0f} m, largest {max(ndiffs):.0f} m")
    # The tiles, read back and put together again, against globe.bin: two separate LOLA products.
    tm = json.loads((OUT / "tiles.json").read_text(encoding="utf-8"))
    t = tm["tile_deg"] * tm["cells_per_deg"]
    files = sorted((OUT / "tiles").glob("r*c*.bin"))
    want = (180 // tm["tile_deg"]) * (360 // tm["tile_deg"])
    sizes = {f.stat().st_size for f in files}
    total = sum(f.stat().st_size for f in files)
    line(len(files) == want and sizes == {t * t * 2},
         f"{len(files)} tiles of {want}, each {t} x {t} x 2 bytes; {total / 1e6:.1f} MB in all")
    line(total <= 140_000_000, f"tile budget: {total / 1e6:.1f} MB of 140 MB")
    whole = np.empty((180 * tm["cells_per_deg"], 360 * tm["cells_per_deg"]), dtype="<i2")
    for f in files:
        r, c = int(f.name[1:3]), int(f.name[4:6])
        whole[r * t:(r + 1) * t, c * t:(c + 1) * t] = np.fromfile(f, dtype="<i2").reshape(t, t)
    k = whole.shape[0] // g.v.shape[0]
    coarse = whole.astype(np.float32).reshape(g.v.shape[0], k, g.v.shape[1], k).mean(axis=(1, 3))
    diff = np.abs(coarse - g.v) * HEIGHT_SCALE
    line(float(np.median(diff)) < 30 and float(np.percentile(diff, 99)) < 300,
         f"tiles averaged to globe.bin's cells: median difference {np.median(diff):.1f} m, "
         f"99 % under {np.percentile(diff, 99):.0f} m")
    for name, lat, lon, low, high in KNOWN[:2]:
        v = float(whole[int((90 - lat) * tm["cells_per_deg"]), int((lon + 180) * tm["cells_per_deg"])]) * HEIGHT_SCALE
        line(low <= v <= high + 300, f"tiles, {name}: {v:.0f} m")
    return ok


def main() -> None:
    cyl = load_cylindrical()
    polar, s0, l0 = load_north()
    sign = north_orientation(polar, s0, l0, cyl)
    write(make_globe(cyl), make_north(polar, s0, l0, sign))
    write_tiles(block_mean(load_cylindrical("ldem_64", 64.0), T_BLOCK))
    print(f"wrote globe.bin, globe.json, north.bin, north.json, tiles.json and tiles/ in {OUT}")
    if not check():
        sys.exit(1)


if __name__ == "__main__":
    main()
