/* =====================================================================
   SceneModel — the state of the Crystal Structures mode without any DOM:
   lattice choice, supercell and highlighted cell, scene objects, added
   items, the context `ctx` that object types read, names, adding objects
   and the input bar's commands.

   CrystalWorkspace (src/ui/workspace/workspace.js) extends this class and
   adds rendering on top (it overrides addItem / itemChanged to redraw).
   Tests use SceneModel directly.

   Objects belong to a view: item.dim is '3d' or '2d' (from the type's
   `dim`, default '3d'). Names are unique within a view, and the panel, the
   pickers and the input bar only see the objects of the current view.
   ===================================================================== */
import * as M from '../math/index.js';
import { findBravais, latticeBasis, defaultSetting, defaultParams, usesHexAxes, effectiveSystem } from '../data/bravais.js';
import { SYSTEMS } from '../data/systems.js';
import { defaultFlatState, flatContext } from '../data/bravais2d.js';
import { getType, itemLabelHTML } from './registry.js';
import { validateName, nextName } from './names.js';
import { commandList, runLine } from './commands.js';
import './index.js';

/** Colours handed out to new objects, in order. */
export const PALETTE = ['#FF7A59', '#14B8A6', '#E2559B', '#F5A524', '#3E9BF0', '#9B6CFF', '#4CAF50', '#5965F0'];

/** Theme colours when no stylesheet is around (tests); the workspace reads the real ones from CSS. */
const DEFAULT_THEME = {
  stage: '#FAFAF8', cell: '#0B0B0C', points: '#1F3BFF', primary: '#1F3BFF', grid: '#CFCFCA',
  axisA: '#E5484D', axisB: '#23A26D', axisC: '#3F73F0', axisA3: '#D98200', angle: '#9B6CFF', highlight: '#E8890C',
  siteOct: '#EA7A00', siteTet: '#D6409F', siteCub: '#0E9F9A', good: '#12A06B', bad: '#D93A30',
  movedLow: '#F1C3A8', movedMid: '#EB6834', movedHigh: '#8C2E0B', squeeze: '#1C5CAB', strainMid: '#BDBCB6', stretch: '#C23B3A',
};

/** Plain text from label HTML (bars over negatives become combining overlines). No DOM needed. */
export function plainText(html) {
  return String(html)
    .replace(/<span class="ob">(\d+)<\/span>/g, (_, d) => [...d].map(ch => `${ch}̅`).join(''))
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/g, ' ').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&amp;/g, '&');
}

/** Defects mode: a bigger block of atoms (touching spheres, drawn smaller so defects inside show) and a 2D slice instead of the 2D lattices. */
const DEFECTS_STATE = () => ({
  repeats: [5, 5, 5],
  slice: { on: false, axis: 2, layer: null }, // layer null: the middle (or the newest defect's) layer
  scene: [
    { id: 'atoms', type: 'atoms', visible: true, label: null, colour: null, transparency: 0, expanded: false, mode: 'spheres', size: { points: 100, spheres: 50 }, colourBy: 'moved', exaggerate: 1, ghosts: false },
    { id: 'edges', type: 'cell-edges', visible: true, label: null, colour: null, transparency: 0, expanded: false, thickness: 100, highlight: false, allCells: false, gridThickness: 50, gridColour: null },
    { id: 'axes', type: 'axes', visible: true, label: null, colour: null, transparency: 0, expanded: false, angles: true, legend: true },
  ],
});

function initialState(mode) {
  const b = findBravais('cP');
  const state = {
    mode,                 // 'crystal' (Crystal Structures) or 'defects'
    latticeId: b.id,
    setting: defaultSetting(b),
    params: defaultParams(b, defaultSetting(b)),
    repeats: [1, 1, 1],
    cell: [1, 1, 1],      // highlighted cell, numbered from 1
    corner: [0, 0, 0],    // which corner of it is the origin
    advanced: false,      // always starts in Basic mode
    cut: false,           // cut spheres at the boundary of the highlighted cell
    hexCell: 'primitive', // hexagonal P: 'primitive' cell or 'prism'
    ortho: false,
    lambda: 1.5406,
    dim: '3d',            // '3d' or '2d'
    flat: defaultFlatState(), // 2D lattice, parameters and n × n size
    scene: [
      { id: 'points', type: 'lattice-points', visible: true, label: null, colour: null, transparency: 0, expanded: false, mode: 'points', size: { points: 100, spheres: 100 }, bonds: false, solid: true },
      { id: 'edges', type: 'cell-edges', visible: true, label: null, colour: null, transparency: 0, expanded: false, thickness: 100, highlight: true, allCells: false, gridThickness: 50, gridColour: null },
      { id: 'axes', type: 'axes', visible: true, label: null, colour: null, transparency: 0, expanded: false, angles: true, legend: true },
    ],
    items: [],
    latticeItem: { id: 'lattice', type: 'lattice', visible: true, label: null, colour: null, transparency: 0, expanded: false },
  };
  return mode === 'defects' ? { ...state, ...DEFECTS_STATE() } : state;
}

export class SceneModel {
  /** mode: 'crystal' (Crystal Structures) or 'defects'. */
  constructor({ mode = 'crystal' } = {}) {
    this.state = initialState(mode);
    this.uid = 0;
    this.colourIndex = 0;
    this.theme = { ...DEFAULT_THEME };
  }

  // ---------------------------------------------------------------- views
  is2D() { return this.state.dim === '2d'; }

  isDefects() { return this.state.mode === 'defects'; }

  /** Objects of the view that is shown. */
  viewItems() {
    return this.state.items.filter(i => (i.dim || '3d') === this.state.dim);
  }

  /** Hexagonal P drawn as the hexagonal prism (3 primitive cells) instead of the primitive cell. */
  isPrism() {
    return this.state.latticeId === 'hP' && this.state.hexCell === 'prism';
  }

  // ---------------------------------------------------------------- context
  /** The axes drawn for the current cell, each in its fixed colour (a1, a2, a3, c for the hexagonal prism). */
  axesFor(L, prism) {
    const t = this.theme, [A, B, C] = L.vectors;
    if (prism) {
      return {
        axes: [
          { key: 'a1', html: 'a<sub>1</sub>', vec: A, colour: t.axisA },
          { key: 'a2', html: 'a<sub>2</sub>', vec: B, colour: t.axisB },
          { key: 'a3', html: 'a<sub>3</sub>', vec: M.scale(M.add(A, B), -1), colour: t.axisA3 },
          { key: 'c', html: 'c', vec: C, colour: t.axisC },
        ],
        angles: [{ sym: 'α', from: 'a2', to: 'c' }, { sym: 'β', from: 'a1', to: 'c' }, { sym: 'γ', from: 'a1', to: 'a2' }],
      };
    }
    return {
      axes: [
        { key: 'a', html: 'a', vec: A, colour: t.axisA },
        { key: 'b', html: 'b', vec: B, colour: t.axisB },
        { key: 'c', html: 'c', vec: C, colour: t.axisC },
      ],
      angles: [{ sym: 'α', from: 'b', to: 'c' }, { sym: 'β', from: 'a', to: 'c' }, { sym: 'γ', from: 'a', to: 'b' }],
    };
  }

  /** Build `ctx` (everything object types read) from the state, and re-derive every item. */
  recompute() {
    const s = this.state, b = findBravais(s.latticeId);
    const basis = latticeBasis(b, s.setting);
    const analysis = M.analyse(s.params, basis);
    const isPrism = this.isPrism();
    // the highlighted cell (one prism of the honeycomb field in prism view) and the origin at
    // one of its corners (the centre of the bottom face for a prism)
    s.cell = M.clampCell(s.cell, s.repeats);
    const cellOrigin = isPrism ? M.prismOrigin(s.cell) : M.cellOrigin(s.cell);
    const origin = isPrism ? cellOrigin : M.add(cellOrigin, s.corner);
    const unitRegion = M.translateRegion(isPrism ? M.hexPrismRegion(1) : M.boxRegion([1, 1, 1]), cellOrigin);
    const region = { ...(isPrism ? M.prismFieldRegion(s.repeats) : M.boxRegion(s.repeats)) };
    region.first = unitRegion.edges;
    region.firstHalfspaces = unitRegion.halfspaces;
    // planes need a convex region: in a field of prisms, the column of the highlighted prism
    const column = region.parts && region.parts.find(p => p.column[0] === s.cell[0] && p.column[1] === s.cell[1]);
    const planeRegion = column ? { ...column, first: unitRegion.edges, firstHalfspaces: unitRegion.halfspaces } : region;
    const sites = M.sitesInRegion(basis, region);
    const hexAxes = usesHexAxes(b, s.setting);
    s.flat.cell = M.clampCell(s.flat.cell, [s.flat.n, s.flat.n]);
    const plane2d = flatContext(s.flat);
    const items = this.viewItems();
    const ctx = this.ctx = {
      ws: this, bravais: b, setting: s.setting, params: s.params, basis, analysis, lattice: analysis.lattice, sites,
      repeats: s.repeats, region, unitRegion, planeRegion, isPrism, hexAxes, advanced: s.advanced,
      cell: s.cell, cellOrigin, origin, corner: isPrism ? [0, 0, 0] : s.corner,
      lambda: s.lambda, items, L0: Math.cbrt(analysis.lattice.volume),
      itemById: id => s.items.find(i => i.id === id),
      label: item => this.labelHTML(item),
      labelText: item => plainText(this.labelHTML(item)),
      colour: item => this.resolveColour(item),
      opacity: item => 1 - item.transparency / 100,
      pointRadius: 0,
      theme: this.theme,
      dim: s.dim,
      mode: s.mode,
      slice: s.mode === 'defects' ? M.sliceOf(basis, s.repeats, s.slice) : null, // the 2D slice of Defects mode (null in 3D)
      plane2d,                                // the 2D lattice, always (2D objects read this)
      flat: s.dim === '2d' ? plane2d : null,  // set only while the 2D view is shown
    };
    ctx.pointRadius = this.pointRadius();
    ctx.cut = s.cut;
    const P = s.scene[0];
    ctx.pointStyle = { visible: P.visible, colour: this.resolveColour(P), opacity: ctx.opacity(P), solid: P.solid !== false };
    const ax = this.axesFor(ctx.lattice, isPrism);
    ctx.axes = ax.axes;
    ctx.axisAngles = ax.angles;
    ctx.originCart = ctx.lattice.toCartesian(origin);
    for (const it of s.items) {
      const T = getType(it.type);
      if (T.refresh) T.refresh(it, ctx);
    }
    return ctx;
  }

  pointRadius() {
    const P = this.state.scene[0], dnn = this.ctx.flat ? this.ctx.flat.dnn : this.ctx.analysis.neighbours.dnn;
    // flat 2D dots have no perspective, so they are drawn a little smaller than in 3D
    const base = P.mode === 'spheres' ? dnn / 2 : (this.ctx.flat ? 0.065 : 0.09) * dnn;
    return base * P.size[P.mode] / 100;
  }

  resolveColour(item) {
    if (item.colour) return item.colour;
    if (item.type === 'lattice-points' || item.type === 'atoms') return this.theme.points;
    if (item.type === 'cell-edges') return this.theme.cell;
    return '#8890A8';
  }

  // ---------------------------------------------------------------- lattice
  /**
   * Show another Bravais lattice, optionally with some of its parameters (the rest
   * follow the crystal system's rules, e.g. b = c = a in cubic). No drawing here:
   * the workspace redraws. Used by objects that need their own lattice (ionic structures).
   */
  applyLattice(id, params = null) {
    const b = findBravais(id), s = this.state;
    s.latticeId = id;
    s.setting = defaultSetting(b);
    const sys = SYSTEMS[effectiveSystem(b, s.setting)];
    s.params = sys.derive({ ...defaultParams(b, s.setting), ...(params || {}) });
    this.recompute();
  }

  // ---------------------------------------------------------------- names
  /** Name + indices (or title), e.g. "d1 [110]". */
  labelHTML(item) {
    return itemLabelHTML(item, this.ctx);
  }

  takenNames(except = null) {
    return this.viewItems().filter(i => i !== except && i.name).map(i => i.name);
  }

  freeName(prefix) {
    return nextName(prefix, this.takenNames());
  }

  byName(name) {
    return this.viewItems().find(i => i.name === name);
  }

  /** The + Add entries and commands of this mode's types (types say `mode: 'defects'`; the rest belong to Crystal Structures). */
  inMode(T) {
    return (T.mode || 'crystal') === this.state.mode;
  }

  /** Friendly checks for a new or changed name; null when it is fine. */
  nameProblem(name, except = null) {
    return validateName(name, this.takenNames(except), commandList().map(c => c.name));
  }

  // ---------------------------------------------------------------- objects
  /**
   * Add an object to the view that is shown. With { validate: true } an item whose
   * input is invalid is not added and { error } is returned instead. Subclasses
   * redraw unless { quiet: true }. The type's afterAdd note is kept in this.addNote.
   */
  addItem(type, init = {}, { validate = false } = {}) {
    if (!this.ctx) this.recompute();
    const T = getType(type);
    // a type may set the scene up first, e.g. an ionic structure switches to its own lattice
    if (T.prepare) T.prepare(init, this);
    const { name, ...rest } = init;
    const item = {
      id: ++this.uid, type, dim: T.dim || '3d', visible: true, name: name || this.freeName(T.prefix || 'obj'),
      colour: T.appearance ? PALETTE[this.colourIndex % PALETTE.length] : null,
      transparency: T.defaultTransparency ?? 0,
      expanded: !!T.expandOnAdd,
      ...T.create(rest, this.ctx),
    };
    const error = T.error ? T.error(item, this.ctx) : null;
    if (validate && error) { this.uid--; return { error }; }
    if (T.appearance) this.colourIndex++;
    this.state.items.push(item);
    this.ctx.items = this.viewItems();
    this.addNote = T.afterAdd ? T.afterAdd(item, this.ctx, this) : '';
    return item;
  }

  /** Something changed an item: re-derive everything that depends on it (subclasses redraw). */
  itemChanged() {
    this.recompute();
  }

  removeItem(item) {
    const at = this.state.items.indexOf(item);
    if (at >= 0) this.state.items.splice(at, 1);
    this.recompute();
  }

  /**
   * The plane or direction (or 2D line / direction) with these indices: an existing
   * one in this view, or a new one. → the item (new items carry __new) or { error }.
   */
  sourceFromText(kind, text, { quiet = true } = {}) {
    const T = getType(kind);
    const parsed = T.parseText(String(text).trim(), this.ctx, true);
    if (parsed.error) return { error: parsed.error };
    const key = T.indicesOf(parsed).join();
    const found = this.viewItems().find(i => i.type === kind && !i.source && !i.parsed.error && T.indicesOf(i.parsed).join() === key);
    if (found) return found;
    const item = this.addItem(kind, { text: String(text).trim() }, { quiet, validate: true });
    if (!item.error) item.__new = true;
    return item;
  }

  // ---------------------------------------------------------------- input bar
  /** Run one line of the input bar (see runLine in commands.js). */
  runCommand(text) {
    return runLine(this, text);
  }
}
