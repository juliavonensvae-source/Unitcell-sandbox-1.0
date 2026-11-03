/* CrystalWorkspace methods: the click, input and keyboard handlers of the top bar, toolbar and panel. */
import { getType } from '../../objects/index.js';
import { $, esc, showError } from '../dom.js';
import { toast } from '../components/toast.js';
import { findBravais2D } from '../../data/bravais2d.js';
import { commitNumber, bindNumberKeys } from '../number-field.js';
import { txt } from '../../text.js';

export const eventMethods = {
  bind() {
    const el = this.el;

    el.addEventListener('click', e => {
      const dimBtn = e.target.closest('[data-dim]');
      if (dimBtn) { this.setDim(dimBtn.dataset.dim); return; }
      const a = e.target.closest('[data-act]');
      if (!a || !el.contains(a) || this.dom.panel.contains(a) && a.closest('.obj, .lc')) return;
      switch (a.dataset.act) {
        case 'home': this.onHome(); break;
        case 'picker': (this.is2D() ? this.picker2d : this.picker).toggle(); break;
        case 'add': this.addMenu.toggle(); break;
        case 'pick-cancel': this.endVectorPick(); break;
        case 'more': this.morePop.toggle(); break;
        case 'collapse': this.setPanelOpen(false); break;
        case 'expand-panel': this.setPanelOpen(true); break;
        case 'hide-legend': this.state.scene[2].legend = false; this.renderLegend(); this.replaceCard(this.state.scene[2]); break;
        default: break;
      }
    });
    this.dom.advanced.addEventListener('change', e => this.setAdvanced(e.target.checked));

    const tb = this.dom.toolbar;
    tb.addEventListener('click', e => {
      const v = e.target.closest('[data-view]'), d = e.target.closest('[data-display]'), p = e.target.closest('[data-proj]');
      if (v && this.is2D()) this.flatView.frame();
      else if (v && this.view) {
        const L = this.ctx.lattice, k = v.dataset.view;
        if (k === 'reset') this.resetView();
        else this.view.viewAlong(L.vectors[+k], k === '2' ? L.vectors[1] : L.vectors[2]);
      } else if (d) this.setDisplayMode(d.dataset.display);
      else if (p) this.setProjection(p.dataset.proj === 'ortho');
    });

    const panel = this.dom.panel;
    for (const type of ['click', 'input', 'change', 'dblclick']) panel.addEventListener(type, e => this.onPanelEvent(e));
    // hovering a calculation highlights the objects it uses
    this.dom.itemList.addEventListener('pointerover', e => {
      const li = e.target.closest('.obj');
      const id = li ? +li.dataset.id : null;
      if (id !== this.hoverId) this.updateLinks(id);
    });
    this.dom.itemList.addEventListener('pointerleave', () => this.updateLinks(null));
    // Escape in a name field puts the old name back
    panel.addEventListener('keydown', e => {
      if (e.key !== 'Escape' || e.target.dataset.field !== 'name') return;
      const item = this.itemOf(e.target);
      if (!item) return;
      e.target.value = item.name;
      showError(e.target, $('[data-name-error]', e.target.closest('.obj')), '');
    });
    bindNumberKeys(this, panel);
    // remember which Appearance dropdowns are open, so re-rendered cards keep them open
    panel.addEventListener('toggle', e => {
      if (!e.target.matches || !e.target.matches('[data-appear]')) return;
      const item = this.itemOf(e.target);
      if (item) item.appearOpen = e.target.open;
    }, true);
    this.bindCanvas();
  },

  onPanelEvent(e) {
    const t = e.target;
    const lc = t.closest('.lc');
    if (lc) return this.onLatticeCardEvent(e);
    const item = this.itemOf(t);
    if (!item) return;
    const li = t.closest('.obj'), T = getType(item.type);

    if (e.type === 'dblclick') {
      if (t.closest('.obj-main')) {
        this.toggleExpand(item, li, true);
        const input = $('[data-field="name"]', li);
        if (input) setTimeout(() => { input.focus(); input.select(); }, 60);
      }
      return;
    }

    if (e.type === 'click') {
      const seg = t.closest('[data-seg]');
      if (seg) {
        if (T.onField) T.onField(item, seg.dataset.seg, seg.dataset.value, this.ctx, this, 'change');
        return;
      }
      const a = t.closest('[data-act]');
      if (!a) return;
      const act = a.dataset.act;
      if (act === 'expand') this.toggleExpand(item, li);
      else if (act === 'edit-def' && T.definition) this.inputBar.edit(T.definition(item, this.ctx));
      else if (act === 'visible') this.toggleVisible(item, li);
      else if (act === 'delete') this.deleteItem(item);
      else if (act === 'colour') { this.setColour(item, a.dataset.value === 'auto' ? null : a.dataset.value); this.colourSettled(item); }
      else if (T.onAction) T.onAction(item, act, a, this.ctx, this);
      return;
    }

    // input / change on a data-field control
    const f = t.closest('[data-field]');
    if (!f) return;
    if (f.dataset.number !== undefined) {
      // typed numbers apply on Enter / leaving the field (keydown and change), not on every key
      if (e.type === 'input') {
        showError(f, $('[data-num-error]', f.closest('.num-field')), '');
      } else if (e.type === 'change') commitNumber(this, item, f);
      return;
    }
    const kind = f.type, phase = e.type;
    if ((kind === 'checkbox' || f.tagName === 'SELECT') && phase !== 'change') return;
    if (kind === 'range' && phase !== 'input') return;
    const name = f.dataset.field;
    const value = kind === 'checkbox' ? f.checked : kind === 'range' ? +f.value : f.value;

    if (kind === 'range') {
      const out = $(`output[data-out="${name}"]`, li);
      if (out) out.textContent = `${value}${f.dataset.unit || ''}`;
      f.style.setProperty('--p', `${((value - f.min) / (f.max - f.min)) * 100}%`);
    }

    if (name === 'colour') {
      if (phase === 'input') this.setColour(item, value);
      else this.colourSettled(item);
    } else if (name === 'transparency') {
      item.transparency = value;
      if (this.state.scene.includes(item)) this.renderLattice();
      else this.renderItemScene(item);
    } else if (name === 'name') {
      const err = $('[data-name-error]', li);
      if (phase === 'input') { showError(f, err, ''); return; }
      const next = String(value).trim();
      if (next === item.name) return;
      const problem = this.nameProblem(next, item);
      if (problem) {
        showError(f, err, problem);
        return;
      }
      const old = item.name;
      item.name = next;
      this.refreshCards();  // every calculation and menu that shows this name updates
      this.renderScene();
      toast(txt('msgRenamed', { old: esc(old), next: esc(next) }), { icon: 'pencil', tone: 'info' });
    } else if (T.onField) {
      T.onField(item, name, value, this.ctx, this, phase);
    }
  },

  onLatticeCardEvent(e) {
    const t = e.target;
    if (e.type === 'click') {
      const a = t.closest('[data-act]');
      if (!a) return;
      if (a.dataset.act === 'reset-params') this.resetParams();
      else if (a.dataset.act === 'reset-params2') {
        this.state.flat.params = { ...findBravais2D(this.state.flat.latticeId).params };
        this.rebuild({ frame: true });
      }
      return;
    }
    if (t.dataset.param || t.dataset.param2) {
      if (e.type === 'input') this.onParamInput(t);
      else if (e.type === 'change' && !t.classList.contains('is-invalid')) this.frameView();
    }
  },
};
