/* =====================================================================
   A number you type, with its unit (Part 4.5 §4) — used for radii.

   numberField(name, value, opts) is the markup; the workspace handles every
   field with [data-number] the same way (commitNumber and bindNumberKeys below):
   - the value is applied on Enter and when the field loses focus
   - ↑ / ↓ step it by data-step (Shift: 10 steps) and apply at once
   - text, zero and negative numbers (and values above data-max) are
     rejected with a short message; the last valid value is kept
   The type then gets the number through its usual onField(item, name, value).

   readPositive(text, opts) is the rule itself, without any DOM (tests use it).
   ===================================================================== */
import { $, esc, showError } from './dom.js';
import { trim } from './format.js';
import { getType } from '../objects/registry.js';
import { txt } from '../text.js';

/**
 * A positive number typed by the user → { value } or { error }.
 * Accepts "0.35", "0,35", ".35", "0.35 Å". max: largest allowed value (inclusive).
 */
export function readPositive(text, { max = Infinity, unit = 'Å', what = txt('numTheValue') } = {}) {
  const raw = String(text ?? '').trim().replace(/\s*(å|Å|a|angstrom|ångström)$/i, '').replace(',', '.');
  if (!raw) return { error: txt('numTypeNumber', { unit }) };
  if (!/^[+-]?(\d+\.?\d*|\.\d+)(e[+-]?\d+)?$/i.test(raw)) return { error: txt('numNotNumber', { text: String(text).trim() }) };
  const value = Number(raw);
  if (!Number.isFinite(value)) return { error: txt('numNotNumber', { text: String(text).trim() }) };
  if (value < 0) return { error: txt('numNegative', { what }) };
  if (value === 0) return { error: txt('numZero', { what }) };
  if (value > max + 1e-9) return { error: txt('numTooBig', { what, max: trim(max, 3), unit }) };
  return { value };
}

/** One step up or down from v (↑ / ↓). It never reaches 0 (then v stays) and stops at max. */
export function stepValue(v, dir, { step = 0.01, max = Infinity } = {}) {
  const next = +(v + dir * step).toFixed(6);
  if (next <= 0) return v;
  return Math.min(next, max);
}

/**
 * Markup of a number field.
 * opts: { label, unit = 'Å', step = 0.01, max, digits = 3, hint, what }
 */
export function numberField(name, value, { label = '', unit = 'Å', step = 0.01, max = null, digits = 3, hint = '', what = '' } = {}) {
  const shown = trim(value, digits);
  return `<div class="field num-field">
    ${label ? `<label class="field-label"><span>${label}</span></label>` : ''}
    <div class="num-row">
      <input class="input num-input" type="text" inputmode="decimal" autocomplete="off" spellcheck="false"
        data-field="${name}" data-number data-step="${step}" data-unit="${esc(unit)}"${max != null ? ` data-max="${max}"` : ''}
        data-last="${shown}"${what ? ` data-what="${esc(what)}"` : ''} value="${shown}" aria-label="${txt('numFieldLabel', { label: esc(String(label).replace(/<[^>]+>/g, '') || name), unit: esc(unit) })}">
      <span class="num-unit">${esc(unit)}</span>
      <span class="num-keys" aria-hidden="true">↑ ↓</span>
    </div>
    <p class="field-error" data-num-error role="status" hidden></p>
    ${hint ? `<p class="field-hint">${hint}</p>` : ''}
  </div>`;
}

/** The options a [data-number] input carries. */
export const fieldOptions = input => ({
  step: +input.dataset.step || 0.01,
  max: input.dataset.max != null ? +input.dataset.max : Infinity,
  unit: input.dataset.unit || '',
  what: input.dataset.what || txt('numTheValue'),
});

/**
 * A typed number ([data-number]) is applied: Enter or leaving
 * the field. Text, zero, negative or too-large values show a short message and the last
 * valid value is kept (and put back in the field).
 */
export function commitNumber(ws, item, input) {
  const T = getType(item.type), opts = fieldOptions(input), last = input.dataset.last;
  const err = $('[data-num-error]', input.closest('.num-field'));
  const res = readPositive(input.value, opts);
  if (res.error) {
    showError(input, err, txt('numKept', { error: res.error, last, unit: opts.unit }));
    input.value = last;
    if (document.activeElement === input) input.select();
    return false;
  }
  showError(input, err, '');
  const shown = trim(res.value, 4);
  input.value = shown;
  if (Math.abs(res.value - +last) < 1e-12) return true;
  input.dataset.last = shown;
  if (T.onField) T.onField(item, input.dataset.field, res.value, ws.ctx, ws, 'change');
  return true;
}

/** Number fields in the panel: Enter applies, ↑ / ↓ step (Shift: ten steps), Escape puts the last value back. */
export function bindNumberKeys(ws, panel) {
  panel.addEventListener('keydown', e => {
    const f = e.target;
    if (!f.dataset || f.dataset.number === undefined) return;
    const item = ws.itemOf(f);
    if (!item) return;
    if (e.key === 'Enter') { e.preventDefault(); commitNumber(ws, item, f); return; }
    if (e.key === 'Escape') {
      f.value = f.dataset.last;
      showError(f, $('[data-num-error]', f.closest('.num-field')), '');
      e.preventDefault();
      return;
    }
    if (e.key !== 'ArrowUp' && e.key !== 'ArrowDown') return;
    e.preventDefault();
    const opts = fieldOptions(f), base = +f.dataset.last;
    const step = e.shiftKey ? 10 * opts.step : opts.step;
    f.value = String(stepValue(base, e.key === 'ArrowUp' ? 1 : -1, { step, max: opts.max }));
    commitNumber(ws, item, f);
  });
}
