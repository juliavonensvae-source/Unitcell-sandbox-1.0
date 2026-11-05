/* =====================================================================
   Close-packed stackings: ABAB… (HCP) and ABCABC… (FCC).

   Both are drawn with the same spheres, r = a/(2√2) of copper, so the two
   can be compared directly; the maths is in src/math/stacking.js. ABC can
   be shown on hexagonal axes (layers flat) or in the cubic F cell (layers
   along the body diagonal [111]).
   ===================================================================== */
import { MATERIALS } from './materials.js';
import { txt } from '../text.js';

/** Sphere radius in Å: half the nearest-neighbour distance in copper. */
export const SPHERE_R = MATERIALS.find(m => m.id === 'cu').params.a / (2 * Math.SQRT2);

/** Fixed colours of the three layer positions. */
export const LAYER_COLOURS = { A: '#F08A3C', B: '#3E8EF0', C: '#1FAF8A' };

export const STACKINGS = [
  {
    id: 'AB', seq: 'AB', structure: txt('stackStructureAB'), short: 'HCP',
    examples: txt('stackExamplesAB'), how: txt('stackHowAB'), views: ['hex'],
  },
  {
    id: 'ABC', seq: 'ABC', structure: txt('stackStructureABC'), short: 'FCC',
    examples: txt('stackExamplesABC'), how: txt('stackHowABC'), views: ['hex', 'cubic'],
  },
];

/** What Stacking(…) accepts: → { id, view } or null. */
const ALIASES = {
  ab: { id: 'AB', view: 'hex' }, abab: { id: 'AB', view: 'hex' }, hcp: { id: 'AB', view: 'hex' },
  abc: { id: 'ABC', view: 'hex' }, abcabc: { id: 'ABC', view: 'hex' },
  fcc: { id: 'ABC', view: 'cubic' }, ccp: { id: 'ABC', view: 'cubic' }, cubic: { id: 'ABC', view: 'cubic' },
};

export function parseStacking(name) {
  return ALIASES[String(name ?? '').toLowerCase().replace(/[\s_.…-]/g, '')] || null;
}

export const findStacking = id => STACKINGS.find(s => s.id === id) || null;
