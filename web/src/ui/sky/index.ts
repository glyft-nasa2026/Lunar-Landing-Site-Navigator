// Sky panorama (F9, T11). Azimuth 0-360 across, elevation up: the terrain skyline as a filled
// shape, the Sun's and Earth's paths over the next 30 days, and where they are at the selected
// scenario's time. Every number comes from core/ through state.ts.
import './sky.css';
import Plotly from 'plotly.js-dist-min';
import type { Data, Layout } from 'plotly.js-dist-min';
import { getState, samplesFor, selected, skylineFor, subscribe } from '../../state';
import { plotLayout, themeColor } from '../plotTheme';
import { skyModel, sunMarkerPx, Y_BOTTOM, type SkyModel, type SunState } from './model';

const SUN_WORDS: Record<SunState, string> = {
  up: 'Sun up',
  partly: 'Sun partly up',
  hidden: 'Sun hidden',
};

/** A theme length such as '8px' as a number. Plotly marker sizes are in pixels. */
function themeNumber(name: string): number {
  const v = parseFloat(themeColor(name));
  return Number.isFinite(v) ? v : 0;
}

const fmt = (v: number): string => v.toFixed(2);

function caption(m: SkyModel, terrain: boolean): string {
  const ground = terrain ? 'Terrain skyline from LOLA heights' : 'No terrain here: smooth Moon horizon';
  if (!m.now) return `${ground}. This time is outside the table.`;
  const sun = SUN_WORDS[m.now.sunState];
  const earth = m.now.earthUp ? 'Earth up' : 'Earth hidden';
  return `${ground}. ${sun} · ${earth}. Paths: next 30 days.`;
}

function traces(m: SkyModel, sunSizePx: number): Data[] {
  const sun = themeColor('--sun');
  const earth = themeColor('--earth');
  const out: Data[] = [
    {
      name: 'Skyline',
      x: m.ground.x, y: m.ground.y,
      type: 'scatter', mode: 'lines',
      fill: 'toself', fillcolor: themeColor('--dark'),
      line: { color: themeColor('--muted'), width: 1 },
      hoverinfo: 'skip',
    },
    {
      name: 'Sun, 30 days',
      x: m.sunPath.x, y: m.sunPath.y,
      type: 'scatter', mode: 'lines',
      line: { color: sun, width: 1 }, opacity: 0.6,
      hovertemplate: 'Sun path<br>az %{x:.1f}°, alt %{y:.2f}°<extra></extra>',
    },
    {
      name: 'Earth, 30 days',
      x: m.earthPath.x, y: m.earthPath.y,
      type: 'scatter', mode: 'lines',
      line: { color: earth, width: 1 }, opacity: 0.6,
      hovertemplate: 'Earth path<br>az %{x:.1f}°, alt %{y:.2f}°<extra></extra>',
    },
  ];
  if (m.now) {
    const n = m.now;
    // Filled when up, a ring when hidden: the same rule as the readout, from the same sample.
    out.push(
      {
        name: 'Earth now',
        x: [n.earth.az], y: [n.earth.alt],
        type: 'scatter', mode: 'markers',
        marker: {
          color: earth, size: themeNumber('--space-3'),
          symbol: n.earthUp ? 'circle' : 'circle-open', line: { color: earth, width: 2 },
        },
        hovertemplate: `${n.earthUp ? 'Earth up' : 'Earth hidden'}<br>az ${fmt(n.earth.az)}°, ` +
          `alt ${fmt(n.earth.alt)}°<br>skyline there ${fmt(n.skylineAtEarth)}°<extra></extra>`,
      },
      {
        name: 'Sun now',
        x: [n.sun.az], y: [n.sun.alt],
        type: 'scatter', mode: 'markers',
        marker: {
          color: sun, size: sunSizePx,
          symbol: n.sunState === 'hidden' ? 'circle-open' : 'circle', line: { color: sun, width: 2 },
        },
        hovertemplate: `${SUN_WORDS[n.sunState]} (${Math.round(n.sunFrac * 100)} % of the disc)` +
          `<br>az ${fmt(n.sun.az)}°, alt ${fmt(n.sun.alt)}°<br>skyline there ` +
          `${fmt(n.skylineAtSun)}°<extra></extra>`,
      },
    );
  }
  return out;
}

function layout(m: SkyModel): Partial<Layout> {
  const base = plotLayout();
  return {
    ...base,
    xaxis: {
      ...base.xaxis,
      range: [0, 360],
      tickvals: [0, 45, 90, 135, 180, 225, 270, 315, 360],
      ticktext: ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW', 'N'],
      fixedrange: true,
      zeroline: false,
    },
    yaxis: {
      ...base.yaxis,
      range: [Y_BOTTOM, m.yTop],
      title: { text: 'Elevation (°)' },
      fixedrange: true,
    },
    showlegend: false,
  };
}

export function mount(el: HTMLElement): void {
  const title = document.createElement('h2');
  title.textContent = 'Sky';
  const note = document.createElement('p');
  note.className = 'muted sky-note';
  const chart = document.createElement('div');
  chart.className = 'sky-chart';
  el.replaceChildren(title, note, chart);

  let drawn = false;
  let lastKey = '';

  const render = (force = false): void => {
    const st = getState();
    if (!st.eph) {
      note.textContent = 'Loading';
      if (drawn) {
        Plotly.purge(chart);
        drawn = false;
      }
      lastKey = '';
      return;
    }
    const sc = selected();
    const key = `${sc.id}|${sc.site.lat},${sc.site.lon},${sc.site.eye_m ?? ''}|${sc.tMs}|` +
      `${st.dem ? 1 : 0}|${chart.clientWidth}x${chart.clientHeight}`;
    if (!force && key === lastKey) return;
    lastKey = key;

    const skyline = skylineFor(sc);
    const m = skyModel(samplesFor(sc, '30d'), skyline, sc.tMs);
    note.textContent = caption(m, skyline.terrain);

    const lay = layout(m);
    const margin = lay.margin ?? {};
    const plotH = chart.clientHeight - (margin.t ?? 0) - (margin.b ?? 0);
    const sunPx = sunMarkerPx(plotH, m.yTop, themeNumber('--space-2'));
    void Plotly.react(chart, traces(m, sunPx), lay, { displayModeBar: false, responsive: true });
    drawn = true;
  };

  subscribe(() => render());
  // The Sun marker's size depends on the chart's height, so redraw when the box changes.
  if (typeof ResizeObserver !== 'undefined') new ResizeObserver(() => render()).observe(chart);
  render(true);
}
