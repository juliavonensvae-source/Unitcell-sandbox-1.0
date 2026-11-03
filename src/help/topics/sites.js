/* =====================================================================
   Help topics: one per kind of interstitial site (site-cP-cub, site-cI-oct,
   site-cI-tet, site-cF-oct, site-cF-tet), each with the full derivation,
   a 3D highlight of the hole and the lines the derivation measures, and a
   worked example with the a on screen. The overview topics are in
   interstitials.js.
   ===================================================================== */
import * as M from '../../math/index.js';
import { tn, tPoint } from '../tex.js';
import { latticeName } from '../context.js';
import { octahedralDiagram, bccOctahedralDiagram, cubicHoleDiagram } from '../diagrams.js';
import { siteDerivation } from '../highlights-sites.js';
import { trim } from '../../ui/format.js';
import { txt } from '../../text.js';

const LATTICE_NAME = { cP: txt('helpSiteLatticeCP'), cI: txt('helpSiteLatticeCI'), cF: txt('helpSiteLatticeCF') };
const idealTex = { 'cP-cub': txt('helpCritCP'), 'cI-oct': txt('helpCritCIOct'), 'cI-tet': txt('helpSiteIdealCITet'), 'cF-oct': txt('helpCritCFOct'), 'cF-tet': txt('helpSiteIdealCFTet') };

/** A count { groups, total } as TeX: 12\cdot\tfrac14 + 1\cdot 1 = 4 */
export const countTex = c => `${c.groups.map(g => `${g.count}\\cdot ${g.share === 1 ? '1' : `\\tfrac{1}{${Math.round(1 / g.share)}}`}`).join(' + ')} = ${trim(c.total)}`;

/* ---------- one topic per kind of site ---------- */
const SITE_DEFS = [
  {
    lattice: 'cP', kind: 'cub', title: txt('helpSiteCPCubTitle'),
    explain: txt('helpSiteCPCubExplain'),
    formulas: [{ tex: txt('helpSiteCPCubFormula1Tex') }, { tex: txt('helpSiteCPCubFormula2Tex') }],
    Rtex: txt('helpSiteCPCubRtex'), Rof: a => a / 2, dtex: txt('helpSiteCPCubDtex'), dof: a => Math.sqrt(3) * a / 2,
    steps: [
      { text: txt('helpSiteCPCubStep1'), tex: txt('helpSiteCPCubStep1Tex') },
      { text: txt('helpSiteCPCubStep2'), tex: txt('helpSiteCPCubStep2Tex') },
      { text: txt('helpSiteCPCubStep3'), tex: txt('helpSiteCPCubStep3Tex') },
      { text: txt('helpSiteCPCubStep4'), tex: txt('helpSiteCPCubStep4Tex') },
      { text: txt('helpSiteCPCubStep5'), tex: txt('helpSiteCPCubStep5Tex') },
      { text: txt('helpSiteCPCubStep6'), tex: txt('helpSiteCPCubStep6Tex') },
    ],
    diagram: cubicHoleDiagram,
    hl: { site: [0.5, 0.5, 0.5], lines: [{ from: [0, 0, 0], to: [1, 1, 1], label: txt('helpSiteCPCubHlLabel1') }, { from: [0, 0, 0], to: [1, 0, 0], label: txt('helpSiteCPCubHlLabel2') }] },
  },
  {
    lattice: 'cI', kind: 'oct', title: txt('helpSiteCIOctTitle'),
    explain: txt('helpSiteCIOctExplain'),
    formulas: [{ tex: txt('helpSiteCIOctFormula1Tex') }, { tex: txt('helpSiteCIOctFormula2Tex') }],
    Rtex: txt('helpSiteCIOctRtex'), Rof: a => Math.sqrt(3) * a / 4, dtex: txt('helpSiteCIOctDtex'), dof: a => a / 2,
    steps: [
      { text: txt('helpSiteCIOctStep1'), tex: txt('helpSiteCIOctStep1Tex') },
      { text: txt('helpSiteCIOctStep2'), tex: txt('helpSiteCIOctStep2Tex') },
      { text: txt('helpSiteCIOctStep3'), tex: txt('helpSiteCIOctStep3Tex') },
      { text: txt('helpSiteCIOctStep4'), tex: txt('helpSiteCIOctStep4Tex') },
      { text: txt('helpSiteCIOctStep5'), tex: txt('helpSiteCIOctStep5Tex') },
      { text: txt('helpSiteCIOctStep6'), tex: txt('helpSiteCIOctStep6Tex') },
    ],
    diagram: bccOctahedralDiagram,
    hl: { site: [0.5, 0, 0], lines: [{ from: [0, 0, 0], to: [1, 0, 0], label: txt('helpSiteCIOctHlLabel1') }, { from: [0, 0, 0], to: [0.5, 0.5, 0.5], label: txt('helpSiteCIOctHlLabel2') }] },
  },
  {
    lattice: 'cI', kind: 'tet', title: txt('helpSiteCITetTitle'),
    explain: txt('helpSiteCITetExplain'),
    formulas: [{ tex: txt('helpSiteCITetFormula1Tex') }, { tex: txt('helpSiteCITetFormula2Tex') }],
    Rtex: txt('helpSiteCITetRtex'), Rof: a => Math.sqrt(3) * a / 4, dtex: txt('helpSiteCITetDtex'), dof: a => Math.sqrt(5) * a / 4,
    steps: [
      { text: txt('helpSiteCITetStep1'), tex: txt('helpSiteCITetStep1Tex') },
      { text: txt('helpSiteCITetStep2'), tex: txt('helpSiteCITetStep2Tex') },
      { text: txt('helpSiteCITetStep3'), tex: txt('helpSiteCITetStep3Tex') },
      { text: txt('helpSiteCITetStep4'), tex: txt('helpSiteCITetStep4Tex') },
      { text: txt('helpSiteCITetStep5') },
      { text: txt('helpSiteCITetStep6'), tex: txt('helpSiteCITetStep6Tex') },
    ],
    hl: { site: [0.5, 0.25, 0], lines: [{ from: [0.5, 0.25, 0], to: [0, 0, 0], label: txt('helpSiteCITetHlLabel1') }, { from: [0, 0, 0], to: [0.5, 0.5, 0.5], label: txt('helpSiteCITetHlLabel2') }] },
  },
  {
    lattice: 'cF', kind: 'oct', title: txt('helpSiteCFOctTitle'),
    explain: txt('helpSiteCFOctExplain'),
    formulas: [{ tex: txt('helpSiteCFOctFormula1Tex') }, { tex: txt('helpSiteCFOctFormula2Tex') }],
    Rtex: txt('helpSiteCFOctRtex'), Rof: a => Math.SQRT2 * a / 4, dtex: txt('helpSiteCFOctDtex'), dof: a => a / 2,
    steps: [
      { text: txt('helpSiteCFOctStep1'), tex: txt('helpSiteCFOctStep1Tex') },
      { text: txt('helpSiteCFOctStep2'), tex: txt('helpSiteCFOctStep2Tex') },
      { text: txt('helpSiteCFOctStep3'), tex: txt('helpSiteCFOctStep3Tex') },
      { text: txt('helpSiteCFOctStep4'), tex: txt('helpSiteCFOctStep4Tex') },
      { text: txt('helpSiteCFOctStep5'), tex: txt('helpSiteCFOctStep5Tex') },
      { text: txt('helpSiteCFOctStep6'), tex: txt('helpSiteCFOctStep6Tex') },
    ],
    diagram: octahedralDiagram,
    hl: { site: [0.5, 0, 0], lines: [{ from: [0, 0, 0], to: [1, 0, 0], label: txt('helpSiteCFOctHlLabel1') }, { from: [0, 0, 0], to: [1, 1, 0], label: txt('helpSiteCFOctHlLabel2') }] },
  },
  {
    lattice: 'cF', kind: 'tet', title: txt('helpSiteCFTetTitle'),
    explain: txt('helpSiteCFTetExplain'),
    formulas: [{ tex: txt('helpSiteCFTetFormula1Tex') }, { tex: txt('helpSiteCFTetFormula2Tex') }],
    Rtex: txt('helpSiteCFTetRtex'), Rof: a => Math.SQRT2 * a / 4, dtex: txt('helpSiteCFTetDtex'), dof: a => Math.sqrt(3) * a / 4,
    steps: [
      { text: txt('helpSiteCFTetStep1'), tex: txt('helpSiteCFTetStep1Tex') },
      { text: txt('helpSiteCFTetStep2'), tex: txt('helpSiteCFTetStep2Tex') },
      { text: txt('helpSiteCFTetStep3'), tex: txt('helpSiteCFTetStep3Tex') },
      { text: txt('helpSiteCFTetStep4'), tex: txt('helpSiteCFTetStep4Tex') },
      { text: txt('helpSiteCFTetStep5') },
      { text: txt('helpSiteCFTetStep6'), tex: txt('helpSiteCFTetStep6Tex') },
    ],
    hl: { site: [0.25, 0.25, 0.25], lines: [{ from: [0, 0, 0], to: [0.25, 0.25, 0.25], label: txt('helpSiteCFTetHlLabel1') }, { from: [0, 0, 0], to: [0.5, 0.5, 0], label: txt('helpSiteCFTetHlLabel2') }] },
  },
];

const symbolsFor = def => [
  [txt('helpSiteSym1'), txt('helpSiteSym1Text')],
  [txt('helpSiteSym2'), txt('helpSiteSym2Text')],
  [txt('helpSiteSym3'), txt('helpSiteSym3Text', { kind: M.SITE_KINDS[def.kind].adjective })],
];

function siteTopic(def) {
  const id = `${def.lattice}-${def.kind}`, kindName = M.SITE_KINDS[def.kind].adjective, name = LATTICE_NAME[def.lattice];
  const spec = M.siteSpec(def.lattice, def.kind);
  return {
    key: `site-${id}`,
    title: def.title,
    icon: 'void',
    scope: txt('helpSiteScope', { lattice: `${name[0].toUpperCase()}${name.slice(1)}` }),
    explain: def.explain,
    formulas: def.formulas.map((f, i) => ({ ...f, tag: i === 0 ? name[0].toUpperCase() + name.slice(1) : '' })),
    symbols: symbolsFor(def),
    now(ctx) {
      if (ctx.bravais.id !== def.lattice) return txt('helpSiteNowOther', { lattice: latticeName(ctx), name });
      const s = M.sceneSites(ctx).find(x => x.kind === def.kind);
      return txt('helpSiteNow', { a: tn(ctx.params.a), rHost: tn(s.R), rMax: tn(s.rMax) });
    },
    more: {
      steps: def.steps,
      ...(def.diagram ? { diagram: def.diagram } : {}),
      highlight: ctx => siteDerivation(ctx, { ...def.hl, lattice: def.lattice, kind: def.kind, name }),
      example(ctx) {
        const mine = ctx.bravais.id === def.lattice, a = mine ? ctx.params.a : 4;
        const Rh = def.Rof(a), d = def.dof(a), r = d - Rh;
        const count = mine ? M.sceneSites(ctx).find(x => x.kind === def.kind).count : null;
        return {
          title: mine ? latticeName(ctx) : txt('helpSiteExTitleOther', { lattice: `${name[0].toUpperCase()}${name.slice(1)}` }),
          intro: mine ? txt('helpWithYourA', { a: tn(a) }) : txt('helpSiteExIntroOther', { lattice: latticeName(ctx), name }),
          steps: [
            { text: txt('helpSiteEx1'), tex: txt('helpSiteEx1Tex', { rTex: def.Rtex, rHost: tn(Rh) }) },
            { text: txt('helpSiteEx2', { site: tPoint(def.hl.site), cn: spec.cn }), tex: txt('helpSiteEx2Tex', { dTex: def.dtex, dValue: tn(d) }) },
            { text: txt('helpSiteEx3'), tex: txt('helpSiteEx3Tex', { dValue: tn(d), rHost: tn(Rh), rMax: tn(r) }) },
            { text: txt('helpSiteEx4'), tex: txt('helpSiteEx4Tex', { rMax: tn(r), rHost: tn(Rh), ratio: tn(r / Rh, 3), ideal: idealTex[id] }) },
            ...(count ? [{ text: txt('helpSiteEx5', { kind: `${kindName[0].toUpperCase()}${kindName.slice(1)}` }), tex: txt('helpSiteEx5Tex', { count: countTex(count) }) }] : []),
          ],
          result: txt('helpSiteExResult', { ratio: tn(r / Rh, 3) }),
        };
      },
    },
    related: ['interstitials', 'site-count', 'atom-fit'],
  };
}

export const SITE_TOPICS = SITE_DEFS.map(siteTopic);
