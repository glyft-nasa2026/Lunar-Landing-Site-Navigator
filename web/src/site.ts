// The site's modules, one per slot (docs/data-contract.md section 5). main.ts mounts them.
// This file is loaded only after "Start exploring", so the module code (with Plotly and
// three.js, about 5 MB) is fetched and run behind the loading screen, never while the main page
// is animating. A task that adds a slot adds it here.

import { mount as mountScene } from './scene/index';
import { mount as mountAbout } from './ui/about/index';
import { mount as mountCompare } from './ui/compare/index';
import { mount as mountNudge } from './ui/nudge/index';
import { mount as mountPanel } from './ui/panel/index';
import { mount as mountReadout } from './ui/readout/index';
import { mount as mountScenarios } from './ui/scenarios/index';
import { mount as mountSky } from './ui/sky/index';
import { mount as mountTimeline } from './ui/timeline/index';

// The scene comes before nudge: it makes the #nudge slot inside its map viewport (issue #58).
export const slots: [id: string, mount: (el: HTMLElement) => void][] = [
  ['about', mountAbout],
  ['scene', mountScene],
  ['scenarios', mountScenarios],
  ['readout', mountReadout],
  ['nudge', mountNudge],
  ['panel', mountPanel],
  ['compare', mountCompare],
  ['timeline', mountTimeline],
  ['sky', mountSky],
];
