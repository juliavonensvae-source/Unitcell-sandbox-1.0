import { describe, it, expect } from 'vitest';
import * as M from '../src/math/index.js';
import { getType } from '../src/objects/index.js';
import { model, run, plain } from './helpers.js';

describe('Index parsing (kept from stage 1)', () => {
  it('accepts spaced, compact and bracketed input', () => {
    expect(M.parseDirection('1 1 0', false).uvw).toEqual([1, 1, 0]);
    expect(M.parseDirection('1-10', false).uvw).toEqual([1, -1, 0]);
    expect(M.parseDirection('[-1 2 0]', false).uvw).toEqual([-1, 2, 0]);
    expect(M.parsePlane('(111)', false).hkl).toEqual([1, 1, 1]);
  });

  it('rejects bad input with a helpful message', () => {
    expect(M.parseDirection('', false).error).toMatch(/Type some indices/);
    expect(M.parseDirection('0 0 0', false).error).toMatch(/non-zero/);
    expect(M.parseDirection('1.5 0 0', false).error).toMatch(/whole numbers/);
    expect(M.parseDirection('1 0', false).error).toMatch(/three indices/);
  });

  it('only allows four indices on hexagonal axes', () => {
    expect(M.parseDirection('2 -1 -1 0', false).error).toMatch(/hexagonal/);
    // [2 -1 -1 0] = 3a1, reduced to the smallest whole numbers: [100]
    expect(M.parseDirection('2 -1 -1 0', true).uvw).toEqual([1, 0, 0]);
    expect(M.parseDirection('1 1 -2 0', true).uvw).toEqual([1, 1, 0]);
    expect(M.parsePlane('1 0 -1 0', true).hkl).toEqual([1, 0, 0]);
  });

  it('keeps four-index typing for Advanced mode, with a friendly message', () => {
    expect(M.parsePlane('1 0 -1 0', true, { allowFour: false }).error).toMatch(/Advanced mode/);
    expect(M.parseDirection('2 -1 -1 0', true, { allowFour: false }).error).toMatch(/Advanced mode/);
  });

  it('explains the i and t rules when they are broken', () => {
    expect(M.parsePlane('1 0 1 0', true).error).toMatch(/i should be −1: try \(1 0 −1 0\)/);
    expect(M.parseDirection('2 -1 1 0', true).error).toMatch(/t should be −1: try \[2 −1 −1 0\]/);
  });

  it('accepts the Unicode minus sign', () => {
    expect(M.parseDirection('1 −1 0', false).uvw).toEqual([1, -1, 0]);
  });
});

describe('Plane clipping (kept from stage 1)', () => {
  it('cuts (111) through a unit cube as a triangle', () => {
    const poly = M.planePolygonIn([1, 1, 1], 1, M.boxRegion([1, 1, 1]));
    expect(poly).toHaveLength(3);
  });

  it('finds every parallel plane of a family inside a 2×2×2 block', () => {
    expect(M.familyLevelsIn([1, 0, 0], M.boxRegion([2, 2, 2]))).toEqual([0, 1, 2]);
  });
});

describe('Equivalent planes {hkl}', () => {
  const fam = (id, hkl, setting) => {
    const c = model(id, { setting }).ctx;
    return M.equivalentPlanes(c.lattice, hkl, c.basis, c.hexAxes);
  };
  const count = (id, hkl, setting) => fam(id, hkl, setting).length;

  it('cubic: {100} = 3, {110} = 6, {111} = 4, {123} = 24 sets, the plane itself first; centring changes nothing', () => {
    expect(fam('cP', [1, 0, 0])).toEqual([[1, 0, 0], [0, 1, 0], [0, 0, 1]]);
    expect(fam('cP', [1, 1, 1])[0]).toEqual([1, 1, 1]);
    for (const id of ['cP', 'cI', 'cF']) {
      expect([[1, 0, 0], [1, 1, 0], [1, 1, 1], [1, 2, 3]].map(h => count(id, h)), id).toEqual([3, 6, 4, 24]);
    }
  });

  it('lower symmetry: tetragonal, orthorhombic, monoclinic, triclinic', () => {
    expect([[1, 0, 0], [0, 0, 1], [1, 0, 1]].map(h => count('tP', h))).toEqual([2, 1, 4]);
    expect([[1, 0, 0], [1, 1, 1]].map(h => count('oP', h))).toEqual([1, 4]);
    expect([[1, 0, 1], [1, 1, 1]].map(h => count('mP', h))).toEqual([1, 2]); // 2/m, b unique
    expect(count('aP', [1, 2, 3])).toBe(1);
  });

  it('hexagonal: {101̄0} = 3, {101̄1} = 6, (0001) alone', () => {
    expect([[1, 0, 0], [1, 0, 1], [0, 0, 1]].map(h => count('hP', h))).toEqual([3, 6, 1]);
  });

  it('rhombohedral: the same family on rhombohedral and hexagonal axes (only the obverse planes)', () => {
    expect(count('hR', [1, 0, 0], 'rhombohedral')).toBe(3);
    expect(count('hR', [1, 2, 3], 'rhombohedral')).toBe(6);
    // (hkl)rh → (h−k, k−l, h+k+l) on hexagonal axes
    const hex = ([h, k, l]) => [h - k, k - l, h + k + l];
    expect(count('hR', hex([1, 0, 0]), 'hexagonal')).toBe(3);
    expect(count('hR', hex([1, 2, 3]), 'hexagonal')).toBe(6);
    expect(fam('hR', [1, 0, 1], 'hexagonal').every(([h, k, l]) => (-h + k + l) % 3 === 0)).toBe(true);
  });

  it('the plane card lists the family and the view draws one plane per member', () => {
    const m = model('cP');
    const p = run(m, 'p1 = (1 1 0)');
    p.equivalent = true;
    expect(plain(getType('plane').settings(p, m.ctx))).toMatch(/6 plane sets in \{110\}/);
    expect(getType('plane').primitives(p, m.ctx).filter(q => q.kind === 'polygon')).toHaveLength(6);
  });
});
