/* ══════════════════════════════════════
   router.js - SPA 화면 전환
══════════════════════════════════════ */

const _handlers = {};
let _current = null;

export const router = {
  /** 화면 진입/이탈 핸들러 등록 */
  register(screenId, { onEnter, onLeave } = {}) {
    _handlers[screenId] = { onEnter, onLeave };
  },

  /** 화면 전환 */
  navigate(to, state = {}) {
    const prev = _current;

    // 이탈 처리
    if (prev && prev !== to) {
      _handlers[prev]?.onLeave?.();
      const prevEl = document.getElementById(`screen-${prev}`);
      prevEl?.classList.remove('active');
    }

    // 진입 처리
    const nextEl = document.getElementById(`screen-${to}`);
    if (!nextEl) {
      console.error(`[router] 화면을 찾을 수 없음: screen-${to}`);
      return;
    }
    nextEl.classList.add('active');
    _current = to;

    // 스크롤 최상단 리셋
    nextEl.scrollTop = 0;
    window.scrollTo(0, 0);

    _handlers[to]?.onEnter?.(state);
  },

  get current() { return _current; },
};
