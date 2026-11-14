// Entry point.
// Shows the main page at once, loads the data files, and mounts every module into its slot
// (docs/data-contract.md section 5) after "Start exploring", behind the loading screen. The
// modules are listed in site.ts, loaded only then: this first script holds just the main page,
// the state and the data loaders, so the main page appears and animates before the module code
// (about 5 MB with Plotly and three.js) is fetched or run.

import './ui/theme.css';
import './ui/layout.css';

import { loadDem } from './core/dem';
import { loadEphemeris } from './core/ephemeris';
import type { CuratedSite } from './core/types';
import { setData } from './state';
import { startIntro } from './ui/intro/index';

type Slot = [id: string, mount: (el: HTMLElement) => void];

/** Mounts each module into its slot. Each draws the data state.ts already holds, then follows it. */
function mountSlots(slots: readonly Slot[]): void {
  for (const [id, mount] of slots) {
    const el = document.getElementById(id);
    if (!el) continue;
    try {
      mount(el);
    } catch (err) {
      // One broken module must not blank the others.
      console.error(`#${id} failed to mount`, err);
      el.textContent = `#${id} failed to start`;
    }
  }
}

// Main page first; after "Start exploring", the loading screen until the data is in and the
// site is mounted (T22 hero.png, loading.png).
const intro = startIntro({
  loadSite: () => import('./site').then(({ slots }) => () => mountSlots(slots)),
});

// --- Data loading ---------------------------------------------------------------------------
// State stays null for a file that is missing or malformed, and the page says so. Nothing
// crashes: the modules show "Loading" and the skyline stays flat.

type Progress = 'loading' | 'ok' | 'missing';
const files: Record<'Sun and Earth table' | 'height map' | 'site list', Progress> = {
  'Sun and Earth table': 'loading',
  'height map': 'loading',
  'site list': 'loading',
};
let demFraction = 0;

function showStatus(): void {
  intro.update({
    eph: files['Sun and Earth table'],
    sites: files['site list'],
    dem: files['height map'],
    demFraction,
  });
  const el = document.getElementById('status');
  if (!el) return;
  const names = Object.keys(files) as (keyof typeof files)[];
  const missing = names.filter((n) => files[n] === 'missing');
  const loading = names
    .filter((n) => files[n] === 'loading')
    .map((n) => (n === 'height map' && demFraction > 0 ? `${n} ${Math.round(demFraction * 100)} %` : n));
  const parts: string[] = [];
  if (missing.length > 0) parts.push(`Data not loaded: ${missing.join(', ')}.`);
  if (loading.length > 0) parts.push(`Loading ${loading.join(', ')}.`);
  el.textContent = parts.join(' ');
}

async function loadSites(): Promise<CuratedSite[]> {
  const res = await fetch(import.meta.env.BASE_URL + 'data/sites.json');
  if (!res.ok) throw new Error(`sites.json: HTTP ${res.status}`);
  const list: unknown = await res.json().catch(() => {
    throw new Error('sites.json: missing, or not JSON');
  });
  if (!Array.isArray(list)) throw new Error('sites.json: not a list');
  return list as CuratedSite[];
}

function track<T>(name: keyof typeof files, job: Promise<T>, done: (value: T) => void): void {
  job.then(
    (value) => {
      files[name] = 'ok';
      done(value);
      showStatus();
    },
    (err: unknown) => {
      files[name] = 'missing';
      // A warning, not an error: the page keeps working without the file.
      console.warn(`Data not loaded (${name}):`, err instanceof Error ? err.message : err);
      showStatus();
    },
  );
}

showStatus();
track('Sun and Earth table', loadEphemeris(), (eph) => setData({ eph }));
track('site list', loadSites(), (sites) => setData({ sites }));
track(
  'height map',
  loadDem((fraction) => {
    demFraction = fraction;
    showStatus();
  }),
  (dem) => setData({ dem }),
);
