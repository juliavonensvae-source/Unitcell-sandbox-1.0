/* Tiny DOM helpers. */

export const $ = (sel, root = document) => root.querySelector(sel);
export const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];

export const esc = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

/** HTML string → element (first element of the markup). */
export function h(html) {
  const t = document.createElement('template');
  t.innerHTML = html.trim();
  return t.content.firstElementChild;
}

/** localStorage that never throws (private windows, blocked storage). */
export const storage = {
  get(key, fallback = null) {
    try { const v = localStorage.getItem(key); return v == null ? fallback : v; } catch { return fallback; }
  },
  set(key, value) {
    try { localStorage.setItem(key, value); } catch { /* storage unavailable: setting is not remembered */ }
  },
};

export const reducedMotion = () => window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

/**
 * Run a re-render inside root without losing keyboard focus: the focused control
 * is found again afterwards by its card id and data-field / data-act.
 */
export function preserveFocus(root, fn) {
  const a = document.activeElement;
  let key = null;
  if (a && a !== document.body && root.contains(a)) {
    const card = a.closest('[data-id]');
    key = {
      id: card && card.dataset.id, field: a.dataset.field, act: a.dataset.act, value: a.dataset.value,
      start: a.selectionStart, end: a.selectionEnd,
    };
  }
  fn();
  if (!key || !(key.field || key.act)) return;
  const scope = key.id ? `[data-id="${key.id}"] ` : '';
  const what = key.field ? `[data-field="${key.field}"]` : `[data-act="${key.act}"]${key.value ? `[data-value="${key.value}"]` : ''}`;
  const el = root.querySelector(scope + what);
  if (!el) return;
  el.focus({ preventScroll: true });
  try { if (key.start != null) el.setSelectionRange(key.start, key.end); } catch { /* not a text input */ }
}

/**
 * Replace el's content while keeping the scroll position (of el, or of its `scroller`
 * descendant) and the keyboard focus, which is found again by its `prefix`* attributes.
 */
export function rerender(el, html, { scroller = null, prefix = 'data-', keepScroll = true } = {}) {
  const scrollEl = () => (scroller ? el.querySelector(scroller) : el);
  const old = scrollEl(), top = keepScroll && old ? old.scrollTop : 0;
  const a = document.activeElement, sel = a && el.contains(a)
    ? [...a.attributes].filter(x => x.name.startsWith(prefix)).map(x => `[${x.name}="${CSS.escape(x.value)}"]`).join('') : '';
  el.innerHTML = html;
  const next = scrollEl();
  if (next) next.scrollTop = top;
  if (sel) { const b = el.querySelector(sel); if (b) b.focus({ preventScroll: true }); }
}

/** Replay a CSS animation: remove the class, force a reflow, add it back. */
export function restartAnim(el, cls) {
  el.classList.remove(cls);
  void el.offsetWidth;
  el.classList.add(cls);
}

/** Show `msg` under a field (and mark the input invalid), or hide the error when msg is empty. */
export function showError(input, errEl, msg) {
  errEl.hidden = !msg;
  errEl.textContent = msg || '';
  input.classList.toggle('is-invalid', !!msg);
}
