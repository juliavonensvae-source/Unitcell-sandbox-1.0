/* The interface text in text/: every file reads cleanly (src/text.js throws in tests on a bad
   line or a name used twice), every name the code asks for exists, and every entry is used. */
import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { TEXT, txt } from '../src/text.js';

const sources = [];
const walk = d => { for (const f of fs.readdirSync(d)) { const p = path.join(d, f); if (fs.statSync(p).isDirectory()) walk(p); else if (p.endsWith('.js')) sources.push(fs.readFileSync(p, 'utf8')); } };
walk('src');
const code = sources.join('\n').replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|\s)\/\/.*$/gm, '$1');

/** The names inside every txt( … ) call: the first argument, which may pick between names with ? : */
function namesUsed() {
  const names = new Set();
  for (const m of code.matchAll(/\btxt\(/g)) {
    let i = m.index + 4, depth = 0, arg = '';
    for (; i < code.length; i++) {
      const ch = code[i];
      if ('([{'.includes(ch)) depth++;
      else if (')]}'.includes(ch)) { if (depth === 0) break; depth--; } else if (ch === ',' && depth === 0) break;
      arg += ch;
    }
    for (const n of arg.matchAll(/(?:^\s*|[?:(]\s*)'([a-z][A-Za-z0-9]*)'/g)) names.add(n[1]);
  }
  return names;
}

describe('Interface text (text/)', () => {
  it('has entries', () => {
    expect(TEXT.size).toBeGreaterThan(1000);
  });

  it('every name the code asks for exists', () => {
    const missing = [...namesUsed()].filter(n => !TEXT.has(n));
    expect(missing).toEqual([]);
  });

  it('every entry is used by the code', () => {
    const unused = [...TEXT.keys()].filter(n => !code.includes(`'${n}'`));
    expect(unused).toEqual([]);
  });

  it('no entry is empty, except the start page boxes and footer (filled in by hand, or left out)', () => {
    const mayBeEmpty = ['startInfoText', 'startNewsText', 'startFootSystems', 'startFootLattices', 'startFootObjects'];
    expect([...TEXT].filter(([k, v]) => !v && !mayBeEmpty.includes(k)).map(([k]) => k)).toEqual([]);
  });

  it('fills placeholders and leaves other braces alone', () => {
    expect(txt('msgRenamed', { old: 'p1', next: 'p2' })).toBe('Renamed <b>p1</b> to <b>p2</b>');
    expect(txt('planeEquivalent')).toContain('{hkl}');
    expect(() => txt('noSuchText')).toThrow();
    expect(() => txt('msgRenamed', { old: 'p1', next: 'p2', extra: 1 })).toThrow();
  });
});
