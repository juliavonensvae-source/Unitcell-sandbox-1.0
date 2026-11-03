/* Object names: rules, reserved words and default names (d1, p1, …). Pure. */

import { txt } from '../text.js';
/** Reserved for the axes (checked without regard to upper/lower case). */
const RESERVED = ['a', 'b', 'c', 'a1', 'a2', 'a3'];

const NAME_RE = /^[A-Za-z_][A-Za-z0-9_]*$/;
const MAX = 20;

/**
 * Returns a friendly message when a name is not allowed, or null when it is.
 * @param {string} name
 * @param {Iterable<string>} taken   names already used by other objects
 * @param {string[]} commandNames   e.g. ['Angle', 'Intersection']
 */
export function validateName(name, taken = [], commandNames = []) {
  const n = String(name ?? '').trim();
  if (!n) return txt('msgNameEmpty');
  if (n.length > MAX) return txt('msgNameLong', { max: MAX });
  if (/^[0-9]/.test(n)) return txt('msgNameNumber', { name: n });
  if (!NAME_RE.test(n)) return txt('msgNameChars');
  if (RESERVED.includes(n.toLowerCase())) return txt('msgNameReserved', { name: n, axis: n.toLowerCase() });
  if (commandNames.some(c => c.toLowerCase() === n.toLowerCase())) return txt('msgNameCommand', { name: n });
  if ([...taken].includes(n)) return txt('msgNameTaken', { name: n });
  return null;
}

/** The first free name prefix1, prefix2, … */
export function nextName(prefix, taken = []) {
  const used = new Set(taken);
  let i = 1;
  while (used.has(`${prefix}${i}`)) i++;
  return `${prefix}${i}`;
}
