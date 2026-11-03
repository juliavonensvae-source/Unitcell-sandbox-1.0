/* Markup snippets for settings controls, shared by every object type.
   Controls report changes through data-field (value controls) or data-act (buttons). */
import { esc } from './dom.js';
import { icon } from './icons.js';
import { texWrap } from '../help/tex.js';
import { getTopic } from '../help/index.js';
import { txt } from '../text.js';

/**
 * The small round "?" button. A click anywhere in the app opens the help popover
 * for its topic (wired once in src/ui/components/help.js), so this is just markup.
 * @param key   help topic (src/help/topics)
 * @param o.item id of the object the button belongs to: worked examples use its indices
 * @param o.arg  an extra hint for the topic, e.g. a crystal system
 */
export function helpButton(key, { item = null, arg = null, cls = '' } = {}) {
  const t = getTopic(key);
  if (!t) return '';
  return `<button type="button" class="help-btn${cls ? ` ${cls}` : ''}" data-help="${key}"`
    + `${item != null ? ` data-help-item="${esc(item)}"` : ''}${arg != null ? ` data-help-arg="${esc(arg)}"` : ''}`
    + ` title="${txt('helpBtnTitle', { title: esc(t.title) })}" aria-label="${txt('helpBtnLabel', { title: esc(t.title) })}"><span aria-hidden="true">?</span></button>`;
}

/** A formula box typeset with KaTeX; `tag` names where it applies, e.g. 'Cubic only'. */
export const formulaTex = (src, tag = '') =>
  `<div class="formula">${tag ? `<span class="f-tag">${tag}</span>` : ''}${texWrap(src)}</div>`;

export const field = (label, control, hint = '') =>
  `<div class="field">${label ? `<div class="field-label">${label}</div>` : ''}${control}${hint ? `<p class="field-hint">${hint}</p>` : ''}</div>`;

export const toggle = (name, checked, label, { hint = '', disabled = false } = {}) =>
  `<label class="switch-row${disabled ? ' is-disabled' : ''}">
    <span class="switch-text">${label}${hint ? `<small>${hint}</small>` : ''}</span>
    <span class="switch"><input type="checkbox" role="switch" data-field="${name}"${checked ? ' checked' : ''}${disabled ? ' disabled' : ''}>
    <span class="switch-track"><span class="switch-thumb"></span></span></span>
  </label>`;

/** Segmented buttons; a click is reported as field `name` = option value. */
export const segmented = (name, options, value) =>
  `<div class="seg seg-block" role="group">${options.map(o =>
    `<button type="button" data-seg="${name}" data-value="${o.value}" aria-pressed="${o.value === value}">${o.icon ? icon(o.icon) : ''}<span>${o.label}</span></button>`).join('')}</div>`;

export const range = (name, value, { min = 0, max = 100, step = 5, unit = '%', label = '' } = {}) =>
  `<div class="field">
    <label class="field-label range-label"><span>${label}</span><output data-out="${name}">${value}${unit}</output></label>
    <input class="range" type="range" min="${min}" max="${max}" step="${step}" value="${value}" data-field="${name}" data-unit="${unit}" style="--p:${((value - min) / (max - min)) * 100}%" aria-label="${esc(label.replace(/<[^>]+>/g, ''))}">
  </div>`;

export const facts = rows =>
  `<dl class="facts">${rows.filter(Boolean).map(([k, v]) => `<div><dt>${k}</dt><dd>${v}</dd></div>`).join('')}</dl>`;

export const formula = html => `<div class="formula">${html}</div>`;

export const note = html => `<p class="note">${html}</p>`;

export const indexInput = (name, value, [open, close], placeholder) =>
  `<div class="idx-field"><span class="idx-br">${open}</span><input class="idx-input" data-field="${name}" value="${esc(value)}" placeholder="${placeholder}" autocomplete="off" spellcheck="false" aria-label="${txt('indicesLabel')}"><span class="idx-br">${close}</span></div>`;

/** The card's collapsed Appearance dropdown: a colour dot, the colour controls (body) and a transparency slider. */
export const appearanceShell = (item, dot, body, sub = txt('appearanceColours')) =>
  `<details class="appear" data-appear${item.appearOpen ? ' open' : ''}>
    <summary><span class="appear-dot" style="--c:${dot}"></span><span>${txt('appearance')}</span>
      <small>${item.transparency ? txt('appearanceTransparent', { percent: item.transparency }) : sub}</small>${icon('chevronDown', 'cat-chev')}</summary>
    <div class="appear-body">
      ${body}
      ${range('transparency', item.transparency, { min: 0, max: 100, step: 5, label: txt('transparency') })}
    </div>
  </details>`;

/**
 * Colour row for one kind of site or ion: a "default colour" swatch and a colour picker.
 * Reported as act `${act}-auto` (with data-`${data}` = key) and field `${act}-${key}`.
 */
export const kindSwatches = ({ label, colour, own, act, data, key, aria }) =>
  `<div class="field"><div class="field-label">${label}</div>
      <div class="swatches">
        <button type="button" class="swatch swatch-auto${own ? '' : ' is-on'}" data-act="${act}-auto" data-${data}="${key}" title="${txt('defaultColour')}" aria-label="${txt('defaultColour')}"></button>
        <label class="swatch swatch-custom site-swatch${own ? ' is-on' : ''}" style="--c:${colour}" title="${txt('pickAnyColour')}"><input type="color" value="${colour}" data-field="${act}-${key}" aria-label="${aria}"></label>
      </div></div>`;

export const actionButton =(act, label, ic = '', cls = 'btn-soft') =>
  `<button type="button" class="btn ${cls} btn-sm" data-act="${act}">${ic ? icon(ic) : ''}<span>${label}</span></button>`;
