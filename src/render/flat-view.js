/* =====================================================================
   FlatView — the 2D lattice drawn flat in SVG. Pan (drag) and zoom
   (wheel / pinch), no rotation. Receives geometry from the workspace;
   holds no lattice logic of its own.

   Objects (2D directions, vectors, lines) arrive as primitives in
   fractional coordinates:
     { kind: 'arrow',  from, to, colour, opacity, width? }
     { kind: 'line',   from, to, colour, opacity, width?, dashed? }
     { kind: 'dot',    at, colour, r? }
     { kind: 'handle', at, colour, id, end }      draggable end of a vector
     { kind: 'label',  at, html, colour, cls?, dx?, dy? }   HTML label
   Interaction: drag a handle (onHandleDrag), or, in pick mode, click a
   point (onPick); both snap to snapTargets within 14 px when snapping is on.
   ===================================================================== */

import { txt } from '../text.js';
const NS = 'http://www.w3.org/2000/svg';
const f1 = v => (Math.round(v * 10) / 10).toString();

export class FlatView {
  constructor(host) {
    this.host = host;
    this.svg = document.createElementNS(NS, 'svg');
    this.svg.setAttribute('class', 'flat-svg');
    host.appendChild(this.svg);
    this.labels = document.createElement('div');
    this.labels.className = 'flat-labels';
    host.appendChild(this.labels);
    this.objects = [];       // [{ id, visible, prims }]
    this.snapTargets = [];   // fractional points the mouse snaps to
    this.pick = null;        // { snap, onPick(frac), start? } while placing a vector
    this.hover = null;       // snapped point under the mouse in pick mode
    this.preview = null;     // cell [i, j] (from 1) that a click would highlight
    this.scale = 40;   // px per Å
    this.tx = 0;       // screen position of the origin
    this.ty = 0;
    this.w = 1; this.h = 1;
    this.bottomInset = 76; // floating toolbar
    this.rightInset = 0;   // px covered on the right (e.g. by a drawer)
    this.pointers = new Map();
    this._bind();
    this.ro = new ResizeObserver(() => this.resize());
    this.ro.observe(host);
    this.resize();
  }

  /**
   * m: { lattice (Lattice2D), sites: [{ f, inOriginal }], n, cellOrigin, origin (the highlighted cell and the axes' start),
   *      points: { visible, radius, colour, opacity },
   *      edges:  { visible, colour, opacity, thickness, highlight, highlightColour, allCells, gridColour, gridThickness },
   *      axes:   { visible, colourA, colourB, angleColour },
   *      cut: bool, clipId }
   */
  setModel(m) {
    this.model = m;
    this.render();
  }

  resize() {
    const r = this.host.getBoundingClientRect();
    if (r.width < 2 || r.height < 2) return;
    const first = this.w <= 1;
    this.w = r.width; this.h = r.height;
    this.svg.setAttribute('viewBox', `0 0 ${this.w} ${this.h}`);
    if (first && this.model) this.frame();
    else this.render();
  }

  /** Fit the n × n block (plus the axis arrows) in view. */
  frame() {
    const m = this.model;
    if (!m) return;
    const L = m.lattice, n = m.n;
    const pts = [[0, 0], [n, 0], [0, n], [n, n], [1.25, 0], [0, 1.25]].map(f => L.toCartesian(f));
    const xs = pts.map(p => p[0]), ys = pts.map(p => p[1]);
    const pad = m.points.radius * 1.2;
    const x0 = Math.min(...xs) - pad, x1 = Math.max(...xs) + pad, y0 = Math.min(...ys) - pad, y1 = Math.max(...ys) + pad;
    const freeW = this.w - this.rightInset;
    const availW = freeW * 0.82, availH = (this.h - this.bottomInset) * 0.8;
    this.scale = Math.min(availW / (x1 - x0), availH / (y1 - y0));
    this.tx = freeW / 2 - ((x0 + x1) / 2) * this.scale;
    this.ty = (this.h - this.bottomInset) / 2 + ((y0 + y1) / 2) * this.scale + 6;
    this.render();
  }

  /** Something covers px on the right: pan so the picture moves into the part left free (zoom is kept). */
  setInsetRight(px) {
    const next = Math.max(0, px);
    this.tx -= (next - this.rightInset) / 2;
    this.rightInset = next;
    // if the block no longer fits in the free part, fit it again
    const m = this.model;
    if (m && next > 0) {
      const xs = [[0, 0], [m.n, 0], [0, m.n], [m.n, m.n]].map(f => this.toScreen(m.lattice.toCartesian(f))[0]);
      if (Math.min(...xs) < 0 || Math.max(...xs) > this.w - next) { this.frame(); return; }
    }
    this.render();
  }

  toScreen([x, y]) {
    return [this.tx + x * this.scale, this.ty - y * this.scale];
  }

  /** Screen point (px, relative to the SVG) → fractional coordinates. */
  toFrac([sx, sy]) {
    return this.model.lattice.toFractional([(sx - this.tx) / this.scale, (this.ty - sy) / this.scale]);
  }

  /** Nearest snap target within 14 px of a screen point, else the free point (0.01 steps). */
  snapAt(sxy, snap = true) {
    if (snap && this.model) {
      const L = this.model.lattice;
      let best = null, bestD = 14;
      for (const f of this.snapTargets) {
        const [x, y] = this.toScreen(L.toCartesian(f));
        const d = Math.hypot(x - sxy[0], y - sxy[1]);
        if (d < bestD) { bestD = d; best = f; }
      }
      if (best) return [...best];
    }
    return this.toFrac(sxy).map(v => Math.round(v * 100) / 100 + 0);
  }

  render() {
    const m = this.model;
    if (!m) return;
    const L = m.lattice, n = m.n, s = this.scale;
    const P = f => this.toScreen(L.toCartesian(f));
    const poly = fs => fs.map(P).map(([x, y]) => `${f1(x)},${f1(y)}`).join(' ');
    const out = [];
    const cellPoly = poly([[0, 0], [n, 0], [n, n], [0, n]]);
    const unitPoly = ([x, y]) => poly([[x, y], [x + 1, y], [x + 1, y + 1], [x, y + 1]]);
    out.push(`<defs><clipPath id="${m.clipId}"><polygon points="${cellPoly}"/></clipPath></defs>`);

    // cell edges
    const e = m.edges;
    if (e.visible) {
      const w = 2 * e.thickness;
      if (e.allCells && n > 1) {
        const lines = [];
        for (let i = 1; i < n; i++) lines.push([[i, 0], [i, n]], [[0, i], [n, i]]);
        out.push(`<g stroke="${e.gridColour}" stroke-width="${2 * e.gridThickness}" stroke-linecap="round" opacity="${e.opacity}">${lines.map(([a, b]) => {
          const [x1, y1] = P(a), [x2, y2] = P(b);
          return `<line x1="${f1(x1)}" y1="${f1(y1)}" x2="${f1(x2)}" y2="${f1(y2)}"/>`;
        }).join('')}</g>`);
      }
      out.push(`<polygon points="${cellPoly}" fill="none" stroke="${e.colour}" stroke-width="${w}" stroke-linejoin="round" opacity="${e.opacity}"/>`);
      if (e.highlight && n > 1) {
        out.push(`<polygon points="${unitPoly(m.cellOrigin)}" fill="none" stroke="${e.highlightColour}" stroke-width="${w * 1.9}" stroke-linejoin="round" opacity="${e.opacity}"/>`);
      }
    }

    // lattice points
    const p = m.points;
    if (p.visible) {
      const dim = e.highlight && n > 1;
      const r = Math.max(1.5, p.radius * s);
      const circles = m.sites.map(site => {
        const [x, y] = P(site.f);
        const o = (dim && !site.inOriginal ? 0.28 : 1) * p.opacity;
        return `<circle cx="${f1(x)}" cy="${f1(y)}" r="${f1(r)}" fill="${p.colour}" fill-opacity="${o}" stroke="${p.colour}" stroke-opacity="${Math.min(1, o + 0.2)}" stroke-width="1.2"/>`;
      }).join('');
      out.push(`<g class="flat-points"${m.cut ? ` clip-path="url(#${m.clipId})"` : ''}>${circles}</g>`);
    }

    // axes a, b and the angle γ
    const ax = m.axes;
    if (ax.visible) {
      const O = m.origin, [ox, oy] = P(O);
      const ext = Math.max(p.radius * s, 6) + 22;
      const arrow = (f, colour, name) => {
        const [x, y] = P(f), len = Math.hypot(x - ox, y - oy), ux = (x - ox) / len, uy = (y - oy) / len;
        const ex = x + ux * ext, ey = y + uy * ext, hx = ex - ux * 12, hy = ey - uy * 12;
        return `<line x1="${f1(ox)}" y1="${f1(oy)}" x2="${f1(hx)}" y2="${f1(hy)}" stroke="${colour}" stroke-width="3.2" stroke-linecap="round"/>
          <polygon points="${f1(ex)},${f1(ey)} ${f1(hx - uy * 6)},${f1(hy + ux * 6)} ${f1(hx + uy * 6)},${f1(hy - ux * 6)}" fill="${colour}"/>
          <text x="${f1(ex + ux * 14)}" y="${f1(ey + uy * 14 + 6)}" class="flat-axis-label" fill="${colour}" text-anchor="middle">${name}</text>`;
      };
      const gamma = L.params.gamma;
      const R = Math.min(42, 0.32 * Math.min(L.params.a, L.params.b) * s);
      const a1 = 0, a2 = -gamma * Math.PI / 180; // screen y points down
      const sx = ox + R * Math.cos(a1), sy = oy + R * Math.sin(a1), exx = ox + R * Math.cos(a2), eyy = oy + R * Math.sin(a2);
      const mid = (a1 + a2) / 2, lr = R + 24;
      out.push(`<g class="flat-axes">
        <path d="M${f1(ox)},${f1(oy)} L${f1(sx)},${f1(sy)} A${f1(R)},${f1(R)} 0 0 0 ${f1(exx)},${f1(eyy)} Z" fill="${ax.angleColour}" fill-opacity="0.16" stroke="none"/>
        <path d="M${f1(sx)},${f1(sy)} A${f1(R)},${f1(R)} 0 0 0 ${f1(exx)},${f1(eyy)}" fill="none" stroke="${ax.angleColour}" stroke-width="2"/>
        <text x="${f1(ox + lr * Math.cos(mid))}" y="${f1(oy + lr * Math.sin(mid) + 5)}" class="flat-angle-label" fill="${ax.angleColour}" text-anchor="middle">γ = ${+gamma.toFixed(2)}°</text>
        ${arrow([O[0] + 1, O[1]], ax.colourA, 'a')}${arrow([O[0], O[1] + 1], ax.colourB, 'b')}
      </g>`);
    }
    // added objects
    const labels = [];
    for (const o of this.objects) {
      if (!o.visible) continue;
      for (const q of o.prims) out.push(this._prim(q, P, labels));
    }
    if (this.preview) {
      const o = this.preview.map(i => i - 1);
      out.push(`<polygon points="${unitPoly(o)}" fill="${e.highlightColour}" fill-opacity="0.1" stroke="${e.highlightColour}" stroke-width="3" stroke-dasharray="7 6"/>`);
      this._prim({ kind: 'label', at: [o[0] + 0.5, o[1] + 0.5], html: txt('cellName', { cell: this.preview.join(',') }), colour: e.highlightColour, cls: 'lbl-dim' }, P, labels);
    }
    // pick mode: the start point already chosen and the point under the mouse
    if (this.pick) {
      for (const f of [this.pick.start, this.hover].filter(Boolean)) {
        const [x, y] = P(f);
        out.push(`<circle class="flat-pick-dot" cx="${f1(x)}" cy="${f1(y)}" r="7"/>`);
      }
      if (this.pick.start && this.hover) {
        const [x1, y1] = P(this.pick.start), [x2, y2] = P(this.hover);
        out.push(`<line class="flat-pick-line" x1="${f1(x1)}" y1="${f1(y1)}" x2="${f1(x2)}" y2="${f1(y2)}"/>`);
      }
    }
    this.svg.innerHTML = out.join('');
    this.labels.innerHTML = labels.join('');
  }

  _prim(q, P, labels) {
    const op = q.opacity ?? 1, w = q.width ?? 3;
    if (q.kind === 'line') {
      const [x1, y1] = P(q.from), [x2, y2] = P(q.to);
      return `<line x1="${f1(x1)}" y1="${f1(y1)}" x2="${f1(x2)}" y2="${f1(y2)}" stroke="${q.colour}" stroke-width="${w}" stroke-opacity="${op}" stroke-linecap="round"${q.dashed ? ' stroke-dasharray="7 6"' : ''}/>`;
    }
    if (q.kind === 'arrow') {
      const [x1, y1] = P(q.from), [x2, y2] = P(q.to), len = Math.hypot(x2 - x1, y2 - y1);
      if (len < 1) return '';
      const ux = (x2 - x1) / len, uy = (y2 - y1) / len, head = Math.min(15, 0.4 * len);
      const hx = x2 - ux * head, hy = y2 - uy * head;
      return `<g opacity="${op}"><line x1="${f1(x1)}" y1="${f1(y1)}" x2="${f1(hx)}" y2="${f1(hy)}" stroke="${q.colour}" stroke-width="${w}" stroke-linecap="round"${q.dashed ? ' stroke-dasharray="7 6"' : ''}/>
        <polygon points="${f1(x2)},${f1(y2)} ${f1(hx - uy * 6.5)},${f1(hy + ux * 6.5)} ${f1(hx + uy * 6.5)},${f1(hy - ux * 6.5)}" fill="${q.colour}"/></g>`;
    }
    if (q.kind === 'dot') {
      const [x, y] = P(q.at);
      return `<circle cx="${f1(x)}" cy="${f1(y)}" r="${q.r ?? 5}" fill="${q.colour}" stroke="var(--stage)" stroke-width="2"/>`;
    }
    if (q.kind === 'handle') {
      const [x, y] = P(q.at);
      return `<circle class="flat-handle" data-id="${q.id}" data-end="${q.end}" cx="${f1(x)}" cy="${f1(y)}" r="8" fill="var(--stage)" stroke="${q.colour}" stroke-width="3"/>`;
    }
    if (q.kind === 'label') {
      const [x, y] = P(q.at);
      labels.push(`<div class="lbl ${q.cls || ''}" style="--c:${q.colour};transform:translate(${f1(x + (q.dx || 0))}px, ${f1(y + (q.dy || 0))}px) translate(-50%, -50%)">${q.html}</div>`);
    }
    return '';
  }

  // ---------- pan & zoom ----------
  _zoomAt(cx, cy, k) {
    const s = Math.min(600, Math.max(4, this.scale * k));
    k = s / this.scale;
    this.tx = cx - (cx - this.tx) * k;
    this.ty = cy - (cy - this.ty) * k;
    this.scale = s;
    this._schedule();
  }

  _schedule() {
    if (this.raf) return;
    this.raf = requestAnimationFrame(() => { this.raf = 0; this.render(); });
  }

  _bind() {
    const el = this.svg;
    const local = e => { const r = el.getBoundingClientRect(); return [e.clientX - r.left, e.clientY - r.top]; };
    el.addEventListener('wheel', e => {
      e.preventDefault();
      const [x, y] = local(e);
      this._zoomAt(x, y, Math.exp(-e.deltaY * 0.0015));
    }, { passive: false });
    el.addEventListener('pointerdown', e => {
      el.setPointerCapture(e.pointerId);
      const at = local(e);
      this.pointers.set(e.pointerId, at);
      this.downAt = at;
      const h = e.target.closest && e.target.closest('.flat-handle');
      this.drag = h && this.pointers.size === 1 ? { id: h.dataset.id, end: h.dataset.end } : null;
      if (this.onInteract) this.onInteract();
    });
    el.addEventListener('pointermove', e => {
      const now = local(e);
      if (!this.pointers.has(e.pointerId)) {
        if (this.pick) { this.hover = this.snapAt(now, this.pick.snap); this._schedule(); }
        return;
      }
      const prev = this.pointers.get(e.pointerId);
      if (this.drag) {
        if (this.onHandleDrag) this.onHandleDrag(this.drag.id, this.drag.end, now, 'move');
      } else if (this.pointers.size === 1) {
        this.tx += now[0] - prev[0];
        this.ty += now[1] - prev[1];
        this._schedule();
      } else if (this.pointers.size === 2) {
        const [other] = [...this.pointers.entries()].filter(([id]) => id !== e.pointerId).map(([, p]) => p);
        const d0 = Math.hypot(prev[0] - other[0], prev[1] - other[1]), d1 = Math.hypot(now[0] - other[0], now[1] - other[1]);
        if (d0 > 0) this._zoomAt((now[0] + other[0]) / 2, (now[1] + other[1]) / 2, d1 / d0);
      }
      this.pointers.set(e.pointerId, now);
    });
    el.addEventListener('pointerup', e => {
      const now = local(e);
      if (this.drag) {
        if (this.onHandleDrag) this.onHandleDrag(this.drag.id, this.drag.end, now, 'end');
        this.drag = null;
      } else if (this.pick && this.downAt && Math.hypot(now[0] - this.downAt[0], now[1] - this.downAt[1]) < 5) {
        this.pick.onPick(this.snapAt(now, this.pick.snap));
      }
    });
    const end = e => this.pointers.delete(e.pointerId);
    el.addEventListener('pointerup', end);
    el.addEventListener('pointercancel', e => { end(e); this.drag = null; });
    el.addEventListener('pointerleave', () => { if (this.pick && this.hover) { this.hover = null; this._schedule(); } });
  }
}
