// Placeholder by T00. T10 replaces this file with the timeline chart.
import './timeline.css';
import { getState, selected, subscribe, timelineFor } from '../../state';

export function mount(el: HTMLElement): void {
  const title = document.createElement('h2');
  title.textContent = 'Visibility timeline';
  const value = document.createElement('p');
  value.className = 'muted';
  el.replaceChildren(title, value);

  const render = (): void => {
    const s = getState();
    if (!s.eph) {
      value.textContent = 'Loading';
      return;
    }
    const samples = timelineFor(selected(), s.range);
    value.textContent =
      `Range ${s.range} · window starts ${new Date(s.windowStartMs).toISOString()} · ${samples.length} hourly samples`;
  };
  subscribe(render);
  render();
}
