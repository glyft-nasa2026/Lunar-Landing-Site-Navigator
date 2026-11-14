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

// The loading screen waits for the two files the numbers need: the Sun and Earth table and the
// site list. The 12.8 MB height map is not one of them: until it arrives the site gives the
// smooth-Moon answer and the page's status line shows how far the height map is (T27 step 3).
// The table carries most of the bar because it is the larger of the two.
const WEIGHTS = { eph: 0.8, sites: 0.2 } as const;

/** How full the loading bar is, 0 to 1. A file that failed counts as finished. */
export function loadFraction(p: LoadProgress): number {
  const part = (s: FileState): number => (s === 'loading' ? 0 : 1);
  return WEIGHTS.eph * part(p.eph) + WEIGHTS.sites * part(p.sites);
}

/** True once the Sun and Earth table and the site list have loaded or failed, whatever the height map is doing. */
export function readyToOpen(p: LoadProgress): boolean {
  return p.eph !== 'loading' && p.sites !== 'loading';
}
