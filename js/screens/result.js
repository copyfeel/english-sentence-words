/* ══════════════════════════════════════
   result.js - 결과화면
══════════════════════════════════════ */
import { router }   from '../router.js';
import { tts }      from '../components/tts.js';
import { Confetti } from '../components/confetti.js';

const $ = id => document.getElementById(id);

const CONGRATS = [
  'Nice work!', 'Good job!', 'Awesome!', 'Super Duper!', 'Wonderful!',
];

let _confetti       = null;
let _wrongSentences = [];
let _allQuestions   = [];
let _waveTimer      = null;

let _bgCtx          = null;
let _bgGain         = null;
let _bgLoopTimer    = null;

/* 반짝반짝 작은 별 — 1761년 작곡, 완전 공개 도메인 */
const C4    = 261.63;
/* C장조 음계: C D E F G A B C5 */
const SCALE = [0,2,4,5,7,9,11,12].map(s => C4 * Math.pow(2, s / 12));
const MELODY = [
  0,0,4,4,5,5,4,  /* 반짝-반짝-작-은-별-아-아  */
  3,3,2,2,1,1,0,  /* 아-름-답-게-빛-나-네      */
  4,4,3,3,2,2,1,  /* 동-쪽-하-늘-은-하-수      */
  4,4,3,3,2,2,1,  /* 서-쪽-하-늘-은-하-수      */
  0,0,4,4,5,5,4,  /* 반짝-반짝-작-은-별-아-아  */
  3,3,2,2,1,1,0,  /* 아-름-답-게-빛-나-네      */
];

export function initResult() {
  $('btn-end-game').addEventListener('click', () => {
    _cleanup();
    router.navigate('home');
  });

  $('btn-retry-wrong').addEventListener('click', () => {
    _cleanup();
    if (!_wrongSentences.length) return;
    router.navigate('game', { sentences: _wrongSentences, isWrongOnly: true });
  });

  $('btn-show-all').addEventListener('click', () => {
    const wrap  = $('wrong-list-wrap');
    const title = $('wrong-list-title');
    const list  = $('wrong-list');

    title.textContent  = '출제 문제';
    wrap.style.display = 'block';
    list.innerHTML     = '';

    _allQuestions.forEach((q, i) => {
      const item = document.createElement('div');
      item.className = 'wrong-item';
      item.innerHTML = `
        <div class="wrong-item-ko">${i + 1}. ${_esc(q.korean)}</div>
        <div class="wrong-item-en">${_esc(q.english)}</div>
      `;
      list.appendChild(item);
    });

    _playBgMusic();
  });

  router.register('result', {
    onEnter(state) {
      _render(state);
    },
    onLeave() {
      _cleanup();
    },
  });
}

function _cleanup() {
  tts.stop();
  if (_confetti) { _confetti.stop(); _confetti = null; }
  clearTimeout(_waveTimer);
  _waveTimer = null;
  _stopBgMusic();
}

function _render({ session, questions }) {
  _allQuestions = questions;

  const correct = session.correct.length;
  const wrong   = session.wrong.length;
  const total   = questions.length;

  $('stat-correct').textContent = correct;
  $('stat-wrong').textContent   = wrong;
  $('stat-total').textContent   = total;

  /* 칭찬 문구 — 글자 단위 span으로 감싸기 */
  const msg     = CONGRATS[Math.floor(Math.random() * CONGRATS.length)];
  const letters = [...msg].map((char, i) => {
    if (char === ' ') return '<span class="congrats-space"> </span>';
    return `<span class="congrats-letter" style="animation-delay:${i * 0.07}s">${char}</span>`;
  }).join('');
  const congratsEl = $('congrats-text');
  congratsEl.innerHTML = letters;
  congratsEl.classList.remove('wave-active');

  setTimeout(() => tts.speak(msg, 0.85), 600);

  /* 폭죽 */
  const canvas = $('confetti-canvas');
  _confetti = new Confetti(canvas);
  _confetti.launch(4000);

  /* 폭죽 완료 후 글자 파동 애니메이션 시작 */
  _waveTimer = setTimeout(() => {
    congratsEl.classList.add('wave-active');
  }, 4300);

  /* 오답 목록 */
  const wrongIdSet = new Set(session.wrong);
  _wrongSentences  = questions.filter(q => wrongIdSet.has(q.id));

  const wrongWrap = $('wrong-list-wrap');
  const wrongList = $('wrong-list');
  const retryBtn  = $('btn-retry-wrong');
  const titleEl   = $('wrong-list-title');

  titleEl.textContent = '오답 목록';
  wrongList.innerHTML = '';

  if (_wrongSentences.length > 0) {
    wrongWrap.style.display = 'block';
    retryBtn.style.display  = 'inline-flex';

    _wrongSentences.forEach(w => {
      const item = document.createElement('div');
      item.className = 'wrong-item';
      item.innerHTML = `
        <div class="wrong-item-ko">${_esc(w.korean)}</div>
        <div class="wrong-item-en">${_esc(w.english)}</div>
      `;
      wrongList.appendChild(item);
    });
  } else {
    wrongWrap.style.display = 'none';
    retryBtn.style.display  = 'none';
  }
}

/* ── 배경 음악 (Web Audio API — 저작권 없음) ── */
function _playBgMusic() {
  if (_bgCtx) return;
  try {
    const AudioCtx = window.AudioContext || window.webkitAudioContext;
    if (!AudioCtx) return;

    _bgCtx  = new AudioCtx();
    _bgGain = _bgCtx.createGain();
    _bgGain.gain.setValueAtTime(0, _bgCtx.currentTime);
    _bgGain.gain.linearRampToValueAtTime(0.22, _bgCtx.currentTime + 0.8);
    _bgGain.connect(_bgCtx.destination);

    const beatSec = 0.55;

    function scheduleLoop() {
      if (!_bgCtx || _bgCtx.state === 'closed') return;
      const t0 = _bgCtx.currentTime + 0.05;

      MELODY.forEach((noteIdx, i) => {
        const freq = SCALE[noteIdx];
        const t    = t0 + i * beatSec;
        const osc  = _bgCtx.createOscillator();
        const gain = _bgCtx.createGain();
        osc.connect(gain);
        gain.connect(_bgGain);
        /* triangle 파형 = 뮤직박스처럼 따뜻하고 부드러운 음색 */
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(freq, t);
        /* 짧은 어택 + 긴 감쇠 → 오르골(뮤직박스) 음색 */
        gain.gain.setValueAtTime(0, t);
        gain.gain.linearRampToValueAtTime(0.30, t + 0.012);
        gain.gain.exponentialRampToValueAtTime(0.001, t + beatSec * 0.80);
        osc.start(t);
        osc.stop(t + beatSec * 0.85);
      });

      _bgLoopTimer = setTimeout(scheduleLoop, MELODY.length * beatSec * 1000 - 80);
    }

    scheduleLoop();
  } catch (_) { /* Web Audio 미지원 환경 무시 */ }
}

function _stopBgMusic() {
  clearTimeout(_bgLoopTimer);
  _bgLoopTimer = null;
  if (_bgCtx) {
    try {
      if (_bgGain) {
        _bgGain.gain.setValueAtTime(_bgGain.gain.value, _bgCtx.currentTime);
        _bgGain.gain.linearRampToValueAtTime(0, _bgCtx.currentTime + 0.3);
      }
      setTimeout(() => {
        if (_bgCtx) { _bgCtx.close(); _bgCtx = null; _bgGain = null; }
      }, 350);
    } catch (_) { _bgCtx = null; _bgGain = null; }
  }
}

function _esc(str) {
  return String(str ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}
