/* 3D highlights for SEE MORE: interstitial sites (format: see highlights.js). No DOM. */
import * as M from '../math/index.js';
import { sig, fractionGlyph } from '../ui/format.js';
import { colourOf, label } from './highlights.js';
import { txt } from '../text.js';

const SITE_THEME = { oct: 'siteOct', tet: 'siteTet', cub: 'siteCub' };
const siteColourOf = (ctx, kind) => ctx.theme[SITE_THEME[kind]];

/**
 * One hole and the lines its derivation is about, in the highlighted cell:
 * the neighbours as touching spheres, the largest sphere that fits, and
 * labelled lines (fractional, from the cell origin), e.g. a cell edge "a = 2R + 2r".
 * def: { lattice, kind, name, site, lines: [{ from, to, label }] }
 */
export function siteDerivation(ctx, def) {
  if (ctx.bravais.id !== def.lattice) return { unavailable: txt('hlSiteChoose', { lattice: def.name }) };
  const L = ctx.lattice, O = ctx.cellOrigin, colour = colourOf(ctx), R = ctx.analysis.neighbours.dnn / 2;
  const spec = M.siteSpec(def.lattice, def.kind), fSite = M.add(O, def.site), c = L.toCartesian(fSite);
  const hosts = M.hostsAround(L, ctx.basis, fSite, { n: spec.cn }), hc = hosts.map(h => L.toCartesian(h.f));
  const hostColour = (ctx.pointStyle && ctx.pointStyle.colour) || '#5965F0';
  const prims = [
    { kind: 'spheres', centres: hc, radius: R, colour: hostColour, opacity: 0.2 },
    ...M.polyhedronFaces(hc).map(face => ({ kind: 'polygon', points: face, colour, opacity: 0.08 })),
    { kind: 'spheres', centres: [c], radius: hosts[0].d - R, colour: siteColourOf(ctx, def.kind), opacity: 0.95 },
  ];
  const segs = def.lines.map(ln => [L.toCartesian(M.add(O, ln.from)), L.toCartesian(M.add(O, ln.to))]);
  def.lines.forEach((ln, i) => {
    const [a, b] = segs[i];
    prims.push({ kind: 'tubes', segments: [[a, b]], radius: 0.014 * ctx.L0, colour, opacity: 1 });
    prims.push(label(M.scale(M.add(a, b), 0.5), ln.label, colour));
  });
  // look straight at the plane that holds the lines, so both are seen at their true length
  let look = null;
  if (segs.length > 1) {
    const n = M.cross(M.sub(segs[0][1], segs[0][0]), M.sub(segs[1][1], segs[1][0]));
    if (M.norm(n) > 1e-9) look = M.normalize(n);
  }
  return {
    prims, look,
    caption: txt('hlSiteCaption', { kind: M.SITE_KINDS[def.kind].adjective, cn: spec.cn }),
  };
}

/** Every hole in the highlighted cell, one colour per kind; with labels, each marked with the share that belongs to the cell. */
export function allSites(ctx, { labels = false } = {}) {
  const sites = M.sceneSites(ctx);
  if (!sites) return { unavailable: txt(labels ? 'hlSitesCoveredCounting' : 'hlSitesCoveredHoles') };
  const L = ctx.lattice, r = 0.065 * ctx.L0, prims = [];
  for (const s of sites) {
    const colour = siteColourOf(ctx, s.kind), images = M.siteImages(s.sBasis, ctx.unitRegion);
    prims.push({ kind: 'spheres', centres: images.map(i => L.toCartesian(i.f)), radius: r, colour, opacity: 0.9 });
    if (labels) for (const i of images) prims.push(label(L.toCartesian(i.f), fractionGlyph(M.shareOf(i.f, ctx.unitRegion)), colour, 'lbl-frac'));
  }
  return {
    prims,
    caption: labels
      ? txt('hlSiteSharesCaption')
      : txt('hlSitesEvery', { list: sites.map(s => `<b style="color:${siteColourOf(ctx, s.kind)}">${M.SITE_KINDS[s.kind].adjective}</b>`).join(` ${txt('wordAnd')} `) }),
  };
}

/**
 * An atom in a hole: the neighbours, the atom (green when it fits, red when not),
 * the circles where it overlaps them and arrows for how far each must move.
 * fit: { kind, at (fractional, from the cell origin), r }
 */
export function fitOverlap(ctx, fit) {
  const sites = M.sceneSites(ctx);
  const s = sites && (sites.find(x => x.kind === fit.kind) || sites[0]);
  if (!s) return { unavailable: txt('hlFitCubicOnly') };
  const L = ctx.lattice, colour = colourOf(ctx), fAbs = M.add(ctx.cellOrigin, fit.at), c = L.toCartesian(fAbs);
  const res = M.fitAtom(L, ctx.basis, fAbs, fit.r, s.R, s.cn);
  const good = ctx.theme.good, bad = ctx.theme.bad;
  const hc = res.hosts.map(h => L.toCartesian(h.f));
  const prims = [
    { kind: 'spheres', centres: hc, radius: res.R, colour: '#8E95AD', opacity: 0.22 },
    { kind: 'spheres', centres: [c], radius: res.r, colour: res.fits ? good : bad, opacity: 1 },
  ];
  res.hosts.forEach((h, i) => {
    if (h.overlap <= 1e-9) return;
    const ring = M.sphereIntersection(c, res.r, hc[i], res.R);
    if (ring) {
      const pts = M.circlePoints(ring, 40);
      prims.push({ kind: 'tubes', segments: pts.slice(1).map((p, k) => [pts[k], p]), radius: 0.012 * ctx.L0, colour: bad, opacity: 1 });
    }
    const u = M.normalize(M.sub(hc[i], c));
    prims.push({ kind: 'arrow', from: M.add(hc[i], M.scale(u, res.R)), to: M.add(hc[i], M.scale(u, res.R + h.overlap)), colour: bad, size: 0.4 });
  });
  const moving = res.shells.filter(sh => sh.move > 1e-9);
  if (moving.length) {
    const i = res.hosts.findIndex(h => h.overlap > 1e-9);
    prims.push(label(hc[i], `δ = ${sig(moving[0].move, 2)} Å`, colour));
  }
  return {
    prims,
    caption: res.fits
      ? txt('hlFitFits', { ratio: res.ratio.toFixed(3) })
      : txt('hlFitTooBig', { ratio: res.ratio.toFixed(3) }),
  };
}
