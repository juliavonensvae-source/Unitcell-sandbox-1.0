/* =====================================================================
   REAL MATERIALS — kept from stage 1.

   Part 4.5 uses this file again for the ionic structures
   (src/data/ionic.js reads ELEMENTS for the ion radii, masses and colours
   and the lattice parameter a of NaCl, CsCl, ZnS and CaF2). The materials
   themselves are still not shown in the app. Each material is lattice
   parameters + a motif in fractional coordinates, expanded by its centring
   with expandBasis(). The math functions density(), formulaUnits() and
   structureFactor() in src/math accept an `elements` table like ELEMENTS.
   ===================================================================== */
import { expandBasis } from '../math/basis.js';
import { CENTRING } from './systems.js';

/** mass in g/mol, Z for scattering, r = display radius in Å (ionic for compound use), colour */
export const ELEMENTS = {
  Cu: { name: 'Copper',     mass: 63.546,  Z: 29, r: 1.28,  colour: '#C67A3C' },
  Fe: { name: 'Iron',       mass: 55.845,  Z: 26, r: 1.26,  colour: '#B8573F' },
  Mg: { name: 'Magnesium',  mass: 24.305,  Z: 12, r: 1.60,  colour: '#6DAE45' },
  Na: { name: 'Sodium',     mass: 22.990,  Z: 11, r: 1.02,  colour: '#9B62E0' },
  Cl: { name: 'Chlorine',   mass: 35.45,   Z: 17, r: 1.81,  colour: '#3BAF55' },
  Cs: { name: 'Caesium',    mass: 132.905, Z: 55, r: 1.74,  colour: '#7547B0' },
  Si: { name: 'Silicon',    mass: 28.086,  Z: 14, r: 1.11,  colour: '#D3A15C' },
  Zn: { name: 'Zinc',       mass: 65.38,   Z: 30, r: 0.60,  colour: '#7C86C2' },
  S:  { name: 'Sulfur',     mass: 32.06,   Z: 16, r: 1.84,  colour: '#E0BE2C' },
  Sr: { name: 'Strontium',  mass: 87.62,   Z: 38, r: 1.44,  colour: '#2E9C8C' },
  Ti: { name: 'Titanium',   mass: 47.867,  Z: 22, r: 0.605, colour: '#A3ABB7' },
  O:  { name: 'Oxygen',     mass: 15.999,  Z: 8,  r: 1.40,  colour: '#E04848' },
  Ca: { name: 'Calcium',    mass: 40.078,  Z: 20, r: 1.12,  colour: '#E0862C' },
  F:  { name: 'Fluorine',   mass: 18.998,  Z: 9,  r: 1.31,  colour: '#7DC94B' },
};

const motif = rows => rows.map(([el, x, y, z]) => ({ el, f: [x, y, z] }));
const cubic = a => ({ a, b: a, c: a, alpha: 90, beta: 90, gamma: 90 });
const material = (id, name, system, pearson, spaceGroup, params, rows, centring, desc) => ({
  id, name, kind: 'material', system, pearson, spaceGroup, params, desc,
  basis: expandBasis(motif(rows), CENTRING[centring]),
});

export const MATERIALS = [
  material('cu', 'Copper — FCC', 'cubic', 'cF4', 'Fm-3m', cubic(3.615), [['Cu', 0, 0, 0]], 'F',
    'Face-centred cubic metal: atoms on the corners and face centres.'),
  material('fe', 'α-Iron — BCC', 'cubic', 'cI2', 'Im-3m', cubic(2.87), [['Fe', 0, 0, 0]], 'I',
    'Body-centred cubic ferrite at room temperature.'),
  material('mg', 'Magnesium — HCP', 'hexagonal', 'hP2', 'P6_3/mmc', { a: 3.21, b: 3.21, c: 5.21, alpha: 90, beta: 90, gamma: 120 },
    [['Mg', 0, 0, 0], ['Mg', 1 / 3, 2 / 3, 1 / 2]], 'P',
    'Hexagonal close-packed, c/a = 1.623 (ideal 1.633). Origin on an atom, second atom at (⅓, ⅔, ½).'),
  material('nacl', 'Rock salt — NaCl', 'cubic', 'cF8', 'Fm-3m', cubic(5.64), [['Na', 0, 0, 0], ['Cl', 0.5, 0, 0]], 'F',
    'Two interpenetrating FCC sublattices; every ion is octahedrally coordinated.'),
  material('cscl', 'Caesium chloride — CsCl', 'cubic', 'cP2', 'Pm-3m', cubic(4.12), [['Cs', 0, 0, 0], ['Cl', 0.5, 0.5, 0.5]], 'P',
    'Simple cubic with a two-atom basis; looks BCC but is primitive.'),
  material('si', 'Silicon — diamond', 'cubic', 'cF8', 'Fd-3m', cubic(5.431), [['Si', 0, 0, 0], ['Si', 0.25, 0.25, 0.25]], 'F',
    'FCC lattice with a two-atom basis at (0,0,0) and (¼,¼,¼); tetrahedral bonding.'),
  material('zns', 'Zinc blende — ZnS', 'cubic', 'cF8', 'F-43m', cubic(5.41), [['S', 0, 0, 0], ['Zn', 0.25, 0.25, 0.25]], 'F',
    'Diamond arrangement with alternating Zn and S; no inversion centre.'),
  material('caf2', 'Fluorite — CaF2', 'cubic', 'cF12', 'Fm-3m', cubic(5.463), [['Ca', 0, 0, 0], ['F', 0.25, 0.25, 0.25], ['F', 0.75, 0.75, 0.75]], 'F',
    'Ca on the FCC lattice points, F in every tetrahedral hole.'),
  material('srtio3', 'Strontium titanate — perovskite', 'cubic', 'cP5', 'Pm-3m', cubic(3.905),
    [['Sr', 0, 0, 0], ['Ti', 0.5, 0.5, 0.5], ['O', 0.5, 0.5, 0], ['O', 0.5, 0, 0.5], ['O', 0, 0.5, 0.5]], 'P',
    'Cubic ABO₃ perovskite: TiO₆ octahedra sharing corners, Sr in the 12-fold cavities.'),
];

/* Stage 1 checks that used these materials (for when they are re-enabled):
   packing fraction diamond (Si) 0.340 · density Cu 8.93 g/cm³ · NaCl d(200) 2.82 Å ·
   atoms per cell diamond 8, perovskite 5 · coordination diamond 4, CsCl 8, HCP 12 ·
   diamond (200) systematically absent. */
