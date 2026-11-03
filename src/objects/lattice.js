/* The "Lattice" scene object: first card in the Scene list. The lattice
   itself is chosen in the top bar (lattice button) and the Add cells drawer; this card
   holds its settings — the lattice parameters and what they mean.
   In 3D the parameters are edited in Advanced mode; in 2D always, within
   the rules of the chosen 2D lattice. Events from the inputs (data-param,
   data-param2, inside .lc) are handled by CrystalWorkspace.onLatticeCardEvent. */
import { registerType } from './registry.js';
import { SYSTEMS, CENTRING_INFO } from '../data/systems.js';
import { effectiveSystem, effectiveCentring } from '../data/bravais.js';
import { trim, SYMBOL, UNIT } from '../ui/format.js';
import { helpButton } from '../ui/controls.js';
import { txt } from '../text.js';

const KEYS = ['a', 'b', 'c', 'alpha', 'beta', 'gamma'];
const KEYS_2D = ['a', 'b', 'gamma'];

/** One-line summary of the editable parameters, e.g. "a = 4 Å · γ = 120°". */
function paramSummary(sys, p) {
  return sys.editable.map(k => `${SYMBOL[k]} = ${trim(p[k], 3)}${k.length === 1 ? ' Å' : '°'}`).join(' · ');
}

function paramInput(k, sys, p, attr = 'data-param') {
  const free = sys.editable.includes(k), tie = sys.tied[k], isLen = k.length === 1;
  return `<label class="param${free ? '' : ' is-tied'}">
    <span class="param-sym"><span${isLen ? ` style="color:var(--axis-${k})"` : ''}>${SYMBOL[k]}</span><small>${tie ? `= ${tie}` : free ? UNIT[k] : txt('paramFixed')}</small></span>
    <input class="input" type="number" ${attr}="${k}" value="${trim(p[k], 4)}"${free ? '' : ' disabled'}
      step="${isLen ? 0.01 : 0.5}" min="${isLen ? 0.5 : 10}" max="${isLen ? 50 : 170}" aria-label="${txt(isLen ? 'paramInAngstrom' : 'paramInDegrees', { symbol: SYMBOL[k] })}">
  </label>`;
}

function settings3D(ctx) {
  const b = ctx.bravais, sys = SYSTEMS[effectiveSystem(b, ctx.setting)];
  const cen = effectiveCentring(b, ctx.setting), n = ctx.analysis.counts.total;
  return `<div class="lc lc-inline">
    <div class="chip-row">
      <span class="chip">${SYSTEMS[b.system].label}${helpButton('crystal-systems')}</span>
      <span class="chip chip-primary">${cen} · ${CENTRING_INFO[cen].name}${helpButton('centring')}</span>
      <span class="chip">${ctx.isPrism ? txt('latticePointsPrism') : txt(n === 1 ? 'pickerPointsOne' : 'pickerPointsMany', { count: trim(n) })}${helpButton(ctx.isPrism ? 'hex-prism' : 'calc-points')}</span>
    </div>
    <p class="lc-rule">${sys.rule}</p>
    <p class="lc-values basic-only">${paramSummary(sys, ctx.params)}</p>
    <p class="field-hint basic-only">${txt('latticeAdvancedHint')}</p>
    <div class="adv-only">
      <div class="params">${KEYS.map(k => paramInput(k, sys, ctx.params)).join('')}</div>
      <p class="field-error" data-lc="error" hidden></p>
      <button type="button" class="link-btn" data-act="reset-params">${txt('resetDefaults')}</button>
    </div>
  </div>`;
}

function settings2D(fc, fs) {
  const sys = fc.system;
  return `<div class="lc lc-inline">
    <div class="chip-row">
      <span class="chip">${sys.label}${helpButton('lattices-2d')}</span>
      <span class="chip chip-primary">${fc.bravais.centring} · ${fc.bravais.centring === 'c' ? txt('picker2DCentred') : txt('picker2DPrimitive')}</span>
      <span class="chip">${txt(fc.count.total === 1 ? 'pickerPointsOne' : 'pickerPointsMany', { count: trim(fc.count.total) })}</span>
    </div>
    <p class="lc-rule">${sys.rule}</p>
    <div class="params params-2d">${KEYS_2D.map(k => paramInput(k, sys, fs.params, 'data-param2')).join('')}</div>
    <p class="field-hint">${txt('latticeTiedHint')}</p>
    <p class="field-error" data-lc="error2" hidden></p>
    <button type="button" class="link-btn" data-act="reset-params2">${txt('resetDefaults')}</button>
  </div>`;
}

registerType({
  type: 'lattice',
  title: txt('latticeTitle'),
  icon: 'cube',
  help: (item, ctx) => (ctx && ctx.flat ? 'lattices-2d' : 'lattice-params'),
  fixed: true,
  appearance: false,
  autoLabel: (item, ctx) => (ctx.flat ? `${ctx.flat.bravais.name} <small class="obj-tag">2D</small>` : ctx.bravais.name),
  summary: (item, ctx) => (ctx.flat
    ? paramSummary(ctx.flat.system, ctx.ws.state.flat.params)
    : paramSummary(SYSTEMS[effectiveSystem(ctx.bravais, ctx.setting)], ctx.params)),
  settings: (item, ctx) => (ctx.flat ? settings2D(ctx.flat, ctx.ws.state.flat) : settings3D(ctx)),
});

