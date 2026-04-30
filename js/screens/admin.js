/* ══════════════════════════════════════
   admin.js - 관리자 화면
══════════════════════════════════════ */
import { router }           from '../router.js';
import { tts, TTS }         from '../components/tts.js';
import {
  getSentences, addSentence, updateSentence, deleteSentence,
  setSentences, getSettings, saveSettings,
  getSelectedIds, saveSelectedIds, removeFromSelected,
  getFilterLevels, saveFilterLevels,
} from '../store.js';
import { exportJSON, exportCSV, importFile } from '../utils/exportImport.js';
import { uid, sanitize, showToast, levelClass, levelLabel, parseLevel } from '../utils/helpers.js';

/* ─── 상태 ────────────────────────────── */
let _settings      = getSettings();
let _filterLevels  = new Set();
let _sortAlpha     = false;
let _selectedIds   = new Set();
let _addMode       = 'ko-to-en';
let _editMode      = 'ko-to-en';

/* ─── 관리자 진입/이탈 ──────────────────── */
export function initAdmin() {
  _bindSettings();
  _bindForm();
  _bindIO();
  _bindList();
  _bindScrollTop();
  _bindModal();
  _loadVoices();

  document.getElementById('btn-admin-back').addEventListener('click', () => {
    router.navigate('home');
  });

  router.register('admin', {
    onEnter() {
      _settings     = getSettings();
      _selectedIds  = new Set(getSelectedIds());
      _filterLevels = new Set(getFilterLevels());
      _applySettings();
      _applyFilterLevels();
      _renderList();
      _updateDeleteBtn();
    },
    onLeave() {
      saveSettings(_settings);
      _closeFilterDropdown();
    },
  });
}

/* ─── 설정 UI ────────────────────────── */
function _applySettings() {
  // 타이머
  document.querySelectorAll('.timer-opt').forEach(btn => {
    btn.classList.toggle('active', Number(btn.dataset.val) === _settings.timerDuration);
  });
  // 음성
  document.querySelectorAll('.voice-item').forEach(item => {
    item.classList.toggle('active', item.dataset.voiceUri === _settings.voiceURI);
  });
}

function _applyFilterLevels() {
  // 트리거 레이블 업데이트
  const label   = document.getElementById('filter-lv-label');
  const trigger = document.getElementById('filter-lv-trigger');
  if (label) {
    label.textContent = _filterLevels.size === 0
      ? '레벨 전체'
      : [..._filterLevels].sort().map(l => `Lv.${l}`).join('+');
  }
  if (trigger) trigger.classList.toggle('has-filter', _filterLevels.size > 0);

  // 드롭다운 옵션 active 상태
  document.querySelectorAll('.filter-lv-opt').forEach(btn => {
    const level = btn.dataset.level;
    btn.classList.toggle(
      'active',
      level === 'all' ? _filterLevels.size === 0 : _filterLevels.has(Number(level))
    );
  });

  _updateGameCount();
}

function _openFilterDropdown() {
  document.getElementById('filter-lv-panel').classList.add('open');
  document.getElementById('filter-lv-trigger').setAttribute('aria-expanded', 'true');
}

function _closeFilterDropdown() {
  document.getElementById('filter-lv-panel').classList.remove('open');
  document.getElementById('filter-lv-trigger').setAttribute('aria-expanded', 'false');
}

function _updateGameCount() {
  const badge = document.getElementById('filter-game-count');
  if (!badge) return;
  if (_filterLevels.size === 0) {
    badge.style.display = 'none';
    return;
  }
  const count = getSentences().filter(s => _filterLevels.has(Number(s.level))).length;
  badge.textContent = `게임 ${count}문제`;
  badge.style.display = '';
}

function _bindSettings() {
  // 타이머 선택
  document.getElementById('timer-options').addEventListener('click', e => {
    const btn = e.target.closest('.timer-opt');
    if (!btn) return;
    _settings.timerDuration = Number(btn.dataset.val);
    document.querySelectorAll('.timer-opt').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    saveSettings(_settings);
  });
}

/* ─── 음성 목록 로드 ─────────────────── */
async function _loadVoices() {
  const wrap = document.getElementById('voice-options');
  const voices = await TTS.getEnglishVoices();

  if (voices.length === 0) {
    wrap.innerHTML = '<p class="voice-loading">사용 가능한 영어 음성이 없습니다.<br>브라우저 설정에서 음성을 추가해주세요.</p>';
    return;
  }

  // 성별·품질 태그 추론
  const FEMALE_NAMES = ['Samantha','Ava','Serena','Karen','Moira','Tessa','Veena','Allison','Susan','Zoe','Alice','Fiona','Victoria'];
  const MALE_NAMES   = ['Alex','Tom','Daniel','Lee','Rishi','Nathan','Aaron','Arthur','Gordon','Oliver','Fred'];
  const VOICE_LABELS = ['🥇 Voice 1', '👩 Voice 2 (여성)', '🇬🇧 Voice 3 (영국 남성)'];

  const GB_MALE_NAMES = ['Daniel','Arthur','Oliver','Gordon','Malcolm','James','Harry','George'];
  function _genderTag(v, idx) {
    const base = v.name.split(' ')[0];
    // Voice 3(인덱스 2)는 영국 남성 태그 표시
    if (idx === 2 || (v.lang === 'en-GB' && GB_MALE_NAMES.includes(base))) {
      return '<span class="voice-tag british">🇬🇧 영국 남성</span>';
    }
    if (FEMALE_NAMES.includes(base)) return '<span class="voice-tag female">여성</span>';
    if (MALE_NAMES.includes(base))   return '<span class="voice-tag male">남성</span>';
    return '';
  }
  function _qualityTag(v) {
    if (v.name.includes('Enhanced')) return '<span class="voice-tag enhanced">Enhanced</span>';
    if (v.name.includes('Premium'))  return '<span class="voice-tag enhanced">Premium</span>';
    return '';
  }
  // 미리보기 문장 (성별별로 다르게)
  const PREVIEW_TEXTS = [
    'Hello! This is Voice One. Nice to meet you!',
    'Hi there! I\'m Voice Two. How are you today?',
    'Good morning! Lovely to meet you. I\'m your British voice. Shall we crack on?',
  ];

  wrap.innerHTML = '';
  voices.forEach((v, i) => {
    const item = document.createElement('div');
    item.className = 'voice-item';
    item.dataset.voiceUri = v.voiceURI;
    if (v.voiceURI === _settings.voiceURI) item.classList.add('active');

    item.innerHTML = `
      <div class="voice-item-info">
        <span class="voice-item-label">${VOICE_LABELS[i] ?? `Voice ${i+1}`}</span>
        <span class="voice-item-detail">
          ${_qualityTag(v)}${_genderTag(v, i)}
          <small class="voice-name-small">${v.name.substring(0, 28)}</small>
        </span>
      </div>
      <button class="voice-preview-btn" aria-label="미리 듣기" title="미리 듣기">▶</button>
    `;

    // 선택
    item.addEventListener('click', () => {
      _settings.voiceURI  = v.voiceURI;
      _settings.voiceName = v.name;
      tts.setVoiceByURI(v.voiceURI);
      document.querySelectorAll('.voice-item').forEach(el => el.classList.remove('active'));
      item.classList.add('active');
      saveSettings(_settings);
    });

    // 미리 듣기
    item.querySelector('.voice-preview-btn').addEventListener('click', e => {
      e.stopPropagation();
      tts.unlock();
      ticker.init();
      const previewText = PREVIEW_TEXTS[i] ?? 'Hello! Nice to meet you.';
      const utt = new SpeechSynthesisUtterance(previewText);
      utt.voice = v;
      utt.lang  = v.lang || 'en-US';
      utt.rate  = 0.88;
      utt.pitch = 1.0;
      speechSynthesis.cancel();
      speechSynthesis.speak(utt);
      // 재생 중 버튼 상태
      const btn = e.currentTarget;
      btn.textContent = '⏸';
      utt.onend = () => { btn.textContent = '▶'; };
      setTimeout(() => { btn.textContent = '▶'; }, 6000);
    });

    wrap.appendChild(item);
  });

  // 저장된 voiceURI 적용
  if (_settings.voiceURI) tts.setVoiceByURI(_settings.voiceURI);
}

/* ─── 문제 추가 폼 ───────────────────── */
let _addLevel = 1;

function _bindForm() {
  // 레벨 버튼
  document.getElementById('add-level-select').addEventListener('click', e => {
    const btn = e.target.closest('.level-btn');
    if (!btn) return;
    _addLevel = parseLevel(btn.dataset.level);
    document.querySelectorAll('#add-level-select .level-btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
  });

  // 출제 유형 버튼
  document.getElementById('add-mode-select').addEventListener('click', e => {
    const btn = e.target.closest('.mode-btn');
    if (!btn) return;
    _addMode = btn.dataset.mode;
    document.querySelectorAll('#add-mode-select .mode-btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
  });

  // 추가 버튼
  document.getElementById('btn-add').addEventListener('click', _handleAdd);

  // Enter 키로도 추가
  ['input-korean', 'input-english'].forEach(id => {
    document.getElementById(id).addEventListener('keydown', e => {
      if (e.key === 'Enter') _handleAdd();
    });
  });
}

function _handleAdd() {
  const korean  = sanitize(document.getElementById('input-korean').value);
  const english = sanitize(document.getElementById('input-english').value);
  if (!korean || !english) {
    showToast('한글 문장과 영어 문장을 모두 입력해주세요.');
    return;
  }

  addSentence({ id: uid(), korean, english, level: _addLevel, mode: _addMode, createdAt: Date.now() });

  document.getElementById('input-korean').value  = '';
  document.getElementById('input-english').value = '';
  _renderList();
}

/* ─── 내보내기·불러오기 ──────────────── */
function _bindIO() {
  document.getElementById('btn-export-json').addEventListener('click', () => {
    const sentences = getSentences();
    if (!sentences.length) { showToast('저장할 문제가 없습니다.'); return; }
    exportJSON(sentences);
    showToast('📥 JSON 파일로 저장했습니다.');
  });

  document.getElementById('btn-export-csv').addEventListener('click', () => {
    const sentences = getSentences();
    if (!sentences.length) { showToast('저장할 문제가 없습니다.'); return; }
    exportCSV(sentences);
    showToast('📥 CSV 파일로 저장했습니다.');
  });

  document.getElementById('btn-import').addEventListener('click', () => {
    document.getElementById('file-import').click();
  });

  document.getElementById('file-import').addEventListener('change', async e => {
    const file = e.target.files[0];
    if (!file) return;
    try {
      const imported = await importFile(file);
      const existing = getSentences();
      // 기존 ID와 중복되지 않는 것만 추가
      const existIds = new Set(existing.map(s => s.id));
      const newItems = imported.filter(s => !existIds.has(s.id));
      setSentences([...existing, ...newItems]);
      showToast(`📤 ${newItems.length}개 문제를 불러왔습니다.`);
      _renderList();
    } catch (err) {
      showToast(`❌ ${err.message}`);
    }
    e.target.value = '';
  });
}

/* ─── 문제 리스트 렌더링 ─────────────── */
function _bindList() {
  // 전체 체크박스
  document.getElementById('check-all').addEventListener('change', e => {
    const checked = e.target.checked;
    const visible = _getVisibleSentences();
    visible.forEach(s => {
      if (checked) _selectedIds.add(s.id);
      else         _selectedIds.delete(s.id);
    });
    saveSelectedIds(_selectedIds);
    _renderList();
    _updateDeleteBtn();
  });

  // 레벨 필터 드롭다운 — 트리거 클릭: 열기/닫기
  document.getElementById('filter-lv-trigger').addEventListener('click', e => {
    e.stopPropagation();
    const isOpen = document.getElementById('filter-lv-panel').classList.contains('open');
    _closeFilterDropdown();
    if (!isOpen) _openFilterDropdown();
  });

  // 레벨 필터 드롭다운 — 옵션 클릭: 즉시 리스트 갱신
  document.getElementById('filter-lv-panel').addEventListener('click', e => {
    e.stopPropagation();
    const btn = e.target.closest('.filter-lv-opt');
    if (!btn) return;
    const level = btn.dataset.level;
    if (level === 'all') {
      _filterLevels.clear();
    } else {
      const lv = Number(level);
      if (_filterLevels.has(lv)) _filterLevels.delete(lv);
      else                         _filterLevels.add(lv);
    }
    saveFilterLevels(_filterLevels);
    _applyFilterLevels();
    _renderList();
  });

  // 드롭다운 외부 클릭 시 패널 닫기
  document.addEventListener('click', () => {
    if (router.current !== 'admin') return;
    _closeFilterDropdown();
  });

  // 알파벳 정렬
  document.getElementById('btn-sort-alpha').addEventListener('click', e => {
    _sortAlpha = !_sortAlpha;
    e.currentTarget.classList.toggle('active', _sortAlpha);
    _renderList();
  });

  // 선택 삭제 — 커스텀 확인 모달 사용
  document.getElementById('btn-delete-selected').addEventListener('click', () => {
    if (!_selectedIds.size) return;
    _showConfirm(() => {
      _selectedIds.forEach(id => deleteSentence(id));
      _selectedIds.clear();
      saveSelectedIds(_selectedIds);
      _updateDeleteBtn();
      _renderList();
      showToast('🗑️ 삭제했습니다.');
    });
  });

  // 확인 모달 배경 클릭 시 닫기
  document.getElementById('modal-confirm').addEventListener('click', e => {
    if (e.target === e.currentTarget) e.currentTarget.style.display = 'none';
  });
}

function _getVisibleSentences() {
  let list = getSentences();
  // Number()로 강제 변환하여 타입 불일치 방지
  if (_filterLevels.size > 0) list = list.filter(s => _filterLevels.has(Number(s.level)));
  if (_sortAlpha) list = [...list].sort((a, b) => a.english.localeCompare(b.english));
  return list;
}

function _renderList() {
  const container = document.getElementById('sentence-list');
  const list      = _getVisibleSentences();

  // 게임 출제 문제 수 배지 갱신
  _updateGameCount();

  if (list.length === 0) {
    const levelNames = [..._filterLevels].sort().map(l => `Lv.${l}`).join(', ');
    const emptyMsg = _filterLevels.size > 0
      ? `${levelNames} 문제가 없습니다.`
      : '등록된 문제가 없습니다.';
    container.innerHTML = `
      <div class="empty-state">
        <p>${emptyMsg}</p>
        <p class="empty-hint">위 폼에서 문제를 추가해주세요.</p>
      </div>`;
    document.getElementById('check-all').checked = false;
    return;
  }

  container.innerHTML = '';
  list.forEach((s, idx) => {
    const row = document.createElement('div');
    row.className = 'sentence-item';
    row.dataset.id = s.id;

    const isChecked = _selectedIds.has(s.id);
    row.innerHTML = `
      <span class="col-check">
        <input type="checkbox" data-id="${s.id}" ${isChecked ? 'checked' : ''} aria-label="선택">
      </span>
      <span class="col-num">${idx + 1}</span>
      <span class="col-sentence col-texts">
        <span class="text-korean">${_esc(s.korean)}</span>
        <span class="text-english">${_esc(s.english)}</span>
      </span>
      <span class="col-level col-level-badge">
        <span class="level-badge ${levelClass(s.level)}">${levelLabel(s.level)}</span>
        <span class="mode-badge ${s.mode === 'en-to-ko' ? 'mode-b' : 'mode-a'}">${s.mode === 'en-to-ko' ? 'B형' : 'A형'}</span>
      </span>
      <span class="col-action col-actions">
        <button class="btn-edit-item" data-id="${s.id}">수정</button>
        <button class="btn-delete-item" data-id="${s.id}">삭제</button>
      </span>`;

    // 체크박스
    row.querySelector('input[type="checkbox"]').addEventListener('change', e => {
      if (e.target.checked) _selectedIds.add(s.id);
      else                   _selectedIds.delete(s.id);
      saveSelectedIds(_selectedIds);  // 즉시 저장
      _updateDeleteBtn();
      _syncCheckAll();
    });

    // 수정
    row.querySelector('.btn-edit-item').addEventListener('click', () => _openEdit(s));

    // 삭제
    row.querySelector('.btn-delete-item').addEventListener('click', () => {
      if (!confirm('이 문제를 삭제할까요?')) return;
      deleteSentence(s.id);
      _selectedIds.delete(s.id);
      saveSelectedIds(_selectedIds);  // 삭제된 ID도 선택 목록에서 제거
      _updateDeleteBtn();
      _renderList();
      showToast('🗑️ 삭제했습니다.');
    });

    container.appendChild(row);
  });

  // 필터 변경 후 전체선택 체크박스 상태 동기화
  _syncCheckAll();
}

function _updateDeleteBtn() {
  const btn = document.getElementById('btn-delete-selected');
  btn.style.display = _selectedIds.size > 0 ? 'block' : 'none';
}

function _syncCheckAll() {
  const visible   = _getVisibleSentences();
  const allChecked = visible.length > 0 && visible.every(s => _selectedIds.has(s.id));
  document.getElementById('check-all').checked = allChecked;
}

/* ─── 수정 모달 ──────────────────────── */
let _editLevel = 1;

function _bindModal() {
  document.getElementById('btn-edit-cancel').addEventListener('click', _closeEdit);
  document.getElementById('btn-edit-save').addEventListener('click', _handleEditSave);

  document.getElementById('edit-level-select').addEventListener('click', e => {
    const btn = e.target.closest('.level-btn');
    if (!btn) return;
    _editLevel = parseLevel(btn.dataset.level);
    document.querySelectorAll('#edit-level-select .level-btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
  });

  document.getElementById('edit-mode-select').addEventListener('click', e => {
    const btn = e.target.closest('.mode-btn');
    if (!btn) return;
    _editMode = btn.dataset.mode;
    document.querySelectorAll('#edit-mode-select .mode-btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
  });

  document.getElementById('modal-edit').addEventListener('click', e => {
    if (e.target === e.currentTarget) _closeEdit();
  });
}

function _openEdit(s) {
  document.getElementById('edit-id').value      = s.id;
  document.getElementById('edit-korean').value  = s.korean;
  document.getElementById('edit-english').value = s.english;
  _editLevel = s.level;
  _editMode  = s.mode ?? 'ko-to-en';
  document.querySelectorAll('#edit-level-select .level-btn').forEach(btn => {
    btn.classList.toggle('active', parseLevel(btn.dataset.level) === s.level);
  });
  document.querySelectorAll('#edit-mode-select .mode-btn').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.mode === _editMode);
  });
  document.getElementById('modal-edit').style.display = 'flex';
  document.getElementById('edit-korean').focus();
}

function _closeEdit() {
  document.getElementById('modal-edit').style.display = 'none';
}

function _handleEditSave() {
  const id      = document.getElementById('edit-id').value;
  const korean  = sanitize(document.getElementById('edit-korean').value);
  const english = sanitize(document.getElementById('edit-english').value);
  if (!korean || !english) {
    showToast('모든 항목을 입력해주세요.');
    return;
  }
  updateSentence(id, { korean, english, level: _editLevel, mode: _editMode });
  _closeEdit();
  _renderList();
  showToast('✅ 수정되었습니다.');
}

/* ─── 스크롤 상단 버튼 ───────────────── */
function _bindScrollTop() {
  const screen    = document.getElementById('screen-admin');
  const btn       = document.getElementById('btn-scroll-top');

  screen.addEventListener('scroll', () => {
    const show = screen.scrollTop > 200;
    btn.style.opacity       = show ? '1' : '0';
    btn.style.pointerEvents = show ? 'auto' : 'none';
  }, { passive: true });

  btn.addEventListener('click', () => {
    screen.scrollTo({ top: 0, behavior: 'smooth' });
  });

  // iOS 상태바 탭 감지
  document.addEventListener('touchend', e => {
    if (router.current !== 'admin') return;
    const safeTop = parseInt(
      getComputedStyle(document.documentElement).getPropertyValue('--sat') || '44'
    ) + 10;
    if (e.changedTouches[0]?.clientY < safeTop) {
      screen.scrollTo({ top: 0, behavior: 'smooth' });
    }
  }, { passive: true });
}

/* ─── 삭제 확인 모달 ─────────────────── */
function _showConfirm(onConfirm) {
  const modal     = document.getElementById('modal-confirm');
  const cancelBtn = document.getElementById('btn-confirm-cancel');
  const deleteBtn = document.getElementById('btn-confirm-delete');

  modal.style.display = 'flex';

  const cleanup = () => {
    modal.style.display = 'none';
    cancelBtn.removeEventListener('click', onCancel);
    deleteBtn.removeEventListener('click', onDelete);
  };
  const onCancel = () => cleanup();
  const onDelete = () => { cleanup(); onConfirm(); };

  cancelBtn.addEventListener('click', onCancel);
  deleteBtn.addEventListener('click', onDelete);
}

/* ─── 내부 유틸 ──────────────────────── */
function _esc(str) {
  return String(str ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}
