/* Anchored popovers (menus, pickers). One open at a time; closes on outside
   click or Escape. On narrow screens it becomes a bottom sheet. */
import { rerender, restartAnim } from '../dom.js';

let current = null;

export function closeAllPopovers() {
  if (current) current.close();
}

/** True while a menu or picker is open. */
export const hasOpenPopover = () => !!current;

export class Popover {
  /**
   * @param {object} o
   * @param {HTMLElement} o.anchor     button that opens it
   * @param {() => string} o.render    returns the inner HTML (called on every open)
   * @param {(el: HTMLElement) => void} [o.onCreate] wire events once
   * @param {Object<string, (el: HTMLElement) => void>} [o.onClick] selector → handler: a click on a match
   *                                   closes the popover, then calls the handler with the matched element
   * @param {string} [o.className]
   * @param {'bottom-start'|'bottom-end'|'top-center'} [o.placement]
   * @param {string} [o.label]         accessible name
   */
  constructor({ anchor, render, onCreate, onClick, onClose, className = '', placement = 'bottom-start', label = '' }) {
    Object.assign(this, { anchor, render, onClose, placement });
    this.isOpen = false;
    this.el = document.createElement('div');
    this.el.className = `popover ${className}`;
    this.el.setAttribute('role', 'dialog');
    if (label) this.el.setAttribute('aria-label', label);
    this.el.tabIndex = -1;
    anchor.setAttribute('aria-haspopup', 'dialog');
    anchor.setAttribute('aria-expanded', 'false');
    if (onClick) {
      this.el.addEventListener('click', e => {
        for (const [selector, fn] of Object.entries(onClick)) {
          const t = e.target.closest(selector);
          if (t) { this.close(); fn(t); return; }
        }
      });
    }
    if (onCreate) onCreate(this.el);

    this._outside = e => {
      if (e.target.closest && e.target.closest('.help-layer')) return; // a "?" popover or the SEE MORE panel on top
      if (!this.el.contains(e.target) && !this.anchor.contains(e.target)) this.close();
    };
    this._key = e => {
      if (e.key === 'Escape') { e.stopPropagation(); this.close(); this.anchor.focus(); }
    };
    this._reflow = () => this.position();
  }

  toggle() { this.isOpen ? this.close() : this.open(); }

  open() {
    if (current && current !== this) current.close();
    current = this;
    this.el.innerHTML = this.render();
    if (!this.el.isConnected) document.body.appendChild(this.el);
    this.isOpen = true;
    this.anchor.setAttribute('aria-expanded', 'true');
    this.anchor.classList.add('is-active');
    this.position();
    restartAnim(this.el, 'is-open');
    document.addEventListener('pointerdown', this._outside, true);
    document.addEventListener('keydown', this._key);
    window.addEventListener('resize', this._reflow);
  }

  /** Re-render the content while open (keeps scroll position). */
  refresh() {
    if (!this.isOpen) return;
    rerender(this.el, this.render());
  }

  close() {
    if (!this.isOpen) return;
    this.isOpen = false;
    if (current === this) current = null;
    this.anchor.setAttribute('aria-expanded', 'false');
    this.anchor.classList.remove('is-active');
    this.el.classList.remove('is-open');
    this.el.remove();
    document.removeEventListener('pointerdown', this._outside, true);
    document.removeEventListener('keydown', this._key);
    window.removeEventListener('resize', this._reflow);
    if (this.onClose) this.onClose(this.el);
  }

  position() {
    const el = this.el, vw = window.innerWidth, vh = window.innerHeight, m = 10;
    const sheet = vw < 600;
    el.classList.toggle('is-sheet', sheet);
    el.style.left = el.style.top = el.style.bottom = el.style.maxHeight = '';
    if (sheet) return; // CSS pins it to the bottom of the screen
    const r = this.anchor.getBoundingClientRect();
    const w = el.offsetWidth;
    if (this.placement === 'top-center') {
      const left = Math.min(Math.max(m, r.left + r.width / 2 - w / 2), vw - w - m);
      el.style.left = `${left}px`;
      el.style.bottom = `${vh - r.top + 10}px`;
      el.style.maxHeight = `${r.top - 20}px`;
    } else {
      const left = this.placement === 'bottom-end' ? r.right - w : r.left;
      el.style.left = `${Math.min(Math.max(m, left), vw - w - m)}px`;
      el.style.top = `${r.bottom + 10}px`;
      el.style.maxHeight = `${vh - r.bottom - 20}px`;
    }
  }
}
