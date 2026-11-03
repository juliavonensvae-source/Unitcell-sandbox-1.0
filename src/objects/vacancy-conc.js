/* =====================================================================
   Defects mode: the vacancy concentration calculator (Nv(1273, 0.9),
   names Nv1 …). N_v = N exp(−Q_v / kT) with sliders for T and Q_v, a
   live graph (N_v/N against T, or ln N_v/N against 1/T), and N, the
   atoms per m³, from the cubic lattice on screen.
   ===================================================================== */
import { registerType } from './registry.js';
import { registerCommand } from './commands.js';
import * as M from '../math/index.js';
import { sig, trim } from '../ui/format.js';
import { formulaTex, range, segmented, facts, helpButton } from '../ui/controls.js';
import { vacancyGraph, sci } from '../help/diagrams-defects.js';
import { blockPoints } from './crystal.js';
import { txt } from '../text.js';

/** kJ/mol in one eV per atom (N_A × e / 1000). */
const KJ_PER_EV = 96.485;

/** Everything the card shows for T (K) and Q (eV): the fraction, N, N_v, one vacancy in every … atoms, and the number expected in the block. */
function vacancyNumbers(T, Q, ctx) {
  const frac = M.vacancyFraction(T, Q), N = M.atomsPerM3(ctx.analysis.counts.total, ctx.params.a), atoms = blockPoints(ctx).length;
  return { frac, N, Nv: N * frac, oneIn: 1 / frac, atoms, inBlock: atoms * frac };
}

const summaryOf = (item, ctx) => txt('vcSummary', { frac: sci(vacancyNumbers(item.T, item.Q, ctx).frac, 2), T: trim(item.T, 1) });

function live(item, ctx) {
  const v = vacancyNumbers(item.T, item.Q, ctx);
  return `<figure class="vc-figure">${vacancyGraph({ T: item.T, Q: item.Q, mode: item.plot })}</figure>
    ${facts([
      [`<i>N</i><sub>v</sub>/<i>N</i>`, `<b>${sci(v.frac)}</b>`],
      [`<i>N</i>${helpButton('vacancy-conc', { item: item.id })}`, `${sci(v.N)} m<sup>−3</sup>`],
      [`<i>N</i><sub>v</sub>`, `<b>${sci(v.Nv)} m<sup>−3</sup></b>`],
      [txt('vcOneIn'), sci(v.oneIn, 2)],
      [txt('vcInBlock', { n: v.atoms }), sig(v.inBlock, 2)],
    ])}`;
}

registerType({
  type: 'vacancy-conc',
  mode: 'defects',
  prefix: 'Nv',
  title: txt('vcTitle'),
  icon: 'chart',
  help: 'vacancy-conc',
  appearance: false,
  menu: [{ key: 'vacancy-conc', category: 'defect-calcs', order: 10, title: txt('vcTitle'), desc: txt('vcDesc'), command: 'Nv(1273, 0.9)' }],

  create: init => ({ T: init.T ?? 1273, Q: init.Q ?? 0.9, plot: 'T' }),
  autoLabel: () => txt('vcLabel'),
  definition: item => `${item.name} = Nv(${trim(item.T, 1)}, ${trim(item.Q, 3)})`,
  summary: (item, ctx) => summaryOf(item, ctx),

  settings(item, ctx) {
    return `<div class="vc-live" data-live>${live(item, ctx)}</div>
      ${range('T', item.T, { min: 200, max: 2000, step: 10, unit: ' K', label: txt('vcT', { c: Math.round(item.T - 273.15) }) })}
      ${range('Q', item.Q, { min: 0.2, max: 3, step: 0.05, unit: ' eV', label: txt('vcQ', { kj: sig(item.Q * KJ_PER_EV, 3) }) })}
      <div class="field"><div class="field-label">${txt('vcPlot')}</div>
        ${segmented('plot', [{ value: 'T', label: txt('vcPlotT') }, { value: 'arrhenius', label: txt('vcPlotArrhenius') }], item.plot)}
        <p class="field-hint">${item.plot === 'arrhenius' ? txt('vcPlotArrheniusHint') : txt('vcPlotTHint')}</p></div>
      <div class="field"><div class="field-label"><span>${txt('vcFormula')}${helpButton('vacancy-conc', { item: item.id })}</span></div>
        ${formulaTex(txt('formulaVacancyConc'))}
        <p class="field-hint">${txt('vcFormulaHint')}</p></div>`;
  },
  live,

  onField(item, name, value, ctx, ws) {
    if (name === 'T' || name === 'Q') {
      item[name] = value;
      const li = ws.card(item), lab = li && li.querySelector(`[data-out="${name}"]`);
      if (lab) lab.previousElementSibling.textContent = name === 'T' ? txt('vcT', { c: Math.round(value - 273.15) }) : txt('vcQ', { kj: sig(value * KJ_PER_EV, 3) });
      ws.redraw(item);
    } else if (name === 'plot') { item.plot = value; ws.redraw(item, { card: true }); }
  },
});

/** Nv(1273, 0.9), Nv(1000 C, 0.9 eV), Nv(87 kJ/mol): a bare number of 50 or more is a temperature in K, a smaller one an energy in eV. */
export function parseNv(args) {
  const out = {};
  for (const raw of args) {
    const a = String(raw).trim();
    if (!a) continue;
    const m = a.replace(',', '.').match(/^(\d*\.?\d+)\s*(k|°?c|ev|kj\/mol)?$/i);
    if (!m) return { error: txt('msgNvCantRead', { arg: a }) };
    const v = +m[1], unit = (m[2] || '').toLowerCase().replace('°', '');
    if (unit === 'k' || (!unit && v >= 50)) out.T = v;
    else if (unit === 'c') out.T = v + 273.15;
    else if (unit === 'kj/mol') out.Q = v / KJ_PER_EV;
    else out.Q = v;
  }
  if (out.T != null && !(out.T >= 200 && out.T <= 2000)) return { error: txt('msgNvT') };
  if (out.Q != null && !(out.Q >= 0.2 && out.Q <= 3)) return { error: txt('msgNvQ') };
  return out;
}

registerCommand({
  name: 'Nv', mode: 'defects', raw: true, args: [0, 2], type: 'vacancy-conc', group: txt('catCalculations'),
  usage: 'Nv(1273, 0.9)', help: txt('vcDesc'), example: () => 'Nv(1273, 0.9)',
  run(args, ws, name) {
    const p = parseNv(args);
    if (p.error) return p;
    const item = ws.addItem('vacancy-conc', { name, ...p });
    return { ok: txt('msgCreatedSummary', { label: ws.labelHTML(item), summary: summaryOf(item, ws.ctx) }), item };
  },
  update(item, args, ws) {
    const p = parseNv(args);
    if (p.error) return p;
    Object.assign(item, p);
    return { ok: txt('msgChangedSummary', { label: ws.labelHTML(item), summary: summaryOf(item, ws.ctx) }), item };
  },
});
