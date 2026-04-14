/* ══════════════════════════════════════
   store.js - localStorage 추상화 레이어
══════════════════════════════════════ */

const KEYS = {
  SENTENCES: 'esg_sentences',
  SETTINGS:  'esg_settings',
  WRONG:     'esg_wrong_answers',
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
