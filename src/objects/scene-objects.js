/* The fixed scene objects: lattice points, cell edges and axes.
   Points and edges are drawn by CrystalView.setLattice (the workspace reads
   their fields); the axes are ordinary primitives. */
import { registerType } from './registry.js';
import { sig, trim } from '../ui/format.js';
import { dot, norm, acosDeg } from '../math/linalg.js';
import { HELP } from '../help/content.js';
import { toggle, segmented, range, note, helpButton, kindSwatches } from '../ui/controls.js';
import { txt } from '../text.js';

registerType({
  type: 'lattice-points',
  title: txt('latticePointsTitle'),
  icon: 'points',
  help: 'lattice-points',
  fixed: true,
  appearance: true,
  themeColour: true,
  autoLabel: () => txt('latticePointsTitle'),
  summary(item, ctx) {
    const n = ctx.flat ? ctx.flat.sites.length : ctx.sites.length;
    const dnn = ctx.flat ? ctx.flat.dnn : ctx.analysis.neighbours.dnn;
    return item.mode === 'spheres'
      ? txt(ctx.flat ? 'pointsSummaryCircles' : 'pointsSummarySpheres', { count: n, radius: sig(dnn / 2) })
      : txt(n === 1 ? 'pointsDrawnOne' : 'pointsDrawnMany', { count: n });
  },
  settings(item, ctx) {
    const spheres = item.mode === 'spheres';
    const dnn = ctx.flat ? ctx.flat.dnn : ctx.analysis.neighbours.dnn;
    return `
      <div class="field"><div class="field-label"><span>${txt('pointsShowAs')}${helpButton('display-mode')}</span></div>
        ${segmented('mode', [{ value: 'points', label: txt('pointsPoints'), icon: 'points' }, { value: 'spheres', label: txt('pointsSpheres'), icon: 'spheres' }], item.mode)}
      </div>
      ${note(spheres
        ? txt('pointsRadiusNote', { radius: sig(dnn / 2) })
        : HELP['lattice-points'])}
      ${range('size', item.size[item.mode], { min: 20, max: 200, step: 5, label: spheres ? txt('pointsSizeTouching') : txt('pointsSize') })}
      ${toggle('cut', ctx.ws.state.cut, `${txt('pointsCut')}${helpButton('cut-spheres')}`, { hint: txt('pointsCutHint') })}
      ${ctx.flat ? '' : `<div class="field"><div class="field-label">${txt('pointsCutFaces')}</div>
        ${segmented('solid', [{ value: 'solid', label: txt('pointsSolid') }, { value: 'hollow', label: txt('pointsHollow') }], item.solid === false ? 'hollow' : 'solid')}
        <p class="field-hint">${item.solid === false ? txt('pointsHollowHint') : txt('pointsSolidHint')}${ctx.ws.state.cut ? '' : ` ${txt('pointsCutLater')}`}</p></div>`}
      ${ctx.flat ? '' : `<div class="adv-only">${toggle('bonds', item.bonds, txt('pointsBonds'))}</div>`}`;
  },
  onField(item, field, value, ctx, ws) {
    if (field === 'cut') ws.setCut(value);
    else if (field === 'mode') ws.setDisplayMode(value);
    else if (field === 'solid') { item.solid = value === 'solid'; ws.sceneObjectChanged(item, { card: true }); }
    else if (field === 'size') { item.size[item.mode] = value; ws.sceneObjectChanged(item, { card: false }); }
    else if (field === 'bonds') { item.bonds = value; ws.sceneObjectChanged(item, { card: false }); }
  },
});

registerType({
  type: 'cell-edges',
  title: txt('edgesTitle'),
  icon: 'cube',
  help: 'cell-edges',
  fixed: true,
  appearance: true,
  themeColour: true, // offers an "automatic" colour that follows light / dark mode
  autoLabel: () => txt('edgesTitle'),
  summary(item, ctx) {
    if (ctx.flat) return ctx.flat.n === 1 ? txt('edgesOne2D') : txt('edges2DSize', { n: ctx.flat.n });
    if (ctx.isPrism) {
      const [a, b, c] = ctx.repeats, n = a * b * c;
      if (n === 1) return txt('edgesOnePrism');
      return a * b === 1 ? txt('edgesPrismsStacked', { count: c }) : txt('edgesPrismField', { a, b, c, count: n });
    }
    const [a, b, c] = ctx.repeats;
    const n = a * b * c;
    return n === 1 ? txt('edgesOneCell') : txt('edgesSupercell', { a, b, c, count: n });
  },
  settings(item, ctx) {
    const multi = ctx.flat ? ctx.flat.n > 1 : ctx.repeats[0] * ctx.repeats[1] * ctx.repeats[2] > 1;
    return `
      ${range('thickness', item.thickness, { min: 25, max: 300, step: 25, label: txt('edgesThickness') })}
      ${toggle('highlight', item.highlight, txt('edgesHighlight'), { hint: multi ? txt('edgesHighlightHint', { cell: (ctx.flat || ctx).cell.join(',') }) : txt('edgesTakesEffect') })}
      ${toggle('allCells', item.allCells, txt('edgesAllCells'), { hint: multi ? txt('edgesAllCellsHint') : txt('edgesTakesEffect') })}
      ${item.allCells ? range('gridThickness', item.gridThickness, { min: 25, max: 300, step: 25, label: txt('edgesGridThickness') })
        + kindSwatches({ label: txt('edgesGridColour'), colour: item.gridColour || ctx.theme.grid, own: !!item.gridColour, act: 'grid', data: 'grid', key: 'colour', aria: txt('edgesGridColour') }) : ''}`;
  },
  onField(item, field, value, ctx, ws, phase) {
    if (field === 'grid-colour') {
      item.gridColour = value;
      ws.sceneObjectChanged(item, { card: phase === 'change' });
    } else if (['thickness', 'highlight', 'allCells', 'gridThickness'].includes(field)) {
      item[field] = value;
      ws.sceneObjectChanged(item, { card: field === 'allCells' });
    }
  },
  onAction(item, act, el, ctx, ws) {
    if (act === 'grid-auto') { item.gridColour = null; ws.sceneObjectChanged(item, { card: true }); }
  },
});

/**
 * Axes: the lattice vectors as labelled arrows from the origin, in the fixed
 * axis colours. ctx.axes = [{ key, html, vec, colour }] and ctx.axisAngles =
 * [{ sym, from, to }] are supplied by the workspace (a, b, c — or a1, a2, a3, c
 * for the hexagonal prism).
 */
registerType({
  type: 'axes',
  title: txt('axesTitle'),
  icon: 'axes',
  help: 'lattice-params',
  fixed: true,
  appearance: 'eye', // visibility only: each axis keeps its own colour
  autoLabel: () => txt('axesTitle'),
  summary: (item, ctx) => (ctx.flat
    ? txt('axesSummary2D', { a: `<i style="color:${ctx.theme.axisA}">a</i>`, b: `<i style="color:${ctx.theme.axisB}">b</i>` })
    : txt(ctx.advanced && item.angles ? 'axesSummaryAngles' : 'axesSummary', { axes: ctx.axes.map(a => `<i style="color:${a.colour}">${a.html}</i>`).join(', ') })),
  settings(item, ctx) {
    return `${note(txt('axesNote'))}
      ${ctx.hexAxes && !ctx.flat ? toggle('legend', item.legend, `${txt('axesLegend')}${helpButton('miller-bravais')}`, { hint: txt('axesLegendHint') }) : ''}
      ${ctx.flat ? '' : `<div class="adv-only">${toggle('angles', item.angles, txt('axesAngles'), { hint: txt('axesAnglesHint') })}</div>`}`;
  },
  onField(item, field, value, ctx, ws) {
    if (field === 'angles' || field === 'legend') { item[field] = value; ws.sceneObjectChanged(item, { card: false }); }
  },
  primitives(item, ctx) {
    const prims = [];
    const ext = Math.max(ctx.pointRadius, 0.04 * ctx.L0) + 0.13 * ctx.L0;
    // the axes start at the origin: a corner of the highlighted cell
    const O = ctx.originCart || [0, 0, 0];
    for (const ax of ctx.axes) {
      const len = norm(ax.vec);
      prims.push({
        kind: 'arrow', from: O, to: ax.vec.map((x, i) => O[i] + x * (len + ext) / len), colour: ax.colour, size: 0.78,
        label: `<i>${ax.html}</i>`, labelCls: 'lbl-axis', labelGap: 0.09,
      });
    }
    if (ctx.advanced && item.angles) {
      const byKey = Object.fromEntries(ctx.axes.map(a => [a.key, a]));
      const shortest = Math.min(...ctx.axes.map(a => norm(a.vec)));
      ctx.axisAngles.forEach((an, i) => {
        const u = byKey[an.from].vec, v = byKey[an.to].vec;
        const deg = acosDeg(dot(u, v) / (norm(u) * norm(v)));
        prims.push({
          kind: 'arc', centre: O, from: u, to: v, radius: (0.24 + 0.05 * i) * shortest,
          colour: ctx.theme.angle, opacity: 0.85, label: `${an.sym} = ${trim(deg, 2)}°`,
        });
      });
    }
    return prims;
  },
});
