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
let _slots        = [];   // word | null  (슬롯별 배치 단어)
let _poolOrder    = [];   // 셔플된 전체 단어 순서 (플레이스홀더 위치 보존용)
let _words        = [];   // 현재 문제의 모든 단어
let _session      = { correct: [], wrong: [] };
let _timer        = null;
let _answered     = false;
let _animating    = false;  // 애니메이션 중 중복 입력 차단
let _selectedSlot = null;   // 슬롯↔슬롯 이동용 선택 상태 (null | index)
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
    _markWrong();
    _advance();
  });

  // 풀 영역 클릭: 단어를 가장 좌측 빈 슬롯으로 이동
  $('word-pool').addEventListener('click', _onPoolClick);

  // 슬롯 영역 클릭: 선택/스왑/복귀 처리
  $('slot-area').addEventListener('click', _onSlotClick);

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
      _answered     = false;
      _animating    = false;
      _selectedSlot = null;
    },
  });
}

/* ─── 풀 클릭 핸들러 ─────────────────── */
function _onPoolClick(e) {
  if (_answered || _animating) return;

  const chip = e.target.closest('.word-chip');
  if (!chip) return;

  // 슬롯 선택 해제
  _selectedSlot = null;

  const wordId    = chip.dataset.wordId;
  const emptyIdx  = _slots.findIndex(s => s === null);
  if (emptyIdx === -1) return;

  const word      = _findWord(wordId);
  const targetEl  = $('slot-area').children[emptyIdx];

  _flyChip(chip, targetEl, () => {
    _slots[emptyIdx] = word;
    _renderGame();
    _checkAnswer();
  });
}

/* ─── 슬롯 클릭 핸들러 ───────────────── */
function _onSlotClick(e) {
  if (_answered || _animating) return;

  const chip = e.target.closest('.word-chip');
  const slot = e.target.closest('.word-slot');

  if (chip) {
    const wordId  = chip.dataset.wordId;
    const slotIdx = parseInt(chip.dataset.source.split('-')[1]);

    if (_selectedSlot === null) {
      // 첫 클릭 → 선택
      _selectedSlot = slotIdx;
      _renderSlots();

    } else if (_selectedSlot === slotIdx) {
      // 같은 슬롯 재클릭 → 풀로 복귀
      _selectedSlot = null;
      const word        = _slots[slotIdx];
      const placeholder = $('word-pool').querySelector(`.word-placeholder[data-word-id="${word.id}"]`);
      const target      = placeholder ?? $('word-pool');

      _flyChip(chip, target, () => {
        _slots[slotIdx] = null;
        _renderGame();
      });

    } else {
      // 다른 슬롯 클릭 → 두 단어 교체(swap)
      const fromIdx = _selectedSlot;
      const toIdx   = slotIdx;
      _selectedSlot = null;

      const fromChip = $('slot-area').children[fromIdx].querySelector('.word-chip');
      const toChip   = chip;

      if (fromChip) {
        _swapChips(fromChip, toChip, fromIdx, toIdx);
      } else {
        _renderSlots();
      }
    }

  } else if (slot && _selectedSlot !== null) {
    // 빈 슬롯 클릭 → 선택된 단어를 이 슬롯으로 이동
    const emptyIdx = parseInt(slot.dataset.slotIndex);
    if (_slots[emptyIdx] !== null) return;

    const fromIdx  = _selectedSlot;
    _selectedSlot  = null;

    const fromChip = $('slot-area').children[fromIdx].querySelector('.word-chip');
    if (!fromChip) { _renderSlots(); return; }

    _flyChip(fromChip, slot, () => {
      _slots[emptyIdx] = _slots[fromIdx];
      _slots[fromIdx]  = null;
      _renderGame();
      _checkAnswer();
    });
  }
}

/* ─── 단어 fly 애니메이션 ────────────── */
function _flyChip(fromEl, toEl, callback) {
  _animating = true;

  const fromRect = fromEl.getBoundingClientRect();
  const toRect   = toEl.getBoundingClientRect();

  const clone = _createFlyingClone(fromEl, fromRect);
  fromEl.style.opacity = '0';

  // 두 번의 rAF로 transition이 확실히 적용되게 함
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

/* ─── 두 슬롯 단어 교차 swap 애니메이션 ─ */
function _swapChips(fromChip, toChip, fromIdx, toIdx) {
  _animating = true;

  const fromRect = fromChip.getBoundingClientRect();
  const toRect   = toChip.getBoundingClientRect();

  const clone1 = _createFlyingClone(fromChip, fromRect);
  const clone2 = _createFlyingClone(toChip,   toRect);

  fromChip.style.opacity = '0';
  toChip.style.opacity   = '0';

  requestAnimationFrame(() => {
    requestAnimationFrame(() => {
      clone1.style.transform = `translate(${toRect.left   - fromRect.left}px, ${toRect.top   - fromRect.top}px)`;
      clone2.style.transform = `translate(${fromRect.left - toRect.left}px,   ${fromRect.top - toRect.top}px)`;
    });
  });

  setTimeout(() => {
    clone1.remove();
    clone2.remove();
    [_slots[fromIdx], _slots[toIdx]] = [_slots[toIdx], _slots[fromIdx]];
    _animating = false;
    _renderGame();
    _checkAnswer();
  }, 320);
}

/* ─── flying clone 생성 ──────────────── */
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

/* ─── 문제 로드 ──────────────────────── */
function _loadQuestion(idx) {
  if (idx >= _questions.length) {
    _goResult();
    return;
  }

  _answered     = false;
  _animating    = false;
  _selectedSlot = null;

  $('word-pool').style.display = '';

  const q = _questions[idx];

  $('game-counter').textContent = `${idx + 1} / ${_questions.length}`;
  $('korean-sentence').textContent = q.korean;

  const rawWords = q.english.trim().split(/\s+/);
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
  const CIRC = 276.46;

  const ringFill    = $('timer-ring-fill');
  const timerText   = $('timer-text');
  const timerDisplay = $('timer-display');
  const gameWrap    = document.querySelector('.game-wrap');

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

    const answerWord = _words[idx]?.text ?? '';
    const minW = Math.max(60, answerWord.length * 10 + 24);
    slot.style.minWidth = minW + 'px';

    if (word) {
      const chip = _makeChip(word, `slot-${idx}`);
      chip.classList.add('in-slot');
      if (_selectedSlot === idx) chip.classList.add('selected');
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
      // 슬롯에 올라간 단어 자리 → 연한 빈 플레이스홀더
      const ph = document.createElement('div');
      ph.className      = 'word-placeholder';
      ph.dataset.wordId = word.id;
      const minW = Math.max(60, word.text.length * 10 + 24);
      ph.style.minWidth = minW + 'px';
      pool.appendChild(ph);
    } else {
      const chip = _makeChip(word, 'pool');
      pool.appendChild(chip);
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

/* ─── 정답 체크 ──────────────────────── */
function _checkAnswer() {
  if (_slots.some(s => s === null)) return;

  const answer  = _slots.map(w => w.text).join(' ');
  const correct = _questions[_currentIdx].english;

  if (answer === correct) {
    _answered = true;
    if (_timer) _timer.stop();

    _showCorrectEffect();

    setTimeout(() => {
      $('word-pool').style.display = 'none';
      const utt = tts.speak(correct);

      _showSpeaker(correct);

      let advanced = false;
      const advance = () => {
        if (advanced) return;
        advanced = true;
        setTimeout(() => _advance(), 400);
      };
      utt.onend = advance;
      setTimeout(advance, 3500);
    }, 500);

    _session.correct.push(_questions[_currentIdx].id);
  }
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
  const slotArea   = $('slot-area');
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

function _findWord(wordId) {
  return _words.find(w => w.id === wordId) ?? null;
}
