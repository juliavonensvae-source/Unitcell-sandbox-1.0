/* =====================================================================
   CrystalWorkspace — the "Crystal Structures" mode.

   Owns the state (lattice, supercell, scene objects, added items), builds
   the context `ctx` that object types read, and keeps three views in sync:
   the object panel, the 3D view (CrystalView) and the toolbars.

   The class holds the lifecycle and the SceneModel overrides (they call
   super); the other methods live in the ws-*.js and more-menu.js mixins.
   ===================================================================== */
import { getType } from '../../objects/index.js';
import { CrystalView } from '../../render/view.js';
import { $, h, esc } from '../dom.js';
import { icon } from '../icons.js';
import { themeButton, cssVar, onThemeChange } from '../theme.js';
import { toast } from '../components/toast.js';
import { closeAllPopovers } from '../components/popover.js';
import { createAddMenu } from './add-menu.js';
import { createLatticePicker } from './lattice-picker.js';
import { toolbarHTML, createCellDrawer } from './toolbar.js';
import '../../objects/lattice.js';
import { HELP } from '../../help/content.js';
import { FlatView } from '../../render/flat-view.js';
import { inputBarHTML, createInputBar } from './input-bar.js';
import { SceneModel } from '../../objects/model.js';
import { createFlatPicker } from './flat.js';
import { createHelp } from '../components/help.js';
import { helpButton } from '../controls.js';
import { panelMethods } from './ws-panel.js';
import { renderMethods } from './ws-render.js';
import { latticeMethods } from './ws-lattice.js';
import { canvasMethods } from './ws-canvas.js';
import { eventMethods } from './ws-events.js';
import { moreMenuMethods } from './more-menu.js';
import { txt } from '../../text.js';

/** The workspace markup; Defects mode (D) has its own title, a slice instead of the 2D lattices, and the bars for placing defects and choosing the slice. */
const TEMPLATE = mode => { const D = mode === 'defects', title = D ? txt('modesDefectsName') : txt('crystalStructures'); return `<section class="screen workspace${D ? ' is-defects' : ''}" data-screen="${D ? 'defects' : 'crystal'}" aria-label="${title}">
  <header class="ws-top">
    <div class="ws-top-left">
      <button type="button" class="icon-btn icon-btn-lg home-btn" data-act="home" title="${txt('topHomeTitle')}" aria-label="${txt('topHomeLabel')}">${icon('home')}</button>
      <h1 class="ws-brand">${title}</h1>
    </div>
    <div class="ws-top-mid">
      <div class="seg dim-switch" role="group" aria-label="${txt(D ? 'topDimLabelDefects' : 'topDimLabel')}">
        <button type="button" data-dim="3d" aria-pressed="true" title="${txt(D ? 'topDim3DTitleDefects' : 'topDim3DTitle')}">${txt('topDim3D')}</button>
        <button type="button" data-dim="2d" aria-pressed="false" title="${txt(D ? 'topDim2DTitleDefects' : 'topDim2DTitle')}">${txt('topDim2D')}</button>
      </div>
      <button type="button" class="lattice-btn" data-act="picker" title="${txt(D ? 'topPickerTitleDefects' : 'topPickerTitle')}"></button>
      <button type="button" class="btn btn-primary btn-add" data-act="add" title="${txt(D ? 'topAddTitleDefects' : 'topAddTitle')}">${icon('plus')}<span>${txt('add')}</span></button>
    </div>
    <div class="ws-top-right">
      <label class="adv-switch only-3d" title="${esc(HELP.advanced)}">
        <span class="switch"><input type="checkbox" role="switch" data-act="advanced" aria-label="${txt('topAdvancedLabel')}"><span class="switch-track"><span class="switch-thumb"></span></span></span>
        <span class="adv-label">${txt('advanced')}</span>
      </label>
      ${helpButton('advanced', { cls: 'adv-help only-3d' })}
      ${themeButton()}
      <button type="button" class="icon-btn more-btn" data-act="more" title="${txt('topMoreTitle')}" aria-label="${txt('moreOptions')}">${icon('more')}</button>
    </div>
  </header>
  <div class="ws-body">
    <aside class="ws-panel" aria-label="${txt('objects')}">
      <div class="panel-head">
        <h2 class="panel-title">${txt('objects')} <span class="panel-count"></span></h2>
        <button type="button" class="icon-btn" data-act="collapse" title="${txt('panelHide')}" aria-label="${txt('panelHide')}">${icon('chevronLeft')}</button>
      </div>
      <div class="panel-scroll">
        <section class="panel-section"><h3 class="section-title">${txt('panelScene')}</h3><ul class="obj-list" data-list="scene"></ul></section>
        <section class="panel-section"><h3 class="section-title">${txt('panelAdded')}</h3><ul class="obj-list" data-list="items"></ul></section>
        <section class="panel-section only-2d"><p class="flat-note">${icon('info')}<span>${txt('panelFlatNote')}</span></p></section>
      </div>
      ${inputBarHTML()}
    </aside>
    <main class="ws-stage">
      <div class="stage-gl-host only-3d"></div>
      <div class="stage-labels only-3d" aria-hidden="true"></div>
      <div class="flat-host only-2d"></div>
      <button type="button" class="panel-tab" data-act="expand-panel" aria-label="${txt('panelShow')}">${icon('panel')}<span>${txt('objects')}</span><span class="panel-tab-count"></span></button>
      <div class="stage-status"></div>
      <div class="stage-readout" hidden></div>
      <div class="flat-pick only-2d" hidden role="status"></div>
      <aside class="hex-legend only-3d" hidden aria-label="${txt('hexAxes')}"></aside>
      <aside class="ion-legend only-3d" hidden aria-label="${txt('ionLegendLabel')}"></aside>
      <div class="stage-hint">${txt('stageHint3D')}</div>
      ${toolbarHTML()}
      <div class="stage-error" hidden></div>
      ${D ? '<div class="place-bar" hidden role="status"></div><div class="slice-bar" hidden></div>' : ''}
    </main>
  </div>
</section>`; };

export class CrystalWorkspace extends SceneModel {
  constructor({ onHome, mode = 'crystal' }) {
    super({ mode });
    this.onHome = onHome;
    this.state.panelOpen = window.innerWidth >= 900;
    this.view = null;
    this.firstShow = true;
    this.el = h(TEMPLATE(mode));
  }

  mount(parent) {
    parent.appendChild(this.el);
    const q = s => $(s, this.el);
    this.dom = {
      panel: q('.ws-panel'), sceneList: q('[data-list="scene"]'), itemList: q('[data-list="items"]'),
      count: q('.panel-count'), tabCount: q('.panel-tab-count'), stage: q('.ws-stage'), status: q('.stage-status'), hint: q('.stage-hint'),
      readout: q('.stage-readout'), legend: q('.hex-legend'), ionLegend: q('.ion-legend'),
      latticeBtn: q('.lattice-btn'), advanced: q('[data-act="advanced"]'), toolbar: q('.view-toolbar'),
    };
    this.readTheme();
    try {
      this.view = new CrystalView(q('.stage-gl-host'), q('.stage-labels'));
      this.view.setStageColour(this.theme.stage);
    } catch (err) {
      console.error(err);
      const box = q('.stage-error');
      box.hidden = false;
      box.textContent = txt('stageNoWebGL');
    }

    this.flatView = new FlatView(q('.flat-host'));
    this.flatView.onInteract = () => this.dom.hint.classList.add('is-faded');
    this.flatView.onHandleDrag = (id, end, sxy, phase) => this.dragVectorEnd(id, end, sxy, phase);
    this.dom.pickBar = q('.flat-pick');
    this.dom.pickBar.addEventListener('change', e => {
      if (e.target.dataset.pickSnap === undefined) return;
      this.state.flat.snap = e.target.checked;
      if (this.flatView.pick) this.flatView.pick.snap = e.target.checked;
    });
    document.addEventListener('keydown', e => {
      if (e.key !== 'Escape' || !this.flatView.pick) return;
      e.preventDefault(); // Escape ends the vector pick, nothing else
      this.endVectorPick();
    });

    this.addMenu = createAddMenu(this, q('[data-act="add"]'));
    this.picker = createLatticePicker(this, this.dom.latticeBtn);
    this.picker2d = createFlatPicker(this, this.dom.latticeBtn);
    // the "Add cells" drawer on the right edge: cell type, supercell size, highlighted cell
    this.cellDrawer = createCellDrawer(this, q('.ws-body'), {
      extra: () => this.cellPickerHTML(),
      onExtra: (e, el) => this.onCellPicker(e, el),
      onOpen: () => this.syncDrawerInset(),
      onClose: () => { this.previewCell(null); this.syncDrawerInset(); },
    });
    this.morePop = this.createMoreMenu(q('[data-act="more"]'));
    this.inputBar = createInputBar(this, q('.cmd-bar'));
    this.help = createHelp(this);

    this.dom.advanced.checked = this.state.advanced;
    document.documentElement.classList.toggle('is-advanced', this.state.advanced);
    this.el.classList.toggle('panel-collapsed', !this.state.panelOpen);

    this.bind();
    this.rebuild();
    onThemeChange(() => this.onTheme());

    // Lift the axes gizmo above the floating toolbar whenever the two would overlap
    const placeGizmo = () => {
      if (!this.view) return;
      const st = this.dom.stage.getBoundingClientRect(), tb = this.dom.toolbar.getBoundingClientRect(), g = this.view.gizmo;
      const overlaps = tb.left < st.left + g.left + g.size + 10;
      g.bottom = overlaps ? Math.round(st.bottom - tb.top) + 8 : 14;
    };
    const ro = new ResizeObserver(() => { placeGizmo(); this.syncDrawerInset(); });
    ro.observe(this.dom.stage);
    ro.observe(this.dom.toolbar);
  }

  /** While the Add cells drawer covers the right of the canvas, the 3D picture moves into the part left free. */
  syncDrawerInset() {
    let px = 0;
    if (this.cellDrawer && this.cellDrawer.isOpen) {
      // layout sizes, not the sliding transform: the drawer may still be on its way in
      const st = this.dom.stage.getBoundingClientRect(), host = this.cellDrawer.host.getBoundingClientRect();
      const covered = st.right - (host.right - this.cellDrawer.el.offsetWidth);
      px = covered > 0 ? Math.min(covered, 0.5 * st.width) : 0;
    }
    if (this.view) this.view.setInsetRight(px);
    if (this.flatView && px !== this.flatView.rightInset) this.flatView.setInsetRight(px);
  }

  show() {
    if (this.view) this.view.setActive(true);
    if (this.firstShow) {
      this.firstShow = false;
      requestAnimationFrame(() => {
        if (!this.view) return;
        this.view.resize();
        this.view.frame({ resetDirection: true, animate: false });
      });
      setTimeout(() => this.dom.hint.classList.add('is-faded'), 7000);
    }
  }

  hide() {
    if (this.view) this.view.setActive(false);
    closeAllPopovers();
    if (this.help) this.help.close();
  }

  readTheme() {
    this.theme = {
      stage: cssVar('--stage'), cell: cssVar('--cell-line'), points: cssVar('--lattice-point'),
      primary: cssVar('--primary'), grid: cssVar('--line'),
      axisA: cssVar('--axis-a'), axisB: cssVar('--axis-b'), axisC: cssVar('--axis-c'), axisA3: cssVar('--axis-a3'),
      angle: cssVar('--axis-angle'), highlight: cssVar('--highlight'),
      siteOct: cssVar('--site-oct'), siteTet: cssVar('--site-tet'), siteCub: cssVar('--site-cub'), good: cssVar('--good'), bad: cssVar('--bad'),
      movedLow: cssVar('--moved-low'), movedMid: cssVar('--moved-mid'), movedHigh: cssVar('--moved-high'),
      squeeze: cssVar('--squeeze'), strainMid: cssVar('--strain-mid'), stretch: cssVar('--stretch'),
    };
  }

  /** Re-derive the scene (SceneModel) and let an open help popover or panel follow it. */
  recompute() {
    const ctx = super.recompute();
    if (this.help) this.help.refresh();
    return ctx;
  }

  findItem(id) {
    return this.sceneItems().find(i => String(i.id) === String(id)) || this.state.items.find(i => String(i.id) === String(id));
  }

  /** The panel card of an item, or null. */
  card(item) {
    return $(`.obj[data-id="${item.id}"]`, this.dom.panel);
  }

  /** The item whose card holds an element, or null. */
  itemOf(el) {
    const li = el.closest('.obj');
    return li ? this.findItem(li.dataset.id) : null;
  }

  /** Re-derive the scene and redraw the panel and the view; { frame: true } also fits the cell in view. */
  rebuild({ frame = false } = {}) {
    this.recompute();
    this.renderAll();
    this.renderScene();
    if (frame) this.frameView();
  }

  /** Fit the cell in the view that is shown (3D or 2D). */
  frameView() {
    if (this.is2D()) this.flatView.frame();
    else if (this.view) this.view.frame();
  }

  /** SceneModel.applyLattice, then redraw everything and fit the new cell in view. */
  applyLattice(id, params = null) {
    super.applyLattice(id, params);
    if (!this.dom) return;
    this.renderAll();
    this.renderScene();
    if (this.view) this.view.frame();
  }

  /** A short message from an object type (e.g. what a clicked ion is). */
  notify(html, opts = {}) {
    toast(html, { tone: 'info', ...opts });
  }

  /** Add an object (SceneModel.addItem) and show it: card, 3D, toast. { quiet: true } skips that. */
  addItem(type, init = {}, opts = {}) {
    const item = super.addItem(type, init, opts);
    if (item.error || opts.quiet) return item;
    const T = getType(type), extra = this.addNote;
    this.renderItemList();
    this.renderScene();
    this.flashCard(item);
    toast(`${txt('msgAdded', { label: this.labelHTML(item) })}${extra ? `<br><small>${extra}</small>` : ''}`, { icon: T.icon, colour: T.appearance ? this.resolveColour(item) : undefined });
    return item;
  }

  /** Run one line of the input bar (SceneModel.runCommand) and show the result. */
  runCommand(text) {
    const res = super.runCommand(text);
    if (res.show) {
      const li = this.card(res.show);
      if (li) this.toggleExpand(res.show, li, true);
      this.flashCard(res.show);
    } else if (res.error) {
      this.renderItemList();
      this.renderScene();
    } else if (res.changed && res.item) this.flashCard(res.item);
    return res;
  }

  /** Re-render after a type changed an item (cards and 3D, since others may depend on it). */
  itemChanged() {
    super.itemChanged(); // re-derives linked objects, e.g. a direction worked out from two planes
    this.refreshCards();
    this.renderScene();
  }

  onTheme() {
    this.readTheme();
    this.recompute();
    if (this.view) this.view.setStageColour(this.theme.stage);
    this.renderScene();
    this.renderSceneList();
  }
}

Object.assign(CrystalWorkspace.prototype, panelMethods, renderMethods, latticeMethods, canvasMethods, eventMethods, moreMenuMethods);
