// The Sun and Earth table (contract section 2: ephemeris.json + ephemeris/<decade>.bin).
// One table serves every site: at one moment the directions measured from the Moon's centre
// are the same everywhere. geometry.ts turns them into angles for a site.
//
// The table runs 1950-2050 and is split by decade, so the page downloads the 2020s first and
// fetches another decade only when a scenario needs it (state.ts decides when). An Ephemeris
// value knows the whole span and which decades are in memory; withChunk() returns a new value
// with one more decade, so a change of table is a change of object.

export type Vec3 = [number, number, number];

/** One decade file. It ends on the first row of the next file, so the two share that row. */
export type EphemerisChunk = { file: string; start: string; rows: number };

export type EphemerisMeta = {
  start: string;       // ISO 8601 with Z: the first row of the whole table
  step_s: number;
  rows: number;        // rows in the whole table, each shared boundary row counted once
  frame: string;
  columns: string[];
  source: string;      // "mock" for T20's file
  /** Absent for a one-file table (T20's mock, tests): the file is ephemeris.bin. */
  chunks?: EphemerisChunk[];
  /** Index in chunks of the decade loaded first. */
  home?: number;
};

export type Ephemeris = {
  meta: EphemerisMeta;
  startMs: number;     // time of the first row of the whole table
  endMs: number;       // time of the last row of the whole table
  /** The span of the decade loaded first, which is always in memory. */
  homeStartMs: number;
  homeEndMs: number;
  /**
   * Sun unit vector and Earth vector in km, both from the Moon's centre, in the Moon-fixed
   * frame. Straight-line step between rows; the Sun is re-normalised. A time outside the table,
   * or in a decade not yet loaded, returns the nearest loaded row, so callers never crash;
   * check missing() first if the difference matters.
   */
  vectorsAt(tMs: number): { sun: Vec3; earthKm: Vec3 };
  /** Indexes of the decades not yet loaded that hold any row from fromMs to toMs. */
  missing(fromMs: number, toMs: number): number[];
  /** The same table with decade i's file added. Doesn't change this one. */
  withChunk(i: number, buffer: ArrayBuffer): Ephemeris;
};

const VALUES_PER_ROW = 6;
const BYTES_PER_VALUE = 4;

type Span = { startMs: number; endMs: number; rows: number; file: string };

/**
 * The table with no decade in memory yet, from its index file. No network. A one-file meta
 * (no "chunks") reads as one decade, file ephemeris.bin.
 */
export function indexEphemeris(meta: EphemerisMeta): Ephemeris {
  const startMs = Date.parse(meta.start);
  if (!Number.isFinite(startMs)) throw new Error('ephemeris.json: "start" is not a date');
  if (!(meta.step_s > 0)) throw new Error('ephemeris.json: "step_s" must be above 0');
  if (!Number.isInteger(meta.rows) || meta.rows < 2) {
    throw new Error('ephemeris.json: "rows" must be a whole number, 2 or more');
  }
  const stepMs = meta.step_s * 1000;
  const endMs = startMs + (meta.rows - 1) * stepMs;

  const list = meta.chunks ?? [{ file: 'ephemeris.bin', start: meta.start, rows: meta.rows }];
  if (list.length === 0) throw new Error('ephemeris.json: "chunks" is empty');
  const spans: Span[] = [];
  let expect = startMs;
  for (const c of list) {
    const s = Date.parse(c.start);
    if (s !== expect) throw new Error(`ephemeris.json: ${c.file} should start at ${new Date(expect).toISOString()}`);
    if (!Number.isInteger(c.rows) || c.rows < 2) throw new Error(`ephemeris.json: ${c.file} needs 2 or more rows`);
    const e = s + (c.rows - 1) * stepMs;
    spans.push({ startMs: s, endMs: e, rows: c.rows, file: c.file });
    expect = e;
  }
  if (expect !== endMs) throw new Error('ephemeris.json: the chunks don\'t add up to "rows"');
  const home = meta.home ?? 0;
  if (!Number.isInteger(home) || home < 0 || home >= spans.length) {
    throw new Error('ephemeris.json: "home" is not a chunk');
  }
  return build(meta, spans, home, stepMs, new Array<Float32Array | null>(spans.length).fill(null));
}

/** A one-file table from its two files. No network: tests call this with made-up tables. */
export function parseEphemeris(meta: EphemerisMeta, buffer: ArrayBuffer): Ephemeris {
  if (meta.chunks && meta.chunks.length !== 1) {
    throw new Error('parseEphemeris takes a one-file table; use indexEphemeris and withChunk');
  }
  return indexEphemeris(meta).withChunk(0, buffer);
}

function decode(span: Span, buffer: ArrayBuffer): Float32Array {
  const need = span.rows * VALUES_PER_ROW * BYTES_PER_VALUE;
  if (buffer.byteLength < need) {
    throw new Error(`${span.file}: ${buffer.byteLength} bytes, expected ${need}`);
  }
  // The file is little-endian float32. Read it through a DataView so the result is the same
  // on any machine.
  const count = span.rows * VALUES_PER_ROW;
  const data = new Float32Array(count);
  const view = new DataView(buffer);
  for (let i = 0; i < count; i++) data[i] = view.getFloat32(i * BYTES_PER_VALUE, true);
  return data;
}

function build(
  meta: EphemerisMeta, spans: Span[], home: number, stepMs: number, data: (Float32Array | null)[],
): Ephemeris {
  const startMs = spans[0].startMs;
  const endMs = spans[spans.length - 1].endMs;
  const last = spans.length - 1;
  let hint = home; // vectorsAt is called hour after hour: start where the last call was

  function chunkFor(tMs: number): number {
    if (data[hint] && tMs >= spans[hint].startMs && tMs <= spans[hint].endMs) return hint;
    let best = -1;
    let gap = Infinity;
    for (let i = 0; i <= last; i++) {
      if (!data[i]) continue;
      const d = tMs < spans[i].startMs ? spans[i].startMs - tMs : tMs > spans[i].endMs ? tMs - spans[i].endMs : 0;
      if (d < gap) { gap = d; best = i; }
      if (d === 0) break;
    }
    if (best >= 0) hint = best;
    return best;
  }

  function vectorsAt(tMs: number): { sun: Vec3; earthKm: Vec3 } {
    const t = tMs > startMs ? Math.min(tMs, endMs) : startMs;   // also catches NaN
    const c = chunkFor(t);
    if (c < 0) return { sun: [Number.NaN, Number.NaN, Number.NaN], earthKm: [Number.NaN, Number.NaN, Number.NaN] };
    const rows = data[c] as Float32Array;
    const lastRow = spans[c].rows - 1;
    let f = (t - spans[c].startMs) / stepMs;
    if (!(f > 0)) f = 0;
    if (f > lastRow) f = lastRow;
    let i = Math.floor(f);
    if (i >= lastRow) i = lastRow - 1;
    const u = f - i;
    const a = i * VALUES_PER_ROW;
    const b = a + VALUES_PER_ROW;

    let sx = rows[a] + (rows[b] - rows[a]) * u;
    let sy = rows[a + 1] + (rows[b + 1] - rows[a + 1]) * u;
    let sz = rows[a + 2] + (rows[b + 2] - rows[a + 2]) * u;
    const len = Math.hypot(sx, sy, sz);
    if (len > 0) { sx /= len; sy /= len; sz /= len; }

    return {
      sun: [sx, sy, sz],
      earthKm: [
        rows[a + 3] + (rows[b + 3] - rows[a + 3]) * u,
        rows[a + 4] + (rows[b + 4] - rows[a + 4]) * u,
        rows[a + 5] + (rows[b + 5] - rows[a + 5]) * u,
      ],
    };
  }

  function missing(fromMs: number, toMs: number): number[] {
    if (!(fromMs <= toMs) || toMs < startMs || fromMs > endMs) return [];
    const out: number[] = [];
    for (let i = 0; i <= last; i++) {
      // A time on a shared boundary row is served by the later decade alone.
      const overlaps = spans[i].startMs <= toMs && (spans[i].endMs > fromMs || i === last);
      if (overlaps && !data[i]) out.push(i);
    }
    return out;
  }

  function withChunk(i: number, buffer: ArrayBuffer): Ephemeris {
    if (!Number.isInteger(i) || i < 0 || i > last) throw new Error(`ephemeris: no chunk ${i}`);
    const next = data.slice();
    next[i] = decode(spans[i], buffer);
    return build(meta, spans, home, stepMs, next);
  }

  return {
    meta, startMs, endMs,
    homeStartMs: spans[home].startMs, homeEndMs: spans[home].endMs,
    vectorsAt, missing, withChunk,
  };
}

const dataUrl = (file: string): string => import.meta.env.BASE_URL + 'data/' + file;

/** Fetches one decade's file, as named in the index. */
export async function loadEphemerisChunk(eph: Ephemeris, i: number): Promise<ArrayBuffer> {
  const file = eph.meta.chunks ? eph.meta.chunks[i]?.file : i === 0 ? 'ephemeris.bin' : undefined;
  if (!file) throw new Error(`ephemeris: no chunk ${i}`);
  const res = await fetch(dataUrl(file));
  if (!res.ok) throw new Error(`${file}: HTTP ${res.status}`);
  return res.arrayBuffer();
}

/**
 * Fetches the index and the home decade (or the one file, for a one-file table). Rejects if
 * either is missing or malformed. Other decades come later through loadEphemerisChunk.
 */
export async function loadEphemeris(): Promise<Ephemeris> {
  const metaRes = await fetch(dataUrl('ephemeris.json'));
  if (!metaRes.ok) throw new Error(`ephemeris.json: HTTP ${metaRes.status}`);
  // A dev server answers a missing file with the page itself, which is not JSON.
  const meta = (await metaRes.json().catch(() => {
    throw new Error('ephemeris.json: missing, or not JSON');
  })) as EphemerisMeta;
  const index = indexEphemeris(meta);
  const home = meta.home ?? 0;
  return index.withChunk(home, await loadEphemerisChunk(index, home));
}
