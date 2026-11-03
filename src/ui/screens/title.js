/* Title screen: app name, tagline, Start, and a rotating lattice behind it all. */
import { TitleBackground } from '../../render/title-background.js';
import { h } from '../dom.js';
import { icon } from '../icons.js';
import { themeButton, cssVar, onThemeChange, getTheme } from '../theme.js';
import { txt } from '../../text.js';

/** A box under the title card that opens on click; its text is written by hand in text/01-start.txt. */
const titleBox = (ic, title, body) => `<details class="title-box">
        <summary>${icon(ic)}<span class="title-box-name">${title}</span><span class="cat-chev">${icon('chevronDown')}</span></summary>
        <div class="title-box-body">${body}</div>
      </details>`;

export function createTitleScreen({ onStart }) {
  // footer entries left empty in text/01-start.txt are skipped, and with none the footer is left out
  const foot = ['startFootSystems', 'startFootLattices', 'startFootObjects'].map(n => txt(n)).filter(Boolean);
  const el = h(`<section class="screen title-screen" data-screen="title" aria-label="${txt('startScreenLabel')}">
    <div class="title-stage"><canvas class="title-canvas" aria-hidden="true"></canvas></div>
    <header class="screen-top title-top">${themeButton('icon-btn-lg on-glass')}</header>
    <div class="title-content"><div class="title-main"><div class="title-card">
      <p class="title-kicker"><span class="kicker-dot"></span>${txt('startKicker')}</p>
      <h1 class="title-name">${txt('startTitle')}</h1>
      <p class="title-tagline">${txt('startTagline')}</p>
      <button type="button" class="btn-start" data-act="start">${icon('play')}<span>${txt('startButton')}</span></button>
      <p class="title-hint">${txt('startHint')}</p>
    </div>
    <div class="title-boxes">
      ${titleBox('info', txt('startInfoTitle'), txt('startInfoText'))}
      ${titleBox('list', txt('startNewsTitle'), txt('startNewsText'))}
    </div></div></div>
    ${foot.length ? `<footer class="title-foot">${foot.map(t => `<span>${t}</span>`).join('<span class="dot-sep"></span>')}</footer>` : ''}
  </section>`);

  let bg = null;
  try {
    bg = new TitleBackground(el.querySelector('.title-canvas'));
  } catch (err) {
    console.warn('Title background disabled:', err.message);
  }
  const applyTheme = () => bg && bg.setTheme({
    fog: cssVar('--bg'), corner: cssVar('--ink-2'), face: cssVar('--primary'), line: cssVar('--cell-line'), dark: getTheme() === 'dark',
  });
  applyTheme();
  onThemeChange(applyTheme);

  el.querySelector('[data-act="start"]').addEventListener('click', onStart);
  const onKey = e => {
    if (e.key === 'Enter' && !e.target.closest('input, textarea, select, button, a, summary, dialog')) onStart();
  };

  return {
    el,
    show() {
      if (bg) { bg.resize(); bg.start(); }
      document.addEventListener('keydown', onKey);
    },
    hide() {
      if (bg) bg.stop();
      document.removeEventListener('keydown', onKey);
    },
  };
}
