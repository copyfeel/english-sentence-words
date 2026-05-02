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
  { leftPct:  9, topPct: 14, size: 80, floatCls: 'bubble-f1', delay: '0s',    irisDelay: '0s'    },
  { leftPct: 61, topPct: 14, size: 56, floatCls: 'bubble-f2', delay: '0.65s', irisDelay: '1.5s'  },
  { leftPct: 17, topPct: 46, size: 72, floatCls: 'bubble-f3', delay: '1.2s',  irisDelay: '2.9s'  },
  { leftPct: 64, topPct: 42, size: 62, floatCls: 'bubble-f4', delay: '0.35s', irisDelay: '0.9s'  },
];

/* 이미지 버블 — 클릭/터치 시 그냥 사라짐 (단어 슬롯 연동 없음) */
const IMAGE_BUBBLE_CONFIGS = [
  { leftPct: 34, topPct:  6, size: 66, floatCls: 'bubble-f4', delay: '2.0s', irisDelay: '1.2s', image: 'images/bubble-girl1.png' },
  { leftPct: 41, topPct: 54, size: 63, floatCls: 'bubble-f1', delay: '1.6s', irisDelay: '3.4s', image: 'images/bubble-girl2.png' },
];

let _poppedCount = 0;
let _popCtx      = null;

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
  const scene     = document.getElementById('bubble-scene');
  const slotsWrap = document.getElementById('subtitle-slots');
  if (!scene) return;

  /* 이전 gather로 접힌 bubble-scene 원상 복구 */
  const _content = document.querySelector('.home-content');
  if (_content) { _content.style.transition = ''; _content.style.gap = ''; }
  scene.style.height = ''; scene.style.opacity = '';
  scene.style.overflow = ''; scene.style.transition = '';

  scene.innerHTML = '';
  _poppedCount    = 0;

  /* gather 애니메이션으로 교체됐을 수 있으므로 슬롯 DOM을 완전히 재생성 */
  if (slotsWrap) {
    slotsWrap.innerHTML = BUBBLE_WORDS
      .map((_, i) => `<span class="subtitle-slot" data-idx="${i}"></span>`)
      .join('');
  }

  /* 매 진입마다 다른 시작 위치 + 다른 플로트 패턴 */
  const _rnd = (min, max) => (min + Math.random() * (max - min)).toFixed(1);

  /* 단어 버블용 4구역 — 셔플로 매번 다른 구역 배정 */
  const WORD_ZONES = [
    { l: [4,  28], t: [4,  36] }, /* 좌상 */
    { l: [54, 76], t: [4,  36] }, /* 우상 */
    { l: [4,  28], t: [40, 68] }, /* 좌하 */
    { l: [54, 76], t: [40, 68] }, /* 우하 */
  ];
  const zoneOrder    = [0,1,2,3].sort(() => Math.random() - 0.5);
  const FLOAT_POOL   = ['bubble-f1','bubble-f2','bubble-f3','bubble-f4'];
  const floatShuffle = [...FLOAT_POOL].sort(() => Math.random() - 0.5);

  BUBBLE_WORDS.forEach((word, idx) => {
    const cfg  = BUBBLE_CONFIGS[idx];
    const zone = WORD_ZONES[zoneOrder[idx]];
    const bubble = document.createElement('div');
    bubble.className = `bubble ${floatShuffle[idx]}`;
    bubble.style.cssText = [
      `left:${_rnd(...zone.l)}%`,
      `top:${_rnd(...zone.t)}%`,
      `width:${cfg.size}px`,
      `height:${cfg.size}px`,
      `animation-delay:${_rnd(0, 2.5)}s`,
    ].join(';');
    bubble.style.setProperty('--iris-delay', `${_rnd(0, 4)}s`);

    bubble.innerHTML = `<span class="bubble-word">${word}</span>`;

    const onPop = (e) => { e.preventDefault(); _popBubble(bubble, idx); };
    bubble.addEventListener('click', onPop);
    bubble.addEventListener('touchend', onPop, { passive: false });
    scene.appendChild(bubble);
  });

  /* 이미지 버블 — 중앙 구역에서 랜덤 배치 */
  const IMG_ZONES = [
    { l: [28, 52], t: [4,  34] }, /* 중상 */
    { l: [28, 52], t: [38, 66] }, /* 중하 */
  ];
  IMAGE_BUBBLE_CONFIGS.forEach((cfg, idx) => {
    const zone  = IMG_ZONES[idx];
    const float = FLOAT_POOL[Math.floor(Math.random() * 4)];
    const bubble = document.createElement('div');
    bubble.className = `bubble ${float}`;
    bubble.style.cssText = [
      `left:${_rnd(...zone.l)}%`,
      `top:${_rnd(...zone.t)}%`,
      `width:${cfg.size}px`,
      `height:${cfg.size}px`,
      `animation-delay:${_rnd(0.5, 3)}s`,
    ].join(';');
    bubble.style.setProperty('--iris-delay', `${_rnd(0.5, 4.5)}s`);
    bubble.innerHTML = `<img src="${cfg.image}" class="bubble-img-fill" alt="" draggable="false">`;

    const onPop = (e) => { e.preventDefault(); _popImageBubble(bubble); };
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
  _playPopSound();

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
      'left 0.9s cubic-bezier(0.25, 0.46, 0.45, 0.94)',
      'top  0.9s cubic-bezier(0.25, 0.46, 0.45, 0.94)',
    ].join(',');
    flyer.style.left = `${tx}px`;
    flyer.style.top  = `${ty}px`;

    setTimeout(() => {
      flyer.remove();
      slot.textContent = BUBBLE_WORDS[idx];
      slot.classList.add('filled');

      _poppedCount++;
      if (_poppedCount === BUBBLE_WORDS.length) _onAllPopped();
    }, 940);
  }, 280);
}

/* ── 이미지 버블: 그냥 사라짐 (단어 슬롯 무관) ── */
function _popImageBubble(bubble) {
  if (bubble.dataset.popped) return;
  bubble.dataset.popped = 'true';
  _playPopSound();
  bubble.classList.add('popping');
  setTimeout(() => { bubble.style.visibility = 'hidden'; }, 280);
}

function _onAllPopped() {
  /* 로고·타이틀·버블씬을 접어서 콘텐츠가 화면 중앙으로 모이게 */
  _gatherToCenter();

  const slotsWrap = document.getElementById('subtitle-slots');
  if (!slotsWrap) return;

  const sentence = BUBBLE_WORDS.join(' ');
  slotsWrap.innerHTML = `<span id="sentence-gathered" class="sentence-gathered">${sentence}</span>`;

  /* gather 완료 후 두 번 통통 튀기 */
  setTimeout(() => {
    const el = document.getElementById('sentence-gathered');
    if (el) el.classList.add('sentence-bounce');
  }, 950);
}

function _gatherToCenter() {
  const toCollapse = [
    document.getElementById('bubble-scene'),
  ].filter(Boolean);

  /* 현재 높이를 고정한 뒤 reflow를 강제해야 height 트랜지션이 그 자리에서 작동 */
  toCollapse.forEach(el => {
    el.style.height   = el.getBoundingClientRect().height + 'px';
    el.style.overflow = 'hidden';
    void el.offsetHeight; // 브라우저에 레이아웃 확정 강제 — 이후 transition 적용
    el.style.transition = 'height 0.8s cubic-bezier(0.4,0,0.2,1), opacity 0.6s ease';
    el.style.height     = '0';
    el.style.opacity    = '0';
  });

  const content = document.querySelector('.home-content');
  if (content) {
    void content.offsetWidth;
    content.style.transition = 'gap 0.8s ease';
    content.style.gap        = '0';
  }
}

/* ── 비눗방울 팝 사운드 (Web Audio API) ───── */
function _playPopSound() {
  try {
    const Ctx = window.AudioContext || window.webkitAudioContext;
    if (!Ctx) return;
    if (!_popCtx || _popCtx.state === 'closed') _popCtx = new Ctx();
    if (_popCtx.state === 'suspended') _popCtx.resume();

    const ctx  = _popCtx;
    const osc  = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);

    /* 550Hz → 70Hz 빠른 하강 — 비눗방울 팝 특유의 음감 */
    osc.type = 'sine';
    osc.frequency.setValueAtTime(550, ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(70, ctx.currentTime + 0.09);

    gain.gain.setValueAtTime(0.11, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.11);

    osc.start(ctx.currentTime);
    osc.stop(ctx.currentTime + 0.13);
  } catch (_) {}
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
