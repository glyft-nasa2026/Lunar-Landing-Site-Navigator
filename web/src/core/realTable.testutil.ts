// For tests only (node): the real Sun and Earth table from web/public/data/, every decade
// loaded. Null while the files are missing or the table is T20's mock, so the tests that need
// real data can skip.
import { existsSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { indexEphemeris, type Ephemeris, type EphemerisMeta } from './ephemeris';

const dataFile = (rel: string): string => fileURLToPath(new URL(`../../public/data/${rel}`, import.meta.url));

function readBuffer(path: string): ArrayBuffer {
  const bytes = readFileSync(path);
  // Copy into an ArrayBuffer of its own: Node's Buffer may sit inside a larger shared pool.
  return bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer;
}

export function readRealTable(): Ephemeris | null {
  const metaFile = dataFile('ephemeris.json');
  if (!existsSync(metaFile)) return null;
  const meta = JSON.parse(readFileSync(metaFile, 'utf8')) as EphemerisMeta;
  if (meta.source === 'mock') return null;
  const files = meta.chunks ? meta.chunks.map((c) => c.file) : ['ephemeris.bin'];
  if (!files.every((f) => existsSync(dataFile(f)))) return null;
  return files.reduce((eph, f, i) => eph.withChunk(i, readBuffer(dataFile(f))), indexEphemeris(meta));
}
