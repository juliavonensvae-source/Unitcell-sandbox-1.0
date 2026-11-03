/* =====================================================================
   Angle — between two directions, two planes, or a direction and a plane.
   Objects are picked by name; the calculation keeps their ids, so it
   follows renames and index changes. Metric-tensor maths: src/math/lattice.js.
   ===================================================================== */
import { registerType } from './registry.js';
import { registerCommand } from './commands.js';
import { planePolygons } from './plane.js';
import * as M from '../math/index.js';
import { effectiveSystem } from '../data/bravais.js';
import { sig } from '../ui/format.js';
import { esc } from '../ui/dom.js';
import { facts, formulaTex, note, actionButton } from '../ui/controls.js';
import { validItems as valid, itemOptions, nameOf, invalidIndices } from './linked.js';
import { txt } from '../text.js';

const MODES = {
  dd: { label: txt('angleModeDD'), kinds: ['direction', 'direction'] },
  pp: { label: txt('angleModePP'), kinds: ['plane', 'plane'] },
  dp: { label: txt('angleModeDP'), kinds: ['direction', 'plane'] },
};
const nm = it => `<span class="nm">${esc(it.name)}</span>`;
const deg = x => `${sig(x, 4)}°`;

/** The two objects of an angle item, or null while they are not (validly) chosen. */
function anglePair(item, ctx) {
  const A = ctx.itemById(item.a), B = ctx.itemById(item.b), kinds = MODES[item.mode].kinds;
  if (!A || !B || A === B || A.type !== kinds[0] || B.type !== kinds[1] || A.parsed.error || B.parsed.error) return null;
  return [A, B];
}

/** The numbers for an angle item (null when the pair is incomplete). */
function angleResult(item, ctx) {
  const pair = anglePair(item, ctx);
  if (!pair) return null;
  const [A, B] = pair, L = ctx.lattice;
  if (item.mode === 'dd') return { pair, ...M.angleDirections(L, A.parsed.uvw, B.parsed.uvw) };
  if (item.mode === 'pp') return { pair, ...M.anglePlanes(L, A.parsed.hkl, B.parsed.hkl) };
  return { pair, ...M.angleDirectionPlane(L, A.parsed.uvw, B.parsed.hkl) };
}

/** Default objects for a mode: the two most recently added that fit. */
function defaultsFor(mode, ctx) {
  const [k1, k2] = MODES[mode].kinds;
  if (k1 === k2) {
    const last = valid(ctx, k1).slice(-2);
    return { a: last[0] ? last[0].id : null, b: last[1] ? last[1].id : null };
  }
  const d = valid(ctx, k1).slice(-1)[0], p = valid(ctx, k2).slice(-1)[0];
  return { a: d ? d.id : null, b: p ? p.id : null };
}

const QUICK = {
  dd: { label: txt('angleQuickDD'), make: [['direction', '1 0 0'], ['direction', '1 1 1']] },
  pp: { label: txt('angleQuickPP'), make: [['plane', '1 0 0'], ['plane', '1 1 1']] },
  dp: { label: txt('angleQuickDP'), make: [['direction', '1 1 1'], ['plane', '1 1 1']] },
};

registerType({
  type: 'calc-angle',
  prefix: 'ang',
  title: txt('angleTitle'),
  icon: 'angle',
  help: 'calc-angle',
  appearance: true,
  menu: [{
    key: 'calc-angle', category: 'calculations', order: 50, title: txt('angleTitle'),
    desc: txt('angleDesc'), command: 'Angle(d1, p1)',
  }],

  create(init, ctx) {
    let mode = init.mode;
    if (!mode) {
      const nd = valid(ctx, 'direction').length, np = valid(ctx, 'plane').length;
      mode = nd >= 2 ? 'dd' : np >= 2 ? 'pp' : nd && np ? 'dp' : 'dd';
    }
    const def = defaultsFor(mode, ctx);
    return { mode, a: init.a ?? def.a, b: init.b ?? def.b };
  },
  deps: item => [item.a, item.b].filter(id => id != null),
  autoLabel: () => txt('angleTitle'),
  definition: (item, ctx) => `${item.name} = Angle(${nameOf(ctx, item.a)}, ${nameOf(ctx, item.b)})`,

  summary(item, ctx) {
    const r = angleResult(item, ctx);
    if (!r) return txt(item.mode === 'dd' ? 'angleChooseDirections' : item.mode === 'pp' ? 'angleChoosePlanes' : 'angleChooseObjects');
    const [A, B] = r.pair;
    if (item.mode === 'dp') return txt('angleSummaryDP', { a: nm(A), b: nm(B), toPlane: deg(r.toPlane), toNormal: deg(r.toNormal) });
    return `${nm(A)} ∠ ${nm(B)} = ${deg(r.angle)}`;
  },

  settings(item, ctx) {
    const [k1, k2] = MODES[item.mode].kinds;
    const options = (type, sel) => itemOptions(valid(ctx, type), sel, ctx, type);
    let out = `<div class="field"><label class="field-label" for="mode-${item.id}">${txt('angleBetween')}</label>
      <select class="input" id="mode-${item.id}" data-field="mode">${Object.entries(MODES)
        .map(([value, m]) => `<option value="${value}"${value === item.mode ? ' selected' : ''}>${m.label}</option>`).join('')}</select></div>
      <div class="pair-pick">
        <select class="input" data-field="a" aria-label="${txt('angleFirst')}">${options(k1, item.a)}</select>
        <span class="pair-sym">∠</span>
        <select class="input" data-field="b" aria-label="${txt('angleSecond')}">${options(k2, item.b)}</select></div>`;
    const need = k1 === k2 ? valid(ctx, k1).length < 2 : !valid(ctx, k1).length || !valid(ctx, k2).length;
    if (need) out += note(txt(k1 !== k2 ? 'angleNeedBoth' : k1 === 'plane' ? 'angleNeedTwoPlanes' : 'angleNeedTwoDirections')) + `<div class="btn-row">${actionButton('quick', QUICK[item.mode].label, 'plus')}</div>`;

    const r = angleResult(item, ctx);
    if (item.mode === 'dd') {
      out += formulaTex(txt('formulaAngleDD'));
      if (r) out += facts([
        ['<i>u</i>₁ᵀ<i>G</i><i>u</i>₂', `${sig(r.dotG)} Å²`],
        ['|<i>u</i>₁| · |<i>u</i>₂|', `${sig(r.lu)} × ${sig(r.lv)} Å²`],
        ['θ', `<b>${deg(r.angle)}</b>`],
      ]);
    } else if (item.mode === 'pp') {
      out += formulaTex(txt('formulaAnglePP'));
      out += note(txt('anglePPNote'));
      if (r) out += facts([
        ['<b>h</b>₁ᵀ<i>G</i>*<b>h</b>₂', `${sig(r.dotG)} Å⁻²`],
        ['|<i>g</i>₁| · |<i>g</i>₂|', `${sig(r.g1)} × ${sig(r.g2)} Å⁻²`],
        ['θ', `<b>${deg(r.angle)}</b>`],
      ]);
    } else {
      out += formulaTex(txt('formulaAngleDP'));
      if (r) {
        out += facts([
          ['<i>uh</i> + <i>vk</i> + <i>wl</i>', sig(r.uh)],
          ['|<i>u</i>| · |<i>g</i>|', `${sig(r.lu)} Å × ${sig(r.g)} Å⁻¹`],
          [txt('angleToNormal'), `<b>${deg(r.toNormal)}</b>`],
          [txt('angleToPlane'), `<b>${deg(r.toPlane)}</b>`],
        ]);
        const [A, B] = r.pair, cubic = effectiveSystem(ctx.bravais, ctx.setting) === 'cubic';
        if (!cubic && A.parsed.uvw.join() === B.parsed.hkl.join()) {
          out += note(txt('angleNotPerp', { uvw: A.parsed.uvw.join(' '), hkl: B.parsed.hkl.join(' ') }));
        }
      }
    }
    return out;
  },

  onField(item, name, value, ctx, ws) {
    if (name === 'mode' && MODES[value] && value !== item.mode) {
      item.mode = value;
      Object.assign(item, defaultsFor(value, ctx));
      ws.itemChanged(item);
    } else if (name === 'a' || name === 'b') {
      item[name] = value ? +value : null;
      ws.itemChanged(item);
    }
  },

  onAction(item, act, el, ctx, ws) {
    if (act !== 'quick') return;
    const [A, B] = QUICK[item.mode].make.map(([type, text]) => ws.addItem(type, { text }, { quiet: true }));
    item.a = A.id;
    item.b = B.id;
    ws.itemChanged(item);
  },

  primitives(item, ctx) {
    const r = angleResult(item, ctx);
    if (!r) return [];
    const L = ctx.lattice, colour = ctx.colour(item), opacity = ctx.opacity(item);
    const [A, B] = r.pair, prims = [];
    // highlight the planes used: their outline in the angle's colour
    const outline = P => {
      for (const poly of planePolygons(P, ctx)) {
        const pts = poly.map(f => L.toCartesian(f));
        prims.push({ kind: 'tubes', segments: pts.map((p, i) => [p, pts[(i + 1) % pts.length]]), radius: 0.014 * ctx.L0, colour, opacity });
      }
    };
    const O = L.toCartesian(ctx.origin);
    if (item.mode === 'dd') {
      const u = L.toCartesian(A.parsed.uvw), v = L.toCartesian(B.parsed.uvw);
      prims.push({ kind: 'arc', centre: O, from: u, to: v, radius: 0.36 * Math.min(Math.hypot(...u), Math.hypot(...v)), colour, opacity, label: deg(r.angle) });
    } else if (item.mode === 'pp') {
      outline(A);
      outline(B);
      const poly = planePolygons(A, ctx)[0];
      if (poly) {
        const c = L.toCartesian(M.centroid(poly));
        prims.push({ kind: 'label', at: c, html: `θ = ${deg(r.angle)}`, colour, cls: 'lbl-angle' });
      }
    } else {
      outline(B);
      // the plane normal from the origin, and the angle ψ between it and the direction
      const u = L.toCartesian(A.parsed.uvw), len = Math.hypot(...u);
      let n = L.planeNormal(B.parsed.hkl);
      if (M.dot(n, u) < 0) n = n.map(x => -x);
      prims.push({ kind: 'arrow', from: O, to: n.map((x, i) => O[i] + x * len * 0.9), colour, opacity: 0.55 * opacity, size: 0.7, label: txt('angleNormalOf', { name: esc(B.name) }) , labelCls: 'lbl-small' });
      if (r.toNormal > 0.05) {
        prims.push({ kind: 'arc', centre: O, from: u, to: n, radius: 0.32 * len, colour, opacity, label: `ψ = ${deg(r.toNormal)}` });
      }
    }
    return prims;
  },
});

/** Check two objects for Angle → { mode, a, b } or { error }. */
function anglePairOf(A, B) {
  const kind = it => (it.type === 'direction' ? 'd' : it.type === 'plane' ? 'p' : null);
  for (const it of [A, B]) {
    if (!kind(it)) return { error: txt('msgAngleNotDirOrPlane', { name: it.name }) };
    if (it.parsed.error) return invalidIndices(it);
  }
  if (A === B) return { error: txt('msgPickTwoObjects', { name: A.name }) };
  const k = kind(A) + kind(B);
  const [a, b] = k === 'pd' ? [B, A] : [A, B];
  return { mode: k === 'dd' ? 'dd' : k === 'pp' ? 'pp' : 'dp', a: a.id, b: b.id };
}

registerCommand({
  name: 'Angle',
  args: 2,
  group: txt('catCalculations'),
  type: 'calc-angle',
  update(item, [A, B], ws) {
    const pair = anglePairOf(A, B);
    if (pair.error) return pair;
    Object.assign(item, pair);
    return { ok: txt('msgChangedSummary', { label: ws.labelHTML(item), summary: getSummary(item, ws) }), item };
  },
  usage: 'Angle(d1, p1)',
  help: txt('cmdHelpAngle'),
  example(dirs, planes) {
    if (dirs.length && planes.length) return `Angle(${dirs[0].name}, ${planes[0].name})`;
    if (dirs.length >= 2) return `Angle(${dirs[0].name}, ${dirs[1].name})`;
    if (planes.length >= 2) return `Angle(${planes[0].name}, ${planes[1].name})`;
    return 'Angle(d1, p1)';
  },
  run([A, B], ws, name) {
    const pair = anglePairOf(A, B);
    if (pair.error) return pair;
    const item = ws.addItem('calc-angle', { ...pair, name });
    return { ok: txt('msgCreatedSummary', { label: ws.labelHTML(item), summary: getSummary(item, ws) }), item };
  },
});

const getSummary = (item, ws) => {
  const r = angleResult(item, ws.ctx);
  if (!r) return '';
  return item.mode === 'dp' ? txt('angleResultDP', { toPlane: deg(r.toPlane), toNormal: deg(r.toNormal) }) : deg(r.angle);
};
