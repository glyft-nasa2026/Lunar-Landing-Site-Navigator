// Solar panel choice (T15, spec F15): the power a flat panel and an upright panel turned to face
// the Sun would make at the selected scenario, now and over the next 30 days. The numbers come
// from core/panel.ts on state.ts's cached samples; this file only rounds and labels them.
import './panel.css';
import { panelAverage, panelPower, type PanelPower } from '../../core/panel';
import { getState, samplesFor, selected, subscribe } from '../../state';
import { powerText } from './format';

const WHY =
  'Near the poles the Sun stays close to the horizon, so its light skims a flat panel almost ' +
  'edge-on. An upright panel that turns to follow the Sun catches it face-on.';

function make<K extends keyof HTMLElementTagNameMap>(
  tag: K, className = '', text = '',
): HTMLElementTagNameMap[K] {
  const el = document.createElement(tag);
  if (className) el.className = className;
  if (text) el.textContent = text;
  return el;
}

function powerTable(now: PanelPower, month: PanelPower): HTMLTableElement {
  const table = make('table', 'table pn-table');
  const head = make('thead');
  const headRow = make('tr');
  headRow.append(make('th', '', 'Panel'), make('th', '', 'Now'), make('th', '', '30 days'));
  for (const th of headRow.children) th.setAttribute('scope', 'col');
  head.append(headRow);
  const body = make('tbody');
  const rows: [string, keyof PanelPower][] = [['Flat on the ground', 'flat'], ['Upright, facing the Sun', 'upright']];
  for (const [label, key] of rows) {
    const tr = make('tr');
    const th = make('th', '', label);
    th.setAttribute('scope', 'row');
    tr.append(th, make('td', '', powerText(now[key])), make('td', '', powerText(month[key])));
    body.append(tr);
  }
  table.append(head, body);
  return table;
}

export function mount(el: HTMLElement): void {
  const title = make('h2', '', 'Solar panel');
  const intro = make('p', 'pn-intro muted', 'Power as a share of full sunlight on the panel’s face');
  const content = make('div', 'pn-content');
  content.setAttribute('aria-live', 'polite');
  const why = make('p', 'pn-why muted', WHY);
  el.replaceChildren(title, intro, content, why);

  const render = (): void => {
    if (!getState().eph) {
      content.replaceChildren(make('p', 'muted', 'Loading'));
      return;
    }
    const sc = selected();
    const samples = samplesFor(sc, '30d');
    const now = samples[0];
    if (!now || now.tMs !== sc.tMs) {
      content.replaceChildren(make('p', 'pn-error', 'This time is outside the Sun and Earth table'));
      return;
    }
    content.replaceChildren(powerTable(panelPower(now), panelAverage(samples)));
  };

  subscribe(render);
  render();
}
