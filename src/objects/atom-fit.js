/* =====================================================================
   'atom-fit' (Fit(tet, 0.3)): an atom of radius r in one interstitial site
   (cubic P, I and F). Green when it fits (r ≤ r_max), red when it doesn't,
   with the overlap circles drawn and arrows showing how far each neighbour
   must move. The numbers come from fitAtom in src/math/interstitials.js;
   the sites themselves are objects/interstitials.js.
   ===================================================================== */
import { registerType } from './registry.js';
import { registerCommand } from './commands.js';
import * as M from '../math/index.js';
import { HELP } from '../help/content.js';
import { sig, trim, posText } from '../ui/format.js';
import { facts, formulaTex, toggle, segmented, actionButton, helpButton } from '../ui/controls.js';
import { numberField } from '../ui/number-field.js';
import { icon } from '../ui/icons.js';
import {
  CRIT_TEXT, siteTopic, kindColour, notAvailable, posKey, parsePos, cellPositions, markerRadius, unavailableHTML, onLatticeAction,
} from './interstitials.js';
import { txt } from '../text.js';

const HOST_GREY = '#8E95AD';
const KIND_OF = { oct: 'oct', octahedral: 'oct', o: 'oct', tet: 'tet', tetrahedral: 'tet', t: 'tet', cub: 'cub', cubic: 'cub', c: 'cub' };

/* =====================================================================
   Atom fit
   ===================================================================== */

/** The site, its position and the fit of the atom: { s, fAbs, fit } or null. */
export function fitOf(item, ctx) {
  const sites = M.sceneSites(ctx);
  if (!sites) return null;
  const s = sites.find(x => x.kind === item.kind) || sites[0];
  const fAbs = M.add(ctx.cellOrigin, item.at);
  return { s, fAbs, fit: M.fitAtom(ctx.lattice, ctx.basis, fAbs, item.r, s.R, s.cn) };
}

const round2 = x => Math.round(x * 100) / 100;

/** The live part of the atom-fit card (updated whenever the radius changes): gauge, verdict, numbers. */
function fitLive(item, ctx) {
  const F = fitOf(item, ctx);
  if (!F) return '';
  const { s, fit } = F, id = `${ctx.bravais.id}-${s.kind}`, good = fit.fits;
  const pct = x => `${(100 * Math.min(1, Math.max(0, x))).toFixed(1)}%`;
  const gauge = `<div class="fit-gauge ${good ? 'is-good' : 'is-bad'}" style="--v:${pct(fit.ratio)};--crit:${pct(fit.critical)}">
      <div class="fg-track" aria-hidden="true"><span class="fg-fill"></span><span class="fg-crit"></span></div>
      <div class="fg-scale"><span><i>r</i>/<i>R</i> = <b>${fit.ratio.toFixed(3)}</b></span>
        <span>${txt('fitCritical')} <b>${fit.critical.toFixed(3)}</b> = ${CRIT_TEXT[id]}${helpButton(siteTopic(ctx, s.kind), { item: item.id })}</span></div>
    </div>`;
  let verdict;
  if (good) {
    verdict = fit.room > 5e-4
      ? txt('fitFitsRoom', { r: sig(fit.r, 3), rMax: sig(fit.rMax), room: sig(fit.room, 2) })
      : txt('fitFitsTouch', { r: sig(fit.r, 3), rMax: sig(fit.rMax) });
  } else {
    const moving = fit.shells.filter(sh => sh.move > 1e-9), still = fit.shells.filter(sh => sh.move <= 1e-9);
    verdict = `${txt('fitTooBig', { by: sig(fit.r - fit.rMax, 2) })} `
      + moving.map(sh => txt(sh.count === 1 ? 'fitMoveOne' : 'fitMoveMany', { count: sh.count, d: sig(sh.d), move: sig(sh.move, 2), percent: (100 * sh.move / sh.d).toFixed(1) })).join('; ') + '.'
      + (still.length ? ` ${txt('fitStillRoom', { list: still.map(sh => txt('countAtDistance', { count: sh.count, d: sig(sh.d) })).join(` ${txt('wordAnd')} `) })}` : '');
  }
  return `${gauge}
    <div class="fit-status ${good ? 'is-good' : 'is-bad'}">${icon(good ? 'check' : 'x')}<p>${verdict}</p></div>
    ${facts([
      [txt('fitHostRadius'), `${sig(fit.R)} Å`],
      [txt('fitHoleDistance'), `${sig(fit.d)} Å`],
      [txt('fitLargest'), `${sig(fit.rMax)} Å`],
      [txt('fitYourAtom'), `<b>${sig(fit.r, 3)} Å</b>`],
    ])}`;
}

registerType({
  type: 'atom-fit',
  prefix: 'fit',
  title: txt('fitTitle'),
  icon: 'fit',
  help: 'atom-fit',
  appearance: true, // colour and transparency of the neighbouring host spheres
  defaultTransparency: 62,
  menu: [{
    key: 'atom-fit', category: 'interstitials', order: 20, title: txt('fitMenu'), desc: HELP['atom-fit'],
    command: 'Fit(0.5)', unavailable: ctx => (M.sceneSites(ctx) ? null : notAvailable(ctx)),
  }],

  create(init, ctx) {
    const sites = M.sceneSites(ctx);
    const s = sites && (sites.find(x => x.kind === init.kind) || sites[0]);
    const r = init.r ?? (s ? round2(0.85 * s.rMax) : 0.5);
    return {
      kind: s ? s.kind : 'oct', at: s ? [...s.rep] : [0.5, 0.5, 0.5], r,
      focus: true, moved: true, others: true, colour: HOST_GREY, // neutral, so green (fits) and red (too big) keep their colour seen through the neighbours
    };
  },

  refresh(item, ctx) {
    const sites = M.sceneSites(ctx);
    if (!sites) return;
    let s = sites.find(x => x.kind === item.kind);
    if (!s) { s = sites[0]; item.kind = s.kind; item.at = [...s.rep]; }
    if (!M.isSiteOf(M.add(ctx.cellOrigin, item.at), s.sBasis)) item.at = [...s.rep];
  },

  hidesLatticePoints: (item, ctx) => !!item.focus && !!M.sceneSites(ctx),

  afterAdd(item, ctx) {
    const F = fitOf(item, ctx);
    return F ? txt('fitAddNote', { cn: F.s.cn }) : notAvailable(ctx);
  },

  definition: item => `${item.name} = Fit(${item.kind}, ${trim(item.r, 3)})`,
  autoLabel: item => (M.SITE_KINDS[item.kind] ? txt('fitLabel', { kind: M.SITE_KINDS[item.kind].adjective }) : txt('fitLabelUnknown')),

  summary(item, ctx) {
    const F = fitOf(item, ctx);
    if (!F) return txt('sitesNotAvailableShort', { lattice: ctx.bravais.name });
    const { fit } = F;
    return `<span class="fit-chip ${fit.fits ? 'is-good' : 'is-bad'}">${fit.fits ? txt('fitChipFits') : txt('fitChipTooBig')}</span> <i>r</i>/<i>R</i> = ${fit.ratio.toFixed(3)} ${fit.fits ? '≤' : '>'} ${fit.critical.toFixed(3)}`;
  },

  settings(item, ctx) {
    const F = fitOf(item, ctx);
    if (!F) return unavailableHTML(ctx);
    const { s } = F, sites = M.sceneSites(ctx);
    const kindField = `<div class="field"><div class="field-label"><span>${txt('fitSite')}${helpButton(siteTopic(ctx, s.kind), { item: item.id })}</span></div>
      ${sites.length > 1 ? segmented('kind', sites.map(x => ({ value: x.kind, label: M.SITE_KINDS[x.kind].name })), item.kind) : `<p class="field-hint">${txt('fitOneKind')}</p>`}</div>`;
    const positions = cellPositions(s, ctx);
    const posField = `<div class="field"><label class="field-label" for="at-${item.id}">${txt('fitPosition')}</label>
      <select class="input" id="at-${item.id}" data-field="at">${positions.map(f => `<option value="${posKey(f)}"${posKey(f) === posKey(item.at) ? ' selected' : ''}>${posText(f)} · ${M.sitePlace(f)}</option>`).join('')}</select>
      <p class="field-hint">${positions.length > 1 ? txt(item.others ? 'fitPositionsClick' : 'fitPositions', { count: positions.length }) : txt('fitOnlyOne')}</p></div>`;
    return `${kindField}${posField}
      ${numberField('r', item.r, {
        label: txt('fitRadiusLabel'), unit: 'Å', step: 0.01, max: +s.R.toFixed(4), what: txt('fitTheRadius'),
        hint: txt('fitRadiusHint', { max: sig(s.R) }),
      })}
      <div class="btn-row">${actionButton('rmax', txt('fitJustFits'), 'check')}${actionButton('rbig', txt('fitTooBigButton'), 'plus')}</div>
      <div class="fit-live" data-live>${fitLive(item, ctx)}</div>
      <div class="field"><div class="field-label"><span>${txt('fitWhen')}${helpButton('atom-fit', { item: item.id })}</span></div>
        ${formulaTex(txt('formulaFitR'))}
        ${formulaTex(txt('formulaFitRatio'))}
        ${formulaTex(txt('formulaFitDelta'), txt('fitTagTooBig'))}
        <p class="field-hint">${txt('fitDeltaHint')}</p></div>
      ${toggle('focus', item.focus, txt('fitFocus'), { hint: txt('fitFocusHint') })}
      ${toggle('moved', item.moved, txt('fitMoved'), { hint: txt('fitMovedHint') })}
      ${toggle('others', item.others, txt('fitOthers'), { hint: txt('fitOthersHint') })}`;
  },

  live: fitLive,

  onField(item, name, value, ctx, ws) {
    if (name === 'r') {
      const r = +value, F = fitOf(item, ctx);
      if (!(r > 0) || (F && r > F.s.R + 1e-9)) return; // the field already refuses these
      item.r = r;
      ws.redraw(item);
      return;
    }
    if (name === 'kind') {
      const s = (M.sceneSites(ctx) || []).find(x => x.kind === value);
      if (!s) return;
      item.kind = value;
      item.at = [...s.rep];
      ws.redraw(item, { card: true });
      return;
    }
    if (name === 'at') { item.at = parsePos(value); ws.redraw(item, { card: true }); return; }
    if (['focus', 'moved', 'others'].includes(name)) { item[name] = value; ws.redraw(item, { card: true }); }
  },

  onAction(item, act, el, ctx, ws) {
    if (onLatticeAction(act, ws)) return;
    const F = fitOf(item, ctx);
    if (!F) return;
    if (act === 'rmax') item.r = F.fit.rMax;
    else if (act === 'rbig') item.r = 1.1 * F.fit.rMax;
    else return;
    ws.redraw(item, { card: true });
  },

  primitives(item, ctx) {
    const F = fitOf(item, ctx);
    if (!F) return [];
    const { s, fAbs, fit } = F, L = ctx.lattice, L0 = ctx.L0;
    const c = L.toCartesian(fAbs), hostColour = ctx.colour(item), op = ctx.opacity(item);
    const good = ctx.theme.good, bad = ctx.theme.bad;
    const prims = [], hc = fit.hosts.map(h => L.toCartesian(h.f));

    // the neighbours (unless the lattice already draws them as touching spheres)
    const P = ctx.ws.state.scene[0];
    const latticeDrawsThem = !item.focus && P.visible && P.mode === 'spheres';
    if (!latticeDrawsThem) prims.push({ kind: 'spheres', centres: hc, radius: fit.R, colour: hostColour, opacity: op });
    prims.push({ kind: 'tubes', segments: hc.slice(0, s.cn).map(p => [c, p]), radius: 0.006 * L0, colour: hostColour, opacity: 0.7 });

    // the atom: green when it fits, red when it doesn't
    prims.push({ kind: 'spheres', centres: [c], radius: Math.max(fit.r, 1e-3), colour: fit.fits ? good : bad, opacity: 1 });
    prims.push({
      kind: 'label', at: M.add(c, [0, 0, fit.r + 0.14 * L0]), colour: fit.fits ? good : bad, cls: 'lbl-fit',
      html: `<i>r</i>/<i>R</i> = ${fit.ratio.toFixed(3)} ${fit.fits ? '≤' : '>'} ${fit.critical.toFixed(3)} ${fit.fits ? '✓' : '✗'}`,
    });

    // overlap: the circle where the atom cuts each neighbour, and how far that neighbour must move
    const ghosts = [], labelled = new Set();
    fit.hosts.forEach((h, i) => {
      if (h.overlap <= 1e-9) return;
      const ring = M.sphereIntersection(c, fit.r, hc[i], fit.R);
      if (ring) {
        const pts = M.circlePoints(ring, 40);
        prims.push({ kind: 'tubes', segments: pts.slice(1).map((p, k) => [pts[k], p]), radius: 0.012 * L0, colour: bad, opacity: 1 });
      }
      if (!item.moved) return;
      const u = M.normalize(M.sub(hc[i], c));
      ghosts.push(M.add(hc[i], M.scale(u, h.overlap)));
      const shellKey = h.d.toFixed(5), first = !labelled.has(shellKey);
      labelled.add(shellKey);
      prims.push({
        kind: 'arrow', from: M.add(hc[i], M.scale(u, fit.R)), to: M.add(hc[i], M.scale(u, fit.R + h.overlap)), colour: bad, size: 0.4,
        label: first ? `+${sig(h.overlap, 2)} Å` : undefined, labelCls: 'lbl-dim', labelGap: 0.1,
      });
    });
    if (ghosts.length) prims.push({ kind: 'spheres', centres: ghosts, radius: fit.R, colour: bad, opacity: 0.1 });

    // the other sites of this kind in the cell: click one to move the atom
    if (item.others) {
      const cands = M.siteImages(s.sBasis, ctx.unitRegion).filter(i => M.norm(M.sub(i.f, fAbs)) > 1e-6).map(i => L.toCartesian(i.f));
      if (cands.length) prims.push({ kind: 'spheres', centres: cands, radius: markerRadius(ctx, M.sceneSites(ctx)), colour: kindColour(ctx, s.kind), opacity: 0.45 });
    }
    return prims;
  },

  pick(item, ctx, ray) {
    const F = fitOf(item, ctx);
    if (!F || !item.others) return null;
    const L = ctx.lattice, r = Math.max(markerRadius(ctx, M.sceneSites(ctx)), 0.07 * ctx.L0);
    const others = M.siteImages(F.s.sBasis, ctx.unitRegion).filter(i => !(M.norm(M.sub(i.f, F.fAbs)) < 1e-6));
    const hit = M.nearestHit(ray, others.map(i => ({ c: L.toCartesian(i.f), r, data: M.sub(i.f, ctx.cellOrigin) })));
    return hit && { ...hit, priority: 1 };
  },

  onPick(item, at, ctx, ws) {
    item.at = at;
    ws.redraw(item, { card: true });
    ws.flashCard(item);
  },
});

/* =====================================================================
   Input bar
   ===================================================================== */

/**
 * Arguments of Fit(…), in any order: a site (oct, tet, cub) and a radius in Å,
 * as a multiple of R (0.4R) or "max" for the largest that fits.
 * → { kind, r } (r may be undefined: the default) or { error }.
 */
export function parseFit(args, ctx, item = null) {
  const sites = M.sceneSites(ctx);
  if (!sites) return { error: txt('msgSitesChoose', { notAvailable: notAvailable(ctx) }) };
  const names = sites.map(s => s.kind).join(', ');
  let kind = null, r, ratio, max = false;
  for (const raw of args) {
    const a = String(raw).trim();
    if (!a) continue;
    const word = a.toLowerCase();
    if (KIND_OF[word]) {
      const k = KIND_OF[word];
      if (!sites.some(s => s.kind === k)) return { error: txt('msgFitNoKind', { lattice: ctx.bravais.name, kind: M.SITE_KINDS[k].adjective, names }) };
      kind = k;
      continue;
    }
    if (word === 'max' || word === 'rmax') { max = true; continue; }
    let m = a.match(/^(\d*\.?\d+)\s*\*?\s*r$/i);
    if (m) { ratio = +m[1]; continue; }
    m = a.match(/^(\d*\.?\d+)\s*(å|a|angstrom)?$/i);
    if (m) { r = +m[1]; continue; }
    return { error: txt('msgFitCantRead', { arg: a, names, last: sites[sites.length - 1].kind, first: sites[0].kind }) };
  }
  if (!kind) kind = item && sites.some(s => s.kind === item.kind) ? item.kind : sites[0].kind;
  const s = sites.find(x => x.kind === kind);
  if (max) r = s.rMax;
  else if (ratio != null) r = ratio * s.R;
  if (r != null && !(r > 0 && r <= s.R + 1e-9)) {
    return { error: txt('msgFitRadiusRange', { max: sig(s.R), kind, example: sig(0.8 * s.rMax, 2) }) };
  }
  return { kind, r };
}

registerCommand({
  name: 'Fit', args: [0, 2], raw: true, group: txt('catSites'), type: 'atom-fit', usage: 'Fit(tet, 0.3)',
  help: txt('cmdHelpFit'),
  example: () => 'Fit(0.5)',
  run(args, ws, name) {
    const p = parseFit(args, ws.ctx);
    if (p.error) return p;
    const item = ws.addItem('atom-fit', { name, kind: p.kind, ...(p.r != null ? { r: p.r } : {}) });
    return { ok: txt('msgCreated', { label: ws.labelHTML(item) }), item };
  },
  update(item, args, ws) {
    const p = parseFit(args, ws.ctx, item);
    if (p.error) return p;
    const site = M.sceneSites(ws.ctx).find(s => s.kind === p.kind);
    if (p.kind !== item.kind) { item.kind = p.kind; item.at = [...site.rep]; }
    if (p.r != null) item.r = p.r;
    return { ok: txt('msgChanged', { label: ws.labelHTML(item) }), item };
  },
});
