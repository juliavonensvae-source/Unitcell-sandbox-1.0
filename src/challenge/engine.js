/* =====================================================================
   Challenge mode: building a test and marking it. No DOM.

   A subject (src/challenge/index.js) has topics, read from its template
   files, and question types, written in code. Each question type is
     { levels: ['easy', …], format: 'mc' | 'either', words: [names it needs],
       make({ level, rng, word }) → {
         key,      same key = same question (a test avoids repeating a key)
         fields,   values for the {placeholders} of the template text
         correct,  the right answer (HTML)
         wrong,    three wrong answers (HTML) for multiple choice
         typed,    (format 'either') how a typed answer is marked:
                   { kind: 'indices', values, negativeOk, bracket } or { kind: 'number', value, tol, unit }
         figure,   (optional) a picture (SVG markup)
         data,     (optional) the raw numbers, for the tests
       } or null when the random numbers didn't work out }
   ===================================================================== */
import { shuffle, pick } from './random.js';
import { markTyped, fixedAnswerSpec } from './answers.js';
import { tex } from '../help/tex.js';
import { idx } from '../ui/format.js';

/** About a quarter of the questions are typed, where the question type allows it. */
export const TYPED_SHARE = 0.25;
/** Words in braces that are notation, not placeholders: {hkl} in a sentence stays as it is. */
export const NOTATION = ['hkl', 'uvw', 'hkil', 'uvtw', 'UVW', 'HKL'];

const MATH = /(\$[^$]+\$)/g;
const PLACEHOLDER = /\{([A-Za-z][A-Za-z0-9]*)\}/g;

/** Fill {placeholders} from fields; names that aren't fields stay as they are. */
export const fill = (text, fields) => String(text).replace(PLACEHOLDER, (m, k) => (Object.hasOwn(fields, k) ? String(fields[k]) : m));

/**
 * A template text as HTML: $…$ becomes a KaTeX formula, and the {placeholders} outside
 * the formulas are filled from fields (a formula's own braces, \frac{a}{b}, are left alone).
 */
export const render = (text, fields = {}) =>
  String(text).split(MATH).map(part => (/^\$[^$]+\$$/.test(part) ? tex(part.slice(1, -1)) : fill(part, fields))).join('');

/** $…$ → KaTeX, nothing filled in (fixed questions). */
export const renderTex = text => render(text, {});

/** The {names} outside formulas that are neither fields nor notation: a typo in a template, or a missing field. */
export const unfilled = (text, fields = {}) =>
  String(text).split(MATH).filter(p => !/^\$[^$]+\$$/.test(p))
    .flatMap(p => [...p.matchAll(PLACEHOLDER)].map(m => m[1]))
    .filter(k => !Object.hasOwn(fields, k) && !NOTATION.includes(k));

/** The question types and fixed questions of a topic at a level, as "buckets" to draw from. */
function bucketsOf(subject, topic, level) {
  const byType = new Map();
  for (const q of topic.questions) {
    const gen = subject.types[q.type];
    if (!gen || !q.levels.includes(level) || !gen.levels.includes(level)) continue;
    if (!byType.has(q.type)) byType.set(q.type, { kind: 'gen', type: q.type, gen, wordings: [], topic });
    byType.get(q.type).wordings.push(q);
  }
  const out = [...byType.values()];
  const fixed = topic.fixed.filter(f => f.levels.includes(level) && (f.wrong.length === 3 || fixedAnswerSpec(f.answer, f.negativeOk)));
  if (fixed.length) out.push({ kind: 'fixed', type: 'fixed', items: fixed, topic });
  return out;
}

/** The topics (of those chosen) that have questions at this level. */
export const topicsWithQuestions = (subject, topicIds, level) =>
  subject.topics.filter(t => topicIds.includes(t.id) && bucketsOf(subject, t, level).length);

/** A word from the topic's [words] block, with its TeX rendered and placeholders filled. */
export const wordsOf = topic => (name, fields = {}) => (Object.hasOwn(topic.words, name) ? render(topic.words[name], fields) : `[${name}]`);

/** One raw question from a bucket, or null (make() gave up, or every fixed question is used). */
function draw(bucket, level, rng, used) {
  if (bucket.kind === 'fixed') {
    const fresh = bucket.items.filter(f => !used.has(`fixed|${f.where}`));
    const f = pick(rng, fresh.length ? fresh : bucket.items);
    return { key: `fixed|${f.where}`, fixed: f };
  }
  return bucket.gen.make({ level, rng, word: wordsOf(bucket.topic) });
}

/**
 * A new test: `count` questions from the chosen topics, spread evenly over them and over
 * the question types within each topic. A question is only repeated when a topic has run
 * out of new ones (e.g. 100 easy questions on one small topic).
 * → [question] (see makeQuestion), or [] when no chosen topic has questions at this level.
 */
export function buildTest({ subject, topicIds, level, count, rng = Math.random, typedShare = TYPED_SHARE }) {
  const topics = topicsWithQuestions(subject, topicIds, level);
  if (!topics.length || count < 1) return [];
  const state = new Map(topics.map(t => [t.id, { buckets: bucketsOf(subject, t, level), queue: [], done: new Set() }]));
  const used = new Set(), raws = [];

  /** Next bucket of a topic, taking turns over its question types (shuffled each round). */
  const nextBucket = st => {
    const open = st.buckets.filter(b => !st.done.has(b));
    if (!open.length) return null;
    if (!st.queue.some(b => open.includes(b))) st.queue = shuffle(rng, open);
    while (st.queue.length) { const b = st.queue.shift(); if (open.includes(b)) return b; }
    return null;
  };

  /** A question of the topic that isn't in the test yet, or null when the topic has run out. */
  const fresh = topic => {
    const st = state.get(topic.id);
    for (let b = nextBucket(st); b; b = nextBucket(st)) {
      for (let i = 0; i < (b.kind === 'fixed' ? 1 : 40); i++) {
        const r = draw(b, level, rng, used);
        if (r && !used.has(r.key)) return { ...r, bucket: b };
      }
      st.done.add(b); // this question type has no new questions at this level
    }
    return null;
  };

  let order = shuffle(rng, topics);
  for (let i = 0; i < count; i++) {
    if (i % order.length === 0 && i) order = shuffle(rng, topics);
    const first = order[i % order.length];
    // a topic that has run out hands its turn to one that hasn't
    let r = fresh(first);
    for (const t of shuffle(rng, topics)) { if (r) break; r = fresh(t); }
    if (!r) { // every topic has run out: repeat
      const b = pick(rng, state.get(first.id).buckets);
      for (let k = 0; k < 40 && !r; k++) { const x = draw(b, level, rng, new Set()); if (x) r = { ...x, bucket: b }; }
      if (!r) continue;
    }
    used.add(r.key);
    raws.push(r);
  }

  // typed answers: a quarter of the test, chosen from the questions whose type allows typing
  const typedFixed = raws.filter(r => r.fixed && !r.fixed.wrong.length).length;
  const eligible = shuffle(rng, raws.filter(r => !r.fixed && r.bucket.gen.format === 'either' && r.typed));
  const typed = new Set(eligible.slice(0, Math.max(0, Math.round(typedShare * raws.length) - typedFixed)));

  const questions = spreadRepeats(shuffle(rng, raws)).map(r => makeQuestion(r, typed.has(r), rng));
  questions.forEach((q, i) => { q.n = i + 1; });
  return questions;
}

/** Moves a repeated question away from its twin when they end up next to each other. */
function spreadRepeats(list) {
  for (let i = 1; i < list.length; i++) {
    if (list[i].key !== list[i - 1].key) continue;
    const j = list.findIndex((r, k) => k > i && r.key !== list[i].key && (k + 1 >= list.length || list[k + 1].key !== list[i].key) && list[k - 1].key !== list[i].key);
    if (j > 0) [list[i], list[j]] = [list[j], list[i]];
  }
  return list;
}

/**
 * The question as the test and review show it:
 * { key, topic, type, prompt, figure, explain, format: 'mc' | 'typed',
 *   options, correctIndex (mc) · spec, bracket (typed) · answer (HTML of the right answer), data }
 */
function makeQuestion(r, typed, rng) {
  const base = { key: r.key, topic: r.bucket.topic.name, topicId: r.bucket.topic.id, type: r.bucket.type };
  if (r.fixed) {
    const f = r.fixed;
    if (f.wrong.length) {
      const opts = [f.answer, ...f.wrong].map(o => renderTex(o)), order = shuffle(rng, [0, 1, 2, 3]);
      return { ...base, format: 'mc', prompt: renderTex(f.text), figure: null, explain: renderTex(f.explain),
        options: order.map(i => opts[i]), correctIndex: order.indexOf(0), answer: opts[0], data: null };
    }
    const { spec, bracket } = fixedAnswerSpec(f.answer, f.negativeOk);
    const answer = spec.kind === 'indices' ? idx(spec.values, bracket) : renderTex(f.answer);
    return { ...base, format: 'typed', prompt: renderTex(f.text), figure: null, explain: renderTex(f.explain), spec, bracket, answer, data: null };
  }
  const wording = pick(rng, r.bucket.wordings);
  const fields = { ...r.fields, answer: r.correct };
  const common = { ...base, prompt: render(wording.text, fields), figure: r.figure || null, explain: render(wording.explain, fields), answer: r.correct, data: r.data || null };
  if (typed) return { ...common, format: 'typed', spec: r.typed, bracket: r.typed.bracket || null };
  const opts = [r.correct, ...r.wrong], order = shuffle(rng, [0, 1, 2, 3]);
  return { ...common, format: 'mc', options: order.map(i => opts[i]), correctIndex: order.indexOf(0) };
}

/**
 * Marks one answer: for multiple choice the index of the chosen option (or null),
 * for typed questions the text. → { status: 'right' | 'wrong' | 'blank', hint }
 */
export function mark(q, answer) {
  if (q.format === 'mc') {
    if (answer == null) return { status: 'blank', hint: null };
    return { status: answer === q.correctIndex ? 'right' : 'wrong', hint: null };
  }
  return markTyped(answer, q.spec);
}

/** The test's score. → { right, wrong, blank, total, percent, marks: [{ status, hint }] } */
export function score(questions, answers) {
  const marks = questions.map((q, i) => mark(q, answers[i]));
  const count = s => marks.filter(m => m.status === s).length;
  const total = questions.length, right = count('right');
  return { right, wrong: count('wrong'), blank: count('blank'), total, percent: total ? Math.round((100 * right) / total) : 0, marks };
}
