// Shared types, exactly as docs/data-contract.md section 3. Only P1 edits this file.

export type Site = { lat: number; lon: number; eye_m?: number };   // eye_m default 2
export type AltAz = { alt: number; az: number };
export type Skyline = { elev: Float32Array; terrain: boolean };    // 360 values, index = azimuth
export type Sample = {
  tMs: number;
  sun: AltAz; earth: AltAz;
  sunAbove: number;    // Sun centre minus skyline at its azimuth, degrees
  earthAbove: number;
  sunFrac: number;     // 0..1, fraction of the Sun's disc above the skyline, by height
  earthUp: boolean;
};
export type Body = 'sun' | 'earth';
export type Flip = { type: 'rise' | 'set'; tMs: number } | null;
export type Summary = {
  litPct: number; longestLit_h: number; longestDark_h: number;
  earthPct: number; longestEarthGap_h: number;
};
export type CuratedSite = { id: string; name: string; lat: number; lon: number; agency: string;
  year: number; status: string; group: string; note: string; source: string };

/** Moon radius in km. Heights are metres above this sphere. */
export const MOON_RADIUS_KM = 1737.4;
/** Eye height above the ground in metres when a Site has no eye_m. */
export const DEFAULT_EYE_M = 2;
