/* Part 4: interstitial sites and the atom-fit tool. Runs the real SceneModel
   (the workspace without its DOM), the math and the help topics. */
import { describe, it, expect } from 'vitest';
import * as M from '../src/math/index.js';
import { SceneModel } from '../src/objects/model.js';
import { getType, menuEntries } from '../src/objects/index.js';
import { findBravais } from '../src/data/bravais.js';
import { readPositive, stepValue } from '../src/ui/number-field.js';
import { fitOf, parseFit } from '../src/objects/atom-fit.js';
import { posText } from '../src/ui/format.js';
import { getTopic } from '../src/help/index.js';
import { checkTex } from '../src/help/tex.js';
import { model as baseModel, run, finitePrims, sum } from './helpers.js';

const model = (id = 'cF') => baseModel(id);

describe('Interstitial sites object', () => {
  it('cubic F: 4 octahedral + 8 tetrahedral per cell', () => {
    const m = model('cF');
    const s = run(m, 'Sites()');
    expect(s.type).toBe('interstitials');
    expect(s.name).toBe('sites1');
    expect(sum(m, s)).toBe('4 octahedral + 8 tetrahedral per cell');
  });

  it('cubic I: 6 octahedral + 12 tetrahedral; cubic P: 1 cubic site', () => {
    const mi = model('cI');
    expect(sum(mi, run(mi, 'Sites()'))).toBe('6 octahedral + 12 tetrahedral per cell');
    const mp = model('cP');
    expect(sum(mp, run(mp, 'Sites()'))).toBe('1 cubic site per cell');
  });

  it('the card shows the counting and the critical ratios', () => {
    const m = model('cF');
    const html = getType('interstitials').settings(run(m, 'Sites()'), m.ctx);
    expect(html).toContain('12 × ¼ + 1 × 1 = 4');
    expect(html).toContain('0.414');
    expect(html).toContain('0.225');
    expect(html).toContain('data-help="site-cF-oct"');
    expect(html).toContain('data-help="site-count"');
  });

  it('positions drawn in one cell: cubic F 13 oct + 8 tet, cubic I 18 oct + 24 tet', () => {
    const n = (id, kind) => {
      const m = model(id);
      return M.siteImages(M.sceneSites(m.ctx).find(s => s.kind === kind).sBasis, m.ctx.unitRegion).length;
    };
    expect([n('cF', 'oct'), n('cF', 'tet'), n('cI', 'oct'), n('cI', 'tet'), n('cP', 'cub')]).toEqual([13, 8, 18, 24, 1]);
  });

  it('other lattices: "not available yet", in the menu, the input bar and on existing objects', () => {
    const m = model('tP');
    expect(m.runCommand('Sites()').error).toMatch(/Not available yet for Tetragonal P/);
    expect(m.runCommand('Fit(0.5)').error).toMatch(/Not available yet/);
    for (const key of ['interstitial-sites', 'atom-fit']) {
      const e = menuEntries().find(x => x.key === key);
      expect(e.unavailable(m.ctx), key).toMatch(/Not available yet/);
      expect(e.unavailable(model('cI').ctx), key).toBeNull();
    }
    // an object made in cubic F, then the lattice changes
    const c = model('cF');
    const s = run(c, 'Sites()');
    c.state.latticeId = 'hP';
    c.recompute();
    expect(sum(c, s)).toMatch(/Not available yet for Hexagonal P/);
    expect(getType('interstitials').primitives(s, c.ctx)).toEqual([]);
    expect(getType('interstitials').settings(s, c.ctx)).toContain('data-act="lat-cF"');
  });

  it('draws finite primitives in every mode: markers, filled holes (cut), polyhedra, every cell, share labels', () => {
    for (const id of ['cP', 'cI', 'cF']) {
      const m = model(id);
      m.state.repeats = [2, 2, 2];
      m.state.cut = true;
      m.recompute();
      const s = run(m, 'Sites()');
      for (const size of ['marker', 'fit']) for (const poly of ['off', 'one', 'all']) for (const all of [false, true]) {
        Object.assign(s, { size, poly, all, shares: true });
        const prims = getType('interstitials').primitives(s, m.ctx);
        expect(prims.length, `${id} ${size} ${poly} ${all}`).toBeGreaterThan(0);
        expect(finitePrims(prims)).toBe(true);
      }
    }
  });

  it('each kind can be switched off', () => {
    const m = model('cF');
    const s = run(m, 'Sites()');
    const spheres = () => getType('interstitials').primitives(s, m.ctx).filter(p => p.kind === 'spheres').length;
    s.poly = 'off';
    const both = spheres();
    s.show.tet = false;
    expect(spheres()).toBe(both - 1);
  });

  it('the selected site follows the lattice: switching cubic F → cubic P selects the cubic site', () => {
    const m = model('cF');
    const s = run(m, 'Sites()');
    s.sel = { kind: 'tet', f: [0.75, 0.25, 0.25] };
    m.state.latticeId = 'cP';
    m.recompute();
    expect(s.sel).toEqual({ kind: 'cub', f: [0.5, 0.5, 0.5] });
  });

  it('clicking: a ray through the body centre picks the octahedral site there', () => {
    const m = model('cF');
    const s = run(m, 'Sites()');
    s.show.tet = false;
    const L = m.ctx.lattice, centre = L.toCartesian([0.5, 0.5, 0.5]);
    // straight down c, through (½, ½, z): hits the face centre (½, ½, 1)… which is a lattice point, not a site, then the body centre
    const hit = getType('interstitials').pick(s, m.ctx, { origin: M.add(centre, [0, 0, 20]), dir: [0, 0, -1] });
    expect(hit.data.kind).toBe('oct');
    expect(hit.data.f).toEqual([0.5, 0.5, 0.5]);
  });

  it('polyhedra: octahedron 8 triangles, tetrahedron 4, cube 6 squares', () => {
    const faces = (id, f, n) => {
      const m = model(id), L = m.ctx.lattice;
      return M.polyhedronFaces(M.hostsAround(L, m.ctx.basis, f, { n }).map(h => L.toCartesian(h.f))).map(x => x.length).join('');
    };
    expect(faces('cF', [0.5, 0.5, 0.5], 6)).toBe('33333333');
    expect(faces('cF', [0.25, 0.25, 0.25], 4)).toBe('3333');
    expect(faces('cP', [0.5, 0.5, 0.5], 8)).toBe('444444');
    expect(faces('cI', [0.5, 0, 0], 6)).toBe('33333333'); // squashed, but still 8 triangles
  });

  it('positions read as fractions', () => {
    expect(posText([0.5, 0.25, 0])).toBe('(½, ¼, 0)');
    expect(posText([0.75, 1, -0.5])).toBe('(¾, 1, −½)');
  });
});

describe('Atom fit', () => {
  it('a new atom fits (green) and hides the other lattice points', () => {
    const m = model('cF');
    const f = run(m, 'Fit()');
    expect(f.type).toBe('atom-fit');
    expect(fitOf(f, m.ctx).fit.fits).toBe(true);
    expect(getType('atom-fit').hidesLatticePoints(f, m.ctx)).toBe(true);
    expect(sum(m, f)).toMatch(/✓ fits/);
  });

  it('Fit(oct, max) just fits; 10% bigger does not, and the 6 neighbours must move', () => {
    const m = model('cF');
    const f = run(m, 'Fit(oct, max)');
    expect(f.r).toBeCloseTo(4 / 2 - Math.SQRT2, 10);
    expect(fitOf(f, m.ctx).fit.fits).toBe(true);
    f.r *= 1.1;
    const { fit } = fitOf(f, m.ctx);
    expect(fit.fits).toBe(false);
    expect(fit.shells[0]).toMatchObject({ count: 6 });
    expect(fit.shells[0].move).toBeCloseTo(0.1 * (2 - Math.SQRT2), 10);
    expect(sum(m, f)).toMatch(/✗ too big/);
    const live = getType('atom-fit').live(f, m.ctx).replace(/<[^>]+>/g, '');
    expect(live).toMatch(/The 6 neighbours at 2\.000 Å must each move 0\.059 Å outward/);
  });

  it('r/R next to the critical ratio: Fit(tet, 0.2R) in cubic F', () => {
    const m = model('cF');
    const f = run(m, 'Fit(tet, 0.2R)');
    const { fit } = fitOf(f, m.ctx);
    expect(fit.ratio).toBeCloseTo(0.2, 10);
    expect(fit.critical).toBeCloseTo(0.2247, 4);
    expect(getType('atom-fit').live(f, m.ctx)).toContain('critical <b>0.225</b>');
  });

  it('cubic I octahedral: a slightly big atom moves only the 2 nearest neighbours', () => {
    const m = model('cI');
    const f = run(m, 'Fit(oct, 0.3)');
    const { fit } = fitOf(f, m.ctx);
    expect(fit.fits).toBe(false);
    expect(fit.shells.map(s => s.count)).toEqual([2, 4]);
    expect(fit.shells[1].move).toBe(0);
    const live = getType('atom-fit').live(f, m.ctx).replace(/<[^>]+>/g, '');
    expect(live).toMatch(/The 4 at 2\.828 Å still have room/);
  });

  it('primitives: overlap rings and arrows only when too big; finite everywhere', () => {
    for (const id of ['cP', 'cI', 'cF']) {
      const m = model(id);
      const f = run(m, 'Fit(max)');
      const prims = getType('atom-fit').primitives(f, m.ctx);
      expect(prims.filter(p => p.kind === 'arrow').length).toBe(0);
      f.r = 1.3 * fitOf(f, m.ctx).fit.rMax;
      const big = getType('atom-fit').primitives(f, m.ctx);
      expect(big.filter(p => p.kind === 'arrow').length, id).toBeGreaterThan(0);
      expect(finitePrims(big)).toBe(true);
      f.moved = false;
      expect(getType('atom-fit').primitives(f, m.ctx).filter(p => p.kind === 'arrow').length).toBe(0);
    }
  });

  it('the atom sits in the highlighted cell, and can be moved to another site by clicking', () => {
    const m = model('cF');
    m.state.repeats = [5, 5, 5];
    m.state.cell = [3, 3, 3];
    m.recompute();
    const f = run(m, 'Fit(tet, 0.3)');
    expect(fitOf(f, m.ctx).fAbs).toEqual([2.25, 2.25, 2.25]);
    // looking straight down c, the upper of the two sites in that column is hit first
    const L = m.ctx.lattice, target = L.toCartesian([2.75, 2.25, 2.25]);
    const hit = getType('atom-fit').pick(f, m.ctx, { origin: M.add(target, [0, 0, 30]), dir: [0, 0, -1] });
    expect(hit.data).toEqual([0.75, 0.25, 0.75]);
  });

  it('redefining: fit1 = Fit(tet, 0.3) changes the site and the radius', () => {
    const m = model('cF');
    run(m, 'Fit(oct, 0.5)');
    const res = m.runCommand('fit1 = Fit(tet, 0.3)');
    expect(res.changed).toBe(true);
    expect(m.byName('fit1')).toMatchObject({ kind: 'tet', r: 0.3, at: [0.25, 0.25, 0.25] });
    expect(getType('atom-fit').definition(m.byName('fit1'))).toBe('fit1 = Fit(tet, 0.3)');
  });

  it('plain-language errors', () => {
    const m = model('cI');
    expect(m.runCommand('Fit(cub, 0.3)').error).toMatch(/Cubic I has no cubic sites/);
    expect(m.runCommand('Fit(oct, 5)').error).toMatch(/between 0 and 1\.732 Å/);
    expect(m.runCommand('Fit(blob)').error).toMatch(/couldn’t read “blob”/);
    expect(m.runCommand('Fit(oct, 0.2, 3)').error).toMatch(/up to 2 values/);
    expect(parseFit(['0.4R', 'tet'], m.ctx)).toMatchObject({ kind: 'tet' });
  });

  it('switching cubic F → cubic P moves the atom to the cubic site', () => {
    const m = model('cF');
    const f = run(m, 'Fit(tet, 0.3)');
    m.state.latticeId = 'cP';
    m.recompute();
    expect(f).toMatchObject({ kind: 'cub', at: [0.5, 0.5, 0.5] });
  });
});

describe('Help for Part 4', () => {
  const SITES = [['cP', 'cub', '0.732'], ['cI', 'oct', '0.155'], ['cI', 'tet', '0.291'], ['cF', 'oct', '0.414'], ['cF', 'tet', '0.225']];

  it('every site has a "?" topic with a full derivation, a 3D highlight and a worked example', () => {
    for (const [id, kind, ratio] of SITES) {
      const t = getTopic(`site-${id}-${kind}`);
      expect(t, `${id} ${kind}`).toBeTruthy();
      expect(t.more.steps.length).toBeGreaterThanOrEqual(5);
      const m = model(id);
      const ex = JSON.stringify(t.more.example(m.ctx));
      expect(ex, `${id} ${kind}`).toContain(ratio);
      const hl = t.more.highlight(m.ctx);
      expect(hl.prims.length).toBeGreaterThan(3);
      expect(finitePrims(hl.prims)).toBe(true);
      expect(hl.look).toBeTruthy();
      // another lattice: the example still works (textbook a = 4 Å), the highlight explains why it is off
      const other = model(id === 'cF' ? 'cI' : 'cF');
      expect(JSON.stringify(t.more.example(other.ctx))).toContain(ratio);
      expect(t.more.highlight(other.ctx).unavailable).toBeTruthy();
    }
  });

  it('the cubic F octahedral derivation: a = 2R + 2r and a = 2√2·R, so r/R = √2 − 1', () => {
    const steps = JSON.stringify(getTopic('site-cF-oct').more.steps);
    expect(steps).toContain(String.raw`a = R + 2r + R = 2R + 2r`);
    expect(steps).toContain(String.raw`a = 2\\sqrt2\\,R`);
    expect(steps).toContain(String.raw`\\sqrt2 - 1`);
  });

  it('counting topic: the worked example adds up for each cubic lattice', () => {
    const ex = id => JSON.stringify(getTopic('site-count').more.example(model(id).ctx));
    expect(ex('cF')).toContain('= 4');
    expect(ex('cF')).toContain('= 8');
    expect(ex('cI')).toContain('= 6');
    expect(ex('cI')).toContain('= 12');
  });

  it('atom-fit topic uses the atom whose "?" was pressed', () => {
    const m = model('cF');
    const f = run(m, 'Fit(oct, 0.7)');
    const ex = JSON.stringify(getTopic('atom-fit').more.example(m.ctx, f));
    expect(ex).toContain('fit1');
    expect(ex).toContain('0.114'); // δ = 0.7 + 1.414 − 2
    expect(getTopic('atom-fit').now(m.ctx, f)).toMatch(/too big/);
    for (const step of getTopic('atom-fit').more.example(m.ctx, f).steps) if (step.tex) expect(() => checkTex(step.tex)).not.toThrow();
  });

  it('the card "?" buttons all point at real topics', () => {
    const m = model('cI');
    const html = getType('interstitials').settings(run(m, 'Sites()'), m.ctx) + getType('atom-fit').settings(run(m, 'Fit()'), m.ctx);
    for (const [, key] of html.matchAll(/data-help="([^"]+)"/g)) expect(getTopic(key), key).toBeTruthy();
  });
});

describe('Typing the atom radius', () => {
  it('the radius field rejects text, zero, negative numbers and values above R', () => {
    for (const bad of ['', 'abc', '0.3x', '1.2.3', '-0.2', '0', '0.000', '2']) {
      const res = readPositive(bad, { max: 1.4142, what: 'The radius' });
      expect(res.error, `“${bad}”`).toBeTruthy();
      expect(res.value).toBeUndefined();
    }
    expect(readPositive('-0.2', { what: 'The radius' }).error).toMatch(/negative/);
    expect(readPositive('0', { what: 'The radius' }).error).toMatch(/bigger than 0/);
    expect(readPositive('abc').error).toMatch(/not a number/);
  });
  it('accepts plain numbers, a decimal comma and the unit', () => {
    expect(readPositive('0.35').value).toBe(0.35);
    expect(readPositive('0,35').value).toBe(0.35);
    expect(readPositive(' .5 Å ').value).toBe(0.5);
    expect(readPositive('1.4142', { max: 1.4142 }).value).toBe(1.4142);
  });
  it('↑ / ↓ step by a small amount and never go to 0 or past the maximum', () => {
    expect(stepValue(0.4, 1)).toBe(0.41);
    expect(stepValue(0.4, -1)).toBe(0.39);
    expect(stepValue(0.01, -1)).toBe(0.01);
    expect(stepValue(0.68, 1, { step: 0.1 })).toBe(0.78);
    expect(stepValue(1.41, 1, { step: 0.1, max: 1.4142 })).toBe(1.4142);
  });
  it('the atom-fit verdict follows the radius: green → red, r/R against the critical ratio', () => {
    const m = new SceneModel();
    Object.assign(m.state, { latticeId: 'cF', setting: 'standard', params: { ...findBravais('cF').params } });
    m.recompute();
    const item = m.addItem('atom-fit', { kind: 'oct', r: 0.4 });
    const T = getType('atom-fit');
    const ws = { redraw: () => {}, replaceCard: () => {} };
    let F = fitOf(item, m.ctx);
    expect(F.fit.fits).toBe(true);
    expect(F.fit.critical).toBeCloseTo(Math.SQRT2 - 1, 6);
    T.onField(item, 'r', 0.7, m.ctx, ws, 'change');
    F = fitOf(item, m.ctx);
    expect(item.r).toBe(0.7);
    expect(F.fit.fits).toBe(false);
    expect(F.fit.ratio).toBeCloseTo(0.7 / F.fit.R, 9);
    expect(T.summary(item, m.ctx)).toContain('too big');
    // invalid values never reach the item
    for (const bad of [-1, 0, 99]) T.onField(item, 'r', bad, m.ctx, ws, 'change');
    expect(item.r).toBe(0.7);
  });
  it('the input bar and the radius field stay in sync', () => {
    const m = new SceneModel();
    Object.assign(m.state, { latticeId: 'cF', setting: 'standard', params: { ...findBravais('cF').params } });
    m.recompute();
    m.runCommand('fit1 = Fit(oct, 0.4)');
    const item = m.byName('fit1'), T = getType('atom-fit');
    expect(T.settings(item, m.ctx)).toMatch(/data-field="r"[^>]*value="0\.4"/);
    m.runCommand('fit1 = Fit(oct, 0.9)');
    expect(item.r).toBe(0.9);
    expect(T.settings(item, m.ctx)).toMatch(/data-field="r"[^>]*value="0\.9"/);
    T.onField(item, 'r', 0.55, m.ctx, { redraw: () => {} }, 'change');
    expect(T.definition(item, m.ctx)).toBe('fit1 = Fit(oct, 0.55)');
  });
});
