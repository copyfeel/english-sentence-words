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

/* 반달 — 윤극영 작사·작곡, 1924년, 완전 공개 도메인 */
const C5    = 523.25;
/* F장조 음계 (어린이 음역대 C5 기준): F5 G5 A5 Bb5 C6 D6 E6 F6 */
const SCALE = [0,2,4,5,7,9,11,12].map(s => C5 * Math.pow(2, (s + 5) / 12));
const MELODY = [
  4,4,5,5,4,4,2,      /* 솔솔라라솔솔미  (푸른하늘은하수)    */
  3,3,2,1,0,          /* 파파미레도      (하얀쪽배엔)        */
  1,1,2,2,1,0,0,      /* 레레미미레도도  (계수나무한나무)     */
  0,1,2,1,0,          /* 도레미레도      (토끼한마리)        */
  1,1,2,2,1,0,1,2,    /* 레레미미레도레미 (돛대도아니달고)    */
  4,5,4,4,2,          /* 솔라솔솔미      (삿대도없이)        */
  1,1,2,2,1,0,0,      /* 레레미미레도도  (가기도잘도간다)    */
  1,0,                /* 레도            (서쪽나라로)        */
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

    const beatSec = 0.52;
    /* 세 성부를 미세하게 디튠 — 합창의 '두께감' 구현 */
    const CHOIR = [1.000, 1.007, 0.993];

    function scheduleNote(freq, t) {
      CHOIR.forEach(r => {
        const osc  = _bgCtx.createOscillator();
        const vib  = _bgCtx.createOscillator(); /* 비브라토 LFO */
        const vibG = _bgCtx.createGain();
        const filt = _bgCtx.createBiquadFilter();
        const env  = _bgCtx.createGain();

        /* 사인파보다 배음이 풍부한 sawtooth = 성대 진동에 가까운 음색 */
        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(freq * r, t);

        /* 비브라토: 100ms 후 서서히 심화 — 실제 어린이 노래처럼 */
        vib.frequency.setValueAtTime(5.5, t);
        vibG.gain.setValueAtTime(0, t);
        vibG.gain.linearRampToValueAtTime(freq * r * 0.006, t + 0.10);
        vib.connect(vibG);
        vibG.connect(osc.frequency);

        /* '아~' 모음 포먼트: bandpass ~900 Hz */
        filt.type = 'bandpass';
        filt.frequency.setValueAtTime(900, t);
        filt.Q.setValueAtTime(2.5, t);

        /* 부드러운 어택 → 유지 → 자연 감쇠 (숨결 느낌) */
        env.gain.setValueAtTime(0, t);
        env.gain.linearRampToValueAtTime(0.20, t + 0.06);
        env.gain.setValueAtTime(0.20, t + beatSec * 0.60);
        env.gain.linearRampToValueAtTime(0, t + beatSec * 0.92);

        osc.connect(filt);
        filt.connect(env);
        env.connect(_bgGain);

        const end = t + beatSec * 0.95;
        vib.start(t); vib.stop(end);
        osc.start(t); osc.stop(end);
      });
    }

    function scheduleLoop() {
      if (!_bgCtx || _bgCtx.state === 'closed') return;
      const t0 = _bgCtx.currentTime + 0.05;
      MELODY.forEach((idx, i) => scheduleNote(SCALE[idx], t0 + i * beatSec));
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
