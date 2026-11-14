// How the readout writes the numbers core/ gives it (F3). Pure functions, tested in node.
// Nothing here computes an angle: it only rounds and labels.

/** Degrees to two decimals, with a true minus sign: "-1.25°". */
export function degText(v: number): string {
  const t = v.toFixed(2);
  return `${t === '-0.00' ? '0.00' : t.replace('-', '−')}°`;
}

/** Azimuth to one decimal with its compass point: "123.4° (SE)". Clockwise from north. */
export function azText(az: number): string {
  const a = ((az % 360) + 360) % 360;
  const points = ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'];
  const shown = Number(a.toFixed(1)) === 360 ? 0 : a;
  return `${shown.toFixed(1)}° (${points[Math.round(shown / 45) % 8]})`;
}

/** A 0..1 fraction as a whole percentage: "73 %". Never shows 0 % or 100 % for a sliver. */
export function pctText(frac: number): string {
  const f = Math.min(1, Math.max(0, frac));
  let p = Math.round(f * 100);
  if (p === 0 && f > 0) p = 1;
  if (p === 100 && f < 1) p = 99;
  return `${p} %`;
}
