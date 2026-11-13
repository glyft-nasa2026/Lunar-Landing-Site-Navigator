// Placeholder by T00. T12 replaces this file with the 3D scene and map.
import './scene.css';
import { getState, selected, subscribe } from '../state';

export function mount(el: HTMLElement): void {
  const title = document.createElement('h2');
  title.textContent = '#scene';
  const value = document.createElement('p');
  value.className = 'muted';
  el.replaceChildren(title, value);

  const render = (): void => {
    const s = getState();
    const sc = selected();
    value.textContent =
      `${s.mode} view · selected "${sc.label}" at latitude ${sc.site.lat}, longitude ${sc.site.lon} · ` +
      (s.dem ? `height map ${s.dem.meta.size} x ${s.dem.meta.size}` : 'Loading height map');
  };
  subscribe(render);
  render();
}
