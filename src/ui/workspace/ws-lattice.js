/* CrystalWorkspace methods: lattice, parameters, supercell, highlighted cell, display options and the 2D setters. */
import * as M from '../../math/index.js';
import { findBravais, defaultParams, effectiveSystem } from '../../data/bravais.js';
import { SYSTEMS } from '../../data/systems.js';
import { $, $$, showError } from '../dom.js';
import { toast } from '../components/toast.js';
import { closeAllPopovers } from '../components/popover.js';
import { trim } from '../format.js';
import { helpButton } from '../controls.js';
import { findBravais2D } from '../../data/bravais2d.js';
import { validateParams2D } from '../../math/lattice2d.js';
import { txt } from '../../text.js';

export const latticeMethods = {
  setLattice(id) {
    if (id === this.state.latticeId) return;
    const b = findBravais(id);
    this.applyLattice(id);
    toast(txt('msgLattice', { name: b.name, longName: b.longName }), { icon: 'cube', tone: 'info' });
  },

  setSetting(setting) {
    const s = this.state;
    if (s.latticeId !== 'hR' || setting === s.setting) return;
    s.params = setting === 'hexagonal' ? M.rhombohedralToHexagonal(s.params) : M.hexagonalToRhombohedral(s.params);
    s.setting = setting;
    this.rebuild({ frame: true });
    toast(setting === 'hexagonal' ? txt('msgHexSetting') : txt('msgRhombSetting'), { icon: 'cube', tone: 'info' });
  },

  /**
   * A lattice parameter is typed (data-param in 3D, data-param2 in 2D): check it, apply it
   * and refresh every card except the Lattice card itself (keeps focus).
   */
  onParamInput(input) {
    const flat = this.is2D(), s = flat ? this.state.flat : this.state, attr = flat ? 'param2' : 'param';
    const sys = flat ? this.ctx.flat.system : SYSTEMS[effectiveSystem(this.ctx.bravais, s.setting)];
    const host = this.dom.sceneList;
    const q = { ...s.params };
    for (const k of sys.editable) q[k] = parseFloat($(`[data-${attr}="${k}"]`, host).value);
    const p = sys.derive(q);
    const problem = flat ? validateParams2D(p) : M.validateParams(p);
    showError(input, $(`[data-lc="${flat ? 'error2' : 'error'}"]`, host), problem);
    if (problem) return;
    s.params = p;
    for (const el of $$(`[data-${attr}]`, host)) if (el !== document.activeElement) el.value = trim(p[el.dataset[attr]], 4);
    this.recompute();
    this.renderScene();
    for (const it of this.state.scene) this.replaceCard(it);
    this.updateSummary(this.state.latticeItem);
    if (!flat) this.renderItemList();
  },

  resetParams() {
    const b = this.ctx.bravais;
    this.state.params = defaultParams(b, this.state.setting);
    this.rebuild({ frame: true });
  },

  setRepeats(repeats) {
    this.state.repeats = repeats;
    this.recompute();
    this.renderScene();
    this.refreshCards();
    if (this.view) this.view.frame();
  },

  /** Highlight another cell (numbered from 1); its chosen corner becomes the origin. 2D keeps its own. */
  setCell(cell) {
    (this.is2D() ? this.state.flat : this.state).cell = [...cell];
    this.originChanged();
  },

  /** Which corner of the highlighted cell is the origin: [0|1, 0|1, 0|1] (2D: [0|1, 0|1]). */
  setCorner(corner) {
    (this.is2D() ? this.state.flat : this.state).corner = [...corner];
    this.originChanged();
  },

  /** The highlighted-cell part of the Add cells drawer (in 2D for the 2D cell). */
  cellPickerHTML() {
    const flat = this.ctx.flat, ctx = flat ? { ...flat, isPrism: false } : this.ctx;
    const r = flat ? [flat.n, flat.n, 1] : this.state.repeats, [ci, cj, ck] = ctx.cell, O = ctx.origin;
    const name = (i, j) => (flat ? `${i},${j}` : `${i},${j},${ck}`);
    const hint = `<p class="field-hint">${txt(ctx.isPrism ? 'cellsPickHintPrism' : 'cellsPickHintCell', { view: flat ? txt('topDim2D') : txt('topDim3D') })}</p>`;
    const grid = [];
    for (let j = r[1]; j >= 1; j--) {
      for (let i = 1; i <= r[0]; i++) grid.push(`<button type="button" data-cf-cell="${i},${j}" aria-pressed="${i === ci && j === cj}" title="${txt('cellName', { cell: name(i, j) })}">${i},${j}</button>`);
    }
    const corners = [];
    for (const z of flat ? [null] : [0, 1]) for (const y of [0, 1]) for (const x of [0, 1]) {
      const c = z == null ? [x, y] : [x, y, z];
      corners.push(`<button type="button" class="chip-btn" data-cf-corner="${c.join(',')}" aria-pressed="${c.join() === ctx.corner.join()}">(${c.join(' ')})</button>`);
    }
    const multi = r[0] * r[1] * r[2] > 1;
    const layer = r[2] > 1
      ? `<label class="field-label range-label"><span>${txt('cellsLayer')}</span><output data-cf-out>${txt('cellsLayerOf', { value: ck, max: r[2] })}</output></label>
        <input class="range" type="range" min="1" max="${r[2]}" step="1" value="${ck}" data-cf="layer" style="--p:${((ck - 1) / (r[2] - 1)) * 100}%" aria-label="${txt('cellsLayer')}">`
      : '';
    const picker = multi
      ? `${hint}${layer}<div class="cf-grid" style="--cols:${r[0]}" role="group" aria-label="${txt(ctx.isPrism ? 'cellsGridPrisms' : 'cellsGridCells')}">${grid.join('')}</div>`
      : `<p class="field-hint">${txt(ctx.isPrism ? 'cellsBiggerPrism' : 'cellsBiggerCell')}</p>`;
    if (ctx.isPrism) {
      return `<section class="cf-sec"><h4>${txt('cellsHighlightedPrism')}${helpButton('origin')}</h4>
        <p class="cf-cell">${txt('cellsPrismHead', { cell: ctx.cell.join(','), origin: O.map(x => trim(x)).join(', ') })}</p>
        ${picker}
        <p class="field-hint">${txt('cellsPrismNoCorner')}</p></section>`;
    }
    return `<section class="cf-sec"><h4>${txt('cellsHighlightedCell')}${helpButton('origin')}</h4>
      <p class="cf-cell">${txt('cellsCellHead', { cell: ctx.cell.join(','), origin: O.join(', ') })}</p>
      ${picker}
      <div class="field-label">${txt('cellsCornerLabel')}</div>
      <div class="chip-row cf-corners">${corners.join('')}</div>
      <p class="field-hint">${flat ? txt('cellsOriginNote2D') : txt('cellsOriginNote3D')}</p></section>`;
  },

  /** Clicks and slider moves inside the Add cells drawer; true when it should re-render. */
  onCellPicker(e, el) {
    const t = e.target, [ci, cj, ck] = (this.ctx.flat || this.ctx).cell;
    if (e.type === 'input' && t.dataset.cf === 'layer') {
      this.setCell([ci, cj, +t.value]);
      t.style.setProperty('--p', `${((+t.value - 1) / (+t.max - 1)) * 100}%`);
      const out = el.querySelector('[data-cf-out]');
      if (out) out.textContent = txt('cellsLayerOf', { value: t.value, max: t.max });
      const head = el.querySelector('.cf-cell'), c = this.ctx;
      if (head) {
        head.innerHTML = c.isPrism
          ? txt('cellsPrismHead', { cell: c.cell.join(','), origin: c.origin.map(x => trim(x)).join(', ') })
          : txt('cellsCellHead', { cell: c.cell.join(','), origin: c.origin.join(', ') });
      }
      return false;
    }
    if (e.type !== 'click') return false;
    const c = t.closest('[data-cf-cell]'), corner = t.closest('[data-cf-corner]');
    if (c) { const [i, j] = c.dataset.cfCell.split(',').map(Number); this.setCell(this.ctx.flat ? [i, j] : [i, j, ck]); return true; }
    if (corner) { this.setCorner(corner.dataset.cfCorner.split(',').map(Number)); return true; }
    return false;
  },

  originChanged() {
    this.recompute();
    this.renderScene();
    this.refreshCards();
  },

  setCut(on) {
    this.state.cut = on;
    this.ctx.cut = on;
    this.renderScene(); // the lattice, and objects that cut at the cell too (e.g. filled interstitial holes)
    this.renderReadout();
    this.replaceCard(this.state.scene[0]);
  },

  setDisplayMode(mode) {
    const P = this.state.scene[0];
    if (P.mode === mode) return;
    P.mode = mode;
    this.sceneObjectChanged(P, { card: true });
  },

  setAdvanced(on) {
    this.state.advanced = on;
    document.documentElement.classList.toggle('is-advanced', on);
    this.dom.advanced.checked = on;
    if (!on && this.state.ortho) this.setProjection(false);
    this.rebuild();
    toast(on
      ? txt('msgAdvancedOn')
      : txt('msgAdvancedOff'), { icon: on ? 'layers' : 'check', tone: 'info' });
  },

  setProjection(ortho) {
    this.state.ortho = ortho;
    if (this.view) this.view.setProjection(ortho);
    this.renderToolbar();
  },

  setLambda(v) {
    this.state.lambda = v;
    this.recompute();
    this.refreshCards();
  },

  /** The toolbar's reset: fit the cell, seen from the starting direction. */
  resetView() {
    if (this.view) this.view.frame({ resetDirection: true });
  },

  lookAlong(cartDir) {
    if (this.view) this.view.viewAlong(cartDir, this.ctx.lattice.vectors[1]);
  },

  setDim(dim) {
    if (dim === this.state.dim) return;
    closeAllPopovers();
    if (this.flatView.pick) this.endVectorPick();
    this.state.dim = dim;
    const flat = dim === '2d';
    this.el.classList.toggle('is-2d', flat);
    if (this.view) this.view.setActive(!flat);
    this.rebuild();
    if (flat) requestAnimationFrame(() => { this.flatView.resize(); this.flatView.frame(); });
    else if (this.view) requestAnimationFrame(() => this.view.resize());
    toast(flat ? txt('msg2DView') : txt('msg3DView'), { icon: 'cube', tone: 'info' });
  },

  setFlatLattice(id) {
    const b = findBravais2D(id), fs = this.state.flat;
    if (id === fs.latticeId) return;
    fs.latticeId = id;
    fs.params = { ...b.params };
    this.rebuild({ frame: true });
    toast(txt(b.centring === 'c' ? 'msgLattice2DCentred' : 'msgLattice2DPrimitive', { name: b.name }), { icon: 'cube', tone: 'info' });
  },

  setFlatSize(n) {
    this.state.flat.n = n;
    this.recompute();
    this.renderScene();
    this.refreshCards();
    this.flatView.frame();
  },

  /** Hexagonal P: show the primitive cell or the hexagonal prism of 3 cells. */
  setHexCell(mode) {
    if (this.state.hexCell === mode) return;
    this.state.hexCell = mode;
    this.rebuild({ frame: true });
    toast(mode === 'prism'
      ? txt('msgPrism')
      : txt('msgPrimitiveCell'), { icon: 'cube', tone: 'info' });
  },
};
