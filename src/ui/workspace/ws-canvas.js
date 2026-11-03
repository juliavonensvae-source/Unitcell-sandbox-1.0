/* CrystalWorkspace methods: what a tap or hover on the canvas hits, and placing or dragging 2D vectors. */
import * as M from '../../math/index.js';
import { getType } from '../../objects/index.js';
import { $ } from '../dom.js';
import { icon } from '../icons.js';
import { trim } from '../format.js';
import { watchTaps } from '../components/tap.js';
import { backgroundTap } from '../components/drawer.js';
import { cellAt2D } from '../../math/lattice2d.js';
import { txt } from '../../text.js';

export const canvasMethods = {
  /**
   * The clickable object under a screen point: types with pick(item, ctx, ray) → { t, data, priority? }.
   * → { item, data } for the nearest hit (higher priority wins a near tie), or null.
   */
  pickAt(clientX, clientY) {
    if (!this.view || this.is2D()) return null;
    const ray = this.view.rayAt(clientX, clientY);
    let best = null;
    for (const it of this.viewItems()) {
      const T = getType(it.type);
      if (!it.visible || !T.pick) continue;
      const hit = T.pick(it, this.ctx, ray);
      if (!hit) continue;
      const score = hit.t - (hit.priority || 0) * 0.02 * this.ctx.L0;
      if (!best || score < best.score) best = { item: it, data: hit.data, score };
    }
    return best;
  },

  /**
   * A real tap (not a drag) on the 3D view → what it hit: 'object' (selected: e.g. an
   * interstitial site), 'cell' (highlighted while the Add cells drawer is open), 'atom'
   * (nothing to do) or 'background' (empty space: open drawers close).
   */
  canvasTap(clientX, clientY) {
    const hit = this.pickAt(clientX, clientY);
    if (hit) {
      const T = getType(hit.item.type);
      if (T.onPick) T.onPick(hit.item, hit.data, this.ctx, this);
      return 'object';
    }
    const cell = this.cellAt(clientX, clientY);
    if (cell) {
      if (this.cellDrawer.isOpen) {
        this.setCell(cell);
        this.previewKey = null;
        this.previewCell(null);
        this.cellDrawer.refresh();
      }
      return 'cell';
    }
    if (this.atomAt(clientX, clientY)) return 'atom';
    backgroundTap();
    return 'background';
  },

  /** The lattice point whose sphere is under a screen point (spheres poke out of the cells), or null. */
  atomAt(clientX, clientY) {
    if (!this.view || this.is2D() || !this.state.scene[0].visible || this.pointsTakenOver()) return null;
    const { origin, dir } = this.view.rayAt(clientX, clientY), L = this.ctx.lattice, r = this.ctx.pointRadius;
    return this.ctx.sites.find(s => M.raySphere(origin, dir, L.toCartesian(s.f), r) != null) || null;
  },

  /** The cell under a screen point (numbered from 1), or null. */
  cellAt(clientX, clientY) {
    if (this.is2D()) {
      const r = this.flatView.svg.getBoundingClientRect();
      return cellAt2D(this.flatView.toFrac([clientX - r.left, clientY - r.top]), this.state.flat.n);
    }
    if (!this.view) return null;
    const { origin, dir } = this.view.rayAt(clientX, clientY), L = this.ctx.lattice;
    return M.cellUnderRay(L.toFractional(origin), L.toFractional(dir), this.ctx.region);
  },

  /** Outline the cell that a click would choose (null removes the preview). */
  previewCell(cell) {
    const key = cell ? cell.join() : '';
    if (key === this.previewKey) return;
    this.previewKey = key;
    if (this.is2D()) { this.flatView.preview = cell; this.flatView.render(); return; }
    if (!this.view) return;
    if (!cell) { this.view.removeObject('cell-preview'); return; }
    const ctx = this.ctx, L = ctx.lattice;
    const base = ctx.isPrism ? M.hexPrismRegion(1) : M.boxRegion([1, 1, 1]);
    const R = M.translateRegion(base, ctx.isPrism ? M.prismOrigin(cell) : M.cellOrigin(cell));
    const colour = this.theme.primary;
    const centre = R.vertices.reduce((a, v) => M.add(a, M.scale(v, 1 / R.vertices.length)), [0, 0, 0]);
    this.view.setObject('cell-preview', [
      { kind: 'tubes', segments: R.edges.map(([p, q]) => [L.toCartesian(p), L.toCartesian(q)]), radius: 0.016 * ctx.L0, colour, opacity: 0.9 },
      ...R.faces.map(f => ({ kind: 'polygon', points: f.map(x => L.toCartesian(x)), colour, opacity: 0.1, outline: false })),
      { kind: 'label', at: L.toCartesian(centre), html: txt(ctx.isPrism ? 'prismName' : 'cellName', { cell: cell.join(',') }), colour, cls: 'lbl-dim' },
    ]);
  },

  /** Place a 2D vector by clicking its start and end point (snapping unless turned off). */
  startVectorPick() {
    if (!this.is2D()) return;
    const fv = this.flatView, bar = this.dom.pickBar;
    let start = null;
    const snapOn = this.state.flat.snap !== false;
    const say = text => {
      bar.innerHTML = `<span class="fp-text">${icon('target')}<b>${text}</b></span>
        <label class="fp-snap"><input type="checkbox" data-pick-snap${(fv.pick ? fv.pick.snap : snapOn) ? ' checked' : ''}> ${txt('pickSnap')}</label>
        <button type="button" class="btn btn-soft btn-sm" data-act="pick-cancel">${txt('pickCancel')}</button>`;
    };
    fv.pick = {
      snap: snapOn,
      onPick: f => {
        if (!start) {
          start = f;
          fv.pick.start = f;
          say(txt('pickNowEnd', { start: f.map(x => trim(x, 3)).join(', ') }));
          fv.render();
          return;
        }
        if (Math.hypot(f[0] - start[0], f[1] - start[1]) < 1e-6) return; // same point twice
        const snap = fv.pick.snap;
        this.endVectorPick();
        this.addItem('vector2d', { from: start, to: f, snap });
      },
    };
    bar.hidden = false;
    say(txt('pickStart'));
    fv.render();
  },

  endVectorPick() {
    const fv = this.flatView;
    fv.pick = null;
    fv.hover = null;
    this.dom.pickBar.hidden = true;
    fv.render();
  },

  /** Dragging an end of a 2D vector in the view. */
  dragVectorEnd(id, end, sxy, phase) {
    const item = this.findItem(id);
    if (!item || item.type !== 'vector2d') return;
    const f = this.flatView.snapAt(sxy, item.snap !== false);
    const other = item[end === 'from' ? 'to' : 'from'];
    if (Math.hypot(f[0] - other[0], f[1] - other[1]) > 1e-6) item[end] = f.map(x => Math.round(x * 1000) / 1000 + 0);
    this.renderFlat();
    if (phase === 'end') this.refreshCards();
    else this.updateSummary(item);
  },

  /** Pointer and tap listeners of the 3D and 2D views. */
  bindCanvas() {
    // The 3D view: hovering shows what a click would do (pointer over objects; the cell
    // under the mouse while the Add cells drawer is open). Only a real tap counts as a
    // click (see tap.js), so rotating or panning never selects or closes anything.
    const gl = $('.stage-gl', this.el);
    if (gl) {
      gl.addEventListener('pointermove', e => {
        if (e.buttons) return;
        const hit = this.pickAt(e.clientX, e.clientY);
        if (e.pointerType === 'mouse') gl.style.cursor = hit ? 'pointer' : '';
        this.previewCell(this.cellDrawer.isOpen && !hit ? this.cellAt(e.clientX, e.clientY) : null);
      });
      gl.addEventListener('pointerleave', () => { this.previewCell(null); gl.style.cursor = ''; });
      watchTaps(gl, e => this.canvasTap(e.clientX, e.clientY));
    }
    // The 2D view works the same way, except while placing a vector or on a vector's end
    const svg = this.flatView.svg;
    svg.addEventListener('pointermove', e => {
      if (!e.buttons) this.previewCell(this.cellDrawer.isOpen && !this.flatView.pick ? this.cellAt(e.clientX, e.clientY) : null);
    });
    svg.addEventListener('pointerleave', () => this.previewCell(null));
    watchTaps(svg, e => {
      if (this.flatView.pick || (e.target.closest && e.target.closest('.flat-handle'))) return;
      this.canvasTap(e.clientX, e.clientY);
    });
    // Fade the gesture hint once the user has interacted with the 3D view
    this.dom.stage.addEventListener('pointerdown', e => {
      if (e.target.classList.contains('stage-gl')) this.dom.hint.classList.add('is-faded');
    });
  },
};
