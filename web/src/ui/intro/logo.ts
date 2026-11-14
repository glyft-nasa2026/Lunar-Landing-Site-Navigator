// The Darksight mark: a ring with an orbit and its arrow tip (docs/design/mockup.html, T22).
// Drawn by the main page, the loading screen and the About bar, so all three show the same one.
// Colours come from logo.css: ring in --lit, orbit and tip in --accent.
import './logo.css';

const SVG_NS = 'http://www.w3.org/2000/svg';

export function logo(className = ''): SVGSVGElement {
  const svg = document.createElementNS(SVG_NS, 'svg');
  svg.setAttribute('viewBox', '0 0 100 100');
  svg.setAttribute('class', `ds-logo ${className}`.trim());
  svg.setAttribute('aria-hidden', 'true');
  const ring = document.createElementNS(SVG_NS, 'circle');
  ring.setAttribute('cx', '50');
  ring.setAttribute('cy', '50');
  ring.setAttribute('r', '36');
  ring.setAttribute('class', 'ring');
  const orbit = document.createElementNS(SVG_NS, 'path');
  orbit.setAttribute('d', 'M12 74 C2 88 30 92 60 74 C80 62 98 42 86 28');
  orbit.setAttribute('class', 'orbit');
  const tip = document.createElementNS(SVG_NS, 'path');
  tip.setAttribute('d', 'M78 20 L96 14 L90 32 Z');
  tip.setAttribute('class', 'tip');
  svg.append(ring, orbit, tip);
  return svg;
}
