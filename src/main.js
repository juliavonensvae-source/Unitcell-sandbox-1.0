/* Entry point: fonts and styles, the console self-check (development only), and a tiny hash router
   between the screens (title → mode select → Crystal Structures, Defects or Challenge mode). */
import '@fontsource/inter/400.css';
import '@fontsource/inter/500.css';
import '@fontsource/inter/600.css';
import '@fontsource/inter/700.css';
import '@fontsource/jetbrains-mono/400.css';
import '@fontsource/jetbrains-mono/500.css';
import '@fontsource/jetbrains-mono/600.css';
import './styles/tokens.css';
import './styles/base.css';
import './styles/screens.css';
import './styles/layout.css';
import './styles/objects.css';
import './styles/menus.css';
import './styles/flat.css';
import './styles/defects.css';
import 'katex/dist/katex.min.css';
import './styles/help.css';
import './styles/challenge.css';

import { runSelfCheck } from './verification/cases.js';
import { initTheme, toggleTheme } from './ui/theme.js';
import { createTitleScreen } from './ui/screens/title.js';
import { createModeSelect } from './ui/screens/mode-select.js';
import { CrystalWorkspace } from './ui/workspace/workspace.js';
import { DefectsWorkspace } from './ui/workspace/defects.js';
import { ChallengeScreen } from './ui/screens/challenge.js';
import { txt } from './text.js';

// Only for developers, in the browser console of npm run dev (npm test runs the same cases); never shown in the app.
if (import.meta.env.DEV) runSelfCheck(console);
initTheme();

// Visit counter: GoatCounter (no cookies, no personal data). Sign up at https://www.goatcounter.com and put
// your code here, e.g. 'unitcell' for unitcell.goatcounter.com. Left empty, nothing is counted. Only the posted site counts.
const GOATCOUNTER_CODE = 'julialurimp';
if (import.meta.env.PROD && GOATCOUNTER_CODE) {
  const s = document.createElement('script');
  s.async = true;
  s.src = 'https://gc.zgo.at/count.js';
  s.dataset.goatcounter = `https://${GOATCOUNTER_CODE}.goatcounter.com/count`;
  document.head.appendChild(s);
}

const app = document.getElementById('app');
const ROUTES = { '#/modes': 'modes', '#/crystal': 'crystal', '#/defects': 'defects', '#/challenge': 'challenge' };
const HASH = { title: '#/', modes: '#/modes', crystal: '#/crystal', defects: '#/defects', challenge: '#/challenge' };
const TITLES = {
  title: txt('tabTitleStart'), modes: txt('tabTitleModes'), crystal: txt('tabTitleCrystal'), defects: txt('tabTitleDefects'),
  challenge: txt('tabTitleChallenge'),
};
/** Screens built the first time they are opened (the two workspaces and Challenge mode). */
const WORKSPACES = { crystal: CrystalWorkspace, defects: DefectsWorkspace, challenge: ChallengeScreen };

const go = name => {
  if (location.hash !== HASH[name]) location.hash = HASH[name];
  else show(name);
};

const screens = {
  title: createTitleScreen({ onStart: () => go('modes') }),
  modes: createModeSelect({ onPick: mode => go(mode), onHome: () => go('title') }),
};
for (const s of Object.values(screens)) { s.el.inert = true; app.appendChild(s.el); }

function screen(name) {
  if (WORKSPACES[name] && !screens[name]) {
    const ws = new WORKSPACES[name]({ onHome: () => go('title') });
    ws.el.inert = true;
    ws.mount(app);
    screens[name] = ws;
  }
  return screens[name];
}

let current = null;
function show(name) {
  if (current === name) return;
  const next = screen(name);
  for (const [key, s] of Object.entries(screens)) {
    if (key === name) continue;
    s.el.classList.remove('is-active');
    s.el.inert = true;
    s.hide();
  }
  next.el.inert = false;
  requestAnimationFrame(() => next.el.classList.add('is-active'));
  next.show();
  current = name;
  document.title = TITLES[name];
}

window.addEventListener('hashchange', () => show(ROUTES[location.hash] || 'title'));
show(ROUTES[location.hash] || 'title');

// Theme toggles live on every screen
document.addEventListener('click', e => {
  if (e.target.closest('[data-act="theme"]')) toggleTheme();
});
