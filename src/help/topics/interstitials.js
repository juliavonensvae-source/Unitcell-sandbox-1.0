/* =====================================================================
   Help topics: interstitial sites, critical radius ratios, counting the
   sites and the atom-fit tool (Part 4).

   The overview 'interstitials', 'site-count' and 'atom-fit'; the topic of
   each kind of site (site-cP-cub …) is in sites.js.
   ===================================================================== */
import * as M from '../../math/index.js';
import { tn, tPoint } from '../tex.js';
import { latticeName } from '../context.js';
import { octahedralDiagram } from '../diagrams.js';
import { allSites, fitOverlap } from '../highlights-sites.js';
import { trim } from '../../ui/format.js';
import { countTex, SITE_TOPICS } from './sites.js';
import { txt } from '../../text.js';

const R = String.raw;

/** The sites explained here, for the three cubic lattices, with the textbook critical ratio. */
export const INTERSTITIAL_SITES = {
  cP: [{ name: txt('helpSiteNameCubic'), f: [0.5, 0.5, 0.5], cn: 8, ideal: Math.sqrt(3) - 1, tex: txt('helpCritCP') }],
  cI: [
    { name: txt('siteOctName'), f: [0.5, 0.5, 0], cn: 6, ideal: 2 / Math.sqrt(3) - 1, tex: txt('helpCritCIOct') },
    { name: txt('siteTetName'), f: [0.5, 0.25, 0], cn: 4, ideal: Math.sqrt(5 / 3) - 1, tex: txt('helpCritCITet') },
  ],
  cF: [
    { name: txt('siteOctName'), f: [0.5, 0.5, 0.5], cn: 6, ideal: Math.SQRT2 - 1, tex: txt('helpCritCFOct') },
    { name: txt('siteTetName'), f: [0.25, 0.25, 0.25], cn: 4, ideal: Math.sqrt(1.5) - 1, tex: txt('helpCritCFTet') },
  ],
};

/** "4 octahedral and 8 tetrahedral sites per cell" ("site" when there is only one). */
const sitesPerCell = sites => txt(sites.length > 1 || sites[0].count.total > 1 ? 'helpSitesPerCell' : 'helpSitePerCell', {
  list: sites.map(s => `${trim(s.count.total)} ${M.SITE_KINDS[s.kind].adjective}`).join(` ${txt('wordAnd')} `),
});

/** Distance from a position to the nearest lattice point (Å). */
export function nearestHost(L, basis, f) {
  return M.hostsAround(L, basis, f, { n: 1 })[0].d;
}

/** For the lattice on screen: R, and for every site the largest sphere r that fits and r/R. null when not cubic P/I/F. */
export function siteFits(ctx) {
  const sites = INTERSTITIAL_SITES[ctx.bravais.id];
  if (!sites) return null;
  const Rh = ctx.analysis.neighbours.dnn / 2;
  return { R: Rh, sites: sites.map(s => { const d = nearestHost(ctx.lattice, ctx.basis, s.f); return { ...s, d, r: d - Rh, ratio: (d - Rh) / Rh }; }) };
}

/* ---------- the overview, counting and atom fit ---------- */
export default [
  {
    key: 'interstitials',
    title: txt('helpInterstitialsTitle'),
    icon: 'void',
    scope: txt('helpCubicPIF'),
    explain: txt('helpInterstitialsExplain'),
    formulas: [
      { tag: txt('helpInterstitialsFormula1Tag'), tex: txt('helpInterstitialsFormula1') },
      { tag: txt('helpInterstitialsFormula2Tag'), tex: txt('helpInterstitialsFormula2') },
      { tag: txt('helpInterstitialsFormula3Tag'), tex: txt('helpInterstitialsFormula3') },
      { tag: txt('helpInterstitialsFormula4Tag'), tex: txt('helpInterstitialsFormula4') },
    ],
    symbols: [
      [txt('helpInterstitialsSym1'), txt('helpInterstitialsSym1Text')],
      [txt('helpInterstitialsSym2'), txt('helpInterstitialsSym2Text')],
      [txt('helpInterstitialsSym3'), txt('helpInterstitialsSym3Text')],
    ],
    now(ctx) {
      const sites = M.sceneSites(ctx);
      if (!sites) return txt('helpInterstitialsNow', { lattice: latticeName(ctx) });
      return txt('helpInterstitialsNow2', { lattice: latticeName(ctx), sites: sitesPerCell(sites) });
    },
    more: {
      steps: [
        { text: txt('helpInterstitialsStep1'), tex: txt('helpInterstitialsStep1Tex') },
        { text: txt('helpInterstitialsStep2'), tex: txt('helpInterstitialsStep2Tex') },
        { text: txt('helpInterstitialsStep3'), tex: txt('helpInterstitialsStep3Tex') },
        { text: txt('helpInterstitialsStep4'), tex: txt('helpInterstitialsStep4Tex') },
        { text: txt('helpInterstitialsStep5'), tex: txt('helpInterstitialsStep5Tex') },
        { text: txt('helpInterstitialsStep6'), tex: txt('helpInterstitialsStep6Tex') },
        { text: txt('helpInterstitialsStep7'), tex: txt('helpInterstitialsStep7Tex') },
        { text: txt('helpInterstitialsStep8') },
      ],
      diagram: octahedralDiagram,
      highlight: ctx => allSites(ctx),
      example(ctx) {
        const fit = siteFits(ctx);
        if (!fit) {
          return {
            title: latticeName(ctx),
            intro: txt('helpInterstitialsExIntro'),
            steps: [{ text: txt('helpInterstitialsEx1'), tex: txt('helpInterstitialsEx1Tex') }],
          };
        }
        return {
          title: latticeName(ctx),
          steps: [
            { text: txt('helpInterstitialsEx2'), tex: txt('helpInterstitialsEx2Tex', { r: tn(fit.R) }) },
            ...fit.sites.map(s => ({
              text: txt('helpInterstitialsEx3', { name: s.name, f: tPoint(s.f), cn: s.cn }),
              tex: txt('helpInterstitialsEx3Tex', { d: tn(s.d), rMax: tn(s.r), ratio: tn(s.ratio, 3), tex: s.tex }),
            })),
          ],
          result: txt('helpInterstitialsExResult'),
        };
      },
    },
    related: ['site-count', 'atom-fit', 'display-mode', 'calc-packing', 'calc-nn'],
  },

  ...SITE_TOPICS,

  {
    key: 'site-count',
    title: txt('helpSiteCountTitle'),
    icon: 'count',
    scope: txt('helpCubicPIF'),
    explain: txt('helpSiteCountExplain'),
    formulas: [
      { tex: txt('helpSiteCountFormula1') },
      { tex: txt('helpSiteCountFormula2') },
    ],
    symbols: [
      [txt('helpSiteCountSym1'), txt('helpSiteCountSym1Text')],
      [txt('helpSiteCountSym2'), txt('helpSiteCountSym2Text')],
      [txt('helpSiteCountSym3'), txt('helpSiteCountSym3Text')],
    ],
    now(ctx) {
      const sites = M.sceneSites(ctx);
      if (!sites) return txt('helpNotAvailableCubic', { lattice: latticeName(ctx) });
      return txt('helpSiteCountNow2', { lattice: latticeName(ctx), sites: sites.map(s => txt('helpSiteCountRow', { count: trim(s.count.total), kind: M.SITE_KINDS[s.kind].adjective, perPoint: trim(s.perPoint, 3) })).join('; ') });
    },
    more: {
      steps: [
        { text: txt('helpSiteCountStep1'), tex: txt('helpSiteCountStep1Tex') },
        { text: txt('helpSiteCountStep2'), tex: txt('helpSiteCountStep2Tex') },
        { text: txt('helpSiteCountStep3'), tex: txt('helpSiteCountStep3Tex') },
        { text: txt('helpSiteCountStep4'), tex: txt('helpSiteCountStep4Tex') },
        { text: txt('helpSiteCountStep5'), tex: txt('helpSiteCountStep5Tex') },
        { text: txt('helpSiteCountStep6'), tex: txt('helpSiteCountStep6Tex') },
        { text: txt('helpSiteCountStep7') },
      ],
      highlight: ctx => allSites(ctx, { labels: true }),
      example(ctx) {
        const sites = M.sceneSites(ctx);
        if (!sites) {
          return {
            title: latticeName(ctx),
            intro: txt('helpSiteCountExIntro'),
            steps: [{ tex: txt('helpSiteCountEx1Tex') }],
          };
        }
        return {
          title: latticeName(ctx),
          steps: sites.map(s => ({
            text: txt('helpSiteCountEx2', { name: M.SITE_KINDS[s.kind].name, where: s.where }),
            tex: txt('helpSiteCountEx2Tex', { kind: s.kind, count: countTex(s.count), total: trim(s.count.total), n: trim(s.N), perPoint: tn(s.perPoint, 3) }),
          })),
          result: txt('helpSiteCountExResult', { sites: sitesPerCell(sites), points: txt(sites[0].N === 1 ? 'helpLatticePointPerCell' : 'helpLatticePointsPerCell', { n: trim(sites[0].N) }) }),
        };
      },
    },
    related: ['interstitials', 'calc-points'],
  },

  {
    key: 'atom-fit',
    title: txt('fitTitle'),
    icon: 'fit',
    scope: txt('helpCubicPIF'),
    explain: txt('helpAtomFitExplain'),
    formulas: [
      { tex: txt('helpAtomFitFormula1') },
      { tex: txt('helpAtomFitFormula2') },
    ],
    symbols: [
      [txt('helpAtomFitSym1'), txt('helpAtomFitSym1Text')],
      [txt('helpAtomFitSym2'), txt('helpAtomFitSym2Text')],
      [txt('helpAtomFitSym3'), txt('helpAtomFitSym3Text')],
      [txt('helpAtomFitSym4'), txt('helpAtomFitSym4Text')],
    ],
    now(ctx, item) {
      const own = item && item.type === 'atom-fit' ? item : null;
      const sites = M.sceneSites(ctx);
      if (!sites) return txt('helpNotAvailableCubic', { lattice: latticeName(ctx) });
      if (!own) return txt('helpAtomFitNow2', { lattice: latticeName(ctx), ratios: sites.map(s => `${M.SITE_KINDS[s.kind].adjective} ${s.ratio.toFixed(3)}`).join(', ') });
      const s = sites.find(x => x.kind === own.kind) || sites[0];
      const ratio = own.r / s.R;
      return txt(ratio <= s.ratio + 1e-9 ? 'helpAtomFitNow3' : 'helpAtomFitNow3TooBig', { name: own.name, ratio: ratio.toFixed(3), critical: s.ratio.toFixed(3) });
    },
    more: {
      steps: [
        { text: txt('helpAtomFitStep1'), tex: txt('helpAtomFitStep1Tex') },
        { text: txt('helpAtomFitStep2'), tex: txt('helpAtomFitStep2Tex') },
        { text: txt('helpAtomFitStep3'), tex: txt('helpAtomFitStep3Tex') },
        { text: txt('helpAtomFitStep4'), tex: txt('formulaFitRatio') },
        { text: txt('helpAtomFitStep5'), tex: txt('formulaFitDelta') },
        { text: txt('helpAtomFitStep6'), tex: txt('helpAtomFitStep6Tex') },
      ],
      highlight(ctx, item) {
        const own = item && item.type === 'atom-fit' ? item : (ctx.items || []).find(i => i.type === 'atom-fit');
        if (own) return fitOverlap(ctx, own);
        const sites = M.sceneSites(ctx);
        return sites ? fitOverlap(ctx, { kind: sites[0].kind, at: sites[0].rep, r: 1.15 * sites[0].rMax }) : fitOverlap(ctx, { kind: 'oct', at: [0.5, 0.5, 0.5], r: 0.5 });
      },
      example(ctx, item) {
        const sites = M.sceneSites(ctx);
        if (!sites) {
          return {
            title: latticeName(ctx),
            intro: txt('helpAtomFitExIntro'),
            steps: [
              { text: txt('helpAtomFitEx1'), tex: txt('helpAtomFitEx1Tex') },
              { text: txt('helpAtomFitEx2'), tex: txt('helpAtomFitEx2Tex') },
            ],
          };
        }
        const own = item && item.type === 'atom-fit' ? item : (ctx.items || []).find(i => i.type === 'atom-fit');
        const s = (own && sites.find(x => x.kind === own.kind)) || sites[0];
        const r = own ? own.r : 1.15 * s.rMax;
        const at = own ? M.add(ctx.cellOrigin, own.at) : M.add(ctx.cellOrigin, s.rep);
        const fit = M.fitAtom(ctx.lattice, ctx.basis, at, r, s.R, s.cn);
        const moving = fit.shells.filter(sh => sh.move > 1e-9);
        return {
          title: latticeName(ctx),
          intro: own ? txt('helpAtomFitExIntro2', { name: own.name, r: tn(r, 3), adjective: M.SITE_KINDS[s.kind].adjective }) : txt('helpAtomFitExIntroElse', { adjective: M.SITE_KINDS[s.kind].adjective }),
          steps: [
            { text: txt('helpAtomFitEx3'), tex: txt('helpAtomFitEx3Tex', { r: tn(fit.R), d: tn(fit.d), rMax: tn(fit.rMax) }) },
            { text: txt('helpAtomFitEx4'), tex: txt('helpAtomFitEx4Tex', { r2: tn(r, 3), r3: tn(fit.R), ratio: tn(fit.ratio, 3), fits: fit.fits ? R`\le` : '>', critical: tn(fit.critical, 3) }) },
            ...(fit.fits
              ? [{ text: txt('helpAtomFitEx5'), tex: txt('helpAtomFitEx5Tex', { max2: tn(Math.max(0, fit.room), 3) }) }]
              : moving.map(sh => ({ text: txt(sh.count === 1 ? 'helpAtomFitEx6One' : 'helpAtomFitEx6', { count: sh.count, d: tn(sh.d) }), tex: txt('helpAtomFitEx6Tex', { r: tn(r, 3), host: tn(fit.R), d: tn(sh.d), move: tn(sh.move, 3), percent: tn(100 * sh.move / sh.d, 2) }) }))),
          ],
          result: fit.fits ? txt('helpAtomFitExResult') : txt('helpAtomFitExResultElse'),
        };
      },
    },
    related: ['interstitials', 'site-count'],
  },
];
