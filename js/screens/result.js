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
let _wrongSentences = []; // 방금 게임에서 틀린 문제들

export function initResult() {
  $('btn-end-game').addEventListener('click', () => {
    tts.stop();
    if (_confetti) _confetti.stop();
    router.navigate('home');
  });

  $('btn-retry-wrong').addEventListener('click', () => {
    tts.stop();
    if (_confetti) _confetti.stop();
    if (!_wrongSentences.length) return;
    // 방금 게임의 오답 문제만 넘겨서 다시 풀기
    router.navigate('game', { sentences: _wrongSentences, isWrongOnly: true });
  });

  router.register('result', {
    onEnter(state) {
      _render(state);
    },
    onLeave() {
      tts.stop();
      if (_confetti) { _confetti.stop(); _confetti = null; }
    },
  });
}

function _render({ session, questions }) {
  const correct = session.correct.length;
  const wrong   = session.wrong.length;
  const total   = questions.length;

  // 통계
  $('stat-correct').textContent = correct;
  $('stat-wrong').textContent   = wrong;
  $('stat-total').textContent   = total;

  // 축하 문구
  const msg = CONGRATS[Math.floor(Math.random() * CONGRATS.length)];
  $('congrats-text').textContent = msg;

  // TTS로 축하 문구 읽기
  setTimeout(() => tts.speak(msg, 0.85), 600);

  // 색종이 폭죽
  const canvas = $('confetti-canvas');
  _confetti = new Confetti(canvas);
  _confetti.launch(4000);

  // 방금 게임에서 틀린 문제만 추출 (session.wrong의 ID 기준)
  const wrongIdSet = new Set(session.wrong);
  _wrongSentences  = questions.filter(q => wrongIdSet.has(q.id));

  const wrongWrap = $('wrong-list-wrap');
  const wrongList = $('wrong-list');
  const retryBtn  = $('btn-retry-wrong');

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

function _esc(str) {
  return String(str ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}
