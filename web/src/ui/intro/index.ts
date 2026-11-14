// Loading screen and main page, after docs/design/loading.png and hero.png (T22).
// A full-screen layer over the site: it shows how far the data files have loaded, then, for a
// plain link, the main page with "Start exploring". It never blocks the site for good: "Skip"
// and Escape close it at any time, and a file that fails to load still lets it finish.
// Not a slot of contract section 5: main.ts starts it and feeds it the loading progress.
import './intro.css';
import { allSettled, loadFraction, showHero, type LoadProgress } from './model';

// Read before state.ts writes the scenarios into the address.
const HASH_AT_START = typeof window !== 'undefined' ? window.location.hash : '';
const SEEN_KEY = 'darksight-intro-seen';

function seenThisTab(): boolean {
  try {
    return sessionStorage.getItem(SEEN_KEY) === '1';
  } catch {
    return false;
  }
}

function markSeen(): void {
  try {
    sessionStorage.setItem(SEEN_KEY, '1');
  } catch {
    // Private windows may refuse storage: the main page then shows again next time.
  }
}

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

export interface Intro {
  /** Called by main.ts whenever a data file makes progress, loads or fails. */
  update(progress: LoadProgress): void;
}

export function startIntro(): Intro {
  const hero = showHero(HASH_AT_START, seenThisTab());
  const root = make('div', 'intro');
  root.setAttribute('role', 'dialog');
  root.setAttribute('aria-modal', 'true');
  root.setAttribute('aria-label', 'Darksight: Lunar Landing Site Navigator');

  // Loading view
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
  const skip = make('button', 'btn intro-skip', 'Skip');
  skip.type = 'button';
  loading.append(logo('intro-logo-pulse'), bar, caption, skip);
  root.append(stars(60), loading);

  document.body.append(root);
  document.body.classList.add('intro-open');
  skip.focus();

  let closed = false;
  let heroShown = false;

  function close(): void {
    if (closed) return;
    closed = true;
    markSeen();
    document.removeEventListener('keydown', onKey);
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

  function onKey(e: KeyboardEvent): void {
    if (e.key === 'Escape') close();
  }
  document.addEventListener('keydown', onKey);
  skip.addEventListener('click', close);

  function showMainPage(): void {
    heroShown = true;
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
    start.addEventListener('click', close);
    const text = make('div', 'intro-text');
    text.append(title, sub, start);
    page.append(glow, logo('intro-logo-big'), mark, text);
    loading.replaceWith(page);
    start.focus();
  }

  return {
    update(progress: LoadProgress): void {
      if (closed || heroShown) return;
      const pct = Math.round(loadFraction(progress) * 100);
      fill.style.width = `${pct}%`;
      bar.setAttribute('aria-valuenow', String(pct));
      caption.textContent = `INITIALISING LUNAR DATA… ${pct}%`;
      if (allSettled(progress)) {
        if (hero) showMainPage();
        else close();
      }
    },
  };
}
