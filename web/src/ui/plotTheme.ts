// Chart style and theme colours for JavaScript (docs/data-contract.md section 6).
// T00 made both functions; T19 owns this file. Every value is read from theme.css, so there is
// no second copy of a colour.

import type { Layout } from 'plotly.js-dist-min';

/**
 * The current value of a theme variable: themeColor('--sun'), themeColor(sc.color).
 * Plotly and three.js can't read var(--sun); they need the real value.
 */
export function themeColor(name: string): string {
  return getComputedStyle(document.documentElement).getPropertyValue(name).trim();
}

/** A theme length ('0.8rem', '12px') as a number of pixels, which is what Plotly wants. */
function themePx(name: string): number {
  const raw = themeColor(name);
  const value = parseFloat(raw);
  if (!Number.isFinite(value)) return 0;
  if (raw.endsWith('rem')) {
    return value * parseFloat(getComputedStyle(document.documentElement).fontSize);
  }
  return value;
}

/**
 * Every Plotly chart spreads this into its layout: { ...plotLayout(), title: ... }.
 * The look follows the design's diagrams: the chart sits on its card, slate grid lines,
 * small fixed-width tick labels in the secondary text colour.
 */
export function plotLayout(): Partial<Layout> {
  const grid = themeColor('--border');
  const muted = themeColor('--muted');
  const num = themeColor('--font-num');
  const small = themePx('--fs-sm');
  const axis = {
    gridcolor: grid,
    linecolor: grid,
    zerolinecolor: grid,
    tickcolor: grid,
    tickfont: { family: num, size: small, color: muted },
    title: { font: { size: small, color: muted } },
    automargin: true,
  };
  const gap = themePx('--space-5');
  return {
    paper_bgcolor: themeColor('--panel'),
    plot_bgcolor: themeColor('--panel'),
    font: {
      family: themeColor('--font'),
      size: small,
      color: themeColor('--text'),
    },
    margin: { l: gap * 2, r: gap, t: gap, b: gap * 2 },
    xaxis: { ...axis },
    yaxis: { ...axis },
    showlegend: true,
    legend: { orientation: 'h', font: { family: num, size: small, color: muted } },
    hoverlabel: {
      bgcolor: themeColor('--panel-2'),
      bordercolor: grid,
      font: { family: num, size: small, color: themeColor('--text') },
    },
  };
}
