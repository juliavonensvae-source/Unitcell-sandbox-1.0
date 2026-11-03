/* =====================================================================
   Part 4: interstitial sites (cubic P, I and F). The atom-fit tool is atom-fit.js.

   - 'interstitials' (Sites()): the holes between the lattice spheres as
     small translucent markers, one colour per kind (octahedral,
     tetrahedral, cubic), each kind switchable. Optional: the polyhedron
     the neighbours form (around the selected site or every site), the
     largest sphere that fits instead of a marker, and labels with the
     share of each site that belongs to the cell. The card counts the
     sites per cell and per lattice point.

   All the numbers come from src/math/interstitials.js (sceneSites).
   Other lattices show "not available yet".
   ===================================================================== */
import { registerType } from './registry.js';
import { registerCommand } from './commands.js';
import * as M from '../math/index.js';
import { HELP } from '../help/content.js';
import { findBravais } from '../data/bravais.js';
import { sig, trim, fractionGlyph, countFormula, posText } from '../ui/format.js';
import { facts, formulaTex, note, toggle, segmented, actionButton, helpButton, appearanceShell, kindSwatches } from '../ui/controls.js';
import { icon } from '../ui/icons.js';
import { txt } from '../text.js';

const THEME_KEY = { oct: 'siteOct', tet: 'siteTet', cub: 'siteCub' };

/** The critical ratio of each site in closed form. */
export const CRIT_TEXT = { 'cP-cub': '√3 − 1', 'cI-oct': '2/√3 − 1', 'cI-tet': '√(5/3) − 1', 'cF-oct': '√2 − 1', 'cF-tet': '√(3/2) − 1' };

/** Help topic of one kind of site in the lattice on screen, e.g. 'site-cF-oct'. */
export const siteTopic = (ctx, kind) => `site-${ctx.bravais.id}-${kind}`;

/** Colour of a kind of site: the object's own choice, else the theme colour. */
export const kindColour = (ctx, kind, item = null) =>
  (item && item.colours && item.colours[kind]) || ctx.theme[THEME_KEY[kind]];

export const notAvailable = ctx =>
  txt('sitesNotAvailable', { lattice: ctx.bravais.name });

/* ---------- positions as text ---------- */
export const posKey = f => f.map(x => +x.toFixed(4)).join(',');
export const parsePos = s => String(s).split(',').map(Number);

/** Every position of one kind in the highlighted cell, relative to its origin: inside first, then faces, edges. */
export function cellPositions(site, ctx) {
  const O = ctx.cellOrigin;
  const rank = f => f.filter(x => Math.abs(x) < 1e-6 || Math.abs(x - 1) < 1e-6).length;
  return M.siteImages(site.sBasis, ctx.unitRegion).map(i => M.sub(i.f, O))
    .sort((a, b) => rank(a) - rank(b) || posKey(a).localeCompare(posKey(b)));
}

/** Size of a site marker: small, and never larger than the smallest hole. */
export const markerRadius = (ctx, sites) => Math.min(0.042 * ctx.L0, 0.7 * Math.min(...sites.map(s => s.rMax)));

/** The neighbours of a site as a polyhedron (faces), optional spokes, and dots for corners outside the drawn block. */
function polyPrims(ctx, site, fAbs, colour, opacity, { spokes = false } = {}) {
  const L = ctx.lattice, hosts = M.hostsAround(L, ctx.basis, fAbs, { n: site.cn });
  const pts = hosts.map(h => L.toCartesian(h.f)), c = L.toCartesian(fAbs);
  const out = M.polyhedronFaces(pts).map(face => ({ kind: 'polygon', points: face, colour, opacity: 0.04 + 0.14 * opacity }));
  if (spokes) out.push({ kind: 'tubes', segments: pts.map(p => [c, p]), radius: 0.007 * ctx.L0, colour, opacity: Math.max(0.5, opacity) });
  const outside = hosts.filter(h => !M.inRegion(h.f, ctx.region)).map(h => L.toCartesian(h.f));
  if (outside.length) {
    const pc = (ctx.pointStyle && ctx.pointStyle.colour) || '#5965F0';
    out.push({ kind: 'spheres', centres: outside, radius: Math.max(0.5 * ctx.pointRadius, 0.035 * ctx.L0), colour: pc, opacity: 0.45 });
  }
  return out;
}

/** Card content for lattices without interstitial sites (yet). */
export function unavailableHTML(ctx) {
  return note(txt('sitesSwitch', { notAvailable: notAvailable(ctx) }))
    + `<div class="btn-row">${['cP', 'cI', 'cF'].map(id => actionButton(`lat-${id}`, findBravais(id).name, 'cube')).join('')}</div>`;
}
export const onLatticeAction = (act, ws) => {
  if (!act.startsWith('lat-')) return false;
  ws.setLattice(act.slice(4));
  return true;
};

/** Hosts around a position, grouped by distance: [{ d, count }]. */
function shellsAround(ctx, site, fAbs) {
  const shells = [];
  for (const h of M.hostsAround(ctx.lattice, ctx.basis, fAbs, { n: site.cn })) {
    const last = shells[shells.length - 1];
    if (last && Math.abs(last.d - h.d) < 1e-6) last.count++;
    else shells.push({ d: h.d, count: 1 });
  }
  return shells;
}

/* =====================================================================
   Interstitial sites
   ===================================================================== */
registerType({
  type: 'interstitials',
  prefix: 'sites',
  title: txt('catSites'),
  icon: 'void',
  help: 'interstitials',
  appearance: 'eye', // each kind has its own colour (in the card's Appearance dropdown)
  defaultTransparency: 35,
  menu: [{
    key: 'interstitial-sites', category: 'interstitials', order: 10, title: txt('sitesMenu'), desc: HELP.interstitials,
    command: 'Sites()', unavailable: ctx => (M.sceneSites(ctx) ? null : notAvailable(ctx)),
  }],

  create(init, ctx) {
    const sites = M.sceneSites(ctx);
    return {
      show: { oct: true, tet: true, cub: true }, size: 'marker', poly: 'one', all: false, shares: false, colours: {},
      sel: sites ? { kind: sites[0].kind, f: [...sites[0].rep] } : null,
    };
  },

  /** The selected site must still be a site of the lattice on screen. */
  refresh(item, ctx) {
    const sites = M.sceneSites(ctx);
    if (!sites) return;
    const s = item.sel && sites.find(x => x.kind === item.sel.kind);
    if (!s || !M.isSiteOf(M.add(ctx.cellOrigin, item.sel.f), s.sBasis)) item.sel = { kind: sites[0].kind, f: [...sites[0].rep] };
  },

  definition: item => `${item.name} = Sites()`,
  autoLabel: () => txt('catSites'),

  summary(item, ctx) {
    const sites = M.sceneSites(ctx);
    if (!sites) return txt('sitesNotAvailableShort', { lattice: ctx.bravais.name });
    if (sites.length === 1) return txt('sitesSummaryCubic', { count: trim(sites[0].count.total) });
    return txt('sitesSummary', { list: sites.map(s => `${trim(s.count.total)} ${M.SITE_KINDS[s.kind].adjective}`).join(' + ') });
  },

  settings(item, ctx) {
    const sites = M.sceneSites(ctx);
    if (!sites) return unavailableHTML(ctx);
    const rows = sites.map(s => {
      const k = M.SITE_KINDS[s.kind], on = item.show[s.kind] !== false;
      return `<div class="site-row${on ? '' : ' is-off'}" style="--sc:${kindColour(ctx, s.kind, item)}">
        ${toggle(`show-${s.kind}`, on, `<span class="site-dot"></span>${txt('sitesRowLabel', { name: k.name })}${helpButton(siteTopic(ctx, s.kind), { item: item.id })}`,
          { hint: txt('sitesRowHint', { where: s.where, cn: s.cn, poly: k.poly }) })}
        ${facts([
          [`${txt('sitesPerCell')}${helpButton('site-count', { item: item.id })}`, `<b>${countFormula(s.count)}</b>`],
          [txt('sitesPerPoint'), `${trim(s.count.total)} / ${trim(s.N)} = <b>${trim(s.perPoint, 3)}</b>`],
          [txt('sitesLargest'), `<b>${s.ratio.toFixed(3)}</b> (${CRIT_TEXT[`${ctx.bravais.id}-${s.kind}`]})`],
        ])}
      </div>`;
    }).join('');

    // the selected site: picker and what surrounds it
    const sel = sites.find(s => s.kind === item.sel.kind);
    const options = sites.flatMap(s => cellPositions(s, ctx).map(f => {
      const v = `${s.kind}|${posKey(f)}`;
      return `<option value="${v}"${v === `${item.sel.kind}|${posKey(item.sel.f)}` ? ' selected' : ''}>${M.SITE_KINDS[s.kind].name} ${posText(f)} · ${M.sitePlace(f)}</option>`;
    })).join('');
    const shells = shellsAround(ctx, sel, M.add(ctx.cellOrigin, item.sel.f));
    const k = M.SITE_KINDS[sel.kind];
    const shellText = shells.map(sh => txt(sh.count === 1 ? 'sitesNeighbourOne' : 'sitesNeighbourMany', { count: sh.count, d: sig(sh.d) })).join(` ${txt('wordAnd')} `);
    const around = txt(sel.kind === 'oct' ? 'sitesFormAn' : 'sitesFormA', { shells: shellText, poly: k.poly })
      + (shells.length > 1 ? ` ${txt('sitesSquashed')}` : '');
    const multi = ctx.region.cells > 1;

    return `<div class="site-rows">${rows}</div>
      <div class="field"><div class="field-label">${txt('pointsShowAs')}</div>
        ${segmented('size', [{ value: 'marker', label: txt('sitesMarkers') }, { value: 'fit', label: txt('sitesFit') }], item.size)}
        <p class="field-hint">${item.size === 'fit' ? txt('sitesFitHint') : txt('sitesMarkersHint')}</p></div>
      <div class="field"><div class="field-label">${txt('sitesPolyhedra')}</div>
        ${segmented('poly', [{ value: 'off', label: txt('sitesOff') }, { value: 'one', label: txt('sitesSelected') }, { value: 'all', label: txt('sitesEvery') }], item.poly)}</div>
      <div class="field"><label class="field-label" for="sel-${item.id}">${txt('sitesSelected')}</label>
        <select class="input" id="sel-${item.id}" data-field="sel">${options}</select>
        <p class="field-hint">${txt('sitesSelectHint', { around })}</p></div>
      ${toggle('shares', item.shares, txt('sitesShares'), { hint: txt('sitesSharesHint') })}
      ${toggle('all', item.all, txt('sitesAll'), { hint: multi ? txt('sitesAllHint', { cell: ctx.cell.join(',') }) : txt('edgesTakesEffect'), disabled: !multi })}
      <div class="field"><div class="field-label"><span>${txt('sitesCounting')}${helpButton('site-count', { item: item.id })}</span></div>
        ${formulaTex(txt('formulaSites'))}</div>
      ${siteAppearance(item, ctx, sites)}`;
  },

  onField(item, name, value, ctx, ws, phase) {
    if (name.startsWith('show-')) { item.show[name.slice(5)] = value; ws.redraw(item, { card: true }); return; }
    if (name.startsWith('kcol-')) {
      item.colours[name.slice(5)] = value;
      if (phase === 'input') ws.renderItemScene(item); else ws.replaceCard(item);
      return;
    }
    if (name === 'sel') {
      const [kind, f] = String(value).split('|');
      item.sel = { kind, f: parsePos(f) };
      ws.redraw(item, { card: true });
      return;
    }
    if (name === 'size' || name === 'poly') { item[name] = value; ws.redraw(item, { card: true }); return; }
    if (name === 'shares' || name === 'all') { item[name] = value; ws.redraw(item); }
  },

  onAction(item, act, el, ctx, ws) {
    if (onLatticeAction(act, ws)) return;
    if (act === 'kcol-auto') { delete item.colours[el.dataset.kind]; ws.renderItemScene(item); ws.replaceCard(item); }
  },

  primitives(item, ctx) {
    const sites = M.sceneSites(ctx);
    if (!sites) return [];
    const L = ctx.lattice, op = ctx.opacity(item), region = item.all ? ctx.region : ctx.unitRegion;
    const mr = markerRadius(ctx, sites), prims = [];
    // filled holes are cut at the cell boundary like the lattice spheres
    const clip = ctx.cut && item.size === 'fit' ? M.regionPlanes(region, L) : null;
    for (const s of sites) {
      if (item.show[s.kind] === false) continue;
      const colour = kindColour(ctx, s.kind, item);
      const images = M.siteImages(s.sBasis, region);
      prims.push({ kind: 'spheres', centres: images.map(i => L.toCartesian(i.f)), radius: item.size === 'fit' ? s.rMax : mr, colour, opacity: op, clip });
      const inCell = M.siteImages(s.sBasis, ctx.unitRegion);
      if (item.shares) {
        for (const i of inCell) prims.push({ kind: 'label', at: L.toCartesian(i.f), html: fractionGlyph(M.shareOf(i.f, ctx.unitRegion)), colour, cls: 'lbl-frac' });
      }
      if (item.poly === 'all') for (const i of inCell) prims.push(...polyPrims(ctx, s, i.f, colour, op));
    }
    // the selected site: a solid marker, and its polyhedron
    const sel = item.sel && sites.find(s => s.kind === item.sel.kind);
    if (sel && item.show[sel.kind] !== false) {
      const fAbs = M.add(ctx.cellOrigin, item.sel.f), colour = kindColour(ctx, sel.kind, item);
      prims.push({ kind: 'spheres', centres: [L.toCartesian(fAbs)], radius: item.size === 'fit' ? 0.8 * mr : 1.35 * mr, colour, opacity: 1 });
      if (item.poly === 'one') prims.push(...polyPrims(ctx, sel, fAbs, colour, op, { spokes: true }));
    }
    return prims;
  },

  /** A click on a marker selects that site. */
  pick(item, ctx, ray) {
    const sites = M.sceneSites(ctx);
    if (!sites) return null;
    const L = ctx.lattice, region = item.all ? ctx.region : ctx.unitRegion, mr = markerRadius(ctx, sites);
    return M.nearestHit(ray, sites.filter(s => item.show[s.kind] !== false).flatMap(s => {
      const r = Math.max(item.size === 'fit' ? s.rMax : mr, 0.07 * ctx.L0);
      return M.siteImages(s.sBasis, region).map(i => ({ c: L.toCartesian(i.f), r, data: { kind: s.kind, f: M.sub(i.f, ctx.cellOrigin) } }));
    }));
  },

  onPick(item, data, ctx, ws) {
    item.sel = data;
    ws.redraw(item, { card: true });
    ws.flashCard(item);
  },
});

/** The Appearance dropdown of the sites object: one colour per kind and a transparency slider. */
function siteAppearance(item, ctx, sites) {
  const row = s => kindSwatches({
    label: txt('sitesRowLabel', { name: M.SITE_KINDS[s.kind].name }), colour: kindColour(ctx, s.kind, item), own: !!(item.colours && item.colours[s.kind]),
    act: 'kcol', data: 'kind', key: s.kind, aria: txt('sitesColourOf', { kind: M.SITE_KINDS[s.kind].adjective }),
  });
  return appearanceShell(item, kindColour(ctx, sites[0].kind, item), sites.map(row).join(''));
}

/* =====================================================================
   Input bar
   ===================================================================== */

registerCommand({
  name: 'Sites', args: 0, group: txt('catSites'), type: 'interstitials', usage: 'Sites()',
  help: txt('cmdHelpSites'),
  example: () => 'Sites()',
  run(args, ws, name) {
    if (!M.sceneSites(ws.ctx)) return { error: txt('msgSitesChoose', { notAvailable: notAvailable(ws.ctx) }) };
    const item = ws.addItem('interstitials', { name });
    return { ok: txt('msgCreated', { label: ws.labelHTML(item) }), item };
  },
  update: item => ({ ok: txt('msgSitesAlready', { name: item.name }), item }),
});
