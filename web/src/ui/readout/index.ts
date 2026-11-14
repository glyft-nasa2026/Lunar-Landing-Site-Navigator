// Placeholder by T00. T08 replaces this file with the readout.
import './readout.css';
import { countdownText } from '../../core/windows';
import { flipFor, getState, neverLitFor, samplesFor, selected, subscribe } from '../../state';

export function mount(el: HTMLElement): void {
  const title = document.createElement('h2');
  title.textContent = 'Current conditions';
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
    if (!now || now.tMs !== sc.tMs) {
      value.textContent = 'This time is outside the table';
      return;
    }
    const countdown = countdownText('sun', now.sunFrac > 0, flipFor(sc, 'sun'), sc.tMs, neverLitFor(sc));
    value.textContent = `Sun altitude ${now.sun.alt.toFixed(2)} degrees · ${countdown}`;
  };
  subscribe(render);
  render();
}
