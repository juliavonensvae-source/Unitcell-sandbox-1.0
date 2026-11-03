/* =====================================================================
   Drawer — a reusable slide-out bar on the left or right edge.

   Behaviour every drawer shares:
   - closed, only a slim tab with its name sits on that edge; clicking the
     tab slides the drawer open (short slide, no bounce)
   - it closes with its × button, the tab, Escape, or a real tap on empty
     canvas. The owner of a canvas reports those taps with
     backgroundTap() (see tap.js: a drag to rotate or pan is never a tap)
   - one drawer per side: opening one closes whatever held that side.
     Other panels can take part with claimSide / releaseSide (the SEE MORE
     help panel does, on the right)

   new Drawer({ host, side, tab, title, sub, render, onCreate, onOpen, onClose })
     host     element the drawer and its tab are placed in (position: relative)
     render() → the body HTML (called on open and refresh)
   drawer.open() / close() / toggle() / refresh() / isOpen

   The host's workspace gets the class `drawer-<side>-open` while one is
   open, so overlays on the canvas can move out of its way (CSS).
   ===================================================================== */
import { icon } from '../icons.js';
import { esc, rerender } from '../dom.js';
import { txt } from '../../text.js';

const SIDES = new Map();   // side → { close() } of the panel holding it
const ALL = new Set();     // every drawer (for Escape and background taps)
let uid = 0;

/** Make `owner` ({ close }) the one open panel on `side`; whatever held it closes. */
export function claimSide(side, owner) {
  const prev = SIDES.get(side);
  SIDES.set(side, owner);
  if (prev && prev !== owner) prev.close();
}

export function releaseSide(side, owner) {
  if (SIDES.get(side) === owner) SIDES.delete(side);
}

/** The drawer open on a side, or null. */
export const openDrawer = side => [...ALL].find(d => d.isOpen && d.side === side) || null;

/** A real tap on empty canvas: every open drawer closes. */
export function backgroundTap() {
  let closed = false;
  for (const d of ALL) if (d.isOpen) { d.close(); closed = true; }
  return closed;
}

export function closeAllDrawers() {
  for (const d of ALL) d.close();
}

/** Escape closes the most recently opened drawer — unless something on top handled it first. */
let order = [];
function onKey(e) {
  if (e.key !== 'Escape' || e.defaultPrevented) return;
  if (document.querySelector('dialog[open]')) return;
  const t = e.target;
  const d = [...order].reverse().find(x => x.isOpen);
  if (!d) return;
  // a text field outside the drawer uses Escape itself (e.g. putting a name back)
  if (t && t.closest && t.closest('input, textarea, select') && !d.el.contains(t)) return;
  e.preventDefault();
  d.close({ focusTab: d.el.contains(document.activeElement) });
}

export class Drawer {
  constructor({ host, side = 'right', tab = 'Open', title = '', sub = '', className = '', render, onCreate, onOpen, onClose }) {
    Object.assign(this, { host, side, render, onOpen, onClose });
    this.isOpen = false;
    const id = `drawer-${++uid}`;

    this.tab = document.createElement('button');
    this.tab.type = 'button';
    this.tab.className = `drawer-tab drawer-tab-${side}`;
    this.tab.setAttribute('aria-controls', id);
    this.tab.setAttribute('aria-expanded', 'false');
    this.tab.innerHTML = `<span class="drawer-tab-text">${esc(tab)}</span>`;
    this.tab.addEventListener('click', () => this.toggle());

    this.el = document.createElement('aside');
    this.el.id = id;
    this.el.className = `drawer drawer-${side} ${className}`.trim();
    this.el.setAttribute('aria-label', title || tab);
    this.el.inert = true;
    this.el.innerHTML = `<header class="drawer-head">
        <div class="drawer-title"><b>${esc(title || tab)}</b>${sub ? `<small>${sub}</small>` : ''}</div>
        <button type="button" class="icon-btn drawer-close" data-drawer="close" title="${txt('closeEsc')}" aria-label="${txt('close')}">${icon('x')}</button>
      </header>
      <div class="drawer-body"></div>`;
    this.body = this.el.querySelector('.drawer-body');
    this.el.querySelector('[data-drawer="close"]').addEventListener('click', () => this.close({ focusTab: true }));

    host.append(this.tab, this.el);
    if (onCreate) onCreate(this.body, this);
    if (!ALL.size) window.addEventListener('keydown', onKey);
    ALL.add(this);
  }

  toggle() { this.isOpen ? this.close({ focusTab: true }) : this.open(); }

  open() {
    if (this.isOpen) return;
    claimSide(this.side, this);
    this.isOpen = true;
    order = order.filter(d => d !== this).concat(this);
    this.body.innerHTML = this.render();
    this.el.inert = false;
    this.el.classList.add('is-open');
    this.tab.classList.add('is-hidden');
    this.tab.setAttribute('aria-expanded', 'true');
    this._sideClass(true);
    if (this.onOpen) this.onOpen(this.body, this);
  }

  close({ focusTab = false } = {}) {
    if (!this.isOpen) return;
    this.isOpen = false;
    releaseSide(this.side, this);
    this.el.classList.remove('is-open');
    this.el.inert = true;
    this.tab.classList.remove('is-hidden');
    this.tab.setAttribute('aria-expanded', 'false');
    this._sideClass(false);
    if (focusTab) this.tab.focus({ preventScroll: true });
    if (this.onClose) this.onClose(this.body, this);
  }

  /** Re-render the body while open, keeping its scroll position and the focused control. */
  refresh() {
    if (!this.isOpen) return;
    rerender(this.body, this.render());
  }

  _sideClass(on) {
    const root = this.host.closest('.screen') || this.host;
    root.classList.toggle(`drawer-${this.side}-open`, on);
  }
}
