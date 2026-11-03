/* The slowly rotating lattice behind the title screen.
   A 4 × 4 × 4 block of cubic F cells: corner points and face centres in two
   colours, faint cell lines and fog for depth. */
import * as THREE from 'three';
import { gridLines } from '../math/cells.js';
import { reducedMotion } from '../ui/dom.js';

const N = 3, A = 3.6; // cells per edge, cell size

export class TitleBackground {
  constructor(canvas) {
    this.canvas = canvas;
    const r = this.renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
    r.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.75));
    r.setClearColor(0x000000, 0);

    this.scene = new THREE.Scene();
    this.scene.fog = new THREE.Fog(0xffffff, 20, 42);
    this.camera = new THREE.PerspectiveCamera(36, 1, 0.1, 200);
    this.camera.position.set(0, 0, 27);
    this.scene.add(new THREE.HemisphereLight(0xffffff, 0x9098b8, 1.8));
    const key = new THREE.DirectionalLight(0xffffff, 2.0);
    key.position.set(4, 6, 10);
    this.scene.add(key);

    this.spin = new THREE.Group();
    this.tilt = new THREE.Group();
    this.tilt.rotation.set(0.42, 0, 0.08);
    this.tilt.add(this.spin);
    this.scene.add(this.tilt);

    const corners = [], faces = [];
    for (let i = 0; i <= N; i++) for (let j = 0; j <= N; j++) for (let k = 0; k <= N; k++) {
      corners.push([i, j, k]);
      if (i < N && j < N) faces.push([i + 0.5, j + 0.5, k]);
      if (i < N && k < N) faces.push([i + 0.5, j, k + 0.5]);
      if (j < N && k < N) faces.push([i, j + 0.5, k + 0.5]);
    }
    const geo = new THREE.SphereGeometry(1, 24, 16);
    this.matCorner = new THREE.MeshStandardMaterial({ color: 0x5965f0, roughness: 0.35, metalness: 0.05 });
    this.matFace = new THREE.MeshStandardMaterial({ color: 0xff7a59, roughness: 0.35, metalness: 0.05 });
    const place = (list, mat, r) => {
      const mesh = new THREE.InstancedMesh(geo, mat, list.length);
      const m = new THREE.Matrix4(), q = new THREE.Quaternion(), s = new THREE.Vector3(r, r, r);
      list.forEach((f, i) => mesh.setMatrixAt(i, m.compose(new THREE.Vector3(...f.map(v => (v - N / 2) * A)), q, s)));
      this.spin.add(mesh);
    };
    place(corners, this.matCorner, 0.42);
    place(faces, this.matFace, 0.32);

    const pts = [];
    for (const [a, b] of gridLines([N, N, N])) pts.push(...a.map(v => (v - N / 2) * A), ...b.map(v => (v - N / 2) * A));
    const lg = new THREE.BufferGeometry();
    lg.setAttribute('position', new THREE.Float32BufferAttribute(pts, 3));
    this.matLine = new THREE.LineBasicMaterial({ color: 0x2a3050, transparent: true, opacity: 0.16 });
    this.spin.add(new THREE.LineSegments(lg, this.matLine));

    this.ro = new ResizeObserver(() => this.resize());
    this.ro.observe(canvas.parentElement);
    this.resize();
    this.running = false;
    this._frame = this._frame.bind(this);
  }

  /** colours: { fog, corner, face, line } as CSS colour strings */
  setTheme({ fog, corner, face, line, dark }) {
    this.scene.fog.color.set(fog);
    this.matCorner.color.set(corner);
    this.matFace.color.set(face);
    this.matLine.color.set(line);
    this.matLine.opacity = dark ? 0.22 : 0.16;
  }

  resize() {
    const p = this.canvas.parentElement.getBoundingClientRect();
    if (p.width < 2 || p.height < 2) return;
    this.renderer.setSize(p.width, p.height, false);
    this.camera.aspect = p.width / p.height;
    // keep the lattice large on portrait screens too
    this.camera.position.z = this.camera.aspect < 1 ? 27 / Math.max(0.62, this.camera.aspect) : 27;
    this.camera.updateProjectionMatrix();
  }

  start() {
    if (this.running) return;
    this.running = true;
    this.last = performance.now();
    requestAnimationFrame(this._frame);
  }

  stop() {
    this.running = false;
  }

  _frame(now) {
    if (!this.running) return;
    requestAnimationFrame(this._frame);
    const dt = Math.min(64, now - this.last);
    this.last = now;
    const still = reducedMotion();
    if (!still) this.spin.rotation.y += dt * 0.00011;
    this.tilt.rotation.x = 0.42 + (still ? 0 : Math.sin(now * 0.00025) * 0.03);
    this.renderer.render(this.scene, this.camera);
  }
}
