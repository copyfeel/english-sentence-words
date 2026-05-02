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

const SPEAKER_SVG = `
  <svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24"
       fill="none" stroke="currentColor" stroke-width="2.2"
       stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
    <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"/>
    <path d="M15.54 8.46a5 5 0 0 1 0 7.07"/>
  </svg>`;

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
        <div class="wrong-item-ko">
          <span class="wrong-item-ko-text">${i + 1}. ${_esc(q.korean)}</span>
          <button class="wrong-speaker-btn" aria-label="영어 읽기">${SPEAKER_SVG}</button>
        </div>
        <div class="wrong-item-en">${_esc(q.english)}</div>
      `;
      item.querySelector('.wrong-speaker-btn').addEventListener('click', (e) => {
        e.stopPropagation();
        tts.speak(q.english);
      });
      list.appendChild(item);
    });
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
        <div class="wrong-item-ko">
          <span class="wrong-item-ko-text">${_esc(w.korean)}</span>
          <button class="wrong-speaker-btn" aria-label="영어 읽기">${SPEAKER_SVG}</button>
        </div>
        <div class="wrong-item-en">${_esc(w.english)}</div>
      `;
      item.querySelector('.wrong-speaker-btn').addEventListener('click', (e) => {
        e.stopPropagation();
        tts.speak(w.english);
      });
      wrongList.appendChild(item);
    });
  } else {
    wrongWrap.style.display = 'none';
    retryBtn.style.display  = 'none';
  }
}

function _esc(str) {
  return String(str ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}
