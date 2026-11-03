/* =====================================================================
   Object-type registry. Everything in the panel is an item of a registered
   type; a new type is a module that calls registerType() (or linkedType /
   indexedType) and is imported in src/objects/index.js.

   Item (plain data): { id, type, dim, visible, name, colour (null = theme),
     transparency (0–100), expanded, ...fields from create }

   Type definition (all optional except type):
     type, prefix, title, icon   id, name prefix (d → d1), generic name, icon
     help            help topic key, or (item, ctx) → key
     dim             '2d' for 2D objects (default 3D)
     fixed           cannot be deleted (the scene objects)
     appearance      true: colour + transparency; 'eye': visibility only
     themeColour     offers an automatic colour that follows light / dark
     defaultTransparency, expandOnAdd
     menu            + Add entries [{ key, category, order, title, desc, input, source,
                     presets, init, help, command, advanced, unavailable(ctx) }]
     prepare(init, ws)          before the item exists (e.g. switch lattice)
     create(init, ctx)          → the type's own fields
     afterAdd(item, ctx, ws)    → note for the "Added" toast
     refresh(item, ctx)         re-derive after the lattice changes
     error(item, ctx)           → message or null
     parseText(text, ctx, typing), indicesOf(parsed)   typed indices (d1 = [1 1 0])
     definition(item, ctx)      → "p1 = (1 1 1)" for the card and Edit
     deps(item)                 → ids of the objects it uses (delete warnings)
     autoLabel(item, ctx)       → HTML label after the name
     summary(item, ctx)         → short HTML under the label
     settings(item, ctx)        → HTML of the settings dropdown
     live(item, ctx)            → HTML for the card's [data-live] part
     onField(item, field, value, ctx, ws, phase)   a data-field control changed
     onAction(item, act, el, ctx, ws)              a data-act button was pressed
     primitives(item, ctx)      → 3D (or 2D) primitives to draw
     hidesLatticePoints(item, ctx)   this object draws the lattice points itself
     framePad(item, ctx)        → extra room around the cell when framing
     pick(item, ctx, ray)       → { t, data, priority? } for a click in the view
     onPick(item, data, ctx, ws)
     legend(item, ctx), readout(item, ctx)   canvas legend / cut readout, or null

   ctx is built by SceneModel.recompute; ws is the workspace (addItem,
   itemChanged, redraw, lookAlong, …).
   ===================================================================== */
import { esc } from '../ui/dom.js';

const TYPES = new Map();
const MENU = [];

export function registerType(def) {
  if (TYPES.has(def.type)) throw new Error(`Object type "${def.type}" registered twice`);
  TYPES.set(def.type, def);
  for (const m of def.menu || []) MENU.push({ ...m, type: def.type });
}

export const getType = type => TYPES.get(type);

export const menuEntries = () => MENU.slice().sort((a, b) => (a.order ?? 50) - (b.order ?? 50));

/** The name together with the indices or title, e.g. "d1 [110]" or "ang1 Angle". */
export function itemLabelHTML(item, ctx) {
  const auto = getType(item.type).autoLabel(item, ctx);
  return item.name ? `<span class="nm">${esc(item.name)}</span> ${auto}` : auto;
}

/** Items that use the object with this id (for delete warnings). */
export function dependentsOf(id, items) {
  return items.filter(it => {
    const T = getType(it.type);
    return T.deps && T.deps(it).includes(id);
  });
}
