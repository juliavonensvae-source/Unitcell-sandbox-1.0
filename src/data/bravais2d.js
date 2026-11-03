/* The five two-dimensional Bravais lattices, grouped in four 2D crystal systems. */
import { CENTRING_2D, Lattice2D, sitesInCell2D, nearestNeighbour2D, pointCount2D } from '../math/lattice2d.js';
import { txt } from '../text.js';

export const SYSTEM_ORDER_2D = ['oblique', 'rectangular', 'square', 'hexagonal'];

export const SYSTEMS_2D = {
  oblique: {
    label: txt('system2DOblique'), rule: txt('rule2DOblique'), editable: ['a', 'b', 'gamma'], tied: {},
    blurb: txt('blurb2DOblique'),
    derive: q => ({ a: q.a, b: q.b, gamma: q.gamma }),
  },
  rectangular: {
    label: txt('system2DRectangular'), rule: txt('rule2DRectangular'), editable: ['a', 'b'], tied: {},
    blurb: txt('blurb2DRectangular'),
    derive: q => ({ a: q.a, b: q.b, gamma: 90 }),
  },
  square: {
    label: txt('system2DSquare'), rule: txt('rule2DSquare'), editable: ['a'], tied: { b: 'a' },
    blurb: txt('blurb2DSquare'),
    derive: q => ({ a: q.a, b: q.a, gamma: 90 }),
  },
  hexagonal: {
    label: txt('system2DHexagonal'), rule: txt('rule2DHexagonal'), editable: ['a'], tied: { b: 'a' },
    blurb: txt('blurb2DHexagonal'),
    derive: q => ({ a: q.a, b: q.a, gamma: 120 }),
  },
};

export const BRAVAIS_2D = [
  { id: 'mp', name: txt('lattice2DMP'), longName: txt('lattice2DMPLong'), system: 'oblique', centring: 'p', params: { a: 3, b: 3.8, gamma: 105 } },
  { id: 'op', name: txt('lattice2DOP'), longName: txt('lattice2DOPLong'), system: 'rectangular', centring: 'p', params: { a: 3, b: 4.5, gamma: 90 } },
  { id: 'oc', name: txt('lattice2DOC'), longName: txt('lattice2DOC'), system: 'rectangular', centring: 'c', params: { a: 3, b: 4.5, gamma: 90 } },
  { id: 'tp', name: txt('lattice2DTP'), longName: txt('lattice2DTPLong'), system: 'square', centring: 'p', params: { a: 3.5, b: 3.5, gamma: 90 } },
  { id: 'hp', name: txt('lattice2DHP'), longName: txt('lattice2DHPLong'), system: 'hexagonal', centring: 'p', params: { a: 3.5, b: 3.5, gamma: 120 } },
];

export const findBravais2D = id => BRAVAIS_2D.find(b => b.id === id);
export const basis2D = b => CENTRING_2D[b.centring];

export const defaultFlatState = () => {
  const b = findBravais2D('tp');
  return { latticeId: b.id, params: { ...b.params }, n: 1, cell: [1, 1], corner: [0, 0] };
};

/** Everything the 2D view needs, derived from the 2D state (fs.cell is already inside the n × n block). */
export function flatContext(fs) {
  const b = findBravais2D(fs.latticeId), basis = basis2D(b);
  const lattice = new Lattice2D(fs.params);
  // the highlighted cell (from 1) and the origin at one of its corners, as in 3D
  const cellOrigin = fs.cell.map(i => i - 1), origin = cellOrigin.map((x, i) => x + fs.corner[i]);
  return {
    bravais: b, system: SYSTEMS_2D[b.system], basis, lattice, n: fs.n, cell: fs.cell, corner: fs.corner, cellOrigin, origin,
    sites: sitesInCell2D(basis, fs.n, cellOrigin),
    dnn: nearestNeighbour2D(lattice, basis),
    count: pointCount2D(basis, 1),
  };
}
