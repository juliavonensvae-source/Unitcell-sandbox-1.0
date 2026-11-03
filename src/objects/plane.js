/* Plane (hkl): one plane clipped to the unit cell (or hexagonal prism), or
   (family) every parallel plane through the displayed cell; optionally also
   the planes equivalent to it by symmetry, {hkl}. */
import { registerCommand } from './commands.js';
import * as M from '../math/index.js';
import { HELP } from '../help/content.js';
import { idx, sig, dSym } from '../ui/format.js';
import { facts, toggle, note, actionButton, helpButton } from '../ui/controls.js';
import { spacingInfo, spacingExplanation, spacingSummary, formulaLine } from './plane-info.js';
import { indexedType, hexHint, indexRows } from './indexed.js';
import { invalidIndices } from './linked.js';
import { txt } from '../text.js';

/** Index label; on hexagonal axes both notations: (100) = (101̄0). */
export function planeIndices(hkl, hexAxes) {
  return hexAxes ? `${idx(hkl, 'plane')} = ${idx(M.planeToFour(hkl), 'plane')}` : idx(hkl, 'plane');
}

/**
 * The planes a plane item draws, in fractional coordinates: one plane in the unit
 * cell, or (family) every plane of the set that holds lattice points, through the
 * displayed cell. → [{ poly, formula }] where formula = false marks the extra planes
 * of a centred lattice that lie between the formula planes.
 */
function planeLayers(item, ctx) {
  const hkl = item.parsed.hkl;
  if (item.family) return M.latticePlaneLayers(hkl, ctx.basis, ctx.planeRegion).map(l => ({ poly: l.poly, formula: l.formula }));
  const poly = textbookPlane(hkl, ctx);
  return poly ? [{ poly, formula: true }] : [];
}

/** The textbook plane of a set in the highlighted cell, seen from the origin (fractional polygon or null). */
const textbookPlane = (hkl, ctx) => M.planePolygonIn(hkl, M.representativeLevelFrom(hkl, ctx.unitRegion, ctx.origin), ctx.unitRegion);

/** The members of the plane's family {hkl}, the plane itself first; labels in the four-index form on hexagonal axes. */
const equivalents = (item, ctx) => M.equivalentPlanes(ctx.lattice, item.parsed.hkl, ctx.basis, ctx.hexAxes)
  .map(hkl => ({ hkl, html: idx(ctx.hexAxes ? M.planeToFour(hkl) : hkl, 'plane') }));

/** Fractional polygons of a plane item (see planeLayers). */
export const planePolygons = (item, ctx) => planeLayers(item, ctx).map(l => l.poly);

/** Cartesian polygons for a plane item, plus a label position. */
function planeGeometry(item, ctx) {
  const L = ctx.lattice;
  const layers = planeLayers(item, ctx).map(l => ({ ...l, points: l.poly.map(f => L.toCartesian(f)) }));
  let labelAt = null;
  if (layers.length) {
    const pick = layers[Math.floor((layers.length - 1) / 2)].points;
    labelAt = M.centroid(pick);
  }
  return { layers, polygons: layers.map(l => l.points), labelAt };
}

const PRESETS = ['1 0 0', '1 1 0', '1 1 1'];

indexedType({
  type: 'plane',
  prefix: 'p',
  title: txt('planeTitle'),
  icon: 'plane',
  help: 'plane',
  appearance: true,
  defaultTransparency: 65,
  key: 'hkl',
  brackets: '()',
  placeholder: '1 1 1',
  parse: (text, ctx, typing) => M.parsePlane(text, ctx.hexAxes, { allowFour: !typing || ctx.advanced }),
  label: (hkl, ctx) => planeIndices(hkl, ctx.hexAxes),
  hint: ctx => hexHint(ctx, '()', 'hkil', '1 1 1'),
  family: true,
  menu: [
    { key: 'plane', category: 'planes', order: 10, title: txt('planeMenu'), desc: HELP.plane, input: 'plane', presets: PRESETS, command: 'p1 = (1 1 1)' },
  ],


  summary(item, ctx) {
    const d = spacingSummary(item.parsed.hkl, ctx);
    if (!item.family) return d;
    const n = planeLayers(item, ctx).length;
    return txt(n === 1 ? 'planeCountOne' : 'planeCountMany', { count: n, spacing: d });
  },

  settings(item, ctx) {
    const hkl = item.parsed.hkl, info = spacingInfo(hkl, ctx);
    let out = toggle('family', item.family, `${txt('planeFamily')}${helpButton('plane-family')}`, {
      hint: ctx.region && ctx.region.parts
        ? txt('planeFamilyHintPrism')
        : txt('planeFamilyHint'),
    });
    const eq = item.equivalent ? equivalents(item, ctx) : [];
    out += toggle('equivalent', item.equivalent, txt('planeEquivalent'), {
      hint: item.equivalent
        ? txt(eq.length === 1 ? 'planeEqOne' : 'planeEqMany', { count: eq.length, family: idx(ctx.hexAxes ? M.planeToFour(hkl) : hkl, 'family'), list: eq.map(e => e.html).join(', ') })
        : txt('planeEquivalentHint'),
    });
    out += formulaLine(hkl, ctx);
    out += facts([
      [txt('planeDFormula'), `${dSym(hkl)} = ${sig(info.dFormula)} Å`],
      info.same ? null : [txt('planeWithPoints'), txt('planeWithPointsValue', { planes: idx(info.eq, 'plane'), d: sig(info.dLattice) })],
      ...indexRows(ctx, hkl, M.planeToFour(hkl), 'plane'),
    ]);
    const why = spacingExplanation(hkl, ctx, info);
    if (why) out += note(why);
    if (item.family && !info.same) {
      out += note(info.q > 1
        ? txt('planeFamilyNoteExtra')
        : txt('planeFamilyNoteEmpty'));
    }
    return out + `<div class="btn-row">${actionButton('normal', txt('planeLookNormal'), 'target')}</div>`;
  },

  onField(item, name, value, ctx, ws) {
    if (name === 'equivalent') { item.equivalent = value; ws.itemChanged(item); }
  },

  onAction(item, act, el, ctx, ws) {
    if (act === 'normal' && !item.parsed.error) ws.lookAlong(ctx.lattice.planeNormal(item.parsed.hkl));
  },

  primitives(item, ctx) {
    const { layers, labelAt } = planeGeometry(item, ctx);
    const colour = ctx.colour(item), opacity = ctx.opacity(item);
    // extra planes of a centred lattice (between the formula planes): lighter, dashed edges
    const prims = layers.map(l => (l.formula
      ? { kind: 'polygon', points: l.points, colour, opacity }
      : { kind: 'polygon', points: l.points, colour, opacity: 0.55 * opacity, dashed: true }));
    if (item.family) {
      // formula planes with no lattice points on them (indices with a common factor): outline only
      const L = ctx.lattice, hkl = item.parsed.hkl;
      const R = ctx.planeRegion;
      for (const n of M.emptyFormulaLevels(hkl, ctx.basis, R)) {
        const poly = M.planePolygonIn(hkl, n, R);
        if (poly) prims.push({ kind: 'polygon', points: poly.map(f => L.toCartesian(f)), colour, opacity, fill: false, dashed: true });
      }
    }
    if (labelAt) prims.push({ kind: 'label', at: labelAt, html: ctx.label(item), colour });
    if (item.equivalent) {
      for (const e of equivalents(item, ctx).slice(1)) {
        const poly = textbookPlane(e.hkl, ctx);
        if (!poly) continue;
        const points = poly.map(f => ctx.lattice.toCartesian(f));
        prims.push({ kind: 'polygon', points, colour, opacity: 0.6 * opacity }, { kind: 'label', at: M.centroid(points), html: e.html, colour });
      }
    }
    return prims;
  },
});

/**
 * Family(p1): show every plane of p1's set that holds lattice points (2D: every line of l1's set).
 * x = Family(p1) makes a new plane x with the same indices and all parallel planes shown.
 */
registerCommand({
  name: 'Family',
  args: 1,
  group: txt('catPlanes'),
  dims: ['3d', '2d'],
  type: dim => (dim === '2d' ? 'line2d' : 'plane'),
  usage: 'Family(p1)',
  help: txt('cmdHelpFamily'),
  example: (dirs, planes) => `Family(${planes.length ? planes[planes.length - 1].name : 'p1'})`,
  run([A], ws, name) {
    const want = ws.is2D() ? 'line2d' : 'plane', lines = ws.is2D();
    if (A.type !== want) return { error: txt(lines ? 'msgFamilyNotLine' : 'msgFamilyNotPlane', { name: A.name }) };
    if (A.parsed.error) return invalidIndices(A);
    if (name) {
      const item = ws.addItem(want, { text: A.text, name, family: true });
      return { ok: txt(lines ? 'msgFamilyCreatedLines' : 'msgFamilyCreatedPlanes', { label: ws.labelHTML(item) }), item };
    }
    A.family = true;
    ws.itemChanged(A);
    return { ok: txt(lines ? 'msgFamilyShowsLines' : 'msgFamilyShowsPlanes', { label: ws.labelHTML(A) }), item: A, changed: true };
  },
  update(item, [A], ws) {
    if (A.type !== item.type || A.parsed.error) return { error: txt(ws.is2D() ? 'msgFamilyNeedsLine' : 'msgFamilyNeedsPlane') };
    item.text = A.text;
    item.parsed = A.parsed;
    item.family = true;
    return { ok: txt('msgChanged', { label: ws.labelHTML(item) }), item };
  },
});
