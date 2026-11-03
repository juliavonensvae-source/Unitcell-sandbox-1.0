/* =====================================================================
   Interface text. Every word the user sees lives in text/**.txt (see
   text/README.md), one "name: text" per line; this module reads them all
   and txt(name, values) returns one entry with its {placeholders} filled in.
   Mistakes in the text files fail the tests and show as console errors.
   ===================================================================== */
const FILES = import.meta.glob('/text/**/*.txt', { query: '?raw', import: 'default', eager: true });
const STRICT = import.meta.env.MODE === 'test';

function problem(msg) {
  if (STRICT) throw new Error(`Text: ${msg}`);
  console.error(`Text: ${msg}`);
}

/** name → text, from every file. Headings (#), markers ([…]) and blank lines are skipped. */
export const TEXT = new Map();
for (const [file, src] of Object.entries(FILES)) {
  src.replace(/^﻿/, '').split(/\r?\n/).forEach((line, i) => {
    const s = line.trim();
    if (!s || s.startsWith('#') || s.startsWith('[')) return;
    const m = /^([A-Za-z][A-Za-z0-9]*):(.*)$/.exec(s);
    if (!m) problem(`${file} line ${i + 1} is not "name: text"`);
    else if (TEXT.has(m[1])) problem(`${file} line ${i + 1}: the name ${m[1]} is used twice`);
    else TEXT.set(m[1], m[2].trim());
  });
}

/** The text named `name`; values fill its placeholders, e.g. txt('volumeNow', { volume: '43.2' }) for "V = {volume}". */
export function txt(name, values) {
  const text = TEXT.get(name);
  if (text === undefined) { problem(`there is no text named ${name}`); return name; }
  if (!values) return text;
  for (const k of Object.keys(values)) if (!text.includes(`{${k}}`)) problem(`the text ${name} has lost its {${k}}`);
  return text.replace(/\{([A-Za-z][A-Za-z0-9]*)\}/g, (m, k) => (Object.hasOwn(values, k) ? String(values[k]) : m));
}
