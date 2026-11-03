/* =====================================================================
   Objects linked to one plane or one direction (spacing, intercepts,
   direction components). They keep the id of their source in
   item.src, so renames and index changes flow through, and deleting the
   source warns first (deps). linkedType() registers such a type together
   with its input-bar command, e.g. Spacing(p1).
   Also the small item helpers shared by every type that picks objects.
   ===================================================================== */
import { registerType, getType } from './registry.js';
import { registerCommand } from './commands.js';
import { esc } from '../ui/dom.js';
import { note, actionButton } from '../ui/controls.js';
import { txt } from '../text.js';

const QUICK = { plane: '1 1 1', direction: '1 1 0' };
const EXAMPLE = { plane: 'p1', direction: 'd1' };

/** Every plane (or direction …) of this type with valid indices. */
export const validItems = (ctx, type) => ctx.items.filter(i => i.type === type && !i.parsed.error);

/** <option>s for a <select> of these objects by name, with a "Choose a …" placeholder. */
export const itemOptions = (list, sel, ctx, kind) => `<option value="">${txt(kind === 'plane' ? 'chooseAPlane' : 'chooseADirection')}</option>${list
  .map(o => `<option value="${o.id}"${o.id === sel ? ' selected' : ''}>${esc(ctx.labelText(o))}</option>`).join('')}`;

/** Name of the object with this id, or '?' once it is gone. */
export const nameOf = (ctx, id) => (ctx.itemById(id) || { name: '?' }).name;

export const invalidIndices = it => ({ error: txt('msgInvalidIndices', { name: it.name, error: it.parsed.error }) });

/** The linked plane or direction, or null while none (valid) is chosen. */
export function sourceOf(item, ctx, kind) {
  const s = ctx.itemById(item.src);
  return s && s.type === kind && !s.parsed.error ? s : null;
}

/** Source for a new object: the one asked for, else the most recently added. */
function defaultSource(init, ctx, kind) {
  if (init.src != null) return init.src;
  const last = validItems(ctx, kind).slice(-1)[0];
  return last ? last.id : null;
}

/** <select> of every valid plane (or direction) by name, plus a quick-add button when there is none. */
function sourcePicker(item, ctx, kind, label) {
  const list = validItems(ctx, kind);
  let out = `<div class="field"><label class="field-label" for="src-${item.id}">${label}</label>
    <select class="input" id="src-${item.id}" data-field="src">${itemOptions(list, item.src, ctx, kind)}</select></div>`;
  if (!list.length) {
    out += note(txt(kind === 'plane' ? 'linkedAddPlaneFirst' : 'linkedAddDirectionFirst'))
      + `<div class="btn-row">${actionButton('quick-src', kind === 'plane' ? txt('linkedQuickPlane') : txt('linkedQuickDirection'), 'plus')}</div>`;
  }
  return out;
}

/**
 * Hide the source plane when a view that draws its own copy of it is added,
 * so the two don't overlap. Returns a note for the toast.
 */
function hideSource(item, ctx) {
  const s = ctx.itemById(item.src);
  if (!s || !s.visible) return '';
  s.visible = false;
  return txt('msgSourceHidden', { name: esc(s.name) });
}

const what = it => (it.type === 'direction' ? txt('wordADirection') : it.type === 'plane' ? txt('wordAPlane') : txt('wordACalculation'));

/** Input-bar command Name(p1) (or Name(d1)) that adds an object of `type` linked to it. */
function registerLinkedCommand({ name, kind, type, help, group }) {
  const check = A => {
    if (A.type !== kind) return { error: txt('msgNeedsKind', { name: A.name, what: what(A), command: name, needed: kind === 'plane' ? txt('wordAPlane') : txt('wordADirection'), example: EXAMPLE[kind] }) };
    if (A.parsed.error) return invalidIndices(A);
    return null;
  };
  registerCommand({
    name,
    args: 1,
    group,
    type,
    usage: `${name}(${EXAMPLE[kind]})`,
    help,
    update(item, [A], ws) {
      const problem = check(A);
      if (problem) return problem;
      item.src = A.id;
      return { ok: txt('msgChanged', { label: ws.labelHTML(item) }), item };
    },
    example(dirs, planes) {
      const list = kind === 'plane' ? planes : dirs;
      return `${name}(${list.length ? list[list.length - 1].name : EXAMPLE[kind]})`;
    },
    run([A], ws, nm) {
      const problem = check(A);
      if (problem) return problem;
      const item = ws.addItem(type, { src: A.id, name: nm });
      return { ok: txt('msgCreated', { label: ws.labelHTML(item) }), item };
    },
  });
}

/**
 * Registers an object type linked to a `kind` ('plane' | 'direction') and its
 * command, e.g. Spacing(p1). It adds the source to create, the source picker
 * at the top of settings, the source field and quick-add button, deps,
 * definition and autoLabel ("Spacing (111)", or the title without a source).
 * hide: hide the source when this is added (the view draws its own copy).
 * The type's own create, settings, onField and onAction add to these.
 */
export function linkedType({ kind, command, commandHelp, commandGroup = txt('cmdGroupPlaneViews'), pickerLabel, hide = false, create, settings, onField, onAction, ...def }) {
  registerType({
    ...def,
    create: (init, ctx) => ({ src: defaultSource(init, ctx, kind), ...create(init, ctx) }),
    deps: item => (item.src != null ? [item.src] : []),
    definition: (item, ctx) => `${item.name} = ${command}(${nameOf(ctx, item.src)})`,
    ...(hide ? { afterAdd: hideSource } : {}),
    autoLabel(item, ctx) {
      const S = sourceOf(item, ctx, kind);
      return S ? `${command} ${getType(kind).autoLabel(S, ctx)}` : def.title;
    },
    settings: (item, ctx) => sourcePicker(item, ctx, kind, pickerLabel) + settings(item, ctx),
    onField(item, name, value, ctx, ws, phase) {
      if (name !== 'src') return onField && onField(item, name, value, ctx, ws, phase);
      item.src = value ? +value : null;
      ws.itemChanged(item);
    },
    onAction(item, act, el, ctx, ws) {
      if (act !== 'quick-src') return onAction && onAction(item, act, el, ctx, ws);
      const s = ws.addItem(kind, { text: QUICK[kind] }, { quiet: true });
      if (hide) s.visible = false;
      item.src = s.id;
      ws.itemChanged(item);
    },
  });
  registerLinkedCommand({ name: command, kind, type: def.type, help: commandHelp, group: commandGroup });
}
