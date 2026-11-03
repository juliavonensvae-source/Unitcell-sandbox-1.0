/* Light / dark theme. Light is the default; a choice of dark is remembered.
   The operating system's dark-mode setting is deliberately ignored. */
import { storage } from './dom.js';
import { icon } from './icons.js';
import { txt } from '../text.js';

const KEY = 'uce-theme';
const listeners = new Set();

export const getTheme = () => (document.documentElement.getAttribute('data-theme') === 'dark' ? 'dark' : 'light');

function apply(theme) {
  document.documentElement.setAttribute('data-theme', theme);
  listeners.forEach(fn => fn(theme));
}

export function setTheme(theme) {
  storage.set(KEY, theme);
  apply(theme);
}

export const toggleTheme = () => setTheme(getTheme() === 'dark' ? 'light' : 'dark');

export function onThemeChange(fn) {
  listeners.add(fn);
}

export function initTheme() {
  apply(storage.get(KEY) === 'dark' ? 'dark' : 'light');
}

export const cssVar = name => getComputedStyle(document.documentElement).getPropertyValue(name).trim();

/** A theme toggle button; any element with data-act="theme" is wired up in main.js. */
export const themeButton = (cls = '') => `<button class="icon-btn theme-btn ${cls}" type="button" data-act="theme" title="${txt('themeTitle')}" aria-label="${txt('themeLabel')}">
  <span class="when-light">${icon('moon')}</span><span class="when-dark">${icon('sun')}</span>
</button>`;
