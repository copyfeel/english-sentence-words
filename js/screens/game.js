/* ══════════════════════════════════════
   game.js - 문제풀이 화면
══════════════════════════════════════ */
import { router }        from '../router.js';
import { tts }           from '../components/tts.js';
import { ticker }        from '../components/ticker.js';
import { Timer }         from '../components/timer.js';
import { getSettings, saveWrongAnswer } from '../store.js';
import { shuffle } from '../utils/helpers.js';

/* ─── 게임 상태 ──────────────────────── */
let _questions    = [];
let _currentIdx   = 0;
let _slots        = [];   // 슬롯별 배치 단어 (null = 비어있음)
let _poolOrder    = [];   // 셔플된 전체 단어 순서
let _words        = [];   // 올바른 순서 단어 (정답 기준)
let _session      = { correct: [], wrong: [] };
let _timer        = null;
let _answered     = false;
let _animating    = false;
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
    if (_answered) {
      // 정답 완료 후 Next → 다음 문제로 이동
      _advance();
      return;
    }
    _markWrong();
    _advance();
  });

  // 풀 영역: 클릭하면 가장 좌측 빈 슬롯으로 fly
  $('word-pool').addEventListener('click', _onPoolClick);

  // 슬롯 영역: 포인터 이벤트로 클릭/드래그 구분
  $('slot-area').addEventListener('pointerdown', _onSlotPointerDown, { passive: false });

  router.register('game', {
    onEnter(state) {
      _settings   = getSettings();
      _questions  = shuffle(state.sentences ?? []);
      _session    = { correct: [], wrong: [] };
      _currentIdx = 0;
      _loadQuestion(0);
    },
    onLeave() {
      if (_timer) { _timer.stop(); _timer = null; }
      tts.stop();
      _answered  = false;
      _animating = false;
    },
  });
}

/* ─── 풀 클릭: 가장 좌측 빈 슬롯으로 fly ─ */
function _onPoolClick(e) {
  if (_answered || _animating) return;
  const chip = e.target.closest('.word-chip');
  if (!chip) return;

  const wordId   = chip.dataset.wordId;
  const emptyIdx = _slots.findIndex(s => s === null);
  if (emptyIdx === -1) return;

  const word     = _findWord(wordId);
  const targetEl = $('slot-area').children[emptyIdx];

  _flyChip(chip, targetEl, () => {
    _slots[emptyIdx] = word;
    _renderGame();
    _checkAnswer();
  });
}

/* ─── 슬롯 포인터: 클릭=풀복귀, 드래그=슬롯간 swap ─ */
function _onSlotPointerDown(e) {
  if (_answered || _animating) return;
  const chip = e.target.closest('.word-chip');
  if (!chip) return;

  const slotIdx = parseInt(chip.dataset.source.split('-')[1]);
  if (isNaN(slotIdx) || !_slots[slotIdx]) return;

  e.preventDefault();

  const startRect = chip.getBoundingClientRect();
  const startX    = e.clientX;
  const startY    = e.clientY;
  let isDragging  = false;
  let dragClone   = null;

  const onMove = (me) => {
    const dx = me.clientX - startX;
    const dy = me.clientY - startY;
    if (!isDragging && (Math.abs(dx) > 8 || Math.abs(dy) > 8)) {
      isDragging = true;
      dragClone  = _createDragClone(chip, startRect);
      chip.style.opacity = '0.25';
    }
    if (isDragging && dragClone) {
      dragClone.style.left = (startRect.left + (me.clientX - startX)) + 'px';
      dragClone.style.top  = (startRect.top  + (me.clientY - startY)) + 'px';
    }
  };

  const onUp = (ue) => {
    document.removeEventListener('pointermove', onMove);
    document.removeEventListener('pointerup',   onUp);

    if (!isDragging) {
      // 클릭: 선택 상태 없이 바로 풀로 복귀
      _returnToPool(chip, slotIdx);
    } else {
      dragClone?.remove();
      chip.style.opacity = '';
      const targetIdx = _getSlotAtPoint(ue.clientX, ue.clientY);
      if (targetIdx !== null && targetIdx !== slotIdx) {
        // 두 슬롯 swap
        [_slots[slotIdx], _slots[targetIdx]] = [_slots[targetIdx], _slots[slotIdx]];
        _renderGame();
        _checkAnswer();
      } else {
        _renderGame();
      }
    }
  };

  document.addEventListener('pointermove', onMove);
  document.addEventListener('pointerup',   onUp);
}

/* ─── 포인터 위치에 해당하는 슬롯 인덱스 ── */
function _getSlotAtPoint(x, y) {
  const slots = $('slot-area').children;
  for (let i = 0; i < slots.length; i++) {
    const r = slots[i].getBoundingClientRect();
    if (x >= r.left - 10 && x <= r.right + 10 &&
        y >= r.top  - 30 && y <= r.bottom + 30) {
      return i;
    }
  }
  return null;
}

/* ─── 슬롯 → 풀 복귀 + 좌측 밀착 ──────── */
function _returnToPool(chip, slotIdx) {
  _animating = true;
  const word = _slots[slotIdx];
  const pool = $('word-pool');
  const ph   = pool.querySelector(`.word-placeholder[data-word-id="${word.id}"]`);

  _flyChip(chip, ph ?? pool, () => {
    _slots[slotIdx] = null;
    _compactSlots();
    _renderGame();
  });
}

/* ─── 빈 슬롯 제거 후 좌측으로 밀착 ────── */
function _compactSlots() {
  const words = _slots.filter(w => w !== null);
  for (let i = 0; i < _slots.length; i++) {
    _slots[i] = i < words.length ? words[i] : null;
  }
}

/* ─── drag용 clone (transition 없음) ────── */
function _createDragClone(el, rect) {
  const clone = el.cloneNode(true);
  clone.style.cssText = [
    'position:fixed',
    `left:${rect.left}px`,
    `top:${rect.top}px`,
    `width:${rect.width}px`,
    `height:${rect.height}px`,
    'margin:0',
    'z-index:9999',
    'pointer-events:none',
    'opacity:0.88',
    'box-shadow:0 8px 24px rgba(79,70,229,0.4)',
    'user-select:none',
    '-webkit-user-select:none',
  ].join(';');
  document.body.appendChild(clone);
  return clone;
}

/* ─── fly 애니메이션 ────────────────────── */
function _flyChip(fromEl, toEl, callback) {
  _animating = true;
  const fromRect = fromEl.getBoundingClientRect();
  const toRect   = toEl.getBoundingClientRect();
  const clone    = _createFlyingClone(fromEl, fromRect);
  fromEl.style.opacity = '0';

  requestAnimationFrame(() => {
    requestAnimationFrame(() => {
      const dx = toRect.left + (toRect.width  - fromRect.width)  / 2 - fromRect.left;
      const dy = toRect.top  + (toRect.height - fromRect.height) / 2 - fromRect.top;
      clone.style.transform = `translate(${dx}px, ${dy}px) scale(1)`;
    });
  });

  setTimeout(() => {
    clone.remove();
    _animating = false;
    callback();
  }, 320);
}

/* ─── fly clone (transition 있음) ──────── */
function _createFlyingClone(el, rect) {
  const clone = el.cloneNode(true);
  clone.style.cssText = [
    'position:fixed',
    `left:${rect.left}px`,
    `top:${rect.top}px`,
    `width:${rect.width}px`,
    `height:${rect.height}px`,
    'margin:0',
    'z-index:9999',
    'pointer-events:none',
    'transition:transform 0.3s cubic-bezier(0.4,0,0.2,1)',
    'transform:translate(0,0) scale(1)',
  ].join(';');
  document.body.appendChild(clone);
  return clone;
}

/* ─── 문제 로드 ─────────────────────────── */
function _loadQuestion(idx) {
  if (idx >= _questions.length) {
    _goResult();
    return;
  }

  _answered  = false;
  _animating = false;

  $('word-pool').style.display = '';

  const q          = _questions[idx];
  const isReversed = q.mode === 'en-to-ko';

  $('game-counter').textContent    = `${idx + 1} / ${_questions.length}`;
  $('korean-sentence').textContent = isReversed ? q.english : q.korean;

  const rawWords = (isReversed ? q.korean : q.english).trim().split(/\s+/);
  _words     = rawWords.map((text, i) => ({ id: `w_${i}`, text }));
  _slots     = Array(_words.length).fill(null);
  _poolOrder = shuffle([..._words]);

  if (_timer) _timer.stop();
  _setupTimer(_settings.timerDuration);
  _renderGame();
  if (_timer) _timer.start();
}

/* ─── 타이머 설정 ─────────────────────── */
function _setupTimer(duration) {
  const CIRC         = 276.46;
  const ringFill     = $('timer-ring-fill');
  const timerText    = $('timer-text');
  const timerDisplay = $('timer-display');
  const gameWrap     = document.querySelector('.game-wrap');

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
      ringFill.style.strokeDashoffset = CIRC * (1 - remaining / duration);
    },
    onWarn() {
      ringFill.classList.add('warning');
      timerText.classList.add('warning');
      gameWrap.classList.add('timer-warning');
      ticker.tick();
    },
    onExpire() {
      _answered = true;
      gameWrap.classList.remove('timer-warning');
      _markWrong();
      _showExpireEffect();
      setTimeout(() => _advance(), 1200);
    },
  });
}

function _showExpireEffect() {
  $('slot-area').classList.add('shake');
  setTimeout(() => $('slot-area').classList.remove('shake'), 500);
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
    slot.className     = 'word-slot' + (word ? ' filled' : '');
    slot.dataset.slotIndex = idx;
    slot.role          = 'listitem';

    const answerWord = _words[idx]?.text ?? '';
    slot.style.minWidth = Math.max(60, answerWord.length * 10 + 24) + 'px';

    if (word) {
      const chip = _makeChip(word, `slot-${idx}`);
      chip.classList.add('in-slot');
      slot.appendChild(chip);
    }
    area.appendChild(slot);
  });
}

function _renderPool() {
  const pool = $('word-pool');
  pool.innerHTML = '';

  _poolOrder.forEach(word => {
    if (_isInSlot(word.id)) {
      const ph = document.createElement('div');
      ph.className      = 'word-placeholder';
      ph.dataset.wordId = word.id;
      ph.style.minWidth = Math.max(60, word.text.length * 10 + 24) + 'px';
      pool.appendChild(ph);
    } else {
      pool.appendChild(_makeChip(word, 'pool'));
    }
  });
}

function _isInSlot(wordId) {
  return _slots.some(s => s?.id === wordId);
}

function _makeChip(word, source) {
  const chip = document.createElement('div');
  chip.className      = 'word-chip';
  chip.textContent    = word.text;
  chip.dataset.wordId = word.id;
  chip.dataset.source = source;
  chip.setAttribute('role', 'button');
  chip.setAttribute('tabindex', '0');
  return chip;
}

/* ─── 정답 체크 ─────────────────────────── */
function _checkAnswer() {
  if (_slots.some(s => s === null)) return;

  const q       = _questions[_currentIdx];
  const answer  = _slots.map(w => w.text).join(' ');
  const correct = q.mode === 'en-to-ko' ? q.korean : q.english;

  if (answer !== correct) return;

  _answered = true;
  if (_timer) _timer.stop();
  _showCorrectEffect();

  setTimeout(() => {
    $('word-pool').style.display = 'none';
    tts.speak(q.english);        // 첫 번역 자동 발화
    _showSpeaker(q.english);     // 반복 듣기 버튼 표시
  }, 500);

  _session.correct.push(q.id);
}

function _showCorrectEffect() {
  $('slot-area').querySelectorAll('.word-chip').forEach(chip => {
    chip.style.background = 'var(--clr-secondary)';
    chip.classList.add('correct-anim');
  });
  $('slot-area').querySelectorAll('.word-slot').forEach(slot => {
    slot.classList.add('correct-slot');
  });
}

function _showSpeaker(text) {
  const speakerBtn = document.createElement('button');
  speakerBtn.className = 'speaker-btn';
  speakerBtn.setAttribute('aria-label', '다시 듣기');
  speakerBtn.innerHTML = `
    <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24"
         fill="none" stroke="currentColor" stroke-width="2.5"
         stroke-linecap="round" stroke-linejoin="round">
      <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"/>
      <path d="M15.54 8.46a5 5 0 0 1 0 7.07"/>
      <path d="M19.07 4.93a10 10 0 0 1 0 14.14"/>
    </svg>`;
  speakerBtn.addEventListener('click', () => {
    speakerBtn.classList.add('playing');
    const u = tts.speak(text);
    u.onend = () => speakerBtn.classList.remove('playing');
    setTimeout(() => speakerBtn.classList.remove('playing'), 3000);
  });
  $('slot-area').appendChild(speakerBtn);
}

/* ─── 오답 처리 ─────────────────────────── */
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

/* ─── 다음 문제 / 결과 ─────────────────── */
function _advance() {
  if (_timer) { _timer.stop(); _timer = null; }
  tts.stop();
  _currentIdx++;
  _loadQuestion(_currentIdx);
}

function _goResult() {
  router.navigate('result', { session: _session, questions: _questions });
}

function _findWord(wordId) {
  return _words.find(w => w.id === wordId) ?? null;
}
