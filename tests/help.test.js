/* Part 3: the help system. Every topic must typeset with KaTeX and give
   finite worked examples and highlights for all 14 lattices; the numbers
   in the derivations must match the textbook values. */
import { describe, it, expect } from 'vitest';
import { getType, menuEntries } from '../src/objects/index.js';
import { BRAVAIS } from '../src/data/bravais.js';
import { allTopics, getTopic, resolve, topicFormulas, topicSteps, helpKeyFor } from '../src/help/index.js';
import { checkTex } from '../src/help/tex.js';
import { siteFits } from '../src/help/topics/interstitials.js';
import { touchingLine } from '../src/help/highlights.js';
import { model, run, finitePrims } from './helpers.js';
import { helpButton } from '../src/ui/controls.js';
import '../src/objects/lattice.js'; // registers the Lattice card's type

/** checkTex is slow and the same strings recur across scenes, so each distinct string is checked once. */
const texOk = new Set();
const typesets = src => {
  if (texOk.has(src)) return true;
  checkTex(src);
  texOk.add(src);
  return true;
};

/** Every TeX string in a piece of topic output: display formulas and inline $…$ in texts. */
function texIn(value, out = []) {
  if (value == null) return out;
  if (typeof value === 'string') { for (const m of value.matchAll(/\$([^$]+)\$/g)) out.push(m[1]); return out; }
  if (Array.isArray(value)) { value.forEach(v => texIn(v, out)); return out; }
  if (typeof value === 'object') {
    for (const [k, v] of Object.entries(value)) {
      if (k === 'tex' && typeof v === 'string') out.push(v);
      else if (k !== 'prims') texIn(v, out);
    }
  }
  return out;
}

/** Everything a topic can show for one scene (what the popover and SEE MORE render). */
function render(t, ctx, item = null) {
  const out = { formulas: topicFormulas(t, ctx, item), symbols: (t.symbols || []).map(([s, m]) => ({ tex: s, text: m })), now: t.now ? t.now(ctx, item) : null, explain: t.explain };
  if (t.more) {
    out.steps = topicSteps(t, ctx, item);
    out.example = t.more.example ? t.more.example(ctx, item) : null;
    out.diagram = t.more.diagram ? t.more.diagram(ctx, item) : null;
    out.highlight = t.more.highlight ? t.more.highlight(ctx, item) : null;
  }
  return out;
}

const SCENES = [
  ...BRAVAIS.map(b => [b.id, {}]),
  ['hR', { setting: 'hexagonal' }],
  ['hP', { prism: true }],
];

describe('Help topics: structure', () => {
  it('every topic has a title, a plain-language explanation and a scope', () => {
    for (const t of allTopics()) {
      expect(t.title, t.key).toBeTruthy();
      expect(t.explain.length, t.key).toBeGreaterThan(60);
      expect(t.scope, t.key).toBeTruthy();
    }
  });

  it('every explanation is 2–4 sentences', () => {
    for (const t of allTopics()) {
      const n = t.explain.replace(/<[^>]+>/g, '').replace(/e\.g\.|i\.e\./g, 'eg').split(/[.!?](\s|$)/).filter(s => s && s.trim().length > 3).length;
      expect(n, `${t.key}: ${n} sentences`).toBeGreaterThanOrEqual(1);
      expect(n, `${t.key}: ${n} sentences`).toBeLessThanOrEqual(4);
    }
  });

  it('every topic with formulas explains its symbols', () => {
    const ctx = model().ctx;
    for (const t of allTopics()) if (topicFormulas(t, ctx).length) expect(t.symbols && t.symbols.length, t.key).toBeGreaterThan(0);
  });

  it('every object type and every + Add entry has a help topic', () => {
    const m = model();
    const missing = [];
    for (const e of menuEntries()) {
      const key = e.help || (e.type && getType(e.type).help);
      if (!getTopic(typeof key === 'function' ? 'direction' : key)) missing.push(e.key);
    }
    expect(missing).toEqual([]);
    for (const type of ['lattice', 'lattice-points', 'cell-edges', 'axes', 'direction', 'plane', 'calc-angle', 'spacing', 'intercepts', 'components', 'direction2d', 'line2d', 'vector2d']) {
      expect(helpKeyFor(getType(type), { type }, m.ctx), type).toBeTruthy();
    }
  });

  it('the required subjects are covered', () => {
    for (const k of ['crystal-systems', 'centring', 'bravais', 'lattice-params', 'direction', 'plane', 'miller-bravais', 'intercepts', 'calc-volume', 'calc-points',
      'calc-packing', 'calc-nn', 'calc-dspacing', 'calc-angle', 'calc-bragg', 'interstitials']) {
      expect(getTopic(k), k).toBeTruthy();
      expect(getTopic(k).more, `${k} has SEE MORE`).toBeTruthy();
      expect(getTopic(k).more.steps.length, `${k} derivation`).toBeGreaterThanOrEqual(3);
      expect(getTopic(k).more.example, `${k} worked example`).toBeTypeOf('function');
    }
  });

  it('the 2D view has its own topics', () => {
    for (const t of ['direction2d', 'line2d', 'vector2d']) expect(getType(t).help).toBe(t);
  });

  it('a "?" button names its topic and object', () => {
    expect(helpButton('calc-packing', { item: 7 })).toContain('data-help="calc-packing"');
    expect(helpButton('calc-packing', { item: 7 })).toContain('data-help-item="7"');
    expect(helpButton('nope')).toBe('');
  });
});

describe('Help topics render for every lattice', () => {
  for (const [id, opts] of SCENES) {
    it(`${id}${opts.setting ? ` (${opts.setting})` : ''}${opts.prism ? ' prism' : ''}: every formula typesets and every example is finite`, () => {
      const m = model(id, opts);
      m.state.advanced = true;
      run(m, 'p1 = (1 1 1)');
      run(m, 'p2 = (1 -1 0)');
      run(m, 'd1 = [1 1 0]');
      const ang = run(m, 'Angle(d1, p1)');
      const cut = run(m, 'Intersection(p1, p2)');
      const ctx = m.ctx;
      for (const t of allTopics().filter(x => !['lattices-2d', 'direction2d', 'line2d', 'vector2d'].includes(x.key))) {
        for (const item of [null, ang, cut, ctx.items[0]]) {
          const out = render(t, ctx, item);
          for (const src of texIn(out)) {
            expect(() => typesets(src), `${t.key}: ${src}`).not.toThrow();
            expect(src, `${t.key}: unfinished number in ${src}`).not.toMatch(/NaN|undefined|Infinity|\?\\,/);
          }
          if (out.highlight && out.highlight.prims) expect(finitePrims(out.highlight.prims), `${t.key} highlight`).toBe(true);
          if (out.example) expect(out.example.steps.length, `${t.key} example`).toBeGreaterThan(0);
        }
      }
    });
  }

  it('2D topics render for the five 2D lattices', () => {
    for (const id of ['mp', 'op', 'oc', 'tp', 'hp']) {
      const m = model();
      m.state.dim = '2d';
      m.state.flat.latticeId = id;
      m.recompute();
      run(m, 'd1 = [1 2]');
      run(m, 'l1 = (1 2)');
      run(m, 'v1 = Vector((0, 0), (1, 2))');
      for (const key of ['lattices-2d', 'direction2d', 'line2d', 'vector2d']) {
        const t = getTopic(key);
        for (const item of [null, ...m.ctx.items]) {
          for (const src of texIn(render(t, m.ctx, item))) {
            expect(() => typesets(src), `${key}: ${src}`).not.toThrow();
            expect(src).not.toMatch(/NaN|undefined|Infinity/);
          }
        }
      }
    }
  });
});

describe('Derivations and worked examples give the textbook numbers', () => {
  const exampleText = (key, m, item = null) => JSON.stringify(getTopic(key).more.example(m.ctx, item));

  it('packing fraction: spheres touch along the edge (P), body diagonal (I), face diagonal (F)', () => {
    expect(touchingLine(model('cP').ctx).relation).toBe('2<i>r</i> = <i>a</i>');
    expect(touchingLine(model('cI').ctx).relation).toBe('4<i>r</i> = √3 <i>a</i>');
    expect(touchingLine(model('cF').ctx).relation).toBe('4<i>r</i> = √2 <i>a</i>');
    expect(exampleText('calc-packing', model('cF'))).toContain('0.7405');
    expect(exampleText('calc-packing', model('cI'))).toContain('0.6802');
    expect(exampleText('calc-packing', model('cP'))).toContain('0.5236');
  });

  it('critical radius ratios: 0.732, 0.414, 0.225, 0.155, 0.291', () => {
    const r = id => siteFits(model(id).ctx).sites.map(s => +s.ratio.toFixed(3));
    expect(r('cP')).toEqual([0.732]);
    expect(r('cF')).toEqual([0.414, 0.225]);
    expect(r('cI')).toEqual([0.155, 0.291]);
    expect(siteFits(model('tP').ctx)).toBeNull();
  });

  it('Bragg example: cubic F a = 3.615 Å, (111) with Cu Kα gives d = 2.087 Å and 2θ ≈ 43.3°', () => {
    const m = model('cF', { params: { a: 3.615, b: 3.615, c: 3.615, alpha: 90, beta: 90, gamma: 90 } });
    const p = run(m, 'p1 = (1 1 1)');
    const text = exampleText('calc-bragg', m, p);
    expect(text).toContain('2.087');
    expect(text).toContain('43.3');
  });

  it('interplanar distance example: cubic P a = 1, d(110) = 0.7071 by both formulas', () => {
    const m = model('cP', { params: { a: 1, b: 1, c: 1, alpha: 90, beta: 90, gamma: 90 } });
    const p = run(m, 'p1 = (1 1 0)');
    expect(exampleText('calc-dspacing', m, p)).toContain('0.7071');
  });

  it('angle example: tetragonal a = 1, c = 2, [101] makes 36.87° with the normal of (101)', () => {
    const m = model('tP', { params: { a: 1, b: 1, c: 2, alpha: 90, beta: 90, gamma: 90 } });
    run(m, 'd1 = [1 0 1]');
    run(m, 'p1 = (1 0 1)');
    const ang = run(m, 'Angle(d1, p1)');
    expect(exampleText('calc-angle', m, ang)).toContain('36.87');
  });

  it('Miller–Bravais example: [100] = [2 −1 −1 0] and (100) = (1 0 −1 0)', () => {
    const m = model('hP');
    const d = run(m, 'd1 = [1 0 0]');
    const text = exampleText('miller-bravais', m, d);
    expect(text).toContain(String.raw`[2\\,\\overline{1}\\,\\overline{1}\\,0]`);
    run(m, 'p1 = (1 0 0)');
    expect(exampleText('miller-bravais', m, d)).toContain(String.raw`(1\\,0\\,\\overline{1}\\,0)`);
  });

  it('intersection example: (111) and (1 −1 0) give [1 1 −2]; parallel planes are reported', () => {
    const m = model('cP');
    run(m, 'p1 = (1 1 1)');
    run(m, 'p2 = (1 -1 0)');
    const dir = run(m, 'Intersection(p1, p2)');
    expect(exampleText('intersection', m, dir)).toContain(String.raw`[11\\overline{2}]`);
    const m2 = model('cP');
    run(m2, 'p1 = (1 1 1)');
    run(m2, 'p2 = (2 2 2)');
    expect(exampleText('intersection', m2)).toContain('parallel');
  });

  it('points per cell: the worked example adds up to 1, 2, 2, 4 and 3 (prism)', () => {
    const total = m => JSON.stringify(getTopic('calc-points').more.example(m.ctx)).match(/= (\d+)"/g).pop();
    expect(total(model('cP'))).toContain('= 1');
    expect(total(model('cI'))).toContain('= 2');
    expect(total(model('oC'))).toContain('= 2');
    expect(total(model('cF'))).toContain('= 4');
    expect(total(model('hP', { prism: true }))).toContain('= 3');
  });

  it('the hexagonal cell volume is (√3/2)·a²·c in the worked example', () => {
    const m = model('hP');
    const V = Math.sqrt(3) / 2 * 3.5 * 3.5 * 5.6;
    expect(exampleText('calc-volume', m)).toContain(V.toFixed(2).slice(0, 5));
  });

  it('a worked example uses the object whose "?" was pressed', () => {
    const m = model('cP');
    run(m, 'p1 = (1 0 0)');
    const p2 = run(m, 'p2 = (1 1 0)');
    expect(resolve(getTopic('plane').now, m.ctx, p2)).toContain('p2');
    expect(exampleText('plane', m, p2)).toContain('p2');
  });
});
