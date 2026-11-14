// Scenario panel (T08): F1 curated list and typed coordinates, F2 time box, F5 pinned
// scenarios, F17 share link. Every edit lands on the live scenario through state.ts actions;
// the cards and boxes redraw from state, so a reload or a pasted link shows the same panel.
import './scenarios.css';
import type { CuratedSite, Site } from '../../core/types';
import {
  getState, LIVE_ID, MAX_PINNED, pin, select, setLiveSite, setLiveTime, stateToAddress, subscribe,
  unpin, type Scenario,
} from '../../state';
import { checkLat, checkLon, checkUtc, coordText, groupName, toBoxValue, utcText, type Checked } from './input';

const SAME_DEG = 1e-6; // state keeps 6 decimals, so this is "the same point"

function make<K extends keyof HTMLElementTagNameMap>(
  tag: K, className = '', text = '',
): HTMLElementTagNameMap[K] {
  const el = document.createElement(tag);
  if (className) el.className = className;
  if (text) el.textContent = text;
  return el;
}

function siteAt(sites: CuratedSite[], s: Site): CuratedSite | undefined {
  return sites.find((c) => Math.abs(c.lat - s.lat) < SAME_DEG && Math.abs(c.lon - s.lon) < SAME_DEG);
}

/** One labelled box with its message line. The message is empty until the input is rejected. */
function field(label: string, input: HTMLInputElement | HTMLSelectElement, id: string) {
  const wrap = make('div', 'scn-field');
  const lab = make('label', 'scn-label', label);
  input.id = id;
  lab.htmlFor = id;
  const error = make('p', 'scn-error');
  error.id = `${id}-error`;
  error.setAttribute('role', 'alert');
  input.setAttribute('aria-describedby', error.id);
  wrap.append(lab, input, error);
  const setError = (message: string): void => {
    error.textContent = message;
    input.setAttribute('aria-invalid', message ? 'true' : 'false');
  };
  return { wrap, setError };
}

export function mount(el: HTMLElement): void {
  const title = make('h2', '', 'Scenarios');

  // --- The live scenario's site and time --------------------------------------------------
  const siteBox = make('select', 'field');
  const latBox = make('input', 'field scn-num');
  latBox.inputMode = 'decimal';
  latBox.autocomplete = 'off';
  const lonBox = make('input', 'field scn-num');
  lonBox.inputMode = 'decimal';
  lonBox.autocomplete = 'off';
  const timeBox = make('input', 'field scn-num');
  timeBox.type = 'datetime-local';
  timeBox.step = '60';

  const siteField = field('Site', siteBox, 'scn-site');
  const latField = field('Latitude (°, north +)', latBox, 'scn-lat');
  const lonField = field('Longitude (°, east +)', lonBox, 'scn-lon');
  const timeField = field('Time (UTC)', timeBox, 'scn-time');

  const coords = make('div', 'scn-coords');
  coords.append(latField.wrap, lonField.wrap);
  const editor = make('div', 'scn-editor');
  editor.append(siteField.wrap, coords, timeField.wrap);

  // --- Cards and buttons ------------------------------------------------------------------
  const list = make('ul', 'scn-list');
  list.setAttribute('aria-label', 'Scenarios: click one to show it in the readout');

  const pinButton = make('button', 'btn btn-primary', '+ Pin this');
  pinButton.type = 'button';
  const shareButton = make('button', 'btn', 'Copy share link');
  shareButton.type = 'button';
  const actions = make('div', 'scn-actions');
  actions.append(pinButton, shareButton);

  const shareNote = make('p', 'scn-note muted');
  shareNote.setAttribute('role', 'status');
  const shareLink = make('input', 'field scn-link');
  shareLink.readOnly = true;
  shareLink.hidden = true;
  shareLink.setAttribute('aria-label', 'Share link');

  el.replaceChildren(title, editor, list, actions, shareNote, shareLink);

  // --- Actions ----------------------------------------------------------------------------
  // A box applies on change (Enter, or leaving the box); the time box is held back further,
  // below. A rejected value stays in the box with its message and changes nothing.
  const apply = <T>(result: Checked<T>, setError: (m: string) => void, use: (v: T) => void): void => {
    if (!result.ok) {
      setError(result.message);
      return;
    }
    setError('');
    use(result.value);
  };

  latBox.addEventListener('change', () =>
    apply(checkLat(latBox.value), latField.setError, (lat) => setLiveSite({ ...getState().live.site, lat })));
  lonBox.addEventListener('change', () =>
    apply(checkLon(lonBox.value), lonField.setError, (lon) => setLiveSite({ ...getState().live.site, lon })));
  // The time box waits until the person has finished typing. Chromium fires 'change' after each
  // part of a date box (month, day, year, hour, minute) once every part is filled, so applying
  // on 'change' moved the live time through half-typed dates. While keys are being typed into
  // the box, 'change' is held back and the value applies on Enter or when the box loses focus.
  // A value set in one go (the calendar picker, a paste, a script) still applies at once.
  const applyTime = (): void =>
    apply(checkUtc(timeBox.value, getState().eph), timeField.setError, (tMs) => setLiveTime(tMs));
  let typing = false;
  const finishTyping = (): void => {
    if (!typing) return;
    typing = false;
    applyTime();
  };
  timeBox.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      if (typing) e.preventDefault();
      finishTyping();
      return;
    }
    // Keys that change a part's value. Left, right and Tab only move between parts or out.
    if (e.key.length === 1 || ['Backspace', 'Delete', 'ArrowUp', 'ArrowDown'].includes(e.key)) typing = true;
  });
  timeBox.addEventListener('blur', finishTyping);
  // A click (on a part, or to open the picker) starts fresh: what was typed so far applies first.
  timeBox.addEventListener('pointerdown', finishTyping);
  timeBox.addEventListener('change', () => {
    if (!typing) applyTime();
  });
  siteBox.addEventListener('change', () => {
    const c = getState().sites.find((s) => s.id === siteBox.value);
    if (!c) return;
    latField.setError('');
    lonField.setError('');
    setLiveSite({ ...getState().live.site, lat: c.lat, lon: c.lon });
  });

  pinButton.addEventListener('click', () => pin());

  shareButton.addEventListener('click', () => {
    // Built here rather than read from the address bar, which is written a moment after a change.
    const url = `${location.href.split('#')[0]}#${stateToAddress()}`;
    const showLink = (): void => {
      shareLink.value = url;
      shareLink.hidden = false;
      shareLink.select();
      shareNote.textContent = 'Copy this link to share these scenarios.';
    };
    if (!navigator.clipboard) {
      showLink();
      return;
    }
    navigator.clipboard.writeText(url).then(
      () => {
        shareLink.hidden = true;
        shareNote.textContent = 'Link copied. It reopens these scenarios.';
      },
      showLink,
    );
  });

  // --- Drawing from state -----------------------------------------------------------------
  // A box is rewritten only when the state behind it changes, so a rejected value stays in
  // view with its message until the scenario moves some other way.
  const shown = { lat: '', lon: '', time: '' };
  let shownSites: CuratedSite[] | null = null;
  // Chromium commits a date box part by part as it is typed, and drops focus from it when its
  // min or max is written mid-typing. So the bounds are written only when the table's range
  // changes, and a box isn't rewritten with the value it already shows.
  let shownRange = '';

  const sync = (box: HTMLInputElement, key: keyof typeof shown, value: string, setError: (m: string) => void): void => {
    if (shown[key] === value) return;
    shown[key] = value;
    if (box.value !== value) box.value = value;
    setError('');
  };

  const drawSiteOptions = (sites: CuratedSite[]): void => {
    const custom = make('option', '', sites.length ? 'Typed coordinates' : 'Loading sites');
    custom.value = '';
    custom.disabled = true;
    const groups = new Map<string, CuratedSite[]>();
    for (const s of sites) groups.set(s.group, [...(groups.get(s.group) ?? []), s]);
    const parts: HTMLElement[] = [custom];
    for (const [group, members] of groups) {
      const og = make('optgroup');
      og.label = groupName(group);
      for (const s of members) {
        const o = make('option', '', s.name);
        o.value = s.id;
        og.append(o);
      }
      parts.push(og);
    }
    siteBox.replaceChildren(...parts);
  };

  const card = (sc: Scenario, isSelected: boolean, sites: CuratedSite[]): HTMLLIElement => {
    const li = make('li', 'scn-card');
    if (isSelected) li.classList.add('scn-selected');
    li.style.setProperty('--scn-color', `var(${sc.color})`);

    const body = make('button', 'scn-pick');
    body.type = 'button';
    body.setAttribute('aria-pressed', String(isSelected));
    const dot = make('span', 'scn-dot');
    dot.setAttribute('aria-hidden', 'true');
    const label = make('span', 'scn-name', sc.id === LIVE_ID ? 'Live' : sc.label);
    const where = make('span', 'scn-where', siteAt(sites, sc.site)?.name ?? coordText(sc.site.lat, sc.site.lon));
    const when = make('span', 'scn-when muted', `${utcText(sc.tMs)} UTC`);
    body.append(dot, label, where, when);
    body.addEventListener('click', () => select(sc.id));
    li.append(body);

    if (sc.id !== LIVE_ID) {
      const remove = make('button', 'btn scn-remove', '×');
      remove.type = 'button';
      remove.title = `Remove ${sc.label}`;
      remove.setAttribute('aria-label', `Remove scenario ${sc.label}`);
      remove.addEventListener('click', () => unpin(sc.id));
      li.append(remove);
    }
    return li;
  };

  const render = (): void => {
    const s = getState();
    const live = s.live;

    if (s.sites !== shownSites) {
      shownSites = s.sites;
      drawSiteOptions(s.sites);
    }
    siteBox.value = siteAt(s.sites, live.site)?.id ?? '';

    sync(latBox, 'lat', String(live.site.lat), latField.setError);
    sync(lonBox, 'lon', String(live.site.lon), lonField.setError);
    sync(timeBox, 'time', toBoxValue(live.tMs), timeField.setError);
    if (s.eph) {
      const min = toBoxValue(s.eph.startMs), max = toBoxValue(s.eph.endMs - 60_000);
      if (`${min}|${max}` !== shownRange) {
        shownRange = `${min}|${max}`;
        timeBox.min = min;
        timeBox.max = max;
      }
    }

    list.replaceChildren(
      card(live, s.selectedId === LIVE_ID, s.sites),
      ...s.pinned.map((p) => card(p, s.selectedId === p.id, s.sites)),
    );

    const full = s.pinned.length >= MAX_PINNED;
    pinButton.disabled = full;
    pinButton.title = full
      ? `${MAX_PINNED} scenarios are pinned. Remove one to pin another.`
      : 'Keep a copy of the live scenario';
  };

  subscribe(render);
  render();
}
