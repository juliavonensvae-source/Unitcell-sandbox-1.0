/* =====================================================================
   Challenge mode screen: setup → test → results → review.

   Setup: subject, topics (a dropdown of check boxes), difficulty, number
   of questions (1–100), time limit (1–120 min).
   Test: one question at a time, a countdown, "7 / 20", Back / Next and a
   row of numbered boxes to jump to any question; answers can be changed
   until Submit. Time running out submits the test (unanswered = wrong).
   Results: right, wrong, not answered, percentage.
   Review: every question green (right) or red (wrong), with the answer
   given, the right answer and the solution. "Done" throws everything away:
   nothing is saved anywhere, not even in the browser.
   ===================================================================== */
import { h, esc } from '../dom.js';
import { icon } from '../icons.js';
import { themeButton } from '../theme.js';
import { toast } from '../components/toast.js';
import { confirmModal } from '../components/modal.js';
import { idx } from '../format.js';
import { txt } from '../../text.js';
import { SUBJECTS } from '../../challenge/index.js';
import { LEVELS } from '../../challenge/templates.js';
import { buildTest, score, topicsWithQuestions } from '../../challenge/engine.js';
import { parseIndexText, parseNumberText } from '../../challenge/answers.js';

const LEVEL_TEXT = { easy: 'chEasy', medium: 'chMedium', hard: 'chHard' };
const LETTERS = ['A', 'B', 'C', 'D'];
/** How each mark looks in the review: green right, red wrong, grey not answered. */
const STATUS = {
  right: { cls: 'is-right', chip: 'chip-good', icon: 'check', text: 'chRight' },
  wrong: { cls: 'is-wrong', chip: 'chip-bad', icon: 'x', text: 'chWrong' },
  blank: { cls: 'is-blank', chip: 'chip-muted', icon: 'minus', text: 'chBlank' },
};
const LIMITS = { count: [1, 100], minutes: [1, 120] };

/** mm:ss (or h:mm:ss) for a number of milliseconds. */
function clock(ms) {
  const s = Math.max(0, Math.ceil(ms / 1000)), hh = Math.floor(s / 3600), mm = Math.floor((s % 3600) / 60), ss = s % 60;
  const two = x => String(x).padStart(2, '0');
  return hh ? `${hh}:${two(mm)}:${two(ss)}` : `${two(mm)}:${two(ss)}`;
}

/** A whole number within [lo, hi], or null. */
function wholeIn(text, [lo, hi]) {
  const s = String(text).trim();
  if (!/^\d+$/.test(s)) return null;
  const n = Number(s);
  return n >= lo && n <= hi ? n : null;
}

export class ChallengeScreen {
  /**
   * onHome: go to the start screen. confirm / now / schedule can be replaced in the tests
   * (a dialog that answers by itself, a clock that jumps ahead).
   */
  constructor({ onHome, confirm = confirmModal, now = () => Date.now(), schedule = fn => setInterval(fn, 250), unschedule = id => clearInterval(id) }) {
    this.onHome = onHome;
    this.confirm = confirm;
    this.now = now;
    this.schedule = schedule;
    this.unschedule = unschedule;
    const subject = SUBJECTS[0];
    // the settings stay while the page is open (they are not results); nothing is stored
    this.settings = { subjectId: subject?.id, topicIds: subject ? subject.topics.map(t => t.id) : [], level: 'medium', count: '10', minutes: '15' };
    this.phase = 'setup';
    this.test = null;   // { questions, answers, current, endAt }
    this.result = null; // { questions, answers, marks, summary, current }
    this.timer = null;

    this.el = h(`<section class="screen ch-screen" data-screen="challenge" aria-label="${txt('chScreenLabel')}">
      <header class="screen-top">
        <button type="button" class="btn home-pill" data-act="home">${icon('home')}<span>${txt('topHomeLabel')}</span></button>
        ${themeButton('icon-btn-lg on-glass')}
      </header>
      <div class="ch-content" data-ref="content"></div>
    </section>`);
    this.content = this.el.querySelector('[data-ref="content"]');
    this.el.addEventListener('click', e => this.onClick(e));
    this.el.addEventListener('input', e => this.onInput(e));
    this.el.addEventListener('change', e => this.onInput(e));
    this.el.addEventListener('submit', e => { e.preventDefault(); this.start(); });
    this.el.addEventListener('keydown', e => this.onKey(e));
    // the topics dropdown closes on a click outside it
    document.addEventListener('pointerdown', e => {
      const d = this.content.querySelector('.ch-multi[open]');
      if (d && !d.contains(e.target)) d.open = false;
    });
    this.render();
  }

  mount(parent) { parent.appendChild(this.el); }
  show() {}
  /** Leaving the screen (another screen is shown) throws the test and its results away. */
  hide() { this.discard(); }

  get subject() { return SUBJECTS.find(s => s.id === this.settings.subjectId) || SUBJECTS[0]; }

  /* ---------- rendering ---------- */

  render() {
    const html = { setup: () => this.setupHtml(), test: () => this.testHtml(), results: () => this.resultsHtml(), review: () => this.reviewHtml() }[this.phase]();
    this.content.innerHTML = html;
    this.el.scrollTop = 0;
  }

  setupHtml() {
    const subject = this.subject, st = this.settings;
    if (!subject) return `<div class="ch-wrap ch-setup"><h1 class="ch-title">${txt('chTitle')}</h1></div>`;
    const hint = subject.levels?.[st.level] || '';
    return `<div class="ch-wrap ch-setup">
      <p class="mode-kicker">${txt('chKicker')}</p>
      <h1 class="ch-title">${txt('chTitle')}</h1>
      <p class="ch-intro">${txt('chIntro')}</p>
      <form class="ch-card ch-form" novalidate>
        <label class="ch-field"><span class="ch-label">${txt('chSubject')}</span>
          <select class="input" data-field="subject">${SUBJECTS.map(s => `<option value="${esc(s.id)}"${s.id === subject.id ? ' selected' : ''}>${esc(s.name)}</option>`).join('')}</select>
        </label>
        <div class="ch-field"><span class="ch-label" id="ch-topics-label">${txt('chTopics')}</span>
          <details class="ch-multi">
            <summary class="input ch-multi-sum" aria-labelledby="ch-topics-label ch-topics-now"><span id="ch-topics-now" data-ref="topics-now">${this.topicsSummary()}</span>${icon('chevronDown')}</summary>
            <div class="ch-multi-panel">
              <div class="ch-multi-tools">
                <button type="button" class="link-btn" data-act="topics-all">${txt('chSelectAll')}</button>
                <button type="button" class="link-btn" data-act="topics-none">${txt('chSelectNone')}</button>
              </div>
              ${subject.topics.map(t => `<label class="ch-check"><input type="checkbox" data-topic="${esc(t.id)}"${st.topicIds.includes(t.id) ? ' checked' : ''}><span>${t.name}</span></label>`).join('')}
            </div>
          </details>
        </div>
        <div class="ch-field"><span class="ch-label" id="ch-level-label">${txt('chDifficulty')}</span>
          <div class="seg seg-block" role="group" aria-labelledby="ch-level-label">
            ${LEVELS.map(l => `<button type="button" data-level="${l}" aria-pressed="${l === st.level}">${txt(LEVEL_TEXT[l])}</button>`).join('')}
          </div>
          <p class="ch-hint" data-ref="level-hint"${hint ? '' : ' hidden'}>${hint}</p>
        </div>
        <div class="ch-row">
          <label class="ch-field"><span class="ch-label">${txt('chCount')}</span>
            <input class="input" type="number" inputmode="numeric" min="1" max="100" step="1" data-field="count" value="${esc(st.count)}">
            <span class="ch-hint">${txt('chCountHint')}</span></label>
          <label class="ch-field"><span class="ch-label">${txt('chTime')}</span>
            <input class="input" type="number" inputmode="numeric" min="1" max="120" step="1" data-field="minutes" value="${esc(st.minutes)}">
            <span class="ch-hint">${txt('chTimeHint')}</span></label>
        </div>
        <p class="ch-error" role="alert" data-ref="error" hidden></p>
        <button type="submit" class="btn btn-primary ch-start">${txt('chStart')} ${icon('play')}</button>
      </form>
    </div>`;
  }

  topicsSummary() {
    const total = this.subject.topics.length, n = this.settings.topicIds.length;
    if (!n) return txt('chTopicsNone');
    if (n === total) return txt('chTopicsAll', { count: total });
    if (n === 1) return this.subject.topics.find(t => t.id === this.settings.topicIds[0]).name;
    return txt('chTopicsSome', { count: n, total });
  }

  /** The row of numbered boxes. mode 'test' marks answered ones; 'review' colours them right / wrong. */
  gridHtml(count, current, cls) {
    return `<nav class="ch-grid" aria-label="${txt('chQuestionList')}">${Array.from({ length: count }, (_, i) =>
      `<button type="button" class="ch-dot ${cls(i)}${i === current ? ' is-current' : ''}" data-goto="${i}" aria-label="${txt('chQuestionOf', { n: i + 1, total: count })}"${i === current ? ' aria-current="step"' : ''}>${i + 1}</button>`).join('')}</nav>`;
  }

  questionHead(q, i, total, status = '') {
    return `<div class="ch-qhead"><span class="ch-qnum">${txt('chQuestionOf', { n: i + 1, total })}</span>
      <span class="chip chip-muted">${esc(q.topic)}</span>${status}</div>
      <div class="ch-prompt">${q.prompt}</div>
      ${q.figure ? `<figure class="ch-figure">${q.figure}</figure>` : ''}`;
  }

  testHtml() {
    const t = this.test, q = t.questions[t.current], i = t.current, n = t.questions.length, a = t.answers[i];
    const last = i === n - 1;
    let body;
    if (q.format === 'mc') {
      body = `<div class="ch-options" role="radiogroup" aria-label="${txt('chOptionsLabel')}">${q.options.map((o, k) =>
        `<button type="button" class="ch-option" role="radio" aria-checked="${a === k}" data-choice="${k}"><span class="ch-letter">${LETTERS[k]}</span><span class="ch-opt-text">${o}</span></button>`).join('')}</div>`;
    } else {
      const unit = q.spec.unit ? `<span class="ch-unit">${esc(q.spec.unit)}</span>` : '';
      body = `<label class="ch-typed"><span class="ch-label">${txt('chYourAnswer')}</span>
        <span class="ch-typed-row"><input class="input ch-typed-input" type="text" data-field="typed" autocomplete="off" autocapitalize="off" spellcheck="false"
          inputmode="${q.spec.kind === 'number' ? 'decimal' : 'text'}" placeholder="${q.spec.kind === 'number' ? txt('chTypeNumber') : txt('chTypeIndices')}" value="${esc(a ?? '')}">${unit}</span></label>
        <p class="ch-preview" data-ref="preview" aria-live="polite">${this.previewHtml(q, a)}</p>`;
    }
    return `<div class="ch-wrap ch-test">
      <div class="ch-card ch-bar">
        <span class="ch-counter" data-ref="counter">${txt('chCounter', { n: i + 1, total: n })}</span>
        <span class="ch-timer" role="timer" aria-label="${txt('chTimeLeft')}" data-ref="timer">${icon('clock')}<span>${clock(t.endAt - this.now())}</span></span>
        <button type="button" class="btn btn-primary btn-sm" data-act="submit">${txt('chSubmit')}</button>
      </div>
      ${this.gridHtml(n, i, k => (this.answered(k) ? 'is-answered' : ''))}
      <article class="ch-card ch-question">${this.questionHead(q, i, n)}${body}</article>
      <div class="ch-nav">
        <button type="button" class="btn" data-act="prev"${i === 0 ? ' disabled' : ''}>${icon('chevronLeft')}${txt('chBack')}</button>
        ${last ? `<button type="button" class="btn btn-primary" data-act="submit">${txt('chSubmit')}</button>`
    : `<button type="button" class="btn btn-primary" data-act="next">${txt('chNext')}${icon('chevronRight')}</button>`}
      </div>
    </div>`;
  }

  /** "Reads as [1̄10]" under a typed answer, so the student sees how it was understood. */
  previewHtml(q, text) {
    if (!String(text ?? '').trim()) return '';
    if (q.spec.kind === 'number') {
      const p = parseNumberText(text);
      return p.error ? `<span class="is-bad">${txt('chCantReadNumber')}</span>` : txt('chReadsAs', { value: `${p.value}${q.spec.unit ? ` ${q.spec.unit}` : ''}` });
    }
    const p = parseIndexText(text);
    return p.error ? `<span class="is-bad">${txt('chCantRead')}</span>` : txt('chReadsAs', { value: idx(p.values, q.bracket || 'dir') });
  }

  answered(i) {
    const a = this.test.answers[i];
    return a != null && String(a).trim() !== '';
  }

  resultsHtml() {
    const s = this.result.summary;
    return `<div class="ch-wrap ch-results">
      <p class="mode-kicker">${txt('chKicker')}</p>
      <h1 class="ch-title">${txt('chResultsTitle')}</h1>
      <div class="ch-card ch-score">
        <div class="ch-percent">${s.percent}%</div>
        <div class="ch-score-line">${txt('chScoreLine', { right: s.right, total: s.total })}</div>
        <div class="ch-stats">
          <div class="ch-stat is-right"><b>${s.right}</b><span>${txt('chRight')}</span></div>
          <div class="ch-stat is-wrong"><b>${s.wrong}</b><span>${txt('chWrong')}</span></div>
          <div class="ch-stat is-blank"><b>${s.blank}</b><span>${txt('chBlank')}</span></div>
        </div>
      </div>
      <p class="ch-note">${txt('chResultsNote')}</p>
      <div class="ch-actions">
        <button type="button" class="btn" data-act="done">${txt('chDone')}</button>
        <button type="button" class="btn btn-primary" data-act="review">${txt('chReview')}${icon('chevronRight')}</button>
      </div>
    </div>`;
  }

  /** The explanation of a wrong typed answer (not reduced, the wrong sign, …). */
  hintText(q, hint) {
    if (hint === 'reduce') return txt('chHintReduce', { answer: q.answer });
    if (hint === 'reversed') return q.bracket === 'plane' ? txt('chHintReversedPlane') : txt('chHintReversedDir');
    if (hint === 'count') return txt('chHintCount', { count: q.spec.values.length });
    if (hint === 'format') return txt('chHintFormat');
    return '';
  }

  reviewHtml() {
    const r = this.result, i = r.current, q = r.questions[i], n = r.questions.length, m = r.marks[i], a = r.answers[i];
    const right = m.status === 'right';
    // green = right, red = wrong, grey = not answered (it still counts as wrong in the score)
    const status = STATUS[m.status];
    const statusChip = `<span class="chip ${status.chip} ch-status">${icon(status.icon)}${txt(status.text)}</span>`;
    let body;
    if (q.format === 'mc') {
      body = `<div class="ch-options" aria-label="${txt('chOptionsLabel')}">${q.options.map((o, k) => {
        const cls = k === q.correctIndex ? 'is-correct' : k === a ? 'is-picked-wrong' : '';
        const mark = k === q.correctIndex ? icon('check', 'ch-mark') : k === a ? icon('x', 'ch-mark') : '';
        return `<div class="ch-option is-static ${cls}"${k === a ? ' aria-current="true"' : ''}><span class="ch-letter">${LETTERS[k]}</span><span class="ch-opt-text">${o}</span>${mark}</div>`;
      }).join('')}</div>`;
    } else {
      const given = String(a ?? '').trim();
      // "Reads as …" only when the answer could be read; otherwise the hint below says so
      const readable = given && !(q.spec.kind === 'number' ? parseNumberText(given) : parseIndexText(given)).error;
      const reads = readable ? this.previewHtml(q, given) : '';
      const hint = right ? '' : this.hintText(q, m.hint);
      body = `<div class="ch-answers">
        <div class="ch-answer-row ${status.cls}"><span class="ch-answer-label">${txt('chYourAnswer')}</span>
          <span class="ch-answer-value">${given ? `<code>${esc(given)}</code> <span class="ch-reads">${reads}</span>` : txt('chNoAnswer')}</span></div>
        ${right ? '' : `<div class="ch-answer-row is-right"><span class="ch-answer-label">${txt('chCorrectAnswer')}</span><span class="ch-answer-value">${q.answer}</span></div>`}
        ${hint ? `<p class="ch-answer-hint">${hint}</p>` : ''}
      </div>`;
    }
    return `<div class="ch-wrap ch-review">
      <div class="ch-card ch-bar">
        <span class="ch-counter">${txt('chReviewTitle')} · ${txt('chCounter', { n: i + 1, total: n })}</span>
        <button type="button" class="btn btn-primary btn-sm ch-bar-end" data-act="done">${txt('chDoneReview')}</button>
      </div>
      ${this.gridHtml(n, i, k => STATUS[r.marks[k].status].cls)}
      <article class="ch-card ch-question ${status.cls}">${this.questionHead(q, i, n, statusChip)}${body}
        ${q.explain ? `<div class="ch-solution"><h3>${txt('chSolution')}</h3><p>${q.explain}</p></div>` : ''}
      </article>
      <div class="ch-nav">
        <button type="button" class="btn" data-act="prev"${i === 0 ? ' disabled' : ''}>${icon('chevronLeft')}${txt('chBack')}</button>
        ${i === n - 1 ? `<button type="button" class="btn btn-primary" data-act="done">${txt('chDoneReview')}</button>`
    : `<button type="button" class="btn btn-primary" data-act="next">${txt('chNext')}${icon('chevronRight')}</button>`}
      </div>
    </div>`;
  }

  /* ---------- actions ---------- */

  start() {
    const st = this.settings, err = this.content.querySelector('[data-ref="error"]');
    const fail = msg => { err.textContent = msg; err.hidden = false; };
    const count = wholeIn(st.count, LIMITS.count), minutes = wholeIn(st.minutes, LIMITS.minutes);
    if (!st.topicIds.length) return fail(txt('chErrTopics'));
    if (count == null) return fail(txt('chErrCount'));
    if (minutes == null) return fail(txt('chErrTime'));
    if (!topicsWithQuestions(this.subject, st.topicIds, st.level).length) return fail(txt('chErrEmpty'));
    const questions = buildTest({ subject: this.subject, topicIds: st.topicIds, level: st.level, count });
    if (!questions.length) return fail(txt('chErrEmpty'));
    this.test = { questions, answers: questions.map(() => null), current: 0, endAt: this.now() + minutes * 60000 };
    this.phase = 'test';
    this.render();
    this.timer = this.schedule(() => this.tick());
    this.focusQuestion();
  }

  /** Called a few times a second during the test: updates the clock and submits at 0. */
  tick() {
    if (this.phase !== 'test') return;
    const left = this.test.endAt - this.now();
    const el = this.content.querySelector('[data-ref="timer"]');
    if (el) {
      el.lastElementChild.textContent = clock(left);
      el.classList.toggle('is-low', left <= 60000);
    }
    if (left <= 0) {
      this.finish();
      toast(txt('chTimeUp'), { tone: 'warn' });
    }
  }

  stopTimer() {
    if (this.timer != null) this.unschedule(this.timer);
    this.timer = null;
  }

  async submit() {
    const t = this.test, blank = t.questions.filter((q, i) => !this.answered(i)).length;
    if (blank) {
      const ok = await this.confirm({
        title: txt('chSubmitTitle'), body: `<p>${txt('chSubmitBody', { count: blank, total: t.questions.length })}</p>`,
        confirmLabel: txt('chSubmit'), cancelLabel: txt('chSubmitKeep'),
      });
      if (!ok || this.phase !== 'test') return; // (time may have run out while the dialog was open)
    }
    this.finish();
  }

  /** Marks the test and shows the results. */
  finish() {
    this.stopTimer();
    const { questions, answers } = this.test;
    const summary = score(questions, answers);
    this.result = { questions, answers, marks: summary.marks, summary, current: 0 };
    this.test = null;
    this.phase = 'results';
    this.render();
  }

  /** Throws away the test, the results and the review, and goes back to the setup. */
  discard() {
    this.stopTimer();
    this.test = null;
    this.result = null;
    if (this.phase !== 'setup') { this.phase = 'setup'; this.render(); }
  }

  go(i) {
    const holder = this.phase === 'test' ? this.test : this.result;
    const n = holder.questions.length;
    holder.current = Math.max(0, Math.min(n - 1, i));
    this.render();
    if (this.phase === 'test') this.focusQuestion();
  }

  focusQuestion() {
    const input = this.content.querySelector('.ch-typed-input');
    if (input) input.focus({ preventScroll: true });
  }

  async home() {
    if (this.phase === 'test') {
      const ok = await this.confirm({ title: txt('chLeaveTitle'), body: `<p>${txt('chLeaveBody')}</p>`, confirmLabel: txt('chLeave'), danger: true });
      if (!ok) return;
    }
    this.discard();
    this.onHome();
  }

  /* ---------- events ---------- */

  onClick(e) {
    const t = e.target;
    const act = t.closest('[data-act]')?.dataset.act;
    if (act === 'home') { this.home(); return; }
    if (this.phase === 'setup') {
      const level = t.closest('[data-level]');
      if (level) {
        this.settings.level = level.dataset.level;
        this.content.querySelectorAll('[data-level]').forEach(b => b.setAttribute('aria-pressed', String(b === level)));
        const hint = this.content.querySelector('[data-ref="level-hint"]'), text = this.subject.levels?.[this.settings.level] || '';
        hint.textContent = text;
        hint.hidden = !text;
        return;
      }
      if (act === 'topics-all' || act === 'topics-none') {
        this.settings.topicIds = act === 'topics-all' ? this.subject.topics.map(x => x.id) : [];
        this.content.querySelectorAll('[data-topic]').forEach(c => { c.checked = act === 'topics-all'; });
        this.content.querySelector('[data-ref="topics-now"]').textContent = this.topicsSummary();
      }
      return;
    }
    const goto = t.closest('[data-goto]');
    if (goto) { this.go(Number(goto.dataset.goto)); return; }
    if (act === 'prev') { this.go((this.test || this.result).current - 1); return; }
    if (act === 'next') { this.go((this.test || this.result).current + 1); return; }
    if (this.phase === 'test') {
      const choice = t.closest('[data-choice]');
      if (choice) { this.choose(Number(choice.dataset.choice)); return; }
      if (act === 'submit') { this.submit(); return; }
    }
    if (act === 'review') { this.phase = 'review'; this.result.current = 0; this.render(); return; }
    if (act === 'done') this.discard();
  }

  choose(k) {
    const t = this.test;
    t.answers[t.current] = t.answers[t.current] === k ? null : k; // a second click takes the answer back
    this.content.querySelectorAll('[data-choice]').forEach(b => b.setAttribute('aria-checked', String(Number(b.dataset.choice) === t.answers[t.current])));
    this.updateDot(t.current);
  }

  updateDot(i) {
    const dot = this.content.querySelector(`[data-goto="${i}"]`);
    if (dot) dot.classList.toggle('is-answered', this.answered(i));
  }

  onInput(e) {
    const t = e.target;
    if (this.phase === 'setup') {
      const st = this.settings;
      if (t.dataset.field === 'subject' && e.type === 'change') {
        st.subjectId = t.value;
        st.topicIds = this.subject.topics.map(x => x.id);
        this.render();
      } else if (t.dataset.field === 'count') st.count = t.value;
      else if (t.dataset.field === 'minutes') st.minutes = t.value;
      else if (t.dataset.topic) {
        st.topicIds = this.subject.topics.map(x => x.id).filter(id => this.content.querySelector(`[data-topic="${CSS.escape(id)}"]`)?.checked);
        this.content.querySelector('[data-ref="topics-now"]').textContent = this.topicsSummary();
      }
      const err = this.content.querySelector('[data-ref="error"]');
      if (err) err.hidden = true;
      return;
    }
    if (this.phase === 'test' && t.dataset.field === 'typed' && e.type === 'input') {
      const test = this.test, q = test.questions[test.current];
      test.answers[test.current] = t.value;
      this.content.querySelector('[data-ref="preview"]').innerHTML = this.previewHtml(q, t.value);
      this.updateDot(test.current);
    }
  }

  onKey(e) {
    if (this.phase !== 'test' && this.phase !== 'review') {
      if (e.key === 'Escape') { const d = this.content.querySelector('.ch-multi[open]'); if (d) { d.open = false; d.querySelector('summary').focus(); } }
      return;
    }
    if (e.ctrlKey || e.metaKey || e.altKey) return;
    const typing = e.target.closest('input, textarea, select');
    if (typing) {
      if (e.key === 'Enter' && this.phase === 'test') {
        e.preventDefault();
        if (this.test.current < this.test.questions.length - 1) this.go(this.test.current + 1);
      }
      return;
    }
    const cur = (this.test || this.result).current;
    if (e.key === 'ArrowRight') { e.preventDefault(); this.go(cur + 1); return; }
    if (e.key === 'ArrowLeft') { e.preventDefault(); this.go(cur - 1); return; }
    if (this.phase === 'test') {
      const k = '1234'.indexOf(e.key) >= 0 ? '1234'.indexOf(e.key) : 'abcd'.indexOf(e.key.toLowerCase());
      if (k >= 0 && this.test.questions[cur].format === 'mc') { e.preventDefault(); this.choose(k); }
    }
  }
}
