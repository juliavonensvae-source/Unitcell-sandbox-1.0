/* The input bar at the bottom of the Objects panel (GeoGebra-style).
   Type d1 = [1 1 0], p1 = (1 1 1) or a command such as Angle(d1, p1).
   Suggests names and commands while typing; the work is done by
   CrystalWorkspace.runCommand, which returns { ok } or { error }. */
import { commandList, wordAt } from '../../objects/commands.js';
import { Popover } from '../components/popover.js';
import { esc, restartAnim } from '../dom.js';
import { plainText } from '../../objects/model.js';
import { icon } from '../icons.js';
import { helpButton } from '../controls.js';
import { txt } from '../../text.js';

export const inputBarHTML = () => `<form class="cmd-bar" autocomplete="off" novalidate>
  <ul class="cmd-suggest" role="listbox" aria-label="${txt('cmdSuggestions')}" hidden></ul>
  <p class="cmd-msg" role="status" hidden></p>
  <div class="cmd-row">
    <span class="cmd-prompt" aria-hidden="true">${icon('chevronRight')}</span>
    <input class="cmd-input" type="text" spellcheck="false" autocomplete="off" autocapitalize="off"
      placeholder="d1 = [1 1 0]  ·  p1 = (1 1 1)  ·  Spacing(p1)" aria-label="${txt('cmdInputLabel')}">
    ${helpButton('input-bar', { cls: 'cmd-qhelp' })}
    <button type="button" class="icon-btn cmd-help" data-act="cmd-list" title="${txt('cmdAllTitle')}" aria-label="${txt('cmdAllLabel')}">${icon('list')}</button>
    <button type="submit" class="icon-btn cmd-go" title="${txt('cmdRunTitle')}" aria-label="${txt('cmdRun')}">${icon('check')}</button>
  </div>
</form>`;

export function createInputBar(ws, form) {
  const input = form.querySelector('.cmd-input');
  const list = form.querySelector('.cmd-suggest');
  const msg = form.querySelector('.cmd-msg');
  let options = [], active = -1, msgTimer = 0;
  const history = [];
  let hIndex = 0;

  const names = () => ws.viewItems().filter(i => i.name);
  const inView = c => ws.inMode(c) && (c.dims || ['3d']).includes(ws.state.dim);

  /** Examples shown when the bar is empty, using names that are still free. */
  const examples = () => {
    const d = ws.freeName('d'), p = ws.freeName('p');
    const dirs = names().filter(i => i.type === 'direction'), planes = names().filter(i => i.type === 'plane');
    const flat = ws.is2D(), l = ws.freeName('l');
    const out = ws.isDefects() ? [] : flat ? [
      { label: `${d} = [1 2]`, hint: txt('cmdExDir2D'), insert: `${d} = [1 2]`, whole: true },
      { label: `${l} = (1 2)`, hint: txt('cmdExLine2D'), insert: `${l} = (1 2)`, whole: true },
    ] : [
      { label: `${d} = [1 1 0]`, hint: txt('cmdExDir'), insert: `${d} = [1 1 0]`, whole: true },
      { label: `${p} = (1 1 1)`, hint: ws.ctx.hexAxes && ws.state.advanced ? txt('cmdExPlaneFour') : txt('cmdExPlane'), insert: `${p} = (1 1 1)`, whole: true },
    ];
    for (const c of commandList().filter(inView).slice(0, ws.isDefects() ? 8 : 6)) {
      const pick = c.example(dirs, planes);
      out.push({ label: pick, hint: c.help, insert: pick, whole: true });
    }
    return out;
  };

  const suggestions = () => {
    if (!input.value.trim()) return examples();
    const caret = input.selectionStart ?? input.value.length;
    const { word, start } = wordAt(input.value, caret);
    if (!word) return [];
    const w = word.toLowerCase();
    const named = names()
      .filter(i => i.name.toLowerCase().startsWith(w) && i.name !== word)
      .map(i => ({ label: i.name, hint: plainText(ws.labelHTML(i)).replace(i.name, '').trim() || i.type, insert: i.name, start, end: caret }));
    const cmds = commandList()
      .filter(c => inView(c) && c.name.toLowerCase().startsWith(w))
      .map(c => ({ label: `${c.name}( … )`, hint: c.help, insert: `${c.name}(`, start, end: caret }));
    return [...named, ...cmds].slice(0, 7);
  };

  const paint = () => {
    list.hidden = !options.length || document.activeElement !== input;
    list.innerHTML = options.map((o, i) => `<li role="option" data-i="${i}" class="${i === active ? 'is-active' : ''}" aria-selected="${i === active}">
      <b>${esc(o.label)}</b><small>${esc(o.hint)}</small></li>`).join('');
  };
  const update = () => { options = suggestions(); active = -1; paint(); };

  const accept = o => {
    if (o.whole) {
      input.value = o.insert;
      input.setSelectionRange(o.insert.length, o.insert.length);
    } else {
      const v = input.value;
      input.value = v.slice(0, o.start) + o.insert + v.slice(o.end);
      const caret = o.start + o.insert.length;
      input.setSelectionRange(caret, caret);
    }
    input.focus();
    update();
  };

  const say = (html, tone) => {
    clearTimeout(msgTimer);
    msg.hidden = !html;
    msg.className = `cmd-msg is-${tone}`;
    msg.innerHTML = html;
    if (tone === 'ok') msgTimer = setTimeout(() => { msg.hidden = true; }, 3500);
  };

  const run = () => {
    const text = input.value.trim();
    if (!text) { update(); return; }
    const res = ws.runCommand(text);
    if (res.error) {
      say(esc(res.error), 'error');
      restartAnim(form, 'shake');
      return;
    }
    history.push(text);
    hIndex = history.length;
    input.value = '';
    say(res.ok, 'ok');
    update();
  };

  input.addEventListener('input', () => { if (!msg.hidden && msg.classList.contains('is-error')) msg.hidden = true; update(); });
  input.addEventListener('focus', update);
  input.addEventListener('click', update);
  input.addEventListener('blur', () => setTimeout(paint, 120));
  input.addEventListener('keydown', e => {
    const open = !list.hidden && options.length;
    if (e.key === 'ArrowDown' && open) { active = (active + 1) % options.length; paint(); e.preventDefault(); }
    else if (e.key === 'ArrowUp' && open) { active = (active - 1 + options.length) % options.length; paint(); e.preventDefault(); }
    else if (e.key === 'ArrowUp' && history.length) { hIndex = Math.max(0, hIndex - 1); input.value = history[hIndex]; e.preventDefault(); }
    else if (e.key === 'Tab' && open && input.value.trim()) { accept(options[Math.max(0, active)]); e.preventDefault(); }
    else if (e.key === 'Enter' && open && active >= 0) { accept(options[active]); e.preventDefault(); }
    else if (e.key === 'Escape') { if (open) { options = []; paint(); } else input.value = ''; e.stopPropagation(); }
  });
  list.addEventListener('mousedown', e => {
    const li = e.target.closest('[data-i]');
    if (!li) return;
    e.preventDefault(); // keep focus in the input
    accept(options[+li.dataset.i]);
  });
  form.addEventListener('submit', e => { e.preventDefault(); run(); });

  // the list of every command in this view, opened from the button next to the input
  const GROUPS = [txt('cmdGroupCreate'), txt('catDirections'), txt('catPlanes'), txt('cmdGroupPlaneViews'), txt('catSites'), txt('catPointDefects'), txt('catLineDefects'), txt('catCalculations'), txt('cmdGroup2D')];
  const listPop = new Popover({
    anchor: form.querySelector('[data-act="cmd-list"]'),
    placement: 'top-center',
    className: 'cmd-list-pop',
    label: txt('cmdAllTitle'),
    render() {
      const flat = ws.is2D();
      const rows = [...(ws.isDefects() ? [] : flat
        ? [{ group: txt('cmdGroupCreate'), usage: 'd1 = [1 2]', help: txt('cmdListDir2D') }, { group: txt('cmdGroupCreate'), usage: 'l1 = (1 2)', help: txt('cmdListLine2D') }]
        : [{ group: txt('cmdGroupCreate'), usage: 'd1 = [1 1 0]', help: txt('cmdListDir') },
          { group: txt('cmdGroupCreate'), usage: 'p1 = (1 1 1)', help: txt('cmdListPlane') }]),
        ...commandList().filter(inView).map(c => ({ group: c.group || (flat ? txt('cmdGroup2D') : txt('catCalculations')), usage: c.usage, help: c.help }))];
      const groups = GROUPS.filter(g => rows.some(r => r.group === g));
      return `<div class="menu-head"><span class="menu-title">${txt('cmdListTitle')}</span>
        <span class="menu-sub">${txt(ws.isDefects() ? 'cmdListSubDefects' : 'cmdListSub')}</span></div>
        ${groups.map(g => `<section class="cl-group"><h4>${g}</h4>${rows.filter(r => r.group === g)
          .map(r => `<button type="button" class="cl-row" data-usage="${esc(r.usage)}"><code>${esc(r.usage)}</code><small>${esc(r.help)}</small></button>`).join('')}</section>`).join('')}`;
    },
    onClick: {
      '[data-usage]': b => {
        input.value = b.dataset.usage;
        input.focus();
        input.setSelectionRange(input.value.length, input.value.length);
        update();
      },
    },
  });
  form.querySelector('[data-act="cmd-list"]').addEventListener('click', () => listPop.toggle());

  return {
    refresh: () => {
      input.placeholder = ws.isDefects() ? 'Vacancy()  ·  Edge()  ·  Burgers(edge1)'
        : ws.is2D() ? 'd1 = [1 2]  ·  l1 = (1 2)  ·  v1 = Vector((0, 0), (1, 2))' : 'd1 = [1 1 0]  ·  p1 = (1 1 1)  ·  Spacing(p1)';
      if (document.activeElement === input) update();
    },
    /** Put a definition in the input bar to be changed, e.g. "p1 = (1 1 1)". */
    edit(text) {
      input.value = text;
      input.focus();
      const open = text.lastIndexOf('(') >= 0 ? text.indexOf('=') + 2 : text.length;
      input.setSelectionRange(Math.min(open, text.length), text.length);
      say(txt('cmdEditHint'), 'ok');
    },
  };
}
