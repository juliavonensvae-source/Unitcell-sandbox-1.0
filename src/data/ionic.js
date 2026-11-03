/* =====================================================================
   Ionic structures (Part 4.5): a Bravais lattice plus a basis of ions.

   Each structure names its Bravais lattice and the ions of its basis in
   fractional coordinates; the basis is copied to every lattice point by
   the centring (src/math/ionic.js). The lattice parameter a and the ion
   radii, masses and colours come from the shelved materials file.

   The anion sits on the lattice points where that is the usual picture
   (NaCl, CsCl, ZnS: the anions form the lattice and the cations fill
   holes in it); in fluorite the cation does. The radii are Shannon ionic
   radii in Å, so their ratios are realistic; the user can change them.
   ===================================================================== */
import { ELEMENTS, MATERIALS } from './materials.js';
import { txt } from '../text.js';

const aOf = id => MATERIALS.find(m => m.id === id).params.a;
const ion = (el, charge, f) => ({ el, charge, f });

export const IONIC = [
  {
    id: 'NaCl', name: txt('ionicNameNaCl'), formula: 'NaCl', lattice: 'cF', a: aOf('nacl'), spaceGroup: 'Fm-3m',
    ions: [ion('Cl', '−', [0, 0, 0]), ion('Na', '+', [0.5, 0.5, 0.5])],
    holes: txt('ionicHolesNaCl'),
    others: txt('ionicOthersNaCl'),
  },
  {
    id: 'CsCl', name: txt('ionicNameCsCl'), formula: 'CsCl', lattice: 'cP', a: aOf('cscl'), spaceGroup: 'Pm-3m',
    ions: [ion('Cl', '−', [0, 0, 0]), ion('Cs', '+', [0.5, 0.5, 0.5])],
    holes: txt('ionicHolesCsCl'),
    others: txt('ionicOthersCsCl'),
  },
  {
    id: 'ZnS', name: txt('ionicNameZnS'), formula: 'ZnS', lattice: 'cF', a: aOf('zns'), spaceGroup: 'F-43m',
    ions: [ion('S', '2−', [0, 0, 0]), ion('Zn', '2+', [0.25, 0.25, 0.25])],
    holes: txt('ionicHolesZnS'),
    others: txt('ionicOthersZnS'),
  },
  {
    id: 'CaF2', name: txt('ionicNameCaF2'), formula: 'CaF₂', lattice: 'cF', a: aOf('caf2'), spaceGroup: 'Fm-3m',
    ions: [ion('Ca', '2+', [0, 0, 0]), ion('F', '−', [0.25, 0.25, 0.25]), ion('F', '−', [0.75, 0.75, 0.75])],
    holes: txt('ionicHolesCaF2'),
    others: txt('ionicOthersCaF2'),
  },
];

const ALIASES = {
  nacl: 'NaCl', rocksalt: 'NaCl', halite: 'NaCl',
  cscl: 'CsCl', caesiumchloride: 'CsCl', cesiumchloride: 'CsCl',
  zns: 'ZnS', zincblende: 'ZnS', sphalerite: 'ZnS',
  caf2: 'CaF2', fluorite: 'CaF2',
};

/** A structure by id or a common name ("NaCl", "rock salt", "zinc blende", "fluorite" …), or null. */
export function findIonic(name) {
  const id = ALIASES[String(name ?? '').toLowerCase().replace(/[\s_-]/g, '').replace('₂', '2')];
  return id ? IONIC.find(s => s.id === id) : null;
}

const SUP = { '+': '⁺', '−': '⁻', '2+': '²⁺', '2−': '²⁻' };
/** "Na⁺", "S²⁻" … the ion with its charge. */
export const ionText = (el, charge) => `${el}${SUP[charge] || ''}`;
/** The same with HTML superscripts: Na<sup>+</sup>. */
export const ionHTML = (el, charge) => `${el}<sup>${charge}</sup>`;
/** TeX: \mathrm{Na^{+}} */
export const ionTeX = (el, charge) => `\\mathrm{${el}^{${charge.replace('−', '-')}}}`;

/** Default radius (Å), colour and molar mass of an element. */
export const ELEMENT = el => ELEMENTS[el];
