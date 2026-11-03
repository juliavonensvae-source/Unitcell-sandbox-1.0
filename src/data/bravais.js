/* The 14 Bravais lattices. Each one = crystal system + centring + default parameters.
   The basis is a single lattice point ('LP') expanded by the centring translations. */
import { expandBasis } from '../math/basis.js';
import { rhombohedralToHexagonal } from '../math/lattice.js';
import { CENTRING } from './systems.js';
import { txt } from '../text.js';

const cubic = a => ({ a, b: a, c: a, alpha: 90, beta: 90, gamma: 90 });
const tetra = (a, c) => ({ a, b: a, c, alpha: 90, beta: 90, gamma: 90 });
const ortho = (a, b, c) => ({ a, b, c, alpha: 90, beta: 90, gamma: 90 });

export const BRAVAIS = [
  { id: 'cP', name: txt('latticeCP'), longName: txt('latticeCPLong'), system: 'cubic', centring: 'P', spaceGroup: 'Pm-3m', params: cubic(4) },
  { id: 'cI', name: txt('latticeCI'), longName: txt('latticeCILong'), system: 'cubic', centring: 'I', spaceGroup: 'Im-3m', params: cubic(4) },
  { id: 'cF', name: txt('latticeCF'), longName: txt('latticeCFLong'), system: 'cubic', centring: 'F', spaceGroup: 'Fm-3m', params: cubic(4) },
  { id: 'tP', name: txt('latticeTP'), longName: txt('latticeTPLong'), system: 'tetragonal', centring: 'P', spaceGroup: 'P4/mmm', params: tetra(3.6, 5.2) },
  { id: 'tI', name: txt('latticeTI'), longName: txt('latticeTILong'), system: 'tetragonal', centring: 'I', spaceGroup: 'I4/mmm', params: tetra(3.6, 5.2) },
  { id: 'oP', name: txt('latticeOP'), longName: txt('latticeOPLong'), system: 'orthorhombic', centring: 'P', spaceGroup: 'Pmmm', params: ortho(3.2, 4.1, 5.0) },
  { id: 'oC', name: txt('latticeOC'), longName: txt('latticeOCLong'), system: 'orthorhombic', centring: 'C', spaceGroup: 'Cmmm', params: ortho(3.2, 4.1, 5.0) },
  { id: 'oI', name: txt('latticeOI'), longName: txt('latticeOILong'), system: 'orthorhombic', centring: 'I', spaceGroup: 'Immm', params: ortho(3.2, 4.1, 5.0) },
  { id: 'oF', name: txt('latticeOF'), longName: txt('latticeOFLong'), system: 'orthorhombic', centring: 'F', spaceGroup: 'Fmmm', params: ortho(3.2, 4.1, 5.0) },
  { id: 'hP', name: txt('latticeHP'), longName: txt('latticeHPLong'), system: 'hexagonal', centring: 'P', spaceGroup: 'P6/mmm', params: { a: 3.5, b: 3.5, c: 5.6, alpha: 90, beta: 90, gamma: 120 } },
  { id: 'hR', name: txt('latticeHR'), longName: txt('latticeHRLong'), system: 'rhombohedral', centring: 'R', spaceGroup: 'R-3m', params: { a: 4.2, b: 4.2, c: 4.2, alpha: 70, beta: 70, gamma: 70 } },
  { id: 'mP', name: txt('latticeMP'), longName: txt('latticeMPLong'), system: 'monoclinic', centring: 'P', spaceGroup: 'P2/m', params: { a: 3.4, b: 4.2, c: 5.0, alpha: 90, beta: 108, gamma: 90 } },
  { id: 'mC', name: txt('latticeMC'), longName: txt('latticeMCLong'), system: 'monoclinic', centring: 'C', spaceGroup: 'C2/m', params: { a: 5.2, b: 3.6, c: 4.6, alpha: 90, beta: 106, gamma: 90 } },
  { id: 'aP', name: txt('latticeAP'), longName: txt('latticeAPLong'), system: 'triclinic', centring: 'P', spaceGroup: 'P-1', params: { a: 3.5, b: 4.2, c: 5.0, alpha: 82, beta: 97, gamma: 108 } },
];

export const findBravais = id => BRAVAIS.find(b => b.id === id);

/**
 * The rhombohedral lattice can be drawn on two sets of axes:
 * 'rhombohedral' — the primitive cell (a = b = c, α = β = γ), 1 point per cell;
 * 'hexagonal'    — a three-times-larger hexagonal cell with R-centring, 3 points per cell.
 * Every other lattice has a single setting, 'standard'.
 */
export const defaultSetting = b => (b.id === 'hR' ? 'rhombohedral' : 'standard');

/** Centring actually applied for a lattice in a given setting. */
export function effectiveCentring(b, setting) {
  if (b.id === 'hR') return setting === 'hexagonal' ? 'R' : 'P';
  return b.centring;
}

/** Rules (editable / tied parameters) for a lattice in a given setting. */
export function effectiveSystem(b, setting) {
  return b.id === 'hR' && setting === 'hexagonal' ? 'hexagonal' : b.system;
}

/** True when the cell uses hexagonal axes (a = b, γ = 120°), so Miller–Bravais indices apply. */
export const usesHexAxes = (b, setting) => effectiveSystem(b, setting) === 'hexagonal';

/** Default parameters of a lattice in a given setting. */
export function defaultParams(b, setting) {
  if (b.id === 'hR' && setting === 'hexagonal') return rhombohedralToHexagonal(b.params);
  return { ...b.params };
}

/** Lattice-point basis (fractional coordinates in [0, 1)) for a lattice in a given setting. */
export function latticeBasis(b, setting = defaultSetting(b)) {
  return expandBasis([{ el: 'LP', f: [0, 0, 0] }], CENTRING[effectiveCentring(b, setting)]);
}
