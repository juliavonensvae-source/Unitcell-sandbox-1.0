/* =====================================================================
   Input bar: parsing, a registry of commands and running a line (runLine,
   used by SceneModel.runCommand). Pure (no DOM).

   Accepted input
     d1 = [1 1 0]          direction (name optional: [1 1 0])
     p1 = (1 1 1)          plane, four indices on hexagonal axes
     Angle(d1, p1)         any registered command, optionally named: x = Angle(…)
   ===================================================================== */

import { getType } from './registry.js';
import { txt } from '../text.js';

const COMMANDS = new Map(); // lower-case name → definition

/**
 * def: { name, usage, help, args: n, group, dims: ['3d'] | ['2d'] | ['3d', '2d'], mode ('defects'; default Crystal Structures),
 *        type (what it creates; a function of the view for Family),
 *        raw (arguments are passed as text, e.g. Vector's points),
 *        run(args, ws, name?) → { ok, item } | { error },
 *        update(item, args, ws) → { ok } | { error }   when x = Name(…) names an existing x }
 * Commands are registered next to the object type they create.
 */
export function registerCommand(def) {
  COMMANDS.set(def.name.toLowerCase(), def);
}

export const getCommand = name => COMMANDS.get(String(name).toLowerCase());
export const commandList = () => [...COMMANDS.values()];

const NAME = /^[A-Za-z_][A-Za-z0-9_]*$/;

/**
 * Parse one line of the input bar.
 * → { name?, kind: 'direction', text } | { name?, kind: 'plane', text } | { name?, kind: 'call', fn, args } | { error }
 */
export function parseCommand(input) {
  const text = String(input ?? '').trim();
  if (!text) return { error: txt('msgTypeSomething') };
  let name = null, rhs = text;
  const eq = text.indexOf('=');
  if (eq >= 0) {
    name = text.slice(0, eq).trim();
    rhs = text.slice(eq + 1).trim();
    if (!name) return { error: txt('msgNameBeforeEq') };
    if (!rhs) return { error: txt('msgWhatShould', { name }) };
  }
  let m;
  if ((m = rhs.match(/^\[(.*)\]$/))) return { name, kind: 'direction', text: m[1] };
  if ((m = rhs.match(/^\((.*)\)$/))) return { name, kind: 'plane', text: m[1] };
  if ((m = rhs.match(/^([A-Za-z]+)\s*\((.*)\)$/))) {
    const args = splitArgs(m[2]);
    if (args === null) return { error: txt('msgBrackets') };
    return { name, kind: 'call', fn: m[1], args };
  }
  if (NAME.test(rhs) && !name) return { name: null, kind: 'show', target: rhs };
  if (/^[[(]/.test(rhs)) return { error: txt('msgBracketMissing') };
  return { error: txt('msgCantRead') };
}

/** Split "p1, (1, 1, 1), [1 0]" on the commas that are not inside brackets; null when brackets don't match. */
function splitArgs(text) {
  const out = [];
  let depth = 0, cur = '';
  for (const ch of String(text)) {
    if (ch === '(' || ch === '[') depth++;
    if (ch === ')' || ch === ']') depth--;
    if (depth < 0) return null;
    if (ch === ',' && depth === 0) { out.push(cur.trim()); cur = ''; } else cur += ch;
  }
  if (depth !== 0) return null;
  if (cur.trim() || out.length) out.push(cur.trim());
  return out;
}

/** The identifier being typed just before the caret, for suggestions: { word, start }. */
export function wordAt(text, caret) {
  const before = text.slice(0, caret);
  const m = before.match(/[A-Za-z_][A-Za-z0-9_]*$/);
  return m ? { word: m[0], start: caret - m[0].length } : { word: '', start: caret };
}

/* ---------- running a line ---------- */

const LITERAL = { '3d': { '[': 'direction', '(': 'plane' }, '2d': { '[': 'direction2d', '(': 'line2d' } };
const WORD = { direction: txt('wordADirection'), plane: txt('wordAPlane'), direction2d: txt('wordADirection'), line2d: txt('wordALine'), vector2d: txt('wordAVector') };
const what = it => WORD[it.type] || txt('wordA', { thing: (getType(it.type).title || it.type).toLowerCase() });

/**
 * Run one line of the input bar → { ok: html } | { error: text } | { show: item }.
 *   d1 = [1 1 0]  /  p1 = (1 1 1)   create or change a direction / plane (2D: [u v], (h k))
 *   Name(args)  /  x = Name(args)   any registered command; on an existing x it redefines x
 *   p1                              show that object
 */
export function runLine(model, text) {
  if (!model.ctx) model.recompute();
  const cmd = parseCommand(text);
  if (cmd.error) return { error: cmd.error };
  const dim = model.state.dim, defects = model.isDefects();
  const missing = n => {
    const used = model.takenNames();
    if (used.length) return txt('msgMissingInUse', { name: n, names: used.join(', ') });
    return txt(defects ? 'msgMissingCreateDefects' : dim === '2d' ? 'msgMissingCreate2D' : 'msgMissingCreate3D', { name: n });
  };

  if (cmd.kind === 'show') {
    const it = model.byName(cmd.target);
    if (it) return { show: it, ok: txt('msgHereIs', { label: model.labelHTML(it) }) };
    const def = getCommand(cmd.target);
    if (def && model.inMode(def) && (Array.isArray(def.args) ? def.args[0] : def.args) === 0) return model.runCommand(`${cmd.target}()`);
    return { error: missing(cmd.target) };
  }

  if (cmd.kind === 'direction' || cmd.kind === 'plane') {
    if (defects) return { error: txt('msgDefectsNoIndices') };
    const type = LITERAL[dim][cmd.kind === 'direction' ? '[' : '('];
    const T = getType(type);
    if (cmd.name) {
      const existing = model.byName(cmd.name);
      if (existing) {
        if (existing.type !== type) return { error: txt('msgAlreadyNot', { name: cmd.name, what: what(existing), word: WORD[type] }) };
        if (existing.source) return { error: txt('msgWorkedOut', { name: cmd.name }) };
        const parsed = T.parseText(cmd.text, model.ctx, true);
        if (parsed.error) return { error: parsed.error };
        existing.text = cmd.text.trim();
        existing.parsed = parsed;
        model.itemChanged(existing);
        return { ok: txt('msgChanged', { label: model.labelHTML(existing) }), item: existing, changed: true };
      }
      const problem = model.nameProblem(cmd.name);
      if (problem) return { error: problem };
    }
    const res = model.addItem(type, { text: cmd.text.trim(), name: cmd.name }, { validate: true });
    if (res.error) return { error: res.error };
    return { ok: txt('msgCreated', { label: model.labelHTML(res) }), item: res };
  }

  const def = getCommand(cmd.fn);
  if (!def) {
    const known = commandList().filter(c => model.inMode(c) && (c.dims || ['3d']).includes(dim)).map(c => c.usage);
    return { error: known.length ? txt('msgUnknownCommandTry', { name: cmd.fn, examples: known.slice(0, 4).join(', ') }) : txt('msgUnknownCommand', { name: cmd.fn }) };
  }
  if (!model.inMode(def)) return { error: txt(defects ? 'msgWorksInCrystal' : 'msgWorksInDefects', { name: def.name }) };
  if (!(def.dims || ['3d']).includes(dim)) {
    return { error: txt(dim === '2d' ? 'msgWorksIn3D' : 'msgWorksIn2D', { name: def.name }) };
  }
  // args: a number, or [fewest, most] for commands with optional arguments
  const [fewest, most] = Array.isArray(def.args) ? def.args : [def.args, def.args];
  if (cmd.args.length < fewest || cmd.args.length > most) {
    if (Array.isArray(def.args)) return { error: fewest ? txt('msgTakesRange', { name: def.name, fewest, most, usage: def.usage }) : txt('msgTakesUpTo', { name: def.name, most, usage: def.usage }) };
    return { error: def.args === 0
      ? txt('msgTakesNothing', { name: def.name, usage: def.usage })
      : txt(def.raw ? (def.args > 1 ? 'msgNeedsValues' : 'msgNeedsValue') : (def.args > 1 ? 'msgNeedsNames' : 'msgNeedsName'), { name: def.name, count: def.args, usage: def.usage }) };
  }
  const defType = typeof def.type === 'function' ? def.type(dim) : def.type;
  const existing = cmd.name ? model.byName(cmd.name) : null;
  if (cmd.name && !existing) {
    const problem = model.nameProblem(cmd.name);
    if (problem) return { error: problem };
  }
  if (existing && (!def.update || existing.type !== defType)) {
    return { error: defType
      ? txt('msgAlreadyNot', { name: cmd.name, what: what(existing), word: WORD[defType] || txt('wordA', { thing: (getType(defType).title || '').toLowerCase() }) })
      : txt('msgAlready', { name: cmd.name, what: what(existing) }) };
  }

  // arguments: names, or indices typed in place: Spacing((1 1 1)), Angle([1 1 0], p1)
  let args = cmd.args;
  const made = [];
  const undo = () => { for (const it of made) model.state.items.splice(model.state.items.indexOf(it), 1); if (made.length) model.recompute(); };
  if (!def.raw) {
    args = [];
    for (const n of cmd.args) {
      let it = model.byName(n);
      const lit = !it && !defects && (n.match(/^\[(.*)\]$/) ? [LITERAL[dim]['['], n.slice(1, -1)] : n.match(/^\((.*)\)$/) ? [LITERAL[dim]['('], n.slice(1, -1)] : null);
      if (lit) {
        it = model.sourceFromText(lit[0], lit[1]);
        if (it.error) { undo(); return { error: it.error }; }
        if (it.__new) { delete it.__new; made.push(it); }
      }
      if (!it) { undo(); return { error: missing(n) }; }
      args.push(it);
    }
  }
  const res = existing ? def.update(existing, args, model) : def.run(args, model, cmd.name);
  if (res.error) undo();
  else if (existing) { model.itemChanged(existing); res.changed = true; }
  return res;
}
