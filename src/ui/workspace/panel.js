/* Markup for the object panel: one card per object. */
import { getType } from '../../objects/index.js';
import { icon } from '../icons.js';
import { esc } from '../dom.js';
import { toggle, helpButton, appearanceShell } from '../controls.js';
import { getTopic, helpKeyFor } from '../../help/index.js';

import { PALETTE, plainText } from '../../objects/model.js';
import { txt } from '../../text.js';

/* ---------- object cards ---------- */

function appearance(item, T, colour) {
  const auto = T.themeColour;
  const on = c => (item.colour && c.toLowerCase() === item.colour.toLowerCase() ? ' is-on' : '');
  const swatches = PALETTE.map(c =>
    `<button type="button" class="swatch${on(c)}" style="--c:${c}" data-act="colour" data-value="${c}" aria-label="${txt('swatchLabel', { hex: c })}"></button>`).join('');
  const autoBtn = auto
    ? `<button type="button" class="swatch swatch-auto${item.colour ? '' : ' is-on'}" data-act="colour" data-value="auto" title="${txt('swatchAutoTitle')}" aria-label="${txt('swatchAutoLabel')}"></button>`
    : '';
  // collapsed by default; remembered per object while the app runs
  return appearanceShell(item, colour, `<div class="field"><div class="field-label">${txt('colour')}</div>
      <div class="swatches">${autoBtn}${swatches}
        <label class="swatch swatch-custom" title="${txt('pickAnyColour')}"><input type="color" value="${colour}" data-field="colour" aria-label="${txt('pickAnyColour')}"></label>
      </div></div>`, txt('appearanceColour'));
}

export function objectCard(item, ctx) {
  const T = getType(item.type);
  const err = T.error ? T.error(item, ctx) : null;
  const colour = ctx.colour(item);
  const label = ctx.label(item);
  const open = !!item.expanded;
  const name = esc(plainText(label));
  const colours = T.appearance === true; // colour + transparency controls
  const eye = !!T.appearance;            // 'eye' = visibility toggle only
  const lead = colours
    ? `<label class="obj-swatch" title="${txt('colour')}"><input type="color" value="${colour}" data-field="colour" aria-label="${txt('colourOf', { name })}"></label>`
    : `<span class="obj-icon">${icon(T.icon)}</span>`;
  const helpKey = helpKeyFor(T, item, ctx), help = helpKey && getTopic(helpKey);

  return `<li class="obj${item.visible ? '' : ' is-hidden'}${err ? ' has-error' : ''}${open ? ' is-open' : ''}${colours ? '' : ' is-calc'}" data-id="${item.id}" style="--c:${colour}">
    <div class="obj-row">
      ${lead}
      <button type="button" class="obj-main" data-act="expand" aria-expanded="${open}" title="${help ? esc(help.title) : ''}">
        <span class="obj-label">${label}</span>
        <span class="obj-sub">${T.summary ? T.summary(item, ctx) : ''}</span>
      </button>
      <div class="obj-acts">
        ${helpKey ? helpButton(helpKey, { item: item.id }) : ''}
        ${eye ? `<button type="button" class="icon-btn obj-eye" data-act="visible" aria-pressed="${item.visible}" title="${item.visible ? txt('hide') : txt('show')}" aria-label="${item.visible ? txt('hide') : txt('show')} ${name}">${icon(item.visible ? 'eye' : 'eyeOff')}</button>` : ''}
        ${T.fixed ? '' : `<button type="button" class="icon-btn obj-del" data-act="delete" title="${txt('delete')}" aria-label="${txt('deleteConfirm', { name })}">${icon('trash')}</button>`}
        <button type="button" class="icon-btn obj-chev" data-act="expand" aria-expanded="${open}" title="${txt('cardSettings')}" aria-label="${txt('cardSettingsFor', { name })}">${icon('chevronDown')}</button>
      </div>
    </div>
    <div class="obj-settings"${open ? '' : ' inert'}>
      <div class="obj-settings-clip"><div class="obj-settings-body">
        ${T.fixed ? '' : `<div class="field"><label class="field-label" for="nm-${item.id}">${txt('cardName')}</label>
          <input id="nm-${item.id}" class="input input-name" data-field="name" value="${esc(item.name ?? '')}" maxlength="20" autocomplete="off" spellcheck="false" autocapitalize="off">
          <p class="field-error" data-name-error hidden></p>
          <p class="field-hint">${item.type === 'plane' ? txt('cardNameHintPlane', { name: esc(item.name) }) : item.type === 'direction' ? txt('cardNameHintDirection', { name: esc(item.name) }) : txt('cardNameHint')}</p></div>`}
        ${!T.fixed && T.definition ? `<div class="def-row"><span class="field-label">${txt('cardDefinition')}</span><code class="def-code">${esc(T.definition(item, ctx))}</code>
          <button type="button" class="btn btn-soft btn-sm" data-act="edit-def" title="${txt('cardEditTitle')}">${icon('pencil')}<span>${txt('cardEdit')}</span></button></div>` : ''}
        ${T.settings ? T.settings(item, ctx) : ''}
        ${colours ? appearance(item, T, colour) : ''}
      </div></div>
    </div>
  </li>`;
}

/** The Added list before anything is added; Defects mode suggests a defect instead of a plane. */
export const emptyState = (defects = false) => `<li class="empty-state">
  <span class="empty-art">${icon('plus')}</span>
  <p><b>${txt('emptyTitle')}</b></p>
  <p>${txt(defects ? 'emptyTextDefects' : 'emptyText')}</p>
</li>`;
