/* =====================================================================
   Close-packed stacking: ABAB… (HCP) and ABCABC… (FCC).

   'stacking' (Stacking(ABAB), Stacking(ABC), Stacking(FCC)): close-packed
   layers of touching spheres, each layer coloured by its position A, B or C.
   Adding one switches the lattice (type hook `prepare`):
   - ABAB… and ABC… on hexagonal axes: hexagonal P, drawn as the hexagonal
     prism, with the ideal c/a (1.633 for ABAB, 2.449 for ABC);
   - ABC… in the cubic cell: cubic F, the layers are the (111) planes.
   The atoms replace the lattice points and are cut at the highlighted cell
   like lattice points. The card, legend and readout show the atoms per cell,
   the coordination (6 in the layer + 3 above + 3 below), the packing
   fraction and the layer spacing, all from src/math/stacking.js.
   ===================================================================== */
import { registerType } from './registry.js';
import { registerCommand } from './commands.js';
import * as M from '../math/index.js';
import { STACKINGS, findStacking, parseStacking, SPHERE_R, LAYER_COLOURS } from '../data/stacking.js';
import { findBravais, latticeBasis } from '../data/bravais.js';
import { sig, trim, posText } from '../ui/format.js';
import { facts, note, toggle, segmented, actionButton, helpButton, appearanceShell, kindSwatches } from '../ui/controls.js';
import { ionCountText } from './ionic.js';
import { txt } from '../text.js';

const stackingOf = item => findStacking(item.stacking) || STACKINGS[0];
const viewOf = item => (item.view === 'cubic' && stackingOf(item).views.includes('cubic') ? 'cubic' : 'hex');
const latticeIdOf = view => (view === 'cubic' ? 'cF' : 'hP');
/** On hexagonal P, c/a tells ABAB (near 1.633) from ABC (near 2.449). */
const MID_CA = (M.IDEAL_CA.AB + M.IDEAL_CA.ABC) / 2;

/** "ABAB…" or "ABCABC…" */
export const seqText = S => `${S.seq}${S.seq}…`;

/** The stacking is drawn only on its own lattice (and, on hexagonal axes, with its own number of layers per cell). */
function fitsScene(S, view, ctx) {
  if (ctx.bravais.id !== latticeIdOf(view)) return false;
  if (view === 'cubic') return true;
  const ca = ctx.params.c / ctx.params.a;
  return S.seq === 'AB' ? ca < MID_CA : ca >= MID_CA;
}

/** The atoms of one cell: one per layer on hexagonal axes, the cubic F points in the cube. */
const basisOf = (S, view) => (view === 'cubic' ? latticeBasis(findBravais('cF')).map(s => ({ ...s, el: 'X' })) : M.stackingBasis(S.seq));

/** Switch to the stacking's lattice with touching spheres; on hexagonal axes show the hexagonal prism. */
function showOn(ws, S, view) {
  if (view === 'hex') ws.state.hexCell = 'prism';
  const p = M.stackingParams(S.seq, view, SPHERE_R);
  ws.applyLattice(latticeIdOf(view), { a: p.a, c: p.c });
}

/**
 * Everything the card, legend, readout and 3D view need:
 * { S, view, fits, basis, params, r, cn, inLayer, above, below, packing, spacing, layers: [{ letter, colour, own, count }], total, ca, idealCa, letterOf }.
 * When another lattice is on screen the numbers are for the stacking's own cell.
 */
export function stackingInfo(item, ctx) {
  const S = stackingOf(item), view = viewOf(item), fits = fitsScene(S, view, ctx);
  const basis = basisOf(S, view);
  const params = fits ? ctx.params : M.stackingParams(S.seq, view, SPHERE_R);
  const F = M.stackingFacts(params, basis, view);
  const region = fits ? ctx.unitRegion : view === 'cubic' ? M.boxRegion([1, 1, 1]) : M.hexPrismRegion(1);
  const origin = fits ? ctx.cellOrigin : [0, 0, 0];
  const letterOf = f => M.layerOf(f, view, S.seq, origin).letter;
  const letters = view === 'cubic' ? 'ABC' : S.seq;
  const counts = M.layerCounts(basis, region, letterOf);
  const colours = item.colours || {};
  const layers = [...letters].map(letter => ({
    letter, colour: colours[letter] || LAYER_COLOURS[letter], own: !!colours[letter],
    count: counts[letter] || { groups: [], total: 0 },
  }));
  return {
    S, view, fits, basis, params, ...F, origin, letterOf, layers,
    total: M.pointCount(basis, region),
    ca: view === 'hex' ? params.c / params.a : null,
    idealCa: view === 'hex' ? M.IDEAL_CA[S.seq] : null,
  };
}

const sizeOf = item => (item.size === 'small' ? 0.38 : 1);
const layerOfInfo = (info, letter) => info.layers.find(l => l.letter === letter);

/** The sequence with each letter in its layer colour: A B A B … */
function sequenceHTML(info) {
  const letters = [...info.S.seq, ...info.S.seq];
  return `${letters.map(L => `<b style="color:${layerOfInfo(info, L).colour}">${L}</b>`).join(' ')} …`;
}

/** The layers in the highlighted cell as polygons: [{ letter, poly }] (a layer that only touches a corner is left out). */
function layerPlanes(info, ctx) {
  const cubic = info.view === 'cubic', hkl = M.stackingNormal(info.view), base = M.dot(hkl, info.origin);
  const n = cubic ? 3 : info.S.seq.length, out = [];
  for (let k = 0; k <= n; k++) {
    const level = base + (cubic ? k : k / n);
    const poly = M.planePolygonIn(hkl, level, ctx.unitRegion);
    if (poly) out.push({ letter: (cubic ? 'ABC' : info.S.seq)[k % n], poly });
  }
  return out;
}

/** Atoms drawn in the displayed block: [{ f, letter, inOriginal }]. */
const drawnAtoms = (info, ctx) => M.sitesInRegion(info.basis, ctx.region).map(s => ({ ...s, letter: info.letterOf(s.f) }));

function wrongScene(info, ctx) {
  const { S, view } = info, lattice = findBravais(latticeIdOf(view)).name;
  return view === 'cubic'
    ? txt('stackWrongCubic', { seq: seqText(S), current: ctx.bravais.name })
    : txt('stackWrongHex', { seq: seqText(S), lattice, ca: info.idealCa.toFixed(3), current: ctx.bravais.name });
}

function stackAppearance(item, info) {
  const row = l => kindSwatches({
    label: txt('stackLayer', { letter: l.letter }), colour: l.colour, own: l.own,
    act: 'lcol', data: 'letter', key: l.letter, aria: txt('stackColourOf', { letter: l.letter }),
  });
  return appearanceShell(item, info.layers[0].colour, info.layers.map(row).join(''));
}

registerType({
  type: 'stacking',
  prefix: 'stk',
  title: txt('stackTitle'),
  icon: 'layers',
  help: 'stacking',
  appearance: 'eye', // each layer position has its own colour (in the card's Appearance dropdown)
  expandOnAdd: true,
  menu: [
    { key: 'stacking-AB', category: 'stacking', order: 10, title: txt('stackMenuAB'), desc: txt('stackMenuABDesc'), init: { stacking: 'AB', view: 'hex' }, command: 'Stacking(ABAB)', help: 'stacking' },
    { key: 'stacking-ABC', category: 'stacking', order: 11, title: txt('stackMenuABC'), desc: txt('stackMenuABCDesc'), init: { stacking: 'ABC', view: 'hex' }, command: 'Stacking(ABC)', help: 'stacking' },
    { key: 'stacking-FCC', category: 'stacking', order: 12, title: txt('stackMenuFCC'), desc: txt('stackMenuFCCDesc'), init: { stacking: 'ABC', view: 'cubic' }, command: 'Stacking(FCC)', help: 'stacking' },
  ],

  /** Before the item exists: switch to the stacking's lattice with touching spheres. */
  prepare(init, ws) {
    const S = findStacking(init.stacking) || STACKINGS[0];
    showOn(ws, S, init.view === 'cubic' && S.views.includes('cubic') ? 'cubic' : 'hex');
  },

  create(init) {
    const S = findStacking(init.stacking) || STACKINGS[0];
    return { stacking: S.id, view: init.view === 'cubic' && S.views.includes('cubic') ? 'cubic' : 'hex', colours: {}, size: 'full', labels: true, planes: false, legend: true };
  },

  afterAdd(item, ctx) {
    const info = stackingInfo(item, ctx);
    return txt(info.view === 'cubic' ? 'stackAddNoteCubic' : 'stackAddNote', { seq: seqText(info.S), structure: info.S.structure, a: sig(info.params.a), r: sig(info.r) });
  },

  definition: item => `${item.name} = Stacking(${stackingOf(item).seq === 'AB' ? 'ABAB' : viewOf(item) === 'cubic' ? 'FCC' : 'ABC'})`,
  autoLabel: item => `${seqText(stackingOf(item))} · ${stackingOf(item).short}`,

  summary(item, ctx) {
    const info = stackingInfo(item, ctx);
    if (!info.fits) return txt('stackShownOn', { lattice: findBravais(latticeIdOf(info.view)).name });
    return `CN ${info.cn} · ${txt('stackApfShort', { apf: info.packing.toFixed(3) })} · ${txt('stackPerCell', { count: trim(info.total.total, 3) })}`;
  },

  hidesLatticePoints: (item, ctx) => stackingInfo(item, ctx).fits,

  /** Room around the cell when fitting it in view: one sphere. */
  framePad(item, ctx) {
    const info = stackingInfo(item, ctx);
    return info.fits ? info.r * sizeOf(item) : 0;
  },

  settings(item, ctx) {
    const info = stackingInfo(item, ctx), S = info.S;
    if (!info.fits) {
      return note(wrongScene(info, ctx))
        + `<div class="btn-row">${actionButton('show', txt('stackShowAgain', { seq: seqText(S) }), 'layers')}</div>`;
    }
    const hex = info.view === 'hex';
    const ideal = hex && Math.abs(info.ca - info.idealCa) < 1e-4;
    const rows = [
      [`${txt('stackStructure')}${helpButton('stacking', { item: item.id })}`, `<b>${S.structure}</b>`],
      [txt('stackRepeat'), txt(S.seq === 'AB' ? 'stackRepeatTwo' : 'stackRepeatThree')],
      [txt('stackAtomsPerCell'), `<b>${ionCountText(info.total)}</b>`],
      [txt('stackCoordination'), txt('stackCoordValue', { cn: info.cn, inLayer: info.inLayer, above: info.above, below: info.below })],
      [`${txt('stackPacking')}${helpButton('calc-packing')}`, `<b>${info.packing.toFixed(3)}</b>${info.cn === 12 ? ` ${txt('stackPackingMax')}` : ''}`],
      [txt('stackSpacing'), `${sig(info.spacing)} Å`],
      hex
        ? [txt('stackCa'), `${info.ca.toFixed(3)}${ideal ? ' ✓' : ` · ${txt('stackIdeal', { ca: info.idealCa.toFixed(3) })}`}`]
        : [txt('stackCubicA'), `${sig(info.params.a)} Å = 2√2 <i>r</i>`],
      [txt('stackRadius'), `${sig(info.r)} Å`],
    ];
    const viewNote = !hex ? txt('stackCubicNote') : S.seq === 'ABC' ? txt('stackHexABCNote') : txt('stackHexABNote');
    return `<p class="ion-basis">${txt('stackSequence', { seq: sequenceHTML(info) })}${helpButton('stacking', { item: item.id })}</p>
      ${note(`${S.how} ${viewNote}`)}
      ${facts(rows)}
      <p class="field-hint">${txt('stackExamples', { structure: S.short, examples: S.examples })}</p>
      ${S.views.length > 1 ? `<div class="field"><div class="field-label">${txt('stackView')}</div>
        ${segmented('view', [{ value: 'hex', label: txt('stackViewHex') }, { value: 'cubic', label: txt('stackViewCubic') }], info.view)}</div>` : ''}
      ${hex && !ideal ? `<div class="btn-row">${actionButton('ideal', txt('stackUseIdeal', { ca: info.idealCa.toFixed(3) }), 'reset')}</div>` : ''}
      <div class="field"><div class="field-label">${txt('stackDraw')}</div>
        ${segmented('size', [{ value: 'full', label: txt('ionicFull') }, { value: 'small', label: txt('ionicSmall') }], item.size)}</div>
      ${toggle('labels', item.labels, txt('stackLabels'), { hint: txt('stackLabelsHint') })}
      ${toggle('planes', item.planes, txt('stackPlanes'), { hint: txt(hex ? 'stackPlanesHintHex' : 'stackPlanesHintCubic') })}
      ${toggle('legend', item.legend, txt('ionicLegend'))}
      ${stackAppearance(item, info)}`;
  },

  onField(item, name, value, ctx, ws, phase) {
    if (name.startsWith('lcol-')) {
      item.colours = { ...item.colours, [name.slice(5)]: value };
      if (phase === 'input') ws.renderItemScene(item);
      else { ws.replaceCard(item); if (ws.renderStatus) ws.renderStatus(); }
      return;
    }
    if (name === 'view') {
      if (value === item.view || !stackingOf(item).views.includes(value)) return;
      item.view = value;
      showOn(ws, stackingOf(item), value);
      return;
    }
    if (name === 'size') { item.size = value; ws.redraw(item, { card: true }); return; }
    if (['labels', 'planes', 'legend'].includes(name)) {
      item[name] = value;
      ws.redraw(item);
      if (ws.renderStatus) ws.renderStatus();
    }
  },

  onAction(item, act, el, ctx, ws) {
    const S = stackingOf(item);
    if (act === 'show') { showOn(ws, S, viewOf(item)); return; }
    if (act === 'ideal') { ws.applyLattice('hP', { a: ctx.params.a, c: ctx.params.a * M.IDEAL_CA[S.seq] }); return; }
    if (act === 'lcol-auto') {
      const next = { ...item.colours };
      delete next[el.dataset.letter];
      item.colours = next;
      ws.renderItemScene(item);
      ws.replaceCard(item);
      if (ws.renderStatus) ws.renderStatus();
    }
  },

  primitives(item, ctx) {
    const info = stackingInfo(item, ctx);
    if (!info.fits) return [];
    const L = ctx.lattice, op = ctx.opacity(item), radius = info.r * sizeOf(item), prims = [];
    // like the lattice points: with a supercell the atoms outside the highlighted cell are faded,
    // and with cutting on the cell's atoms are cut at the cell and the rest at the supercell edge
    const E = ctx.ws.state.scene[1];
    const multi = ctx.region.cells > 1, dimOutside = multi && (ctx.cut || E.highlight);
    const clipCell = ctx.cut ? M.regionPlanes(ctx.unitRegion, L) : null, clipAll = ctx.cut ? M.regionPlanes(ctx.region, L) : null;
    const atoms = drawnAtoms(info, ctx);
    for (const layer of info.layers) {
      const inside = [], outside = [];
      for (const s of atoms) {
        if (s.letter !== layer.letter) continue;
        const c = L.toCartesian(s.f);
        if (!dimOutside || s.inOriginal) inside.push(c);
        if (dimOutside && (!s.inOriginal || (ctx.cut && M.shareOf(s.f, ctx.unitRegion) < 1))) outside.push(c);
      }
      prims.push({ kind: 'spheres', centres: inside, radius, colour: layer.colour, opacity: op, clip: dimOutside ? clipCell : (multi ? clipAll : clipCell) });
      if (outside.length) prims.push({ kind: 'spheres', centres: outside, radius, colour: layer.colour, opacity: 0.28 * op, clip: clipAll });
    }
    if (item.planes) {
      for (const { letter, poly } of layerPlanes(info, ctx)) {
        prims.push({ kind: 'polygon', points: poly.map(f => L.toCartesian(f)), colour: layerOfInfo(info, letter).colour, opacity: 0.2 * op });
      }
    }
    // the letter of every atom in the highlighted cell
    if (item.labels) {
      for (const s of atoms) {
        if (!s.inOriginal) continue;
        prims.push({ kind: 'label', at: L.toCartesian(s.f), html: s.letter, colour: layerOfInfo(info, s.letter).colour, cls: 'lbl-dim' });
      }
    }
    return prims;
  },

  /** A click on an atom tells its layer and its neighbours. */
  pick(item, ctx, ray) {
    const info = stackingInfo(item, ctx);
    if (!info.fits) return null;
    const L = ctx.lattice, r = info.r * sizeOf(item);
    return M.nearestHit(ray, drawnAtoms(info, ctx).map(s => ({ c: L.toCartesian(s.f), r, data: { letter: s.letter, f: M.sub(s.f, ctx.cellOrigin) } })));
  },

  onPick(item, data, ctx, ws) {
    const info = stackingInfo(item, ctx), layer = layerOfInfo(info, data.letter);
    if (!layer) return;
    ws.notify(txt('msgStackClicked', { letter: data.letter, pos: posText(data.f), cn: info.cn, inLayer: info.inLayer, above: info.above, below: info.below }), { icon: 'layers', colour: layer.colour });
    ws.flashCard(item);
  },

  /** The legend on the canvas: each layer position with its colour and atoms per cell. */
  legend(item, ctx) {
    const info = stackingInfo(item, ctx);
    if (!info.fits || !item.legend) return null;
    return {
      title: `${seqText(info.S)} · ${info.S.short}`, help: 'stacking',
      rows: info.layers.map(l => `<span class="dot" style="--c:${l.colour}"></span><b>${txt('stackLayer', { letter: l.letter })}</b> <span>${txt('stackLegendCount', { count: trim(l.count.total, 3) })}</span>`),
      foot: txt('stackLegendSub', { cn: info.cn, apf: info.packing.toFixed(3), d: sig(info.spacing) }),
    };
  },

  /** With cutting on: how the cut atoms add up, layer by layer. */
  readout(item, ctx) {
    const info = stackingInfo(item, ctx);
    if (!info.fits) return null;
    return {
      label: txt('stackReadoutLabel'), help: 'stacking',
      rows: [...info.layers.map(l => `${txt('stackLayer', { letter: l.letter })}: ${ionCountText(l.count)}`), txt('stackReadoutTotal', { total: ionCountText(info.total) })],
    };
  },
});

/* ---------------- input bar ---------------- */
registerCommand({
  name: 'Stacking', args: 1, raw: true, group: txt('catStacking'), type: 'stacking', usage: 'Stacking(ABAB)',
  help: txt('cmdHelpStacking'),
  example: () => 'Stacking(ABC)',
  run(args, ws, name) {
    const p = parseStacking(args[0]);
    if (!p) return { error: txt('msgStackUnknown', { name: String(args[0]).trim() }) };
    const item = ws.addItem('stacking', { name, stacking: p.id, view: p.view });
    return { ok: txt('msgCreated', { label: ws.labelHTML(item) }), item };
  },
  update(item, args, ws) {
    const p = parseStacking(args[0]);
    if (!p) return { error: txt('msgStackUnknown', { name: String(args[0]).trim() }) };
    item.stacking = p.id;
    item.view = p.view;
    item.colours = {};
    showOn(ws, findStacking(p.id), p.view);
    return { ok: txt('msgChanged', { label: ws.labelHTML(item) }), item };
  },
});
