/* Mode select: large "level" cards. Crystal Structures and Defects are open; the others are coming soon. */
import { h, restartAnim } from '../dom.js';
import { icon } from '../icons.js';
import { themeButton } from '../theme.js';
import { toast } from '../components/toast.js';
import { findBravais, latticeBasis } from '../../data/bravais.js';
import { latticeThumbnail } from '../../render/thumbnail.js';
import { txt } from '../../text.js';

/** A 2D crystal slice with a vacancy and an interstitial, for the Defects card. */
function defectArt() {
  const dots = [];
  for (let r = 0; r < 4; r++) for (let c = 0; c < 5; c++) {
    const x = 34 + c * 33, y = 34 + r * 33;
    if (r === 1 && c === 3) { dots.push(`<circle cx="${x}" cy="${y}" r="11" class="art-vacancy"/>`); continue; }
    const pull = r === 1 && c === 2 ? 3 : r === 1 && c === 4 ? -3 : 0;
    dots.push(`<circle cx="${x + pull}" cy="${y}" r="11" class="art-atom"/>`);
  }
  dots.push('<circle cx="83" cy="83" r="7" class="art-interstitial"/>');
  return `<svg class="mode-svg" viewBox="0 0 200 166" aria-hidden="true">${dots.join('')}</svg>`;
}

/** A binary eutectic phase diagram (liquidus, solidus, solvus, eutectic line), for the Phase diagrams card. */
const phaseArt = () => `<svg class="mode-svg" viewBox="78 0 320 215" aria-hidden="true">
  <g fill="none" stroke="currentColor" stroke-width="6" stroke-linecap="round" stroke-linejoin="round">
    <path d="M103,8 L103,200"/><path d="M370,8 L370,200"/><path d="M103,191 L370,191"/>
    <path d="M103,40 L205,112 L370,12"/>
    <path d="M103,40 C110,65 118,90 122,112"/><path d="M122,112 C114,140 108,165 106,191"/>
    <path d="M370,12 C364,50 352,85 347,112"/><path d="M347,112 C357,140 363,165 365,191"/>
    <path d="M122,112 L347,112"/>
  </g>
  <path d="M205,14 L205,191" fill="none" stroke="currentColor" stroke-width="4.5" stroke-dasharray="11 9"/>
</svg>`;

/** Modes that are shown but not open yet: art is an SVG string or an icon name. */
const LOCKED = [
  { mode: 'challenge', name: txt('modesChallengeName'), art: 'paper', tags: [txt('modesChallengeTag1'), txt('modesChallengeTag2'), txt('modesTagCalculations')],
    desc: txt('modesChallengeDesc') },
  { mode: 'phases', name: txt('modesPhasesName'), art: phaseArt(), tags: [txt('modesPhasesTag1'), txt('modesPhasesTag2'), txt('modesPhasesTag3')],
    desc: txt('modesPhasesDesc') },
  { mode: 'builder', name: txt('modesBuilderName'), art: 'hammer', tags: [txt('modesBuilderTag1')],
    desc: txt('modesBuilderDesc') },
];

const OPEN = ['crystal', 'defects'];

const lockedCard = (m, i) => `<button type="button" class="mode-card is-locked" data-mode="${m.mode}" aria-disabled="true">
          <span class="mode-num">${String(i + 1 + OPEN.length).padStart(2, '0')}</span>
          <span class="mode-ribbon">${icon('lock')}${txt('modesComingSoon')}</span>
          <span class="mode-art">${m.art.startsWith('<') ? m.art : icon(m.art, 'mode-svg')}</span>
          <span class="mode-body">
            <span class="mode-name">${m.name}</span>
            <span class="mode-desc">${m.desc}</span>
            <span class="mode-tags">${m.tags.map(t => `<span>${t}</span>`).join('')}</span>
          </span>
          <span class="mode-cta">${txt('modesLocked')} ${icon('lock')}</span>
        </button>`;

export function createModeSelect({ onPick, onHome }) {
  const cF = findBravais('cF');
  const crystalArt = latticeThumbnail(cF.params, latticeBasis(cF), { size: 150, pad: 0.1 });

  const el = h(`<section class="screen mode-screen" data-screen="modes" aria-label="${txt('modesScreenLabel')}">
    <header class="screen-top">
      <button type="button" class="btn home-pill" data-act="home">${icon('home')}<span>${txt('topHomeLabel')}</span></button>
      ${themeButton('icon-btn-lg on-glass')}
    </header>
    <div class="mode-content">
      <p class="mode-kicker">${txt('modesKicker')}</p>
      <h1 class="mode-title">${txt('modesTitle')}</h1>
      <div class="mode-cards">
        <button type="button" class="mode-card" data-mode="crystal">
          <span class="mode-num">01</span>
          <span class="mode-art">${crystalArt}</span>
          <span class="mode-body">
            <span class="mode-name">${txt('crystalStructures')}</span>
            <span class="mode-desc">${txt('modesCrystalDesc')}</span>
            <span class="mode-tags"><span>${txt('modesCrystalTag1')}</span><span>${txt('modesCrystalTag2')}</span><span>${txt('modesCrystalTag3')}</span><span>${txt('modesTagCalculations')}</span></span>
          </span>
          <span class="mode-cta">${txt('modesPlay')} ${icon('chevronRight')}</span>
        </button>
        <button type="button" class="mode-card" data-mode="defects">
          <span class="mode-num">02</span>
          <span class="mode-art">${defectArt()}</span>
          <span class="mode-body">
            <span class="mode-name">${txt('modesDefectsName')}</span>
            <span class="mode-desc">${txt('modesDefectsDesc')}</span>
            <span class="mode-tags"><span>${txt('modesDefectsTag1')}</span><span>${txt('modesDefectsTag2')}</span><span>${txt('modesDefectsTag3')}</span></span>
          </span>
          <span class="mode-cta">${txt('modesPlay')} ${icon('chevronRight')}</span>
        </button>
        ${LOCKED.map(lockedCard).join('')}
      </div>
    </div>
  </section>`);

  el.addEventListener('click', e => {
    if (e.target.closest('[data-act="home"]')) { onHome(); return; }
    const card = e.target.closest('[data-mode]');
    if (!card) return;
    if (OPEN.includes(card.dataset.mode)) { onPick(card.dataset.mode); return; }
    restartAnim(card, 'shake');
    toast(txt('msgModeLocked', { mode: card.querySelector('.mode-name').textContent }), { tone: 'info', icon: 'lock' });
  });

  return { el, show() {}, hide() {} };
}
