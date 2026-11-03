/* Small toast messages: "Added direction [110]", with an optional action (Undo). */
import { icon } from '../icons.js';
import { esc } from '../dom.js';

let host = null;

/**
 * @param {string} html trusted markup (escape user text before passing it in)
 * @param {object} [o]
 * @param {'ok'|'info'|'warn'} [o.tone]
 * @param {string} [o.icon]   icon name
 * @param {string} [o.colour] colour of the icon bubble
 * @param {{label: string, run: () => void}} [o.action]
 */
export function toast(html, { tone = 'ok', icon: ic = tone === 'warn' ? 'info' : 'check', colour, action, duration = 2800 } = {}) {
  if (!host) {
    host = document.createElement('div');
    host.className = 'toasts';
    host.setAttribute('aria-live', 'polite');
    document.body.appendChild(host);
  }
  const el = document.createElement('div');
  el.className = `toast toast-${tone}`;
  el.setAttribute('role', 'status');
  el.innerHTML = `<span class="toast-icon"${colour ? ` style="--tc:${colour}"` : ''}>${icon(ic)}</span>
    <span class="toast-msg">${html}</span>
    ${action ? `<button class="toast-action" type="button">${esc(action.label)}</button>` : ''}`;
  host.appendChild(el);
  while (host.children.length > 3) host.firstElementChild.remove();
  requestAnimationFrame(() => el.classList.add('is-in'));

  let timer = 0;
  const dismiss = () => {
    clearTimeout(timer);
    el.classList.remove('is-in');
    el.classList.add('is-out');
    setTimeout(() => el.remove(), 260);
  };
  const arm = () => { timer = setTimeout(dismiss, duration); };
  el.addEventListener('pointerenter', () => clearTimeout(timer));
  el.addEventListener('pointerleave', arm);
  if (action) {
    el.querySelector('.toast-action').addEventListener('click', () => { action.run(); dismiss(); });
  }
  arm();
  return dismiss;
}
