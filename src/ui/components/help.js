/* =====================================================================
   The help system's interface:
   - a click on any "?" button ([data-help], helpButton in src/ui/controls.js)
     opens a small popover: explanation, KaTeX formulas, what the symbols
     mean and one line about the lattice on screen. It floats above other
     menus without closing them.
   - "SEE MORE" opens a panel docked beside the 3D view (a bottom sheet on
     small screens): derivation step by step, a picture or a highlight in
     the 3D view, and a worked example with the values on screen.
   Content lives in src/help/; this module only renders it.
   ===================================================================== */
import { getTopic, resolve, topicFormulas, topicSteps } from '../../help/index.js';
import { tex, texWrap } from '../../help/tex.js';
import { icon } from '../icons.js';
import { esc, rerender, restartAnim } from '../dom.js';
import { closeAllPopovers, hasOpenPopover } from './popover.js';
import { claimSide, releaseSide } from './drawer.js';
import { txt } from '../../text.js';

/** Text with inline maths $…$ → HTML with KaTeX. */
const withMath = html => String(html ?? '').replace(/\$([^$]+)\$/g, (_, t) => tex(t));

const formulaHTML = list => list.map(f => `<div class="hp-formula">${f.tag ? `<span class="f-tag">${esc(f.tag)}</span>` : ''}${texWrap(f.tex)}</div>`).join('');

const stepsHTML = steps => `<ol class="hp-steps">${steps.map(s => `<li>
    ${s.text ? `<div class="hp-step-text">${withMath(s.text)}</div>` : ''}
    ${s.tex ? `<div class="hp-step-tex">${texWrap(s.tex)}</div>` : ''}
  </li>`).join('')}</ol>`;

export function createHelp(ws) {
  const pop = document.createElement('div');
  pop.className = 'help-pop help-layer';
  pop.setAttribute('role', 'dialog');
  pop.tabIndex = -1;

  const panel = document.createElement('aside');
  panel.className = 'help-panel help-layer';
  panel.setAttribute('aria-label', txt('helpPanelLabel'));
  panel.hidden = true;
  ws.dom.stage.appendChild(panel);

  let P = null; // open popover: { key, itemId, arg, anchor, sel }
  let S = null; // open panel:   { key, itemId, arg, tab, show3d }
  let queued = false;
  // the panel docks on the right, so it shares that side with the drawers there: one at a time
  const side = { close: () => closePanel() };

  const ctx = () => ws.ctx;
  const itemOf = id => (id == null || id === '' ? null : ws.findItem(id) || null);

  /* ---------------- popover ---------------- */
  function popHTML(t, c, item, arg) {
    const formulas = topicFormulas(t, c, item, arg);
    const symbols = t.symbols || [];
    let now = null;
    try { now = t.now ? t.now(c, item, arg) : null; } catch (err) { console.error(err); }
    return `<div class="hp-head">
        <span class="hp-icon">${icon(t.icon || 'info')}</span>
        <div class="hp-title"><b id="hp-title">${esc(t.title)}</b><small>${esc(resolve(t.scope, c, item, arg) || '')}</small></div>
        <button type="button" class="icon-btn hp-close" data-hp="close" aria-label="${txt('close')}">${icon('x')}</button>
      </div>
      <p class="hp-explain">${withMath(t.explain)}</p>
      ${formulaHTML(formulas)}
      ${symbols.length ? `<dl class="hp-symbols"><span class="hp-where">${txt('helpWhere')}</span>${symbols.map(([s, m]) => `<div><dt>${tex(s)}</dt><dd>${withMath(m)}</dd></div>`).join('')}</dl>` : ''}
      ${now ? `<p class="hp-now">${icon('target')}<span>${withMath(now)}</span></p>` : ''}
      ${t.more ? `<button type="button" class="btn btn-primary btn-sm hp-more" data-hp="more"><span>${txt('helpSeeMore')}</span>${icon('chevronRight')}</button>` : ''}`;
  }

  function renderPop() {
    const t = getTopic(P.key);
    if (!t) return;
    pop.innerHTML = popHTML(t, ctx(), itemOf(P.itemId), P.arg);
    pop.setAttribute('aria-labelledby', 'hp-title');
    placePop();
  }

  /** Below the "?" (or above it when there is no room); a bottom sheet on phones. */
  function placePop() {
    if (!P) return;
    if (!P.anchor.isConnected) {
      const again = P.sel && (ws.el.querySelector(P.sel) || document.querySelector(P.sel));
      if (again) P.anchor = again;
    }
    const vw = window.innerWidth, vh = window.innerHeight, m = 10;
    const sheet = vw < 600;
    pop.classList.toggle('is-sheet', sheet);
    pop.style.left = pop.style.top = pop.style.maxHeight = '';
    if (sheet) return;
    const r = P.anchor.isConnected ? P.anchor.getBoundingClientRect() : P.rect;
    P.rect = r;
    const w = pop.offsetWidth, h = pop.offsetHeight;
    const below = vh - r.bottom - 2 * m, above = r.top - 2 * m;
    const left = Math.min(Math.max(m, r.left + r.width / 2 - w / 2), vw - w - m);
    pop.style.left = `${left}px`;
    pop.style.setProperty('--arrow-x', `${Math.min(Math.max(16, r.left + r.width / 2 - left), w - 16)}px`);
    if (h <= below || below >= above) {
      pop.style.top = `${r.bottom + 8}px`;
      pop.style.maxHeight = `${Math.max(160, below)}px`;
      pop.classList.remove('is-above');
    } else {
      const hh = Math.min(h, above);
      pop.style.top = `${r.top - 8 - hh}px`;
      pop.style.maxHeight = `${above}px`;
      pop.classList.add('is-above');
    }
  }

  function openPop(anchor) {
    const key = anchor.dataset.help;
    if (!getTopic(key)) return;
    const attrs = ['data-help', 'data-help-item', 'data-help-arg'].filter(a => anchor.hasAttribute(a));
    P = { key, itemId: anchor.dataset.helpItem ?? null, arg: anchor.dataset.helpArg ?? null, anchor, sel: attrs.map(a => `[${a}="${CSS.escape(anchor.getAttribute(a))}"]`).join('') };
    if (!pop.isConnected) document.body.appendChild(pop);
    anchor.setAttribute('aria-expanded', 'true');
    renderPop();
    restartAnim(pop, 'is-open');
    pop.focus({ preventScroll: true });
  }

  function closePop({ focus = false } = {}) {
    if (!P) return;
    const a = P.anchor;
    P = null;
    pop.classList.remove('is-open');
    pop.remove();
    if (a && a.isConnected) {
      a.setAttribute('aria-expanded', 'false');
      if (focus) a.focus({ preventScroll: true });
    }
  }

  pop.addEventListener('click', e => {
    const b = e.target.closest('[data-hp]');
    if (!b) return;
    if (b.dataset.hp === 'close') closePop({ focus: true });
    else if (b.dataset.hp === 'more' && P) {
      const { key, itemId, arg } = P;
      closePop();
      openPanel(key, { itemId, arg });
    }
  });

  /* ---------------- SEE MORE panel ---------------- */
  function panelHTML(t, c, item, arg) {
    const more = t.more, in3D = !ws.is2D();
    let hl = null;
    if (more.highlight && in3D) {
      try { hl = more.highlight(c, item, arg); } catch (err) { console.error(err); }
    }
    let example = null;
    try { example = more.example ? more.example(c, item, arg) : null; } catch (err) { console.error(err); }
    let diagram = '';
    try { diagram = more.diagram ? more.diagram(c, item, arg) || '' : ''; } catch (err) { console.error(err); }
    const tab = S.tab === 'example' && example ? 'example' : 'derivation';

    const hlBox = !hl ? '' : hl.unavailable
      ? `<div class="hpn-hl is-off">${icon('cube')}<p>${hl.unavailable}</p></div>`
      : `<div class="hpn-hl${S.show3d ? ' is-on' : ''}">
          <label class="switch-row"><span class="switch-text"><b>${txt('helpShow3D')}</b><small>${hl.caption || ''}</small></span>
            <span class="switch"><input type="checkbox" role="switch" data-hp-field="show3d"${S.show3d ? ' checked' : ''}><span class="switch-track"><span class="switch-thumb"></span></span></span></label>
          ${hl.look && S.show3d ? `<button type="button" class="btn btn-soft btn-sm" data-hp="look">${icon('target')}<span>${txt('helpLook')}</span></button>` : ''}
        </div>`;

    const derivation = `${diagram ? `<figure class="hp-diagram">${diagram}</figure>` : ''}${stepsHTML(topicSteps(t, c, item, arg))}`;
    const exampleHTML = example ? `<div class="hp-ex-head"><span class="chip chip-primary">${icon('cube')}${esc(example.title || txt('helpYourLattice'))}</span></div>
      ${example.intro ? `<p class="hp-ex-intro">${withMath(example.intro)}</p>` : ''}
      ${stepsHTML(example.steps || [])}
      ${example.result ? `<p class="hp-result">${withMath(example.result)}</p>` : ''}` : '';

    const related = (t.related || []).map(getTopic).filter(Boolean);
    return `<header class="hpn-head">
        <span class="hp-icon">${icon(t.icon || 'info')}</span>
        <div class="hp-title"><small>${txt('helpSeeMoreSmall')}</small><b>${esc(t.title)}</b></div>
        <button type="button" class="icon-btn" data-hp="close-panel" title="${txt('closeEsc')}" aria-label="${txt('helpPanelClose')}">${icon('x')}</button>
      </header>
      <div class="hpn-scroll">
        <p class="hpn-scope"><span class="chip">${esc(resolve(t.scope, c, item, arg) || '')}</span></p>
        <p class="hp-explain">${withMath(t.explain)}</p>
        ${formulaHTML(topicFormulas(t, c, item, arg))}
        ${hlBox}
        ${example ? `<div class="seg seg-block hpn-tabs" role="tablist" aria-label="${txt('helpTabsLabel')}">
          <button type="button" role="tab" data-hp-tab="derivation" aria-pressed="${tab === 'derivation'}" aria-selected="${tab === 'derivation'}">${icon('list')}<span>${txt('helpDerivation')}</span></button>
          <button type="button" role="tab" data-hp-tab="example" aria-pressed="${tab === 'example'}" aria-selected="${tab === 'example'}">${icon('calc')}<span>${txt('helpYourLattice')}</span></button>
        </div>` : `<h3 class="hpn-sub">${txt('helpDerivation')}</h3>`}
        <section class="hpn-body" role="tabpanel">${tab === 'example' ? exampleHTML : derivation}</section>
        ${related.length ? `<div class="hpn-related"><span>${txt('helpRelated')}</span>${related.map(r => `<button type="button" class="chip-btn" data-hp-topic="${r.key}">${esc(r.title)}</button>`).join('')}</div>` : ''}
      </div>`;
  }

  /** The 3D primitives the workspace draws while the panel is open (null = nothing). */
  function highlightPrims() {
    if (!S || !S.show3d || ws.is2D()) return null;
    const t = getTopic(S.key);
    if (!t || !t.more || !t.more.highlight) return null;
    try {
      const h = t.more.highlight(ctx(), itemOf(S.itemId), S.arg);
      return h && h.prims ? h.prims : null;
    } catch (err) {
      console.error(err);
      return null;
    }
  }

  function renderPanel({ keepScroll = true } = {}) {
    const t = getTopic(S.key);
    if (!t || !t.more) return;
    rerender(panel, panelHTML(t, ctx(), itemOf(S.itemId), S.arg), { scroller: '.hpn-scroll', prefix: 'data-hp', keepScroll });
    ws.renderHelpHighlight();
  }

  function openPanel(key, { itemId = null, arg = null } = {}) {
    const t = getTopic(key);
    if (!t || !t.more) return;
    closeAllPopovers();
    const fresh = !S;
    S = { key, itemId, arg, tab: 'derivation', show3d: true };
    if (fresh) claimSide('right', side);
    panel.hidden = false;
    ws.el.classList.add('help-open');
    renderPanel({ keepScroll: false });
    if (fresh) restartAnim(panel, 'is-open');
    const h = panel.querySelector('.hpn-head [data-hp="close-panel"]');
    if (h) h.focus({ preventScroll: true });
  }

  function closePanel() {
    if (!S) return;
    S = null;
    releaseSide('right', side);
    panel.hidden = true;
    panel.innerHTML = '';
    ws.el.classList.remove('help-open');
    ws.renderHelpHighlight();
  }

  panel.addEventListener('click', e => {
    const tabBtn = e.target.closest('[data-hp-tab]');
    if (tabBtn && S) { S.tab = tabBtn.dataset.hpTab; renderPanel({ keepScroll: false }); return; }
    const rel = e.target.closest('[data-hp-topic]');
    if (rel && S) { openPanel(rel.dataset.hpTopic, { itemId: S.itemId }); return; }
    const b = e.target.closest('[data-hp]');
    if (!b) return;
    if (b.dataset.hp === 'close-panel') closePanel();
    else if (b.dataset.hp === 'look' && S) {
      const t = getTopic(S.key), h = t.more.highlight(ctx(), itemOf(S.itemId), S.arg);
      if (h && h.look) ws.lookAlong(h.look);
    }
  });
  panel.addEventListener('change', e => {
    if (e.target.dataset.hpField === 'show3d' && S) { S.show3d = e.target.checked; renderPanel(); }
  });

  /* ---------------- global wiring ---------------- */
  // Every "?" in the app, wherever it sits (inside buttons, labels, <summary>…): open its popover
  // and stop the click from reaching the control around it.
  document.addEventListener('click', e => {
    const b = e.target.closest && e.target.closest('[data-help]');
    if (!b || !ws.el.isConnected || ws.el.inert) return; // two workspaces (Crystal Structures, Defects): only the one on screen answers
    e.preventDefault();
    e.stopPropagation();
    if (P && P.anchor === b) closePop();
    else openPop(b);
  }, true);

  // Outside clicks close the popover (not the panel: it stays while you work)
  document.addEventListener('pointerdown', e => {
    if (!P) return;
    if (pop.contains(e.target) || (e.target.closest && e.target.closest('[data-help]') === P.anchor)) return;
    closePop();
  }, true);

  window.addEventListener('keydown', e => {
    if (e.key !== 'Escape') return;
    if (P) { e.stopPropagation(); e.preventDefault(); closePop({ focus: true }); return; }
    if (S && (panel.contains(document.activeElement) || !hasOpenPopover())) { e.stopPropagation(); closePanel(); }
  }, true);

  const reflow = () => { if (P) placePop(); };
  window.addEventListener('resize', reflow);
  document.addEventListener('scroll', e => { if (P && !pop.contains(e.target)) placePop(); }, true);

  return {
    close() { closePop(); closePanel(); },
    highlightPrims,
    /** Re-render after the scene changed (once per frame). */
    refresh() {
      if ((!P && !S) || queued) return;
      queued = true;
      requestAnimationFrame(() => {
        queued = false;
        if (P) renderPop();
        if (S) renderPanel();
      });
    },
  };
}
