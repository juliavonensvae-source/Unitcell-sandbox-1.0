/* The floating view toolbar on the canvas (view only: reset, look along an
   axis, projection) and the "Add cells" drawer on the right edge: cell type,
   supercell size and the highlighted cell. */
import { Drawer } from '../components/drawer.js';
import { icon } from '../icons.js';
import { HELP } from '../../help/content.js';
import { helpButton, segmented } from '../controls.js';
import { txt } from '../../text.js';

export const toolbarHTML = () => `<div class="view-toolbar" role="toolbar" aria-label="${txt('toolbarLabel')}">
  <button type="button" class="tb-btn" data-view="reset" title="${txt('toolbarResetTitle')}">${icon('reset')}<span class="tb-text">${txt('toolbarReset')}</span></button>
  <span class="tb-sep only-3d"></span>
  <div class="tb-group only-3d" role="group" aria-label="${txt('toolbarLookLabel')}">
    ${['a', 'b', 'c'].map((x, i) => `<button type="button" class="tb-btn tb-axis" data-view="${i}" title="${txt('toolbarLookAlong', { axis: x })}" aria-label="${txt('toolbarLookAlong', { axis: x })}" style="--ax:var(--axis-${x})"><i>${x}</i></button>`).join('')}
  </div>
  <span class="tb-sep adv-only only-3d"></span>
  <div class="seg tb-seg adv-only only-3d" role="group" aria-label="${txt('toolbarProjection')}">
    <button type="button" data-proj="persp" aria-pressed="true" title="${txt('toolbarPerspTitle')}">${txt('toolbarPersp')}</button>
    <button type="button" data-proj="ortho" aria-pressed="false" title="${txt('toolbarOrthoTitle')}">${txt('toolbarOrtho')}</button>
  </div>
</div>`;

/** One row of the size steppers: an axis chip, then − value +. step(d) gives each button's data attributes. */
const stepper = ({ ax, label, sub, value, min, max, step, out, less, more }) => `<div class="stepper-row">
        <span class="axis-chip" style="--ax:${ax}"><i>${label}</i><small>${sub}</small></span>
        <div class="stepper">
          <button type="button" ${step(-1)} aria-label="${less}"${value <= min ? ' disabled' : ''}>${icon('minus')}</button>
          <output ${out}>${value}</output>
          <button type="button" ${step(1)} aria-label="${more}"${value >= max ? ' disabled' : ''}>${icon('plus')}</button>
        </div></div>`;

/** Cell type choice: hexagonal P (primitive / prism) and, in Advanced, rhombohedral axes. */
function cellTypeHTML(ws) {
  const s = ws.state;
  if (s.latticeId === 'hP') {
    return `<section class="cf-sec"><h4>${txt('cellsType')}${helpButton('hex-prism')}</h4>
      ${segmented('hexCell', [{ value: 'primitive', label: txt('cellsPrimitive') }, { value: 'prism', label: txt('cellsPrism') }], s.hexCell)}
      <p class="field-hint">${s.hexCell === 'prism'
        ? txt('cellsPrismHint')
        : txt('cellsPrimitiveHint')}</p></section>`;
  }
  if (s.latticeId === 'hR' && s.advanced) {
    return `<section class="cf-sec"><h4>${txt('cellsAxes')}${helpButton('rhombohedral-setting')}</h4>
      ${segmented('setting', [{ value: 'rhombohedral', label: txt('cellsRhomb') }, { value: 'hexagonal', label: txt('cellsHex') }], s.setting)}
      <p class="field-hint">${s.setting === 'hexagonal' ? txt('cellsHexSettingHint') : txt('cellsRhombSettingHint')}</p></section>`;
  }
  return '';
}

export function createCellDrawer(ws, host, { extra = () => '', onExtra = () => false, onOpen = null, onClose = null } = {}) {
  const AX = ['a', 'b', 'c'];
  const render2D = () => {
    const n = ws.state.flat.n;
    return `<section class="cf-sec"><h4>${txt('cellsSize')}${helpButton('supercell')}</h4><p class="field-hint">${txt('cellsSize2DHint')}</p>
      <div class="steppers">${stepper({ ax: 'var(--ink-2)', label: 'n', sub: txt('cellsAlongAB'), value: n, min: 1, max: 6,
        step: d => `data-step2="${d}"`, out: 'data-n-out', less: txt('cellsSmaller'), more: txt('cellsBigger') })}</div>
      <div class="chip-row sc-presets">${[1, 2, 3, 4].map(k => `<button type="button" class="chip-btn" data-preset2="${k}" aria-pressed="${n === k}">${k} × ${k}</button>`).join('')}</div></section>
      ${extra()}`;
  };
  // Defects mode: a bigger block of atoms, up to 9 × 9 × 9
  const MAX = ws.isDefects() ? 9 : 5;
  const PRESETS = ws.isDefects() ? [[3, 3, 3], [5, 5, 5], [7, 7, 7], [9, 9, 3]] : [[1, 1, 1], [2, 2, 2], [3, 3, 3], [5, 5, 5]];
  const render = () => {
    if (ws.state.dim === '2d') return render2D();
    const r = ws.state.repeats, prism = ws.isPrism();
    const label = (x, i) => `<span>${prism ? (i < 2 ? `a<sub>${i + 1}</sub>` : "c") : x}</span>`;
    return `${cellTypeHTML(ws)}
      <section class="cf-sec"><h4>${txt('cellsSupercell')}${helpButton('supercell')}</h4>
      <p class="field-hint">${prism
        ? txt('cellsPrismSupercellHint')
        : ws.isDefects() ? txt('cellsBlockHint') : HELP.supercell}</p>
      <div class="steppers">${AX.map((x, i) => stepper({
        ax: `var(--axis-${x})`, label: label(x, i), sub: prism ? txt('cellsPrismsAlong', { axis: label(x, i) }) : txt('cellsCellsAlong', { axis: x }), value: r[i], min: 1, max: MAX,
        step: d => `data-step="${d}" data-axis="${i}"`, out: `data-axis-out="${i}"`,
        less: txt(prism ? 'cellsFewerPrisms' : 'cellsFewerCells', { axis: x }), more: txt(prism ? 'cellsMorePrisms' : 'cellsMoreCells', { axis: x }),
      })).join('')}</div>
      <div class="chip-row sc-presets">${(prism ? [[1, 1, 1], [2, 2, 1], [3, 3, 1], [2, 2, 2]] : PRESETS).map(p => `<button type="button" class="chip-btn" data-preset="${p.join(',')}" aria-pressed="${r.join() === p.join()}">${p.join(' × ')}${p.every(v => v === 1) ? ` · ${txt(prism ? 'cellsOnePrism' : 'cellsUnitCell')}` : ''}</button>`).join('')}</div>
      </section>
      ${extra()}`;
  };

  const pop = new Drawer({
    host,
    side: 'right',
    tab: txt('cellsTab'),
    title: txt('cellsTitle'),
    sub: txt('cellsSub'),
    className: 'cell-drawer',
    render,
    onOpen,
    onClose,
    onCreate(el) {
      el.addEventListener('click', e => {
        const step2 = e.target.closest('[data-step2]'), preset2 = e.target.closest('[data-preset2]');
        if (step2 || preset2) {
          const n = preset2 ? +preset2.dataset.preset2 : Math.min(6, Math.max(1, ws.state.flat.n + +step2.dataset.step2));
          ws.setFlatSize(n);
          pop.refresh();
          return;
        }
        const type = e.target.closest('[data-seg]');
        if (type) {
          if (type.dataset.seg === 'hexCell') ws.setHexCell(type.dataset.value);
          else ws.setSetting(type.dataset.value);
          pop.refresh();
          return;
        }
        const step = e.target.closest('[data-step]'), preset = e.target.closest('[data-preset]');
        if (step) {
          const r = [...ws.state.repeats], i = +step.dataset.axis;
          r[i] = Math.min(MAX, Math.max(1, r[i] + +step.dataset.step));
          ws.setRepeats(r);
        } else if (preset) {
          ws.setRepeats(preset.dataset.preset.split(',').map(Number));
        } else if (!onExtra(e, el)) return;
        pop.refresh();
      });
      el.addEventListener('input', e => onExtra(e, el));
    },
  });
  return pop;
}
