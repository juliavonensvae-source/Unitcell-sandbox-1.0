/* Style rules: the CSS stays brutalist (square corners, no shadows, tokens only). */
import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

const STYLES = join(import.meta.dirname, '..', 'src', 'styles');
const css = Object.fromEntries(readdirSync(STYLES).filter(f => f.endsWith('.css')).map(f => [f, readFileSync(join(STYLES, f), 'utf8')]));

describe('§2 Brutalist style rules', () => {
  it('corners are 0–2 px (circles only for dots that stand for atoms)', () => {
    for (const [file, text] of Object.entries(css)) {
      for (const [, v] of text.matchAll(/border-radius:\s*([^;}]+)/g)) {
        const value = v.trim();
        if (['0', '50%', 'inherit', 'var(--radius)'].includes(value)) continue;
        const px = [...value.matchAll(/(\d*\.?\d+)px/g)].map(m => +m[1]);
        expect(px.length, `${file}: border-radius ${value}`).toBeGreaterThan(0);
        expect(Math.max(...px), `${file}: border-radius ${value}`).toBeLessThanOrEqual(2);
      }
    }
  });
  it('no soft drop shadows or glows: box-shadow is none or a hard ring (no blur)', () => {
    for (const [file, text] of Object.entries(css)) {
      for (const [, v] of text.matchAll(/box-shadow:\s*([^;}]+)/g)) {
        if (/^(none|var\(--ring\))/.test(v.trim())) continue;
        for (const part of v.split(/,(?![^(]*\))/)) {
          const nums = [...part.replace(/rgba?\([^)]*\)|color-mix\([^)]*\)/g, '').matchAll(/(-?\d*\.?\d+)px/g)].map(m => +m[1]);
          // x y blur spread: the blur (third length) must be 0
          expect(nums[2] || 0, `${file}: box-shadow ${v}`).toBe(0);
        }
      }
    }
  });
  it('colours, borders, radius and fonts are shared CSS variables', () => {
    for (const token of ['--radius', '--border-w', '--border-w-strong', '--font-ui', '--font-mono', '--primary', '--line', '--line-strong', '--t-fast']) {
      expect(css['tokens.css']).toContain(`${token}:`);
    }
    expect(css['tokens.css']).toMatch(/--font-ui:\s*"Inter"/);
    expect(css['tokens.css']).toMatch(/--font-mono:\s*"JetBrains Mono"/);
  });
  it('no gradient text and no bouncing (spring) easing', () => {
    for (const [file, text] of Object.entries(css)) {
      expect(text, file).not.toMatch(/background-clip:\s*text/);
      expect(text, file).not.toMatch(/cubic-bezier\([^)]*1\.\d/);
    }
  });
  it('the two-star sparkle symbol is gone', () => {
    const src = join(import.meta.dirname, '..', 'src');
    const walk = dir => readdirSync(dir, { withFileTypes: true }).flatMap(d => (d.isDirectory() ? walk(join(dir, d.name)) : [join(dir, d.name)]));
    for (const f of walk(src).filter(p => /\.(js|css|html)$/.test(p))) {
      expect(readFileSync(f, 'utf8'), f).not.toMatch(/sparkle|✦|✨|✧/);
    }
  });
});
