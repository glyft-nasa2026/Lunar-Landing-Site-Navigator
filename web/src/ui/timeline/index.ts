// Timeline chart with scrubber (F8, T10). Sun and Earth height above the terrain skyline over the
// selected scenario's timeline window, the part below zero shaded, and a marker at the scenario's
// time. Clicking or dragging on the chart sets the live time. Every number comes from core/
// through state.ts.
import './timeline.css';
import Plotly from 'plotly.js-dist-min';
import type { Data, Layout, Shape } from 'plotly.js-dist-min';
import {
  flipFor, getState, LIVE_ID, selected, setLiveTime, setRange, shiftWindow, subscribe,
  timelineFor, type Range, type Scenario,
} from '../../state';
import type { Sample } from '../../core/types';
import { plotLayout, themeColor } from '../plotTheme';
import { emptyNote, plotTime, throttle, timeAtPx, timelineModel, type TimelineModel } from './model';

const RANGES: { r: Range; text: string }[] = [
  { r: '30d', text: '30 d' },
  { r: '90d', text: '90 d' },
  { r: '365d', text: '1 yr' },
];

const ISO = (tMs: number): string => new Date(tMs).toISOString().slice(0, 16).replace('T', ' ');

function button(text: string, onClick: () => void): HTMLButtonElement {
  const b = document.createElement('button');
  b.type = 'button';
  b.className = 'btn';
  b.textContent = text;
  b.addEventListener('click', onClick);
  return b;
}

function legendItem(colorVar: string, text: string, cls: string): HTMLSpanElement {
  const span = document.createElement('span');
  const swatch = document.createElement('i');
  swatch.className = cls;
  swatch.style.background = `var(${colorVar})`;
  span.append(swatch, text);
  return span;
}

// Every time handed to Plotly goes through plotTime: a zone-less UTC string, which Plotly shows
// as written. A number would be shown in the browser's local time under a label that says UTC.
function traces(m: TimelineModel): Data[] {
  return [
    {
      name: 'Earth',
      x: m.earth.x.map(plotTime), y: m.earth.y,
      type: 'scatter', mode: 'lines',
      line: { color: themeColor('--earth'), width: 2 },
      hovertemplate: 'Earth %{y:.2f}°<extra></extra>',
    },
    {
      name: 'Sun',
      x: m.sun.x.map(plotTime), y: m.sun.y,
      type: 'scatter', mode: 'lines',
      line: { color: themeColor('--sun'), width: 2 },
      hovertemplate: 'Top of the Sun %{y:.2f}°<extra></extra>',
    },
  ];
}

function layout(m: TimelineModel, startMs: number, endMs: number, markerMs: number): Partial<Layout> {
  const base = plotLayout();
  const accent = themeColor('--accent');
  const r = m.yMax;
  const marker = plotTime(markerMs);
  const shapes: Partial<Shape>[] = [
    // Below the skyline: hidden.
    {
      type: 'rect', layer: 'below', xref: 'paper', yref: 'y',
      x0: 0, x1: 1, y0: -r, y1: 0,
      fillcolor: themeColor('--dark'), opacity: 0.35, line: { width: 0 },
    },
    {
      type: 'line', xref: 'paper', yref: 'y', x0: 0, x1: 1, y0: 0, y1: 0,
      line: { color: themeColor('--muted'), width: 1, dash: 'dash' },
    },
    {
      type: 'line', xref: 'x', yref: 'paper', x0: marker, x1: marker, y0: 0, y1: 1,
      line: { color: accent, width: 2 },
    },
    {
      type: 'circle', xref: 'x', yref: 'paper', xsizemode: 'pixel', ysizemode: 'pixel',
      xanchor: marker, yanchor: 1, x0: -5, x1: 5, y0: -5, y1: 5,
      fillcolor: accent, line: { width: 0 },
    },
  ];
  return {
    ...base,
    xaxis: {
      ...base.xaxis,
      type: 'date',
      range: [plotTime(startMs), plotTime(endMs)],
      fixedrange: true,
      showgrid: false,
      zeroline: false,
      hoverformat: '%Y-%m-%d %H:%M UTC',
    },
    yaxis: {
      ...base.yaxis,
      range: [-r, r],
      dtick: r > 16 ? undefined : 4,
      ticksuffix: '°',
      fixedrange: true,
      zeroline: false,
    },
    shapes,
    dragmode: false,
    hovermode: 'x unified',
    showlegend: false,
  };
}

/** Plotly's plot area: its left edge and width in pixels inside the chart box. */
function plotArea(chart: HTMLElement): { left: number; width: number } | null {
  const xa = (chart as unknown as { _fullLayout?: { xaxis?: { _offset: number; _length: number } } })
    ._fullLayout?.xaxis;
  return xa && xa._length > 0 ? { left: xa._offset, width: xa._length } : null;
}

export function mount(el: HTMLElement): void {
  const title = document.createElement('h2');
  const head = document.createElement('div');
  head.className = 'timeline-head';
  const buttons = document.createElement('div');
  buttons.className = 'timeline-buttons';
  buttons.setAttribute('role', 'group');
  buttons.setAttribute('aria-label', 'Timeline range');

  const earlier = button('← Earlier', () => shiftWindow(-1));
  const later = button('Later →', () => shiftWindow(1));
  const rangeBtns = RANGES.map(({ r, text }) => {
    const b = button(text, () => setRange(r));
    b.dataset.range = r;
    return b;
  });
  buttons.append(earlier, ...rangeBtns, later);
  head.append(title, buttons);

  const note = document.createElement('p');
  note.className = 'muted timeline-note';
  const chart = document.createElement('div');
  chart.className = 'timeline-chart';
  chart.setAttribute('aria-label', 'Timeline chart. Click or drag to set the time.');
  const legend = document.createElement('div');
  legend.className = 'timeline-legend muted';
  legend.append(
    legendItem('--sun', 'Sun (top of the disc)', 'timeline-swatch'),
    legendItem('--earth', 'Earth', 'timeline-swatch'),
    legendItem('--dark', 'Hidden (below skyline)', 'timeline-swatch timeline-swatch-area'),
  );
  el.replaceChildren(head, note, chart, legend);

  let drawn = false;
  // The traces are rebuilt only when the lines change. Plotly.react compares arrays by reference,
  // so a drag, which changes only the marker, redraws the marker and leaves the lines alone.
  let dataKey = '';
  let model: TimelineModel | null = null;
  let plotted: Data[] = [];
  let lastKey = '';
  let windowMs: [number, number] = [0, 0];

  const clear = (text: string): void => {
    note.textContent = text;
    if (drawn) {
      Plotly.purge(chart);
      drawn = false;
    }
    dataKey = lastKey = '';
  };

  const render = (): void => {
    const st = getState();
    const sc: Scenario = selected();
    const isLive = sc.id === LIVE_ID;
    title.textContent = `Timeline · ${sc.label} · degrees above the skyline`;
    for (const b of rangeBtns) b.setAttribute('aria-pressed', String(b.dataset.range === st.range));
    // Earlier and Later move the live scenario's window; a pinned one's starts at its own time.
    earlier.disabled = later.disabled = !isLive || !st.eph;

    if (!st.eph) return clear('Loading');
    const samples: Sample[] = timelineFor(sc, st.range);
    if (samples.length < 2) {
      // Too few hours for a chart, and not a wait: say why (model.ts, emptyNote).
      const from = isLive ? st.windowStartMs : sc.tMs;
      return clear(emptyNote(samples.length, from, st.eph.startMs, st.eph.endMs));
    }

    const startMs = samples[0].tMs;
    const endMs = samples[samples.length - 1].tMs;
    windowMs = [startMs, endMs];
    const key = `${sc.id}|${sc.site.lat},${sc.site.lon},${sc.site.eye_m ?? ''}|${startMs}|${endMs}|` +
      `${st.dem ? 1 : 0}`;
    if (key !== dataKey || !model) {
      dataKey = key;
      model = timelineModel(samples, (t, body) => flipFor({ ...sc, tMs: t }, body));
      plotted = traces(model);
    }
    note.textContent = `${ISO(startMs)} to ${ISO(endMs)} UTC.` +
      (isLive ? ' Click or drag on the chart to set the time.' : ` Pinned: starts at ${sc.label}'s time. ` +
        'A click sets the live scenario.');

    const fullKey = `${key}|${sc.tMs}|${chart.clientWidth}x${chart.clientHeight}`;
    if (fullKey === lastKey && drawn) return;
    lastKey = fullKey;
    void Plotly.react(chart, plotted, layout(model, startMs, endMs, sc.tMs), {
      displayModeBar: false, responsive: true, scrollZoom: false, doubleClick: false,
    });
    drawn = true;
  };

  // Click and drag: one setLiveTime per frame at most, so dragging stays smooth.
  const scrub = throttle<number>((t) => setLiveTime(t), (cb) => requestAnimationFrame(cb));
  let dragging: number | null = null;
  const timeAt = (e: PointerEvent): number | null => {
    const area = plotArea(chart);
    if (!drawn || !area) return null;
    const px = e.clientX - chart.getBoundingClientRect().left - area.left;
    return timeAtPx(px, area.width, windowMs[0], windowMs[1]);
  };
  chart.addEventListener('pointerdown', (e) => {
    if (e.button !== 0) return;
    const t = timeAt(e);
    if (t === null) return;
    if (selected().id !== LIVE_ID) {
      // A pinned scenario's chart. Setting the live time selects live, and the chart swaps to
      // the live window, so a pointer move after this press would be read in a window the press
      // was not made in. One press sets the time once and is never the start of a drag.
      setLiveTime(t);
      return;
    }
    dragging = e.pointerId;
    chart.setPointerCapture(e.pointerId);
    scrub.push(t);
  }, true);
  chart.addEventListener('pointermove', (e) => {
    if (dragging !== e.pointerId) return;
    const t = timeAt(e);
    if (t !== null) scrub.push(t);
  }, true);
  const end = (e: PointerEvent): void => {
    if (dragging !== e.pointerId) return;
    dragging = null;
    scrub.flush();
  };
  chart.addEventListener('pointerup', end, true);
  chart.addEventListener('pointercancel', end, true);

  subscribe(() => render());
  if (typeof ResizeObserver !== 'undefined') new ResizeObserver(() => render()).observe(chart);
  render();
}
