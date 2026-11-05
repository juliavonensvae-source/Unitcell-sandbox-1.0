/* Crystallography: the question types written in code, one file per topic.
   The wording of every question is in challenge_templates/crystallography/. */
import { types as bravais3d } from './bravais3d.js';
import { types as bravais2d } from './bravais2d.js';
import { types as planes } from './planes.js';
import { types as directions } from './directions.js';
import { types as relations } from './relations.js';
import { types as spacing } from './spacing.js';
import { types as hexagonal } from './hexagonal.js';

const parts = [bravais3d, bravais2d, planes, directions, relations, spacing, hexagonal];

/** Every question type: { 'intercepts-to-hkl': { levels, format, words, make }, … } */
export const types = {};
for (const part of parts) {
  for (const [name, def] of Object.entries(part)) {
    if (types[name]) throw new Error(`Challenge: the question type ${name} is defined twice`);
    types[name] = def;
  }
}
