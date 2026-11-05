/* Part 5: Defects mode. Point defects and how their neighbours relax, dislocations,
   the Burgers circuit, glide, the vacancy concentration, the 2D slice, the mode's
   + Add entries and commands, and its help topics. Runs SceneModel in Defects mode. */
import { describe, it, expect } from 'vitest';
import * as M from '../src/math/index.js';
import { getType, menuEntries } from '../src/objects/index.js';
import { crystalOf } from '../src/objects/crystal.js';
import { allTopics } from '../src/help/index.js';
import { checkTex } from '../src/help/tex.js';
import { parseNv } from '../src/objects/vacancy-conc.js';
import { model, run, finitePrims } from './helpers.js';

const defects = (id = 'cP', repeats = [5, 5, 5]) => {
  const m = model(id, { mode: 'defects' });
  m.state.repeats = repeats;
  m.recompute();
  return m;
};
const R0 = m => m.ctx.analysis.neighbours.dnn / 2;
/** Host atoms whose perfect position is r from point c (Cartesian), and how far they moved (signed: + outward). */
function shell(m, f, r) {
  const C = crystalOf(m.ctx), c = m.ctx.lattice.toCartesian(f);
  return C.atoms.filter(a => a.kind === 'host' && Math.abs(M.norm(M.sub(a.ref, c)) - r) < 1e-6)
    .map(a => M.dot(M.add(a.ud, a.ur), M.normalize(M.sub(a.ref, c))));
}
const near = (x, y, tol = 1e-9) => Math.abs(x - y) < tol;

describe('Defects mode: the model', () => {
  it('starts in cubic P with a 5 × 5 × 5 block of atoms and no defects', () => {
    const m = defects();
    expect(m.state.scene.map(s => s.type)).toEqual(['atoms', 'cell-edges', 'axes']);
    const C = crystalOf(m.ctx);
    expect(C.atoms.length).toBe(216);
    expect(C.maxMoved).toBe(0);
  });

  it('every + Add entry of Defects mode has a command that adds its type', () => {
    const entries = menuEntries().filter(e => getType(e.type).mode === 'defects');
    expect(entries.map(e => e.key).sort()).toEqual(['burgers', 'edge', 'frenkel', 'interstitial', 'screw', 'self-interstitial', 'slip-bcc', 'slip-fcc', 'slip-sc', 'sub-large', 'sub-small', 'vacancy', 'vacancy-conc'].sort());
    for (const e of entries) {
      const m = defects();
      const item = run(m, e.command.replace('edge1', '')); // Burgers() adds its own dislocation
      expect(item.type, e.key).toBe(e.type);
    }
  });

  it('commands stay in their own mode, and directions or planes are not made here', () => {
    expect(defects().runCommand('Spacing((1 1 1))').error).toMatch(/Crystal Structures/);
    expect(defects().runCommand('p1 = (1 1 1)').error).toMatch(/Crystal Structures/);
    expect(model().runCommand('Vacancy()').error).toMatch(/Defects mode/);
  });
});

describe('Point defects: how the neighbours relax', () => {
  it('vacancy: removed atom, the 6 nearest neighbours (cubic P) move in by strength × R/10', () => {
    const m = defects();
    const v = run(m, 'Vacancy((2, 2, 2))');
    const C = crystalOf(m.ctx);
    expect(C.atoms.length).toBe(215);
    expect(C.vacancies.length).toBe(1);
    const first = shell(m, v.at, 2 * R0(m));
    expect(first.length).toBe(6);
    for (const u of first) expect(near(u, -0.5 * R0(m) / 10)).toBe(true);
  });

  it('the field falls off as 1/r²: the second shell (√2 a) moves half as far as the first (a)', () => {
    const m = defects();
    run(m, 'Vacancy((2, 2, 2))');
    const a = m.ctx.params.a, [u1] = shell(m, [2, 2, 2], a), [u2] = shell(m, [2, 2, 2], Math.SQRT2 * a);
    expect(near(u2, u1 / 2)).toBe(true);
  });

  it('substitutional: 1.2R at full strength pushes the nearest neighbours out by 0.2R (until they touch); 0.8R pulls them in', () => {
    const m = defects('cF');
    const s = run(m, 'Substitutional(1.2R, (2, 2, 2))');
    s.strength = 100;
    m.itemChanged();
    const first = shell(m, [2, 2, 2], 2 * R0(m));
    expect(first.length).toBe(12);
    for (const u of first) expect(near(u, 0.2 * R0(m))).toBe(true);
    run(m, 'sub1 = Substitutional(0.8R)');
    for (const u of shell(m, [2, 2, 2], 2 * R0(m))) expect(near(u, -0.2 * R0(m))).toBe(true);
  });

  it('self-interstitial in the cubic F octahedral site: δ = (2 − √2) R; a small interstitial that fits moves nothing', () => {
    const m = defects('cF');
    const si = run(m, 'SelfInterstitial(oct, (2.5, 2.5, 2.5))');
    si.strength = 100;
    m.itemChanged();
    const d = Math.SQRT2 * R0(m);
    for (const u of shell(m, si.at, d)) expect(near(u, (2 - Math.SQRT2) * R0(m))).toBe(true);
    const m2 = defects('cF');
    run(m2, 'Interstitial(0.4R, oct, (2.5, 2.5, 2.5))'); // r/R = 0.4 < 0.414: it fits
    expect(crystalOf(m2.ctx).maxMoved).toBe(0);
  });

  it('Frenkel pair: the atom count stays the same, one vacancy and one self-interstitial', () => {
    const m = defects('cF');
    const before = crystalOf(m.ctx).atoms.length;
    run(m, 'Frenkel()');
    const C = crystalOf(m.ctx);
    expect(C.atoms.length).toBe(before);
    expect(C.vacancies.length).toBe(1);
    expect(C.atoms.filter(a => a.kind === 'self').length).toBe(1);
  });

  it('positions must be lattice points or sites of the block; two defects cannot share one', () => {
    const m = defects();
    expect(m.runCommand('Vacancy((2.3, 2, 2))').error).toMatch(/not a lattice point.*\(2, 2, 2\)/);
    expect(m.runCommand('SelfInterstitial(oct)').error).toMatch(/no octahedral sites/);
    run(m, 'Vacancy((2, 2, 2))');
    expect(m.runCommand('Substitutional(1.2R, (2, 2, 2))').error).toMatch(/v1 is already there/);
  });

  it('deleting or hiding a defect takes it out of the crystal at once', () => {
    const m = defects();
    const v = run(m, 'Vacancy()');
    expect(crystalOf(m.ctx).vacancies.length).toBe(1);
    v.visible = false;
    expect(crystalOf(m.ctx).vacancies.length).toBe(0);
    v.visible = true;
    m.state.items.splice(m.state.items.indexOf(v), 1);
    expect(crystalOf(m.ctx).vacancies.length).toBe(0);
  });

  it('every point defect draws finite primitives in cubic P, I and F', () => {
    for (const id of ['cP', 'cI', 'cF']) {
      const m = defects(id);
      for (const cmd of ['Vacancy()', 'SelfInterstitial()', 'Substitutional(1.3R)', 'Interstitial(0.6R)', 'Frenkel()']) {
        const it = run(m, cmd);
        expect(finitePrims(getType(it.type).primitives(it, m.ctx)), `${id} ${cmd}`).toBe(true);
      }
      expect(finitePrims(getType('atoms').primitives(m.state.scene[0], m.ctx))).toBe(true);
    }
  });
});

describe('Dislocations and the Burgers circuit', () => {
  it('a circuit around an edge dislocation fails to close by b = a[100]; in a perfect crystal it closes', () => {
    const m = defects('cP', [9, 9, 3]);
    run(m, 'Edge()');
    const bc = run(m, 'Burgers(edge1)');
    const K = getType('burgers').circuit(bc, m.ctx);
    expect(K.walk.out).toBe(false);
    expect(K.closure).toEqual([1, 0, 0]);
    expect(M.norm(M.sub(K.perfect[K.perfect.length - 1], K.perfect[0]))).toBeLessThan(1e-9);
  });

  it('the other half-plane gives −b; a screw dislocation gives b along the line, a[001]', () => {
    const m = defects('cP', [9, 9, 3]);
    run(m, 'Edge(-c)');
    expect(getType('burgers').circuit(run(m, 'Burgers(edge1)'), m.ctx).closure).toEqual([-1, 0, 0]);
    const s = defects('cP', [9, 9, 4]);
    run(s, 'Screw()');
    expect(getType('burgers').circuit(run(s, 'Burgers(screw1)'), s.ctx).closure).toEqual([0, 0, 1]);
  });

  it('a circuit that does not go around the line closes', () => {
    const m = defects('cP', [9, 9, 3]);
    run(m, 'Edge()');
    const bc = run(m, 'Burgers(edge1, 2)');
    bc.shift = [2, 2];
    expect(getType('burgers').circuit(bc, m.ctx).closure).toEqual([0, 0, 0]);
  });

  it('edge dislocation: bonds squeezed on the side of the extra half-plane, stretched on the other', () => {
    const m = defects('cP', [9, 9, 3]);
    const e = run(m, 'Edge()');
    const C = crystalOf(m.ctx), [x, y] = e.at;
    const nearLine = C.atoms.filter(a => Math.abs(a.f[0] - x) < 2 && Math.abs(a.f[1] - y) < 2);
    const mean = list => list.reduce((s, a) => s + a.strain, 0) / list.length;
    expect(mean(nearLine.filter(a => a.f[1] > y))).toBeLessThan(0);
    expect(mean(nearLine.filter(a => a.f[1] < y))).toBeGreaterThan(0);
    // the extra half-plane: one column of atoms above the line, along the whole line
    expect(C.atoms.filter(a => a.mark === e.id).length).toBe((9 - Math.ceil(y) + 1) * 4);
  });

  it('after gliding out of the block the top half has slipped by exactly b over the bottom half', () => {
    const m = defects('cP', [7, 7, 2]);
    const e = run(m, 'Edge()');
    e.at = [8, e.at[1]];
    m.itemChanged();
    const C = crystalOf(m.ctx), a = m.ctx.params.a;
    const top = C.atoms.find(t => t.f.join() === '3,4,0'), bottom = C.atoms.find(t => t.f.join() === '3,3,0');
    expect(near(top.ud[0] - bottom.ud[0], a)).toBe(true);
    e.at = [-1, e.at[1]]; // not in the crystal yet: perfect
    m.itemChanged();
    expect(crystalOf(m.ctx).maxMoved).toBe(0);
  });

  it('dislocations are for cubic P only; their entries say so elsewhere', () => {
    const m = defects('cF');
    expect(m.runCommand('Edge()').error).toMatch(/cubic P/);
    expect(menuEntries().find(e => e.key === 'edge').unavailable(m.ctx)).toBeTruthy();
  });

  it('edge, screw and the Burgers circuit draw finite primitives, also while stepping', () => {
    const m = defects('cP', [9, 9, 3]);
    for (const cmd of ['Edge()', 'Screw(a)']) run(m, cmd);
    const bc = run(m, 'Burgers(edge1)');
    for (const step of [0, 5, 16]) {
      bc.step = step;
      for (const it of m.state.items) expect(finitePrims(getType(it.type).primitives(it, m.ctx)), `${it.type} ${step}`).toBe(true);
    }
  });
});

describe('Vacancy concentration', () => {
  it('copper at 1273 K, Q_v = 0.9 eV, N = 8.0 × 10²⁸ m⁻³: N_v ≈ 2.2 × 10²⁵ m⁻³ (Callister)', () => {
    expect(M.vacancyFraction(1273, 0.9)).toBeCloseTo(2.735e-4, 6);
    expect(8.0e28 * M.vacancyFraction(1273, 0.9) / 1e25).toBeCloseTo(2.19, 1);
  });

  it('N comes from the lattice on screen: 4 atoms per cubic F cell of a = 4 Å is 6.25 × 10²⁸ m⁻³', () => {
    expect(M.atomsPerM3(4, 4) / 1e28).toBeCloseTo(6.25, 6);
  });

  it('Nv(…) reads temperatures in K or °C and energies in eV or kJ/mol', () => {
    expect(parseNv(['1273', '0.9'])).toEqual({ T: 1273, Q: 0.9 });
    expect(parseNv(['1000 C', '0.9 eV'])).toEqual({ T: 1273.15, Q: 0.9 });
    expect(parseNv(['96.485 kJ/mol']).Q).toBeCloseTo(1, 9);
    expect(parseNv(['5000']).error).toBeTruthy();
    const m = defects();
    const nv = run(m, 'Nv(1000 C, 0.9 eV)');
    expect(nv.T).toBeCloseTo(1273.15, 6);
  });
});

describe('The 2D slice', () => {
  it('has one layer per atomic plane: 6 across c in cubic P 5×5×5, 11 in cubic F', () => {
    expect(M.sliceOf(defects('cP').ctx.basis, [5, 5, 5], { on: true, axis: 2, layer: null }).count).toBe(6);
    const sl = M.sliceOf(defects('cF').ctx.basis, [5, 5, 5], { on: true, axis: 2, layer: 4 });
    expect(sl.count).toBe(11);
    expect(sl.level).toBe(2);
    expect(M.inSlice([1, 1, 2], sl) && !M.inSlice([1, 1, 2.5], sl)).toBe(true);
  });

  it('only the atoms of the slice are drawn', () => {
    const m = defects();
    m.state.slice = { on: true, axis: 2, layer: 2 };
    m.recompute();
    const prims = getType('atoms').primitives(m.state.scene[0], m.ctx);
    expect(prims[0].centres.length).toBe(36);
  });
});

describe('Defects help topics render', () => {
  const keys = ['vacancy', 'self-interstitial', 'substitutional', 'interstitial', 'frenkel', 'relaxation', 'vacancy-conc', 'defect-slice', 'edge-dislocation', 'screw-dislocation', 'burgers', 'glide'];
  it('every topic exists with SEE MORE (except the slice)', () => {
    for (const k of keys) {
      const t = allTopics().find(x => x.key === k);
      expect(t, k).toBeTruthy();
      if (k !== 'defect-slice') expect(t.more.steps.length, k).toBeGreaterThanOrEqual(4);
    }
  });

  for (const id of ['cP', 'cI', 'cF']) {
    it(`${id}: formulas typeset and examples are finite with every defect on screen`, () => {
      const m = defects(id, [7, 7, 3]);
      for (const cmd of ['Vacancy()', 'Substitutional(0.8R)', 'Interstitial()', 'SelfInterstitial()', 'Frenkel()', 'Nv()']) run(m, cmd);
      if (id === 'cP') { run(m, 'Edge()'); run(m, 'Screw(a)'); run(m, 'Burgers(edge1)'); }
      for (const t of allTopics().filter(x => keys.includes(x.key))) {
        for (const item of [null, ...m.state.items]) {
          const out = JSON.stringify([t.explain, t.formulas, t.now ? t.now(m.ctx, item) : '', t.more && t.more.example ? t.more.example(m.ctx, item) : '', t.more && t.more.diagram ? t.more.diagram(m.ctx, item) : '']);
          expect(out, t.key).not.toMatch(/NaN|undefined|Infinity/);
          for (const f of t.formulas || []) expect(() => checkTex(f.tex)).not.toThrow();
          if (t.more && t.more.example) for (const s of t.more.example(m.ctx, item).steps) if (s.tex) expect(() => checkTex(s.tex), `${t.key}: ${s.tex}`).not.toThrow();
        }
      }
    });
  }
});
