/* Close-packed stacking: ABAB… (HCP) and ABCABC… (FCC). */
import { describe, it, expect } from 'vitest';
import * as M from '../src/math/index.js';
import { SceneModel } from '../src/objects/model.js';
import { getType, CATEGORIES, menuEntries } from '../src/objects/index.js';
import { stackingInfo } from '../src/objects/stacking.js';
import { SPHERE_R } from '../src/data/stacking.js';
import { getTopic } from '../src/help/index.js';
import { finitePrims, plain } from './helpers.js';

const T = () => getType('stacking');
const labels = prims => prims.filter(p => p.kind === 'label').map(p => p.html);

describe('Close-packed stacking: maths', () => {
  it('ABAB: A at (0,0,0), B at (⅔,⅓,½); ideal c/a = √(8/3)', () => {
    expect(M.stackingBasis('AB')).toEqual([{ el: 'A', f: [0, 0, 0] }, { el: 'B', f: [2 / 3, 1 / 3, 0.5] }]);
    expect(M.IDEAL_CA.AB).toBeCloseTo(Math.sqrt(8 / 3), 12);
    expect(M.IDEAL_CA.ABC).toBeCloseTo(Math.sqrt(6), 12);
  });
  it('ABC on hexagonal axes is the R-centred cell: the same atoms as cubic F', () => {
    const F = M.stackingFacts(M.stackingParams('ABC', 'hex', 1), M.stackingBasis('ABC'), 'hex');
    const C = M.stackingFacts(M.stackingParams('ABC', 'cubic', 1), M.expandBasis([{ el: 'X', f: [0, 0, 0] }], [[0, 0, 0], [0, 0.5, 0.5], [0.5, 0, 0.5], [0.5, 0.5, 0]]), 'cubic');
    for (const k of ['r', 'cn', 'inLayer', 'above', 'below', 'spacing', 'packing']) expect(F[k], k).toBeCloseTo(C[k], 9);
    expect(F.r).toBeCloseTo(1, 9);
  });
  it('a stretched c breaks the contact between layers: only the 6 in the layer stay nearest', () => {
    const p = { ...M.stackingParams('AB', 'hex', 1), c: 4 };
    const F = M.stackingFacts(p, M.stackingBasis('AB'), 'hex');
    expect([F.cn, F.inLayer, F.above]).toEqual([6, 6, 0]);
    expect(F.packing).toBeLessThan(0.74);
  });
  it('layer letters: by height on hexagonal axes, by x + y + z in the cube', () => {
    expect(M.layerOf([0.33, 0.67, 0.5], 'hex', 'AB').letter).toBe('B');
    expect(M.layerOf([0, 0, 1], 'hex', 'AB').letter).toBe('A');
    expect(M.layerOf([0, 0, 2 / 3], 'hex', 'ABC').letter).toBe('C');
    expect(M.layerOf([-0.5, 0, 0.5], 'cubic', 'ABC').letter).toBe('A');
    expect(M.layerOf([1, 1, 0], 'cubic', 'ABC', [1, 0, 0]).letter).toBe('B');
  });
});

describe('Close-packed stacking: the object', () => {
  it('Stacking(ABAB) switches to the hexagonal prism with ideal c/a and counts 3 + 3 atoms', () => {
    const m = new SceneModel();
    const res = m.runCommand('Stacking(ABAB)');
    expect(res.error).toBeUndefined();
    const item = res.item, info = stackingInfo(item, m.ctx);
    expect(m.state.latticeId).toBe('hP');
    expect(m.isPrism()).toBe(true);
    expect(m.state.params.a).toBeCloseTo(2 * SPHERE_R, 9);
    expect(m.state.params.c / m.state.params.a).toBeCloseTo(M.IDEAL_CA.AB, 9);
    expect(info.fits).toBe(true);
    expect(info.layers.map(l => l.count.total)).toEqual([3, 3]);
    expect(info.total.total).toBeCloseTo(6, 9);
    expect(T().hidesLatticePoints(item, m.ctx)).toBe(true);
    expect(plain(T().summary(item, m.ctx))).toBe('CN 12 · APF 0.740 · 6 atoms per cell');
    expect(T().definition(item, m.ctx)).toBe('stk1 = Stacking(ABAB)');
    expect(T().readout(item, m.ctx).rows.join(' | ')).toMatch(/Layer A: 12 × ⅙ \+ 2 × ½ = 3 \| Layer B: 3 inside = 3/);
    expect(T().legend(item, m.ctx).rows).toHaveLength(2);
    const prims = T().primitives(item, m.ctx);
    expect(finitePrims(prims)).toBe(true);
    expect(labels(prims).sort().join('')).toBe('AAAAAAAAAAAAAABBB'); // 7 below + 7 on top, 3 in the middle
    expect(T().settings(item, m.ctx)).toContain('6 in the layer + 3 above + 3 below');
  });

  it('Stacking(ABC) on hexagonal axes: A, B, C, A layers; Stacking(FCC) in the cube', () => {
    const m = new SceneModel();
    const hex = m.runCommand('Stacking(ABC)').item;
    expect(m.state.params.c / m.state.params.a).toBeCloseTo(M.IDEAL_CA.ABC, 9);
    expect(stackingInfo(hex, m.ctx).total.total).toBeCloseTo(9, 9);
    expect(labels(T().primitives(hex, m.ctx)).sort().join('')).toBe('AAAAAAAAAAAAAABBBCCC');

    const cube = m.runCommand('Stacking(FCC)').item;
    expect(m.state.latticeId).toBe('cF');
    expect(m.state.params.a).toBeCloseTo(2 * Math.SQRT2 * SPHERE_R, 9);
    const info = stackingInfo(cube, m.ctx);
    expect(info.total.total).toBeCloseTo(4, 9);
    expect(info.layers.map(l => l.letter)).toEqual(['A', 'B', 'C']);
    expect(info.cn).toBe(12);
    expect(info.spacing).toBeCloseTo(m.state.params.a / Math.sqrt(3), 9);
    // the corners (0,0,0) and (1,1,1) are A, the rest of the cube B and C
    expect(labels(T().primitives(cube, m.ctx)).sort().join('')).toBe('AABBBBBBCCCCCC');
    // the hexagonal one is not drawn on cubic F, and says so
    expect(stackingInfo(hex, m.ctx).fits).toBe(false);
    expect(T().primitives(hex, m.ctx)).toEqual([]);
    expect(T().summary(hex, m.ctx)).toMatch(/Hexagonal P only/i);
  });

  it('ABAB and ABC on hexagonal P are told apart by c/a', () => {
    const m = new SceneModel();
    const ab = m.runCommand('Stacking(ABAB)').item;
    const abc = m.runCommand('Stacking(ABC)').item;
    expect(stackingInfo(abc, m.ctx).fits).toBe(true);
    expect(stackingInfo(ab, m.ctx).fits).toBe(false);
    expect(T().settings(ab, m.ctx)).toMatch(/c\/a near 1\.633/);
  });

  it('the layer planes, the view switch and the ideal c/a button', () => {
    const m = new SceneModel();
    const item = m.runCommand('Stacking(ABC)').item;
    T().onField(item, 'planes', true, m.ctx, { redraw: () => {} }, 'change');
    m.recompute();
    expect(T().primitives(item, m.ctx).filter(p => p.kind === 'polygon')).toHaveLength(4); // A, B, C, A
    T().onField(item, 'view', 'cubic', m.ctx, m, 'change');
    expect(m.state.latticeId).toBe('cF');
    expect(T().primitives(item, m.ctx).filter(p => p.kind === 'polygon')).toHaveLength(2); // the corners only touch the cell
    T().onField(item, 'view', 'hex', m.ctx, m, 'change');
    m.applyLattice('hP', { a: m.state.params.a, c: m.state.params.a * 2.6 });
    expect(T().settings(item, m.ctx)).toContain('data-act="ideal"');
    T().onAction(item, 'ideal', null, m.ctx, m);
    expect(m.state.params.c / m.state.params.a).toBeCloseTo(M.IDEAL_CA.ABC, 9);
  });

  it('redefining and unknown names', () => {
    const m = new SceneModel();
    m.runCommand('Stacking(HCP)');
    expect(m.runCommand('stk1 = Stacking(FCC)').error).toBeUndefined();
    expect(m.state.latticeId).toBe('cF');
    expect(m.runCommand('Stacking(ABBA)').error).toMatch(/know the stacking/);
  });

  it('the + Add menu has a "Close packing" group with a "?" topic', () => {
    expect(CATEGORIES.some(c => c.id === 'stacking' && c.title === 'Close packing')).toBe(true);
    const entries = menuEntries().filter(e => e.category === 'stacking');
    expect(entries.map(e => e.command)).toEqual(['Stacking(ABAB)', 'Stacking(ABC)', 'Stacking(FCC)']);
    const t = getTopic('stacking');
    expect(t.more.steps.length).toBeGreaterThan(4);
    expect(t.more.example(null).steps).toHaveLength(3);
  });
});
