// Main page and loading screen, after docs/design/hero.png and loading.png (T22).
// A full-screen layer over the site, in this order:
//   1. The main page, as soon as the site opens. The data files start loading behind it.
//   2. "Start exploring": if the data is still loading, the loading screen shows how far it is.
//   3. When every file has loaded (or failed: the page's status line says which), the site.
// Not a slot of contract section 5: main.ts starts it and feeds it the loading progress.
import './intro.css';
import { allSettled, loadFraction, type LoadProgress } from './model';

function make<K extends keyof HTMLElementTagNameMap>(
  tag: K, className = '', text = '',
): HTMLElementTagNameMap[K] {
  const el = document.createElement(tag);
  if (className) el.className = className;
  if (text) el.textContent = text;
  return el;
}

const SVG_NS = 'http://www.w3.org/2000/svg';

/** The Darksight mark: a ring with an orbit and its arrow tip. Colours come from intro.css. */
function logo(className: string): SVGSVGElement {
  const svg = document.createElementNS(SVG_NS, 'svg');
  svg.setAttribute('viewBox', '0 0 100 100');
  svg.setAttribute('class', `intro-logo ${className}`);
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

/** A still star field: decorative, placed in percent so it fits any screen. */
function stars(count: number): HTMLElement {
  const field = make('div', 'intro-stars');
  field.setAttribute('aria-hidden', 'true');
  for (let i = 0; i < count; i++) {
    const star = make('span', 'intro-star');
    star.style.left = `${(i * 61.8) % 100}%`;
    star.style.top = `${(i * 37.3 + 11) % 100}%`;
    star.style.opacity = String(0.15 + (i % 3) * 0.1);
    field.append(star);
  }
  return field;
}

/** 1. The main page, with the button that moves on. */
function mainPage(onStart: () => void): HTMLElement {
  const page = make('section', 'intro-hero');
  const glow = make('div', 'intro-glow');
  glow.setAttribute('aria-hidden', 'true');
  const mark = make('div', 'intro-mark');
  const word = make('span', 'intro-wordmark');
  word.append('DARK', make('br'), 'SIGHT');
  mark.append(logo('intro-logo-sm'), word);
  const title = make('h1', 'intro-title', 'DARKSIGHT');
  const sub = make('p', 'intro-sub');
  sub.append('Lunar Landing', make('br'), 'Site Navigator');
  const start = make('button', 'btn intro-start', 'Start exploring →');
  start.type = 'button';
  start.addEventListener('click', onStart);
  const text = make('div', 'intro-text');
  text.append(title, sub, start);
  page.append(glow, logo('intro-logo-big'), mark, text);
  return page;
}

export interface Intro {
  /** Called by main.ts whenever a data file makes progress, loads or fails. */
  update(progress: LoadProgress): void;
}

export function startIntro(): Intro {
  const root = make('div', 'intro');
  root.setAttribute('role', 'dialog');
  root.setAttribute('aria-modal', 'true');
  root.setAttribute('aria-label', 'Darksight: Lunar Landing Site Navigator');

  // 2. The loading screen, built now and shown after "Start exploring" if the data isn't in yet.
  const loading = make('div', 'intro-loading');
  const bar = make('div', 'intro-bar');
  const fill = make('span');
  bar.append(fill);
  bar.setAttribute('role', 'progressbar');
  bar.setAttribute('aria-valuemin', '0');
  bar.setAttribute('aria-valuemax', '100');
  bar.setAttribute('aria-label', 'Lunar data loaded');
  const caption = make('p', 'intro-caption', 'INITIALISING LUNAR DATA…');
  caption.setAttribute('aria-live', 'polite');
  loading.append(logo('intro-logo-pulse'), bar, caption);

  let latest: LoadProgress | null = null;
  let started = false;
  let closed = false;

  function drawProgress(): void {
    const pct = latest ? Math.round(loadFraction(latest) * 100) : 0;
    fill.style.width = `${pct}%`;
    bar.setAttribute('aria-valuenow', String(pct));
    caption.textContent = `INITIALISING LUNAR DATA… ${pct}%`;
  }

  // 3. The site.
  function close(): void {
    if (closed) return;
    closed = true;
    root.classList.add('intro-closing');
    document.body.classList.remove('intro-open');
    const remove = (): void => root.remove();
    // The fade lasts as long as intro.css says; under reduced motion there is none.
    if (matchMedia('(prefers-reduced-motion: reduce)').matches) remove();
    else {
      root.addEventListener('transitionend', remove, { once: true });
      setTimeout(remove, 1000); // in case the transition never fires
    }
  }

  const page = mainPage(() => {
    started = true;
    if (latest && allSettled(latest)) {
      close();
      return;
    }
    drawProgress();
    page.replaceWith(loading);
    bar.focus();
  });
  bar.tabIndex = -1; // focus moves here from the button, so screen readers follow the progress

  root.append(stars(60), page);
  document.body.append(root);
  document.body.classList.add('intro-open');
  page.querySelector<HTMLButtonElement>('.intro-start')?.focus();

  return {
    update(progress: LoadProgress): void {
      latest = progress;
      if (closed || !started) return;
      drawProgress();
      if (allSettled(progress)) close();
    },
  };
}
