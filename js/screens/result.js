/* ══════════════════════════════════════
   result.js - 결과화면
══════════════════════════════════════ */
import { router }     from '../router.js';
import { tts }        from '../components/tts.js';
import { Confetti }   from '../components/confetti.js';
import { getWrongAnswers } from '../store.js';

const $ = id => document.getElementById(id);

const CONGRATS = [
  'Nice work!', 'Good job!', 'Awesome!', 'Super Duper!', 'Wonderful!',
];

let _confetti = null;

export function initResult() {
  $('btn-end-game').addEventListener('click', () => {
    tts.stop();
    if (_confetti) _confetti.stop();
    router.navigate('home');
  });

  $('btn-retry-wrong').addEventListener('click', () => {
    tts.stop();
    if (_confetti) _confetti.stop();
    const wrongs = getWrongAnswers();
    if (!wrongs.length) return;
    // 오답 항목을 Sentence 형식으로 변환
    const sentences = wrongs.map(w => ({
      id:      w.sentenceId,
      korean:  w.korean,
      english: w.english,
      level:   w.level,
      createdAt: w.failedAt,
    }));
    router.navigate('game', { sentences, isWrongOnly: true });
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

  // 오답 목록
  const wrongItems = getWrongAnswers();
  const wrongWrap  = $('wrong-list-wrap');
  const wrongList  = $('wrong-list');
  const retryBtn   = $('btn-retry-wrong');

  wrongList.innerHTML = '';
  if (wrongItems.length > 0) {
    wrongWrap.style.display = 'block';
    retryBtn.style.display  = 'inline-flex';

    wrongItems.forEach(w => {
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
