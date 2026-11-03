/* =====================================================================
   What the help topics read from the scene: the lattice on screen and,
   for worked examples, the object the "?" belongs to (or the first one
   that fits, or a textbook default). No DOM.
   ===================================================================== */
import { effectiveSystem, effectiveCentring } from '../data/bravais.js';
import { SYSTEMS } from '../data/systems.js';
import { tn, tIdxPlain, ANG, DEG } from './tex.js';
import { idx } from '../ui/format.js';
import { txt } from '../text.js';

export const cosd = x => Math.cos(x * Math.PI / 180);
export const systemOf = ctx => effectiveSystem(ctx.bravais, ctx.setting);
export const centringOf = ctx => effectiveCentring(ctx.bravais, ctx.setting);
export const isCubic = ctx => systemOf(ctx) === 'cubic';
export const systemLabel = ctx => SYSTEMS[systemOf(ctx)].label;

/** "Cubic F", plus "(hexagonal axes)" for R drawn on hexagonal axes. */
export function latticeName(ctx) {
  const b = ctx.bravais;
  if (b.id === 'hR') return ctx.setting === 'hexagonal' ? txt('latticeNameHRHex') : txt('latticeNameHRPrimitive');
  return b.name;
}

const SYM = { a: 'a', b: 'b', c: 'c', alpha: String.raw`\alpha`, beta: String.raw`\beta`, gamma: String.raw`\gamma` };

/** The free lattice parameters in TeX, e.g. "a = 4\,Å,\ c = 5.2\,Å". */
export function paramsTex(ctx, keys = SYSTEMS[systemOf(ctx)].editable) {
  return keys.map(k => `${SYM[k]} = ${tn(ctx.params[k])}${k.length === 1 ? ANG : DEG}`).join(String.raw`,\quad `);
}

/** All six parameters in TeX. */
export const allParamsTex = ctx => paramsTex(ctx, ['a', 'b', 'c', 'alpha', 'beta', 'gamma']);

const okPlane = it => it && it.type === 'plane' && it.parsed && !it.parsed.error;
const okDirection = it => it && it.type === 'direction' && it.parsed && !it.parsed.error;

/** The object an item is linked to (spacing, intercepts → plane; components → direction). */
const linked = (ctx, item) => (item && item.src != null ? ctx.itemById(item.src) : null);

/**
 * The indexed object (plane, direction, 2D line …) a worked example uses: the
 * item itself (or the object it is linked to), else the first valid one of
 * `type` in the scene, else `fallback`.
 * → { [key]: indices, name, from: 'item' | 'scene' | 'default' }
 */
export function pickIndexed(ctx, item, type, key, fallback) {
  const ok = it => it && it.type === type && it.parsed && !it.parsed.error;
  const own = ok(item) ? item : ok(linked(ctx, item)) ? linked(ctx, item) : null;
  if (own) return { [key]: own.parsed[key], name: own.name, from: 'item' };
  const first = (ctx.items || []).find(ok);
  if (first) return { [key]: first.parsed[key], name: first.name, from: 'scene' };
  return { [key]: fallback, name: null, from: 'default' };
}

export const pickPlane = (ctx, item, fallback = [1, 1, 1]) => pickIndexed(ctx, item, 'plane', 'hkl', fallback);
export const pickDirection = (ctx, item, fallback = [1, 1, 0]) => pickIndexed(ctx, item, 'direction', 'uvw', fallback);

/** Two planes: those an intersection direction uses, else the last two planes, else (111) and (1 −1 0). */
export function pickTwoPlanes(ctx, item) {
  if (item && item.source && item.source.p1 != null) {
    const P1 = ctx.itemById(item.source.p1), P2 = ctx.itemById(item.source.p2);
    if (okPlane(P1) && okPlane(P2)) return { h1: P1.parsed.hkl, h2: P2.parsed.hkl, names: [P1.name, P2.name], from: 'item' };
  }
  const planes = (ctx.items || []).filter(okPlane).slice(-2);
  if (planes.length === 2) return { h1: planes[0].parsed.hkl, h2: planes[1].parsed.hkl, names: planes.map(p => p.name), from: 'scene' };
  return { h1: [1, 1, 1], h2: [1, -1, 0], names: [null, null], from: 'default' };
}

/**
 * Two objects for an angle: the angle item's own pair, else [100] and [111].
 * → { mode: 'dd' | 'pp' | 'dp', A, B (index arrays), names, from }
 */
export function pickAnglePair(ctx, item) {
  if (item && item.type === 'calc-angle') {
    const A = ctx.itemById(item.a), B = ctx.itemById(item.b);
    const kinds = { dd: [okDirection, okDirection], pp: [okPlane, okPlane], dp: [okDirection, okPlane] }[item.mode];
    if (kinds && kinds[0](A) && kinds[1](B) && A !== B) {
      const ix = it => (it.type === 'plane' ? it.parsed.hkl : it.parsed.uvw);
      return { mode: item.mode, A: ix(A), B: ix(B), names: [A.name, B.name], from: 'item' };
    }
  }
  return { mode: 'dd', A: [1, 0, 0], B: [1, 1, 1], names: [null, null], from: 'default' };
}

/** Short note on where the example's indices come from. */
export function sourceNote(pick, what, text) {
  const word = txt(what === 'plane' ? 'wordPlane' : 'wordDirection');
  if (pick.from === 'item') return pick.name ? txt('helpUsingNamed', { name: pick.name, text }) : txt('helpUsing', { text });
  if (pick.from === 'scene') return pick.name ? txt('helpUsingFirstNamed', { name: pick.name, text, what: word }) : txt('helpUsingFirst', { text, what: word });
  return txt('helpUsingExample', { text, what: word });
}

/** Title and intro of a plane's worked example (p from pickPlane): "(hkl) in Cubic F", and where (hkl) comes from. */
export const planeExample = (ctx, p) => ({ title: txt('helpIndicesIn', { indices: tIdxPlain(p.hkl, 'plane'), lattice: latticeName(ctx) }), intro: sourceNote(p, 'plane', idx(p.hkl, 'plane')) });

/** The "now" line of the plane topics: the plane and its spacing d. */
export const planeNow = (ctx, item) => {
  const p = pickPlane(ctx, item);
  return `${p.name ? `<b>${p.name}</b> ` : ''}${idx(p.hkl, 'plane')}: $d = ${tn(ctx.lattice.dSpacing(p.hkl))}${ANG}$`;
};
