/* =====================================================================
   Part 4.5: ionic structures — a Bravais lattice plus a basis of ions.

   'ionic' (Ionic(NaCl)): NaCl, CsCl, ZnS or CaF2. Adding one switches to
   its Bravais lattice and lattice parameter (type hook `prepare`); every
   lattice point then carries the basis, e.g. cubic F + Cl⁻ (0,0,0) +
   Na⁺ (½,½,½). The ions replace the lattice points in the 3D view, each
   kind in its own colour with its own radius (Å, a number field), and
   are cut at the highlighted cell like lattice points. The card, the
   legend on the canvas and the cut-sphere readout show the ions per cell
   (12 × ¼ + 1 = 4), the formula units Z and the coordination numbers.

   All numbers come from src/math/ionic.js; data in src/data/ionic.js.
   ===================================================================== */
import { registerType } from './registry.js';
import { registerCommand } from './commands.js';
import * as M from '../math/index.js';
import { IONIC, findIonic, ionText, ionHTML, ELEMENT } from '../data/ionic.js';
import { findBravais } from '../data/bravais.js';
import { CENTRING } from '../data/systems.js';
import { sig, trim, fractionGlyph, posText } from '../ui/format.js';
import { facts, formulaTex, note, toggle, segmented, actionButton, helpButton, appearanceShell, kindSwatches } from '../ui/controls.js';
import { numberField } from '../ui/number-field.js';
import { txt } from '../text.js';

const BOND_GREY = '#8E95AD';

const structureOf = item => findIonic(item.structure) || IONIC[0];
const latticeOf = S => findBravais(S.lattice);
/** The structure is drawn only on its own Bravais lattice. */
const onItsLattice = (S, ctx) => ctx.bravais.id === S.lattice;

/** "12 × ¼ + 1 = 4": whole ions inside are written as a plain count. */
export function ionCountText({ groups, total }) {
  const parts = groups.map(g => (Math.abs(g.share - 1) < 1e-9 ? `${g.count}${groups.length === 1 ? ` ${txt('ionicInside')}` : ''}` : `${g.count} × ${fractionGlyph(g.share)}`));
  return `${parts.join(' + ')} = ${trim(total, 3)}`;
}

/**
 * Everything the card, legend, readout and 3D view need for one structure:
 * { S, fits, lattice, ions: [{ el, charge, label, html, colour, r, basis, count, cn, d, with }], z, ratio, rule, cation, anion }.
 * When another lattice is on screen, the numbers are for the structure's own cell (its textbook a).
 */
export function ionicInfo(item, ctx) {
  const S = structureOf(item), B = latticeOf(S), fits = onItsLattice(S, ctx);
  const centring = CENTRING[B.centring];
  const lattice = fits ? ctx.lattice : M.analyse({ a: S.a, b: S.a, c: S.a, alpha: 90, beta: 90, gamma: 90 }, [{ el: 'LP', f: [0, 0, 0] }]).lattice;
  const region = fits ? ctx.unitRegion : M.boxRegion([1, 1, 1]);
  const counts = M.ionCounts(S, centring, region), coord = M.coordination(S, centring, lattice);
  const ions = M.ionBases(S, centring).map(k => {
    const E = ELEMENT(k.el);
    return {
      el: k.el, charge: k.charge, label: ionText(k.el, k.charge), html: ionHTML(k.el, k.charge),
      colour: (item.colours && item.colours[k.el]) || E.colour,
      r: item.radii && item.radii[k.el] > 0 ? item.radii[k.el] : E.r, r0: E.r,
      basis: k.basis, count: counts[k.el], cn: coord[k.el].cn, d: coord[k.el].d, with: coord[k.el].with,
      cation: k.charge.includes('+'),
    };
  });
  const cation = ions.find(i => i.cation), anion = ions.find(i => !i.cation);
  const ratio = cation.r / anion.r;
  return { S, fits, lattice, ions, z: M.formulaUnitsOf(counts).z, ratio, rule: M.ratioRule(ratio), cation, anion, a: fits ? ctx.params.a : S.a };
}

/** Where every ion of the structure is drawn: [{ ion, sites }] in the displayed block. */
function drawnIons(info, ctx) {
  return info.ions.map(ion => ({ ion, sites: M.sitesInRegion(ion.basis, ctx.region) }));
}

const sizeOf = item => (item.size === 'small' ? 0.38 : 1);

/** A short statement of the structure as lattice + basis. */
function basisLine(S) {
  return txt('ionicBasisLine', { lattice: latticeOf(S).name, count: S.ions.length, ions: S.ions.map(i => `${ionHTML(i.el, i.charge)} ${posText(i.f)}`).join(', ') });
}

/** The part of the card that follows the radii and the lattice parameter. */
function ionicLive(item, ctx) {
  const info = ionicInfo(item, ctx);
  if (!info.fits) return '';
  const { cation, anion, rule } = info;
  const predicted = rule.cn, actual = cation.cn;
  const sum = cation.r + anion.r, d = cation.d;
  const touch = Math.abs(sum - d) < 0.005 * d ? txt('ionicTouch') : sum > d ? txt('ionicOverlap', { by: sig(sum - d, 2) }) : txt('ionicGap', { gap: sig(d - sum, 2) });
  return facts([
    [`${txt('ionicRatio')}${helpButton('ionic', { item: item.id })}`, `${sig(cation.r, 3)} / ${sig(anion.r, 3)} = <b>${info.ratio.toFixed(3)}</b>`],
    [txt('ionicRulePredicts'), `CN ${predicted} (${rule.poly})${predicted === actual ? ' ✓' : ` · ${txt('ionicStructureHas', { actual })}`}`],
    [txt('ionicDistance', { cation: cation.label, anion: anion.label }), `${sig(d)} Å · <i>r</i><sub>+</sub> + <i>r</i><sub>−</sub> = ${sig(sum)} Å: ${touch}`],
  ]);
}

function ionAppearance(item, info) {
  const row = ion => kindSwatches({
    label: txt('ionicIons', { ion: ion.html }), colour: ion.colour, own: !!(item.colours && item.colours[ion.el]),
    act: 'icol', data: 'el', key: ion.el, aria: txt('ionicColourOf', { ion: ion.label }),
  });
  return appearanceShell(item, info.ions[0].colour, info.ions.map(row).join(''));
}

registerType({
  type: 'ionic',
  prefix: 'ion',
  title: txt('ionicTitle'),
  icon: 'ions',
  help: item => `ionic-${structureOf(item).id}`,
  appearance: 'eye', // each kind of ion has its own colour (in the card's Appearance dropdown)
  expandOnAdd: true,
  menu: IONIC.map((S, i) => ({
    key: `ionic-${S.id}`, category: 'ionic', order: 10 + i, title: `${S.formula} · ${S.name}`,
    desc: txt('ionicMenuDesc', { lattice: latticeOf(S).name, count: S.ions.length, holes: S.holes }),
    init: { structure: S.id }, command: `Ionic(${S.id})`, help: `ionic-${S.id}`,
  })),

  /** Before the item exists: switch to the structure's lattice and its real lattice parameter. */
  prepare(init, ws) {
    const S = findIonic(init.structure) || IONIC[0];
    ws.applyLattice(S.lattice, { a: S.a });
  },

  create(init) {
    const S = findIonic(init.structure) || IONIC[0];
    return { structure: S.id, radii: {}, colours: {}, size: 'full', bonds: false, basis: false, legend: true };
  },

  afterAdd(item, ctx) {
    const S = structureOf(item);
    return txt('ionicAddNote', { lattice: latticeOf(S).name, a: sig(S.a), basis: S.ions.map(i => ionText(i.el, i.charge)).join(' + ') });
  },

  definition: item => `${item.name} = Ionic(${structureOf(item).id})`,
  autoLabel: item => { const S = structureOf(item); return `${S.formula} · ${S.name}`; },

  summary(item, ctx) {
    const info = ionicInfo(item, ctx), S = info.S;
    if (!info.fits) return txt('ionicShownOn', { lattice: latticeOf(S).name });
    return `Z = ${info.z} · CN ${info.ions.map(i => i.cn).join(' : ')} · ${txt('ionicPerCell', { ions: info.ions.map(i => `${i.label} ${trim(i.count.total)}`).join(', ') })}`;
  },

  hidesLatticePoints: (item, ctx) => onItsLattice(structureOf(item), ctx),

  /** Room around the cell when fitting it in view: the biggest ion. */
  framePad(item, ctx) {
    const info = ionicInfo(item, ctx);
    return info.fits ? Math.max(...info.ions.map(i => i.r)) * sizeOf(item) : 0;
  },

  settings(item, ctx) {
    const info = ionicInfo(item, ctx), S = info.S, B = latticeOf(S);
    if (!info.fits) {
      return note(txt('ionicWrongLattice', { formula: S.formula, lattice: B.name, current: ctx.bravais.name }))
        + `<div class="btn-row">${actionButton('use-lattice', txt('ionicShowAgain', { formula: S.formula, lattice: B.name, a: sig(S.a) }), 'cube')}</div>`;
    }
    const rows = info.ions.map(ion => [
      `<span class="dot" style="--c:${ion.colour}"></span>${txt('ionicIonPerCell', { ion: ion.html })}${helpButton('ionic', { item: item.id })}`,
      `<b>${ionCountText(ion.count)}</b>`,
    ]);
    const cn = info.ions.map(ion => [txt('ionicCoordination', { ion: ion.html }), txt('ionicCoordValue', { cn: ion.cn, with: ion.with.map(el => info.ions.find(x => x.el === el).html).join(', '), d: sig(ion.d) })]);
    const z = [txt('ionicZ'), `<b>${info.z}</b> × ${S.formula}`];
    const radii = info.ions.map(ion => numberField(`r-${ion.el}`, ion.r, {
      label: txt('ionicRadiusOf', { ion: ion.html }), unit: 'Å', step: 0.01, max: 5, what: txt('fitTheRadius'),
    })).join('');
    const changed = info.ions.some(i => Math.abs(i.r - i.r0) > 1e-9);
    const realA = Math.abs(ctx.params.a - S.a) > 1e-6;
    return `<p class="ion-basis">${basisLine(S)}.${helpButton(`ionic-${S.id}`, { item: item.id })}</p>
      ${formulaTex(txt('formulaCrystalStructure'))}
      ${note(txt('ionicOthers', { holes: S.holes, name: S.name, others: S.others }))}
      ${facts([...rows, z, ...cn])}
      <div class="ion-radii">${radii}</div>
      <p class="field-hint">${txt('ionicRadiiNote', { why: S.id === 'ZnS' ? txt('ionicZnSNote') : txt('ionicModelNote') })}</p>
      <div class="fit-live" data-live>${ionicLive(item, ctx)}</div>
      <div class="btn-row">${changed ? actionButton('reset-radii', txt('ionicResetRadii'), 'undo') : ''}${realA ? actionButton('use-lattice', txt('ionicUseRealA', { a: sig(S.a) }), 'reset') : ''}</div>
      <div class="field"><div class="field-label">${txt('ionicDraw')}</div>
        ${segmented('size', [{ value: 'full', label: txt('ionicFull') }, { value: 'small', label: txt('ionicSmall') }], item.size)}</div>
      ${toggle('bonds', item.bonds, txt('ionicBonds'), { hint: txt('ionicBondsHint', { cation: info.cation.label, cn: info.cation.cn, anion: info.anion.label }) })}
      ${toggle('basis', item.basis, txt('ionicLabelBasis'), { hint: txt('ionicLabelBasisHint', { count: S.ions.length }) })}
      ${toggle('legend', item.legend, txt('ionicLegend'))}
      ${ionAppearance(item, info)}`;
  },

  live: ionicLive,

  onField(item, name, value, ctx, ws, phase) {
    if (name.startsWith('r-')) {
      const r = +value;
      if (!(r > 0) || r > 5) return;
      item.radii = { ...item.radii, [name.slice(2)]: r };
      ws.redraw(item);
      if (ws.renderStatus) ws.renderStatus();
      return;
    }
    if (name.startsWith('icol-')) {
      item.colours = { ...item.colours, [name.slice(5)]: value };
      if (phase === 'input') ws.renderItemScene(item);
      else { ws.replaceCard(item); if (ws.renderStatus) ws.renderStatus(); }
      return;
    }
    if (name === 'size') { item.size = value; ws.redraw(item, { card: true }); return; }
    if (['bonds', 'basis', 'legend'].includes(name)) {
      item[name] = value;
      ws.redraw(item);
      if (ws.renderStatus) ws.renderStatus();
    }
  },

  onAction(item, act, el, ctx, ws) {
    const S = structureOf(item);
    if (act === 'use-lattice') { ws.applyLattice(S.lattice, { a: S.a }); return; }
    if (act === 'reset-radii') { item.radii = {}; ws.redraw(item, { card: true }); if (ws.renderStatus) ws.renderStatus(); return; }
    if (act === 'icol-auto') {
      const next = { ...item.colours };
      delete next[el.dataset.el];
      item.colours = next;
      ws.renderItemScene(item);
      ws.replaceCard(item);
      if (ws.renderStatus) ws.renderStatus();
    }
  },

  primitives(item, ctx) {
    const info = ionicInfo(item, ctx);
    if (!info.fits) return [];
    const L = ctx.lattice, op = ctx.opacity(item), k = sizeOf(item), prims = [];
    // like the lattice points: with a supercell the ions outside the highlighted cell are faded,
    // and with cutting on the cell's ions are cut at the cell and the rest at the supercell edge
    const E = ctx.ws.state.scene[1];
    const multi = ctx.region.cells > 1, dimOutside = multi && (ctx.cut || E.highlight);
    const clipCell = ctx.cut ? M.regionPlanes(ctx.unitRegion, L) : null, clipAll = ctx.cut ? M.regionPlanes(ctx.region, L) : null;
    const drawn = drawnIons(info, ctx);
    for (const { ion, sites } of drawn) {
      const inside = [], outside = [];
      for (const s of sites) {
        const c = L.toCartesian(s.f);
        if (!dimOutside || s.inOriginal) inside.push(c);
        if (dimOutside && (!s.inOriginal || (ctx.cut && M.shareOf(s.f, ctx.unitRegion) < 1))) outside.push(c);
      }
      const radius = ion.r * k;
      prims.push({ kind: 'spheres', centres: inside, radius, colour: ion.colour, opacity: op, clip: dimOutside ? clipCell : (multi ? clipAll : clipCell) });
      if (outside.length) prims.push({ kind: 'spheres', centres: outside, radius, colour: ion.colour, opacity: 0.28 * op, clip: clipAll });
    }
    // bonds: every cation to its nearest anions among the ions drawn
    if (item.bonds) {
      const cat = drawn.find(x => x.ion.cation), an = drawn.find(x => !x.ion.cation), d = info.cation.d;
      const A = an.sites.map(s => L.toCartesian(s.f)), segs = [];
      for (const s of cat.sites) {
        const c = L.toCartesian(s.f);
        for (const p of A) if (Math.abs(M.norm(M.sub(p, c)) - d) < 1e-4 * d) segs.push([c, p]);
      }
      prims.push({ kind: 'tubes', segments: segs, radius: Math.max(0.05, 0.16 * info.cation.r * k), colour: BOND_GREY, opacity: 0.95 });
    }
    // the basis: the ions one lattice point carries, labelled at the origin of the highlighted cell
    if (item.basis) {
      const O = ctx.cellOrigin, S = info.S, pts = S.ions.map(i => L.toCartesian(M.add(O, i.f)));
      prims.push({ kind: 'tubes', segments: pts.slice(1).map(p => [pts[0], p]), radius: 0.03, colour: ctx.theme.highlight || '#E8890C', opacity: 1 });
      S.ions.forEach((i, n) => {
        const ion = info.ions.find(x => x.el === i.el);
        prims.push({ kind: 'label', at: M.add(pts[n], [0, 0, ion.r * k + 0.25]), html: `${ion.html} ${posText(i.f)}`, colour: ion.colour, cls: 'lbl-dim' });
      });
    }
    return prims;
  },

  /** A click on an ion tells what it is and what surrounds it. */
  pick(item, ctx, ray) {
    const info = ionicInfo(item, ctx);
    if (!info.fits) return null;
    const L = ctx.lattice, k = sizeOf(item);
    return M.nearestHit(ray, drawnIons(info, ctx).flatMap(({ ion, sites }) =>
      sites.map(s => ({ c: L.toCartesian(s.f), r: ion.r * k, data: { el: ion.el, f: M.sub(s.f, ctx.cellOrigin) } }))));
  },

  onPick(item, data, ctx, ws) {
    const info = ionicInfo(item, ctx), ion = info.ions.find(i => i.el === data.el);
    if (!ion) return;
    const other = info.ions.find(i => i.el === ion.with[0]);
    ws.notify(txt('msgIonClicked', { ion: ion.html, pos: posText(data.f), cn: ion.cn, other: other.html, d: sig(ion.d) }), { icon: 'ions', colour: ion.colour });
    ws.flashCard(item);
  },

  /** The legend on the canvas: each ion with its colour, radius and number per cell. */
  legend(item, ctx) {
    const info = ionicInfo(item, ctx);
    if (!info.fits || !item.legend) return null;
    const S = info.S;
    return {
      title: `${S.formula} · ${S.name}`, help: `ionic-${S.id}`,
      rows: info.ions.map(ion => `<span class="dot" style="--c:${ion.colour}"></span><b>${ion.html}</b> <span>r = ${sig(ion.r, 3)} Å</span> <span>${txt('ionicLegendCount', { count: trim(ion.count.total), cn: ion.cn })}</span>`),
      foot: txt('ionicLegendSub', { lattice: latticeOf(S).name, z: info.z }),
    };
  },

  /** With cutting on: how the cut ions add up, e.g. Na⁺ 12 × ¼ + 1 = 4. */
  readout(item, ctx) {
    const info = ionicInfo(item, ctx);
    if (!info.fits) return null;
    return { label: txt('ionicReadoutLabel'), help: 'ionic', rows: info.ions.map(ion => `${ion.html} ${ionCountText(ion.count)}`) };
  },
});

/* ---------------- input bar ---------------- */
const NAMES = IONIC.map(S => S.id).join(', ');
registerCommand({
  name: 'Ionic', args: 1, raw: true, group: txt('catIonic'), type: 'ionic', usage: 'Ionic(NaCl)',
  help: txt('cmdHelpIonic', { names: NAMES }),
  example: () => 'Ionic(NaCl)',
  run(args, ws, name) {
    const S = findIonic(args[0]);
    if (!S) return { error: txt('msgIonicUnknownEg', { name: String(args[0]).trim(), names: NAMES }) };
    const item = ws.addItem('ionic', { name, structure: S.id });
    return { ok: txt('msgCreated', { label: ws.labelHTML(item) }), item };
  },
  update(item, args, ws) {
    const S = findIonic(args[0]);
    if (!S) return { error: txt('msgIonicUnknown', { name: String(args[0]).trim(), names: NAMES }) };
    item.structure = S.id;
    item.radii = {};
    item.colours = {};
    ws.applyLattice(S.lattice, { a: S.a });
    return { ok: txt('msgChanged', { label: ws.labelHTML(item) }), item };
  },
});
