import { describe, it, expect } from 'vitest';
import { buildCases } from '../src/verification/cases.js';

const cases = buildCases();
const groups = [...new Set(cases.map(c => c.group))];

for (const group of groups) {
  describe(group, () => {
    for (const c of cases.filter(x => x.group === group)) {
      it(c.name, () => {
        if (typeof c.want === 'boolean') {
          expect(c.got, c.name).toBe(true);
        } else {
          expect(Number.isFinite(c.got), `${c.name}: got ${c.got}`).toBe(true);
          expect(Math.abs(c.got - c.want), `${c.name}: got ${c.got}${c.unit}, expected ${c.want}${c.unit} ± ${c.tol}`)
            .toBeLessThanOrEqual(c.tol);
        }
      });
    }
  });
}
