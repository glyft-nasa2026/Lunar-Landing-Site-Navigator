// Entry point. Only P1 edits this file.
// Mounts every module into its slot (docs/data-contract.md section 5) and loads the data files.
// A later task replaces the inside of its own module folder; nothing here needs to change.

import './ui/theme.css';
import './ui/layout.css';

import { loadDem } from './core/dem';
import { loadEphemeris } from './core/ephemeris';
import type { CuratedSite } from './core/types';
import { mount as mountScene } from './scene/index';
import { setData } from './state';
import { mount as mountAbout } from './ui/about/index';
import { mount as mountCompare } from './ui/compare/index';
import { mount as mountNudge } from './ui/nudge/index';
import { mount as mountPanel } from './ui/panel/index';
import { mount as mountReadout } from './ui/readout/index';
import { mount as mountScenarios } from './ui/scenarios/index';
import { mount as mountSky } from './ui/sky/index';
import { mount as mountTimeline } from './ui/timeline/index';

const slots: [id: string, mount: (el: HTMLElement) => void][] = [
  ['about', mountAbout],
  ['scene', mountScene],
  ['scenarios', mountScenarios],
  ['readout', mountReadout],
  ['nudge', mountNudge],
  ['panel', mountPanel],
  ['compare', mountCompare],
  ['timeline', mountTimeline],
  ['sky', mountSky],
];

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
