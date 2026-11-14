// Placeholder by T00. T08 replaces this file with the scenario panel.
// The two buttons are only here to prove that actions reach every other slot.
import './scenarios.css';
import { getState, MAX_PINNED, pin, setLiveTime, subscribe } from '../../state';

const HOUR_MS = 3_600_000;

export function mount(el: HTMLElement): void {
  const title = document.createElement('h2');
  title.textContent = 'Scenarios';
  const value = document.createElement('p');
  value.className = 'muted';

  const later = document.createElement('button');
  later.className = 'btn';
  later.textContent = '+6 h';
  later.addEventListener('click', () => setLiveTime(getState().live.tMs + 6 * HOUR_MS));

  const pinButton = document.createElement('button');
  pinButton.className = 'btn btn-primary';
  pinButton.textContent = 'Pin this';
  pinButton.addEventListener('click', () => pin());

  el.replaceChildren(title, value, later, pinButton);

  const render = (): void => {
    const s = getState();
    const labels = s.pinned.map((p) => p.label).join(', ') || 'none';
    value.textContent =
      `Live time ${new Date(s.live.tMs).toISOString()} · pinned: ${labels} · selected: ${s.selectedId}`;
    pinButton.disabled = s.pinned.length >= MAX_PINNED;
  };
  subscribe(render);
  render();
}
