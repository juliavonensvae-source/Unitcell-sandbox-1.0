/* Ionic structures: Bravais lattice + basis. */
import { describe, it, expect } from 'vitest';
import * as M from '../src/math/index.js';
import { findBravais } from '../src/data/bravais.js';
import { SceneModel } from '../src/objects/model.js';
import { getType } from '../src/objects/index.js';
import { ionicInfo, ionCountText } from '../src/objects/ionic.js';
import { findIonic } from '../src/data/ionic.js';
import { ELEMENTS, MATERIALS } from '../src/data/materials.js';
import { CENTRING } from '../src/data/systems.js';
import { CATEGORIES, menuEntries } from '../src/objects/index.js';
import { getTopic } from '../src/help/index.js';

/* ---------------------------------------------------------------- §5 */
describe('§5 Ionic structures: Bravais lattice + basis', () => {
  const counted = id => {
    const S = findIonic(id), cen = CENTRING[findBravais(S.lattice).centring];
    const L = M.analyse({ a: S.a, b: S.a, c: S.a, alpha: 90, beta: 90, gamma: 90 }, [{ el: 'LP', f: [0, 0, 0] }]).lattice;
    const counts = M.ionCounts(S, cen, M.boxRegion([1, 1, 1]));
    return { S, counts, cn: M.coordination(S, cen, L), z: M.formulaUnitsOf(counts).z };
  };
  it('NaCl (rock salt): cubic F, 4 Na⁺ + 4 Cl⁻ per cell, Z = 4, CN 6 : 6', () => {
    const { S, counts, cn, z } = counted('NaCl');
    expect(S.lattice).toBe('cF');
    expect(counts.Na.total).toBeCloseTo(4, 9);
    expect(counts.Cl.total).toBeCloseTo(4, 9);
    expect(ionCountText(counts.Na)).toBe('12 × ¼ + 1 = 4');
    expect(ionCountText(counts.Cl)).toBe('8 × ⅛ + 6 × ½ = 4');
    expect(z).toBe(4);
    expect(cn.Na.cn).toBe(6);
    expect(cn.Cl.cn).toBe(6);
    expect(cn.Na.d).toBeCloseTo(S.a / 2, 9);
  });
  it('CsCl: cubic P (not body-centred), 1 Cs⁺ + 1 Cl⁻ per cell, Z = 1, CN 8 : 8', () => {
    const { S, counts, cn, z } = counted('CsCl');
    expect(S.lattice).toBe('cP');
    expect(counts.Cs.total).toBeCloseTo(1, 9);
    expect(counts.Cl.total).toBeCloseTo(1, 9);
    expect(ionCountText(counts.Cl)).toBe('8 × ⅛ = 1');
    expect(z).toBe(1);
    expect(cn.Cs.cn).toBe(8);
    expect(cn.Cl.cn).toBe(8);
    expect(cn.Cs.d).toBeCloseTo(Math.sqrt(3) * S.a / 2, 9);
  });
  it('ZnS (zinc blende): cubic F, 4 Zn²⁺ + 4 S²⁻ per cell, Z = 4, CN 4 : 4', () => {
    const { S, counts, cn, z } = counted('ZnS');
    expect(S.lattice).toBe('cF');
    expect(counts.Zn.total).toBeCloseTo(4, 9);
    expect(counts.S.total).toBeCloseTo(4, 9);
    expect(ionCountText(counts.Zn)).toBe('4 inside = 4');
    expect(z).toBe(4);
    expect(cn.Zn.cn).toBe(4);
    expect(cn.S.cn).toBe(4);
    expect(cn.Zn.d).toBeCloseTo(Math.sqrt(3) * S.a / 4, 9);
  });
  it('CaF2 (fluorite): 4 Ca²⁺ + 8 F⁻ per cell, Z = 4, CN 8 : 4', () => {
    const { counts, cn, z } = counted('CaF2');
    expect(counts.Ca.total).toBeCloseTo(4, 9);
    expect(counts.F.total).toBeCloseTo(8, 9);
    expect(z).toBe(4);
    expect(cn.Ca.cn).toBe(8);
    expect(cn.F.cn).toBe(4);
  });
  it('the radius-ratio rule predicts the coordination of all four with the default radii', () => {
    for (const [id, want] of [['NaCl', 6], ['CsCl', 8], ['ZnS', 4], ['CaF2', 8]]) {
      const S = findIonic(id), cat = S.ions.find(i => i.charge.includes('+')), an = S.ions.find(i => !i.charge.includes('+'));
      expect(M.ratioRule(ELEMENTS[cat.el].r / ELEMENTS[an.el].r).cn, id).toBe(want);
    }
  });
  it('the lattice parameter and radii come from the materials data file', () => {
    expect(findIonic('NaCl').a).toBe(MATERIALS.find(m => m.id === 'nacl').params.a);
    expect(findIonic('rock salt')).toBe(findIonic('NaCl'));
    expect(findIonic('zinc blende')).toBe(findIonic('ZnS'));
    expect(findIonic('fluorite')).toBe(findIonic('CaF2'));
    expect(findIonic('perovskite')).toBeNull();
  });
  it('Ionic(NaCl) switches to cubic F with a = 5.64 Å, replaces the lattice points and counts the ions', () => {
    const m = new SceneModel();
    const res = m.runCommand('Ionic(NaCl)');
    expect(res.error).toBeUndefined();
    const item = res.item, T = getType('ionic');
    expect(m.state.latticeId).toBe('cF');
    expect(m.state.params).toMatchObject({ a: 5.64, b: 5.64, c: 5.64, alpha: 90 });
    expect(T.hidesLatticePoints(item, m.ctx)).toBe(true);
    expect(T.summary(item, m.ctx)).toContain('Z = 4');
    expect(T.readout(item, m.ctx).rows.join(' ')).toMatch(/12 × ¼ \+ 1 = 4/);
    expect(T.legend(item, m.ctx).rows).toHaveLength(2);
    expect(T.definition(item, m.ctx)).toBe('ion1 = Ionic(NaCl)');
    expect(T.settings(item, m.ctx)).toContain('Cubic F lattice + a basis of 2 ions');
  });
  it('the counts follow the highlighted cell of a supercell', () => {
    const m = new SceneModel();
    m.runCommand('Ionic(NaCl)');
    Object.assign(m.state, { repeats: [3, 3, 3], cell: [2, 2, 2] });
    m.recompute();
    const info = ionicInfo(m.byName('ion1'), m.ctx);
    expect(info.ions.map(i => ionCountText(i.count))).toEqual(['8 × ⅛ + 6 × ½ = 4', '12 × ¼ + 1 = 4']);
  });
  it('redefining switches the structure and its lattice; unknown names get a clear message', () => {
    const m = new SceneModel();
    m.runCommand('Ionic(NaCl)');
    const res = m.runCommand('ion1 = Ionic(CsCl)');
    expect(res.error).toBeUndefined();
    expect(m.state.latticeId).toBe('cP');
    expect(m.state.params.a).toBeCloseTo(4.12, 9);
    expect(getType('ionic').summary(m.byName('ion1'), m.ctx)).toContain('CN 8 : 8');
    expect(m.runCommand('Ionic(perovskite)').error).toMatch(/know the structure/);
    // on another lattice it is not drawn, and says why
    m.applyLattice('hP');
    expect(getType('ionic').primitives(m.byName('ion1'), m.ctx)).toEqual([]);
    expect(getType('ionic').summary(m.byName('ion1'), m.ctx)).toMatch(/Cubic P only/);
  });
  it('typed ion radii update the radius ratio; invalid radii are refused', () => {
    const m = new SceneModel();
    const item = m.runCommand('Ionic(NaCl)').item, T = getType('ionic'), ws = { redraw: () => {} };
    expect(ionicInfo(item, m.ctx).ratio).toBeCloseTo(1.02 / 1.81, 9);
    T.onField(item, 'r-Na', 1.5, m.ctx, ws, 'change');
    expect(ionicInfo(item, m.ctx).ratio).toBeCloseTo(1.5 / 1.81, 9);
    expect(ionicInfo(item, m.ctx).rule.cn).toBe(8);
    for (const bad of [0, -1, 99]) T.onField(item, 'r-Na', bad, m.ctx, ws, 'change');
    expect(ionicInfo(item, m.ctx).cation.r).toBe(1.5);
  });
  it('the + Add menu has an "Ionic structures" group, every entry with a command and a "?" topic', () => {
    expect(CATEGORIES.some(c => c.id === 'ionic' && c.title === 'Ionic structures')).toBe(true);
    const entries = menuEntries().filter(e => e.category === 'ionic');
    expect(entries.map(e => e.init.structure)).toEqual(['NaCl', 'CsCl', 'ZnS', 'CaF2']);
    for (const e of entries) {
      expect(e.command).toBe(`Ionic(${e.init.structure})`);
      const t = getTopic(e.help);
      expect(t, e.help).toBeTruthy();
      expect(t.more && t.more.steps.length).toBeGreaterThan(4);
    }
    expect(getTopic('ionic').explain).toMatch(/basis/);
  });
});
