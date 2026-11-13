// Placeholder by T00. T16 replaces this file with the About bar and panel.
import './about.css';
import { getState, subscribe } from '../../state';

export function mount(el: HTMLElement): void {
  const title = document.createElement('strong');
  title.textContent = 'Lunar Landing Site Navigator';
  const slot = document.createElement('span');
  slot.className = 'badge';
  slot.textContent = '#about';
  const value = document.createElement('span');
  value.className = 'muted';
  el.replaceChildren(title, slot, value);

  const render = (): void => {
    const s = getState();
    value.textContent = s.eph
      ? `Table: ${s.eph.meta.source} · ${s.sites.length} curated sites`
      : 'Loading';
  };
  subscribe(render);
  render();
}
