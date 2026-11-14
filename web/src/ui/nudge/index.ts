// Nudge (F11, T13): move the live scenario 1 km or 1 day, see it as a grey ghost on the map, and
// read what changes in plain words. Keep makes the ghost the live scenario; Discard drops it.
// Every number comes from core/ through state.ts.
import './nudge.css';
import { destination } from '../../core/geometry';
import { countdownText } from '../../core/windows';
import {
  flipFor, getState, neverLitFor, samplesFor, setGhost, setLiveSite, setLiveTime, skylineFor,
  subscribe, summaryFor, type Scenario,
} from '../../state';
import { compare, DAY_MS, NUDGE_M, NUDGES, type Facts, type Nudge } from './model';

const GHOST_ID = 'ghost';

function make<K extends keyof HTMLElementTagNameMap>(tag: K, className = '', text = ''): HTMLElementTagNameMap[K] {
  const el = document.createElement(tag);
  if (className) el.className = className;
  if (text) el.textContent = text;
  return el;
}

/** The ghost for one step from the live scenario. */
function ghostOf(live: Scenario, n: Nudge): Scenario {
  const site = n.bearing === undefined
    ? { ...live.site }
    : { ...live.site, ...destination(live.site.lat, live.site.lon, n.bearing, NUDGE_M) };
  return {
    id: GHOST_ID, label: 'Ghost', color: '--scn-ghost', site,
    tMs: live.tMs + (n.days ?? 0) * DAY_MS,
  };
}

/** Facts for the comparison, or null while that scenario's data is still loading. */
function factsOf(sc: Scenario): Facts | null {
  const first = samplesFor(sc, '30d')[0];
  if (!first) return null;
  const s = summaryFor(sc);
  return {
    tMs: sc.tMs, litPct: s.litPct, earthPct: s.earthPct,
    sunUp: first.sunFrac > 0, earthUp: first.earthUp,
    sunFlip: flipFor(sc, 'sun'), earthFlip: flipFor(sc, 'earth'),
    terrain: skylineFor(sc).terrain,
  };
}

const sunCount = (sc: Scenario, f: Facts): string =>
  countdownText('sun', f.sunUp, f.sunFlip, sc.tMs, !f.sunUp && neverLitFor(sc));
const earthCount = (sc: Scenario, f: Facts): string =>
  countdownText('earth', f.earthUp, f.earthFlip, sc.tMs);

const sameAs = (a: Scenario, b: Scenario): boolean =>
  a.tMs === b.tMs && a.site.lat === b.site.lat && a.site.lon === b.site.lon && a.site.eye_m === b.site.eye_m;

export function mount(el: HTMLElement): void {
  const title = make('h2', '', 'Nudge the live site');
  const grid = make('div', 'nudge-grid');
  const days = make('div', 'nudge-days');
  const out = make('div', 'nudge-out');
  out.setAttribute('aria-live', 'polite');
  const actions = make('div', 'nudge-actions');
  const keep = make('button', 'btn btn-primary', 'Keep');
  const discard = make('button', 'btn', 'Discard');
  keep.type = discard.type = 'button';
  actions.append(keep, discard);

  // The step behind the ghost, and the live scenario it was taken from. If live moves some
  // other way (map click, time box, timeline), the ghost no longer means anything and goes.
  let active: { nudge: Nudge; from: Scenario } | null = null;

  const buttons = new Map<string, HTMLButtonElement>();
  for (const n of NUDGES) {
    const b = make('button', 'btn', n.text);
    b.type = 'button';
    b.addEventListener('click', () => {
      const live = getState().live;
      if (active?.nudge.id === n.id && sameAs(active.from, live)) {
        // A second press on the same step takes it away again.
        active = null;
        setGhost(null);
        return;
      }
      active = { nudge: n, from: live };
      setGhost(ghostOf(live, n));
    });
    buttons.set(n.id, b);
  }
  const btn = (id: string): HTMLButtonElement => buttons.get(id) as HTMLButtonElement;
  grid.append(make('span'), btn('n'), make('span'), btn('w'), btn('s'), btn('e'));
  days.append(btn('minus-day'), btn('plus-day'));

  keep.addEventListener('click', () => {
    const g = getState().ghost;
    if (!g) return;
    active = null;
    setLiveSite(g.site);
    setLiveTime(g.tMs);
    setGhost(null);
  });
  discard.addEventListener('click', () => {
    active = null;
    setGhost(null);
  });

  el.replaceChildren(title, grid, days, out);

  const render = (): void => {
    const st = getState();
    const live = st.live;
    if (active && !sameAs(active.from, live)) {
      active = null;
      if (st.ghost?.id === GHOST_ID) {
        setGhost(null); // notifies, and this runs again with the ghost gone
        return;
      }
    }
    const ghost = st.ghost?.id === GHOST_ID ? st.ghost : null;
    const eph = st.eph;
    for (const n of NUDGES) {
      const b = btn(n.id);
      b.setAttribute('aria-pressed', String(!!ghost && active?.nudge.id === n.id));
      const t = live.tMs + (n.days ?? 0) * DAY_MS;
      b.disabled = !eph || t < eph.startMs || t > eph.endMs;
    }

    out.replaceChildren();
    if (!eph) {
      out.append(make('p', 'muted', 'Loading'));
      el.replaceChildren(title, grid, days, out);
      return;
    }
    if (!ghost) {
      out.append(make('p', 'muted nudge-hint', 'Move the live site 1 km or 1 day to see what changes.'));
      el.replaceChildren(title, grid, days, out);
      return;
    }

    const fl = factsOf(live);
    const fg = factsOf(ghost);
    if (!fl || !fg) {
      out.append(make('p', 'muted', 'Loading'));
    } else {
      for (const line of compare(fl, fg)) out.append(make('p', `nudge-line nudge-${line.tone}`, line.text));
      const table = make('table', 'table nudge-table');
      const head = make('tr');
      head.append(make('th'), make('th', '', 'Here'), make('th', '', 'Ghost'));
      const row = (a: string, b: string): HTMLTableRowElement => {
        const tr = make('tr');
        tr.append(make('td'), make('td', '', a), make('td', '', b));
        return tr;
      };
      const sunRow = row(sunCount(live, fl), sunCount(ghost, fg));
      sunRow.firstElementChild!.textContent = 'Sun';
      const earthRow = row(earthCount(live, fl), earthCount(ghost, fg));
      earthRow.firstElementChild!.textContent = 'Earth';
      const thead = make('thead');
      thead.append(head);
      const tbody = make('tbody');
      tbody.append(sunRow, earthRow);
      table.append(thead, tbody);
      out.append(table);
    }
    out.append(make('p', 'muted nudge-hint', 'Ghost scenario shown in grey on the map'));
    el.replaceChildren(title, grid, days, out, actions);
  };

  subscribe(() => render());
  render();
}
