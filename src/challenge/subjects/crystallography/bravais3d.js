/* =====================================================================
   Topic A: the 14 Bravais lattices in 3D.

   params-to-system         a, b, c, α, β, γ → crystal system
   params-points-to-lattice parameters + where the lattice points are → Bravais lattice
   points-per-cell          lattice points in one conventional cell
   equivalence-to-system    which planes are equivalent → crystal system

   Difficulty (agreed): easy = clear parameters (or the rule itself);
   medium = exact lattice, points per cell; hard = symmetry questions and
   close values (a = 4.00 Å, b = 4.05 Å; β = 92°).
   ===================================================================== */
import { SYSTEMS, CENTRING_INFO } from '../../../data/systems.js';
import { BRAVAIS } from '../../../data/bravais.js';
import { PERMS } from '../../../math/linalg.js';
import { int, pick, shuffle, chance, real, retry } from '../../random.js';
import { vkey, neg, signedPerms, plane } from './common.js';

const ALL_SYSTEMS = ['cubic', 'tetragonal', 'orthorhombic', 'hexagonal', 'rhombohedral', 'monoclinic', 'triclinic'];

/** Systems that are easy to mix up with each one (the wrong options come from here first). */
const LOOKALIKE = {
  cubic: ['tetragonal', 'rhombohedral', 'orthorhombic'],
  tetragonal: ['cubic', 'orthorhombic', 'hexagonal'],
  orthorhombic: ['tetragonal', 'monoclinic', 'cubic'],
  hexagonal: ['rhombohedral', 'tetragonal', 'monoclinic'],
  rhombohedral: ['cubic', 'hexagonal', 'triclinic'],
  monoclinic: ['orthorhombic', 'triclinic', 'hexagonal'],
  triclinic: ['monoclinic', 'rhombohedral', 'orthorhombic'],
};

const systemName = s => SYSTEMS[s].label;
const latticeName = b => b.longName;
/** The centring that the "where are the points" text describes: rhombohedral is primitive on its own axes. */
const centringOf = b => (b.id === 'hR' ? 'P' : b.centring);

/* ---------- lattice parameters ---------- */

/** Lengths that differ: easy whole numbers, medium two decimals, hard close together (4.00 and 4.05). */
function lengths(rng, level, count) {
  return retry(() => {
    let v;
    if (level === 'easy') v = shuffle(rng, [3, 4, 5, 6, 7]).slice(0, count);
    else if (level === 'medium') v = Array.from({ length: count }, () => real(rng, 2.5, 7, 0.01));
    else {
      const a = real(rng, 3, 6, 0.01);
      v = [a];
      while (v.length < count) v.push(+(v[v.length - 1] + (chance(rng, 0.5) ? 1 : -1) * real(rng, 0.03, 0.12, 0.01)).toFixed(2));
      v = shuffle(rng, v);
    }
    const gap = level === 'hard' ? 0.03 : 0.4;
    for (let i = 0; i < v.length; i++) for (let j = i + 1; j < v.length; j++) if (Math.abs(v[i] - v[j]) < gap - 1e-9) return null;
    return v.some(x => x < 2.5 || x > 7.5) ? null : v;
  });
}

/** An angle that is not 90°: clearly off on easy and medium, close to 90° on hard. */
function oddAngle(rng, level, { avoid = [] } = {}) {
  return retry(() => {
    const g = level === 'hard' ? 90 + (chance(rng, 0.5) ? 1 : -1) * int(rng, 1, 4)
      : level === 'easy' ? pick(rng, [75, 80, 100, 105, 110]) : int(rng, 70, 118);
    if (Math.abs(g - 90) < (level === 'hard' ? 1 : 6)) return null;
    // 60° and 109.47° rhombohedral cells are really cubic F and I; 120° belongs to hexagonal
    if (Math.abs(g - 60) < 3 || Math.abs(g - 109.47) < 3 || Math.abs(g - 120) < 3) return null;
    return avoid.some(x => Math.abs(x - g) < 3) ? null : g;
  });
}

/** Parameters { a, b, c, alpha, beta, gamma } that belong to a crystal system. */
function paramsFor(sys, level, rng) {
  const L = k => lengths(rng, level, k);
  switch (sys) {
    case 'cubic': { const [a] = L(1); return { a, b: a, c: a, alpha: 90, beta: 90, gamma: 90 }; }
    case 'tetragonal': { const [a, c] = L(2); return { a, b: a, c, alpha: 90, beta: 90, gamma: 90 }; }
    case 'orthorhombic': { const [a, b, c] = L(3); return { a, b, c, alpha: 90, beta: 90, gamma: 90 }; }
    case 'hexagonal': { const [a, c] = L(2); return { a, b: a, c, alpha: 90, beta: 90, gamma: 120 }; }
    case 'rhombohedral': { const [a] = L(1), al = oddAngle(rng, level); return { a, b: a, c: a, alpha: al, beta: al, gamma: al }; }
    case 'monoclinic': { const [a, b, c] = L(3); return { a, b, c, alpha: 90, beta: oddAngle(rng, level), gamma: 90 }; }
    default: {
      const [a, b, c] = L(3), al = oddAngle(rng, level), be = oddAngle(rng, level, { avoid: [al] }), ga = oddAngle(rng, level, { avoid: [al, be] });
      return { a, b, c, alpha: al, beta: be, gamma: ga };
    }
  }
}

const lengthText = (x, level) => (level === 'easy' ? `${x} Å` : `${x.toFixed(2)} Å`);
const paramsText = (p, level) =>
  `<span class="ch-params">a = ${lengthText(p.a, level)}, b = ${lengthText(p.b, level)}, c = ${lengthText(p.c, level)}, α = ${p.alpha}°, β = ${p.beta}°, γ = ${p.gamma}°</span>`;
const paramsKey = p => [p.a, p.b, p.c, p.alpha, p.beta, p.gamma].join(',');

/** Three wrong systems: the look-alikes first, in random order. */
const wrongSystems = (rng, sys) => shuffle(rng, LOOKALIKE[sys]).slice(0, 3);

/* ---------- symmetry: which (hkl) are equivalent in each crystal system ---------- */

const signs3 = ([h, k, l]) => {
  const out = [];
  for (let s = 0; s < 8; s++) out.push([h, k, l].map((x, i) => ((s >> i) & 1 ? -x : x) + 0));
  return out;
};

/**
 * The planes equivalent to (hkl) by the symmetry of each crystal system (its holohedry,
 * which includes the inversion, so (h̄k̄l̄) always belongs). Standard settings:
 * monoclinic with unique axis b, rhombohedral on rhombohedral axes, hexagonal with i = −(h + k).
 */
export const EQUIVALENT = {
  cubic: v => signedPerms(v),
  tetragonal: ([h, k, l]) => [...signs3([h, k, l]), ...signs3([k, h, l])],
  orthorhombic: v => signs3(v),
  hexagonal: ([h, k, l]) => {
    const t = [h, k, -(h + k)], out = [];
    for (const p of PERMS) for (const s of [1, -1]) for (const sl of [1, -1]) out.push([s * t[p[0]] + 0, s * t[p[1]] + 0, sl * l + 0]);
    return out;
  },
  rhombohedral: v => PERMS.flatMap(p => [p.map(j => v[j]), p.map(j => -v[j] + 0)]),
  monoclinic: ([h, k, l]) => [[h, k, l], [-h, k, -l], [h, -k, l], [-h, -k, -l]].map(v => v.map(x => x + 0)),
  triclinic: v => [v, neg(v)],
};

export const isEquivalent = (sys, a, b) => EQUIVALENT[sys](a).some(v => vkey(v) === vkey(b));

/** The systems in which every statement { other, same } about (base) holds. */
export const systemsFitting = (base, statements) =>
  ALL_SYSTEMS.filter(s => statements.every(st => isEquivalent(s, base, st.other) === st.same));

/**
 * Statements "(x) is / is not equivalent to (base)" that only the target system fits.
 * Picked greedily: each new statement rules out as many of the other systems as possible.
 */
function equivalenceStatements(rng, target, base) {
  const pool = new Map();
  for (const v of [...signedPerms(base), ...EQUIVALENT.hexagonal(base), ...EQUIVALENT[target](base)]) {
    if (vkey(v) === vkey(base) || vkey(v) === vkey(neg(base))) continue;
    pool.set(vkey(v), v);
  }
  const permKeys = new Set(signedPerms(base).map(vkey));
  const candidates = shuffle(rng, [...pool.values()]).map(other => ({ other, same: isEquivalent(target, base, other) }));
  const chosen = [];
  let left = ALL_SYSTEMS.filter(s => s !== target);
  while (left.length && chosen.length < 4) {
    let best = null, bestLeft = left;
    for (const c of candidates) {
      if (chosen.includes(c)) continue;
      const after = left.filter(s => isEquivalent(s, base, c.other) === c.same);
      // fewer systems left is better; on a tie prefer a plane that is a reordering of the base (easier to read)
      const better = !best || after.length < bestLeft.length
        || (after.length === bestLeft.length && permKeys.has(vkey(c.other)) && !permKeys.has(vkey(best.other)));
      if (after.length < left.length && better) { best = c; bestLeft = after; }
    }
    if (!best) break;
    chosen.push(best);
    left = bestLeft;
  }
  if (left.length) return null;
  // show at least one of each kind when the system has one
  for (const kind of [true, false]) {
    if (chosen.some(c => c.same === kind)) continue;
    const extra = candidates.find(c => c.same === kind && permKeys.has(vkey(c.other)) && !chosen.includes(c));
    if (extra && chosen.length < 4) chosen.push(extra);
  }
  return [...chosen.filter(c => c.same), ...chosen.filter(c => !c.same)];
}

/* ---------- question types ---------- */

export const types = {
  'params-to-system': {
    levels: ['easy', 'medium', 'hard'], format: 'mc',
    make({ level, rng }) {
      const sys = pick(rng, ALL_SYSTEMS);
      // on easy, half the questions give the rule itself (a = b ≠ c, …) instead of numbers
      const symbolic = level === 'easy' && chance(rng, 0.5);
      const p = symbolic ? null : paramsFor(sys, level, rng);
      if (!symbolic && !p) return null;
      return {
        key: `params-to-system|${sys}|${symbolic ? 'rule' : paramsKey(p)}`,
        fields: { params: symbolic ? `<span class="ch-params">${SYSTEMS[sys].rule}</span>` : paramsText(p, level), rule: SYSTEMS[sys].rule },
        correct: systemName(sys),
        wrong: wrongSystems(rng, sys).map(systemName),
        data: { system: sys, params: p },
      };
    },
  },

  'params-points-to-lattice': {
    levels: ['medium', 'hard'], format: 'mc', words: ['points-P', 'points-I', 'points-F', 'points-C'],
    make({ level, rng, word }) {
      const b = pick(rng, BRAVAIS), p = paramsFor(b.system, level, rng);
      if (!p) return null;
      const c = centringOf(b);
      // wrong: the other lattices of the same system, then the same centring in look-alike systems
      const sameSystem = BRAVAIS.filter(x => x.system === b.system && x !== b);
      const lookalike = LOOKALIKE[b.system].flatMap(s => BRAVAIS.filter(x => x.system === s && (centringOf(x) === c || centringOf(x) === 'P')));
      const wrong = [...new Set([...shuffle(rng, sameSystem), ...shuffle(rng, lookalike)])].slice(0, 3);
      if (wrong.length < 3) return null;
      return {
        key: `params-points-to-lattice|${b.id}|${paramsKey(p)}`,
        fields: {
          params: paramsText(p, level), points: word(`points-${c}`), rule: SYSTEMS[b.system].rule,
          system: systemName(b.system), centring: CENTRING_INFO[c].name,
        },
        correct: latticeName(b),
        wrong: shuffle(rng, wrong).map(latticeName),
        data: { lattice: b.id },
      };
    },
  },

  'points-per-cell': {
    levels: ['medium', 'hard'], format: 'either', words: ['count-P', 'count-I', 'count-F', 'count-C'],
    make({ rng, word }) {
      // hexagonal and rhombohedral are left out: their "cell" could be the rhombic or the hexagonal prism
      const b = pick(rng, BRAVAIS.filter(x => !['hP', 'hR'].includes(x.id)));
      const count = { P: 1, I: 2, C: 2, F: 4 }[b.centring];
      const naive = { P: 8, I: 9, C: 10, F: 14 }[b.centring]; // counting every point as a whole one
      const others = shuffle(rng, [1, 2, 3, 4, 6, 8].filter(x => x !== count && x !== naive));
      return {
        key: `points-per-cell|${b.id}`,
        fields: { lattice: latticeName(b), counting: word(`count-${b.centring}`) },
        correct: String(count),
        wrong: [naive, ...others].slice(0, 3).map(String),
        typed: { kind: 'number', value: count, tol: 0 },
        data: { lattice: b.id, count },
      };
    },
  },

  'equivalence-to-system': {
    levels: ['hard'], format: 'mc',
    words: ['same', 'different', 'why-cubic', 'why-tetragonal', 'why-orthorhombic', 'why-hexagonal', 'why-rhombohedral', 'why-monoclinic'],
    make({ rng, word }) {
      const target = pick(rng, ['cubic', 'tetragonal', 'orthorhombic', 'hexagonal', 'rhombohedral', 'monoclinic']);
      const base = shuffle(rng, [1, 2, 3, 4, 5]).slice(0, 3);
      const statements = equivalenceStatements(rng, target, base);
      if (!statements || systemsFitting(base, statements).join() !== target) return null;
      // wrong options: the systems that fit the most statements
      const fits = s => statements.filter(st => isEquivalent(s, base, st.other) === st.same).length;
      const wrong = shuffle(rng, ALL_SYSTEMS.filter(s => s !== target)).sort((x, y) => fits(y) - fits(x)).slice(0, 3);
      const facts = statements.map(st => `<li>${word(st.same ? 'same' : 'different', { plane: plane(base), other: plane(st.other) })}</li>`);
      return {
        key: `equivalence-to-system|${target}|${vkey(base)}|${statements.map(s => vkey(s.other)).join(';')}`,
        fields: { plane: plane(base), facts: `<ul class="ch-facts">${facts.join('')}</ul>`, why: word(`why-${target}`) },
        correct: systemName(target),
        wrong: wrong.map(systemName),
        data: { system: target, base, statements },
      };
    },
  },
};

/** For the tests: the parameter generator and the list of systems. */
export const _test = { paramsFor, ALL_SYSTEMS };
