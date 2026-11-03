import { describe, it, expect } from 'vitest';
import * as M from '../src/math/index.js';
import { getType } from '../src/objects/index.js';
import { validateName, nextName } from '../src/objects/names.js';
import { parseCommand, wordAt } from '../src/objects/commands.js';
import { itemLabelHTML, dependentsOf } from '../src/objects/registry.js';

describe('Names', () => {
  it('accepts letters, numbers and _ that do not start with a number', () => {
    for (const ok of ['d1', 'myDir', 'p_10', '_x', 'Plane2']) expect(validateName(ok, [])).toBeNull();
  });

  it('rejects duplicate names', () => {
    expect(validateName('d1', ['d1', 'p1'])).toMatch(/already used/);
  });

  it('rejects the reserved axis names a, b, c, a1, a2, a3 (any case)', () => {
    for (const r of ['a', 'b', 'c', 'a1', 'a2', 'a3', 'A', 'A3']) expect(validateName(r, [])).toMatch(/reserved/);
  });

  it('explains other broken rules in plain language', () => {
    expect(validateName('1d', [])).toMatch(/can't start with a number/);
    expect(validateName('my dir', [])).toMatch(/letters, numbers and _/);
    expect(validateName('d-1', [])).toMatch(/letters, numbers and _/);
    expect(validateName('', [])).toMatch(/Give it a name/);
    expect(validateName('angle', [], ['Angle'])).toMatch(/command/);
  });

  it('hands out the first free default name', () => {
    expect(nextName('d', [])).toBe('d1');
    expect(nextName('d', ['d1', 'd2', 'p1'])).toBe('d3');
    expect(nextName('p', ['p2'])).toBe('p1');
  });
});

describe('Input bar parsing', () => {
  it('reads directions, planes and commands, with or without a name', () => {
    expect(parseCommand('d1 = [1 1 0]')).toMatchObject({ name: 'd1', kind: 'direction', text: '1 1 0' });
    expect(parseCommand('(1 1 1)')).toMatchObject({ name: null, kind: 'plane', text: '1 1 1' });
    expect(parseCommand('p2 = (1 0 -1 0)')).toMatchObject({ name: 'p2', kind: 'plane', text: '1 0 -1 0' });
    expect(parseCommand('Angle(d1, p1)')).toMatchObject({ kind: 'call', fn: 'Angle', args: ['d1', 'p1'] });
    expect(parseCommand('x = Intersection(p1,p2)')).toMatchObject({ name: 'x', kind: 'call', fn: 'Intersection', args: ['p1', 'p2'] });
  });

  it('explains what went wrong', () => {
    expect(parseCommand('').error).toMatch(/Type something/);
    expect(parseCommand('= [1 1 0]').error).toMatch(/name before/);
    expect(parseCommand('d1 =').error).toMatch(/What should d1 be/);
    expect(parseCommand('d1 = [1 1 0').error).toMatch(/bracket is missing/);
    expect(parseCommand('hello world').error).toMatch(/couldn’t read/);
  });

  it('finds the word being typed for suggestions', () => {
    expect(wordAt('Angle(d', 7)).toEqual({ word: 'd', start: 6 });
    expect(wordAt('An', 2)).toEqual({ word: 'An', start: 0 });
  });
});

describe('Calculations follow renamed objects', () => {
  const lattice = new M.Lattice({ a: 4, b: 4, c: 4, alpha: 90, beta: 90, gamma: 90 });
  const items = [];
  const ctx = { lattice, hexAxes: false, advanced: false, items, itemById: id => items.find(i => i.id === id) };
  ctx.label = it => itemLabelHTML(it, ctx);
  const dir = (id, name, text) => ({ id, type: 'direction', name, ...getType('direction').create({ text }, ctx) });
  const d1 = dir(1, 'd1', '1 0 0'), d2 = dir(2, 'd2', '1 1 1');
  const ang = { id: 3, type: 'calc-angle', name: 'ang1', mode: 'dd', a: 1, b: 2 };
  items.push(d1, d2, ang);

  it('labels show the name together with the indices', () => {
    expect(itemLabelHTML(d1, ctx)).toMatch(/<span class="nm">d1<\/span> .*\[100\]/);
  });

  it('renaming d1 updates the angle that uses it', () => {
    const before = getType('calc-angle').summary(ang, ctx);
    expect(before).toContain('>d1<');
    d1.name = 'u';
    const after = getType('calc-angle').summary(ang, ctx);
    expect(after).toContain('>u<');
    expect(after).not.toContain('>d1<');
  });

  it('knows which calculations use an object (for delete warnings)', () => {
    expect(dependentsOf(1, items).map(i => i.name)).toEqual(['ang1']);
    expect(dependentsOf(3, items)).toEqual([]);
  });
});
