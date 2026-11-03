/* A simple modal dialog built on <dialog>. */
import { icon } from '../icons.js';
import { txt } from '../../text.js';

export function openModal({ title, body, wide = false }) {
  const d = document.createElement('dialog');
  d.className = `modal${wide ? ' is-wide' : ''}`;
  d.innerHTML = `<div class="modal-card">
    <header class="modal-head"><h2>${title}</h2>
      <button class="icon-btn" type="button" data-close aria-label="${txt('close')}">${icon('x')}</button></header>
    <div class="modal-body">${body}</div>
  </div>`;
  document.body.appendChild(d);
  const close = () => { d.close(); };
  d.addEventListener('close', () => d.remove());
  d.addEventListener('click', e => {
    if (e.target === d || e.target.closest('[data-close]')) close();
  });
  d.showModal();
  return { el: d, close };
}

/** A yes / no question. Resolves to true when the user confirms; Escape, × and the backdrop mean no. */
export function confirmModal({ title, body, confirmLabel = txt('ok'), cancelLabel = txt('cancel'), danger = false }) {
  return new Promise(resolve => {
    const { el } = openModal({
      title,
      body: `${body}<form method="dialog" class="modal-actions">
        <button class="btn" value="no" autofocus>${cancelLabel}</button>
        <button class="btn ${danger ? 'btn-danger' : 'btn-primary'}" value="yes">${confirmLabel}</button>
      </form>`,
    });
    el.addEventListener('close', () => resolve(el.returnValue === 'yes'));
  });
}
