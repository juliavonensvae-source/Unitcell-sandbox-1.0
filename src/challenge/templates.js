/* =====================================================================
   Challenge mode: reading the template files in challenge_templates/.
   The format is explained at the top of every template file and in
   challenge_templates/README.md. In short:

     # a comment                   (only at the start of a line)
     [question]                    a block; the other blocks are [subject],
     type: intercepts-to-hkl         [topic], [fixed] and [words]
     level: medium, hard
     text: A plane cuts the axes at {x}, {y}, {z}.
       An indented line continues the line above it.
     explain: …

   Problems (an unknown key, a block without text, …) are collected in
   `errors`; the tests fail on them and the browser console shows them.
   ===================================================================== */

export const LEVELS = ['easy', 'medium', 'hard'];

const KEYS = {
  subject: ['name', 'easy', 'medium', 'hard'],
  topic: ['name'],
  question: ['type', 'level', 'text', 'explain'],
  fixed: ['level', 'text', 'answer', 'wrong', 'explain', 'negative-ok'],
  words: null, // any key
};

/** "easy, medium" → ['easy', 'medium']; "all" or nothing → every level. */
function parseLevels(value, where, errors) {
  if (value == null || /^\s*all\s*$/i.test(value)) return [...LEVELS];
  const out = value.toLowerCase().split(/[\s,;]+/).filter(Boolean);
  const bad = out.filter(l => !LEVELS.includes(l));
  if (bad.length) errors.push(`${where}: unknown level "${bad.join(', ')}" (use easy, medium, hard or all)`);
  return out.filter(l => LEVELS.includes(l));
}

/**
 * One template file → { subject, topic, questions, fixed, words, errors }.
 * `name` is used in error messages (e.g. "crystallography/c-planes.txt").
 */
export function parseTemplateFile(src, name = 'template') {
  const errors = [];
  const blocks = [];
  let block = null, lastKey = null;

  String(src).replace(/^﻿/, '').split(/\r?\n/).forEach((raw, i) => {
    const line = i + 1, where = `${name} line ${line}`;
    if (!raw.trim() || raw.trim().startsWith('#')) return;
    const head = /^\s*\[([a-z]+)\]\s*$/i.exec(raw);
    if (head) {
      const kind = head[1].toLowerCase();
      if (!(kind in KEYS)) { errors.push(`${where}: unknown block [${head[1]}] (use [subject], [topic], [question], [fixed] or [words])`); block = null; return; }
      block = { kind, line, values: {} };
      blocks.push(block);
      lastKey = null;
      return;
    }
    // an indented line continues the value above it
    if (/^\s/.test(raw) && block && lastKey) {
      block.values[lastKey] = `${block.values[lastKey]} ${raw.trim()}`.trim();
      return;
    }
    const kv = /^([A-Za-z][A-Za-z0-9-]*)\s*:(.*)$/.exec(raw.trim());
    if (!kv) { errors.push(`${where}: expected "name: value", a [block] or a # comment`); return; }
    if (!block) { errors.push(`${where}: "${kv[1]}" comes before any [block]`); return; }
    // word names keep their capitals (points-P); the other keys may be written in any case
    const key = block.kind === 'words' ? kv[1] : kv[1].toLowerCase(), allowed = KEYS[block.kind];
    if (allowed && !allowed.includes(key)) { errors.push(`${where}: [${block.kind}] has no "${kv[1]}" (allowed: ${allowed.join(', ')})`); return; }
    if (key in block.values) { errors.push(`${where}: "${kv[1]}" appears twice in this block`); return; }
    block.values[key] = kv[2].trim();
    lastKey = key;
  });

  const out = { subject: null, topic: null, questions: [], fixed: [], words: {}, errors };
  for (const b of blocks) {
    const v = b.values, where = `${name} line ${b.line}`;
    if (b.kind === 'subject' || b.kind === 'topic') {
      if (!v.name) errors.push(`${where}: [${b.kind}] needs a name`);
      else if (out[b.kind]) errors.push(`${where}: only one [${b.kind}] block per file`);
      else out[b.kind] = b.kind === 'subject' ? { name: v.name, levels: { easy: v.easy || '', medium: v.medium || '', hard: v.hard || '' } } : { name: v.name };
    } else if (b.kind === 'words') {
      for (const [k, w] of Object.entries(v)) {
        if (k in out.words) errors.push(`${where}: the word "${k}" is defined twice`);
        else out.words[k] = w;
      }
    } else if (b.kind === 'question') {
      if (!v.type) { errors.push(`${where}: [question] needs a type`); continue; }
      if (!v.text) { errors.push(`${where}: [question] needs a text`); continue; }
      out.questions.push({ type: v.type, levels: parseLevels(v.level, where, errors), text: v.text, explain: v.explain || '', where });
    } else if (b.kind === 'fixed') {
      if (!v.text || !v.answer) { errors.push(`${where}: [fixed] needs a text and an answer`); continue; }
      const wrong = v.wrong ? v.wrong.split('|').map(s => s.trim()).filter(Boolean) : [];
      if (v.wrong != null && wrong.length !== 3) { errors.push(`${where}: "wrong" needs exactly 3 options separated by |`); continue; }
      out.fixed.push({
        levels: parseLevels(v.level, where, errors), text: v.text, answer: v.answer, wrong, explain: v.explain || '',
        negativeOk: /^(yes|true|1)$/i.test(v['negative-ok'] || ''), where,
      });
    }
  }
  return out;
}

/**
 * Every template file → subjects with their topics, sorted by file name.
 * files: { 'path/to/challenge_templates/<subject>/<topic>.txt': source }
 * codeTypes: { <subject>: { <type>: generator } } (the question types written in code)
 * → { subjects: [{ id, name, levels: { easy, medium, hard }, topics: [{ id, name, questions, fixed, words }] }], errors }
 */
export function buildSubjects(files, codeTypes = {}) {
  const errors = [], bySubject = new Map();
  for (const path of Object.keys(files).sort()) {
    const m = /([^/\\]+)[/\\]([^/\\]+)\.txt$/.exec(path);
    if (!m) continue;
    const [, subjectId, fileId] = m, name = `${subjectId}/${fileId}.txt`;
    const parsed = parseTemplateFile(files[path], name);
    errors.push(...parsed.errors);
    if (!bySubject.has(subjectId)) bySubject.set(subjectId, { id: subjectId, name: null, levels: {}, topics: [] });
    const subject = bySubject.get(subjectId);
    if (parsed.subject) Object.assign(subject, parsed.subject);
    if (fileId.startsWith('_')) continue; // _subject.txt holds only the subject's name
    if (!parsed.topic) { errors.push(`${name}: needs a [topic] block with the topic's name`); continue; }
    const types = codeTypes[subjectId] || {};
    const questions = parsed.questions.filter(q => {
      if (types[q.type]) return true;
      errors.push(`${q.where}: there is no question type "${q.type}" for ${subjectId} (see the list at the top of the file)`);
      return false;
    });
    subject.topics.push({ id: fileId, name: parsed.topic.name, questions, fixed: parsed.fixed, words: parsed.words });
  }
  const subjects = [...bySubject.values()].filter(s => {
    if (!s.name) errors.push(`${s.id}: needs a _subject.txt with a [subject] block and its name`);
    return s.name && s.topics.length;
  });
  return { subjects, errors };
}
