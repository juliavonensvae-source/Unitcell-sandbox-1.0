/* The 2D view's interface parts: lattice thumbnail and picker.
   Kept separate from the 3D workspace so the 2D mode can grow on its own. */
import { Lattice2D } from '../../math/lattice2d.js';
import { BRAVAIS_2D, SYSTEMS_2D, SYSTEM_ORDER_2D, basis2D } from '../../data/bravais2d.js';
import { flatThumbnail } from '../../render/thumbnail.js';
import { pickerPopover } from './lattice-picker.js';
import { helpButton } from '../controls.js';
import { txt } from '../../text.js';

export const flatThumb = (b, size = 72) => flatThumbnail(new Lattice2D(b.params), basis2D(b), { size });

export const createFlatPicker = (ws, anchor) => pickerPopover({
  anchor,
  label: txt('picker2DTitle'),
  head: `<span class="menu-title">${txt('picker2DTitle')}${helpButton('lattices-2d')}</span>
      <span class="menu-sub">${txt('picker2DSub')}</span>`,
  attr: 'lattice2',
  pick: id => ws.setFlatLattice(id),
  groups: () => {
    const cur = ws.state.flat.latticeId;
    return SYSTEM_ORDER_2D.map(sys => {
      const list = BRAVAIS_2D.filter(b => b.system === sys);
      return {
        current: list.some(b => b.id === cur),
        label: SYSTEMS_2D[sys].label,
        rule: SYSTEMS_2D[sys].rule,
        blurb: SYSTEMS_2D[sys].blurb,
        lattices: list.map(b => ({
          id: b.id, name: b.name, centring: b.centring, current: b.id === cur, thumb: flatThumb(b, 76),
          meta: b.centring === 'c' ? txt('picker2DCentred') : txt('picker2DPrimitive'), points: b.centring === 'c' ? 2 : 1,
        })),
      };
    });
  },
});
