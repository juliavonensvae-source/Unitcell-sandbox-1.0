/* 2D mode: vectors, directions and lines, and the 2D lattice rules. */
import { describe, it, expect } from 'vitest';
import { SceneModel, plainText } from '../src/objects/model.js';
import { getType, menuEntries } from '../src/objects/index.js';
import { model, run } from './helpers.js';
import { Lattice2D, lineIntercepts2D, cellAt2D } from '../src/math/lattice2d.js';
import { SYSTEMS_2D, BRAVAIS_2D } from '../src/data/bravais2d.js';
import { vectorModel, components2D } from '../src/objects/flat-objects.js';

const model2D = (latticeId = 'tp', params = null) => {
  const m = new SceneModel();
  m.state.dim = '2d';
  m.state.flat.latticeId = latticeId;
  m.state.flat.params = params || { ...BRAVAIS_2D.find(b => b.id === latticeId).params };
  m.recompute();
  return m;
};

describe('2D vectors', () => {
  it('(0, 0) → (1, 2) has components 1a + 2b', () => {
    expect(components2D([1, 2])).toBe('1a + 2b');
    expect(components2D([0.5, -1])).toBe('0.5a − 1b');
  });

  it('length √5 ≈ 2.236 in a square lattice with a = 1', () => {
    const m = model2D('tp', { a: 1, b: 1, gamma: 90 });
    const v = run(m, 'v1 = Vector((0, 0), (1, 2))');
    const vm = vectorModel(v, m.ctx);
    expect(vm.comps).toBe('1a + 2b');
    expect(vm.length).toBeCloseTo(Math.sqrt(5), 9);
    expect(vm.length).toBeCloseTo(2.236, 3);
  });

  it('length √3 ≈ 1.732 in a hexagonal 2D lattice with a = 1, γ = 120° (the metric, not Pythagoras)', () => {
    const m = model2D('hp', { a: 1, b: 1, gamma: 120 });
    const v = run(m, 'Vector((0, 0), (1, 2))');
    expect(vectorModel(v, m.ctx).length).toBeCloseTo(Math.sqrt(3), 9);
    expect(new Lattice2D({ a: 1, b: 1, gamma: 120 }).length([1, 2])).toBeCloseTo(1.732, 3);
  });

  it('a vector can be redefined and its ends typed as fractions', () => {
    const m = model2D();
    run(m, 'v1 = Vector((0, 0), (1, 2))');
    run(m, 'v1 = Vector((1/2, 0), (1, 1))');
    expect(m.byName('v1')).toMatchObject({ from: [0.5, 0], to: [1, 1] });
    expect(m.runCommand('Vector((0, 0), (1))').error).toMatch(/isn’t a point/);
  });

  it('Vector only works in 2D; 3D explains it', () => {
    expect(model().runCommand('Vector((0, 0), (1, 2))').error).toMatch(/works in the 2D view/);
  });
});

describe('2D directions and lines', () => {
  it('d1 = [1 2] in 2D is a 2D direction with the metric length', () => {
    const m = model2D('tp', { a: 1, b: 1, gamma: 90 });
    const d = run(m, 'd1 = [1 2]');
    expect(d.type).toBe('direction2d');
    expect(m.runCommand('d2 = [1 1 0]').error).toMatch(/two indices/);
  });

  it('square a = 1: line (1 2) cuts a at 1 and b at 0.5; line (1 0) is parallel to b', () => {
    expect(lineIntercepts2D([1, 2], 1)).toEqual({ a: 1, b: 0.5 });
    expect(lineIntercepts2D([1, 0], 1)).toEqual({ a: 1, b: null });
    const m = model2D('tp', { a: 1, b: 1, gamma: 90 });
    const l = run(m, 'l1 = (1 2)');
    expect(l.type).toBe('line2d');
    expect(plainText(getType('line2d').summary(l, m.ctx))).toMatch(/^cuts a, 0\.5b|^cuts a, ½b/);
    const l0 = run(m, 'l2 = (1 0)');
    expect(plainText(getType('line2d').summary(l0, m.ctx))).toMatch(/∞ – parallel to b/);
  });

  it('Family(l1) shows all parallel lines; the 2D objects stay in the 2D view', () => {
    const m = model2D();
    run(m, 'l1 = (1 1)');
    run(m, 'Family(l1)');
    expect(m.byName('l1').family).toBe(true);
    m.state.dim = '3d';
    m.recompute();
    expect(m.viewItems()).toEqual([]);
    expect(m.byName('l1')).toBeUndefined();
    run(m, 'p1 = (1 1 1)'); // names are per view
    m.state.dim = '2d';
    m.recompute();
    expect(m.viewItems().map(i => i.name)).toEqual(['l1']);
  });

  it('every 2D menu entry can be made with its command', () => {
    for (const e of menuEntries().filter(x => x.type && getType(x.type).dim === '2d')) {
      const m = model2D();
      run(m, e.command);
      expect(m.viewItems().some(i => i.type === e.type), e.key).toBe(true);
    }
  });
});

describe('2D lattice rules', () => {
  const free = { a: 2.7, b: 4.1, gamma: 101 };
  it('square and hexagonal keep a = b', () => {
    for (const s of ['square', 'hexagonal']) expect(SYSTEMS_2D[s].derive(free).b).toBe(SYSTEMS_2D[s].derive(free).a);
  });
  it('square, rectangular and centred rectangular keep γ = 90°; hexagonal keeps γ = 120°', () => {
    for (const s of ['square', 'rectangular']) expect(SYSTEMS_2D[s].derive(free).gamma).toBe(90);
    expect(BRAVAIS_2D.find(b => b.id === 'oc').system).toBe('rectangular');
    expect(SYSTEMS_2D.hexagonal.derive(free).gamma).toBe(120);
  });
  it('oblique keeps every value free, and only free values are editable', () => {
    expect(SYSTEMS_2D.oblique.derive(free)).toEqual(free);
    expect(SYSTEMS_2D.square.editable).toEqual(['a']);
    expect(SYSTEMS_2D.hexagonal.editable).toEqual(['a']);
    expect(SYSTEMS_2D.rectangular.editable).toEqual(['a', 'b']);
  });
});

describe('2D highlighted cell and origin', () => {
  const big = (cell, corner = [0, 0], id = 'tp') => {
    const m = model2D(id);
    Object.assign(m.state.flat, { n: 3, cell, corner });
    m.recompute();
    return m;
  };

  it('cell (2,3) with corner (1 0) puts the origin at (2, 2) and highlights the points of that cell only', () => {
    const fc = big([2, 3], [1, 0]).ctx.plane2d;
    expect(fc.cellOrigin).toEqual([1, 2]);
    expect(fc.origin).toEqual([2, 2]);
    const inside = fc.sites.filter(s => s.inOriginal).map(s => s.f.join());
    expect(inside.sort()).toEqual(['1,2', '1,3', '2,2', '2,3']);
    expect(big([2, 3], [0, 0], 'oc').ctx.plane2d.sites.filter(s => s.inOriginal)).toHaveLength(5); // + the centre
  });

  it('a smaller block keeps the cell inside it', () => {
    const m = big([3, 3]);
    m.state.flat.n = 2;
    m.recompute();
    expect(m.ctx.plane2d.cell).toEqual([2, 2]);
  });

  it('a click finds its cell from the fractional point, and nothing outside the block', () => {
    expect(cellAt2D([1.5, 2.2], 3)).toEqual([2, 3]);
    expect(cellAt2D([3, 0], 3)).toEqual([3, 1]);
    expect(cellAt2D([-0.1, 1], 3)).toBe(null);
    expect(cellAt2D([1, 3.2], 3)).toBe(null);
  });

  it('directions start at the origin; lines are drawn in the highlighted cell', () => {
    const m = big([2, 2], [1, 1]);
    const d = run(m, 'd1 = [1 2]');
    const arrow = getType('direction2d').primitives(d, m.ctx).find(p => p.kind === 'arrow');
    expect(arrow.from).toEqual([2, 2]);
    expect(arrow.to).toEqual([3, 4]);
    // (1 1) from the cell's (0 0) corner: through (2, 1) and (1, 2), the diagonal of cell (2,2)
    const l = run(m, 'l1 = (1 1)');
    const line = getType('line2d').primitives(l, m.ctx).find(p => p.kind === 'line');
    expect([line.from, line.to].map(p => p.join()).sort()).toEqual(['1,2', '2,1']);
    expect(plainText(getType('line2d').settings(l, m.ctx))).toMatch(/drawn from the corner \(0, 0\)/);
  });
});
