/* ══════════════════════════════════════
   helpers.js - 공통 유틸리티
══════════════════════════════════════ */

/** Fisher-Yates 셔플 (원본 배열 복사 후 셔플) */
export function shuffle(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

/** 고유 ID 생성 */
export function uid() {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  return Date.now().toString(36) + Math.random().toString(36).slice(2);
}

/** 문자열 정규화 (앞뒤 공백 제거) */
export function sanitize(str) {
  return (str ?? '').trim();
}

/** 토스트 메시지 표시 */
let _toastTimer = null;
export function showToast(msg, duration = 2200) {
  let el = document.getElementById('app-toast');
  if (!el) {
    el = document.createElement('div');
    el.id = 'app-toast';
    el.className = 'toast';
    document.body.appendChild(el);
  }
  el.textContent = msg;
  el.classList.add('show');
  clearTimeout(_toastTimer);
  _toastTimer = setTimeout(() => el.classList.remove('show'), duration);
}

/** 레벨 숫자 → 뱃지 클래스 */
export function levelClass(level) {
  return ['', 'lv1', 'lv2', 'lv3'][level] ?? 'lv1';
}

/** 레벨 숫자 → 표시 텍스트 */
export function levelLabel(level) {
  return `Lv.${level}`;
}

/** 숫자가 아닌 문자 제거 후 정수 파싱 */
export function parseLevel(val) {
  const n = parseInt(val, 10);
  return [1, 2, 3].includes(n) ? n : 1;
}
