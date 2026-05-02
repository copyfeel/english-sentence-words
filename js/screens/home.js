/* ══════════════════════════════════════
   home.js - 시작화면
══════════════════════════════════════ */
import { router }                    from '../router.js';
import { tts }                       from '../components/tts.js';
import { ticker }                    from '../components/ticker.js';
import { getSentences, getSelectedIds, getFilterLevels } from '../store.js';
import { showToast }                 from '../utils/helpers.js';

const BUBBLE_WORDS = ['영어', '문장', '완성', '게임'];

const BUBBLE_CONFIGS = [
  { leftPct: 10, topPct: 12, size: 80, floatCls: 'bubble-f1', delay: '0s'    },
  { leftPct: 62, topPct:  8, size: 70, floatCls: 'bubble-f2', delay: '0.65s' },
  { leftPct: 18, topPct: 52, size: 74, floatCls: 'bubble-f3', delay: '1.2s'  },
  { leftPct: 65, topPct: 48, size: 66, floatCls: 'bubble-f4', delay: '0.35s' },
];

let _poppedCount = 0;

export function initHome() {
  const btnStart   = document.getElementById('btn-start');
  const btnAdmin   = document.getElementById('btn-admin');
  const countBadge = document.getElementById('home-question-count');

  btnStart.addEventListener('click', () => {
    const { sentences, error } = _getGameSentences();
    if (error) { showToast(error); return; }

    tts.unlock();
    ticker.init();

    router.navigate('game', { sentences, isWrongOnly: false });
  });

  btnAdmin.addEventListener('click', () => {
    router.navigate('admin');
  });

  router.register('home', {
    onEnter() {
      tts.stop();
      _updateCountBadge(countBadge);
      _initBubbles();
    },
    onLeave() {},
  });
}

/* ── 비눗방울 초기화 ──────────────────────── */
function _initBubbles() {
  const scene = document.getElementById('bubble-scene');
  if (!scene) return;

  scene.innerHTML = '';
  _poppedCount    = 0;

  const slots = document.querySelectorAll('.subtitle-slot');
  slots.forEach(slot => {
    slot.textContent = '';
    slot.classList.remove('filled');
  });

  const slotsWrap = document.getElementById('subtitle-slots');
  if (slotsWrap) slotsWrap.classList.remove('sentence-complete');

  BUBBLE_WORDS.forEach((word, idx) => {
    const cfg    = BUBBLE_CONFIGS[idx];
    const bubble = document.createElement('div');
    bubble.className = `bubble ${cfg.floatCls}`;
    bubble.style.cssText = [
      `left:${cfg.leftPct}%`,
      `top:${cfg.topPct}%`,
      `width:${cfg.size}px`,
      `height:${cfg.size}px`,
      `animation-delay:${cfg.delay}`,
    ].join(';');

    bubble.innerHTML = `<span class="bubble-word">${word}</span>`;

    const onPop = (e) => {
      e.preventDefault();
      _popBubble(bubble, idx);
    };
    bubble.addEventListener('click', onPop);
    bubble.addEventListener('touchend', onPop, { passive: false });

    scene.appendChild(bubble);
  });
}

/* ── 비눗방울 팝 + 단어 이동 ──────────────── */
function _popBubble(bubble, idx) {
  if (bubble.dataset.popped) return;
  bubble.dataset.popped = 'true';
  bubble.classList.add('popping');

  const bRect = bubble.getBoundingClientRect();
  const cx    = bRect.left + bRect.width  / 2;
  const cy    = bRect.top  + bRect.height / 2;

  const flyer = document.createElement('span');
  flyer.className    = 'word-flyer';
  flyer.textContent  = BUBBLE_WORDS[idx];
  flyer.style.left   = `${cx}px`;
  flyer.style.top    = `${cy}px`;
  document.body.appendChild(flyer);

  setTimeout(() => {
    bubble.style.visibility = 'hidden';

    const slot = document.querySelector(`.subtitle-slot[data-idx="${idx}"]`);
    if (!slot) { flyer.remove(); return; }

    const sRect = slot.getBoundingClientRect();
    const tx    = sRect.left + sRect.width  / 2;
    const ty    = sRect.top  + sRect.height / 2;

    flyer.style.transition = [
      'left 0.45s cubic-bezier(0.25, 0.46, 0.45, 0.94)',
      'top  0.45s cubic-bezier(0.25, 0.46, 0.45, 0.94)',
    ].join(',');
    flyer.style.left = `${tx}px`;
    flyer.style.top  = `${ty}px`;

    setTimeout(() => {
      flyer.remove();
      slot.textContent = BUBBLE_WORDS[idx];
      slot.classList.add('filled');

      _poppedCount++;
      if (_poppedCount === BUBBLE_WORDS.length) _onAllPopped();
    }, 470);
  }, 280);
}

function _onAllPopped() {
  const slotsWrap = document.getElementById('subtitle-slots');
  if (slotsWrap) slotsWrap.classList.add('sentence-complete');
}

/* ── 게임 문제 목록 결정 ──────────────────── */
function _getGameSentences() {
  const all          = getSentences();
  const filterLevels = getFilterLevels();
  const selectedIds  = getSelectedIds();

  if (all.length === 0) {
    return { error: '📝 먼저 관리자에서 문제를 추가해주세요!' };
  }

  if (filterLevels.length > 0) {
    const levelSet = new Set(filterLevels);
    const filtered = all.filter(s => levelSet.has(s.level));
    if (filtered.length === 0) {
      return { error: '⚠️ 선택된 레벨에 문제가 없습니다. 관리자에서 확인해주세요.' };
    }
    if (selectedIds.length > 0) {
      const idSet   = new Set(selectedIds);
      const checked = filtered.filter(s => idSet.has(s.id));
      if (checked.length > 0) return { sentences: checked };
    }
    return { sentences: filtered };
  }

  if (selectedIds.length > 0) {
    const idSet     = new Set(selectedIds);
    const sentences = all.filter(s => idSet.has(s.id));
    if (sentences.length === 0) {
      return { error: '⚠️ 선택된 문제가 없습니다. 관리자에서 체크해주세요.' };
    }
    return { sentences };
  }

  return { sentences: all };
}

/* ── 홈 화면 배지 업데이트 ────────────────── */
function _updateCountBadge(badge) {
  if (!badge) return;
  const all          = getSentences();
  const filterLevels = getFilterLevels();
  const selectedIds  = getSelectedIds();

  if (all.length === 0) {
    badge.textContent = '등록된 문제 없음';
    badge.className   = 'home-count-badge none';
    return;
  }

  if (filterLevels.length > 0) {
    const levelSet   = new Set(filterLevels);
    const filtered   = all.filter(s => levelSet.has(s.level));
    const levelNames = [...filterLevels].sort().map(l => `Lv.${l}`).join('+');
    const idSet      = new Set(selectedIds);
    const checked    = filtered.filter(s => idSet.has(s.id));
    const count      = checked.length > 0 ? checked.length : filtered.length;
    const prefix     = checked.length > 0 ? '✅' : '🎯';
    badge.textContent = `${prefix} ${levelNames} · ${count}문제`;
    badge.className   = 'home-count-badge selected';
    return;
  }

  if (selectedIds.length > 0) {
    const idSet = new Set(all.map(s => s.id));
    const valid = selectedIds.filter(id => idSet.has(id)).length;
    badge.textContent = `✅ ${valid}문제 선택됨`;
    badge.className   = 'home-count-badge selected';
  } else {
    badge.textContent = `📚 전체 ${all.length}문제`;
    badge.className   = 'home-count-badge all';
  }
}
