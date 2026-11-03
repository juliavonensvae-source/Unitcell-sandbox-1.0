/* Lattice pickers: lattices grouped by crystal system, with thumbnails. The 3D one is here, the 2D one in flat.js. */
import { Popover } from '../components/popover.js';
import { BRAVAIS, findBravais, latticeBasis, defaultSetting, defaultParams } from '../../data/bravais.js';
import { SYSTEMS, SYSTEM_ORDER, CENTRING_INFO } from '../../data/systems.js';
import { countAtoms } from '../../math/basis.js';
import { latticeThumbnail } from '../../render/thumbnail.js';
import { SYSTEM_BLURBS } from '../../help/content.js';
import { icon } from '../icons.js';
import { helpButton } from '../controls.js';
import { txt } from '../../text.js';

export function tileThumb(b, size = 76) {
  const setting = defaultSetting(b);
  return latticeThumbnail(defaultParams(b, setting), latticeBasis(b, setting), { size });
}

/**
 * A lattice picker popover: one collapsible group per crystal system, with a tile per lattice.
 * groups() → [{ current, label, rule, blurb, lattices: [{ id, name, centring, current, thumb, meta, points }] }]
 * attr names the tiles' data attribute (data-<attr>="<id>"); a click on a tile closes the picker and calls pick(id).
 * badgeTitles gives the centring badges in a group's header the lattice name as a tooltip.
 */
export function pickerPopover({ anchor, label, head, groups, attr, pick, badgeTitles = false }) {
  const tile = b => `<button type="button" class="tile${b.current ? ' is-current' : ''}" data-${attr}="${b.id}" aria-pressed="${b.current}">
      <span class="tile-thumb">${b.thumb}</span>
      <span class="tile-name">${b.name}</span>
      <span class="tile-meta"><span class="cbadge">${b.centring}</span>${b.meta}</span>
      <span class="tile-points">${txt(b.points === 1 ? 'pickerPointsOne' : 'pickerPointsMany', { count: b.points })}</span>
    </button>`;
  const badge = b => `<span class="cbadge${b.current ? ' is-current' : ''}"${badgeTitles ? ` title="${b.name}"` : ''}>${b.centring}</span>`;
  // a single group (Defects mode: cubic only) starts open, there is nothing else to choose between
  const render = () => `<div class="menu-head">${head}</div>
      <div class="picker-systems">${groups().map((g, i, all) => `<details class="sys${g.current ? ' is-current' : ''}"${all.length === 1 ? ' open' : ''}>
        <summary>
          <span class="sys-text"><b>${g.label}</b><small>${g.rule}</small></span>
          <span class="sys-badges">${g.lattices.map(badge).join('')}</span>
          <span class="cat-chev">${icon('chevronDown')}</span>
        </summary>
        <p class="sys-blurb">${g.blurb}</p>
        <div class="tiles">${g.lattices.map(tile).join('')}</div>
      </details>`).join('')}</div>`;
  return new Popover({ anchor, className: 'picker', label, render, onClick: { [`[data-${attr}]`]: t => pick(t.dataset[attr]) } });
}

export const createLatticePicker = (ws, anchor) => pickerPopover({
  anchor,
  label: txt('topPickerTitle'),
  head: `<span class="menu-title">${txt('topPickerTitle')}${helpButton('bravais')}</span>
      <span class="menu-sub">${txt('pickerSub', { helpSystems: helpButton('crystal-systems'), helpCentring: helpButton('centring') })}</span>`,
  attr: 'lattice',
  badgeTitles: true,
  pick: id => ws.setLattice(id),
  groups: () => {
    const cur = ws.state.latticeId, curSys = findBravais(cur).system;
    // Defects mode works with the cubic lattices only
    return SYSTEM_ORDER.filter(sys => !ws.isDefects() || sys === 'cubic').map(sys => ({
      current: sys === curSys,
      label: `${SYSTEMS[sys].label}${helpButton('crystal-systems', { arg: sys })}`,
      rule: SYSTEMS[sys].rule,
      blurb: SYSTEM_BLURBS[sys],
      lattices: BRAVAIS.filter(b => b.system === sys).map(b => ({
        id: b.id, name: b.name, centring: b.centring, current: b.id === cur, thumb: tileThumb(b),
        meta: CENTRING_INFO[b.centring].name, points: countAtoms(latticeBasis(b, defaultSetting(b))).total,
      })),
    }));
  },
});
