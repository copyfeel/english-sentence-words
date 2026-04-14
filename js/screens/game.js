/* ══════════════════════════════════════
   game.js - 문제풀이 화면
══════════════════════════════════════ */
import { router }        from '../router.js';
import { tts }           from '../components/tts.js';
import { ticker }        from '../components/ticker.js';
import { Timer }         from '../components/timer.js';
import { DragDropEngine} from '../components/dragDrop.js';
import { getSettings, saveWrongAnswer } from '../store.js';
import { shuffle, showToast } from '../utils/helpers.js';

/* ─── 게임 상태 ──────────────────────── */
let _questions    = [];   // Sentence[]
let _currentIdx   = 0;
let _slots        = [];   // { id, text } | null
let _pool         = [];   // { id, text }[]
let _words        = [];   // 현재 문제의 모든 단어 (풀+슬롯)
let _session      = { correct: [], wrong: [] };
let _timer        = null;
let _dnd          = null;
let _answered     = false; // 정답 처리 중 중복 방지
let _settings     = {};

/* ─── DOM 참조 ───────────────────────── */
const $ = id => document.getElementById(id);

/* ─── 초기화 ─────────────────────────── */
export function initGame() {
  $('btn-home').addEventListener('click', () => {
    if (_timer) _timer.stop();
    tts.stop();
    router.navigate('home');
  });

  $('btn-next').addEventListener('click', () => {
    if (_answered) return;
    // 현재 문제 오답 처리
    _markWrong();
    _advance();
  });

  // DnD 엔진 생성 후 게임 화면에 한 번만 부착
  _dnd = new DragDropEngine({ onDrop: _handleDrop });
  _dnd.attach(document.getElementById('screen-game'));

  router.register('game', {
    onEnter(state) {
      _settings = getSettings();
      _questions = shuffle(state.sentences ?? []);
      _session   = { correct: [], wrong: [] };
      _currentIdx = 0;
      _loadQuestion(0);
    },
    onLeave() {
      if (_timer) { _timer.stop(); _timer = null; }
      tts.stop();
      _answered = false;
    },
  });
}

/* ─── 문제 로드 ──────────────────────── */
function _loadQuestion(idx) {
  if (idx >= _questions.length) {
    _goResult();
    return;
  }

  _answered = false;

  // 단어 풀 박스 복원 (이전 문제에서 숨겨진 경우 대비)
  $('word-pool').style.display = '';

  const q = _questions[idx];

  // 카운터
  $('game-counter').textContent = `${idx + 1} / ${_questions.length}`;

  // 한글 문장
  $('korean-sentence').textContent = q.korean;

  // 단어 분리 + 고유 ID 부여
  const rawWords = q.english.trim().split(/\s+/);
  _words  = rawWords.map((text, i) => ({ id: `w_${i}`, text }));
  _slots  = Array(_words.length).fill(null);
  _pool   = shuffle([..._words]);

  // 타이머 리셋
  if (_timer) _timer.stop();
  _setupTimer(_settings.timerDuration);

  _renderGame();

  // 타이머 시작
  if (_timer) _timer.start();
}

/* ─── 타이머 설정 ─────────────────────── */
function _setupTimer(duration) {
  const CIRC = 276.46; // 2π×44

  const ringFill = $('timer-ring-fill');
  const timerText = $('timer-text');
  const timerDisplay = $('timer-display');
  const gameWrap = document.querySelector('.game-wrap');

  if (duration === 0) {
    timerDisplay.style.display = 'none';
    _timer = null;
    return;
  }

  timerDisplay.style.display = '';
  timerText.textContent = duration;
  ringFill.style.strokeDashoffset = '0';
  ringFill.classList.remove('warning');
  timerText.classList.remove('warning');
  gameWrap.classList.remove('timer-warning');

  _timer = new Timer({
    duration,
    onTick(remaining) {
      timerText.textContent = remaining;
      const offset = CIRC * (1 - remaining / duration);
      ringFill.style.strokeDashoffset = offset;
    },
    onWarn(remaining) {
      ringFill.classList.add('warning');
      timerText.classList.add('warning');
      gameWrap.classList.add('timer-warning');
      ticker.tick();
    },
    onExpire() {
      // 시간 초과 - _answered=true로 Next 버튼 중복 방지
      _answered = true;
      gameWrap.classList.remove('timer-warning');
      _markWrong();
      _showExpireEffect();
      setTimeout(() => _advance(), 1200);
    },
  });
}

function _showExpireEffect() {
  const slotArea = $('slot-area');
  slotArea.classList.add('shake');
  setTimeout(() => slotArea.classList.remove('shake'), 500);
}

/* ─── 렌더링 ─────────────────────────── */
function _renderGame() {
  _renderSlots();
  _renderPool();
}

function _renderSlots() {
  const area = $('slot-area');
  area.innerHTML = '';

  _slots.forEach((word, idx) => {
    const slot = document.createElement('div');
    slot.className = 'word-slot' + (word ? ' filled' : '');
    slot.dataset.slotIndex = idx;
    slot.role = 'listitem';

    // 빈 슬롯 너비: 해당 위치 정답 단어 길이 기준
    const answerWord = _words[idx]?.text ?? '';
    const minW = Math.max(60, answerWord.length * 10 + 24);
    slot.style.minWidth = minW + 'px';

    if (word) {
      const chip = _makeChip(word, `slot-${idx}`);
      chip.classList.add('in-slot', 'slot-drop');
      slot.appendChild(chip);
    }
    area.appendChild(slot);
  });
}

function _renderPool() {
  const pool = $('word-pool');
  pool.innerHTML = '';

  _pool.forEach(word => {
    const chip = _makeChip(word, 'pool');
    pool.appendChild(chip);
  });
}

function _makeChip(word, source) {
  const chip = document.createElement('div');
  chip.className   = 'word-chip';
  chip.textContent = word.text;
  chip.dataset.wordId = word.id;
  chip.dataset.source = source;
  chip.setAttribute('role', 'button');
  chip.setAttribute('tabindex', '0');
  return chip;
}

/* ─── 드래그 드롭 처리 ───────────────── */
function _handleDrop({ from, to, wordId }) {
  if (_answered) return;

  const word = _findWord(wordId);
  if (!word) return;

  if (from === 'pool' && to.startsWith('slot-')) {
    const toIdx  = parseInt(to.split('-')[1]);
    const displaced = _slots[toIdx];
    _slots[toIdx] = word;
    _pool = _pool.filter(w => w.id !== wordId);
    if (displaced) _pool.push(displaced);
  }
  else if (from.startsWith('slot-') && to === 'pool') {
    const fromIdx = parseInt(from.split('-')[1]);
    _slots[fromIdx] = null;
    _pool.push(word);
  }
  else if (from.startsWith('slot-') && to.startsWith('slot-')) {
    const fromIdx = parseInt(from.split('-')[1]);
    const toIdx   = parseInt(to.split('-')[1]);
    // 교환
    [_slots[fromIdx], _slots[toIdx]] = [_slots[toIdx], _slots[fromIdx]];
  }

  _renderGame();
  _checkAnswer();
}

function _findWord(wordId) {
  return _words.find(w => w.id === wordId) ?? null;
}

/* ─── 정답 체크 ──────────────────────── */
function _checkAnswer() {
  if (_slots.some(s => s === null)) return; // 빈 슬롯 있으면 스킵

  const answer  = _slots.map(w => w.text).join(' ');
  const correct = _questions[_currentIdx].english;

  if (answer === correct) {
    _answered = true;
    if (_timer) _timer.stop();

    // 정답 시각 효과
    _showCorrectEffect();

    setTimeout(() => {
      // TTS 발화 시작과 동시에 단어 풀 박스 숨기기
      $('word-pool').style.display = 'none';
      const utt = tts.speak(correct);

      // 스피커 이모티콘 표시
      _showSpeaker(correct);

      // TTS 완료 또는 타임아웃 후 다음 문제
      let advanced = false;
      const advance = () => {
        if (advanced) return;
        advanced = true;
        setTimeout(() => _advance(), 400);
      };
      utt.onend = advance;
      setTimeout(advance, 3500); // fallback
    }, 500);

    // 세션에 정답 기록
    _session.correct.push(_questions[_currentIdx].id);
  }
}

function _showCorrectEffect() {
  const chips = $('slot-area').querySelectorAll('.word-chip');
  chips.forEach(chip => {
    chip.style.background = 'var(--clr-secondary)';
    chip.classList.add('correct-anim');
  });
  $('slot-area').querySelectorAll('.word-slot').forEach(slot => {
    slot.classList.add('correct-slot');
  });
}

function _showSpeaker(text) {
  const slotArea = $('slot-area');
  const speakerBtn = document.createElement('button');
  speakerBtn.className   = 'speaker-btn';
  speakerBtn.textContent = '🔊';
  speakerBtn.setAttribute('aria-label', '다시 듣기');
  speakerBtn.addEventListener('click', () => {
    speakerBtn.classList.add('playing');
    const u = tts.speak(text);
    u.onend = () => speakerBtn.classList.remove('playing');
    setTimeout(() => speakerBtn.classList.remove('playing'), 3000);
  });
  slotArea.appendChild(speakerBtn);
}

/* ─── 오답 처리 ──────────────────────── */
function _markWrong() {
  const q = _questions[_currentIdx];
  _session.wrong.push(q.id);
  saveWrongAnswer({
    sentenceId: q.id,
    korean:     q.korean,
    english:    q.english,
    level:      q.level,
    failedAt:   Date.now(),
  });
}

/* ─── 다음 문제 / 결과 ───────────────── */
function _advance() {
  if (_timer) { _timer.stop(); _timer = null; }
  tts.stop();
  _currentIdx++;
  _loadQuestion(_currentIdx);
}

function _goResult() {
  router.navigate('result', { session: _session, questions: _questions });
}
