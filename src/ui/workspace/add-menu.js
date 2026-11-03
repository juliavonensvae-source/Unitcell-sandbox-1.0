/* The "+ Add" menu: categories as collapsible sections, each listing what can be added. */
import { showError, restartAnim } from '../dom.js';
import { Popover } from '../components/popover.js';
import { CATEGORIES, menuEntries, getType } from '../../objects/index.js';
import { icon } from '../icons.js';
import { idx } from '../format.js';
import { helpKeyFor } from '../../help/index.js';
import { helpButton } from '../controls.js';
import { txt } from '../../text.js';

export function createAddMenu(ws, anchor) {
  let openCat = null; // every category starts collapsed each time the menu opens

  /** The "?" of a menu entry: its own help key, or its object type's. */
  const help = e => {
    const key = e.help || (e.type ? helpKeyFor(getType(e.type), { ...(e.init || {}) }, ws.ctx) : null);
    return key ? helpButton(key) : '';
  };

  /** Why an entry can't be added for the lattice on screen (e.g. interstitial sites outside cubic), or null. */
  const unavailable = e => (e.unavailable ? e.unavailable(ws.ctx) : null);

  const entryHTML = e => {
    if (e.input === 'vector') {
      const n = (name, v) => `<input class="input vec-in" type="number" step="0.25" name="${name}" value="${v}" aria-label="${name}">`;
      return `<form class="menu-item has-form" data-key="${e.key}" data-vector autocomplete="off" novalidate>
        <span class="mi-text"><b>${e.title}${help(e)}</b><small>${e.desc}</small></span>
        <div class="vec-row"><span>(</span>${n('x0', 0)}<span>,</span>${n('y0', 0)}<span>)</span><b>→</b><span>(</span>${n('x1', 1)}<span>,</span>${n('y1', 2)}<span>)</span>
          <button type="submit" class="btn btn-primary btn-sm">${icon('plus')}<span>${txt('add')}</span></button></div>
        <div class="btn-row"><button type="button" class="btn btn-soft btn-sm" data-pick>${icon('target')}<span>${txt('addPickPoints')}</span></button></div>
        <p class="mi-hint">${txt('addVectorHint', { command: e.command })}</p>
        <p class="field-error" hidden></p>
      </form>`;
    }
    const why = unavailable(e);
    if (why) {
      return `<div class="menu-item is-soon is-unavailable"><span class="mi-text"><b>${e.title}${help(e)}</b><small>${why}</small></span><span class="chip chip-muted">${txt('addNotAvailable')}</span></div>`;
    }
    if (e.input) {
      const dir = e.input === 'direction';
      const [o, c] = dir ? ['[', ']'] : ['(', ')'];
      const four = ws.ctx.hexAxes && ws.state.advanced ? ` ${txt(dir ? 'addFourDirection' : 'addFourPlane')}` : '';
      return `<form class="menu-item has-form" data-key="${e.key}" autocomplete="off" novalidate>
        <span class="mi-text"><b>${e.title}${help(e)}</b><small>${e.desc}</small></span>
        <div class="mi-form">
          <div class="idx-field"><span class="idx-br">${o}</span><input class="idx-input" name="idx" placeholder="${dir ? '1 1 0' : '1 1 1'}" aria-label="${txt('addIndicesLabel', { title: e.title })}" spellcheck="false" autocomplete="off"><span class="idx-br">${c}</span></div>
          <button type="submit" class="btn btn-primary btn-sm">${icon('plus')}<span>${txt('add')}</span></button>
        </div>
        <div class="chip-row"><span class="mi-or">${txt('addQuick')}</span>${e.presets.map(p => `<button type="button" class="chip-btn" data-preset="${p}">${idx(p.split(' ').map(Number), dir ? 'dir' : 'plane')}</button>`).join('')}</div>
        <p class="mi-hint">${txt('addHint', { count: txt(ws.is2D() ? 'addTwo' : 'addThree'), four, example: ws.is2D() ? '1 2' : dir ? '1 -1 0' : '1 1 1' })}${e.command ? ` ${txt('addInputBar', { command: e.command })}` : ''}</p>
        <p class="field-error" hidden></p>
      </form>`;
    }
    // one big invisible button covers the row, so the "?" can sit on top of it without nesting buttons
    return `<div class="menu-item is-button" data-key="${e.key}">
      <button type="button" class="mi-hit" aria-label="${txt('addEntryLabel', { title: e.title })}"></button>
      <span class="mi-text"><b>${e.title}${help(e)}</b><small>${e.desc}${e.command ? ` <code>${e.command}</code>` : ''}</small></span>
      ${e.advanced ? `<span class="chip chip-adv">${txt('advanced')}</span>` : '<span></span>'}
      <span class="mi-add">${icon('plus')}</span>
    </div>`;
  };

  const render = () => {
    const adv = ws.state.advanced, dim = ws.state.dim;
    const inView = e => (e.type ? (getType(e.type).dim || '3d') : '3d') === dim && ws.inMode(getType(e.type));
    const entries = menuEntries().filter(e => (adv || !e.advanced) && inView(e));
    const cats = CATEGORIES.filter(cat => cat.dims.includes(dim) && ws.inMode(cat)).map(cat => {
      const list = entries.filter(e => e.category === cat.id);
      const ready = list.filter(e => !unavailable(e)).length;
      return `<details class="menu-cat" name="add-cat" data-cat="${cat.id}"${cat.id === openCat ? ' open' : ''}>
        <summary>
          <span class="cat-icon">${icon(cat.icon)}</span>
          <span class="cat-text"><b>${cat.title}</b><small>${cat.blurb}</small></span>
          ${ready ? `<span class="cat-count" title="${txt('addAvailable', { count: ready })}">${ready}</span>` : `<span class="chip chip-soon">${list.some(unavailable) ? txt('cubicOnly') : txt('addSoon')}</span>`}
          <span class="cat-chev">${icon('chevronDown')}</span>
        </summary>
        <div class="menu-items">${list.map(entryHTML).join('')}</div>
      </details>`;
    }).join('');
    return `<div class="menu-head"><span class="menu-title">${txt('addMenuTitle')}</span>
      <span class="menu-sub">${ws.isDefects() ? txt('addMenuSubDefects') : `${txt('addMenuSub')}${adv || dim === '2d' ? '' : ` ${txt('addMenuMore')}`}`}</span></div>
      <div class="menu-cats">${cats}</div>`;
  };

  const submit = (form, text) => {
    const entry = menuEntries().find(e => e.key === form.dataset.key);
    const res = ws.addFromMenu(entry, text);
    const err = form.querySelector('.field-error'), input = form.querySelector('.idx-input');
    if (res && res.error) {
      showError(input, err, res.error);
      restartAnim(form, 'shake');
      input.focus();
      return;
    }
    pop.close();
  };

  const focusFirstInput = el => {
    if (window.matchMedia && window.matchMedia('(pointer: coarse)').matches) return; // don't pop up a keyboard on tablets
    const input = el.querySelector('.menu-cat[open] .idx-input');
    if (input) input.focus({ preventScroll: true });
  };

  const pop = new Popover({
    anchor,
    className: 'add-menu',
    label: txt('addMenuTitle'),
    render,
    onClose: () => { openCat = null; },
    onCreate(el) {
      // <details> toggle events do not bubble, so listen in the capture phase
      el.addEventListener('toggle', e => {
        const d = e.target;
        if (!d.matches || !d.matches('.menu-cat') || !d.open) return;
        openCat = d.dataset.cat;
        focusFirstInput(el);
      }, true);
      el.addEventListener('submit', e => {
        e.preventDefault();
        const f = e.target;
        if (f.dataset.vector !== undefined) {
          const v = k => parseFloat(f.elements[k].value);
          const vals = ['x0', 'y0', 'x1', 'y1'].map(v);
          const err = f.querySelector('.field-error');
          if (vals.some(x => !Number.isFinite(x)) || (vals[0] === vals[2] && vals[1] === vals[3])) {
            err.hidden = false;
            err.textContent = txt('msgTwoPoints');
            return;
          }
          ws.addItem('vector2d', { from: [vals[0], vals[1]], to: [vals[2], vals[3]] });
          pop.close();
          return;
        }
        submit(f, f.querySelector('.idx-input').value);
      });
      el.addEventListener('input', e => {
        const form = e.target.closest('form');
        if (!form) return;
        showError(e.target, form.querySelector('.field-error'), '');
      });
      el.addEventListener('click', e => {
        if (e.target.closest('[data-pick]')) { pop.close(); ws.startVectorPick(); return; }
        const preset = e.target.closest('[data-preset]');
        if (preset) { submit(preset.closest('form'), preset.dataset.preset); return; }
        const btn = e.target.closest('.menu-item.is-button');
        if (btn) {
          ws.addFromMenu(menuEntries().find(x => x.key === btn.dataset.key), null);
          pop.close();
        }
      });
    },
  });
  return pop;
}
