// @vitest-environment happy-dom
/* Challenge mode screen: setup → test → results → review → done, the countdown,
   going back to change an answer, and that nothing is kept afterwards. */
import { describe, it, expect, beforeEach } from 'vitest';
import { ChallengeScreen } from '../src/ui/screens/challenge.js';

let clockNow = 0, tick = null, confirms = [];
/** A screen with a clock we move by hand and dialogs that answer by themselves. */
function screen({ confirmAnswer = true } = {}) {
  clockNow = 1_000_000; tick = null; confirms = [];
  const s = new ChallengeScreen({
    onHome: () => { s.wentHome = true; },
    confirm: async opts => { confirms.push(opts); return confirmAnswer; },
    now: () => clockNow,
    schedule: fn => { tick = fn; return 1; },
    unschedule: () => { tick = null; },
  });
  document.body.innerHTML = '';
  s.mount(document.body);
  return s;
}
const $ = (s, sel) => s.el.querySelector(sel);
const $$ = (s, sel) => [...s.el.querySelectorAll(sel)];
const click = el => el.dispatchEvent(new MouseEvent('click', { bubbles: true }));
const type = (el, value) => { el.value = value; el.dispatchEvent(new Event('input', { bubbles: true })); };
const flush = () => new Promise(r => setTimeout(r, 0));

/** Fill the setup form and press Start. */
function start(s, { count = '5', minutes = '10', level = 'easy' } = {}) {
  click($(s, `[data-level="${level}"]`));
  type($(s, '[data-field="count"]'), count);
  type($(s, '[data-field="minutes"]'), minutes);
  $(s, 'form').dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
}

/** Answer the current question correctly (or wrongly). */
function answer(s, right = true) {
  const q = s.test.questions[s.test.current];
  if (q.format === 'mc') click($(s, `[data-choice="${right ? q.correctIndex : (q.correctIndex + 1) % 4}"]`));
  else type($(s, '[data-field="typed"]'), right ? (q.spec.kind === 'indices' ? q.spec.values.join(' ') : String(q.spec.value)) : '9 9 9');
}

beforeEach(() => { document.body.innerHTML = ''; });

describe('Challenge mode: setup', () => {
  it('offers the subject, every topic, three difficulties and the limits', () => {
    const s = screen();
    expect($$(s, '[data-field="subject"] option').map(o => o.textContent)).toEqual(['Crystallography']);
    expect($$(s, '[data-topic]')).toHaveLength(7);
    expect($$(s, '[data-topic]').every(c => c.checked)).toBe(true);
    expect($(s, '[data-ref="topics-now"]').textContent).toBe('All topics (7)');
    expect($$(s, '[data-level]').map(b => b.textContent)).toEqual(['Easy', 'Medium', 'Hard']);
    expect($(s, '[data-field="count"]').max).toBe('100');
    expect($(s, '[data-field="minutes"]').max).toBe('120');
  });

  it('refuses bad settings with a message', () => {
    const s = screen();
    start(s, { count: '101' });
    expect($(s, '[data-ref="error"]').hidden).toBe(false);
    expect($(s, '[data-ref="error"]').textContent).toMatch(/1 to 100/);
    start(s, { count: '5', minutes: '0' });
    expect($(s, '[data-ref="error"]').textContent).toMatch(/1 to 120/);
    click($(s, '[data-act="topics-none"]'));
    expect($(s, '[data-ref="topics-now"]').textContent).toBe('No topics chosen');
    start(s);
    expect($(s, '[data-ref="error"]').textContent).toMatch(/at least one topic/);
    expect(s.phase).toBe('setup');
  });

  it('can start with a single topic', () => {
    const s = screen();
    click($(s, '[data-act="topics-none"]'));
    const box = $(s, '[data-topic="c-planes"]');
    box.checked = true;
    box.dispatchEvent(new Event('change', { bubbles: true }));
    expect($(s, '[data-ref="topics-now"]').textContent).toBe('Planes (cubic)');
    start(s);
    expect(s.phase).toBe('test');
    expect(s.test.questions.every(q => q.topicId === 'c-planes')).toBe(true);
  });
});

describe('Challenge mode: the test', () => {
  it('shows one question at a time with "1 / 5", a countdown and numbered boxes', () => {
    const s = screen();
    start(s);
    expect($(s, '[data-ref="counter"]').textContent).toBe('1 / 5');
    expect($(s, '[data-ref="timer"]').textContent).toBe('10:00');
    expect($$(s, '.ch-dot')).toHaveLength(5);
    expect($$(s, '.ch-question')).toHaveLength(1);
    clockNow += 61_000; tick();
    expect($(s, '[data-ref="timer"]').textContent).toBe('08:59');
  });

  it('keeps answers when going back and forth, and they can be changed', () => {
    const s = screen();
    start(s);
    answer(s, false);
    expect($(s, '[data-goto="0"]').classList.contains('is-answered')).toBe(true);
    click($(s, '[data-act="next"]'));
    expect($(s, '[data-ref="counter"]').textContent).toBe('2 / 5');
    click($(s, '[data-goto="0"]'));
    expect($(s, '[data-ref="counter"]').textContent).toBe('1 / 5');
    const q = s.test.questions[0];
    if (q.format === 'mc') expect($(s, `[data-choice="${(q.correctIndex + 1) % 4}"]`).getAttribute('aria-checked')).toBe('true');
    else expect($(s, '[data-field="typed"]').value).toBe('9 9 9');
    answer(s, true);
    expect(s.test.answers[0]).not.toBeNull();
  });

  it('shows how a typed answer is read', () => {
    const s = screen();
    click($(s, '[data-act="topics-none"]'));
    const box = $(s, '[data-topic="g-miller-bravais"]');
    box.checked = true;
    box.dispatchEvent(new Event('change', { bubbles: true }));
    start(s, { count: '40' });
    const i = s.test.questions.findIndex(q => q.format === 'typed');
    expect(i).toBeGreaterThanOrEqual(0);
    click($(s, `[data-goto="${i}"]`));
    type($(s, '[data-field="typed"]'), '2-1-10');
    expect($(s, '[data-ref="preview"]').innerHTML).toContain('<span class="ob">1</span>');
    type($(s, '[data-field="typed"]'), 'abc');
    expect($(s, '[data-ref="preview"]').textContent).toMatch(/Can't read/);
  });

  it('asks before submitting with questions left, then shows the results', async () => {
    const s = screen();
    start(s);
    answer(s, true);
    click($(s, '[data-act="next"]'));
    answer(s, false);
    click($$(s, '[data-act="submit"]')[0]);
    await flush();
    expect(confirms[0].body).toMatch(/3 of 5 questions have no answer/);
    expect(s.phase).toBe('results');
    const stats = $$(s, '.ch-stat b').map(b => b.textContent);
    expect(stats).toEqual(['1', '1', '3']);
    expect($(s, '.ch-percent').textContent).toBe('20%');
  });

  it('submits by itself when the time is up (unanswered = wrong)', () => {
    const s = screen();
    start(s, { minutes: '1' });
    answer(s, true);
    clockNow += 60_500; tick();
    expect(s.phase).toBe('results');
    expect($$(s, '.ch-stat b').map(b => b.textContent)).toEqual(['1', '0', '4']);
    expect(tick).toBeNull();
  });

  it('asks before leaving a test with Home', async () => {
    const s = screen({ confirmAnswer: false });
    start(s);
    click($(s, '[data-act="home"]'));
    await flush();
    expect(confirms[0].title).toMatch(/Leave the test/);
    expect(s.phase).toBe('test');
    expect(s.wentHome).toBeUndefined();
  });
});

describe('Challenge mode: review', () => {
  it('colours every question, shows the right answer and the solution, and Done forgets everything', async () => {
    const s = screen();
    start(s, { count: '3' });
    answer(s, true);
    click($(s, '[data-act="next"]'));
    answer(s, false);
    click($(s, '[data-act="next"]'));
    answer(s, true);
    click($$(s, '[data-act="submit"]')[0]);
    await flush();
    expect(s.phase).toBe('results');
    click($(s, '[data-act="review"]'));
    expect(s.phase).toBe('review');
    expect($$(s, '.ch-dot').map(d => d.classList.contains('is-right'))).toEqual([true, false, true]);
    expect($(s, '[data-goto="1"]').classList.contains('is-wrong')).toBe(true);
    expect($(s, '.ch-question').classList.contains('is-right')).toBe(true);
    expect($(s, '.ch-solution').textContent.length).toBeGreaterThan(10);
    click($(s, '[data-goto="1"]'));
    const q = s.result.questions[1];
    expect($(s, '.ch-question').classList.contains('is-wrong')).toBe(true);
    if (q.format === 'mc') {
      expect($(s, '.ch-option.is-correct')).not.toBeNull();
      expect($(s, '.ch-option.is-picked-wrong')).not.toBeNull();
    } else {
      expect($(s, '.ch-answers').textContent).toMatch(/Correct answer/);
      expect($(s, '.ch-answers').textContent).toContain('9 9 9');
    }
    click($$(s, '[data-act="done"]')[0]);
    expect(s.phase).toBe('setup');
    expect(s.result).toBeNull();
    expect(s.test).toBeNull();
    expect($(s, 'form')).not.toBeNull();
  });

  it('shows unanswered questions in grey, not red', async () => {
    const s = screen();
    start(s, { count: '3' });
    answer(s, false); // question 1 wrong, 2 and 3 left blank
    click($$(s, '[data-act="submit"]')[0]);
    await flush();
    click($(s, '[data-act="review"]'));
    const dots = $$(s, '.ch-dot').map(d => ['is-right', 'is-wrong', 'is-blank'].filter(c => d.classList.contains(c)));
    expect(dots).toEqual([['is-wrong'], ['is-blank'], ['is-blank']]);
    click($(s, '[data-goto="1"]'));
    const card = $(s, '.ch-question');
    expect(card.classList.contains('is-blank')).toBe(true);
    expect(card.classList.contains('is-wrong')).toBe(false);
    expect($(s, '.ch-status').classList.contains('chip-muted')).toBe(true);
    expect($(s, '.ch-status').textContent).toBe('Not answered');
    // the right answer is still shown in green
    expect($(s, '.ch-option.is-correct, .ch-answer-row.is-right')).not.toBeNull();
    expect($(s, '.ch-option.is-picked-wrong')).toBeNull();
  });

  it('leaving the screen throws the test away', () => {
    const s = screen();
    start(s);
    s.hide();
    expect(s.phase).toBe('setup');
    expect(s.test).toBeNull();
    expect(tick).toBeNull();
  });
});
