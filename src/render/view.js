/* =====================================================================
   CrystalView — Three.js rendering only. Receives Cartesian geometry
   computed by src/math; holds no crystallographic logic of its own.

   - setLattice(model)        lattice points, cell edges, optional bonds
   - setObject(id, prims)     any added object, described as primitives:
       { kind: 'arrow',   from?, to, colour, opacity, label? }
       { kind: 'polygon', points, colour, opacity, fill?, outline?, dashed? }
       { kind: 'dimension', from, to, colour, opacity, label?, labelOffset? }  measuring line, arrowheads at both ends
       { kind: 'label',   at, html, colour }
       { kind: 'tubes',   segments, radius, colour, opacity }
       { kind: 'spheres', centres, radius, colour, opacity, clipToCell? }
       { kind: 'arc',     centre, from, to, radius, colour, opacity, label? }
       { kind: 'surface', triangles: [x, y, z, …], colour, opacity }  see-through triangle mesh
     'spheres' may carry `colours` (one per centre) instead of being cut.
     All coordinates are Cartesian Å in the crystal frame.
   - frame(), viewAlong(), setProjection(), setActive()

   The crystal group is rotated so that crystal z (≈ c) points up on screen.
   ===================================================================== */
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { reducedMotion } from '../ui/dom.js';
import { toWorld, col, disposeChildren, primMethods } from './view-prims.js';
import { cameraMethods } from './view-camera.js';

const AXIS_COLOURS = ['#E5484D', '#23A26D', '#3F73F0'];

export class CrystalView {
  constructor(host, labelLayer) {
    this.host = host;
    this.labelLayer = labelLayer;
    this.w = 1; this.h = 1;
    this.stageColour = '#F8F9FD';
    this.L0 = 4;
    this.viewShift = 28; // px
    this.inset = { now: 0, want: 0 }; // px of the canvas covered on the right (e.g. by a drawer)

    const r = this.renderer = new THREE.WebGLRenderer({ antialias: true });
    r.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    r.autoClear = false;
    r.localClippingEnabled = true;
    r.domElement.className = 'stage-gl';
    host.prepend(r.domElement);

    this.scene = new THREE.Scene();
    this.scene.add(new THREE.HemisphereLight(0xffffff, 0x8a93ad, 1.9));
    this.cameras = {
      persp: new THREE.PerspectiveCamera(30, 1, 0.05, 5000),
      ortho: new THREE.OrthographicCamera(-1, 1, 1, -1, -5000, 5000),
    };
    for (const cam of Object.values(this.cameras)) {
      const key = new THREE.DirectionalLight(0xffffff, 2.2);
      key.position.set(1.2, 1.8, 2.5);
      cam.add(key);
      this.scene.add(cam);
    }
    this.camera = this.cameras.persp;
    this.orthoHeight = 10;

    this.controls = new OrbitControls(this.camera, r.domElement);
    this.controls.enableDamping = true;
    this.controls.dampingFactor = 0.12;
    this.controls.rotateSpeed = 0.8;
    this.controls.addEventListener('start', () => this._endAnim(false));

    this.crystal = new THREE.Group();
    this.crystal.rotation.x = -Math.PI / 2;
    this.crystal.updateMatrixWorld(true);
    this.scene.add(this.crystal);
    this.layers = {};
    for (const k of ['cells', 'points', 'bonds', 'objects']) {
      this.layers[k] = new THREE.Group();
      this.crystal.add(this.layers[k]);
    }

    const shared = g => { g.userData.shared = true; return g; };
    this.sphereGeo = shared(new THREE.SphereGeometry(1, 36, 24));
    this.cylGeo = shared(new THREE.CylinderGeometry(1, 1, 1, 18, 1, false));
    this.coneGeo = shared(new THREE.ConeGeometry(1, 1, 28));
    this.discGeo = shared(new THREE.CircleGeometry(1, 48)); // cut faces of spheres

    this.objects = new Map(); // id → { group, labels: [{ el, pos }] }
    this.gizmoLabels = [];
    this.defaultDir = toWorld([2.4, 1.0, 1.25]).normalize();
    this.gizmo = { size: 92, left: 14, bottom: 14 };
    this._initGizmo();

    this.ro = new ResizeObserver(() => this.resize());
    this.ro.observe(host);
    this.resize();

    this.active = false;
    this.raf = 0;
    this._loop = this._loop.bind(this);
  }

  // ---------- public API ----------
  setActive(on) {
    this.active = on;
    if (on && !this.raf) this.raf = requestAnimationFrame(this._loop);
  }

  setStageColour(hex) { this.stageColour = hex; }

  /**
   * px of the canvas on the right that something covers (a drawer). The picture slides
   * over so its centre sits in the middle of the part that is still visible; the canvas
   * itself keeps its size.
   */
  setInsetRight(px) {
    this.inset.want = Math.max(0, px);
    if (!this.active || reducedMotion()) { this.inset.now = this.inset.want; this._applyViewOffset(); }
  }

  /**
   * m: { lattice, sites,
   *      cell:   { edges, grid, first: Cartesian segments [[p, q]], vertices: [p], multi: bool,
   *                frame?: [p] — fit these points instead of the vertices },
   *      points: { visible, radius, colour, opacity, clip: [{ n, d }] | null,
   *                clipOutside, clipParts: [{ clip, has(i) }] | null },
   *      edges:  { visible, colour, opacity, thickness, highlight, highlightColour, allCells, gridColour, gridThickness },
   *      bonds:  [[i, j]] | null,
   *      axes:   [{ vec, label, colour }] for the gizmo }
   * Clip planes keep the points with n·r ≤ d (Cartesian, crystal frame).
   */
  setLattice(m) {
    this.model = m;
    this.L0 = Math.cbrt(m.lattice.volume);
    this.solidCuts = m.points.solid !== false;
    this._buildCells(m);
    this._buildPoints(m);
    this._buildBonds(m);
    this._updateGizmo(m.lattice, m.axes);
  }

  setObject(id, prims, { visible = true } = {}) {
    let entry = this.objects.get(id);
    if (!entry) {
      entry = { group: new THREE.Group(), labels: [] };
      this.layers.objects.add(entry.group);
      this.objects.set(id, entry);
    }
    disposeChildren(entry.group);
    entry.labels.forEach(l => l.el.remove());
    entry.labels = [];
    entry.group.visible = visible;
    for (const p of prims) this._primitive(entry, p);
    // place new labels now: an object redrawn every frame (an animation) would otherwise never show them in place
    if (entry.labels.length) this._placeLabels();
  }

  setObjectVisible(id, visible) {
    const entry = this.objects.get(id);
    if (entry) entry.group.visible = visible;
  }

  removeObject(id) {
    const entry = this.objects.get(id);
    if (!entry) return;
    disposeChildren(entry.group);
    this.layers.objects.remove(entry.group);
    entry.labels.forEach(l => l.el.remove());
    this.objects.delete(id);
  }

  /** Remove every object whose id is not in keep. */
  pruneObjects(keep) {
    for (const id of [...this.objects.keys()]) if (!keep.has(id)) this.removeObject(id);
  }

  // ---------- axes gizmo ----------
  _initGizmo() {
    this.gScene = new THREE.Scene();
    this.gCam = new THREE.OrthographicCamera(-1.55, 1.55, 1.55, -1.55, 0.1, 10);
    this.gGroup = new THREE.Group();
    this.gScene.add(this.gGroup);
  }

  /** axes: [{ vec (crystal Cartesian), label, colour }] — a, b, c or a1, a2, a3, c */
  _updateGizmo(L, axes) {
    disposeChildren(this.gGroup);
    this.gizmoLabels.forEach(l => l.el.remove());
    this.gizmoLabels = [];
    const list = axes || L.vectors.map((vec, i) => ({ vec, label: 'abc'[i], colour: AXIS_COLOURS[i] }));
    list.forEach(({ vec: v, label, colour }) => {
      const dir = toWorld(v).normalize();
      const mat = new THREE.MeshBasicMaterial({ color: col(colour) });
      this.gGroup.add(
        this._rod(this.cylGeo, mat, dir.clone().multiplyScalar(0.39), dir, 0.78, 0.055),
        this._rod(this.coneGeo, mat, dir.clone().multiplyScalar(0.93), dir, 0.3, 0.14),
      );
      this._addLabel(this.gizmoLabels, dir.clone().multiplyScalar(1.3), label, colour, 'lbl-gizmo');
    });
  }

  // ---------- labels ----------
  _addLabel(list, pos, html, colour, cls = '') {
    const el = document.createElement('div');
    el.className = `lbl ${cls}`;
    el.innerHTML = html;
    el.style.setProperty('--c', colour);
    this.labelLayer.appendChild(el);
    list.push({ el, pos });
  }

  _placeLabels() {
    const v = new THREE.Vector3();
    for (const entry of this.objects.values()) {
      const show = entry.group.visible;
      for (const l of entry.labels) {
        if (!show) { l.el.style.visibility = 'hidden'; continue; }
        v.copy(l.pos).applyMatrix4(this.crystal.matrixWorld).project(this.camera);
        l.el.style.visibility = v.z > -1 && v.z < 1 ? 'visible' : 'hidden';
        l.el.style.transform = `translate(${(v.x + 1) / 2 * this.w}px, ${(1 - v.y) / 2 * this.h}px) translate(-50%, -50%)`;
      }
    }
    const { size: S, left, bottom } = this.gizmo;
    for (const l of this.gizmoLabels) {
      v.copy(l.pos).project(this.gCam);
      l.el.style.transform = `translate(${left + (v.x + 1) / 2 * S}px, ${this.h - bottom - (v.y + 1) / 2 * S}px) translate(-50%, -50%)`;
    }
  }

  // ---------- frame loop ----------
  _loop(now) {
    if (!this.active) { this.raf = 0; return; }
    this.raf = requestAnimationFrame(this._loop);
    if (this.anim) this._stepAnim(now);
    const ins = this.inset;
    if (ins.now !== ins.want) {
      ins.now += (ins.want - ins.now) * 0.3;
      if (Math.abs(ins.want - ins.now) < 0.5) ins.now = ins.want;
      this._applyViewOffset();
    }
    this.controls.update();
    this.render();
  }

  render() {
    const r = this.renderer;
    r.setViewport(0, 0, this.w, this.h);
    r.setClearColor(this.stageColour, 1);
    r.clear();
    r.render(this.scene, this.camera);

    const { size: S, left, bottom } = this.gizmo;
    this.gCam.position.set(0, 0, 4).applyQuaternion(this.camera.quaternion);
    this.gCam.quaternion.copy(this.camera.quaternion);
    r.clearDepth();
    r.setViewport(left, bottom, S, S);
    r.render(this.gScene, this.gCam);
    r.setViewport(0, 0, this.w, this.h);

    this._placeLabels();
  }
}

Object.assign(CrystalView.prototype, cameraMethods, primMethods);
