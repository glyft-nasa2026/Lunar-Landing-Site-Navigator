// Placeholder by T00. T11 replaces this file with the sky panorama.
import './sky.css';
import { getState, samplesFor, selected, skylineFor, subscribe } from '../../state';

export function mount(el: HTMLElement): void {
  const title = document.createElement('h2');
  title.textContent = 'Sky panorama';
  const value = document.createElement('p');
  value.className = 'muted';
  el.replaceChildren(title, value);

  const render = (): void => {
    if (!getState().eph) {
      value.textContent = 'Loading';
      return;
    }
    const sc = selected();
    const now = samplesFor(sc, '30d')[0];
    const skyline = skylineFor(sc).terrain ? 'terrain skyline' : 'smooth Moon, no terrain';
    value.textContent = now
      ? `Sun azimuth ${now.sun.az.toFixed(1)} degrees · ${skyline}`
      : 'This time is outside the table';
  };
  subscribe(render);
  render();
}
