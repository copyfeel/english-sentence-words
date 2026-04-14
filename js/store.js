/* ══════════════════════════════════════
   store.js - localStorage 추상화 레이어
══════════════════════════════════════ */

const KEYS = {
  SENTENCES:     'esg_sentences',
  SETTINGS:      'esg_settings',
  WRONG:         'esg_wrong_answers',
  SELECTED_IDS:  'esg_selected_ids',   // 게임에 출제할 문제 ID 목록
  FILTER_LEVELS: 'esg_filter_levels',  // 레벨 필터 (다중 선택)
};

function _get(key) {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

function _set(key, value) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
    return true;
  } catch (e) {
    console.warn('[store] localStorage 저장 실패:', e);
    return false;
  }
}

/* ─── 문장 CRUD ─────────────────────── */
export function getSentences() {
  return _get(KEYS.SENTENCES) ?? [];
}

export function addSentence(sentence) {
  const list = getSentences();
  list.push(sentence);
  _set(KEYS.SENTENCES, list);
}

export function updateSentence(id, updates) {
  const list = getSentences().map(s => s.id === id ? { ...s, ...updates } : s);
  _set(KEYS.SENTENCES, list);
}

export function deleteSentence(id) {
  const list = getSentences().filter(s => s.id !== id);
  _set(KEYS.SENTENCES, list);
}

export function setSentences(list) {
  _set(KEYS.SENTENCES, list);
}

/* ─── 설정 ──────────────────────────── */
export function getSettings() {
  return _get(KEYS.SETTINGS) ?? {
    timerDuration: 15,
    voiceURI:      '',
    voiceName:     '',
  };
}

export function saveSettings(settings) {
  _set(KEYS.SETTINGS, settings);
}

/* ─── 오답 ──────────────────────────── */
export function getWrongAnswers() {
  return _get(KEYS.WRONG) ?? [];
}

export function saveWrongAnswer(item) {
  const list = getWrongAnswers();
  const idx  = list.findIndex(w => w.sentenceId === item.sentenceId);
  if (idx >= 0) list[idx] = item;  // 최신 오답으로 갱신
  else list.push(item);
  _set(KEYS.WRONG, list);
}

export function clearWrongAnswers() {
  _set(KEYS.WRONG, []);
}

/* ─── 출제 선택 문제 ID ─────────────── */
export function getSelectedIds() {
  return _get(KEYS.SELECTED_IDS) ?? [];
}

export function saveSelectedIds(ids) {
  _set(KEYS.SELECTED_IDS, [...ids]);
}

/** 삭제된 문장 ID를 선택 목록에서도 제거 */
export function removeFromSelected(id) {
  const ids = getSelectedIds().filter(i => i !== id);
  _set(KEYS.SELECTED_IDS, ids);
}

/* ─── 레벨 필터 ─────────────────────── */
export function getFilterLevels() {
  return _get(KEYS.FILTER_LEVELS) ?? [];
}

export function saveFilterLevels(levels) {
  _set(KEYS.FILTER_LEVELS, [...levels]);
}
