/* Small 3-vector / 3×3-matrix helpers used by every other math module. */

export const DEG = Math.PI / 180;
export const EPS = 1e-6;

/** The six orderings of three indices (identity first). */
export const PERMS = [[0, 1, 2], [0, 2, 1], [1, 0, 2], [1, 2, 0], [2, 0, 1], [2, 1, 0]];

export const dot = (u, v) => u[0] * v[0] + u[1] * v[1] + u[2] * v[2];
export const add = (u, v) => [u[0] + v[0], u[1] + v[1], u[2] + v[2]];
export const sub = (u, v) => [u[0] - v[0], u[1] - v[1], u[2] - v[2]];
export const scale = (u, s) => [u[0] * s, u[1] * s, u[2] * s];
export const cross = (u, v) => [u[1] * v[2] - u[2] * v[1], u[2] * v[0] - u[0] * v[2], u[0] * v[1] - u[1] * v[0]];
export const norm = u => Math.hypot(u[0], u[1], u[2]);
export const normalize = u => scale(u, 1 / norm(u));
const matVec = (M, v) => [dot(M[0], v), dot(M[1], v), dot(M[2], v)];
/** uᵀ M v */
export const quadForm = (u, M, v) => dot(u, matVec(M, v));

export function det3(M) {
  return M[0][0] * (M[1][1] * M[2][2] - M[1][2] * M[2][1])
       - M[0][1] * (M[1][0] * M[2][2] - M[1][2] * M[2][0])
       + M[0][2] * (M[1][0] * M[2][1] - M[1][1] * M[2][0]);
}

export function inv3(M) {
  const d = det3(M);
  return [
    [(M[1][1] * M[2][2] - M[1][2] * M[2][1]) / d, (M[0][2] * M[2][1] - M[0][1] * M[2][2]) / d, (M[0][1] * M[1][2] - M[0][2] * M[1][1]) / d],
    [(M[1][2] * M[2][0] - M[1][0] * M[2][2]) / d, (M[0][0] * M[2][2] - M[0][2] * M[2][0]) / d, (M[0][2] * M[1][0] - M[0][0] * M[1][2]) / d],
    [(M[1][0] * M[2][1] - M[1][1] * M[2][0]) / d, (M[0][1] * M[2][0] - M[0][0] * M[2][1]) / d, (M[0][0] * M[1][1] - M[0][1] * M[1][0]) / d],
  ];
}

export const gcd = (a, b) => { a = Math.abs(a); b = Math.abs(b); while (b) [a, b] = [b, a % b]; return a; };
export const gcdAll = list => list.reduce((g, x) => gcd(g, x), 0);

/** Angle in degrees from a cosine, clamped so rounding can't push it outside [-1, 1]. */
export const acosDeg = c => Math.acos(Math.max(-1, Math.min(1, c))) / DEG;

export const centroid = pts => [0, 1, 2].map(i => pts.reduce((s, q) => s + q[i], 0) / pts.length);

/** Sort coplanar points in place by angle round c, measured from direction u in the plane with normal n. */
export function sortAround(pts, c, n, u) {
  const v = cross(n, u);
  return pts.sort((p, q) => Math.atan2(dot(sub(p, c), v), dot(sub(p, c), u)) - Math.atan2(dot(sub(q, c), v), dot(sub(q, c), u)));
}
