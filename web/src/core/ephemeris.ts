// The Sun and Earth table (contract section 2: ephemeris.bin + ephemeris.json).
// One table serves every site: at one moment the directions measured from the Moon's centre
// are the same everywhere. geometry.ts turns them into angles for a site.

export type Vec3 = [number, number, number];

export type EphemerisMeta = {
  start: string;       // ISO 8601 with Z
  step_s: number;
  rows: number;
  frame: string;
  columns: string[];
  source: string;      // "mock" for T20's file
};

export type Ephemeris = {
  meta: EphemerisMeta;
  startMs: number;     // time of the first row
  endMs: number;       // time of the last row
  /**
   * Sun unit vector and Earth vector in km, both from the Moon's centre, in the Moon-fixed
   * frame. Straight-line step between rows; the Sun is re-normalised. A time outside the table
   * returns the nearest end row, so callers never crash; check startMs and endMs first if the
   * difference matters.
   */
  vectorsAt(tMs: number): { sun: Vec3; earthKm: Vec3 };
};

const VALUES_PER_ROW = 6;
const BYTES_PER_VALUE = 4;

/** Builds the table from its two files. No network: tests call this with made-up tables. */
export function parseEphemeris(meta: EphemerisMeta, buffer: ArrayBuffer): Ephemeris {
  const startMs = Date.parse(meta.start);
  if (!Number.isFinite(startMs)) throw new Error('ephemeris.json: "start" is not a date');
  if (!(meta.step_s > 0)) throw new Error('ephemeris.json: "step_s" must be above 0');
  if (!Number.isInteger(meta.rows) || meta.rows < 2) {
    throw new Error('ephemeris.json: "rows" must be a whole number, 2 or more');
  }
  const need = meta.rows * VALUES_PER_ROW * BYTES_PER_VALUE;
  if (buffer.byteLength < need) {
    throw new Error(`ephemeris.bin: ${buffer.byteLength} bytes, expected ${need}`);
  }

  // The file is little-endian float32. Read it through a DataView so the result is the same
  // on any machine.
  const count = meta.rows * VALUES_PER_ROW;
  const data = new Float32Array(count);
  const view = new DataView(buffer);
  for (let i = 0; i < count; i++) data[i] = view.getFloat32(i * BYTES_PER_VALUE, true);

  const stepMs = meta.step_s * 1000;
  const lastRow = meta.rows - 1;

  function vectorsAt(tMs: number): { sun: Vec3; earthKm: Vec3 } {
    let f = (tMs - startMs) / stepMs;
    if (!(f > 0)) f = 0;                // also catches NaN
    if (f > lastRow) f = lastRow;
    let i = Math.floor(f);
    if (i >= lastRow) i = lastRow - 1;
    const u = f - i;
    const a = i * VALUES_PER_ROW;
    const b = a + VALUES_PER_ROW;

    let sx = data[a] + (data[b] - data[a]) * u;
    let sy = data[a + 1] + (data[b + 1] - data[a + 1]) * u;
    let sz = data[a + 2] + (data[b + 2] - data[a + 2]) * u;
    const len = Math.hypot(sx, sy, sz);
    if (len > 0) { sx /= len; sy /= len; sz /= len; }

    return {
      sun: [sx, sy, sz],
      earthKm: [
        data[a + 3] + (data[b + 3] - data[a + 3]) * u,
        data[a + 4] + (data[b + 4] - data[a + 4]) * u,
        data[a + 5] + (data[b + 5] - data[a + 5]) * u,
      ],
    };
  }

  return { meta, startMs, endMs: startMs + lastRow * stepMs, vectorsAt };
}

/** Fetches both files from data/ next to the page. Rejects if either is missing or malformed. */
export async function loadEphemeris(): Promise<Ephemeris> {
  const base = import.meta.env.BASE_URL + 'data/';
  const metaRes = await fetch(base + 'ephemeris.json');
  if (!metaRes.ok) throw new Error(`ephemeris.json: HTTP ${metaRes.status}`);
  const meta = (await metaRes.json()) as EphemerisMeta;
  const binRes = await fetch(base + 'ephemeris.bin');
  if (!binRes.ok) throw new Error(`ephemeris.bin: HTTP ${binRes.status}`);
  return parseEphemeris(meta, await binRes.arrayBuffer());
}
