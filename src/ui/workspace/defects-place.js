/* DefectsWorkspace methods: placing a point defect by clicking a lattice point or site, the slice bar of the 2D view, and animations (glide, Burgers circuit). */
import { getType } from '../../objects/index.js';
import * as M from '../../math/index.js';
import { crystalOf, drawnPos, drawScale } from '../../objects/crystal.js';
import { siteKinds, blockSites, middlePoint, nearestSite } from '../../objects/point-defects.js';
import { $, esc, reducedMotion } from '../dom.js';
import { icon } from '../icons.js';
import { toast } from '../components/toast.js';
import { closeAllPopovers } from '../components/popover.js';
import { helpButton } from '../controls.js';
import { txt } from '../../text.js';

const SITE_THEME = { oct: 'siteOct', tet: 'siteTet', cub: 'siteCub' };

export const placeMethods = {
  bindDefects() {
    this.dom.placeBar.addEventListener('click', e => {
      const b = e.target.closest('[data-place]');
      if (!b) return;
      if (b.dataset.place === 'cancel') this.endPlace();
      else if (b.dataset.place === 'centre' && this.placing) {
        const { T, kind, item } = this.placing;
        const k = kind || (siteKinds(this.ctx)[0] || {}).kind;
        this.finishPlace(T.place === 'site' ? nearestSite(this.ctx, k, undefined, item) : middlePoint(this.ctx, item), T.place === 'site' ? k : null);
      }
    });
    $('.slice-bar', this.el).addEventListener('click', e => {
      const ax = e.target.closest('[data-slice-axis]'), st = e.target.closest('[data-slice-step]');
      if (ax) this.setSliceAxis(+ax.dataset.sliceAxis);
      else if (st) this.stepSlice(+st.dataset.sliceStep);
    });
    document.addEventListener('keydown', e => {
      if (e.key !== 'Escape' || !this.placing || this.el.inert) return;
      e.preventDefault(); // Escape stops placing, nothing else
      this.endPlace();
    });
    const gl = $('.stage-gl', this.el);
    if (!gl) return;
    gl.addEventListener('pointermove', e => {
      if (!this.placing || e.buttons) return;
      const hit = this.placeHit(e.clientX, e.clientY);
      gl.style.cursor = hit ? 'pointer' : 'crosshair';
      this.renderPlaceHover(hit);
    });
  },

  /* ---------------- placing a point defect ---------------- */
  /** Ask for a click: { entry } adds a new defect there, { item } moves an existing one. */
  startPlace({ entry = null, item = null }) {
    closeAllPopovers();
    this.endPlace();
    const T = getType(item ? item.type : entry.type);
    if (!siteKinds(this.ctx).length) { toast(txt('pdCubicOnly'), { tone: 'warn' }); return; }
    this.placing = { entry, item, T, kind: item ? item.kind : entry.init && entry.init.kind };
    const what = (item ? item.name : T.title.toLowerCase());
    const site = T.place === 'site';
    this.dom.placeBar.innerHTML = `<span class="fp-text">${icon('target')}<b>${txt(site ? 'placeSite' : 'placePoint', { what: esc(what) })}</b>${helpButton(T.help)}</span>
      <button type="button" class="btn btn-soft btn-sm" data-place="centre">${txt('placeCentre')}</button>
      <button type="button" class="btn btn-soft btn-sm" data-place="cancel">${txt('pickCancel')}</button>`;
    this.dom.placeBar.hidden = false;
    this.el.classList.add('is-placing');
    const gl = $('.stage-gl', this.el);
    if (gl) gl.style.cursor = 'crosshair';
    this.renderPlaceMarkers();
  },

  endPlace() {
    if (!this.placing) return;
    this.placing = null;
    this.dom.placeBar.hidden = true;
    this.el.classList.remove('is-placing');
    const gl = $('.stage-gl', this.el);
    if (gl) gl.style.cursor = '';
    if (this.view) { this.view.removeObject('place-sites'); this.view.removeObject('place-hover'); }
  },

  /** What a click would choose: { f, kind?, c, r } (a lattice point's atom, or an interstitial site), or null. */
  placeHit(clientX, clientY) {
    if (!this.view || !this.placing) return null;
    const ray = this.view.rayAt(clientX, clientY), ctx = this.ctx, C = crystalOf(ctx), L = ctx.lattice, sc = drawScale(ctx);
    if (this.placing.T.place === 'site') {
      const r = Math.max(0.3 * C.R, 0.05 * ctx.L0);
      const list = siteKinds(ctx).flatMap(s => blockSites(ctx, s.kind).filter(f => M.inSlice(f, ctx.slice)).map(f => ({ c: L.toCartesian(f), r, data: { f, kind: s.kind } })));
      const hit = M.nearestHit(ray, list);
      return hit && { ...hit.data, c: L.toCartesian(hit.data.f), r };
    }
    const list = C.atoms.filter(a => a.kind === 'host' && M.inSlice(a.f, ctx.slice)).map(a => ({ c: drawnPos(a, ctx), r: C.R * sc, data: a }));
    const hit = M.nearestHit(ray, list);
    return hit && { f: hit.data.f, c: drawnPos(hit.data, ctx), r: C.R * sc };
  },

  placeTap(clientX, clientY) {
    const hit = this.placeHit(clientX, clientY);
    if (hit) this.finishPlace(hit.f, hit.kind || null);
    return hit ? 'object' : 'background';
  },

  /** Put the defect at f (a lattice point, or a site of `kind`). */
  finishPlace(f, kind) {
    if (!this.placing || !f) return;
    const { entry, item, T } = this.placing;
    if (item) {
      T.placeAt(item, f, kind, this.ctx);
      this.endPlace();
      this.redraw(item, { card: true });
      this.flashCard(item);
      const clash = T.error(item, this.ctx);
      if (clash) toast(clash, { tone: 'warn' });
      return;
    }
    const res = this.addItem(entry.type, { ...(entry.init || {}), at: f, ...(kind ? { kind } : {}) }, { validate: true });
    if (res.error) { toast(res.error, { tone: 'warn' }); return; }
    this.endPlace();
  },

  /** While placing an interstitial, the empty sites show as small markers (one colour per kind). */
  renderPlaceMarkers() {
    if (!this.view || !this.placing) return;
    if (this.placing.T.place !== 'site') { this.view.removeObject('place-sites'); return; }
    const ctx = this.ctx, L = ctx.lattice, R = ctx.analysis.neighbours.dnn / 2;
    this.view.setObject('place-sites', siteKinds(ctx).map(s => ({
      kind: 'spheres', centres: blockSites(ctx, s.kind).filter(f => M.inSlice(f, ctx.slice)).map(f => L.toCartesian(f)),
      radius: Math.min(0.22 * R, 0.6 * s.rMax), colour: ctx.theme[SITE_THEME[s.kind]], opacity: 0.75,
    })));
  },

  renderPlaceHover(hit) {
    if (!this.view) return;
    if (!hit) { this.view.removeObject('place-hover'); return; }
    this.view.setObject('place-hover', [{ kind: 'spheres', centres: [hit.c], radius: hit.r * 1.18, colour: this.theme.primary, opacity: 0.35 }]);
  },

  /* ---------------- the slice bar (2D) ---------------- */
  renderSliceBar() {
    const sl = this.ctx.slice, bar = $('.slice-bar', this.el);
    bar.hidden = !sl;
    if (!sl) return;
    const axes = ['a', 'b', 'c'];
    bar.innerHTML = `<span class="sb-title">${txt('sliceTitle')}${helpButton('defect-slice')}</span>
      <div class="seg" role="group" aria-label="${txt('sliceAcross')}">${axes.map((x, i) => `<button type="button" data-slice-axis="${i}" aria-pressed="${i === sl.axis}" title="${txt('sliceAcrossAxis', { axis: x })}">⊥ <i>${x}</i></button>`).join('')}</div>
      <span class="sb-layer">
        <button type="button" class="icon-btn" data-slice-step="-1" aria-label="${txt('sliceDown')}"${sl.index <= 0 ? ' disabled' : ''}>${icon('minus')}</button>
        <output>${txt('sliceLayer', { k: sl.index + 1, n: sl.count })}</output>
        <button type="button" class="icon-btn" data-slice-step="1" aria-label="${txt('sliceUp')}"${sl.index >= sl.count - 1 ? ' disabled' : ''}>${icon('plus')}</button>
      </span>
      <small class="sb-level"><i>${axes[sl.axis]}</i> = ${+sl.level.toFixed(3)}</small>`;
    if (this.placing) this.renderPlaceMarkers();
  },

  /* ---------------- animations ---------------- */
  /** Run step(t) for t from 0 to 1 over ms, redrawing each frame; done() at the end. A new animation of the same item replaces the old one. */
  animate(item, ms, step, done) {
    this.stopAnims(item.id);
    if (reducedMotion()) { step(1); this.redraw(item); if (done) done(); return; }
    const t0 = performance.now();
    const tick = now => {
      if (!this.state.items.includes(item)) { this.anims.delete(item.id); return; }
      const t = Math.min(1, (now - t0) / ms);
      step(t);
      this.redraw(item);
      if (t < 1) this.anims.set(item.id, requestAnimationFrame(tick));
      else { this.anims.delete(item.id); if (done) done(); }
    };
    this.anims.set(item.id, requestAnimationFrame(tick));
  },

  /** Stop one item's animation, or every animation. */
  stopAnims(id = null) {
    for (const [k, raf] of [...this.anims]) {
      if (id != null && k !== id) continue;
      cancelAnimationFrame(raf);
      this.anims.delete(k);
    }
  },
};
