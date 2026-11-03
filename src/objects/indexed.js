/* Objects typed as indices: 3D directions [uvw] and planes (hkl), 2D directions [uv]
   and lines (hk). indexedType() adds what they share: parsing, the Indices field and
   its error, the error checks in summary and primitives, and the text and family fields. */
import { registerType } from './registry.js';
import { esc } from '../ui/dom.js';
import { idx } from '../ui/format.js';
import { field, indexInput } from '../ui/controls.js';
import { txt } from '../text.js';

/** Hint under a 3D Indices field, e.g. hexHint(ctx, '[]', 'uvtw', '1 1 0'). */
export const hexHint = (ctx, [o, c], [a, b, x, z], example) => (ctx.hexAxes
  ? (ctx.advanced ? txt('indexHintHex', { open: o, first: a, second: b, last: z, close: c, extra: x }) : txt('indexHintHexBasic'))
  : txt('indexHint', { example }));

/** Facts rows with both notations on hexagonal axes (none otherwise). */
export const indexRows = (ctx, three, four, kind) => (ctx.hexAxes
  ? [[txt('indexThree'), idx(three, kind)], [txt('indexFour'), idx(four, kind)]]
  : []);

/**
 * Registers an index-typed object type.
 * key: field of item.parsed with the indices ('uvw', 'hkl', 'uv', 'hk'); brackets: '[]' or '()'
 * parse(text, ctx, typing) → { [key] } or { error }; label(indices, ctx) → autoLabel HTML
 * hint(ctx): text under the Indices field; family: the type has an "all parallel" toggle
 * typed(item): false for items worked out some other way (no Indices field, no text edits)
 * summary, settings and primitives only see valid items; settings adds below the Indices field.
 */
export function indexedType({ key, brackets, placeholder, parse, label, hint, family = false, typed = () => true, ...def }) {
  const [o, c] = brackets;
  registerType({
    create: ({ text, family: all = false }, ctx) => ({ text, ...(family ? { family: all } : {}), parsed: parse(text, ctx, true) }),
    parseText: parse,
    indicesOf: parsed => parsed[key],
    refresh: (item, ctx) => { item.parsed = parse(item.text, ctx, false); },
    error: item => item.parsed.error || null,
    definition: item => `${item.name} = ${o}${item.text}${c}`,
    ...def,
    autoLabel: (item, ctx) => (!item.parsed.error ? label(item.parsed[key], ctx) : typed(item) ? `${o}${esc(item.text)}${c}` : `${o} ? ${c}`),
    summary: (item, ctx) => (item.parsed.error ? esc(item.parsed.error) : def.summary(item, ctx)),
    settings(item, ctx) {
      if (!typed(item)) return def.settings(item, ctx);
      const out = field(txt('indicesLabel'), indexInput('text', item.text, brackets, placeholder), hint(ctx));
      return item.parsed.error ? `${out}<p class="field-error">${esc(item.parsed.error)}</p>` : out + def.settings(item, ctx);
    },
    onField(item, name, value, ctx, ws, phase) {
      if (name === 'text' && phase === 'change' && typed(item)) {
        item.text = String(value).trim();
        item.parsed = parse(item.text, ctx, true);
        ws.itemChanged(item);
      } else if (name === 'family' && family) {
        item.family = value;
        ws.itemChanged(item);
      } else if (def.onField) def.onField(item, name, value, ctx, ws, phase);
    },
    primitives: (item, ctx) => (item.parsed.error ? [] : def.primitives(item, ctx)),
  });
}
