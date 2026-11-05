/* =====================================================================
   Challenge mode: the subjects. Each subject is a folder in
   challenge_templates/ (the wording, editable without code) and, for
   questions with random numbers, a folder in src/challenge/subjects/
   with the same name whose index.js exports its question `types`.
   Both folders are found automatically: adding a subject needs no
   change here. See challenge_templates/README.md.
   ===================================================================== */
import { buildSubjects } from './templates.js';

const FILES = import.meta.glob('/challenge_templates/*/*.txt', { query: '?raw', import: 'default', eager: true });
const CODE = import.meta.glob('./subjects/*/index.js', { eager: true });

/** { <subject folder>: { <type>: generator } } */
const codeTypes = {};
for (const [path, mod] of Object.entries(CODE)) {
  const id = /subjects\/([^/]+)\/index\.js$/.exec(path)[1];
  codeTypes[id] = mod.types || {};
}

const built = buildSubjects(FILES, codeTypes);

/** Problems in the template files (an unknown key, a misspelt type, …); the tests fail on them. */
export const TEMPLATE_ERRORS = built.errors;
if (TEMPLATE_ERRORS.length && import.meta.env.MODE !== 'test') {
  for (const e of TEMPLATE_ERRORS) console.error(`Challenge templates: ${e}`);
}

/** [{ id, name, types, topics: [{ id, name, questions, fixed, words }] }], in folder order. */
export const SUBJECTS = built.subjects.map(s => ({ ...s, types: codeTypes[s.id] || {} }));

export const findSubject = id => SUBJECTS.find(s => s.id === id);

/** Every question type of every subject, for the tests. */
export const CODE_TYPES = codeTypes;
