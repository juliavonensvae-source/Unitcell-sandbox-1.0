/* =====================================================================
   Input bar commands for the point defects (Defects mode). Arguments come
   in any order:
     a position     (2, 2, 2)      a lattice point or site in the block
     a site         oct, tet, cub  (interstitials and the Frenkel pair)
     a size         1.2R, 120 %, or a radius in Å (substitutional, interstitial)
   Vacancy() puts the defect in the middle of the block.
   ===================================================================== */
import { registerCommand } from './commands.js';
import { getType } from './registry.js';
import * as M from '../math/index.js';
import { posText, sig } from '../ui/format.js';
import { POINT_DEFECTS, siteKinds, blockSites, nearestOf, sameAt, posArg } from './point-defects.js';
import { blockPoints } from './crystal.js';
import { txt } from '../text.js';

const KIND_OF = { oct: 'oct', octahedral: 'oct', tet: 'tet', tetrahedral: 'tet', cub: 'cub', cubic: 'cub' };

/** Read the arguments of a point-defect command → { at?, kind?, size? } or { error }. */
function parsePointDefect(type, args, ctx) {
  const T = POINT_DEFECTS[type], kinds = siteKinds(ctx), R = ctx.analysis.neighbours.dnn / 2;
  if (!kinds.length) return { error: txt('pdCubicOnly') };
  const out = {};
  for (const raw of args) {
    const a = String(raw).trim();
    if (!a) continue;
    const word = a.toLowerCase();
    let m;
    if (KIND_OF[word] && (T.place === 'site' || type === 'frenkel')) {
      const k = KIND_OF[word];
      if (!kinds.some(s => s.kind === k)) return { error: txt('msgPdNoKind', { lattice: ctx.bravais.name, kind: M.SITE_KINDS[k].adjective, names: kinds.map(s => s.kind).join(', ') }) };
      out.kind = k;
    } else if ((m = a.match(/^\((.*)\)$/))) {
      const f = m[1].split(/[\s,]+/).filter(Boolean).map(Number);
      if (f.length !== 3 || f.some(x => !Number.isFinite(x))) return { error: txt('msgPdPosition', { arg: a }) };
      out.at = f;
    } else if (T.sized && (m = a.match(/^(\d*\.?\d+)\s*\*?\s*(R|%|å|a)?$/i))) {
      const v = +m[1], unit = (m[2] || '').toLowerCase();
      out.size = unit === 'r' ? 100 * v : unit === '%' ? v : (100 * v) / R;
    } else return { error: txt(T.sized ? 'msgPdCantReadSized' : 'msgPdCantRead', { arg: a, command: T.command }) };
  }
  if (out.size != null && !(out.size >= 30 - 1e-9 && out.size <= 160 + 1e-9)) return { error: txt('msgPdSize', { r: sig(R) }) };
  if (out.at) {
    // a position must be a lattice point (or a site) of the block
    if (T.place === 'site') {
      const options = out.kind ? [out.kind] : kinds.map(s => s.kind);
      const kind = options.find(k => blockSites(ctx, k).some(f => sameAt(f, out.at)));
      if (!kind) {
        const near = nearestOf(blockSites(ctx, options[0]), out.at);
        return { error: txt('msgPdNotSite', { at: posText(out.at), kind: M.SITE_KINDS[options[0]].adjective, near: posArg(near) }) };
      }
      out.kind = kind;
    } else if (!blockPoints(ctx).some(f => sameAt(f, out.at))) {
      return { error: txt('msgPdNotPoint', { at: posText(out.at), near: posArg(nearestOf(blockPoints(ctx), out.at)) }) };
    }
  }
  return out;
}

for (const [type, T] of Object.entries(POINT_DEFECTS)) {
  registerCommand({
    name: T.command, mode: 'defects', raw: true, type, group: txt('catPointDefects'),
    args: [0, (T.place === 'site' || type === 'frenkel' ? 2 : 1) + (T.sized ? 1 : 0)],
    usage: { vacancy: 'Vacancy((2, 2, 2))', 'self-interstitial': 'SelfInterstitial(oct)', substitutional: 'Substitutional(1.2R)', interstitial: 'Interstitial(0.5R, oct)', frenkel: 'Frenkel()' }[type],
    help: T.desc || txt('pdDescSubstitutional'),
    example: () => `${T.command}()`,
    run(args, ws, name) {
      const p = parsePointDefect(type, args, ws.ctx);
      if (p.error) return p;
      const item = ws.addItem(type, { name, ...p }, { validate: true });
      if (item.error) return item;
      return { ok: txt('msgCreated', { label: ws.labelHTML(item) }), item };
    },
    update(item, args, ws) {
      const p = parsePointDefect(type, args, ws.ctx);
      if (p.error) return p;
      if (p.size != null) item.size = p.size;
      // another kind of site without a position: the nearest site of that kind
      if (p.kind && !p.at && T.place === 'site') p.at = nearestOf(blockSites(ws.ctx, p.kind), item.at);
      if (p.at || p.kind) getType(type).placeAt(item, p.at || item.at, p.kind, ws.ctx);
      return { ok: txt('msgChanged', { label: ws.labelHTML(item) }), item };
    },
  });
}
