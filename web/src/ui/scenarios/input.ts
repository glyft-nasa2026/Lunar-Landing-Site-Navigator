// Checks for what people type into the scenario panel (F1, F2). Pure functions: no DOM, no
// state, so vitest can run them in node. Each returns the value, or a message to show next to
// the box. They only check input; every number shown still comes from core/.

export type Checked<T> = { ok: true; value: T } | { ok: false; message: string };

function parseNumber(text: string): number | null {
  const t = text.trim();
  if (t === '') return null;
  const v = Number(t);
  return Number.isFinite(v) ? v : null;
}

/** Latitude in degrees, north-positive, -90 to 90. */
export function checkLat(text: string): Checked<number> {
  const v = parseNumber(text);
  if (v === null) return { ok: false, message: 'Type a number of degrees, for example -89.5' };
  if (v < -90 || v > 90) return { ok: false, message: 'Latitude must be between -90 and 90' };
  return { ok: true, value: v };
}

/** Longitude in degrees, east-positive, -180 to 180. Never 0 to 360. */
export function checkLon(text: string): Checked<number> {
  const v = parseNumber(text);
  if (v === null) return { ok: false, message: 'Type a number of degrees, for example 45' };
  if (v < -180 || v > 180) return { ok: false, message: 'Longitude must be between -180 and 180' };
  return { ok: true, value: v };
}

const UTC_FORMAT = 'Enter a UTC date and time as YYYY-MM-DD HH:MM';

/**
 * The time box's text, read as UTC: "2027-01-01 06:30", with optional seconds, and a "T" in
 * place of the space also works. The table's own bounds are passed in when it has loaded; a
 * time at or after endMs has no hour after it, so the readout couldn't show it.
 */
export function checkUtc(text: string, table: { startMs: number; endMs: number } | null): Checked<number> {
  const m = /^(\d{4}-\d{2}-\d{2})[T ]+(\d{2}:\d{2}(?::\d{2}(?:\.\d+)?)?)$/.exec(text.trim());
  if (!m) return { ok: false, message: UTC_FORMAT };
  const iso = `${m[1]}T${m[2]}`;
  const tMs = Date.parse(iso + 'Z');
  // Date.parse rolls 2027-02-30 over to March; a real date reads back the same.
  if (!Number.isFinite(tMs) || new Date(tMs).toISOString().slice(0, 16) !== iso.slice(0, 16)) {
    return { ok: false, message: UTC_FORMAT };
  }
  if (table && (tMs < table.startMs || tMs >= table.endMs)) {
    return {
      ok: false,
      message: `The table covers ${utcText(table.startMs)} to ${utcText(table.endMs)} UTC`,
    };
  }
  return { ok: true, value: tMs };
}

/** tMs as the time box shows it, in UTC, to the minute: "2027-01-01 06:30". */
export function toBoxValue(tMs: number): string {
  return utcText(tMs);
}

/** tMs for people to read: "2027-01-01 06:30". */
export function utcText(tMs: number): string {
  return new Date(tMs).toISOString().slice(0, 16).replace('T', ' ');
}

/** "-89.5000, 45.0000": four decimals is about 3 m on the Moon. */
export function coordText(lat: number, lon: number): string {
  return `${lat.toFixed(4)}, ${lon.toFixed(4)}`;
}

const GROUP_NAMES: Record<string, string> = {
  'south-pole': 'South pole',
  lander: 'Landers',
  apollo: 'Apollo',
};

/** The heading for a site group in the dropdown. An unknown group shows as it is written. */
export function groupName(group: string): string {
  return GROUP_NAMES[group] ?? group;
}
