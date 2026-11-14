// Pure helpers for the main page and the loading screen (docs/design/hero.png, loading.png).
// No DOM here, so they can be tested in node.

export type FileState = 'loading' | 'ok' | 'missing';

/** Where each data file stands, as main.ts tracks it. */
export interface LoadProgress {
  eph: FileState;
  sites: FileState;
  dem: FileState;
  /** Share of the height map downloaded so far, 0 to 1. */
  demFraction: number;
}

// The height map is by far the largest file, so it carries most of the bar.
const WEIGHTS = { eph: 0.15, sites: 0.05, dem: 0.8 } as const;

/** How full the loading bar is, 0 to 1. A file that failed counts as finished. */
export function loadFraction(p: LoadProgress): number {
  const part = (s: FileState, partial = 0): number =>
    s === 'loading' ? Math.min(1, Math.max(0, partial)) : 1;
  const f = WEIGHTS.eph * part(p.eph) + WEIGHTS.sites * part(p.sites)
    + WEIGHTS.dem * part(p.dem, p.demFraction);
  return Math.min(1, Math.max(0, f));
}

/** True once every file has loaded or failed: the loading screen has nothing left to wait for. */
export function allSettled(p: LoadProgress): boolean {
  return p.eph !== 'loading' && p.sites !== 'loading' && p.dem !== 'loading';
}
