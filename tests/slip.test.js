/* Defects mode: slip on close-packed planes. The slip systems of cubic P, I and F, the packing of
   their planes, the dislocation that glides across (the layer above slips by exactly b), the
   Shockley partials of cubic F and their stacking fault, the card, the command and the help. */
import { describe, it, expect } from 'vitest';
import * as M from '../src/math/index.js';
import { getType, menuEntries } from '../src/objects/index.js';
import { crystalOf } from '../src/objects/crystal.js';
import { slipGeometry, parseSlip } from '../src/objects/slip.js';
import { getTopic } from '../src/help/index.js';
import { checkTex } from '../src/help/tex.js';
import { model, run, finitePrims, sum } from './helpers.js';

const defects = (id = 'cF', repeats = [5, 5, 5]) => {
  const m = model(id, { mode: 'defects' });
  m.state.repeats = repeats;
  m.recompute();
  return m;
};
const near = (x, y, tol = 1e-9) => Math.abs(x - y) < tol;
const key = f => f.map(x => Math.round(x * 1e4)).join();

/** The displacement (ud) of the host atom at the perfect position f. */
const moved = (m, f) => crystalOf(m.ctx).atoms.find(a => a.kind === 'host' && key(a.f) === key(f)).ud;

describe('Slip systems of cubic P, I and F', () => {
  it('the planes and directions: {100}⟨100⟩ 3 × 2, {110}⟨111⟩ 6 × 2, {111}⟨110⟩ 4 × 3', () => {
    expect(M.slipPlanes('cF')).toEqual([[1, 1, 1], [-1, 1, 1], [1, -1, 1], [1, 1, -1]]);
    expect(M.slipPlanes('cI').length).toBe(6);
    expect(M.slipPlanes('cP')).toEqual([[1, 0, 0], [0, 1, 0], [0, 0, 1]]);
    for (const [id, n] of [['cP', 6], ['cI', 12], ['cF', 12]]) {
      expect(M.slipSystemCount(id), id).toBe(n);
      for (const hkl of M.slipPlanes(id)) for (const u of M.slipDirections(id, hkl)) expect(M.dot(u, hkl), `${id} ${hkl} ${u}`).toBe(0);
    }
    expect(M.slipDirections('cF', [1, 1, 1])).toEqual([[1, -1, 0], [1, 0, -1], [0, 1, -1]]);
  });

  it('b is the shortest lattice vector, from an atom to the one it touches: a/√2, a√3/2 and a', () => {
    for (const id of ['cP', 'cI', 'cF']) {
      const m = defects(id), dnn = m.ctx.analysis.neighbours.dnn;
      const hkl = M.slipPlanes(id)[0], b = M.norm(M.burgersOf(id, M.slipDirections(id, hkl)[0])) * m.ctx.params.a;
      expect(near(b, dnn), id).toBe(true);
    }
  });

  it('planar packing: π/(2√3) = 0.907 (FCC), 3π/(8√2) = 0.833 (BCC), π/4 = 0.785 (SC); 6, 4 and 4 touching in the plane', () => {
    const facts = id => { const m = defects(id); return M.planeFacts(m.ctx.lattice, m.ctx.basis, M.slipPlanes(id)[0], m.ctx.analysis.neighbours.dnn / 2); };
    expect(facts('cF').packing).toBeCloseTo(Math.PI / (2 * Math.sqrt(3)), 9);
    expect(facts('cI').packing).toBeCloseTo((3 * Math.PI) / (8 * Math.SQRT2), 9);
    expect(facts('cP').packing).toBeCloseTo(Math.PI / 4, 9);
    expect([facts('cF').inPlane, facts('cI').inPlane, facts('cP').inPlane]).toEqual([6, 4, 4]);
  });

  it('the slip planes are the furthest apart (so the densest) of the low-index planes, one atomic layer per whole level', () => {
    const others = [[1, 0, 0], [1, 1, 0], [1, 1, 1], [1, 1, 2], [1, 2, 3], [2, 1, 0]];
    for (const id of ['cP', 'cI', 'cF']) {
      const m = defects(id), L = m.ctx.lattice, basis = m.ctx.basis;
      // the spacing of the planes that really hold points
      const dOf = hkl => M.planeSpacings(L, hkl, basis).dLattice;
      const best = Math.max(...others.map(dOf));
      for (const hkl of M.slipPlanes(id)) {
        expect(dOf(hkl), `${id} ${hkl}`).toBeCloseTo(best, 9);
        expect(M.latticePlanes(hkl, basis).stepValue, `${id} ${hkl}`).toBe(1);
      }
    }
  });

  it('Shockley partials: a/2[1̄10] on (111) splits into two a/6⟨112⟩ partials that add up to b; Frank: b² > b₁² + b₂²', () => {
    const m = defects('cF'), b = M.burgersOf('cF', [-1, 1, 0]);
    const [b1, b2] = M.shockleyPartials(b, [1, 1, 1], [0.5, 0.5, 0], M.isLatticePoint(m.ctx.basis));
    expect(M.add(b1, b2).map(x => +x.toFixed(9) + 0)).toEqual(b.map(x => +x.toFixed(9) + 0));
    for (const p of [b1, b2]) {
      expect(M.asIndices(p).den).toBe(6);
      expect(M.norm(p)).toBeCloseTo(1 / Math.sqrt(6), 9);
      expect(M.dot(p, [1, 1, 1])).toBeCloseTo(0, 9);
    }
    expect(M.b2(b)).toBeGreaterThan(M.b2(b1) + M.b2(b2));
    // the leading partial moves an atom above into a hollow, not on top of an atom below
    const down = [-1 / 3, -1 / 3, -1 / 3], isPoint = M.isLatticePoint(m.ctx.basis);
    expect(isPoint(M.add(M.add([0.5, 0.5, 0], b1), down))).toBe(false);
    expect(isPoint(M.add(M.add([0.5, 0.5, 0], b2), down))).toBe(true);
  });
});

describe('The dislocation glides across the slip plane', () => {
  for (const id of ['cP', 'cI', 'cF']) {
    for (const character of ['edge', 'screw']) {
      it(`${id} ${character}: perfect before, slipped by exactly b after; the line in between moves the atoms near it`, () => {
        const m = defects(id);
        const s = run(m, character === 'edge' ? 'Slip()' : 'Slip()');
        s.character = character;
        const G = slipGeometry(s, m.ctx);
        const below = M.sitesInRegion(m.ctx.basis, m.ctx.region).map(x => x.f).find(f => G.inLayers(f) && G.side(f) < 0);
        const above = M.sitesInRegion(m.ctx.basis, m.ctx.region).map(x => x.f).find(f => G.inLayers(f) && G.side(f) > 0);
        s.t = 0;
        expect(crystalOf(m.ctx).maxMoved).toBe(0);
        s.t = 1;
        const rel = M.sub(moved(m, above), moved(m, below));
        expect(M.norm(M.sub(rel, G.b))).toBeLessThan(1e-9);
        s.t = 0.5;
        expect(crystalOf(m.ctx).maxMoved).toBeGreaterThan(0.1 * G.blen);
        expect(finitePrims(getType('slip').primitives(s, m.ctx))).toBe(true);
        expect(finitePrims(getType('atoms').primitives(m.state.scene[0], m.ctx))).toBe(true);
      });
    }
  }

  it('in the middle of the glide the atoms far behind the line have slipped by b, those far ahead not at all', () => {
    const m = defects('cF', [7, 7, 7]);
    const s = run(m, 'Slip()');
    s.t = 0.5;
    const G = slipGeometry(s, m.ctx), L = m.ctx.lattice, C = crystalOf(m.ctx);
    const X = a => M.dot(M.sub(a.ref, G.o), G.frame.m);
    const pair = far => {
      const up = C.atoms.filter(a => G.inLayers(a.f) && G.side(a.f) > 0).sort((p, q) => far * (X(q) - X(p)))[0];
      const down = C.atoms.filter(a => G.inLayers(a.f) && G.side(a.f) < 0).sort((p, q) => M.norm(M.sub(p.ref, M.sub(up.ref, M.scale(G.n, G.d)))) - M.norm(M.sub(q.ref, M.sub(up.ref, M.scale(G.n, G.d)))))[0];
      return M.sub(up.ud, down.ud);
    };
    expect(M.dot(pair(-1), M.normalize(G.b)) / G.blen).toBeGreaterThan(0.8); // behind: close to b
    expect(Math.abs(M.dot(pair(1), M.normalize(G.b))) / G.blen).toBeLessThan(0.2); // ahead: close to 0
    expect(L).toBeTruthy();
  });

  it('cubic F with partials: between them the atoms above have moved by b₁ only (a stacking fault), behind both by b', () => {
    const m = defects('cF', [7, 7, 7]);
    const s = run(m, 'Slip(FCC)');
    s.partials = true;
    s.width = 6;
    s.t = 0.5;
    const G = slipGeometry(s, m.ctx), C = crystalOf(m.ctx);
    expect(G.partials).toBeTruthy();
    const b1 = m.ctx.lattice.toCartesian(G.partials[0]);
    // atoms above, right at the middle between the two partial lines, compared with their partners below
    const X = a => M.dot(M.sub(a.ref, G.o), G.frame.m);
    const mid = C.atoms.filter(a => G.inLayers(a.f) && G.side(a.f) > 0 && Math.abs(X(a) - G.x) < 0.6 * G.blen);
    expect(mid.length).toBeGreaterThan(0);
    for (const up of mid) {
      const partner = C.atoms.filter(a => G.inLayers(a.f) && G.side(a.f) < 0)
        .sort((p, q) => M.norm(M.sub(p.ref, up.ref)) - M.norm(M.sub(q.ref, up.ref)))[0];
      const rel = M.sub(up.ud, partner.ud);
      expect(M.norm(M.sub(rel, b1)) / G.blen).toBeLessThan(0.25);
    }
    s.t = 1;
    const any = C.atoms.find(a => G.inLayers(a.f) && G.side(a.f) > 0);
    expect(M.norm(M.sub(crystalOf(m.ctx).atoms.find(a => a.f === any.f).ud, M.scale(G.b, 0.5)))).toBeLessThan(1e-9);
    expect(finitePrims(getType('slip').primitives(s, m.ctx))).toBe(true);
  });
});

describe('The slip card, its command and its + Add entries', () => {
  it('Slip(FCC), Slip(BCC) and Slip(SC) switch to their lattice; Slip() keeps the one on screen', () => {
    const m = defects('cP');
    run(m, 'Slip(FCC)');
    expect(m.ctx.bravais.id).toBe('cF');
    run(m, 'Slip(bcc)');
    expect(m.ctx.bravais.id).toBe('cI');
    const s = run(m, 'Slip()');
    expect(m.ctx.bravais.id).toBe('cI');
    expect(sum(m, s)).toMatch(/\(101\)/); // the {110} plane that lies most nearly level is shown first
    // renaming into another lattice starts again on that lattice's most level plane
    s.t = 0.6;
    run(m, `${s.name} = Slip(SC)`);
    expect(m.ctx.bravais.id).toBe('cP');
    expect(sum(m, s)).toMatch(/\(001\)/);
    expect(s.t).toBe(0);
    expect(parseSlip('hcp').error).toMatch(/FCC, BCC or SC/);
    expect(m.runCommand('Slip(nope)').error).toBeTruthy();
    expect(model().runCommand('Slip(FCC)').error).toMatch(/Defects mode/);
  });

  it('the + Add entries switch the lattice; adding one leaves the other atoms in one colour', () => {
    const entries = menuEntries().filter(e => e.type === 'slip');
    expect(entries.map(e => e.init.lattice)).toEqual(['cF', 'cI', 'cP']);
    const m = defects('cP');
    m.addItem('slip', { ...entries[0].init });
    expect(m.ctx.bravais.id).toBe('cF');
    expect(m.state.scene[0].colourBy).toBe('none');
  });

  it('the two layers are drawn by the slip card, the rest faint (or hidden, or shown) by the Atoms', () => {
    const m = defects('cF');
    const s = run(m, 'Slip()');
    const C = crystalOf(m.ctx), mine = C.atoms.filter(a => a.mark === s.id);
    const G = slipGeometry(s, m.ctx);
    expect(mine.length).toBeGreaterThan(0);
    expect(mine.every(a => G.inLayers(a.f))).toBe(true);
    const atoms = () => getType('atoms').primitives(m.state.scene[0], m.ctx);
    const hosts = C.atoms.filter(a => a.kind === 'host').length;
    expect(atoms()[0].centres.length).toBe(0); // faint: every unmarked atom is in the faint set
    expect(atoms()[1].centres.length).toBe(hosts - mine.length);
    s.rest = 'hide';
    expect(atoms().reduce((n, p) => n + (p.kind === 'spheres' ? p.centres.length : 0), 0)).toBe(0);
    s.rest = 'show';
    expect(atoms()[0].centres.length).toBe(hosts - mine.length);
    const layers = getType('slip').primitives(s, m.ctx).filter(p => p.kind === 'spheres').slice(0, 2);
    expect(layers[0].centres.length + layers[1].centres.length).toBe(mine.length);
  });

  it('every plane, direction and character of cubic P, I and F draws finite primitives, at every stage', () => {
    for (const id of ['cP', 'cI', 'cF']) {
      const m = defects(id, [4, 4, 4]);
      const s = run(m, 'Slip()');
      s.shear = true;
      for (let p = 0; p < M.slipPlanes(id).length; p++) {
        s.plane = p;
        for (let d = 0; d < M.slipDirections(id, M.slipPlanes(id)[p]).length; d++) {
          s.dir = d;
          for (const character of ['edge', 'screw']) {
            s.character = character;
            for (const partials of id === 'cF' ? [false, true] : [false]) {
              s.partials = partials;
              for (const t of [0, 0.3, 0.7, 1]) {
                s.t = t;
                expect(finitePrims(getType('slip').primitives(s, m.ctx)), `${id} ${p} ${d} ${character} ${partials} ${t}`).toBe(true);
              }
            }
          }
        }
      }
      expect(getType('slip').frameExtra(s, m.ctx).every(p => p.every(Number.isFinite))).toBe(true);
      expect(getType('slip').legend(s, m.ctx).rows.length).toBeGreaterThanOrEqual(2);
      expect(getType('slip').settings(s, m.ctx)).toContain('data-help="slip-system"');
    }
  });

  it('the card shows the slip system, b and the partials, each with a "?"', () => {
    const m = defects('cF');
    const s = run(m, 'Slip()');
    s.partials = true;
    const html = getType('slip').settings(s, m.ctx);
    expect(html).toContain('data-help="slip-system"');
    expect(html).toContain('data-help="shockley"');
    expect(html).toContain('data-help="glide"');
    expect(html).toMatch(/12 systems \(4 planes × 3 directions\)/);
    expect(html).toContain('/6');
  });
});

describe('Help: close-packed planes and Shockley partials', () => {
  it('both topics exist with a derivation, a picture and a worked example, and render for cubic P, I and F', () => {
    for (const k of ['slip-system', 'shockley']) {
      const t = getTopic(k);
      expect(t.more.steps.length, k).toBeGreaterThanOrEqual(6);
      for (const id of ['cP', 'cI', 'cF']) {
        const m = defects(id);
        const s = run(m, 'Slip()');
        s.partials = true;
        for (const item of [null, s]) {
          const ex = t.more.example(m.ctx, item);
          const out = JSON.stringify([t.now(m.ctx, item), ex, t.more.diagram(m.ctx, item)]);
          expect(out, `${k} ${id}`).not.toMatch(/NaN|undefined|Infinity/);
          for (const st of ex.steps) if (st.tex) expect(() => checkTex(st.tex), `${k}: ${st.tex}`).not.toThrow();
        }
      }
    }
  });

  it('the worked examples give the textbook numbers', () => {
    const m = defects('cF');
    m.state.params = { a: 3.615, b: 3.615, c: 3.615, alpha: 90, beta: 90, gamma: 90 };
    m.recompute();
    const slip = JSON.stringify(getTopic('slip-system').more.example(m.ctx, null));
    expect(slip).toContain('2.087'); // d(111) of copper
    expect(slip).toContain('0.907'); // close-packed
    expect(slip).toContain('2.556'); // |b| = a/√2
    expect(slip).toContain('= 12');
    const sh = JSON.stringify(getTopic('shockley').more.example(m.ctx, null));
    expect(sh).toContain('1.476'); // a/√6
    const bcc = JSON.stringify(getTopic('slip-system').more.example(defects('cI').ctx, null));
    expect(bcc).toContain('0.833');
  });
});
