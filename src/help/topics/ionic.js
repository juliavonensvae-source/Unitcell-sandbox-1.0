/* =====================================================================
   Help topics: ionic structures as a Bravais lattice plus a basis
   (Part 4.5). The overview 'ionic' and one topic per structure
   (ionic-NaCl, ionic-CsCl, ionic-ZnS, ionic-CaF2), each with the counting
   of the ions, the formula units, the coordination, the radius-ratio rule
   and a worked example (distance and density) with the a on screen.
   The counts and coordination numbers are worked out from the geometry
   (src/math/ionic.js), so the text always matches the 3D view.
   ===================================================================== */
import * as M from '../../math/index.js';
import { IONIC, findIonic, ionText, ionTeX, ELEMENT } from '../../data/ionic.js';
import { findBravais } from '../../data/bravais.js';
import { CENTRING } from '../../data/systems.js';
import { tn } from '../tex.js';
import { latticeName } from '../context.js';
import { trim } from '../../ui/format.js';
import { txt } from '../../text.js';

const R = String.raw;
const NA = 6.02214076e23;

/** How far apart the nearest cation and anion are, as a multiple of a, and along what. */
const CONTACT = {
  NaCl: { k: 0.5, tex: txt('helpIonicDTexNaCl'), along: txt('helpIonicAlongNaCl'), eq: txt('helpIonicTouchNaCl') },
  CsCl: { k: Math.sqrt(3) / 2, tex: txt('helpIonicDTexCsCl'), along: txt('helpIonicAlongCsCl'), eq: txt('helpIonicTouchCsCl') },
  ZnS: { k: Math.sqrt(3) / 4, tex: txt('helpIonicDTexQuarter'), along: txt('helpIonicAlongQuarter'), eq: txt('helpIonicTouchQuarter') },
  CaF2: { k: Math.sqrt(3) / 4, tex: txt('helpIonicDTexQuarter'), along: txt('helpIonicAlongQuarter'), eq: txt('helpIonicTouchQuarter') },
};

/** Measured densities (g/cm³) to compare the worked example with. */
const MEASURED = { NaCl: 2.17, CsCl: 3.99, ZnS: 4.09, CaF2: 3.18 };

const FRAC = { 0: '0', 0.25: R`\tfrac14`, 0.5: R`\tfrac12`, 0.75: R`\tfrac34` };
const tPos = f => `(${f.map(x => FRAC[x] ?? tn(x)).join(',')})`;

/** A count { groups, total } as TeX: 12\cdot\tfrac14 + 1 = 4 (whole ions inside as a plain number). */
const countTex = c => `${c.groups.map(g => (g.share === 1 ? `${g.count}${c.groups.length === 1 ? txt('helpIonicInsideTex') : ''}` : R`${g.count}\cdot\tfrac{1}{${Math.round(1 / g.share)}}`)).join(' + ')} = ${trim(c.total)}`;

/** Everything a topic needs about one structure, for its textbook cell. */
function facts(S) {
  const B = findBravais(S.lattice), centring = CENTRING[B.centring];
  const kinds = M.ionBases(S, centring), counts = M.ionCounts(S, centring, M.boxRegion([1, 1, 1]));
  const L = M.analyse({ a: S.a, b: S.a, c: S.a, alpha: 90, beta: 90, gamma: 90 }, [{ el: 'LP', f: [0, 0, 0] }]).lattice;
  const coord = M.coordination(S, centring, L);
  const ions = kinds.map(k => ({ ...k, tex: ionTeX(k.el, k.charge), text: ionText(k.el, k.charge), count: counts[k.el], cn: coord[k.el].cn, cation: k.charge.includes('+') }));
  const cation = ions.find(i => i.cation), anion = ions.find(i => !i.cation);
  const z = M.formulaUnitsOf(counts).z;
  const mass = S.ions.reduce((m, i) => m + ELEMENT(i.el).mass, 0); // per basis = per formula unit here
  return { S, B, ions, cation, anion, z, mass, nLattice: M.pointCount(M.expandBasis([{ el: 'LP', f: [0, 0, 0] }], centring), M.boxRegion([1, 1, 1])).total };
}

/** The structure a topic talks about: the item's (when it is an ionic structure), else a default. */
const structureFor = (item, fallback = 'NaCl') => findIonic(item && item.type === 'ionic' ? item.structure : fallback) || IONIC[0];

/** The a to use in examples: the one on screen when the structure's lattice is shown, else its real a. */
function exampleA(ctx, S) {
  return ctx && ctx.bravais && ctx.bravais.id === S.lattice && !ctx.flat ? ctx.params.a : S.a;
}

const basisTex = F => R`\text{${F.S.name}} = \text{${F.B.name}} + \Big\{${F.S.ions.map(i => `${ionTeX(i.el, i.charge)}\\,${tPos(i.f)}`).join(R`,\ `)}\Big\}`;
const countsTex = F => F.ions.map(i => R`N_{${i.tex}} = ${countTex(i.count)}`).join(R`,\qquad `);
const cnTex = F => txt('helpIonicZTex', { z: F.z, formula: F.S.id.replace('2', '_2'), cn: F.ions.map(i => i.cn).join(':') });

const SYMBOLS = [
  [txt('helpIonicSym3'), txt('helpIonicSym3Text')],
  [txt('helpIonicSym4'), txt('helpIonicSym4Text')],
  [txt('helpIonicSym5'), txt('helpIonicSym5Text')],
  [txt('helpIonicSym6'), txt('helpIonicSym6Text')],
  [txt('helpIonicSym7'), txt('helpIonicSym7Text')],
];

/** The explanation of each structure, written for a first-year student. */
const EXPLAIN = {
  NaCl: txt('helpIonicExplainNaCl'),
  CsCl: txt('helpIonicExplainCsCl'),
  ZnS: txt('helpIonicExplainZnS'),
  CaF2: txt('helpIonicExplainCaF2'),
};

/** Extra derivation steps that make the teaching point of each structure. */
const POINT = {
  NaCl: { text: txt('helpIonicPointNaCl') },
  CsCl: { text: txt('helpIonicPointCsCl') },
  ZnS: { text: txt('helpIonicPointZnS') },
  CaF2: { text: txt('helpIonicPointCaF2') },
};

function structureTopic(S) {
  const F = facts(S), C = CONTACT[S.id], { cation, anion } = F;
  const ratio = ELEMENT(cation.el).r / ELEMENT(anion.el).r, rule = M.ratioRule(ratio);
  return {
    key: `ionic-${S.id}`,
    title: `${S.formula} (${S.name})`,
    icon: 'ions',
    scope: txt('helpIonicTopicScope', { lattice: F.B.name, count: S.ions.length }),
    explain: EXPLAIN[S.id],
    formulas: [
      { tex: basisTex(F) },
      { tex: countsTex(F) },
      { tex: cnTex(F) },
      { tag: txt('helpIonicTouching'), tex: C.eq },
    ],
    symbols: SYMBOLS,
    now(ctx, item) {
      const a = exampleA(ctx, S);
      const shown = ctx && ctx.bravais && ctx.bravais.id === S.lattice;
      const v = { a: tn(a), cation: cation.text, anion: anion.text, d: tn(C.k * a) };
      return shown ? txt('helpIonicTopicNowShown', v) : txt('helpIonicTopicNow', { ...v, id: S.id });
    },
    more: {
      steps: [
        { text: txt(F.nLattice === 1 ? 'helpIonicTopicStep1One' : 'helpIonicTopicStep1', { lattice: F.B.name, n: trim(F.nLattice) }), tex: txt('helpIonicTopicStep1Tex', { n: trim(F.nLattice) }) },
        { text: txt('helpIonicTopicStep2', { basis: S.ions.map(i => txt('helpIonicIonAt', { ion: ionText(i.el, i.charge), pos: tPos(i.f) })).join(', ') }), tex: txt('helpIonicTopicStep2Tex') },
        { text: txt('helpIonicTopicStep3'), tex: countsTex(F) },
        { text: txt('helpIonicTopicStep4'), tex: txt('helpIonicTopicStep4Tex', { z: F.z }) },
        { text: txt('helpIonicTopicStep5', { cation: cation.text, anion: anion.text, along: C.along, neighbours: cation.cn === anion.cn ? txt('helpIonicSameCN', { cn: cation.cn }) : txt('helpIonicTwoCN', { cation: cation.text, cn: cation.cn, anion: anion.text, cn2: anion.cn }) }), tex: txt('helpIonicTopicStep5Tex', { d: C.tex, cn: F.ions.map(i => i.cn).join(':') }) },
        { text: txt('helpIonicTopicStep6'), tex: C.eq },
        { text: txt('helpIonicTopicStep7', { cn: rule.cn }), tex: txt('helpIonicTopicStep7Tex', { rPlus: tn(ELEMENT(cation.el).r, 3), rMinus: tn(ELEMENT(anion.el).r, 3), ratio: tn(ratio, 3), cn: rule.cn }) },
        POINT[S.id],
      ],
      example(ctx, item) {
        const a = exampleA(ctx, S), mine = ctx && ctx.bravais && ctx.bravais.id === S.lattice;
        const V = a ** 3, rho = F.z * F.mass / (NA * V * 1e-24);
        return {
          title: mine ? txt('helpIonicTopicExTitleShown', { formula: S.formula, a: tn(a) }) : txt('helpIonicTopicExTitle', { formula: S.formula, a: tn(a) }),
          intro: mine ? txt('helpWithYourA', { a: tn(a) }) : txt('helpIonicTopicExIntroOther', { lattice: latticeName(ctx), formula: S.formula }),
          steps: [
            { text: txt('helpIonicTopicEx1', { cation: cation.text, anion: anion.text }), tex: txt('helpIonicTopicEx1Tex', { dTex: C.tex, d: tn(C.k * a) }) },
            { text: txt('helpIonicTopicEx2'), tex: txt('helpIonicTopicEx2Tex', { rPlus: tn(ELEMENT(cation.el).r, 3), rMinus: tn(ELEMENT(anion.el).r, 3), sum: tn(ELEMENT(cation.el).r + ELEMENT(anion.el).r) }) },
            { text: txt('helpIonicTopicEx3'), tex: txt('helpIonicTopicEx3Tex', { mass: tn(F.mass), volume: tn(V) }) },
            { text: txt(F.z === 1 ? 'helpIonicTopicEx4One' : 'helpIonicTopicEx4', { z: F.z }), tex: txt('helpIonicTopicEx4Tex', { z: F.z, mass: tn(F.mass), volume: tn(V), rho: tn(rho, 3) }) },
          ],
          result: txt('helpIonicTopicExResult', { rho: tn(rho, 3), formula: S.formula, measured: MEASURED[S.id] }),
        };
      },
    },
    related: ['ionic', ...IONIC.filter(x => x !== S).map(x => `ionic-${x.id}`), 'interstitials'],
  };
}

export default [
  {
    key: 'ionic',
    title: txt('helpIonicTitle'),
    icon: 'ions',
    scope: txt('helpIonicScope'),
    explain: txt('helpIonicExplain'),
    formulas: [
      { tex: txt('formulaCrystalStructure') },
      { tex: txt('helpIonicFormula2') },
      { tag: txt('helpIonicFormula3Tag'), tex: txt('helpIonicFormula3') },
    ],
    symbols: [[txt('helpIonicSym1'), txt('helpIonicSym1Text')], [txt('helpIonicSym2'), txt('helpIonicSym2Text')], ...SYMBOLS],
    now(ctx, item) {
      const S = structureFor(item);
      const F = facts(S);
      return txt('helpIonicNow', { formula: S.formula, name: F.B.name, basis: S.ions.map(i => ionText(i.el, i.charge)).join(' + '), ions: F.ions.map(i => `${trim(i.count.total)} ${i.text}`).join(` ${txt('wordAnd')} `), z: F.z });
    },
    more: {
      steps: [
        { text: txt('helpIonicStep1') },
        { text: txt('helpIonicStep2'), tex: txt('helpIonicStep2Tex') },
        { text: txt('helpIonicStep3'), tex: txt('helpIonicStep3Tex') },
        { text: txt('helpIonicStep4'), tex: txt('helpIonicStep4Tex') },
        { text: txt('helpIonicStep5'), tex: txt('helpIonicStep5Tex') },
        { text: txt('helpIonicStep6'), tex: txt('helpIonicStep6Tex') },
        { text: txt('helpIonicStep7') },
      ],
      example(ctx, item) {
        const S = structureFor(item), F = facts(S);
        return {
          title: txt('helpIonicExTitle', { formula: S.formula, name: S.name }),
          intro: item && item.type === 'ionic' ? txt('helpIonicExIntro') : txt('helpIonicExIntroElse'),
          steps: [
            { text: txt('helpIonicEx1'), tex: basisTex(F) },
            { text: txt('helpIonicEx2'), tex: countsTex(F) },
            { text: txt('helpIonicEx3'), tex: cnTex(F) },
          ],
          result: txt('helpIonicExResult', { formula: S.formula, ions: F.ions.map(i => `${trim(i.count.total)} ${i.text}`).join(' + '), z: F.z, cn: F.ions.map(i => i.cn).join(':') }),
        };
      },
    },
    related: [...IONIC.map(S => `ionic-${S.id}`), 'interstitials', 'calc-points'],
  },
  ...IONIC.map(structureTopic),
];
