/* CrystalWorkspace methods: drawing the 3D and 2D views, the status line, legends and the readout. */
import * as M from '../../math/index.js';
import { getType } from '../../objects/index.js';
import { $ } from '../dom.js';
import { icon } from '../icons.js';
import { helpButton } from '../controls.js';
import { countFormula } from '../format.js';
import { snapTargets2D } from '../../math/lattice2d.js';
import { txt } from '../../text.js';

export const renderMethods = {
  /** "2 × 2 × 2", "prisms 2 × 2 × 1" for a field of hexagonal prisms, or "3 × 3" in 2D. */
  sizeText() {
    if (this.is2D()) return `${this.state.flat.n}×${this.state.flat.n}`;
    return this.isPrism() ? txt('sizePrisms', { size: this.state.repeats.join('×') }) : this.state.repeats.join('×');
  },

  renderStatus() {
    const flat = this.ctx.flat;
    const n = flat ? flat.sites.length : this.ctx.sites.length;
    const name = flat ? txt('status2DName', { name: flat.bravais.name }) : this.ctx.bravais.name;
    const multi = flat ? flat.n > 1 : this.ctx.region.cells > (this.ctx.isPrism ? 3 : 1);
    const cellNote = multi ? ` · ${txt(this.ctx.isPrism && !flat ? 'statusPrism' : 'statusCell', { cell: (flat || this.ctx).cell.join(',') })}` : '';
    this.dom.status.innerHTML = txt(n === 1 ? 'statusOne' : 'statusMany', { name, size: this.sizeText(), cell: cellNote, count: n });
    this.dom.hint.textContent = flat ? txt('stageHint2D') : txt('stageHint3D');
    this.renderReadout();
    this.renderLegend();
  },

  /** The first visible object (scene objects first) whose type answers hook(item, ctx) with something, e.g. a legend. */
  hookResult(hook) {
    if (this.is2D()) return null;
    for (const it of [...this.state.scene, ...this.viewItems()]) {
      const T = getType(it.type);
      if (!it.visible || !T[hook]) continue;
      const res = T[hook](it, this.ctx);
      if (res) return { item: it, res };
    }
    return null;
  },

  /** Legends on the canvas: hexagonal axes, and the ions of an ionic structure. */
  renderLegend() {
    this.renderHexLegend();
    const box = this.dom.ionLegend, hit = this.hookResult('legend');
    box.hidden = !hit;
    if (!hit) return;
    const L = hit.res;
    box.innerHTML = `<div class="hl-head"><b>${L.title}${L.help ? helpButton(L.help, { item: hit.item.id }) : ''}</b></div>
      <ul class="il-rows">${L.rows.map(r => `<li>${r}</li>`).join('')}</ul>${L.foot ? `<p class="il-foot">${L.foot}</p>` : ''}`;
  },

  /** Hexagonal axes: a small legend linking a1, a2, a3, c to a, b and to the indices. */
  renderHexLegend() {
    const A = this.state.scene[2], box = this.dom.legend;
    const show = !this.is2D() && this.ctx.hexAxes && A.legend;
    box.hidden = !show;
    if (!show) return;
    const ax = (n, c) => `<i style="color:var(--axis-${c})">a<sub>${n}</sub></i>`;
    box.innerHTML = `<div class="hl-head"><b>${txt('hexAxes')}${helpButton('miller-bravais')}</b>
        <button type="button" class="icon-btn hl-close" data-act="hide-legend" title="${txt('hexLegendHideTitle')}" aria-label="${txt('hexLegendHideLabel')}">${icon('x')}</button></div>
      <p>${txt('hexLegendAxes', { a1: ax(1, 'a'), a2: ax(2, 'b'), a3: ax(3, 'a3') })}</p>
      <p>${txt('hexLegendIndices', { a1: ax(1, 'a'), a2: ax(2, 'b'), a3: ax(3, 'a3') })}</p>`;
  },

  /** With cutting on and a single cell shown: how the cut pieces add up, e.g. "8 × ⅛ + 6 × ½ = 4". */
  renderReadout() {
    const ctx = this.ctx, flat = ctx.flat;
    const show = this.state.cut;
    this.dom.readout.hidden = !show;
    if (!show) return;
    const multi = !flat && ctx.region.cells > (ctx.isPrism ? 3 : 1);
    const which = multi ? ` (${ctx.cell.join(',')})` : '';
    // an object may count its own atoms instead (an ionic structure counts its ions)
    const own = this.hookResult('readout');
    this.dom.readout.classList.toggle('is-multi', !!own);
    if (own) {
      const R = own.res;
      this.dom.readout.innerHTML = `<small>${R.label}${which}</small>${R.rows.map(r => `<b>${r}</b>`).join('')}${R.help ? helpButton(R.help, { item: own.item.id }) : ''}`;
      return;
    }
    const count = flat ? flat.count : M.pointCount(ctx.basis, ctx.unitRegion);
    this.dom.readout.innerHTML = `<small>${txt(ctx.isPrism && !flat ? 'readoutPerPrism' : 'readoutPerCell')}${which}</small><b>${countFormula(count)}</b>${flat ? '' : helpButton('calc-points')}`;
  },

  /** The 2D view: same scene objects (points, edges, axes), drawn flat. */
  renderFlat() {
    const ctx = this.ctx, fc = ctx.flat, [P, E, A] = this.state.scene;
    if (!fc) return;
    this.flatView.snapTargets = snapTargets2D(fc.basis, fc.n);
    this.flatView.objects = this.viewItems().map(it => ({ id: it.id, visible: it.visible, prims: this.primsOf(it) }));
    this.flatView.setModel({
      lattice: fc.lattice, sites: fc.sites, n: fc.n, cellOrigin: fc.cellOrigin, origin: fc.origin, cut: this.state.cut, clipId: 'flat-cell-clip',
      points: { visible: P.visible, radius: ctx.pointRadius, colour: this.resolveColour(P), opacity: ctx.opacity(P) },
      edges: this.edgeStyle(E),
      axes: { visible: A.visible, colourA: this.theme.axisA, colourB: this.theme.axisB, angleColour: this.theme.angle },
    });
  },

  /** How the cell edges are drawn, in 3D and 2D alike. */
  edgeStyle(E) {
    const ctx = this.ctx;
    return {
      visible: E.visible, colour: this.resolveColour(E), opacity: ctx.opacity(E), thickness: E.thickness / 100,
      highlight: E.highlight, highlightColour: this.theme.primary,
      allCells: E.allCells, gridColour: E.gridColour || this.theme.grid, gridThickness: E.gridThickness / 100,
    };
  },

  renderLattice() {
    if (this.is2D()) { this.renderFlat(); return; }
    if (!this.view) return;
    const ctx = this.ctx, [P, E] = this.state.scene, L = ctx.lattice, R = ctx.region;
    const seg = list => list.map(([p, q]) => [L.toCartesian(p), L.toCartesian(q)]);
    ctx.pointStyle = { visible: P.visible, colour: this.resolveColour(P), opacity: ctx.opacity(P) };
    this.view.setLattice({
      lattice: L, sites: ctx.sites,
      cell: {
        edges: seg(R.edges), grid: seg(R.grid), first: seg(R.first), vertices: R.vertices.map(v => L.toCartesian(v)), multi: R.cells > (ctx.isPrism ? 3 : 1),
        pad: Math.max(0, ...this.viewItems().map(it => { const T = getType(it.type); return it.visible && T.framePad ? T.framePad(it, ctx) || 0 : 0; })),
        frame: this.framePoints ? this.framePoints() : null,
      },
      shared: this.state.cut ? new Set(ctx.sites.map((st, i) => (st.inOriginal && M.shareOf(st.f, ctx.unitRegion) < 1 ? i : -1)).filter(i => i >= 0)) : null,
      points: {
        visible: P.visible && !this.pointsTakenOver(), radius: ctx.pointRadius, colour: this.resolveColour(P), opacity: ctx.opacity(P),
        // cutting follows the highlighted cell; the other cells' points stay (faded) and are cut at the supercell edge
        clip: this.state.cut ? M.regionPlanes(ctx.unitRegion, L) : null,
        clipOutside: this.state.cut ? M.regionPlanes(R, L) : null,
        clipParts: this.state.cut && R.parts
          ? R.parts.map(part => ({ clip: M.regionPlanes(part, L), has: i => M.insideRegion(ctx.sites[i].f, part.halfspaces) }))
          : null,
        cut: this.state.cut,
        solid: P.solid !== false,
      },
      edges: this.edgeStyle(E),
      bonds: ctx.advanced && P.bonds ? M.bondPairs(ctx.lattice, ctx.sites, ctx.analysis.neighbours) : null,
      axes: ctx.axes.map(a => ({ vec: a.vec, label: a.html, colour: a.colour })),
    });
    // objects drawing the lattice points themselves follow their size, colour and cutting
    for (const it of this.viewItems()) {
      const T = getType(it.type);
      if (T.hidesLatticePoints && T.hidesLatticePoints(it, ctx)) this.renderItemScene(it);
    }
  },

  /** True while an object (e.g. a focused atom fit) draws the lattice points itself. */
  pointsTakenOver() {
    return this.viewItems().some(it => {
      const T = getType(it.type);
      return it.visible && T.hidesLatticePoints && T.hidesLatticePoints(it, this.ctx);
    });
  },

  /** Redraw one object and the lattice, keeping its card (for sliders and toggles); { card: true } rebuilds the card too. */
  redraw(item, { card = false } = {}) {
    this.renderLattice();
    this.renderItemScene(item);
    this.updateSummary(item);
    this.refreshLive(item);
    // the definition line follows too (e.g. fit1 = Fit(oct, 0.35) after typing a radius)
    const T = getType(item.type), li = T.definition && this.card(item), code = li && $('.def-code', li);
    if (code) code.textContent = T.definition(item, this.ctx);
    if (card) this.replaceCard(item);
  },

  /** An item's primitives; a type that fails to draw shows nothing (and logs why). */
  primsOf(item) {
    const T = getType(item.type);
    try {
      return T.primitives ? T.primitives(item, this.ctx) : [];
    } catch (err) {
      console.error(`Drawing ${item.type} failed`, err);
      return [];
    }
  },

  renderItemScene(item) {
    if ((item.dim || '3d') === '2d') { if (this.is2D()) this.renderFlat(); return; }
    if (!this.view) return;
    this.view.setObject(item.id, this.primsOf(item), { visible: item.visible });
  },

  renderScene() {
    if (this.is2D()) this.renderFlat();
    else if (this.view) {
      this.renderLattice();
      const keep = new Set(['cell-preview', 'help-highlight']);
      for (const it of this.state.scene) if (getType(it.type).primitives) { keep.add(it.id); this.renderItemScene(it); }
      for (const it of this.viewItems()) { keep.add(it.id); this.renderItemScene(it); }
      this.view.pruneObjects(keep);
      this.renderHelpHighlight();
    }
    this.renderStatus(); // legends and the readout follow the objects (e.g. an ionic structure)
  },

  /** The SEE MORE panel's highlight in the 3D view (drawn on top of the scene, removed when the panel closes). */
  renderHelpHighlight() {
    if (!this.view) return;
    const prims = this.help ? this.help.highlightPrims() : null;
    if (prims) this.view.setObject('help-highlight', prims);
    else this.view.removeObject('help-highlight');
  },
};
