/* ══════════════════════════════════════
   dragDrop.js - Pointer Events 기반 드래그&드롭
   마우스 + 터치(iOS) 통합 지원
══════════════════════════════════════ */

const DRAG_THRESHOLD = 6; // px: 이 이상 움직여야 드래그 시작

export class DragDropEngine {
  /**
   * @param {Object} opts
   * @param {Function} opts.onDrop      - ({ from, to, wordId }) => void
   * @param {Function} [opts.onDragStart]
   * @param {Function} [opts.onDragEnd]
   */
  constructor({ onDrop, onDragStart, onDragEnd }) {
    this._onDrop      = onDrop;
    this._onDragStart = onDragStart ?? (() => {});
    this._onDragEnd   = onDragEnd   ?? (() => {});

    this._ghost    = document.getElementById('drag-ghost');
    this._dragging = null;   // { wordId, text, fromSource }
    this._originEl = null;   // 드래그 시작 엘리먼트
    this._startPos = null;
    this._moved    = false;
    this._container= null;

    this._boundMove  = this._onPointerMove.bind(this);
    this._boundUp    = this._onPointerUp.bind(this);
    this._boundDown  = this._onPointerDown.bind(this);
  }

  /** 드래그 대상이 들어있는 컨테이너에 이벤트 등록 */
  attach(container) {
    if (this._container === container) return; // 이미 부착됨
    this.detach(); // 이전 컨테이너에서 제거
    this._container = container;
    container.addEventListener('pointerdown', this._boundDown, { passive: false });
  }

  detach() {
    if (!this._container) return;
    this._container.removeEventListener('pointerdown', this._boundDown);
    this._container = null;
    this._cleanup();
  }

  _onPointerDown(e) {
    // 왼쪽 클릭 or 터치만
    if (e.button !== 0 && e.pointerType === 'mouse') return;

    const chip = e.target.closest('.word-chip');
    if (!chip) return;

    e.preventDefault();
    e.stopPropagation();

    this._originEl = chip;
    this._startPos = { x: e.clientX, y: e.clientY };
    this._moved    = false;

    // 이 포인터 이벤트를 해당 요소에 캡처 (iOS 포함)
    try { chip.setPointerCapture(e.pointerId); } catch {}

    document.addEventListener('pointermove', this._boundMove, { passive: false });
    document.addEventListener('pointerup',   this._boundUp,   { passive: false });
    document.addEventListener('pointercancel', this._boundUp, { passive: false });
  }

  _onPointerMove(e) {
    if (!this._originEl) return;
    e.preventDefault();

    const dx = e.clientX - this._startPos.x;
    const dy = e.clientY - this._startPos.y;

    if (!this._moved && Math.hypot(dx, dy) > DRAG_THRESHOLD) {
      this._moved = true;
      this._startDrag(e);
    }

    if (!this._moved) return;

    // 고스트 이동
    const gw = this._ghost.offsetWidth;
    const gh = this._ghost.offsetHeight;
    this._ghost.style.transform =
      `translate(${e.clientX - gw / 2}px, ${e.clientY - gh / 2}px)`;

    this._updateDropTarget(e.clientX, e.clientY);
  }

  _onPointerUp(e) {
    if (!this._originEl) return;

    if (this._moved) {
      // 드롭 처리
      this._ghost.style.pointerEvents = 'none';
      const el = document.elementFromPoint(e.clientX, e.clientY);
      this._ghost.style.pointerEvents = '';

      const slot = el?.closest('.word-slot');
      const pool = el?.closest('#word-pool');

      if (slot) {
        this._onDrop({
          from:   this._dragging.fromSource,
          to:     `slot-${slot.dataset.slotIndex}`,
          wordId: this._dragging.wordId,
        });
      } else if (pool) {
        this._onDrop({
          from:   this._dragging.fromSource,
          to:     'pool',
          wordId: this._dragging.wordId,
        });
      }
      // 그 외 (아무 곳도 아님): 원위치 (아무 동작 없음)
      this._onDragEnd(this._dragging);
    }

    this._cleanup();
  }

  _startDrag(e) {
    const chip = this._originEl;
    const rect = chip.getBoundingClientRect();

    this._dragging = {
      wordId:     chip.dataset.wordId,
      text:       chip.textContent.trim(),
      fromSource: chip.dataset.source, // 'pool' or 'slot-N'
    };

    // 고스트 설정
    this._ghost.textContent = this._dragging.text;
    const gw = this._ghost.offsetWidth || 80;
    const gh = this._ghost.offsetHeight || 36;
    this._ghost.style.transform =
      `translate(${e.clientX - gw / 2}px, ${e.clientY - gh / 2}px)`;
    this._ghost.style.display = 'block';

    // 원본 반투명
    chip.classList.add('is-dragging');
    document.body.classList.add('is-dragging');

    this._onDragStart(this._dragging);
  }

  _updateDropTarget(x, y) {
    // 이전 하이라이트 제거
    document.querySelectorAll('.drag-over').forEach(el => el.classList.remove('drag-over'));

    this._ghost.style.pointerEvents = 'none';
    const el = document.elementFromPoint(x, y);
    this._ghost.style.pointerEvents = '';

    const target = el?.closest('.word-slot, #word-pool');
    if (target) target.classList.add('drag-over');
  }

  _cleanup() {
    document.removeEventListener('pointermove', this._boundMove);
    document.removeEventListener('pointerup',   this._boundUp);
    document.removeEventListener('pointercancel', this._boundUp);

    if (this._originEl) {
      this._originEl.classList.remove('is-dragging');
      this._originEl = null;
    }
    document.querySelectorAll('.drag-over').forEach(el => el.classList.remove('drag-over'));
    document.body.classList.remove('is-dragging');

    if (this._ghost) this._ghost.style.display = 'none';
    this._dragging = null;
    this._moved    = false;
  }
}
