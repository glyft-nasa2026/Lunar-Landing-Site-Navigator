// Scenario panel (T08): F1 curated list and typed coordinates, F2 time box, F5 pinned
// scenarios, F17 share link. Every edit lands on the live scenario through state.ts actions;
// the cards and boxes redraw from state, so a reload or a pasted link shows the same panel.
// The cards are updated in place, never rebuilt, so a click that follows an edit is not lost.
import './scenarios.css';
import type { CuratedSite, Site } from '../../core/types';
import {
  getState, LIVE_ID, MAX_PINNED, pin, select, setLiveSite, setLiveTime, stateToAddress, subscribe,
  unpin, type Scenario,
} from '../../state';
import { checkLat, checkLon, checkUtc, coordText, groupName, toBoxValue, toPickerValue, utcText, type Checked } from './input';

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
  // The time is typed in a text box, not datetime-local: the browser shows a date box in its own
  // locale's order (often MM/DD/YYYY), and the page always writes dates YYYY-MM-DD. The button
  // opens the browser's own picker on a hidden datetime-local box, whose value is always
  // "YYYY-MM-DDTHH:MM" whatever the locale, and the picked time is copied into the text box.
  timeBox.placeholder = 'YYYY-MM-DD HH:MM';
  timeBox.autocomplete = 'off';
  timeBox.spellcheck = false;
  const pickButton = make('button', 'btn scn-pick-time', '📅');
  pickButton.type = 'button';
  pickButton.title = 'Pick a date and time';
  pickButton.setAttribute('aria-label', 'Pick a date and time');
  const pickerBox = make('input', 'scn-picker');
  pickerBox.type = 'datetime-local';
  pickerBox.step = '60';
  pickerBox.tabIndex = -1;
  pickerBox.setAttribute('aria-hidden', 'true');

  const siteField = field('Site', siteBox, 'scn-site');
  const latField = field('Latitude (°, north +)', latBox, 'scn-lat');
  const lonField = field('Longitude (°, east +)', lonBox, 'scn-lon');
  const timeField = field('Time (UTC)', timeBox, 'scn-time');
  const timeRow = make('div', 'scn-time-row');
  timeBox.replaceWith(timeRow);
  timeRow.append(timeBox, pickButton, pickerBox);

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
  // A text box fires 'change' only on Enter or when it loses focus, so a half-typed time
  // never moves the live scenario.
  const applyTime = (text: string): void =>
    apply(checkUtc(text, getState().eph), timeField.setError, (tMs) => setLiveTime(tMs));
  timeBox.addEventListener('change', () => applyTime(timeBox.value));

  pickButton.addEventListener('click', () => {
    // Open the picker on the time in the text box if it reads, else on the live time.
    const typed = checkUtc(timeBox.value, null);
    pickerBox.value = toPickerValue(typed.ok ? typed.value : getState().live.tMs);
    const eph = getState().eph;
    if (eph) {
      pickerBox.min = toPickerValue(eph.startMs);
      pickerBox.max = toPickerValue(eph.endMs - 60_000);
    }
    try {
      pickerBox.showPicker();
    } catch {
      timeBox.focus(); // No picker in this browser: the time can still be typed.
    }
  });
  pickerBox.addEventListener('change', () => {
    if (!pickerBox.value) return;
    const typed = checkUtc(pickerBox.value, null);
    if (typed.ok) timeBox.value = toBoxValue(typed.value);
    applyTime(pickerBox.value);
  });
  siteBox.addEventListener('change', () => {
    const c = getState().sites.find((s) => s.id === siteBox.value);
    if (!c) return;
    // Both boxes are written again from the chosen site, with their messages cleared, even
    // where one coordinate is the same as before: a rejected value must not stay in its box.
    shown.lat = '';
    shown.lon = '';
    setLiveSite({ ...getState().live.site, lat: c.lat, lon: c.lon });
  });

  pinButton.addEventListener('click', () => pin());

  // A box applies its value on the mouse press that takes the focus away. If that makes a
  // message line appear or go, everything below it moves, the release lands beside the button
  // that was pressed, and the browser sends no click. When the pointer is still where that
  // button was at the press, the click is passed on to it.
  let pressed: { button: HTMLButtonElement; box: DOMRect } | null = null;
  el.addEventListener('mousedown', (e) => {
    const button = e.button === 0 && e.target instanceof Element ? e.target.closest('button') : null;
    pressed = button ? { button, box: button.getBoundingClientRect() } : null;
  }, true);
  document.addEventListener('mouseup', (e) => {
    const p = pressed;
    pressed = null;
    if (!p || !p.button.isConnected) return;
    if (e.target instanceof Node && p.button.contains(e.target)) return; // the browser clicks it
    const inBox = e.clientX >= p.box.left && e.clientX <= p.box.right
      && e.clientY >= p.box.top && e.clientY <= p.box.bottom;
    if (inBox) p.button.click();
  }, true);

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

  const sync = (box: HTMLInputElement, key: keyof typeof shown, value: string, setError: (m: string) => void): void => {
    if (shown[key] === value) return;
    shown[key] = value;
    if (box.value !== value) box.value = value;
    setError('');
  };

  const drawSiteOptions = (sites: CuratedSite[]): void => {
    // Shown when the live site is not one from the list. The list may be on its way or may
    // have failed to load (the status line says which), so this doesn't say "Loading".
    const custom = make('option', '', 'Typed coordinates');
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

  // One card per scenario id, made once and then updated in place. A box applies its value on
  // 'change', which fires on the mouse press that takes the focus away; if that redraw replaced
  // the cards, the press and the release would land on different buttons and the click on a
  // card or its × would be lost.
  type Card = {
    li: HTMLLIElement; body: HTMLButtonElement; label: HTMLSpanElement; where: HTMLSpanElement;
    when: HTMLSpanElement; remove: HTMLButtonElement | null;
  };
  const cards = new Map<string, Card>();

  const makeCard = (id: string): Card => {
    const li = make('li', 'scn-card');
    const body = make('button', 'scn-pick');
    body.type = 'button';
    const dot = make('span', 'scn-dot');
    dot.setAttribute('aria-hidden', 'true');
    const label = make('span', 'scn-name');
    const where = make('span', 'scn-where');
    const when = make('span', 'scn-when muted');
    body.append(dot, label, where, when);
    body.addEventListener('click', () => select(id));
    li.append(body);

    let remove: HTMLButtonElement | null = null;
    if (id !== LIVE_ID) {
      remove = make('button', 'btn scn-remove', '×');
      remove.type = 'button';
      remove.addEventListener('click', () => unpin(id));
      li.append(remove);
    }
    return { li, body, label, where, when, remove };
  };

  const setText = (node: HTMLElement, text: string): void => {
    if (node.textContent !== text) node.textContent = text;
  };

  const drawCard = (c: Card, sc: Scenario, isSelected: boolean, sites: CuratedSite[]): void => {
    c.li.classList.toggle('scn-selected', isSelected);
    c.li.style.setProperty('--scn-color', `var(${sc.color})`);
    c.body.setAttribute('aria-pressed', String(isSelected));
    setText(c.label, sc.id === LIVE_ID ? 'Live' : sc.label);
    setText(c.where, siteAt(sites, sc.site)?.name ?? coordText(sc.site.lat, sc.site.lon));
    setText(c.when, `${utcText(sc.tMs)} UTC`);
    if (c.remove) {
      c.remove.title = `Remove ${sc.label}`;
      c.remove.setAttribute('aria-label', `Remove scenario ${sc.label}`);
    }
  };

  const drawCards = (scenarios: Scenario[], selectedId: string, sites: CuratedSite[]): void => {
    for (const [id, c] of cards) {
      if (scenarios.some((sc) => sc.id === id)) continue;
      c.li.remove();
      cards.delete(id);
    }
    scenarios.forEach((sc, i) => {
      let c = cards.get(sc.id);
      if (!c) {
        c = makeCard(sc.id);
        cards.set(sc.id, c);
      }
      drawCard(c, sc, sc.id === selectedId, sites);
      // Live first, then the pins in slot order. A card already in its place is not touched.
      if (list.children[i] !== c.li) list.insertBefore(c.li, list.children[i] ?? null);
    });
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

    drawCards([live, ...s.pinned], s.selectedId, s.sites);

    const full = s.pinned.length >= MAX_PINNED;
    pinButton.disabled = full;
    pinButton.title = full
      ? `${MAX_PINNED} scenarios are pinned. Remove one to pin another.`
      : 'Keep a copy of the live scenario';
  };

  subscribe(render);
  render();
}
