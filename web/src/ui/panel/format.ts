// How the panel writes the fractions core/panel.ts gives it. Pure, tested in node.

/** A 0..1 fraction of full power as a whole percentage. A sliver of power never reads 0 %. */
export function powerText(frac: number): string {
  if (!(frac > 0)) return '0 %';
  const p = Math.round(Math.min(1, frac) * 100);
  return p === 0 ? 'under 1 %' : `${p} %`;
}
