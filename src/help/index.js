/* =====================================================================
   Help topics — every "?" button opens one of these.

   A topic (src/help/topics/*.js):
     key, title, icon            id (also the `help` key of object types)
     scope                       which lattices it applies to, e.g. 'Cubic only' (default 'All lattices')
     explain                     2–3 plain sentences for the popover (HTML)
     formulas                    [{ tex, tag? }] or (ctx, item, arg) → […]; display formulas
     symbols                     [[tex, meaning]]: what each symbol means
     now(ctx, item, arg)         optional one line about the lattice on screen
     more                        optional SEE MORE panel:
       steps                     [{ text?, tex? }] — the derivation, one step per line
       diagram(ctx, item, arg)   HTML/SVG picture (src/help/diagrams.js)
       highlight(ctx, item, arg) { prims, caption, look? } for the 3D view (src/help/highlights.js),
                                 or { unavailable: 'why' }
       example(ctx, item, arg)   { title, intro?, steps: [{ text?, tex? }], result? } with the values on screen
     related                     keys of other topics
   All text comes from text/help/ through txt() (src/text.js).
   Text fields may contain inline maths as $…$ (rendered with KaTeX).
   `item` is the object whose "?" was pressed (or null); `arg` is an extra
   hint from the button (data-help-arg), e.g. the crystal system of a picker row.
   ===================================================================== */
import systems from './topics/systems.js';
import cell from './topics/cell.js';
import indices from './topics/indices.js';
import calculations from './topics/calculations.js';
import interstitials from './topics/interstitials.js';
import flat from './topics/flat.js';
import ionic from './topics/ionic.js';
import stacking from './topics/stacking.js';
import defects from './topics/defects.js';
import dislocations from './topics/dislocations.js';
import slip from './topics/slip.js';
import { txt } from '../text.js';

const TOPICS = new Map();
for (const t of [...systems, ...cell, ...indices, ...calculations, ...interstitials, ...ionic, ...stacking, ...flat, ...defects, ...dislocations, ...slip]) {
  if (TOPICS.has(t.key)) throw new Error(`Help topic "${t.key}" defined twice`);
  TOPICS.set(t.key, { ...t, scope: t.scope ?? txt('allLattices') });
}

export const getTopic = key => TOPICS.get(key) || null;
export const allTopics = () => [...TOPICS.values()];

/** A topic field that may be a function of the scene. */
export const resolve = (value, ctx, item = null, arg = null) => (typeof value === 'function' ? value(ctx, item, arg) : value);

/** The formulas of a topic for the scene on screen (nulls dropped). */
export const topicFormulas = (t, ctx, item, arg) => (resolve(t.formulas, ctx, item, arg) || []).filter(Boolean);

/** The derivation steps of a topic. */
export const topicSteps = t => (t.more && t.more.steps) || [];

/** The help key of an object type for one item (types may pick the topic per item). */
export function helpKeyFor(T, item, ctx) {
  const k = typeof T.help === 'function' ? T.help(item, ctx) : T.help;
  return getTopic(k) ? k : null;
}
