/* CrystalWorkspace methods: the object panel (cards, expand, visibility, colour, delete). */
import { getType } from '../../objects/index.js';
import { dependentsOf } from '../../objects/registry.js';
import { $, $$, esc, preserveFocus } from '../dom.js';
import { icon } from '../icons.js';
import { toast } from '../components/toast.js';
import { confirmModal } from '../components/modal.js';
import { objectCard, emptyState } from './panel.js';
import { tileThumb } from './lattice-picker.js';
import { flatThumb } from './flat.js';
import { txt } from '../../text.js';

/** Scene objects drawn by CrystalView.setLattice rather than as primitives. */
const LATTICE_DRAWN = new Set(['lattice-points', 'cell-edges']);

export const panelMethods = {
  renderAll() {
    this.renderTopbar();
    this.renderSceneList();
    this.renderItemList();
    this.renderToolbar();
    if (this.cellDrawer) this.cellDrawer.refresh();
  },

  renderTopbar() {
    const flat = this.ctx.flat, b = flat ? flat.bravais : this.ctx.bravais;
    this.dom.latticeBtn.innerHTML = `<span class="lb-thumb">${flat ? flatThumb(b, 44) : tileThumb(b, 44)}</span>
      <span class="lb-text"><span class="lb-name">${b.name}</span><span class="lb-long">${flat ? txt('latticeButton2D', { system: flat.system.label }) : b.longName}</span></span>
      <span class="cbadge">${b.centring}</span>${icon('chevronDown', 'lb-chev')}`;
    $$('[data-dim]', this.el).forEach(btn => btn.setAttribute('aria-pressed', String(btn.dataset.dim === this.state.dim)));
  },

  /** Scene objects as listed: the lattice first, then lattice points, cell edges and axes. */
  sceneItems() {
    return [this.state.latticeItem, ...this.state.scene];
  },

  renderSceneList() {
    preserveFocus(this.dom.sceneList, () => {
      this.dom.sceneList.innerHTML = this.sceneItems().map(it => objectCard(it, this.ctx)).join('');
    });
  },

  renderItemList() {
    const items = this.viewItems();
    preserveFocus(this.dom.itemList, () => {
      this.dom.itemList.innerHTML = items.length ? items.map(it => objectCard(it, this.ctx)).join('') : emptyState(this.isDefects());
    });
    this.dom.count.textContent = items.length || '';
    this.dom.count.hidden = !items.length;
    this.dom.tabCount.textContent = items.length || '';
    this.dom.tabCount.hidden = !items.length;
    if (this.inputBar) this.inputBar.refresh();
    this.updateLinks();
  },

  /** Highlight the objects a calculation uses while it is open or hovered. */
  updateLinks(hoverId = this.hoverId) {
    this.hoverId = hoverId;
    const linked = new Set();
    for (const it of this.state.items) {
      const T = getType(it.type);
      if (T.deps && (it.expanded || it.id === hoverId)) T.deps(it).forEach(id => linked.add(id));
    }
    $$('.obj', this.dom.itemList).forEach(li => li.classList.toggle('is-linked', linked.has(+li.dataset.id)));
  },

  /** Re-render every card (values depend on the lattice, λ, other items…) keeping focus. */
  refreshCards() {
    this.renderSceneList();
    this.renderItemList();
  },

  replaceCard(item) {
    const li = this.card(item);
    if (!li) return;
    preserveFocus(this.sceneItems().includes(item) ? this.dom.sceneList : this.dom.itemList, () => { li.outerHTML = objectCard(item, this.ctx); });
  },

  updateSummary(item) {
    const li = this.card(item);
    if (!li) return;
    const T = getType(item.type);
    $('.obj-label', li).innerHTML = this.labelHTML(item);
    $('.obj-sub', li).innerHTML = T.summary ? T.summary(item, this.ctx) : '';
  },

  renderToolbar() {
    const tb = this.dom.toolbar;
    $$('[data-proj]', tb).forEach(b => b.setAttribute('aria-pressed', String((b.dataset.proj === 'ortho') === this.state.ortho)));
  },

  /** Types with live(item, ctx) keep a [data-live] part of their card up to date (e.g. while a slider moves). */
  refreshLive(item) {
    const T = getType(item.type);
    if (!T.live) return;
    const li = this.card(item), box = li && $('[data-live]', li);
    if (box) box.innerHTML = T.live(item, this.ctx);
  },

  addFromMenu(entry, text) {
    if (!entry) return null;
    const init = { ...(entry.init || {}) };
    if (entry.source && text != null) {
      // e.g. Spacing: the typed indices pick (or create) the plane it is linked to
      const src = this.sourceFromText(entry.source, text);
      if (src.error) return src;
      delete src.__new;
      return this.addItem(entry.type, { ...init, src: src.id });
    }
    if (text != null) init.text = String(text).trim();
    // typed indices must be valid; objects without input (e.g. an intersection) can be completed later
    return this.addItem(entry.type, init, { validate: !!entry.input });
  },

  /** Re-render everything that depends on the lattice points or cell edges. */
  sceneObjectChanged(item, { card = false } = {}) {
    this.ctx.pointRadius = this.pointRadius();
    this.renderScene();
    if (card) this.replaceCard(item);
    else this.updateSummary(item);
    for (const it of this.state.items) this.updateSummary(it);
    this.renderLegend();
  },

  flashCard(item) {
    const li = this.card(item);
    if (!li) return;
    li.classList.add('is-new');
    li.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
    setTimeout(() => li.classList.remove('is-new'), 900);
  },

  /** Delete an object; if calculations use it, ask first. */
  async deleteItem(item) {
    const users = dependentsOf(item.id, this.state.items);
    if (users.length) {
      const who = users.map(u => `<b>${esc(u.name)}</b>`).join(', ');
      const ok = await confirmModal({
        title: txt('deleteTitle', { name: esc(item.name) }),
        body: `<p class="note">${txt('deleteUsedBy', { name: esc(item.name), users: who, which: users.length === 1 ? txt('deleteWhichOne') : txt('deleteWhichMany') })}</p>`,
        confirmLabel: txt('deleteConfirm', { name: esc(item.name) }),
        danger: true,
      });
      if (!ok) return;
    }
    const items = this.state.items, at = items.indexOf(item);
    if (at < 0) return;
    const li = this.card(item);
    const finish = () => {
      items.splice(items.indexOf(item), 1);
      this.renderItemList();
      this.renderScene();
    };
    if (li) { li.classList.add('is-leaving'); setTimeout(finish, 180); } else finish();
    const label = this.labelHTML(item);
    toast(txt('msgRemoved', { label }), {
      icon: 'trash', tone: 'info',
      action: { label: txt('undo'), run: () => {
        if (items.includes(item)) return;
        items.splice(Math.min(at, items.length), 0, item);
        this.recompute();
        this.renderItemList();
        this.renderScene();
        this.flashCard(item);
      } },
    });
  },

  clearItems() {
    const removed = this.viewItems();
    if (!removed.length) return;
    this.state.items = this.state.items.filter(i => !removed.includes(i));
    this.recompute();
    this.renderItemList();
    this.renderScene();
    toast(txt(removed.length === 1 ? 'msgRemovedOne' : 'msgRemovedMany', { count: removed.length }), {
      icon: 'trash', tone: 'info',
      action: { label: txt('undo'), run: () => {
        this.state.items.push(...removed);
        this.recompute();
        this.renderItemList();
        this.renderScene();
      } },
    });
  },

  setColour(item, colour) {
    item.colour = colour;
    const shown = this.resolveColour(item);
    const li = this.card(item);
    if (li) {
      li.style.setProperty('--c', shown);
      $$('input[type="color"]', li).forEach(i => { if (i !== document.activeElement) i.value = shown; });
      $$('.appear-dot', li).forEach(d => d.style.setProperty('--c', shown));
      $$('.swatch[data-value]', li).forEach(s => s.classList.toggle('is-on',
        colour ? s.dataset.value.toLowerCase() === colour.toLowerCase() : s.dataset.value === 'auto'));
    }
    if (this.state.scene.includes(item)) this.renderLattice();
    else this.renderItemScene(item);
  },

  /** After a colour is final, cards that show other objects' colours (tables) catch up. */
  colourSettled(item) {
    for (const it of this.state.items) if (it !== item && !getType(it.type).appearance) this.replaceCard(it);
    for (const it of this.state.items) if (it.type === 'calc-angle' || it.type === 'calc-points') this.renderItemScene(it);
  },

  toggleVisible(item, li) {
    item.visible = !item.visible;
    li.classList.toggle('is-hidden', !item.visible);
    const eye = $('.obj-eye', li);
    if (eye) {
      eye.setAttribute('aria-pressed', String(item.visible));
      eye.title = item.visible ? txt('hide') : txt('show');
      eye.innerHTML = icon(item.visible ? 'eye' : 'eyeOff');
    }
    if (LATTICE_DRAWN.has(item.type) || this.is2D()) this.renderScene();
    else {
      if (this.view) {
        this.view.setObjectVisible(item.id, item.visible);
        if (getType(item.type).hidesLatticePoints) this.renderLattice();
      }
      this.renderStatus();
    }
  },

  toggleExpand(item, li, force) {
    item.expanded = force ?? !item.expanded;
    li.classList.toggle('is-open', item.expanded);
    $('.obj-settings', li).inert = !item.expanded;
    $$('[data-act="expand"]', li).forEach(b => b.setAttribute('aria-expanded', String(item.expanded)));
    this.updateLinks();
  },

  setPanelOpen(open) {
    this.state.panelOpen = open;
    this.el.classList.toggle('panel-collapsed', !open);
    if (open) setTimeout(() => $('[data-act="collapse"]', this.el).focus({ preventScroll: true }), 50);
  },
};
