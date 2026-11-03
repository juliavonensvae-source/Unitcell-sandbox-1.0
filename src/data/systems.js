/* Crystal systems and centring types. */

import { txt } from '../text.js';
export const SYSTEM_ORDER = ['cubic', 'tetragonal', 'orthorhombic', 'hexagonal', 'rhombohedral', 'monoclinic', 'triclinic'];

/** Which parameters are free in each system, and how the rest follow from them. */
export const SYSTEMS = {
  cubic: {
    label: txt('systemCubic'), editable: ['a'], tied: { b: 'a', c: 'a' },
    rule: txt('ruleCubic'),
    derive: q => ({ a: q.a, b: q.a, c: q.a, alpha: 90, beta: 90, gamma: 90 }),
  },
  tetragonal: {
    label: txt('systemTetragonal'), editable: ['a', 'c'], tied: { b: 'a' },
    rule: txt('ruleTetragonal'),
    derive: q => ({ a: q.a, b: q.a, c: q.c, alpha: 90, beta: 90, gamma: 90 }),
  },
  orthorhombic: {
    label: txt('systemOrthorhombic'), editable: ['a', 'b', 'c'], tied: {},
    rule: txt('ruleOrthorhombic'),
    derive: q => ({ a: q.a, b: q.b, c: q.c, alpha: 90, beta: 90, gamma: 90 }),
  },
  hexagonal: {
    label: txt('systemHexagonal'), editable: ['a', 'c'], tied: { b: 'a' },
    rule: txt('ruleHexagonal'),
    derive: q => ({ a: q.a, b: q.a, c: q.c, alpha: 90, beta: 90, gamma: 120 }),
  },
  rhombohedral: {
    label: txt('systemRhombohedral'), editable: ['a', 'alpha'], tied: { b: 'a', c: 'a', beta: 'α', gamma: 'α' },
    rule: txt('ruleRhombohedral'),
    derive: q => ({ a: q.a, b: q.a, c: q.a, alpha: q.alpha, beta: q.alpha, gamma: q.alpha }),
  },
  monoclinic: {
    label: txt('systemMonoclinic'), editable: ['a', 'b', 'c', 'beta'], tied: {},
    rule: txt('ruleMonoclinic'),
    derive: q => ({ a: q.a, b: q.b, c: q.c, alpha: 90, beta: q.beta, gamma: 90 }),
  },
  triclinic: {
    label: txt('systemTriclinic'), editable: ['a', 'b', 'c', 'alpha', 'beta', 'gamma'], tied: {},
    rule: txt('ruleTriclinic'),
    derive: q => ({ ...q }),
  },
};

/** Centring translations in fractional coordinates. R is the obverse setting on hexagonal axes. */
export const CENTRING = {
  P: [[0, 0, 0]],
  I: [[0, 0, 0], [0.5, 0.5, 0.5]],
  C: [[0, 0, 0], [0.5, 0.5, 0]],
  F: [[0, 0, 0], [0, 0.5, 0.5], [0.5, 0, 0.5], [0.5, 0.5, 0]],
  R: [[0, 0, 0], [2 / 3, 1 / 3, 1 / 3], [1 / 3, 2 / 3, 2 / 3]],
};

export const CENTRING_INFO = {
  P: { name: txt('centringP'), short: 'P' },
  I: { name: txt('centringI'), short: 'I' },
  F: { name: txt('centringF'), short: 'F' },
  C: { name: txt('centringC'), short: 'C' },
  R: { name: txt('centringR'), short: 'R' },
};
