// @vitest-environment happy-dom
/* Part 4.5 §1: the slide-out drawer. A drag (rotate / pan) must not close it,
   a real tap on empty canvas must; Escape closes it; one drawer per side. */
import { describe, it, expect, beforeEach } from 'vitest';
import { TapGesture, watchTaps } from '../src/ui/components/tap.js';
import { Drawer, backgroundTap, closeAllDrawers, claimSide, releaseSide, openDrawer } from '../src/ui/components/drawer.js';

const ev = (pointerId, clientX, clientY, timeStamp, extra = {}) => ({ pointerId, clientX, clientY, timeStamp, pointerType: 'mouse', button: 0, ...extra });

describe('TapGesture: a real click or tap, never a drag', () => {
  it('a short press without movement is a tap', () => {
    const g = new TapGesture();
    g.down(ev(1, 100, 100, 0));
    g.move(ev(1, 102, 101, 40));
    expect(g.up(ev(1, 102, 101, 120))).toBe(true);
  });
  it('dragging to rotate is not a tap, even when the pointer comes back', () => {
    const g = new TapGesture();
    g.down(ev(1, 100, 100, 0));
    g.move(ev(1, 160, 120, 80));
    expect(g.up(ev(1, 100, 100, 200))).toBe(false);
  });
  it('a long press is not a tap', () => {
    const g = new TapGesture();
    g.down(ev(1, 50, 50, 0));
    expect(g.up(ev(1, 50, 50, 900))).toBe(false);
  });
  it('right-button drag (pan) is not a tap', () => {
    const g = new TapGesture();
    g.down(ev(1, 50, 50, 0, { button: 2 }));
    expect(g.up(ev(1, 50, 50, 50, { button: 2 }))).toBe(false);
  });
  it('touch: a finger may wobble a little more than a mouse', () => {
    const g = new TapGesture();
    g.down(ev(7, 200, 200, 0, { pointerType: 'touch' }));
    g.move(ev(7, 208, 204, 60, { pointerType: 'touch' }));
    expect(g.up(ev(7, 208, 204, 150, { pointerType: 'touch' }))).toBe(true);
  });
  it('touch: a pinch with two fingers is not a tap', () => {
    const g = new TapGesture();
    g.down(ev(1, 200, 200, 0, { pointerType: 'touch' }));
    g.down(ev(2, 260, 200, 10, { pointerType: 'touch' }));
    expect(g.up(ev(2, 260, 200, 100, { pointerType: 'touch' }))).toBe(false);
    expect(g.up(ev(1, 200, 200, 110, { pointerType: 'touch' }))).toBe(false);
  });
  it('a cancelled pointer is not a tap', () => {
    const g = new TapGesture();
    g.down(ev(1, 10, 10, 0, { pointerType: 'touch' }));
    g.cancel(ev(1, 10, 10, 20));
    expect(g.up(ev(1, 10, 10, 30))).toBe(false);
  });
});

/** Pointer events on an element (happy-dom has no PointerEvent fields we can rely on, so set them). */
function fire(el, type, { id = 1, x = 0, y = 0, t = 0, kind = 'mouse', button = 0 } = {}) {
  const e = new Event(type, { bubbles: true });
  Object.defineProperties(e, {
    pointerId: { value: id }, clientX: { value: x }, clientY: { value: y },
    timeStamp: { value: t }, pointerType: { value: kind }, button: { value: button },
  });
  el.dispatchEvent(e);
}

describe('Drawer: tab, slide, close on a tap on empty canvas, Escape, one per side', () => {
  let host, canvas, drawer;
  beforeEach(() => {
    closeAllDrawers();
    document.body.innerHTML = '<section class="screen"><div class="host"></div><canvas class="gl"></canvas></section>';
    host = document.querySelector('.host');
    canvas = document.querySelector('.gl');
    drawer = new Drawer({ host, side: 'right', tab: 'Add cells', title: 'Cells', render: () => '<p class="content">cells</p>' });
    // the workspace reports taps on empty canvas like this (cells, atoms and objects are not "empty")
    watchTaps(canvas, () => backgroundTap());
  });

  it('closed: only the slim tab with the text "Add cells"; clicking it slides the drawer open', () => {
    expect(drawer.isOpen).toBe(false);
    expect(drawer.tab.textContent.trim()).toBe('Add cells');
    expect(drawer.el.classList.contains('is-open')).toBe(false);
    drawer.tab.click();
    expect(drawer.isOpen).toBe(true);
    expect(drawer.el.classList.contains('is-open')).toBe(true);
    expect(drawer.tab.classList.contains('is-hidden')).toBe(true);
    expect(drawer.body.querySelector('.content')).not.toBeNull();
    expect(document.querySelector('.screen').classList.contains('drawer-right-open')).toBe(true);
  });

  it('stays open after a drag on the canvas (rotate / pan)', () => {
    drawer.open();
    fire(canvas, 'pointerdown', { x: 100, y: 100, t: 0 });
    fire(canvas, 'pointermove', { x: 180, y: 140, t: 60 });
    fire(canvas, 'pointerup', { x: 180, y: 140, t: 160 });
    expect(drawer.isOpen).toBe(true);
    // a two-finger pinch on a tablet
    fire(canvas, 'pointerdown', { id: 3, x: 100, y: 100, t: 200, kind: 'touch' });
    fire(canvas, 'pointerdown', { id: 4, x: 200, y: 100, t: 210, kind: 'touch' });
    fire(canvas, 'pointerup', { id: 4, x: 200, y: 100, t: 300, kind: 'touch' });
    fire(canvas, 'pointerup', { id: 3, x: 100, y: 100, t: 310, kind: 'touch' });
    expect(drawer.isOpen).toBe(true);
  });

  it('closes after a click on empty space, and after a tap on a tablet', () => {
    drawer.open();
    fire(canvas, 'pointerdown', { x: 40, y: 40, t: 1000 });
    fire(canvas, 'pointerup', { x: 41, y: 40, t: 1090 });
    expect(drawer.isOpen).toBe(false);
    drawer.open();
    fire(canvas, 'pointerdown', { id: 9, x: 40, y: 40, t: 2000, kind: 'touch' });
    fire(canvas, 'pointerup', { id: 9, x: 46, y: 44, t: 2100, kind: 'touch' });
    expect(drawer.isOpen).toBe(false);
  });

  it('Escape closes it', () => {
    drawer.open();
    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    expect(drawer.isOpen).toBe(false);
  });

  it('only one drawer is open on the same side', () => {
    const other = new Drawer({ host, side: 'right', tab: 'Other', render: () => '' });
    const left = new Drawer({ host, side: 'left', tab: 'Left', render: () => '' });
    drawer.open();
    left.open();
    other.open();
    expect(drawer.isOpen).toBe(false);
    expect(other.isOpen).toBe(true);
    expect(left.isOpen).toBe(true);
    expect(openDrawer('right')).toBe(other);
    // another panel on the right (e.g. the SEE MORE help) takes the side over
    let helpOpen = true;
    const help = { close: () => { helpOpen = false; } };
    claimSide('right', help);
    expect(other.isOpen).toBe(false);
    drawer.open();
    expect(helpOpen).toBe(false);
    releaseSide('right', help);
  });
});
