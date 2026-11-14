// Placeholder by T00. T16 replaces this file with the About bar and panel.
import './about.css';
import { getState, subscribe } from '../../state';
import { logo } from '../intro/logo';

export function mount(el: HTMLElement): void {
  // The Darksight mark beside the name, as in docs/design/desktop.png (T22).
  const title = document.createElement('strong');
  title.className = 'about-brand';
  title.append(logo('about-logo'), 'Darksight');
  const slot = document.createElement('span');
  slot.className = 'badge';
  slot.textContent = 'About';
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
