/* Calculations: each one is an object in the panel that shows a live value,
   a short explanation and its formula, and (where it helps) a 3D overlay. */
import { registerType } from './registry.js';
import { registerCommand } from './commands.js';
import * as M from '../math/index.js';
import { HELP } from '../help/content.js';
import { SYSTEMS } from '../data/systems.js';
import { effectiveSystem } from '../data/bravais.js';
import { sig, trim, fractionGlyph, countFormula, idx } from '../ui/format.js';
import { facts, formulaTex, note, actionButton } from '../ui/controls.js';
import { spacingInfo } from './plane-info.js';
import { tn, tt, tMat } from '../help/tex.js';
import { validItems } from './linked.js';
import { txt } from '../text.js';

const R = String.raw;

/** A calculation type plus its input-bar command, e.g. Volume() → vol1. */
const calc = ({ command, ...def }) => {
  registerType({
    appearance: false,
    create: () => ({}),
    definition: item => `${item.name} = ${command}()`,
    ...def,
    menu: def.menu.map(m => ({ category: 'calculations', desc: HELP[def.help], command: `${command}()`, ...m })),
  });
  registerCommand({
    name: command, args: 0, group: txt('catCalculations'), type: def.type, usage: `${command}()`, help: def.title,
    example: () => `${command}()`,
    run(args, ws, name) {
      if (def.menu.some(m => m.advanced) && !ws.state.advanced) return { error: txt('msgAdvancedCalc', { title: def.title }) };
      const item = ws.addItem(def.type, { name });
      return { ok: txt('msgCreated', { label: ws.labelHTML(item) }), item };
    },
    update: item => ({ ok: txt('msgAlreadyCalc', { name: item.name, title: def.title.toLowerCase() }), item }),
  });
};

/* ---------- cell volume ---------- */
/** Volume in the special form of each system, as TeX: [formula, with the numbers]. */
const VOLUME = {
  cubic: p => [txt('formulaVolCubic'), txt('volNumbersCubic', { a: tt(p.a) })],
  tetragonal: p => [txt('formulaVolTetragonal'), txt('volNumbersTetragonal', { a: tt(p.a), c: tt(p.c) })],
  orthorhombic: p => [txt('formulaVolOrthorhombic'), txt('volNumbersOrthorhombic', { a: tt(p.a), b: tt(p.b), c: tt(p.c) })],
  hexagonal: p => [txt('calcVolHexagonal'), txt('volNumbersHexagonal', { a: tt(p.a), c: tt(p.c) })],
  rhombohedral: p => [txt('formulaVolRhombohedral'), txt('volNumbersRhombohedral', { a: tt(p.a), alpha: tt(p.alpha, 2) })],
  monoclinic: p => [txt('formulaVolMonoclinic'), txt('volNumbersMonoclinic', { a: tt(p.a), b: tt(p.b), c: tt(p.c), beta: tt(p.beta, 2) })],
  triclinic: null,
};
const VOLUME_GENERAL = txt('formulaVolGeneral');

calc({
  command: 'Volume', type: 'calc-volume', prefix: 'vol', title: txt('calcVolume'), icon: 'volume', help: 'calc-volume',
  appearance: true, defaultTransparency: 78,
  menu: [{ key: 'calc-volume', title: txt('calcVolume'), order: 10 }],
  autoLabel: () => txt('calcVolume'),
  summary: (item, ctx) => `<i>V</i> = ${sig(ctx.lattice.volume)} Å³${ctx.isPrism ? ` · ${txt('calcVolumePrism', { volume: sig(3 * ctx.lattice.volume) })}` : ''}`,
  settings(item, ctx) {
    const sys = effectiveSystem(ctx.bravais, ctx.setting);
    const special = VOLUME[sys] && VOLUME[sys](ctx.params);
    return note(HELP['calc-volume'])
      + formulaTex(VOLUME_GENERAL, txt('formulaTagAll'))
      + (special ? formulaTex(txt('calcVolumeWorked', { formula: special[0], numbers: special[1], volume: tn(ctx.lattice.volume) }), SYSTEMS[sys].label)
        : facts([['<i>V</i>', `<b>${sig(ctx.lattice.volume)} Å³</b>`]]))
      + (ctx.isPrism ? note(txt('calcVolumePrismNote', { volume: sig(3 * ctx.lattice.volume) })) : '');
  },
  primitives(item, ctx) {
    const L = ctx.lattice, colour = ctx.colour(item), opacity = ctx.opacity(item), R = ctx.unitRegion;
    const top = Math.max(...R.vertices.map(v => v[2]));
    const mid = M.centroid(R.vertices);
    const V = ctx.isPrism ? 3 * L.volume : L.volume;
    return [
      ...R.faces.map(face => ({ kind: 'polygon', points: face.map(f => L.toCartesian(f)), colour, opacity, outline: false })),
      { kind: 'label', at: L.toCartesian([mid[0], mid[1], top]), html: `<i>V</i> = ${sig(V)} Å³`, colour },
    ];
  },
});

/* ---------- lattice points per cell ---------- */
calc({
  command: 'Points', type: 'calc-points', prefix: 'N', title: txt('calcPoints'), icon: 'count', help: 'calc-points',
  appearance: true, defaultTransparency: 55,
  menu: [{ key: 'calc-points', title: txt('calcPoints'), order: 20 }],
  autoLabel: () => txt('calcPointsLabel'),
  summary(item, ctx) {
    const n = M.pointCount(ctx.basis, ctx.unitRegion).total;
    return txt(ctx.isPrism ? 'calcPointsPerPrism' : 'calcPointsPerCell', { n: trim(n) });
  },
  settings(item, ctx) {
    const count = M.pointCount(ctx.basis, ctx.unitRegion);
    const rows = count.groups.map(g => [txt(g.count === 1 ? 'calcPointsRowOne' : 'calcPointsRowMany', { count: g.count, share: fractionGlyph(g.share) }), trim(g.count * g.share, 3)]);
    rows.push([txt('calcTotal'), `<b>${countFormula(count)}</b>`]);
    let out = note(ctx.isPrism
      ? txt('calcPointsPrismNote')
      : HELP['calc-points']) + formulaTex(txt('formulaPoints'), ctx.isPrism ? txt('formulaTagParallelepiped') : '') + facts(rows);
    if (ctx.bravais.id === 'hR') {
      out += note(ctx.setting === 'hexagonal'
        ? txt('calcPointsHexNote')
        : txt('calcPointsRhombNote'));
    }
    return out;
  },
  primitives(item, ctx) {
    const L = ctx.lattice, colour = ctx.colour(item);
    const images = M.sitesInRegion(ctx.basis, ctx.unitRegion);
    const centres = images.map(s => L.toCartesian(s.f));
    const halo = Math.max(1.5 * ctx.pointRadius, 0.09 * ctx.L0);
    return [
      { kind: 'spheres', centres, radius: halo, colour, opacity: ctx.opacity(item) },
      ...images.map((s, i) => ({ kind: 'label', at: centres[i], html: fractionGlyph(M.shareOf(s.f, ctx.unitRegion)), colour, cls: 'lbl-frac' })),
    ];
  },
});

/* ---------- packing fraction ---------- */
calc({
  command: 'Packing', type: 'calc-packing', prefix: 'apf', title: txt('calcPacking'), icon: 'packing', help: 'calc-packing',
  appearance: true, defaultTransparency: 10,
  menu: [{ key: 'calc-packing', title: txt('calcPacking'), order: 30 }],
  autoLabel: () => txt('calcPacking'),
  summary(item, ctx) {
    const p = ctx.analysis.packing;
    return txt('calcPackingSummary', { apf: p.value.toFixed(3), percent: (100 * p.value).toFixed(1) });
  },
  settings(item, ctx) {
    const p = ctx.analysis.packing, N = ctx.analysis.counts.total;
    return note(HELP['calc-packing'])
      + formulaTex(txt('formulaPacking'))
      + facts([
        [txt('calcPackingN'), trim(N)],
        [txt('calcPackingR'), `${sig(p.radius)} Å`],
        [txt('calcPackingV'), `${sig(ctx.lattice.volume)} Å³`],
        [txt('calcPackingAPF'), `<b>${p.value.toFixed(4)}</b> (${(100 * p.value).toFixed(1)}%)`],
      ])
      + note(txt('calcPackingNote'));
  },
  primitives(item, ctx) {
    const L = ctx.lattice;
    const centres = M.sitesNearRegion(ctx.basis, ctx.unitRegion).map(f => L.toCartesian(f));
    return [{
      kind: 'spheres', centres, radius: ctx.analysis.packing.radius, colour: ctx.colour(item), opacity: ctx.opacity(item),
      clip: M.regionPlanes(ctx.unitRegion, L),
    }];
  },
});

/* ---------- nearest neighbours ---------- */
calc({
  command: 'Neighbours', type: 'calc-nn', prefix: 'nn', title: txt('calcNN'), icon: 'neighbours', help: 'calc-nn',
  appearance: true,
  menu: [{ key: 'calc-nn', title: txt('calcNNMenu'), order: 40 }],
  autoLabel: () => txt('calcNN'),
  summary(item, ctx) {
    const nn = ctx.analysis.neighbours;
    return `<i>d</i><sub>nn</sub> = ${sig(nn.dnn)} Å · CN = ${nn.sites[0].cn}`;
  },
  settings(item, ctx) {
    const nn = ctx.analysis.neighbours, site = nn.sites[0];
    const rows = [
      [txt('calcNNDistance'), `<i>d</i><sub>nn</sub> = <b>${sig(nn.dnn)} Å</b>`],
      [txt('calcNNCN'), `CN = <b>${site.cn}</b>`],
    ];
    if (site.subshells.length > 1) rows.push([txt('calcNNShell'), site.subshells.map(x => txt('countAtDistance', { count: x.count, d: sig(x.d) })).join(', ')]);
    return note(HELP['calc-nn']) + formulaTex(txt('formulaNN')) + facts(rows)
      + note(txt('calcNNNote'));
  },
  primitives(item, ctx) {
    const L = ctx.lattice, colour = ctx.colour(item), opacity = ctx.opacity(item);
    const vs = ctx.region.vertices;
    const target = L.toCartesian(M.centroid(vs));
    let best = ctx.sites[0], bestD = Infinity;
    for (const s of ctx.sites) {
      const d = Math.hypot(...M.sub(L.toCartesian(s.f), target));
      if (d < bestD - 1e-9) { best = s; bestD = d; }
    }
    const shell = M.neighbourShell(L, ctx.basis, best.basisIndex);
    const c = L.toCartesian(best.f);
    const ends = shell.map(n => L.toCartesian(M.add(best.f, n.df)));
    const r = Math.max(ctx.pointRadius, 0.07 * ctx.L0);
    const first = ends[0];
    return [
      { kind: 'tubes', segments: ends.map(e => [c, e]), radius: 0.016 * ctx.L0, colour, opacity },
      { kind: 'spheres', centres: ends, radius: r * 1.02, colour, opacity: Math.min(opacity, 0.85) },
      { kind: 'spheres', centres: [c], radius: r * 1.3, colour, opacity },
      { kind: 'label', at: M.scale(M.add(c, first), 0.5), html: `<i>d</i><sub>nn</sub> = ${sig(ctx.analysis.neighbours.dnn)} Å`, colour },
      { kind: 'label', at: M.add(c, [0, 0, r * 2.4]), html: `CN = ${shell.length}`, colour },
    ];
  },
});

/* ---------- angle: see angle.js ---------- */

/* ---------- interplanar distance ---------- */
const planes = ctx => validItems(ctx, 'plane');
const quickPlanes = (act, ws) => {
  if (act !== 'quick-planes') return;
  for (const t of ['1 0 0', '1 1 0', '1 1 1']) ws.addItem('plane', { text: t }, { quiet: true });
  ws.itemChanged();
};
const swatch = colour => `<span class="dot" style="--c:${colour}"></span>`;

calc({
  command: 'SpacingTable', type: 'calc-dspacing', prefix: 'dsp', title: txt('calcDSpacing'), icon: 'spacing', help: 'calc-dspacing',
  menu: [{ key: 'calc-dspacing', title: txt('calcDSpacingMenu'), order: 60 }],
  autoLabel: () => txt('calcDSpacing'),
  summary(item, ctx) {
    const list = planes(ctx);
    if (!list.length) return txt('calcNoPlanes');
    if (list.length === 1) return `<i>d</i> = ${sig(ctx.lattice.dSpacing(list[0].parsed.hkl))} Å`;
    return txt('calcPlanesCount', { count: list.length });
  },
  settings(item, ctx) {
    const list = planes(ctx);
    const cubic = effectiveSystem(ctx.bravais, ctx.setting) === 'cubic';
    let out = note(HELP['calc-dspacing']);
    out += cubic
      ? formulaTex(txt('formulaDCubic'), txt('formulaTagCubic'))
      : formulaTex(txt('formulaDGeneral'), txt('formulaTagAll'));
    if (!list.length) {
      return out + note(txt('calcAddPlaneSpacing')) + `<div class="btn-row">${actionButton('quick-planes', txt('calcQuickPlanes'), 'plus')}</div>`;
    }
    const infos = list.map(p => spacingInfo(p.parsed.hkl, ctx));
    const differs = infos.some(i => !i.same);
    const rows = list.map((p, n) => {
      const [h, k, l] = p.parsed.hkl, info = infos[n];
      const extra = cubic ? `<td class="num">${trim(ctx.params.a)} / √${h * h + k * k + l * l}</td>` : '';
      const lat = differs ? `<td class="num">${info.same ? sig(info.dLattice) : `<b>${sig(info.dLattice)}</b> ${idx(info.eq, 'plane')}`}</td>` : '';
      return `<tr><td>${swatch(ctx.colour(p))}${ctx.label(p)}</td>${extra}<td class="num">${sig(info.dFormula)}</td>${lat}</tr>`;
    }).join('');
    out += `<div class="table-wrap"><table class="mini-table"><thead><tr><th>${txt('calcTablePlane')}</th>${cubic ? '<th class="num">a / √N</th>' : ''}<th class="num">d (Å)</th>${differs ? `<th class="num">${txt('calcTableWithPoints')}</th>` : ''}</tr></thead><tbody>${rows}</tbody></table></div>`;
    if (differs) out += note(txt('calcDSpacingNote'));
    return out;
  },
  onAction: (item, act, el, ctx, ws) => quickPlanes(act, ws),
});

/* ---------- Bragg angle (advanced) ---------- */
const LAMBDAS = [{ name: 'Cu Kα', l: 1.5406 }, { name: 'Mo Kα', l: 0.7107 }, { name: 'Co Kα', l: 1.7890 }, { name: 'Cr Kα', l: 2.2897 }];

calc({
  command: 'Bragg', type: 'calc-bragg', prefix: 'bragg', title: txt('calcBragg'), icon: 'bragg', help: 'calc-bragg',
  menu: [{ key: 'calc-bragg', title: txt('calcBraggMenu'), order: 70, advanced: true }],
  autoLabel: () => txt('calcBragg'),
  summary(item, ctx) {
    const n = planes(ctx).length;
    return `λ = ${ctx.lambda} Å · ${n ? txt(n === 1 ? 'calcPlaneOne' : 'calcPlanesCount', { count: n }) : txt('calcNoPlanesLower')}`;
  },
  settings(item, ctx) {
    const list = planes(ctx);
    let out = `<div class="field"><div class="field-label">${txt('calcBraggLambda')}</div>
      <div class="input-unit"><input class="input" type="number" data-field="lambda" value="${ctx.lambda}" min="0.05" max="20" step="0.0001" aria-label="${txt('calcBraggLambdaLabel')}"><span>Å</span></div>
      <div class="chip-row">${LAMBDAS.map(p => `<button type="button" class="chip-btn" data-act="lambda" data-value="${p.l}" aria-pressed="${Math.abs(p.l - ctx.lambda) < 1e-6}">${p.name}</button>`).join('')}</div></div>`;
    out += formulaTex(txt('formulaBragg'));
    if (!list.length) {
      return out + note(txt('calcAddPlaneBragg')) + `<div class="btn-row">${actionButton('quick-planes', txt('calcQuickPlanes'), 'plus')}</div>`;
    }
    const rows = list.map(p => {
      const d = ctx.lattice.dSpacing(p.parsed.hkl);
      const tt = M.braggTwoTheta(d, ctx.lambda);
      const sf = M.structureFactor(ctx.basis, p.parsed.hkl);
      const status = tt == null ? `<span class="chip chip-muted" title="λ/2d > 1">${txt('calcNoReflection')}</span>`
        : sf.absent ? `<span class="chip chip-bad" title="${txt('calcExtinctTitle')}">${txt('calcExtinct')}</span>`
          : txt('calcAllowed');
      return `<tr><td>${swatch(ctx.colour(p))}${ctx.label(p)}</td><td class="num">${sig(d)}</td><td class="num">${tt == null ? '—' : tt.toFixed(2)}</td><td>${status}</td></tr>`;
    }).join('');
    return out + `<div class="table-wrap"><table class="mini-table"><thead><tr><th>${txt('calcTablePlane')}</th><th class="num">d (Å)</th><th class="num">2θ (°)</th><th></th></tr></thead><tbody>${rows}</tbody></table></div>`
      + note(txt('calcBraggNote'));
  },
  onField(item, name, value, ctx, ws, phase) {
    if (name !== 'lambda') return;
    const v = parseFloat(value);
    if (v > 0) ws.setLambda(v);
  },
  onAction(item, act, el, ctx, ws) {
    if (act === 'lambda') ws.setLambda(+el.dataset.value);
    else quickPlanes(act, ws);
  },
});

/* ---------- metric tensor (advanced) ---------- */
const matrix = (name, rows, unit) => formulaTex(R`${name} = ${tMat(rows)}\ ${unit}`);

calc({
  command: 'Metric', type: 'calc-metric', prefix: 'G', title: txt('calcMetric'), icon: 'matrix', help: 'calc-metric',
  menu: [{ key: 'calc-metric', title: txt('calcMetricMenu'), order: 80, advanced: true }],
  autoLabel: () => txt('calcMetric'),
  summary: (item, ctx) => `det <i>G</i> = <i>V</i>² = ${sig(ctx.lattice.volume ** 2)} Å⁶`,
  settings(item, ctx) {
    const L = ctx.lattice;
    return note(HELP['calc-metric'])
      + `<p class="mat-title"><i>G</i><sub>ij</sub> = <b>a</b><sub>i</sub>·<b>a</b><sub>j</sub></p>${matrix('G', L.G, R`\text{Å}^2`)}`
      + `<p class="mat-title">${txt('calcMetricReciprocal')}</p>${matrix('G^* = G^{-1}', L.Gstar, R`\text{Å}^{-2}`)}`
      + `<p class="mat-title">${txt('calcMetricVectors')}</p>${matrix(R`\begin{pmatrix}\mathbf a \\ \mathbf b \\ \mathbf c\end{pmatrix}`, L.vectors, R`\text{Å}`)}`;
  },
});
