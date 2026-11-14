// Nudge (F11, T13; issue #58): move the live scenario a chosen distance or 1 day, see it as a
// grey ghost on the map, and read what changes in plain words. Keep makes the ghost the live
// scenario; Discard drops it. Every number comes from core/ through state.ts.
//
// The panel is plain HTML floating over the map (the scene makes the #nudge slot inside its
// viewport), never drawn in the canvas. It sits in one of the map's four corners, bottom left to
// start; a corner the map's own controls claim (an element there with data-map-corner="tl" and so
// on) is skipped for the next free one.
import './nudge.css';
import { destination } from '../../core/geometry';
import { countdownText } from '../../core/windows';
import {
  flipFor, getState, neverLitFor, samplesFor, setGhost, setLiveSite, setLiveTime, skylineFor,
  subscribe, summaryFor, type Scenario,
} from '../../state';
import {
  asCorner, clampKm, compare, CORNER_NAMES, CORNERS, DAY_MS, freeCorner, kmText, NUDGE_KM, NUDGES,
  START_CORNER, stepLabel, stepText, type Corner, type Facts, type Nudge,
} from './model';

const GHOST_ID = 'ghost';
/** Arrows on the corner picker, pointing at the corner each one moves the panel to. */
const CORNER_ARROWS: Record<Corner, string> = { tl: '↖', tr: '↗', bl: '↙', br: '↘' };

function make<K extends keyof HTMLElementTagNameMap>(tag: K, className = '', text = ''): HTMLElementTagNameMap[K] {
  const el = document.createElement(tag);
  if (className) el.className = className;
  if (text) el.textContent = text;
  return el;
}

/** The ghost for one step from the live scenario. */
function ghostOf(live: Scenario, n: Nudge, km: number): Scenario {
  const site = n.bearing === undefined
    ? { ...live.site }
    : { ...live.site, ...destination(live.site.lat, live.site.lon, n.bearing, km * 1000) };
  return {
    id: GHOST_ID, label: 'Ghost', color: '--scn-ghost', site,
    tMs: live.tMs + (n.days ?? 0) * DAY_MS,
  };
}

/** On a phone the panel starts folded, so it doesn't cover the map it sits on. */
function startsFolded(): boolean {
  try { return window.matchMedia('(max-width: 800px)').matches; } catch { return false; }
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
  el.classList.add('card', 'nudge-panel');

  // Head: title, corner picker, fold button. Always shown.
  const head = make('div', 'nudge-head');
  const title = make('h2', '', 'Nudge');
  title.id = 'nudge-title';
  const picker = make('div', 'nudge-corners');
  picker.setAttribute('role', 'group');
  picker.setAttribute('aria-label', 'Move this panel to a corner of the map');
  const cornerButtons = new Map<Corner, HTMLButtonElement>();
  for (const c of CORNERS) {
    const b = make('button', 'btn nudge-corner', CORNER_ARROWS[c]);
    b.type = 'button';
    b.setAttribute('aria-label', `Move panel to the ${CORNER_NAMES[c]} corner`);
    b.title = `Move to the ${CORNER_NAMES[c]} corner`;
    b.addEventListener('click', () => { wanted = c; place(); });
    cornerButtons.set(c, b);
    picker.append(b);
  }
  const fold = make('button', 'btn nudge-fold');
  fold.type = 'button';
  const body = make('div', 'nudge-body');
  body.id = 'nudge-body';
  fold.setAttribute('aria-controls', body.id);
  head.append(title, picker, fold);

  // Distance slider.
  let km: number = NUDGE_KM.start;
  const dist = make('label', 'nudge-dist');
  const distText = make('span', '', 'Distance');
  const slider = make('input');
  slider.type = 'range';
  slider.min = String(NUDGE_KM.min);
  slider.max = String(NUDGE_KM.max);
  slider.step = String(NUDGE_KM.step);
  slider.value = String(km);
  const distOut = make('output', 'nudge-dist-value', kmText(km));
  dist.append(distText, slider, distOut);

  const grid = make('div', 'nudge-grid');
  const days = make('div', 'nudge-days');
  const out = make('div', 'nudge-out');
  out.setAttribute('aria-live', 'polite');
  const actions = make('div', 'nudge-actions');
  const keep = make('button', 'btn btn-primary', 'Keep');
  const discard = make('button', 'btn', 'Discard');
  keep.type = discard.type = 'button';
  actions.append(keep, discard);

  el.setAttribute('aria-labelledby', title.id);
  el.replaceChildren(head, body);

  // Corner: the one asked for, or the next free one if the map's own controls hold it.
  let wanted: Corner = START_CORNER;
  const taken = (): Set<Corner> => {
    const set = new Set<Corner>();
    const host = el.parentElement;
    if (!host) return set;
    for (const other of host.querySelectorAll<HTMLElement>('[data-map-corner]')) {
      if (other === el || el.contains(other)) continue;
      const c = asCorner(other.dataset.mapCorner);
      if (c) set.add(c);
    }
    return set;
  };
  const place = (): void => {
    const busy = taken();
    const at = freeCorner(wanted, busy) ?? wanted;
    if (el.dataset.corner !== at) el.dataset.corner = at;
    for (const [c, b] of cornerButtons) {
      b.disabled = busy.has(c);
      b.setAttribute('aria-pressed', String(c === at));
    }
  };
  // The map may add or move its own controls later; look again when it does.
  if (el.parentElement && typeof MutationObserver !== 'undefined') {
    new MutationObserver(place).observe(el.parentElement, {
      childList: true, subtree: true, attributes: true, attributeFilter: ['data-map-corner'],
    });
  }
  place();

  // Fold.
  let folded = startsFolded();
  const setFolded = (f: boolean): void => {
    folded = f;
    body.hidden = f;
    fold.textContent = f ? '+' : '−';
    fold.setAttribute('aria-expanded', String(!f));
    fold.setAttribute('aria-label', f ? 'Show the nudge controls' : 'Hide the nudge controls');
    fold.title = f ? 'Show' : 'Hide';
  };
  fold.addEventListener('click', () => setFolded(!folded));
  setFolded(folded);

  // The step behind the ghost, and the live scenario it was taken from. If live moves some
  // other way (map click, time box, timeline), the ghost no longer means anything and goes.
  let active: { nudge: Nudge; from: Scenario; km: number } | null = null;

  const buttons = new Map<string, HTMLButtonElement>();
  for (const n of NUDGES) {
    const b = make('button', 'btn');
    b.type = 'button';
    b.addEventListener('click', () => {
      const live = getState().live;
      if (active?.nudge.id === n.id && sameAs(active.from, live)) {
        // A second press on the same step takes it away again.
        active = null;
        setGhost(null);
        return;
      }
      active = { nudge: n, from: live, km };
      setGhost(ghostOf(live, n, km));
    });
    buttons.set(n.id, b);
  }
  const btn = (id: string): HTMLButtonElement => buttons.get(id) as HTMLButtonElement;
  grid.append(make('span'), btn('n'), make('span'), btn('w'), btn('s'), btn('e'));
  days.append(btn('minus-day'), btn('plus-day'));

  const label = (): void => {
    distOut.textContent = kmText(km);
    slider.setAttribute('aria-valuetext', kmText(km));
    for (const n of NUDGES) {
      const b = btn(n.id);
      b.textContent = stepText(n, km);
      b.setAttribute('aria-label', stepLabel(n, km));
    }
  };
  // The words follow the slider as it moves; the ghost, which costs a fresh 30-day look, moves
  // when the slider is let go.
  slider.addEventListener('input', () => {
    km = clampKm(Number(slider.value));
    label();
    render();
  });
  slider.addEventListener('change', () => {
    km = clampKm(Number(slider.value));
    label();
    const live = getState().live;
    if (active && active.nudge.bearing !== undefined && active.km !== km && sameAs(active.from, live)) {
      active = { ...active, km };
      setGhost(ghostOf(live, active.nudge, km));
    } else {
      render();
    }
  });
  label();

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

  const show = (...parts: HTMLElement[]): void => body.replaceChildren(dist, grid, days, out, ...parts);

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
      show();
      return;
    }
    if (!ghost || !active) {
      out.append(make('p', 'muted nudge-hint', `Move the live site ${kmText(km)} or 1 day to see what changes.`));
      show();
      return;
    }

    // The step the ghost was made with, which can differ from the slider until it is let go.
    out.append(make('p', 'nudge-step', `Ghost: ${stepText(active.nudge, active.km)}`));
    const fl = factsOf(live);
    const fg = factsOf(ghost);
    if (!fl || !fg) {
      out.append(make('p', 'muted', 'Loading'));
    } else {
      for (const line of compare(fl, fg)) out.append(make('p', `nudge-line nudge-${line.tone}`, line.text));
      const table = make('table', 'table nudge-table');
      const headRow = make('tr');
      headRow.append(make('th'), make('th', '', 'Here'), make('th', '', 'Ghost'));
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
      thead.append(headRow);
      const tbody = make('tbody');
      tbody.append(sunRow, earthRow);
      table.append(thead, tbody);
      out.append(table);
    }
    out.append(make('p', 'muted nudge-hint', 'Ghost scenario shown in grey on the map'));
    show(actions);
  };

  subscribe(() => render());
  render();
}
