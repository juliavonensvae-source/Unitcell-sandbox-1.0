/* The input bar for everything, redefining objects, the moved origin.
   Runs the real SceneModel (the workspace without its DOM). */
import { describe, it, expect } from 'vitest';
import * as M from '../src/math/index.js';
import { plainText } from '../src/objects/model.js';
import { getType, menuEntries } from '../src/objects/index.js';
import { model, run } from './helpers.js';
import { commandList } from '../src/objects/commands.js';
import { interceptModel } from '../src/objects/intercepts.js';

describe('Input bar: every + Add item and every calculation has a command', () => {
  // Crystal Structures; the Defects mode's entries are checked in defects.test.js
  const entries = menuEntries().filter(e => (getType(e.type).dim || '3d') === '3d' && !getType(e.type).mode);

  it('every 3D menu entry names its command', () => {
    expect(entries.filter(e => !e.command).map(e => e.key)).toEqual([]);
  });

  for (const e of entries) {
    it(`${e.title}: ${e.command}`, () => {
      const m = model();
      m.state.advanced = true;
      if (!e.command.includes('=')) { // commands that use other objects get them first
        run(m, 'd1 = [1 1 0]');
        run(m, 'p1 = (1 1 1)');
        run(m, 'p2 = (1 -1 0)');
      }
      const before = m.state.items.length;
      run(m, e.command);
      expect(m.state.items.length).toBeGreaterThan(before);
      expect(m.state.items[m.state.items.length - 1].type).toBe(e.type);
    });
  }

  it('calculations: Volume() → vol1, Points(), Packing(), Neighbours(), SpacingTable(), Bragg(), Metric()', () => {
    const m = model();
    m.state.advanced = true;
    for (const c of ['Volume()', 'Points()', 'Packing()', 'Neighbours()', 'SpacingTable()', 'Bragg()', 'Metric()']) run(m, c);
    expect(m.state.items.map(i => i.type)).toEqual(['calc-volume', 'calc-points', 'calc-packing', 'calc-nn', 'calc-dspacing', 'calc-bragg', 'calc-metric']);
    expect(m.state.items[0].name).toBe('vol1');
  });

  it('Advanced-only calculations explain themselves in Basic mode', () => {
    expect(model().runCommand('Bragg()').error).toMatch(/Advanced/);
  });

  it('Family(p1) shows all parallel planes of p1; f = Family(p1) makes a new plane', () => {
    const m = model();
    run(m, 'p1 = (1 1 0)');
    run(m, 'Family(p1)');
    expect(m.byName('p1').family).toBe(true);
    run(m, 'f = Family(p1)');
    expect(m.byName('f')).toMatchObject({ type: 'plane', family: true, text: '1 1 0' });
  });

  it('objects made by a command are normal objects with a definition', () => {
    const m = model();
    run(m, 'p1 = (1 1 1)');
    run(m, 's = Spacing(p1)');
    const s = m.byName('s');
    expect(getType(s.type).definition(s, m.ctx)).toBe('s = Spacing(p1)');
    expect(getType('plane').definition(m.byName('p1'), m.ctx)).toBe('p1 = (1 1 1)');
  });
});

describe('Input bar: editing a definition', () => {
  it('p1 = (1 1 1) → p1 = (1 0 0) updates p1 and the interplanar distance that uses it', () => {
    const m = model('cF');
    run(m, 'p1 = (1 1 1)');
    run(m, 'Spacing(p1)');
    const sp = m.viewItems().find(i => i.type === 'spacing');
    const d = () => plainText(getType('spacing').summary(sp, m.ctx));
    expect(d()).toMatch(/111/);
    const res = run(m, 'p1 = (1 0 0)', { full: true });
    expect(res.changed).toBe(true);
    expect(m.byName('p1').parsed.hkl).toEqual([1, 0, 0]);
    expect(d()).toMatch(/200/);
  });

  it('sp1 = Spacing(p2) points an existing interplanar distance at another plane', () => {
    const m = model('cF');
    run(m, 'p1 = (1 1 1)');
    run(m, 'p2 = (1 0 0)');
    run(m, 'sp1 = Spacing(p1)');
    run(m, 'sp1 = Spacing(p2)');
    expect(m.byName('sp1').src).toBe(m.byName('p2').id);
    expect(m.viewItems().filter(i => i.type === 'spacing')).toHaveLength(1);
  });

  it('ang1 = Angle(d1, p2) changes the angle; a direction redefined as an intersection follows its planes', () => {
    const m = model();
    run(m, 'd1 = [1 1 1]');
    run(m, 'p1 = (1 1 1)');
    run(m, 'p2 = (1 0 0)');
    run(m, 'ang1 = Angle(d1, p1)');
    run(m, 'ang1 = Angle(d1, p2)');
    expect(m.byName('ang1').b).toBe(m.byName('p2').id);
    run(m, 'z = Intersection(p1, p2)');
    run(m, 'p2 = (0 1 0)');
    const z = m.byName('z').parsed.uvw.join();
    expect(['1,0,-1', '-1,0,1']).toContain(z);
  });

  it('a name already used by another kind of object is refused', () => {
    const m = model();
    run(m, 'p1 = (1 1 1)');
    expect(m.runCommand('p1 = [1 1 0]').error).toMatch(/p1 is already a plane, not a direction/);
    expect(m.runCommand('p1 = Volume()').error).toMatch(/p1 is already a plane/);
  });
});

describe('Input bar: plain-language errors', () => {
  it('unknown names', () => {
    const m = model();
    run(m, 'p1 = (1 1 1)');
    expect(m.runCommand('Angle(d9, p1)').error).toMatch(/^d9 doesn't exist yet\. Names in use: p1\./);
    expect(m.runCommand('p3').error).toMatch(/^p3 doesn't exist yet/);
  });

  it('unknown commands, wrong numbers of arguments, unmatched brackets', () => {
    const m = model();
    expect(m.runCommand('Frobnicate(p1)').error).toMatch(/I don't know the command “Frobnicate”/);
    expect(m.runCommand('Angle(p1)').error).toMatch(/Angle needs 2 names separated by a comma/);
    expect(m.runCommand('Spacing((1 1 1)').error).toMatch(/brackets don’t match|bracket is missing|couldn’t read/);
  });

  it('indices typed as arguments are created, and removed again if the command fails', () => {
    const m = model();
    run(m, 'Spacing((1,1,1))');
    expect(m.viewItems().map(i => i.type)).toEqual(['plane', 'spacing']);
    expect(m.runCommand('Spacing([1 0 0])').error).toMatch(/is a direction/);
    expect(m.viewItems().map(i => i.type)).toEqual(['plane', 'spacing']);
  });

  it('the command list covers every command', () => {
    const names = commandList().map(c => c.name);
    for (const n of ['Angle', 'Intersection', 'Family', 'Spacing', 'Intercepts', 'Components', 'Volume', 'Points', 'Packing', 'Neighbours', 'SpacingTable', 'Bragg', 'Metric']) {
      expect(names).toContain(n);
    }
  });
});

describe('Moved origin (highlighted cell)', () => {
  const big = () => {
    const m = model();
    m.state.repeats = [5, 5, 5];
    m.state.cell = [3, 3, 3];
    m.recompute();
    return m;
  };

  it('cell (3,3,3) of a 5×5×5 supercell has its origin at (2, 2, 2); cell (1,1,1) at (0, 0, 0)', () => {
    const m = big();
    expect(m.ctx.origin).toEqual([2, 2, 2]);
    m.state.cell = [1, 1, 1];
    m.recompute();
    expect(m.ctx.origin).toEqual([0, 0, 0]);
  });

  it('direction [111] runs from (2, 2, 2) to (3, 3, 3)', () => {
    const m = big();
    const d = run(m, 'd1 = [1 1 1]');
    const arrow = getType('direction').primitives(d, m.ctx).find(p => p.kind === 'arrow');
    const L = m.ctx.lattice;
    expect(L.toFractional(arrow.from).map(x => +x.toFixed(9))).toEqual([2, 2, 2]);
    expect(L.toFractional(arrow.to).map(x => +x.toFixed(9))).toEqual([3, 3, 3]);
  });

  it('the intercepts of (111) are measured from the new origin', () => {
    const m = big();
    run(m, 'p1 = (1 1 1)');
    const ic = run(m, 'Intercepts(p1)');
    const im = interceptModel(ic, m.ctx);
    expect(im.origin).toEqual([2, 2, 2]);
    expect(im.axes.map(a => a.at.join())).toEqual(['3,2,2', '2,3,2', '2,2,3']);
    // another corner of the same cell, chosen in the Cell field
    m.state.corner = [1, 1, 1];
    ic.autoCorner = false;
    m.recompute();
    expect(interceptModel(ic, m.ctx).origin).toEqual([3, 3, 3]);
  });

  it('labels stay plain text without a browser', () => {
    const m = model();
    run(m, 'd1 = [1 -1 0]');
    expect(m.ctx.labelText(m.byName('d1'))).toBe('d1 [11̅0]');
    expect(plainText('a &amp; b')).toBe('a & b');
  });
});

describe('Cut spheres follow the highlighted cell', () => {
  it('the cut region is the highlighted cell, and still holds 4 points in cubic F', () => {
    const m = model('cF');
    m.state.repeats = [3, 3, 3];
    m.state.cell = [2, 3, 1];
    m.recompute();
    expect(m.ctx.unitRegion.vertices[0]).toEqual([1, 2, 0]);
    expect(M.pointCount(m.ctx.basis, m.ctx.unitRegion).total).toBeCloseTo(4, 9);
  });
});
