/* Challenge mode: the template files read cleanly, every question type makes correct
   questions at every level (checked against the maths, not against the generator's own
   answer), typed answers are marked fairly, and tests are built and scored as agreed. */
import { describe, it, expect } from 'vitest';
import { SUBJECTS, TEMPLATE_ERRORS, findSubject } from '../src/challenge/index.js';
import { parseTemplateFile, buildSubjects, LEVELS } from '../src/challenge/templates.js';
import { buildTest, mark, score, unfilled, wordsOf, topicsWithQuestions, render, renderTex } from '../src/challenge/engine.js';
import { checkTex } from '../src/help/tex.js';
import { parseIndexText, checkIndices, markTyped, parseNumberText, fixedAnswerSpec } from '../src/challenge/answers.js';
import { seeded } from '../src/challenge/random.js';
import { classify2D } from '../src/challenge/subjects/crystallography/bravais2d.js';
import { systemsFitting } from '../src/challenge/subjects/crystallography/bravais3d.js';
import * as C from '../src/challenge/subjects/crystallography/common.js';
import { det3 } from '../src/math/linalg.js';

const cryst = findSubject('crystallography');
/** Text of an option, with a bar over a number written as a minus sign: (1̄10) → (-110). */
const plain = html => String(html).replace(/<span class="ob">(\d+)<\/span>/g, '-$1').replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim();
const SAMPLES = 40;

/**
 * Every formula in a piece of HTML is valid TeX, and no TeX shows on screen as text.
 * (KaTeX draws an unknown command such as \displaystyled in red instead of failing,
 * so the formula sources, kept in KaTeX's <annotation>, are checked strictly, and the
 * visible text may not contain a backslash.)
 */
function expectGoodTex(html, where) {
  const s = String(html);
  for (const [, src] of s.matchAll(/<annotation encoding="application\/x-tex">([\s\S]*?)<\/annotation>/g)) {
    const tex = src.replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#x27;/g, "'").replace(/&amp;/g, '&');
    expect(() => checkTex(tex), `${where}: ${tex}`).not.toThrow();
  }
  const visible = s.replace(/<annotation[\s\S]*?<\/annotation>/g, '').replace(/<[^>]+>/g, '');
  expect(visible, `${where} shows TeX as text`).not.toMatch(/\\[A-Za-z]/);
}

/** Generates up to SAMPLES questions of one type at one level. */
function samples(topic, type, level, seed = 1) {
  const rng = seeded(seed), gen = cryst.types[type], word = wordsOf(topic), out = [];
  for (let i = 0; i < SAMPLES * 4 && out.length < SAMPLES; i++) {
    const r = gen.make({ level, rng, word });
    if (r) out.push(r);
  }
  return out;
}

/** The crystal system that a set of lattice parameters belongs to (standard settings). */
function systemOf(p) {
  const eq = (x, y) => Math.abs(x - y) < 1e-9, right = x => eq(x, 90);
  const abEq = eq(p.a, p.b), bcEq = eq(p.b, p.c), acEq = eq(p.a, p.c);
  if (abEq && bcEq && right(p.alpha) && right(p.beta) && right(p.gamma)) return 'cubic';
  if (abEq && !acEq && right(p.alpha) && right(p.beta) && right(p.gamma)) return 'tetragonal';
  if (abEq && !acEq && right(p.alpha) && right(p.beta) && eq(p.gamma, 120)) return 'hexagonal';
  if (!abEq && !bcEq && !acEq && right(p.alpha) && right(p.beta) && right(p.gamma)) return 'orthorhombic';
  if (abEq && bcEq && eq(p.alpha, p.beta) && eq(p.beta, p.gamma) && !right(p.alpha)) return 'rhombohedral';
  if (!abEq && !bcEq && !acEq && right(p.alpha) && right(p.gamma) && !right(p.beta)) return 'monoclinic';
  if (!abEq && !bcEq && !acEq && ![p.alpha, p.beta, p.gamma].some(right)) return 'triclinic';
  return 'none';
}

const proportional = (a, b) => C.same(C.reduce(a), C.reduce(b));

/** The maths check of each question type: throws (via expect) when a question is wrong. */
const CHECKS = {
  'params-to-system': r => { if (r.data.params) expect(systemOf(r.data.params)).toBe(r.data.system); },
  'params-points-to-lattice': r => expect(r.wrong).not.toContain(r.correct),
  'points-per-cell': r => expect(r.data.count).toBe({ cP: 1, cI: 2, cF: 4, tP: 1, tI: 2, oP: 1, oC: 2, oI: 2, oF: 4, mP: 1, mC: 2, aP: 1 }[r.data.lattice]),
  'equivalence-to-system': r => expect(systemsFitting(r.data.base, r.data.statements)).toEqual([r.data.system]),
  'identify-2d': r => expect(classify2D(r.data.v1, r.data.v2)).toBe(r.data.lattice),
  'intercepts-to-hkl': r => {
    const { hkl, intercepts, level } = r.data;
    hkl.forEach((h, i) => (h === 0 ? expect(intercepts[i]).toBeNull() : expect((intercepts[i].p / intercepts[i].q) * h).toBeCloseTo(level, 9)));
    expect(r.data.options.filter(o => C.same(o, hkl))).toHaveLength(1);
  },
  'plane-family-member': r => { expect(C.sameCubicFamily(r.data.correct, r.data.base)).toBe(true); r.data.options.slice(1).forEach(o => expect(C.sameCubicFamily(o, r.data.base)).toBe(false)); },
  'plane-family-not-member': r => { expect(C.sameCubicFamily(r.data.correct, r.data.base)).toBe(false); r.data.options.slice(1).forEach(o => expect(C.sameCubicFamily(o, r.data.base)).toBe(true)); },
  'plane-family-count': r => expect(r.data.count).toBe(C.signedPerms(r.data.base).length / 2),
  'dir-family-count-cubic': r => expect(r.data.count).toBe(C.signedPerms(r.data.base).length),
  'dir-family-member-cubic': r => CHECKS['plane-family-member'](r),
  'dir-family-not-member-cubic': r => CHECKS['plane-family-not-member'](r),
  'dir-family-member-hex': r => {
    const inFam = v => C.hexDirFamily(r.data.base).some(m => C.same(m, v));
    expect(inFam(r.data.correct)).toBe(true);
    r.data.options.forEach(o => expect(C.validFour(o)).toBe(true));
    r.data.options.slice(1).forEach(o => expect(inFam(o)).toBe(false));
  },
  'dir-family-count-hex': r => expect(r.data.count).toBe(C.hexDirFamily(r.data.base).length),
  'dir-between-points-cubic': r => {
    const d = r.data.head.map((x, i) => x - r.data.tail[i]);
    [...r.data.head, ...r.data.tail].forEach(x => { expect(x).toBeGreaterThanOrEqual(-1e-9); expect(x).toBeLessThanOrEqual(1 + 1e-9); });
    const k = d.find(x => Math.abs(x) > 1e-9) / r.data.uvw.find(x => x !== 0);
    expect(k).toBeGreaterThan(0);
    d.forEach((x, i) => expect(x).toBeCloseTo(k * r.data.uvw[i], 9));
    expect(C.isReduced(r.data.uvw)).toBe(true);
  },
  'dir-between-points-hex': r => CHECKS['dir-between-points-cubic'](r),
  'dir-between-points-hex4': r => {
    CHECKS['dir-between-points-cubic'](r);
    expect(C.validFour(r.data.four)).toBe(true);
    expect(C.dirTo3(r.data.four)).toEqual(r.data.uvw);
  },
  'dir-in-plane': r => expect(r.data.options.map(o => C.dot3(o, r.data.hkl) === 0)).toEqual([true, false, false, false]),
  'plane-contains-dir': r => expect(r.data.options.map(o => C.dot3(o, r.data.uvw) === 0)).toEqual([true, false, false, false]),
  'zone-axis': r => {
    expect([C.dot3(r.data.answer, r.data.p1), C.dot3(r.data.answer, r.data.p2)]).toEqual([0, 0]);
    expect(C.isReduced(r.data.answer)).toBe(true);
    r.data.options.slice(1).forEach(o => expect(C.allZero(C.cross3(o, r.data.answer))).toBe(false));
  },
  'plane-from-two-dirs': r => {
    expect([C.dot3(r.data.answer, r.data.d1), C.dot3(r.data.answer, r.data.d2)]).toEqual([0, 0]);
    r.data.options.slice(1).forEach(o => expect(C.allZero(C.cross3(o, r.data.answer))).toBe(false));
  },
  'coplanar-three': r => expect(r.data.options.map(s => det3(s) === 0)).toEqual([true, false, false, false]),
  'd-cubic': r => { const [h, k, l] = r.data.hkl; expect(r.data.d).toBeCloseTo(r.data.a / Math.hypot(h, k, l), 9); },
  'd-tetragonal': r => { const [h, k, l] = r.data.hkl; expect(r.data.d).toBeCloseTo(1 / Math.sqrt((h * h + k * k) / r.data.a ** 2 + (l * l) / r.data.c ** 2), 9); },
  'd-hexagonal': r => {
    const [h, k, l] = r.data.hkl3;
    expect(r.data.d).toBeCloseTo(1 / Math.sqrt((4 / 3) * (h * h + h * k + k * k) / r.data.a ** 2 + (l * l) / r.data.c ** 2), 9);
    if (r.data.hkl.length === 4) expect(C.validFour(r.data.hkl)).toBe(true);
  },
  'hkil-valid-plane': r => expect(r.data.options.map(C.validFour)).toEqual([true, false, false, false]),
  'uvtw-valid-dir': r => expect(r.data.options.map(C.validFour)).toEqual([true, false, false, false]),
  'four-index-not-valid': r => expect(r.data.options.map(C.validFour)).toEqual([false, true, true, true]),
  'dir-3-to-4': r => { expect(C.validFour(r.data.four)).toBe(true); expect(C.dirTo3(r.data.four)).toEqual(C.reduce(r.data.UVW)); },
};

describe('Challenge templates (challenge_templates/)', () => {
  it('read without problems', () => {
    expect(TEMPLATE_ERRORS).toEqual([]);
  });

  it('Crystallography has its seven topics, in file order', () => {
    expect(SUBJECTS.map(s => s.name)).toContain('Crystallography');
    expect(cryst.topics.map(t => t.name)).toEqual([
      '3D Bravais lattices', '2D Bravais lattices', 'Planes (cubic)', 'Directions (cubic and hexagonal)',
      'Planes and directions (cubic)', 'Interplanar spacing', 'Hexagonal four-index notation',
    ]);
  });

  it('every question type in the code has a template, and each template file has the words its types need', () => {
    for (const [name, gen] of Object.entries(cryst.types)) {
      const topics = cryst.topics.filter(t => t.questions.some(q => q.type === name));
      expect(topics.length, `${name} has no [question] block`).toBeGreaterThan(0);
      for (const t of topics) for (const w of gen.words || []) expect(Object.hasOwn(t.words, w), `${t.id}: word ${w} for ${name}`).toBe(true);
      expect(CHECKS[name], `a maths check for ${name}`).toBeTypeOf('function');
    }
  });

  it('every hand-written question can be marked, and its formulas are valid', () => {
    for (const t of cryst.topics) for (const f of t.fixed) {
      if (f.wrong.length) expect(f.wrong).toHaveLength(3);
      else expect(fixedAnswerSpec(f.answer, f.negativeOk), f.where).not.toBeNull();
      [f.text, f.explain, f.answer, ...f.wrong].forEach(x => expectGoodTex(renderTex(x), f.where));
    }
  });

  it('the formula check catches TeX shown as text', () => {
    expect(() => expectGoodTex(render(String.raw`$\displaystyled_{1}$`), 'x')).toThrow();
    expect(() => expectGoodTex(String.raw`d = a/\sqrt{3}`, 'x')).toThrow();
    expect(() => expectGoodTex(render(String.raw`$\displaystyle{}d_{1} = \frac{a}{2}$`), 'x')).not.toThrow();
  });

  it('reports mistakes with the file and line', () => {
    const p = parseTemplateFile('[topic]\nname: T\n[question]\ntype: x\nlevle: easy\ntext: Hi\n[fixed]\ntext: Q\nanswer: A\nwrong: B | C\nstray line\n[nonsense]', 'f.txt');
    expect(p.errors.join('\n')).toMatch(/f\.txt line 5: \[question\] has no "levle"/);
    expect(p.errors.join('\n')).toMatch(/exactly 3 options/);
    expect(p.errors.join('\n')).toMatch(/line 11: expected "name: value"/);
    expect(p.errors.join('\n')).toMatch(/unknown block \[nonsense\]/);
    const built = buildSubjects({ '/challenge_templates/x/a.txt': '[topic]\nname: A\n[question]\ntype: nope\ntext: Hi' }, { x: {} });
    expect(built.errors.join('\n')).toMatch(/no question type "nope"/);
    expect(built.errors.join('\n')).toMatch(/_subject\.txt/);
  });

  it('indented lines continue the one above, and word names keep their capitals', () => {
    const p = parseTemplateFile('[topic]\nname: T\n[question]\ntype: x\ntext: one\n  two\n[words]\npoints-P: corners', 'f');
    expect(p.questions[0].text).toBe('one two');
    expect(p.words['points-P']).toBe('corners');
  });
});

describe('Every question type, at every level', () => {
  for (const topic of cryst.topics) {
    const types = [...new Set(topic.questions.map(q => q.type))];
    for (const type of types) {
      const gen = cryst.types[type];
      for (const level of gen.levels) {
        it(`${type} (${level})`, () => {
          const list = samples(topic, type, level, LEVELS.indexOf(level) + 7);
          expect(list.length, 'enough questions are made').toBe(SAMPLES);
          const wordings = topic.questions.filter(q => q.type === type && q.levels.includes(level));
          for (const r of list) {
            // four different options, the right one among them
            expect(r.wrong).toHaveLength(3);
            expect(new Set([r.correct, ...r.wrong].map(plain)).size, `options of ${r.key}`).toBe(4);
            // every placeholder of every wording is filled
            for (const w of wordings) {
              const fields = { ...r.fields, answer: r.correct };
              expect(unfilled(w.text, fields), `${type} text`).toEqual([]);
              expect(unfilled(w.explain, fields), `${type} explain`).toEqual([]);
              // the question and its solution as shown: every formula valid, no code on screen
              expectGoodTex(render(w.text, fields), `${type} text`);
              expectGoodTex(render(w.explain, fields), `${type} explain`);
            }
            [r.correct, ...r.wrong].forEach(o => expectGoodTex(o, `${type} option`));
            expect(Object.values(r.fields).join(' ')).not.toMatch(/katex-error|\[[a-z]+-[A-Za-z-]*\]|undefined|NaN/);
            // typed answers: the right answer is accepted
            if (gen.format === 'either') {
              expect(r.typed, `${type} can be typed`).toBeTruthy();
              const text = r.typed.kind === 'indices' ? r.typed.values.join(' ') : String(r.typed.value);
              expect(markTyped(text, r.typed).status).toBe('right');
            }
            // indices stay small: the question's numbers are within ±5
            if (r.typed?.kind === 'indices') expect(C.inRange(r.typed.values)).toBe(true);
            CHECKS[type](r);
          }
        });
      }
    }
  }

  it('easy questions have no minus signs (except i and t in four-index notation)', () => {
    const topic = id => cryst.topics.find(t => t.id === id);
    for (const [id, type, key] of [['c-planes', 'intercepts-to-hkl', 'hkl'], ['d-directions', 'dir-between-points-cubic', 'uvw'], ['e-planes-and-directions', 'dir-in-plane', 'hkl']]) {
      for (const r of samples(topic(id), type, 'easy')) {
        expect(C.nonNeg(r.data[key]), `${type} ${r.key}`).toBe(true);
        (r.data.options || []).forEach(o => expect(C.nonNeg(o), `${type} option ${o}`).toBe(true));
      }
    }
    for (const r of samples(topic('g-miller-bravais'), 'dir-3-to-4', 'easy')) expect(C.nonNeg(r.data.UVW)).toBe(true);
  });

  it('hard 3 → 4 conversions have minus signs, hard indices go up to 5', () => {
    const t = cryst.topics.find(x => x.id === 'g-miller-bravais');
    const list = samples(t, 'dir-3-to-4', 'hard');
    list.forEach(r => expect(r.data.UVW.some(x => x < 0)).toBe(true));
    const planes = samples(cryst.topics.find(x => x.id === 'c-planes'), 'intercepts-to-hkl', 'hard');
    expect(Math.max(...planes.map(r => C.maxAbs(r.data.hkl)))).toBe(5);
  });

  it('the 2D pictures have points, and easy ones show the cell', () => {
    const t = cryst.topics.find(x => x.id === 'b-2d-bravais-lattices');
    const [easy] = samples(t, 'identify-2d', 'easy'), [hard] = samples(t, 'identify-2d', 'hard');
    expect(easy.figure).toMatch(/class="ch-cell"/);
    expect(hard.figure).not.toMatch(/class="ch-cell"/);
    expect((hard.figure.match(/<circle/g) || []).length).toBeGreaterThan(15);
  });
});

describe('Typed answers', () => {
  it('read indices written in every usual way', () => {
    for (const s of ['1 -1 0', '(1-10)', '1,-1,0', '[1 −1 0]', '11̄0', '[11̅0]', '  ( 1 , -1 , 0 ) ', '1;-1;0']) {
      expect(parseIndexText(s).values, s).toEqual([1, -1, 0]);
    }
    expect(parseIndexText('2-1-10').values).toEqual([2, -1, -1, 0]);
    expect(parseIndexText('[2 -1-1 0]').values).toEqual([2, -1, -1, 0]);
    expect(parseIndexText('1 10 0').values).toEqual([1, 10, 0]);
    expect(parseIndexText('').error).toBe('empty');
    expect(parseIndexText('one').error).toBe('format');
  });

  it('accept the negative only where it is the same answer, and say why an answer is wrong', () => {
    const dir = { kind: 'indices', values: [1, -1, 0], negativeOk: false };
    expect(checkIndices([1, -1, 0], dir).ok).toBe(true);
    expect(checkIndices([-1, 1, 0], dir)).toEqual({ ok: false, hint: 'reversed' });
    expect(checkIndices([2, -2, 0], dir)).toEqual({ ok: false, hint: 'reduce' });
    expect(checkIndices([1, -1, 0, 0], dir)).toEqual({ ok: false, hint: 'count' });
    expect(checkIndices([1, 1, 0], dir)).toEqual({ ok: false, hint: null });
    const zone = { ...dir, negativeOk: true };
    expect(checkIndices([-1, 1, 0], zone).ok).toBe(true);
    expect(checkIndices([-2, 2, 0], zone).hint).toBe('reduce');
  });

  it('read numbers with a comma or a unit, within 1 %', () => {
    const d = { kind: 'number', value: 2.3383, tol: 0.01 };
    for (const s of ['2.34', '2,34', '2.34 Å', '2.34A', '2.338']) expect(markTyped(s, d).status, s).toBe('right');
    expect(markTyped('2.4', d).status).toBe('wrong');
    expect(markTyped('', d).status).toBe('blank');
    expect(markTyped('two', d)).toEqual({ status: 'wrong', hint: 'format' });
    expect(parseNumberText('1e1').value).toBe(10);
    expect(markTyped('4', { kind: 'number', value: 4, tol: 0 }).status).toBe('right');
    expect(markTyped('4.1', { kind: 'number', value: 4, tol: 0 }).status).toBe('wrong');
  });

  it('read the answers of hand-written questions', () => {
    expect(fixedAnswerSpec('(1 1 0)')).toEqual({ spec: { kind: 'indices', values: [1, 1, 0], negativeOk: false }, bracket: 'plane' });
    expect(fixedAnswerSpec('[1 -1 0]', true).spec.negativeOk).toBe(true);
    expect(fixedAnswerSpec('14').spec).toEqual({ kind: 'number', value: 14, tol: 0 });
    expect(fixedAnswerSpec('2.34 Å').spec).toEqual({ kind: 'number', value: 2.34, tol: 0.01 });
    expect(fixedAnswerSpec('Orthorhombic')).toBeNull();
  });
});

describe('Building and marking a test', () => {
  const all = cryst.topics.map(t => t.id);

  it('has the number of questions asked for, from the chosen topics, without repeats', () => {
    for (const level of LEVELS) {
      const qs = buildTest({ subject: cryst, topicIds: all, level, count: 30, rng: seeded(3) });
      expect(qs).toHaveLength(30);
      expect(new Set(qs.map(q => q.key)).size).toBe(30);
      expect(qs.map(q => q.n)).toEqual(Array.from({ length: 30 }, (_, i) => i + 1));
      // spread over the topics: each of the 7 appears
      expect(new Set(qs.map(q => q.topicId)).size).toBe(7);
      for (const q of qs) {
        if (q.format === 'mc') { expect(q.options).toHaveLength(4); expect(q.options[q.correctIndex]).toBe(q.answer); }
        expect(q.prompt).not.toMatch(/katex-error/);
      }
    }
    const one = buildTest({ subject: cryst, topicIds: ['c-planes'], level: 'medium', count: 10, rng: seeded(4) });
    expect(new Set(one.map(q => q.topicId))).toEqual(new Set(['c-planes']));
  });

  it('makes about a quarter of the questions typed, when the topics allow it', () => {
    const qs = buildTest({ subject: cryst, topicIds: ['c-planes', 'd-directions', 'f-interplanar-spacing'], level: 'medium', count: 40, rng: seeded(5) });
    const typed = qs.filter(q => q.format === 'typed').length;
    expect(typed).toBeGreaterThanOrEqual(8);
    expect(typed).toBeLessThanOrEqual(12);
    // topics whose answers are names only have multiple choice
    const names = buildTest({ subject: cryst, topicIds: ['b-2d-bravais-lattices'], level: 'medium', count: 10, rng: seeded(6) });
    expect(names.every(q => q.format === 'mc')).toBe(true);
  });

  it('repeats questions only when a topic has run out of new ones', () => {
    const tiny = {
      id: 't', name: 'T', types: {},
      topics: [{ id: 'one', name: 'One', questions: [], words: {}, fixed: [
        { levels: ['easy'], text: 'Q1', answer: 'A', wrong: ['B', 'C', 'D'], explain: '', where: 'q1' },
        { levels: ['easy'], text: 'Q2', answer: '7', wrong: [], explain: '', where: 'q2' },
      ] }],
    };
    const qs = buildTest({ subject: tiny, topicIds: ['one'], level: 'easy', count: 6, rng: seeded(1) });
    expect(qs).toHaveLength(6);
    expect(new Set(qs.map(q => q.key)).size).toBe(2);
    for (let i = 1; i < qs.length; i++) expect(qs[i].key).not.toBe(qs[i - 1].key);
    expect(buildTest({ subject: tiny, topicIds: ['one'], level: 'hard', count: 5 })).toEqual([]);
    expect(topicsWithQuestions(tiny, ['one'], 'hard')).toEqual([]);
  });

  it('100 easy questions on one topic still works (with repeats)', () => {
    const qs = buildTest({ subject: cryst, topicIds: ['g-miller-bravais'], level: 'easy', count: 100, rng: seeded(8) });
    expect(qs).toHaveLength(100);
  });

  it('marks and scores: unanswered counts as wrong in the percentage', () => {
    const qs = buildTest({ subject: cryst, topicIds: all, level: 'easy', count: 8, rng: seeded(9) });
    const answers = qs.map((q, i) => {
      if (i === 0) return null; // left blank
      if (i === 1) return q.format === 'mc' ? (q.correctIndex + 1) % 4 : 'nonsense'; // wrong
      return q.format === 'mc' ? q.correctIndex : (q.spec.kind === 'indices' ? q.spec.values.join(' ') : String(q.spec.value));
    });
    const s = score(qs, answers);
    expect([s.right, s.wrong, s.blank, s.total]).toEqual([6, 1, 1, 8]);
    expect(s.percent).toBe(75);
    expect(mark(qs[0], null).status).toBe('blank');
  });
});
