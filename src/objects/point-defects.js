/* =====================================================================
   Defects mode: point defects. One factory, five types:
     vacancy               v1    a lattice point left empty
     self-interstitial     si1   an extra host atom in an interstitial site
     substitutional        sub1  a lattice point holding a larger or smaller atom
     interstitial          imp1  a small foreign atom in an interstitial site
     frenkel               fp1   an atom that jumped from its lattice point into a nearby site

   Positions (item.at, item.to) are fractional coordinates in the block.
   The neighbours relax (defect hook → relax): the first shell moves by
   u₁ = strength × δ, the rest by u₁ (r₁/r)² (src/math/defects.js).
   Placing by clicking is done by the workspace (place: 'point' | 'site').
   The input-bar commands are in point-defect-commands.js.
   ===================================================================== */
import { registerType } from './registry.js';
import * as M from '../math/index.js';
import { sig, trim, posText } from '../ui/format.js';
import { formulaTex, range, segmented, toggle, actionButton, helpButton, facts } from '../ui/controls.js';
import { crystalOf, drawnPos, drawScale, blockPoints } from './crystal.js';
import { txt } from '../text.js';

/* ---------- positions in the block ---------- */
const dist2 = (f, g) => (f[0] - g[0]) ** 2 + (f[1] - g[1]) ** 2 + (f[2] - g[2]) ** 2;
export const nearestOf = (list, f) => list.reduce((best, x) => (!best || dist2(x, f) < dist2(best, f) - 1e-9 ? x : best), null);
export const sameAt = (f, g) => !!f && !!g && dist2(f, g) < 1e-8;
const centreOf = ctx => ctx.repeats.map(n => n / 2);

/** The interstitial sites of the lattice on screen (sceneSites), or []. */
export const siteKinds = ctx => M.sceneSites(ctx) || [];
export const siteSpec = (ctx, kind) => siteKinds(ctx).find(s => s.kind === kind) || siteKinds(ctx)[0] || null;

/** Every site of one kind in the block (fractional), cached on ctx. */
export function blockSites(ctx, kind) {
  ctx._sitesIn = ctx._sitesIn || {};
  if (!ctx._sitesIn[kind]) {
    const s = siteKinds(ctx).find(x => x.kind === kind);
    ctx._sitesIn[kind] = s ? M.siteImages(s.sBasis, ctx.region).map(i => i.f) : [];
  }
  return ctx._sitesIn[kind];
}

/** Coordinates as typed in the input bar: (2.5, 2, 2). */
export const posArg = f => `(${f.map(x => trim(x, 3)).join(', ')})`;

/** The places the visible point defects (other than `except`) already take. */
const taken = (ctx, except) => ctx.ws.state.items.filter(o => o !== except && o.visible && TYPES[o.type]).flatMap(placesOf);
/** The nearest of list to f that no other defect takes (or simply the nearest when every one is taken). */
const freeNearest = (ctx, list, f, except) => {
  const used = taken(ctx, except), free = list.filter(g => !used.some(u => sameAt(u, g)));
  return nearestOf(free.length ? free : list, f);
};

/** The free lattice point nearest the middle of the block (`except`: the defect being moved). */
export const middlePoint = (ctx, except = null) => freeNearest(ctx, blockPoints(ctx), centreOf(ctx), except);
/** The free site of a kind nearest to f (default: the middle of the block). */
export const nearestSite = (ctx, kind, f = centreOf(ctx), except = null) => freeNearest(ctx, blockSites(ctx, kind), f, except);

/* ---------- what each type is ---------- */
const R0 = ctx => ctx.analysis.neighbours.dnn / 2;
const cart = (ctx, f) => ctx.lattice.toCartesian(f);
const strengthOf = item => item.strength / 100;

/** A vacancy's relaxation: the neighbours at d_nn move in by strength × R/10. */
const vacancyRelax = (ctx, item, f) => ({ c: cart(ctx, f), r1: ctx.analysis.neighbours.dnn, u1: strengthOf(item) * M.VACANCY_MISFIT(R0(ctx)) });
/** An atom of radius r in a site: the nearest hosts (d away) move out by strength × δ, δ = r + R − d (never in: a small atom just rattles). */
const siteRelax = (ctx, item, f, r) => {
  const s = siteSpec(ctx, item.kind);
  return { c: cart(ctx, f), r1: s.d, u1: strengthOf(item) * Math.max(0, M.misfit(r, R0(ctx), s.d)) };
};

const TYPES = {
  vacancy: {
    prefix: 'v', place: 'point', icon: 'void', order: 10, command: 'Vacancy',
    title: txt('pdTitleVacancy'), menuTitle: txt('pdMenuVacancy'), desc: txt('pdDescVacancy'),
    defect: (item, ctx) => ({ remove: [item.at], relax: [vacancyRelax(ctx, item, item.at)] }),
    shell: (item, ctx) => ({ c: item.at, r1: ctx.analysis.neighbours.dnn, u1: strengthOf(item) * M.VACANCY_MISFIT(R0(ctx)), delta: M.VACANCY_MISFIT(R0(ctx)) }),
  },
  'self-interstitial': {
    prefix: 'si', place: 'site', icon: 'fit', order: 20, command: 'SelfInterstitial',
    title: txt('pdTitleSelf'), menuTitle: txt('pdMenuSelf'), desc: txt('pdDescSelf'),
    radius: ctx => R0(ctx),
    defect: (item, ctx) => ({ atoms: [{ f: item.at, p: cart(ctx, item.at), r: R0(ctx), kind: 'self' }], relax: [siteRelax(ctx, item, item.at, R0(ctx))] }),
    shell: (item, ctx) => { const s = siteSpec(ctx, item.kind), d = M.misfit(R0(ctx), R0(ctx), s.d); return { c: item.at, r1: s.d, u1: strengthOf(item) * Math.max(0, d), delta: d }; },
  },
  substitutional: {
    prefix: 'sub', place: 'point', icon: 'ions', order: 30, command: 'Substitutional', sized: true, defaultSize: 125,
    title: txt('pdTitleSubstitutional'),
    radius: (ctx, item) => (item.size / 100) * R0(ctx),
    defect(item, ctx) {
      const r = (item.size / 100) * R0(ctx), dnn = ctx.analysis.neighbours.dnn;
      return { remove: [item.at], atoms: [{ f: item.at, p: cart(ctx, item.at), r, kind: 'sub' }], relax: [{ c: cart(ctx, item.at), r1: dnn, u1: strengthOf(item) * M.misfit(r, R0(ctx), dnn) }] };
    },
    shell: (item, ctx) => { const dnn = ctx.analysis.neighbours.dnn, d = M.misfit((item.size / 100) * R0(ctx), R0(ctx), dnn); return { c: item.at, r1: dnn, u1: strengthOf(item) * d, delta: d }; },
  },
  interstitial: {
    prefix: 'imp', place: 'site', icon: 'fit', order: 40, command: 'Interstitial', sized: true, defaultSize: 55,
    title: txt('pdTitleInterstitial'), menuTitle: txt('pdMenuInterstitial'), desc: txt('pdDescInterstitial'),
    radius: (ctx, item) => (item.size / 100) * R0(ctx),
    defect(item, ctx) {
      const r = (item.size / 100) * R0(ctx);
      return { atoms: [{ f: item.at, p: cart(ctx, item.at), r, kind: 'impurity' }], relax: [siteRelax(ctx, item, item.at, r)] };
    },
    shell: (item, ctx) => { const s = siteSpec(ctx, item.kind), d = M.misfit((item.size / 100) * R0(ctx), R0(ctx), s.d); return { c: item.at, r1: s.d, u1: strengthOf(item) * Math.max(0, d), delta: d }; },
  },
  frenkel: {
    prefix: 'fp', place: 'point', icon: 'arrow', order: 50, command: 'Frenkel',
    title: txt('pdTitleFrenkel'), menuTitle: txt('pdMenuFrenkel'), desc: txt('pdDescFrenkel'),
    radius: ctx => R0(ctx),
    defect: (item, ctx) => ({
      remove: [item.at], atoms: [{ f: item.to, p: cart(ctx, item.to), r: R0(ctx), kind: 'self' }],
      relax: [vacancyRelax(ctx, item, item.at), siteRelax(ctx, item, item.to, R0(ctx))],
    }),
    shell: (item, ctx) => { const s = siteSpec(ctx, item.kind), d = M.misfit(R0(ctx), R0(ctx), s.d); return { c: item.to, r1: s.d, u1: strengthOf(item) * Math.max(0, d), delta: d }; },
  },
};

/** The site an atom leaving `at` jumps into: the nearest free one of that kind (or the n-th nearest); `except` is the pair itself. */
const frenkelTarget = (ctx, kind, at, rank = 0, except = null) => {
  const used = taken(ctx, except);
  let list = blockSites(ctx, kind).filter(g => !used.some(u => sameAt(u, g)));
  if (!list.length) list = blockSites(ctx, kind).slice();
  list.sort((p, q) => dist2(p, at) - dist2(q, at));
  return list[Math.min(rank, list.length - 1)] || null;
};

/** Every position an item takes (for clashes with other defects). */
const placesOf = item => [item.at, item.to].filter(Boolean);

/* ---------- the card ---------- */

/** "The 6 nearest neighbours move 0.20 Å inward (5 % of their distance)". */
function shellText(item, ctx) {
  const S = TYPES[item.type].shell(item, ctx), C = crystalOf(ctx);
  const first = C.atoms.filter(a => a.kind === 'host' && Math.abs(M.norm(M.sub(a.ref, cart(ctx, S.c))) - S.r1) < 1e-3 * S.r1);
  if (Math.abs(S.u1) < 1e-6) return txt(S.delta < 0 && item.type === 'interstitial' ? 'pdShellRattles' : 'pdShellStill', { count: first.length });
  return txt(S.u1 < 0 ? 'pdShellIn' : 'pdShellOut', { count: first.length, u: sig(Math.abs(S.u1), 2), percent: sig(100 * Math.abs(S.u1) / S.r1, 2) });
}

function live(item, ctx) {
  const S = TYPES[item.type].shell(item, ctx), R = R0(ctx);
  const rows = [[txt('pdHostRadius'), `${sig(R)} Å`]];
  if (TYPES[item.type].radius) rows.push([txt('pdAtomRadius'), `${sig(TYPES[item.type].radius(ctx, item))} Å`]);
  rows.push([txt('pdFirstShell'), `${sig(S.r1)} Å`], [`δ${helpButton('relaxation', { item: item.id })}`, `${S.delta >= 0 ? '+' : '−'}${sig(Math.abs(S.delta), 3)} Å`],
    [txt('pdFirstMove'), `<b>${S.u1 >= 0 ? '+' : '−'}${sig(Math.abs(S.u1), 3)} Å</b>`]);
  return `<p class="pd-shell">${shellText(item, ctx)}</p>${facts(rows)}`;
}

function settings(item, ctx) {
  if (!siteKinds(ctx).length) return `<p class="note">${txt('pdCubicOnly')}</p>`;
  const T = TYPES[item.type], kinds = siteKinds(ctx), clash = clashWith(item, ctx);
  const where = item.type === 'frenkel'
    ? txt('pdFrenkelWhere', { at: posText(item.at), to: posText(item.to) })
    : T.place === 'site' ? txt('pdWhereSite', { at: posText(item.at), place: M.SITE_KINDS[siteSpec(ctx, item.kind).kind].adjective }) : txt('pdWherePoint', { at: posText(item.at) });
  const kindField = T.place === 'site' || item.type === 'frenkel'
    ? `<div class="field"><div class="field-label"><span>${txt('pdSiteKind')}${helpButton('interstitials')}</span></div>
        ${kinds.length > 1 ? segmented('kind', kinds.map(s => ({ value: s.kind, label: M.SITE_KINDS[s.kind].name })), item.kind) : `<p class="field-hint">${txt('pdOneKind', { name: kinds[0] ? M.SITE_KINDS[kinds[0].kind].name : '' })}</p>`}</div>` : '';
  const jump = item.type === 'frenkel'
    ? segmented('rank', [txt('pdJump0'), txt('pdJump1'), txt('pdJump2')].map((label, k) => ({ value: String(k), label })), String(item.rank || 0)) : '';
  return `<div class="field"><div class="field-label">${txt('pdPosition')}</div>
      <p class="pd-where">${where}</p>
      ${clash ? `<p class="field-error">${clash}</p>` : ''}
      <div class="btn-row">${actionButton('move', txt('pdMove'), 'target')}${actionButton('centre', txt('pdCentre'), 'reset')}</div></div>
    ${kindField}${jump ? `<div class="field"><div class="field-label">${txt('pdJumpLabel')}</div>${jump}</div>` : ''}
    ${T.sized ? range('size', item.size, { min: 30, max: 160, step: 5, label: txt('pdSize') }) : ''}
    ${range('strength', item.strength, { min: 0, max: 100, step: 5, label: `${txt('pdStrength')}` })}
    <p class="field-hint">${txt('pdStrengthHint')}</p>
    <div class="pd-live" data-live>${live(item, ctx)}</div>
    <div class="field"><div class="field-label"><span>${txt('pdHowFar')}${helpButton('relaxation', { item: item.id })}</span></div>
      ${formulaTex(txt('formulaRelax'))}${formulaTex(txt(item.type === 'vacancy' ? 'formulaRelaxVacancy' : 'formulaRelaxDelta'))}</div>
    ${toggle('arrows', item.arrows, txt('pdArrows'), { hint: txt('pdArrowsHint') })}`;
}

/** Why the item is left out of the crystal: another defect already takes its place. */
function clashWith(item, ctx) {
  const items = ctx.ws.state.items, mine = placesOf(item), at = items.indexOf(item);
  // earlier defects win; a new item (not in the list yet) is checked against all of them
  const other = (at < 0 ? items : items.slice(0, at)).find(o => o.visible && TYPES[o.type] && placesOf(o).some(f => mine.some(g => sameAt(f, g))));
  return other ? txt('pdClash', { name: other.name }) : null;
}

/* ---------- drawing ---------- */
function primitives(item, ctx) {
  const C = crystalOf(ctx), sc = drawScale(ctx), R = C.R, colour = ctx.colour(item), op = ctx.opacity(item), L0 = ctx.L0;
  const prims = [], show = f => M.inSlice(f, ctx.slice);
  for (const v of C.vacancies.filter(x => x.id === item.id && show(x.f))) {
    const p = drawnPos(v, ctx);
    prims.push({ kind: 'spheres', centres: [p], radius: R * sc, colour, opacity: 0.2 * op }, { kind: 'spheres', centres: [p], radius: 0.16 * R, colour, opacity: op });
  }
  const own = C.atoms.filter(a => a.id === item.id && show(a.f));
  if (own.length) prims.push({ kind: 'spheres', centres: own.map(a => drawnPos(a, ctx)), radius: own[0].r * sc, colour, opacity: op });
  const mark = (own[0] && drawnPos(own[0], ctx)) || (C.vacancies.find(x => x.id === item.id) && drawnPos(C.vacancies.find(x => x.id === item.id), ctx));
  if (mark && (show(item.at) || (item.to && show(item.to)))) {
    prims.push({ kind: 'label', at: M.add(mark, [0, 0, R * sc + 0.12 * L0]), html: `<span class="nm">${item.name}</span>`, colour, cls: 'lbl-defect' });
  }
  if (item.type === 'frenkel' && show(item.at) && show(item.to)) {
    const v = C.vacancies.find(x => x.id === item.id), a = own[0];
    if (v && a) prims.push({ kind: 'arrow', from: drawnPos(v, ctx), to: drawnPos(a, ctx), colour, size: 0.32, opacity: 0.85 });
  }
  if (item.arrows && !C.conflicts.has(item.id)) prims.push(...shellArrows(item, ctx, C));
  return prims;
}

/** Arrows on the first shell, all the same length, pointing the way the atoms moved; one label gives the real amount. */
function shellArrows(item, ctx, C) {
  const S = TYPES[item.type].shell(item, ctx);
  if (Math.abs(S.u1) < 1e-6) return [];
  const c = cart(ctx, S.c), sc = drawScale(ctx), len = 0.5 * C.R * Math.max(0.6, sc), out = [];
  const first = C.atoms.filter(a => a.kind === 'host' && M.inSlice(a.f, ctx.slice) && Math.abs(M.norm(M.sub(a.ref, c)) - S.r1) < 1e-3 * S.r1);
  first.forEach((a, i) => {
    const u = M.normalize(M.sub(a.ref, c)), dir = S.u1 > 0 ? u : M.scale(u, -1), p = drawnPos(a, ctx);
    const from = M.add(p, M.scale(dir, S.u1 > 0 ? C.R * sc : -(C.R * sc + len)));
    out.push({
      kind: 'arrow', from, to: M.add(from, M.scale(dir, len)), colour: ctx.colour(item), size: 0.3,
      label: i === 0 ? `${S.u1 > 0 ? '+' : '−'}${sig(Math.abs(S.u1), 2)} Å` : undefined, labelCls: 'lbl-dim', labelGap: 0.08,
    });
  });
  return out;
}

/* ---------- the factory ---------- */
for (const [type, T] of Object.entries(TYPES)) {
  const menu = type === 'substitutional'
    ? [{ key: 'sub-large', title: txt('pdMenuSubLarge'), desc: txt('pdDescSubLarge'), init: { size: 125 }, command: 'Substitutional(1.25R)', order: 30 },
      { key: 'sub-small', title: txt('pdMenuSubSmall'), desc: txt('pdDescSubSmall'), init: { size: 80 }, command: 'Substitutional(0.8R)', order: 31 }]
    : [{ key: type, title: T.menuTitle, desc: T.desc, command: `${T.command}()`, order: T.order }];
  registerType({
    type,
    mode: 'defects',
    prefix: T.prefix,
    title: T.title,
    icon: T.icon,
    help: type,
    appearance: true,
    place: T.place,
    menu: menu.map(m => ({ category: 'point-defects', place: T.place, ...m })),

    create(init, ctx) {
      const kind = siteSpec(ctx, init.kind) ? siteSpec(ctx, init.kind).kind : 'oct';
      const at = init.at || (T.place === 'site' ? nearestSite(ctx, kind) : middlePoint(ctx));
      const item = { at, kind, strength: init.strength ?? 50, arrows: true, ...(T.sized ? { size: init.size ?? T.defaultSize } : {}) };
      if (type === 'frenkel') { item.rank = 0; item.to = frenkelTarget(ctx, kind, at); }
      return item;
    },

    /** After the block or the lattice changed, every position must still be a lattice point or site in the block. */
    refresh(item, ctx) {
      const spec = siteSpec(ctx, item.kind);
      if (!spec) return;
      item.kind = spec.kind;
      const list = T.place === 'site' ? blockSites(ctx, item.kind) : blockPoints(ctx);
      if (!list.some(f => sameAt(f, item.at))) item.at = nearestOf(list, item.at);
      if (type === 'frenkel') item.to = frenkelTarget(ctx, item.kind, item.at, item.rank, item);
    },

    /** Put the defect at a clicked lattice point or site. */
    placeAt(item, f, kind, ctx) {
      item.at = f;
      if (kind) item.kind = kind;
      if (type === 'frenkel') item.to = frenkelTarget(ctx, item.kind, f, item.rank, item);
    },

    defect: (item, ctx) => (siteSpec(ctx, item.kind) ? T.defect(item, ctx) : null),
    error: (item, ctx) => clashWith(item, ctx),
    autoLabel: () => T.title,
    definition: item => `${item.name} = ${T.command}(${[T.sized ? `${trim(item.size / 100, 2)}R` : '', T.place === 'site' ? item.kind : '', posArg(item.at)].filter(Boolean).join(', ')})`,
    summary(item, ctx) {
      if (!siteKinds(ctx).length) return txt('pdCubicOnly');
      const where = posText(type === 'frenkel' ? item.to : item.at);
      return `${type === 'frenkel' ? `${posText(item.at)} → ${where}` : where} · ${shellText(item, ctx)}`;
    },
    settings,
    live,

    onField(item, name, value, ctx, ws) {
      if (name === 'size' || name === 'strength') { item[name] = value; ws.redraw(item); return; }
      if (name === 'arrows') { item.arrows = value; ws.redraw(item); return; }
      if (name === 'kind') {
        item.kind = value;
        if (T.place === 'site') item.at = nearestSite(ctx, value, item.at, item);
        else item.to = frenkelTarget(ctx, value, item.at, item.rank, item);
        ws.redraw(item, { card: true });
        return;
      }
      if (name === 'rank') { item.rank = +value; item.to = frenkelTarget(ctx, item.kind, item.at, item.rank, item); ws.redraw(item, { card: true }); }
    },

    onAction(item, act, el, ctx, ws) {
      if (act === 'move' && ws.startPlace) ws.startPlace({ item });
      else if (act === 'centre') {
        this.placeAt(item, T.place === 'site' ? nearestSite(ctx, item.kind, undefined, item) : middlePoint(ctx, item), null, ctx);
        ws.redraw(item, { card: true });
      }
    },

    primitives,

    /** A click on the defect opens its card. */
    pick(item, ctx, ray) {
      const C = crystalOf(ctx), at = C.atoms.find(a => a.id === item.id) || C.vacancies.find(v => v.id === item.id);
      if (!at || !M.inSlice(at.f, ctx.slice)) return null;
      const hit = M.nearestHit(ray, [{ c: drawnPos(at, ctx), r: Math.max(at.r || C.R, C.R) * drawScale(ctx), data: item.id }]);
      return hit && { ...hit, priority: 1 };
    },
    onPick(item, data, ctx, ws) {
      const li = ws.card(item);
      if (li) ws.toggleExpand(item, li, true);
      ws.flashCard(item);
    },
  });
}

export const POINT_DEFECTS = TYPES;
