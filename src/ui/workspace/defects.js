/* =====================================================================
   DefectsWorkspace — the "Defects" mode. The same interface as Crystal
   Structures (it extends CrystalWorkspace): panel, + Add, input bar, help,
   the 3D view and the Add cells drawer (here: the size of the block).

   What differs:
   - cubic P, I and F only; the scene draws atoms (the Atoms object),
     which every visible defect moves (objects/crystal.js)
   - 3D / 2D switches to a 2D slice: one atomic layer seen straight on
     (orthographic, no rotation), chosen in the slice bar
   - point defects are placed by clicking a lattice point or site, and
     dislocations and Burgers circuits can be animated (defects-place.js)
   ===================================================================== */
import { CrystalWorkspace } from './workspace.js';
import { getType } from '../../objects/index.js';
import * as M from '../../math/index.js';
import { crystalOf } from '../../objects/crystal.js';
import { $, $$ } from '../dom.js';
import { toast } from '../components/toast.js';
import { closeAllPopovers } from '../components/popover.js';
import { placeMethods } from './defects-place.js';
import { txt } from '../../text.js';

export class DefectsWorkspace extends CrystalWorkspace {
  constructor(opts) {
    super({ ...opts, mode: 'defects' });
    this.uid = 100000; // item ids (and the DOM ids made from them) stay unique next to the Crystal Structures screen
    this.anims = new Map();
    this.placing = null;
  }

  mount(parent) {
    super.mount(parent);
    this.dom.placeBar = $('.place-bar', this.el);
    this.bindDefects();
  }

  /** The 2D slice is the 3D view looking straight at one layer, so the 2D lattice views are never used here. */
  is2D() { return false; }

  /** The Atoms object draws the atoms (with every defect in them) instead of the lattice points. */
  pointsTakenOver() { return true; }

  /** No highlighted cell or origin corner in the Add cells drawer: it only sets the size of the block. */
  cellPickerHTML() { return ''; }

  hide() {
    super.hide();
    this.stopAnims();
    this.endPlace();
  }

  renderTopbar() {
    super.renderTopbar();
    const on = this.state.slice.on;
    $$('[data-dim]', this.el).forEach(btn => btn.setAttribute('aria-pressed', String((btn.dataset.dim === '2d') === on)));
  }

  /** "Cubic P · 5×5×5 · 215 atoms · 1 defect" and the hint for the view shown. */
  renderStatus() {
    const ctx = this.ctx, C = crystalOf(ctx), n = C.atoms.filter(a => a.kind === 'host').length;
    const defects = this.state.items.filter(it => it.visible && getType(it.type).defect).length;
    const slice = ctx.slice ? ` · ${txt('statusSlice', { axis: 'abc'[ctx.slice.axis], level: +ctx.slice.level.toFixed(3) })}` : '';
    const values = { name: ctx.bravais.name, size: this.sizeText(), count: n };
    this.dom.status.innerHTML = (defects ? txt(defects === 1 ? 'statusDefectsOne' : 'statusDefectsMany', { ...values, defects }) : txt('statusDefectsNone', values)) + slice;
    this.dom.hint.textContent = txt(ctx.slice ? 'stageHintSlice' : 'stageHint3D');
    this.renderReadout();
    this.renderLegend();
    this.renderSliceBar();
    this.updateSummary(this.state.scene[0]); // the Atoms card counts the atoms and how far they moved
  }

  /** What the view fits: the slice (or the block), plus the perfect crystal a Burgers circuit puts beside it. */
  framePoints() {
    const ctx = this.ctx, L = ctx.lattice, sl = ctx.slice, pts = [];
    for (const v of ctx.region.vertices) {
      const f = v.slice();
      if (sl) f[sl.axis] = sl.level;
      pts.push(L.toCartesian(f));
    }
    for (const it of this.viewItems()) {
      const T = getType(it.type);
      if (it.visible && T.frameExtra) pts.push(...T.frameExtra(it, ctx));
    }
    if (!sl && pts.length <= 8) return null;
    // the corners of the box around them all, so the view centres on the whole picture
    const lo = [0, 1, 2].map(k => Math.min(...pts.map(p => p[k]))), hi = [0, 1, 2].map(k => Math.max(...pts.map(p => p[k])));
    return [0, 1, 2, 3, 4, 5, 6, 7].map(i => [0, 1, 2].map(k => (i & (1 << k) ? hi[k] : lo[k])));
  }

  /** Any change to a defect moves the atoms, so the whole scene and every card's summary follow. */
  redraw(item, { card = false } = {}) {
    this.renderScene();
    for (const it of [...this.state.scene, ...this.state.items]) { this.updateSummary(it); this.refreshLive(it); }
    const T = getType(item.type), li = T.definition && this.card(item), code = li && $('.def-code', li);
    if (code) code.textContent = T.definition(item, this.ctx);
    if (card) this.replaceCard(item);
  }

  /** A Burgers circuit puts a perfect crystal beside the block: fit both in view. A slip plane is seen from its own angle. */
  addItem(type, init = {}, opts = {}) {
    const item = super.addItem(type, init, opts);
    if (item.error || opts.quiet) return item;
    const T = getType(type), along = T.viewOnAdd && !this.state.slice.on ? T.viewOnAdd(item, this.ctx) : null;
    if (along && this.view) this.view.frame({ along });
    else if (T.frameExtra) this.frameView();
    return item;
  }

  frameView() {
    if (this.state.slice.on) this.lookAtSlice();
    else super.frameView();
  }

  toggleVisible(item, li) {
    super.toggleVisible(item, li);
    if (getType(item.type).defect) this.redraw(item);
  }

  /** While placing a defect, a tap picks the lattice point or site; otherwise as in Crystal Structures. */
  canvasTap(clientX, clientY) {
    if (this.placing) return this.placeTap(clientX, clientY);
    return super.canvasTap(clientX, clientY);
  }

  /** + Add entries of point defects ask for a click in the view first. */
  addFromMenu(entry, text) {
    if (entry && entry.place) { this.startPlace({ entry }); return null; }
    return super.addFromMenu(entry, text);
  }

  setProjection(ortho) {
    this.state.ortho = ortho;
    if (this.view && !this.state.slice.on) this.view.setProjection(ortho); // the slice is always orthographic
    this.renderToolbar();
  }

  resetView() {
    if (this.state.slice.on) this.lookAtSlice();
    else super.resetView();
  }

  /* ---------------- the 2D slice ---------------- */
  setDim(dim) { this.setSlice(dim === '2d'); }

  setSlice(on) {
    const s = this.state.slice;
    if (on === s.on) return;
    closeAllPopovers();
    this.endPlace();
    s.on = on;
    if (on) this.autoSlice();
    this.el.classList.toggle('is-slice', on);
    if (this.view) { this.view.setFlat(on); this.view.setProjection(on || this.state.ortho); }
    this.rebuild();
    if (on) this.lookAtSlice();
    else if (this.view) this.view.frame({ resetDirection: true });
    toast(txt(on ? 'msgSliceOn' : 'msgSliceOff'), { icon: 'cube', tone: 'info' });
  }

  /** The slice through the newest defect: across a dislocation's line, or the layer of a point defect. */
  autoSlice() {
    const s = this.state.slice, ctx = this.ctx;
    const it = [...this.state.items].reverse().find(i => i.visible && (getType(i.type).defect || i.type === 'burgers'));
    if (!it) { s.layer = null; return; }
    const D = it.type === 'burgers' ? ctx.itemById(it.src) : it;
    if (D && (D.type === 'edge' || D.type === 'screw')) { s.axis = D.line; s.layer = null; return; }
    const T = D && getType(D.type);
    if (T && T.sliceAxis) {
      // across the line when it runs along a cube axis; otherwise the middle layer
      const axis = T.sliceAxis(D, ctx);
      if (axis != null) s.axis = axis;
      s.layer = null;
      return;
    }
    if (!it.at) { s.layer = null; return; }
    s.axis = 2;
    const layers = M.sliceLayers(ctx.basis, ctx.repeats, 2), half = (layers[1] - layers[0]) / 2;
    s.layer = Math.max(0, layers.findIndex(v => Math.abs(v - it.at[2]) < half + 1e-6));
  }

  setSliceAxis(axis) {
    const s = this.state.slice;
    if (s.axis === axis) return;
    s.axis = axis;
    s.layer = null;
    this.rebuild();
    this.lookAtSlice();
  }

  stepSlice(d) {
    const sl = this.ctx.slice;
    if (!sl) return;
    this.state.slice.layer = Math.max(0, Math.min(sl.count - 1, sl.index + d));
    this.rebuild();
  }

  /** Look straight along the slice's axis and fit the layer in view. */
  lookAtSlice() {
    if (!this.view || !this.ctx.slice) return;
    const L = this.ctx.lattice, k = this.ctx.slice.axis;
    this.view.frame({ along: [L.vectors[k], k === 2 ? L.vectors[1] : L.vectors[2]], margin: 1.04 });
  }
}

Object.assign(DefectsWorkspace.prototype, placeMethods);
