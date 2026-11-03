/* CrystalView methods: the lattice layers and the primitives objects are drawn with (see view.js), plus small three.js helpers. */
import * as THREE from 'three';

export const UP = new THREE.Vector3(0, 1, 0);
export const vec = v => new THREE.Vector3(v[0], v[1], v[2]);
export const col = hex => new THREE.Color(hex);
/** Crystal frame → world frame (y up). Must match the crystal group's rotation. */
export const toWorld = v => new THREE.Vector3(v[0], v[2], -v[1]);

export function disposeChildren(group) {
  for (const child of [...group.children]) {
    group.remove(child);
    child.traverse(o => {
      if (o.geometry && !o.geometry.userData.shared) o.geometry.dispose();
      if (o.material) [].concat(o.material).forEach(m => m.dispose());
    });
  }
}

export function solid(colour, opacity = 1, extra = {}) {
  const transparent = opacity < 0.999;
  return new THREE.MeshStandardMaterial({
    color: col(colour), roughness: 0.36, metalness: 0.04,
    transparent, opacity, depthWrite: !transparent, ...extra,
  });
}
export function flat(colour, opacity = 1, extra = {}) {
  const transparent = opacity < 0.999;
  return new THREE.MeshBasicMaterial({ color: col(colour), transparent, opacity, depthWrite: !transparent, ...extra });
}

/** Unit-vector interpolation along the great circle from a to b. */
export function slerpDir(a, b, t) {
  const d = Math.max(-1, Math.min(1, a.dot(b)));
  const ang = Math.acos(d);
  if (ang < 1e-6) return b.clone();
  let axis = a.clone().cross(b);
  if (axis.lengthSq() < 1e-10) { // opposite directions: turn about any perpendicular axis
    axis = a.clone().cross(Math.abs(a.y) < 0.9 ? UP : new THREE.Vector3(1, 0, 0));
  }
  axis.normalize();
  return a.clone().applyQuaternion(new THREE.Quaternion().setFromAxisAngle(axis, ang * t)).normalize();
}

export const primMethods = {
  _tubes(segments, radius, material) {
    const mesh = new THREE.InstancedMesh(this.cylGeo, material, Math.max(1, segments.length));
    mesh.count = segments.length;
    const m = new THREE.Matrix4(), q = new THREE.Quaternion(), s = new THREE.Vector3(), p = new THREE.Vector3();
    segments.forEach(([a, b], i) => {
      const A = vec(a), B = vec(b), d = B.clone().sub(A), len = d.length();
      q.setFromUnitVectors(UP, len > 1e-12 ? d.normalize() : UP);
      p.copy(A).add(B).multiplyScalar(0.5);
      s.set(radius, len, radius);
      mesh.setMatrixAt(i, m.compose(p, q, s));
    });
    mesh.instanceMatrix.needsUpdate = true;
    return mesh;
  },

  /** Instanced spheres; with `colours` (one per centre) the material's own colour should be white, as the two multiply. */
  _spheres(centres, radius, material, colours = null) {
    const mesh = new THREE.InstancedMesh(this.sphereGeo, material, Math.max(1, centres.length));
    mesh.count = centres.length;
    const mtx = new THREE.Matrix4(), q = new THREE.Quaternion(), sc = new THREE.Vector3(radius, radius, radius);
    centres.forEach((c, i) => mesh.setMatrixAt(i, mtx.compose(vec(c), q, sc)));
    if (colours) colours.forEach((c, i) => mesh.setColorAt(i, col(c)));
    mesh.instanceMatrix.needsUpdate = true;
    return mesh;
  },

  _lineWeight() {
    const v = this.model.cell.vertices;
    let span = 0;
    for (const p of v) for (const q of v) span = Math.max(span, Math.hypot(p[0] - q[0], p[1] - q[1], p[2] - q[2]));
    return 0.0034 * Math.max(span, 4);
  },

  _buildCells(m) {
    const g = this.layers.cells;
    disposeChildren(g);
    const e = m.edges, cell = m.cell;
    g.visible = e.visible;
    const r = this._lineWeight() * e.thickness;

    if (e.allCells && cell.multi) g.add(this._tubes(cell.grid, this._lineWeight() * e.gridThickness, flat(e.gridColour, e.opacity)));
    g.add(this._tubes(cell.edges, r, flat(e.colour, e.opacity)));
    if (e.highlight && cell.multi) {
      g.add(this._tubes(cell.first, r * 1.9, flat(e.highlightColour, e.opacity)));
    }
  },

  _buildPoints(m) {
    const g = this.layers.points;
    disposeChildren(g);
    const p = m.points, L = m.lattice;
    g.visible = p.visible;
    // with a supercell, points outside the highlighted cell are faded (always while cutting:
    // the cut pieces belong to the highlighted cell, the rest is cut at the supercell edge)
    const dimOutside = m.cell.multi && (m.edges.highlight || p.cut);
    const inside = [], outIdx = [];
    m.sites.forEach((s, i) => {
      if (!dimOutside || s.inOriginal) inside.push(L.toCartesian(s.f));
      if (dimOutside && (!s.inOriginal || (m.shared && m.shared.has(i)))) outIdx.push(i);
    });
    const at = idx => idx.map(i => L.toCartesian(m.sites[i].f));
    const add = (centres, opacity, order, clip) => {
      if (!centres.length) return;
      for (const mesh of this._sphereMeshes(centres, p.radius, p.colour, opacity, clip, { solid: p.solid })) {
        if (order) mesh.renderOrder = order;
        g.add(mesh);
      }
    };
    add(inside, p.opacity, 0, dimOutside ? p.clip : (m.cell.multi ? p.clipOutside : p.clip));
    if (p.clipParts) {
      // the outside is not convex (a field of prisms): each convex part cuts its own points.
      // A point on a shared face is drawn once per part, each piece cut to its part.
      for (const part of p.clipParts) add(at(outIdx.filter(i => part.has(i))), 0.28 * p.opacity, 2, part.clip);
    } else add(at(outIdx), 0.28 * p.opacity, 2, p.clipOutside);
  },

  /**
   * Spheres, optionally cut by planes ({ n, d }: keep n·r ≤ d, crystal frame).
   * Solid (opaque spheres): every cut face is filled — a sphere cut by a plane
   * leaves a flat disc of radius √(r² − s²) (s = distance from the centre to the
   * plane), so each cut is drawn as that disc, trimmed by the other cutting
   * planes: exact, like a cut apple. Only spheres that cross a plane get a disc,
   * so large supercells stay fast. Hollow (or see-through spheres): the inside
   * of the shell shows through the cut.
   */
  _sphereMeshes(centres, radius, colour, opacity, clip, { solid: filled = this.solidCuts } = {}) {
    if (!clip) {
      const mesh = this._spheres(centres, radius, solid(colour, opacity));
      if (opacity < 1) mesh.renderOrder = 4;
      return [mesh];
    }
    const clippingPlanes = this._planes(clip), transparent = opacity < 0.999;
    if (transparent || !filled) {
      const outer = this._spheres(centres, radius, solid(colour, opacity, { clippingPlanes, side: THREE.DoubleSide }));
      if (transparent) outer.renderOrder = 5;
      return [outer];
    }
    const out = [this._spheres(centres, radius, solid(colour, 1, { clippingPlanes }))];
    const capColour = col(colour).lerp(new THREE.Color('#ffffff'), 0.25);
    const Z = new THREE.Vector3(0, 0, 1), m = new THREE.Matrix4(), q = new THREE.Quaternion(), sc = new THREE.Vector3(), p = new THREE.Vector3();
    clip.forEach(({ n, d }, i) => {
      const len = Math.hypot(n[0], n[1], n[2]), nn = vec(n).multiplyScalar(1 / len), dd = d / len;
      const discs = [];
      for (const c of centres) {
        const s = c[0] * nn.x + c[1] * nn.y + c[2] * nn.z - dd; // < 0 inside
        if (Math.abs(s) < radius) discs.push({ c, s, rho: Math.sqrt(radius * radius - s * s) });
      }
      if (!discs.length) return;
      const mesh = new THREE.InstancedMesh(this.discGeo, new THREE.MeshStandardMaterial({
        color: capColour, roughness: 0.6, metalness: 0, side: THREE.DoubleSide,
        clippingPlanes: clippingPlanes.filter((_, k) => k !== i),
      }), discs.length);
      q.setFromUnitVectors(Z, nn);
      discs.forEach(({ c, s, rho }, k) => {
        p.set(c[0] - s * nn.x, c[1] - s * nn.y, c[2] - s * nn.z);
        mesh.setMatrixAt(k, m.compose(p, q, sc.set(rho, rho, 1)));
      });
      mesh.instanceMatrix.needsUpdate = true;
      out.push(mesh);
    });
    return out;
  },

  _buildBonds(m) {
    const g = this.layers.bonds;
    disposeChildren(g);
    if (!m.bonds || !m.bonds.length) return;
    g.visible = m.points.visible;
    const L = m.lattice;
    const segs = m.bonds.map(([i, j]) => [L.toCartesian(m.sites[i].f), L.toCartesian(m.sites[j].f)]);
    const rb = Math.min(0.32 * m.points.radius, 0.05 * this.L0);
    g.add(this._tubes(segs, rb, solid(m.points.colour, 0.55 * m.points.opacity)));
  },

  /** [{ n, d }] meaning keep n·r ≤ d (crystal frame) → Three.js planes in world space. */
  _planes(list) {
    this.crystal.updateMatrixWorld(true);
    return list.map(({ n, d }) => {
      const len = Math.hypot(...n);
      return new THREE.Plane(vec(n).multiplyScalar(-1 / len), d / len).applyMatrix4(this.crystal.matrixWorld);
    });
  },

  /** A cylinder or cone (geo) of radius r and length len, centred at mid and pointing along the unit vector dir. */
  _rod(geo, mat, mid, dir, len, r) {
    const mesh = new THREE.Mesh(geo, mat);
    mesh.scale.set(r, len, r);
    mesh.quaternion.setFromUnitVectors(UP, dir);
    mesh.position.copy(mid);
    return mesh;
  },

  /** A see-through, two-sided fill from a flat list of triangle corners. */
  _fill(pos, colour, opacity) {
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    const mesh = new THREE.Mesh(geo, flat(colour, opacity, { transparent: true, side: THREE.DoubleSide, depthWrite: false }));
    mesh.renderOrder = 3;
    return mesh;
  },

  _primitive(entry, p) {
    const g = entry.group, L0 = this.L0;
    const opacity = p.opacity ?? 1;
    if (p.kind === 'arrow') {
      const from = vec(p.from || [0, 0, 0]), to = vec(p.to);
      const d = to.clone().sub(from), len = d.length();
      if (len < 1e-9) return;
      const dir = d.normalize(), k = p.size ?? 1;
      const headLen = Math.min(0.2 * L0 * k, 0.4 * len), headR = 0.066 * L0 * k, shaftR = 0.022 * L0 * k;
      const mat = solid(p.colour, opacity, { emissive: col(p.colour).multiplyScalar(0.18) });
      g.add(
        this._rod(this.cylGeo, mat, from.clone().addScaledVector(dir, (len - headLen) / 2), dir, len - headLen, shaftR),
        this._rod(this.coneGeo, mat, from.clone().addScaledVector(dir, len - headLen / 2), dir, headLen, headR),
      );
      if (p.label) this._addLabel(entry.labels, to.clone().addScaledVector(dir, (p.labelGap ?? 0.17) * L0), p.label, p.colour, p.labelCls);
    } else if (p.kind === 'polygon') {
      const poly = p.points;
      if (p.fill !== false) {
        const pos = [];
        for (let i = 1; i < poly.length - 1; i++) pos.push(...poly[0], ...poly[i], ...poly[i + 1]);
        g.add(this._fill(pos, p.colour, opacity));
      }
      if (p.outline !== false) {
        const lineOpacity = p.fill === false ? Math.max(0.35, opacity) : Math.min(1, 3 * opacity);
        const pts = p.dashed ? [...poly, poly[0]] : poly; // a dashed outline is drawn as an open line that returns to the start
        const geo = new THREE.BufferGeometry().setFromPoints(pts.map(vec));
        const line = p.dashed
          ? new THREE.Line(geo, new THREE.LineDashedMaterial({ color: col(p.colour), transparent: true, opacity: lineOpacity, dashSize: 0.07 * L0, gapSize: 0.05 * L0 }))
          : new THREE.LineLoop(geo, new THREE.LineBasicMaterial({ color: col(p.colour), transparent: true, opacity: lineOpacity }));
        if (p.dashed) line.computeLineDistances();
        g.add(line);
      }
    } else if (p.kind === 'dimension') {
      // a measuring line with an arrowhead at each end, pointing outwards
      const A = vec(p.from), B = vec(p.to), d = B.clone().sub(A), len = d.length();
      if (len < 1e-9) return;
      const dir = d.normalize(), k = p.size ?? 1;
      const headLen = Math.min(0.1 * L0 * k, 0.32 * len), headR = 0.034 * L0 * k, shaftR = 0.011 * L0 * k;
      const mat = solid(p.colour, opacity, { emissive: col(p.colour).multiplyScalar(0.2) });
      g.add(this._rod(this.cylGeo, mat, A.clone().add(B).multiplyScalar(0.5), dir, Math.max(1e-6, len - 2 * headLen), shaftR));
      for (const [tip, out] of [[A, dir.clone().negate()], [B, dir]]) {
        g.add(this._rod(this.coneGeo, mat, tip.clone().addScaledVector(out, -headLen / 2), out, headLen, headR));
      }
      if (p.label) {
        const at = A.clone().add(B).multiplyScalar(0.5);
        if (p.labelOffset) at.add(vec(p.labelOffset));
        this._addLabel(entry.labels, at, p.label, p.colour, p.labelCls || 'lbl-dim');
      }
    } else if (p.kind === 'label') {
      this._addLabel(entry.labels, vec(p.at), p.html, p.colour, p.cls);
    } else if (p.kind === 'tubes') {
      if (p.segments.length) g.add(this._tubes(p.segments, p.radius ?? 0.02 * L0, solid(p.colour, opacity)));
    } else if (p.kind === 'spheres') {
      if (!p.centres.length) return;
      if (p.colours) { // one colour per sphere (never cut)
        const mesh = this._spheres(p.centres, p.radius, solid('#ffffff', opacity), p.colours);
        if (opacity < 1) mesh.renderOrder = 4;
        g.add(mesh);
      } else g.add(...this._sphereMeshes(p.centres, p.radius, p.colour, opacity, p.clip));
    } else if (p.kind === 'surface') {
      if (p.triangles.length) g.add(this._fill(p.triangles, p.colour, opacity));
    } else if (p.kind === 'arc') {
      const c = vec(p.centre), a = vec(p.from).normalize(), b = vec(p.to).normalize();
      const n = 40, pts = [];
      for (let i = 0; i <= n; i++) pts.push(c.clone().addScaledVector(slerpDir(a, b, i / n), p.radius));
      g.add(this._tubes(pts.slice(1).map((q, i) => [pts[i].toArray(), q.toArray()]), 0.012 * L0, solid(p.colour, Math.min(1, opacity + 0.3))));
      const fan = [];
      for (let i = 0; i < n; i++) fan.push(...c.toArray(), ...pts[i].toArray(), ...pts[i + 1].toArray());
      g.add(this._fill(fan, p.colour, 0.35 * opacity));
      if (p.label) {
        const mid = slerpDir(a, b, 0.5);
        this._addLabel(entry.labels, c.clone().addScaledVector(mid, p.radius * 1.32), p.label, p.colour);
      }
    }
  },
};
