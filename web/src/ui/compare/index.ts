// Placeholder by T00. T09 replaces this file with the compare table and strips.
import './compare.css';
import { getState, subscribe, summaryFor } from '../../state';

export function mount(el: HTMLElement): void {
  const title = document.createElement('h2');
  title.textContent = '#compare';
  const value = document.createElement('p');
  value.className = 'muted';
  el.replaceChildren(title, value);

  const render = (): void => {
    const s = getState();
    if (!s.eph) {
      value.textContent = 'Loading';
      return;
    }
    value.textContent = s.pinned.length === 0
      ? 'Pin a scenario to compare'
      : s.pinned.map((p) => `${p.label}: lit ${summaryFor(p).litPct.toFixed(0)} % of the next 30 days`).join(' · ');
  };
  subscribe(render);
  render();
}
