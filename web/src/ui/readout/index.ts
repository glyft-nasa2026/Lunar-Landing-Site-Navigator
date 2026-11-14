// Readout (T08): F3 Sun and Earth for the selected scenario, F4 the two countdowns.
// Every number comes from state.ts accessors, which call core/; this file only formats them.
import './readout.css';
import { countdownText } from '../../core/windows';
import {
  flipFor, getState, LIVE_ID, neverLitFor, samplesFor, selected, skylineFor, subscribe,
} from '../../state';
import { azText, degText, pctText } from './format';

function make<K extends keyof HTMLElementTagNameMap>(
  tag: K, className = '', text = '',
): HTMLElementTagNameMap[K] {
  const el = document.createElement(tag);
  if (className) el.className = className;
  if (text) el.textContent = text;
  return el;
}

function utcText(tMs: number): string {
  return new Date(tMs).toISOString().slice(0, 16).replace('T', ' ');
}

/** A small table of name and value rows, under a heading, with the countdown below. */
function bodyBlock(name: string, rows: [string, string][], countdown: string, kind: 'sun' | 'earth'): HTMLElement {
  const block = make('div', `ro-body ro-${kind}`);
  const head = make('h3', 'ro-head', name);
  const table = make('table', 'table ro-table');
  const tbody = make('tbody');
  for (const [k, v] of rows) {
    const tr = make('tr');
    tr.append(make('th', '', k), make('td', '', v));
    tbody.append(tr);
  }
  table.append(tbody);
  const cd = make('p', 'ro-countdown', countdown);
  block.append(head, table, cd);
  return block;
}

export function mount(el: HTMLElement): void {
  const title = make('h2', '', 'Readout');
  const whose = make('p', 'ro-whose');
  const where = make('p', 'ro-where muted');
  const note = make('p', 'ro-note badge');
  const content = make('div', 'ro-content');
  content.setAttribute('aria-live', 'polite');
  el.replaceChildren(title, whose, where, note, content);

  const render = (): void => {
    const s = getState();
    const sc = selected();

    whose.replaceChildren();
    whose.style.setProperty('--scn-color', `var(${sc.color})`);
    const dot = make('span', 'ro-dot');
    dot.setAttribute('aria-hidden', 'true');
    whose.append(dot, sc.id === LIVE_ID ? 'Live scenario' : `Scenario ${sc.label} (pinned)`);

    const site = s.sites.find((c) => Math.abs(c.lat - sc.site.lat) < 1e-6 && Math.abs(c.lon - sc.site.lon) < 1e-6);
    const coords = `${sc.site.lat.toFixed(4)}°, ${sc.site.lon.toFixed(4)}°`;
    where.textContent = `${site ? `${site.name} · ` : ''}${coords} · ${utcText(sc.tMs)} UTC`;

    note.textContent = skylineFor(sc).terrain ? '' : 'Smooth Moon, no terrain';

    if (!s.eph) {
      content.replaceChildren(make('p', 'muted', 'Loading'));
      return;
    }
    const now = samplesFor(sc, '30d')[0];
    if (!now || now.tMs !== sc.tMs) {
      content.replaceChildren(make('p', 'ro-error', 'This time is outside the Sun and Earth table'));
      return;
    }

    const sunUp = now.sunFrac > 0;
    const sun = bodyBlock('Sun', [
      ['Altitude', degText(now.sun.alt)],
      ['Azimuth', azText(now.sun.az)],
      ['Above skyline', degText(now.sunAbove)],
      ['Disc visible', pctText(now.sunFrac)],
    ], countdownText('sun', sunUp, flipFor(sc, 'sun'), sc.tMs, neverLitFor(sc)), 'sun');

    const earth = bodyBlock('Earth', [
      ['Altitude', degText(now.earth.alt)],
      ['Azimuth', azText(now.earth.az)],
      ['Above skyline', degText(now.earthAbove)],
      ['Visible', now.earthUp ? 'Yes' : 'Hidden'],
    ], countdownText('earth', now.earthUp, flipFor(sc, 'earth'), sc.tMs), 'earth');

    content.replaceChildren(sun, earth);
  };

  subscribe(render);
  render();
}
