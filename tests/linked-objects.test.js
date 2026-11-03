/* Linked objects: spacing, intercepts and direction components,
   linked to planes and directions by id, with input-bar commands. */
import { describe, it, expect } from 'vitest';
import * as M from '../src/math/index.js';
import { getType } from '../src/objects/index.js';
import { getCommand, parseCommand } from '../src/objects/commands.js';
import { dependentsOf } from '../src/objects/registry.js';
import { interceptModel } from '../src/objects/intercepts.js';
import { componentModel } from '../src/objects/components.js';
import { spacingInfo } from '../src/objects/plane-info.js';
import { model, plain } from './helpers.js';

/** A SceneModel (Advanced on) for one lattice. addItem keeps `ctx` and updates `ctx.items`. */
function makeCtx(id = 'cF', params = null, { prism = false } = {}) {
  const ws = model(id, { params, prism });
  ws.state.advanced = true;
  const ctx = ws.recompute();
  const plane = (text, name) => ws.addItem('plane', { text, name });
  const dir = (text, name) => ws.addItem('direction', { text, name });
  return { ctx, ws, plane, dir };
}

describe('Linked objects', () => {
  it('link to their plane by id, hide it when added, and the delete warning knows about them', () => {
    const { ctx, ws, plane } = makeCtx('cF');
    const p1 = plane('1 1 1', 'p1');
    const res = getCommand('Spacing').run([p1], ws, null);
    expect(res.ok).toBeTruthy();
    const sp = ctx.items.find(i => i.type === 'spacing');
    expect(sp.src).toBe(p1.id);
    expect(p1.visible).toBe(false);
    expect(dependentsOf(p1.id, ctx.items)).toEqual([sp]);
  });

  it('follow renames and index changes of their plane', () => {
    const { ctx, ws, plane } = makeCtx('cF');
    const p1 = plane('1 1 1', 'p1');
    const sp = ws.addItem('spacing', { src: p1.id });
    p1.name = 'close';
    expect(ctx.labelText(ctx.items.find(i => i.id === p1.id))).toMatch(/^close/);
    p1.text = '1 0 0';
    p1.parsed = M.parsePlane('1 0 0', false);
    const dim = getType('spacing').primitives(sp, ctx).find(q => q.kind === 'dimension');
    expect(Math.hypot(...M.sub(dim.to, dim.from))).toBeCloseTo(ctx.params.a / 2, 9); // cubic F (100): the (200) planes
  });

  it('reject a direction with a plain-language message', () => {
    const { ws, dir } = makeCtx('cF');
    const res = getCommand('Spacing').run([dir('1 1 0', 'd1')], ws, null);
    expect(res.error).toMatch(/d1 is a direction\. Spacing needs a plane/);
  });
});

describe('Interplanar distance objects', () => {
  it('cubic P, a = 1: d(110) = 0.7071, every plane holds points', () => {
    const { ctx, plane } = makeCtx('cP', { a: 1, b: 1, c: 1, alpha: 90, beta: 90, gamma: 90 });
    const info = spacingInfo(plane('1 1 0', 'p1').parsed.hkl, ctx);
    expect(info.dFormula).toBeCloseTo(0.7071, 4);
    expect(info.same).toBe(true);
  });

  it('cubic F, a = 3.615 Å: d(111) = 2.087 Å', () => {
    const { ctx, plane } = makeCtx('cF', { a: 3.615, b: 3.615, c: 3.615, alpha: 90, beta: 90, gamma: 90 });
    expect(spacingInfo(plane('1 1 1', 'p1').parsed.hkl, ctx).dLattice).toBeCloseTo(2.087, 3);
  });

  it('cubic I (100): the dimension line measures a/2 and a second line shows d₁₀₀ = a', () => {
    const { ctx, ws, plane } = makeCtx('cI');
    const sp = ws.addItem('spacing', { src: plane('1 0 0', 'p1').id });
    const dims = getType('spacing').primitives(sp, ctx).filter(p => p.kind === 'dimension');
    const len = d => Math.hypot(...M.sub(d.to, d.from));
    expect(dims).toHaveLength(2);
    expect(len(dims[0])).toBeCloseTo(ctx.params.a / 2, 9);
    expect(len(dims[1])).toBeCloseTo(ctx.params.a, 9);
    expect(plain(dims[0].label)).toBe('d200 = 2.000 Å');
  });

  it('draws a dimension line in every one of the 14 lattices', () => {
    for (const id of ['cP', 'cI', 'cF', 'tP', 'tI', 'oP', 'oC', 'oI', 'oF', 'hP', 'hR', 'mP', 'mC', 'aP']) {
      const { ctx, ws, plane } = makeCtx(id);
      for (const t of ['1 0 0', '0 1 1', '1 1 1']) {
        const sp = ws.addItem('spacing', { src: plane(t).id });
        const dim = getType('spacing').primitives(sp, ctx).find(p => p.kind === 'dimension');
        const info = spacingInfo(M.parsePlane(t, false).hkl, ctx);
        expect(Math.hypot(...M.sub(dim.to, dim.from)), `${id} (${t})`).toBeCloseTo(info.dLattice, 9);
      }
    }
  });
});

describe('Intercept objects', () => {
  it('(1 −1 0) moves the origin to corner (0 1 0) and cuts a at 1 and b at −1', () => {
    const { ctx, ws, plane } = makeCtx('cP');
    const ic = ws.addItem('intercepts', { src: plane('1 -1 0', 'p1').id });
    const m = interceptModel(ic, ctx);
    expect(m.origin).toEqual([0, 1, 0]);
    expect(m.axes.map(a => a.t)).toEqual([1, -1, null]);
    expect(m.steps.cleared).toEqual([1, -1, 0]);
  });

  it('hexagonal prism uses four axes with (hkil)', () => {
    const { ctx, ws, plane } = makeCtx('hP', null, { prism: true });
    const ic = ws.addItem('intercepts', { src: plane('1 0 0', 'p1').id });
    const m = interceptModel(ic, ctx);
    expect(m.indices).toEqual([1, 0, -1, 0]);
    expect(m.axes.map(a => a.key)).toEqual(['a1', 'a2', 'a3', 'c']);
    expect(plain(getType('intercepts').summary(ic, ctx))).toBe('a1, ∞, −a3, ∞');
  });
});

describe('Direction component objects', () => {
  it('[1 1 −2] walks a → b → −2c', () => {
    const { ctx, ws, dir } = makeCtx('cP');
    const res = getCommand('Components').run([dir('1 1 -2', 'd1')], ws, 'walk');
    expect(res.ok).toBeTruthy();
    const it = ctx.items.find(i => i.name === 'walk');
    expect(plain(getType('components').summary(it, ctx))).toBe('a → b → −2c → (1, 1, −2)');
    expect(dir).toBeTruthy();
  });

  it('on hexagonal axes can walk along a1, a2, a3, c', () => {
    const { ctx, ws, dir } = makeCtx('hP');
    const it = ws.addItem('components', { src: dir('1 0 0', 'd1').id });
    it.four = true;
    const m = componentModel(it, ctx);
    expect(m.comps).toEqual([2, -1, -1, 0]);
    expect(m.end).toEqual([3, 0, 0]);
    expect(m.scale).toBe(3);
  });
});

describe('Input bar: indices typed as arguments', () => {
  it('reads Spacing((1 1 1)) and Angle([1 1 0], p1)', () => {
    expect(parseCommand('Spacing((1 1 1))')).toMatchObject({ kind: 'call', fn: 'Spacing', args: ['(1 1 1)'] });
    expect(parseCommand('s = Spacing(p1)')).toMatchObject({ name: 's', kind: 'call', fn: 'Spacing', args: ['p1'] });
    expect(parseCommand('Angle([1 1 0], p1)')).toMatchObject({ kind: 'call', fn: 'Angle', args: ['[1 1 0]', 'p1'] });
  });

  it('registers the Part 2 commands', () => {
    for (const n of ['Spacing', 'Intercepts', 'Components']) expect(getCommand(n), n).toBeTruthy();
  });
});
