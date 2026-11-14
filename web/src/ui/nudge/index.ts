// Placeholder by T00. T13 replaces this file with the nudge buttons.
import './nudge.css';
import { getState, subscribe } from '../../state';

export function mount(el: HTMLElement): void {
  const title = document.createElement('h2');
  title.textContent = 'Explore nearby sites';
  const value = document.createElement('p');
  value.className = 'muted';
  el.replaceChildren(title, value);

  const render = (): void => {
    const s = getState();
    value.textContent = s.ghost ? `Ghost at latitude ${s.ghost.site.lat}` : 'No ghost scenario';
  };
  subscribe(render);
  render();
}
