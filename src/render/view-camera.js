/* CrystalView methods: fitting and turning the camera, its animation, projection and the canvas size. */
import * as THREE from 'three';
import { reducedMotion } from '../ui/dom.js';
import { vec, toWorld, slerpDir } from './view-prims.js';

const easeInOut = t => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);

export const cameraMethods = {
  /**
   * Fit the supercell in view, keeping the current viewing direction unless asked to reset, or looking
   * `along` [dir, hint] (crystal vectors, as viewAlong). margin: room around it (smaller for a flat view).
   */
  frame({ resetDirection = false, animate = true, along = null, margin = 1.2 } = {}) {
    const m = this.model;
    if (!m) return;
    const corners = (m.cell.frame || m.cell.vertices).map(vec);
    const centre = corners.reduce((s, c) => s.add(c), new THREE.Vector3()).multiplyScalar(1 / corners.length);
    // room for the spheres at the corners: lattice points, or bigger atoms an object draws (m.cell.pad)
    const radius = Math.max(...corners.map(c => c.distanceTo(centre))) + Math.max(m.points.radius || 0, m.cell.pad || 0);
    const target = this.crystal.localToWorld(centre.clone());

    let dir = along ? this._alongDir(...along) : resetDirection ? this.defaultDir.clone() : this.camera.position.clone().sub(this.controls.target);
    if (dir.lengthSq() < 1e-12) dir = this.defaultDir.clone();
    dir.normalize();

    const P = this.cameras.persp, aspect = this.w / this.h;
    const vfov = P.fov * Math.PI / 180, hfov = 2 * Math.atan(Math.tan(vfov / 2) * aspect);
    const dist = 1.22 * radius / Math.sin(Math.min(vfov, hfov) / 2);
    const orthoH = 2 * margin * radius / Math.min(1, aspect);
    this._flyTo({ target, dir, dist, orthoH }, animate);
  },

  /** Look down a crystal direction (Cartesian, crystal frame). hint: crystal vector to point up when looking down the vertical. */
  viewAlong(dirCrystal, hintCrystal, { animate = true } = {}) {
    const t = this.controls.target.clone();
    const dist = this.camera.position.distanceTo(t);
    this._flyTo({ target: t, dir: this._alongDir(dirCrystal, hintCrystal), dist }, animate);
  },

  /** The camera direction (world) for looking down a crystal direction, with the hint pointing up when that is vertical. */
  _alongDir(dirCrystal, hintCrystal) {
    const d = toWorld(dirCrystal).normalize();
    if (Math.abs(d.y) > 0.999) {
      const h = toWorld(hintCrystal); h.y = 0;
      if (h.lengthSq() < 1e-12) h.set(0, 0, -1);
      h.normalize();
      d.addScaledVector(h, -Math.sign(d.y) * 0.002).normalize(); // makes the hint point up on screen
    }
    return d;
  },

  /** The ray under a screen point, in the crystal frame (Cartesian Å): { origin, dir }. */
  rayAt(clientX, clientY) {
    const r = this.renderer.domElement.getBoundingClientRect();
    const ndc = new THREE.Vector2(((clientX - r.left) / r.width) * 2 - 1, -((clientY - r.top) / r.height) * 2 + 1);
    const rc = new THREE.Raycaster();
    rc.setFromCamera(ndc, this.camera);
    this.crystal.updateMatrixWorld(true);
    const inv = this.crystal.matrixWorld.clone().invert();
    return { origin: rc.ray.origin.clone().applyMatrix4(inv).toArray(), dir: rc.ray.direction.clone().transformDirection(inv).toArray() };
  },

  /** A flat view (the 2D slice of Defects mode): no rotation, and a one-finger or left-button drag pans. */
  setFlat(on) {
    const c = this.controls;
    c.enableRotate = !on;
    c.mouseButtons.LEFT = on ? THREE.MOUSE.PAN : THREE.MOUSE.ROTATE;
    c.touches.ONE = on ? THREE.TOUCH.PAN : THREE.TOUCH.ROTATE;
  },

  setProjection(ortho) {
    this._endAnim(true);
    const P = this.cameras.persp, O = this.cameras.ortho, t = this.controls.target;
    const tan = Math.tan(P.fov * Math.PI / 360);
    if (ortho && this.camera === P) {
      this.orthoHeight = 2 * P.position.distanceTo(t) * tan;
      O.position.copy(P.position);
      O.zoom = 1;
      this.camera = O;
      this._applyFrustum();
    } else if (!ortho && this.camera === O) {
      const d = (this.orthoHeight / O.zoom) / (2 * tan);
      const dir = O.position.clone().sub(t).normalize();
      P.position.copy(t).addScaledVector(dir, d);
      this.camera = P;
    }
    this.controls.object = this.camera;
    this.controls.update();
  },

  _camState() {
    const target = this.controls.target.clone();
    const off = this.camera.position.clone().sub(target);
    return { target, dir: off.clone().normalize(), dist: off.length(), orthoH: this.orthoHeight / this.cameras.ortho.zoom };
  },

  _applyCam(s) {
    this.controls.target.copy(s.target);
    for (const cam of Object.values(this.cameras)) cam.position.copy(s.target).addScaledVector(s.dir, s.dist);
    if (s.orthoH != null) {
      this.orthoHeight = s.orthoH;
      this.cameras.ortho.zoom = 1;
      this._applyFrustum();
    }
  },

  _flyTo(to, animate) {
    const from = this._camState();
    if (to.orthoH == null) to.orthoH = from.orthoH;
    if (!animate || reducedMotion() || !this.active) {
      this._applyCam(to);
      this.controls.update();
      return;
    }
    this.controls.enableDamping = false; // also clears any leftover drag momentum
    this.anim = { t0: performance.now(), dur: 650, from, to };
  },

  _stepAnim(now) {
    const a = this.anim;
    const t = Math.min(1, (now - a.t0) / a.dur), e = easeInOut(t);
    this._applyCam({
      target: a.from.target.clone().lerp(a.to.target, e),
      dir: slerpDir(a.from.dir, a.to.dir, e),
      dist: a.from.dist + (a.to.dist - a.from.dist) * e,
      orthoH: a.from.orthoH + (a.to.orthoH - a.from.orthoH) * e,
    });
    if (t >= 1) this._endAnim(false);
  },

  _endAnim(jumpToEnd) {
    if (!this.anim) return;
    if (jumpToEnd) this._applyCam(this.anim.to);
    this.anim = null;
    this.controls.enableDamping = true;
  },

  _applyFrustum() {
    const O = this.cameras.ortho, hh = this.orthoHeight / 2, aspect = this.w / this.h;
    O.left = -hh * aspect; O.right = hh * aspect; O.top = hh; O.bottom = -hh;
    O.updateProjectionMatrix();
  },

  resize() {
    const rect = this.host.getBoundingClientRect();
    if (rect.width < 2 || rect.height < 2) return; // hidden: keep the last good size
    this.w = rect.width;
    this.h = rect.height;
    this.renderer.setSize(this.w, this.h);
    this.cameras.persp.aspect = this.w / this.h;
    this._applyViewOffset();
  },

  /**
   * Lift the picture a little so the floating toolbar covers less of it, and move it out
   * from under a drawer: its centre goes to the middle of the free part, and when that part
   * is narrow (tablets) the picture zooms out by k so it still fits.
   */
  _applyViewOffset() {
    const { w, h } = this, ins = this.inset.now;
    const k = Math.max(1, Math.min(w, h) / Math.max(1, w - ins));
    const fw = w / k, fh = h / k;
    const ox = fw / 2 - (w - ins) / 2, oy = fh / 2 - h / 2 + this.viewShift;
    for (const cam of Object.values(this.cameras)) cam.setViewOffset(fw, fh, ox, oy, w, h);
    this.cameras.persp.updateProjectionMatrix();
    this._applyFrustum();
  },
};
