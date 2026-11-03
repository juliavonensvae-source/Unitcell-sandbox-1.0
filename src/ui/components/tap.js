/* =====================================================================
   Tap detection: tells a real click or tap apart from a drag.

   A tap is one pointer that goes down and up again quickly (maxTime) and
   barely moves (maxMove px, a little more for fingers and pens). A second
   finger (pinch), a right-button press (pan), a cancelled pointer or any
   larger movement turns the gesture into "not a tap". Works the same for
   mouse, touch and pen because it only reads pointer-event fields.

   TapGesture has no DOM of its own (tests feed it plain objects);
   watchTaps(el, onTap) wires it to an element's pointer events.
   ===================================================================== */

const TAP = { maxMove: 6, maxMoveTouch: 10, maxTime: 500 };

export class TapGesture {
  constructor({ maxMove = TAP.maxMove, maxMoveTouch = TAP.maxMoveTouch, maxTime = TAP.maxTime } = {}) {
    Object.assign(this, { maxMove, maxMoveTouch, maxTime });
    this.start = null;   // { id, x, y, t, type } of the pointer that may become a tap
    this.pointers = new Set();
  }

  /** A pointer went down. e: { pointerId, clientX, clientY, timeStamp, pointerType, button } */
  down(e) {
    this.pointers.add(e.pointerId);
    if (this.pointers.size > 1 || (e.button != null && e.button !== 0)) { this.start = null; return; }
    this.start = { id: e.pointerId, x: e.clientX, y: e.clientY, t: e.timeStamp, type: e.pointerType || 'mouse' };
  }

  /** A pointer moved: too far and it is a drag. */
  move(e) {
    const s = this.start;
    if (!s || e.pointerId !== s.id) return;
    if (this._moved(e, s) > this._limit(s)) this.start = null;
  }

  /** A pointer went up → true when the whole gesture was a tap. */
  up(e) {
    this.pointers.delete(e.pointerId);
    const s = this.start;
    if (!s || e.pointerId !== s.id) return false;
    this.start = null;
    return this._moved(e, s) <= this._limit(s) && e.timeStamp - s.t <= this.maxTime;
  }

  cancel(e) {
    if (e) this.pointers.delete(e.pointerId); else this.pointers.clear();
    this.start = null;
  }

  _moved(e, s) { return Math.hypot(e.clientX - s.x, e.clientY - s.y); }
  _limit(s) { return s.type === 'mouse' ? this.maxMove : this.maxMoveTouch; }
}

/**
 * Call onTap(e) for every real tap on el (the pointerup event is passed on).
 * → a function that removes the listeners.
 */
export function watchTaps(el, onTap, options) {
  const g = new TapGesture(options);
  const down = e => g.down(e), move = e => g.move(e), cancel = e => g.cancel(e);
  const up = e => { if (g.up(e)) onTap(e); };
  el.addEventListener('pointerdown', down);
  el.addEventListener('pointermove', move);
  el.addEventListener('pointerup', up);
  el.addEventListener('pointercancel', cancel);
  return () => {
    el.removeEventListener('pointerdown', down);
    el.removeEventListener('pointermove', move);
    el.removeEventListener('pointerup', up);
    el.removeEventListener('pointercancel', cancel);
  };
}
