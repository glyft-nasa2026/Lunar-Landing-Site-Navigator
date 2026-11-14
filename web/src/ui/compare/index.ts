// Compare (T09): F6 table, a Live column then one column per pinned scenario, and F7 strips, Sun and Earth bars
// over days 0-30 since each scenario's own time. Every number comes from state.ts accessors,
// which call core/; model.ts only groups, ranks and formats them.
import './compare.css';
import type { Data, Layout } from 'plotly.js-dist-min';
import type { Body, Sample } from '../../core/types';
import { countdownText } from '../../core/windows';
import {
  flipFor, getState, neverLitFor, samplesFor, subscribe, summaryFor, type AppState, type Scenario,
} from '../../state';
import { plotLayout, themeColor } from '../plotTheme';
import { best, countdownScore, daysCovered, discPctText, hoursText, pctText, runs } from './model';

const SPAN_DAYS = 30;

type PlotlyLib = (typeof import('plotly.js-dist-min'))['default'];
// Plotly is large; loading it on first use lets the table show before it arrives.
let plotly: Promise<PlotlyLib> | null = null;
const loadPlotly = (): Promise<PlotlyLib> => {
  // The package is a UMD bundle: the bundler hands it over as the default export.
  plotly ??= import('plotly.js-dist-min').then((m) => m.default ?? (m as unknown as PlotlyLib));
  return plotly;
};

function make<K extends keyof HTMLElementTagNameMap>(
  tag: K, className = '', text = '',
): HTMLElementTagNameMap[K] {
  const el = document.createElement(tag);
  if (className) el.className = className;
  if (text) el.textContent = text;
  return el;
}

function utcText(tMs: number): string {
  return new Date(tMs).toISOString().slice(0, 16).replace('T', ' ');
}

/**
 * What one column shows. `now` is null when the scenario's time has no sample. `days` is how
 * much of the 30 days after it the table covers: less than 30 near the table's end.
 */
type Column = {
  sc: Scenario;
  now: Sample | null;
  sunUp: boolean;
  earthUp: boolean;
  days: number;
};

/** One table row: the text in each column and, if it has one, the number to rank by. */
type Row = { name: string; cells: string[]; values: (number | null)[]; higherIsBetter: boolean };

function countdownRow(name: string, body: Body, cols: Column[]): Row {
  const cells: string[] = [];
  const values: (number | null)[] = [];
  for (const c of cols) {
    if (!c.now) { cells.push('–'); values.push(null); continue; }
    const up = body === 'sun' ? c.sunUp : c.earthUp;
    const flip = flipFor(c.sc, body);
    cells.push(countdownText(body, up, flip, c.sc.tMs, body === 'sun' && neverLitFor(c.sc)));
    values.push(countdownScore(up, flip, c.sc.tMs));
  }
  return { name, cells, values, higherIsBetter: true };
}

function buildRows(cols: Column[]): Row[] {
  // The five 30-day rows need all 30 days. On a shorter series the figures would be ranked as
  // if they were whole: a site with 7 days of table left read "Longest dark 7 d 0 h (best)".
  const sums = cols.map((c) => (c.now && c.days >= SPAN_DAYS ? summaryFor(c.sc) : null));
  const sumRow = (
    name: string, pick: (s: NonNullable<(typeof sums)[number]>) => number,
    text: (v: number) => string, higherIsBetter: boolean,
  ): Row => ({
    name,
    cells: sums.map((s) => (s ? text(pick(s)) : '–')),
    values: sums.map((s) => (s ? pick(s) : null)),
    higherIsBetter,
  });

  return [
    {
      name: 'Sun now',
      cells: cols.map((c) => (!c.now ? '–' : c.sunUp ? `Lit, ${discPctText(c.now.sunFrac)} of disc` : 'Dark')),
      values: cols.map((c) => c.now?.sunFrac ?? null),
      higherIsBetter: true,
    },
    countdownRow('Sunset in', 'sun', cols),
    {
      name: 'Earth now',
      cells: cols.map((c) => (!c.now ? '–' : c.earthUp ? 'Visible' : 'Hidden')),
      values: cols.map((c) => (c.now ? (c.earthUp ? 1 : 0) : null)),
      higherIsBetter: true,
    },
    countdownRow('Earthset in', 'earth', cols),
    sumRow('Lit % (next 30 days)', (s) => s.litPct, pctText, true),
    sumRow('Longest unbroken light', (s) => s.longestLit_h, hoursText, true),
    sumRow('Longest dark', (s) => s.longestDark_h, hoursText, false),
    sumRow('Earth contact %', (s) => s.earthPct, pctText, true),
    sumRow('Longest gap in contact', (s) => s.longestEarthGap_h, hoursText, false),
  ];
}

function drawTable(cols: Column[]): HTMLTableElement {
  const table = make('table', 'table cmp-table');
  const cap = make('caption', 'cmp-hidden', 'The live scenario and the pinned ones side by side. The best value in each row is marked.');
  const head = make('thead');
  const hr = make('tr');
  hr.append(make('th', '', ''));
  for (const c of cols) {
    const th = make('th', 'cmp-col');
    th.scope = 'col';
    th.style.setProperty('--scn-color', `var(${c.sc.color})`);
    const dot = make('span', 'cmp-dot');
    dot.setAttribute('aria-hidden', 'true');
    const site = getState().sites.find(
      (x) => Math.abs(x.lat - c.sc.site.lat) < 1e-6 && Math.abs(x.lon - c.sc.site.lon) < 1e-6);
    const where = site?.name ?? `${c.sc.site.lat.toFixed(4)}°, ${c.sc.site.lon.toFixed(4)}°`;
    th.append(
      dot, make('span', 'cmp-label', c.sc.label),
      make('span', 'cmp-where', where),
      make('span', 'cmp-when muted', `${utcText(c.sc.tMs)} UTC`),
    );
    hr.append(th);
  }
  head.append(hr);

  const body = make('tbody');
  for (const row of buildRows(cols)) {
    const tr = make('tr');
    const th = make('th', 'cmp-row', row.name);
    th.scope = 'row';
    tr.append(th);
    const top = best(row.values, row.higherIsBetter);
    row.cells.forEach((text, i) => {
      const td = make('td', '', text);
      if (top.has(i)) {
        td.classList.add('cmp-best');
        td.title = 'Best in this row';
        td.append(make('span', 'cmp-hidden', ' (best)'));
      }
      tr.append(td);
    });
    body.append(tr);
  }
  table.append(cap, head, body);
  return table;
}

/**
 * Plotly traces: a dark background bar for every row, then the filled runs on top. The dark
 * bar is as long as the days the table covers, so days with no data are left empty, not shown
 * as hidden.
 */
function stripData(cols: Column[]): { data: Data[]; rows: string[] } {
  const rows: string[] = [];
  const data: Data[] = [];
  const dark = themeColor('--dark');
  for (const c of cols) rows.push(`${c.sc.label} Sun`, `${c.sc.label} Earth`);

  data.push({
    type: 'bar', orientation: 'h', name: 'Hidden',
    y: rows, x: cols.flatMap((c) => [c.days, c.days]), base: rows.map(() => 0),
    marker: { color: dark }, hoverinfo: 'skip', showlegend: false,
  });

  for (const c of cols) {
    const samples = samplesFor(c.sc, '30d');
    const colour = themeColor(c.sc.color);
    const bodies: [Body, string, (s: Sample) => boolean, number][] = [
      ['sun', 'Sun', (s) => s.sunFrac > 0, 1],
      ['earth', 'Earth', (s) => s.earthUp, 0.5],
    ];
    for (const [body, name, up, opacity] of bodies) {
      const rs = runs(samples, up, c.sc.tMs, flipFor(c.sc, body), SPAN_DAYS);
      const label = `${c.sc.label} ${name}`;
      data.push({
        type: 'bar', orientation: 'h', name: label,
        y: rs.map(() => label), base: rs.map((r) => r.from), x: rs.map((r) => r.to - r.from),
        marker: { color: colour, opacity },
        hovertemplate: `${label} ${body === 'sun' ? 'lit' : 'visible'}: day %{base:.2f} to %{customdata:.2f}<extra></extra>`,
        customdata: rs.map((r) => r.to),
        showlegend: false,
      } as Data);
    }
  }
  return { data, rows };
}

/** `width` is the strips box's own width, measured just before drawing. */
function stripLayout(rows: string[], width: number): Partial<Layout> {
  const base = plotLayout();
  const rem = parseFloat(getComputedStyle(document.documentElement).fontSize) || 16;
  return {
    ...base,
    width,
    height: (rows.length * 2 + 5) * rem,
    barmode: 'overlay',
    bargap: 0.3,
    showlegend: false,
    xaxis: {
      ...base.xaxis, range: [0, SPAN_DAYS], dtick: 5, fixedrange: true,
      title: { text: "Days since each scenario's own time" },
    },
    yaxis: {
      ...base.yaxis, type: 'category', categoryorder: 'array', categoryarray: rows,
      autorange: 'reversed', fixedrange: true, showgrid: false, automargin: true,
    },
  };
}

export function mount(el: HTMLElement): void {
  const title = make('h2', '', 'Compare scenarios');
  const message = make('p', 'muted');
  const tableWrap = make('div', 'cmp-table-wrap');
  const stripsTitle = make('h3', 'cmp-sub', 'Sun and Earth, next 30 days');
  const strips = make('div', 'cmp-strips');
  strips.setAttribute('role', 'img');
  const NOTE = 'Filled where the Sun or Earth is up. Solid bar: Sun. Lighter bar: Earth.';
  const NOTE_SHORT = ' A dash, or a strip that stops early: the Sun and Earth table has fewer than 30 days after that time.';
  const note = make('p', 'cmp-note muted', NOTE);
  const hint = make('p', 'muted', 'Pin a scenario to compare');
  el.replaceChildren(title, message, tableWrap, hint, stripsTitle, strips, note);

  type Shown = {
    live: Scenario; pinned: Scenario[]; eph: AppState['eph']; dem: AppState['dem']; sites: AppState['sites'];
  };
  let shown: Shown | null = null;
  let drawId = 0;
  let frame = 0;
  // The strips last drawn, and the width they were drawn at, so a resize can draw them again.
  let plotted: { data: Data[]; rows: string[] } | null = null;
  let plottedWidth = 0;

  // Plotly sizes a plot to its box only on the first draw: later draws without a width keep
  // the old one, so the strips stuck at one width and spilled over the page (#49). Every draw
  // therefore passes the box's width as measured now.
  const plot = (id: number): void => {
    void loadPlotly().then((P) => {
      if (id !== drawId || !plotted || strips.hidden) return;
      plottedWidth = Math.floor(strips.getBoundingClientRect().width);
      void P.react(strips, plotted.data, stripLayout(plotted.rows, plottedWidth), { displayModeBar: false });
    });
  };

  const showParts = (on: boolean): void => {
    tableWrap.hidden = !on;
    stripsTitle.hidden = !on;
    strips.hidden = !on;
    note.hidden = !on;
  };

  const draw = (): void => {
    frame = 0;
    const s = getState();
    // Pinned scenarios never change, but live does on every map click, time entry and drag.
    if (shown && shown.live === s.live && shown.pinned === s.pinned && shown.eph === s.eph
      && shown.dem === s.dem && shown.sites === s.sites) return;
    shown = { live: s.live, pinned: s.pinned, eph: s.eph, dem: s.dem, sites: s.sites };
    const id = ++drawId;

    if (!s.eph) {
      message.textContent = 'Loading';
      message.hidden = false;
      hint.hidden = true;
      showParts(false);
      tableWrap.replaceChildren();
      plotted = null;
      void loadPlotly().then((P) => { if (id === drawId) P.purge(strips); });
      return;
    }

    const cols: Column[] = [s.live, ...s.pinned].map((sc) => {
      const samples = samplesFor(sc, '30d');
      const first = samples[0];
      const now = first && first.tMs === sc.tMs ? first : null;
      return {
        sc, now, sunUp: !!now && now.sunFrac > 0, earthUp: !!now && now.earthUp,
        days: Math.min(SPAN_DAYS, daysCovered(samples)),
      };
    });
    note.textContent = NOTE + (cols.some((c) => c.days < SPAN_DAYS) ? NOTE_SHORT : '');

    message.hidden = true;
    hint.hidden = s.pinned.length > 0;
    showParts(true);
    tableWrap.replaceChildren(drawTable(cols));
    strips.setAttribute('aria-label',
      `Strips for ${cols.map((c) => c.sc.label).join(', ')}: when the Sun and Earth are up over the next 30 days`);

    plotted = stripData(cols);
    plot(id);
  };

  // A timeline drag changes live many times a frame: draw at most once per animation frame.
  const render = (): void => {
    if (!frame) frame = requestAnimationFrame(draw);
  };

  subscribe(render);
  // Redraw the strips when the box's width changes, at most once per animation frame. Height
  // changes are skipped: drawing the strips changes the box's height itself.
  let resizeFrame = 0;
  if (typeof ResizeObserver !== 'undefined') {
    new ResizeObserver(() => {
      if (resizeFrame || !plotted) return;
      resizeFrame = requestAnimationFrame(() => {
        resizeFrame = 0;
        if (Math.floor(strips.getBoundingClientRect().width) !== plottedWidth) plot(drawId);
      });
    }).observe(strips);
  }
  render();
}
