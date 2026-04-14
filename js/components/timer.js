/* ══════════════════════════════════════
   timer.js - 카운트다운 타이머
══════════════════════════════════════ */

export class Timer {
  /**
   * @param {Object} opts
   * @param {number}   opts.duration  - 총 초 (0 = 타이머 없음)
   * @param {Function} opts.onTick    - (remaining: number) => void
   * @param {Function} opts.onWarn    - (remaining: number) => void (5초 이하)
   * @param {Function} opts.onExpire  - () => void
   */
  constructor({ duration, onTick, onWarn, onExpire }) {
    this.duration  = duration;
    this.remaining = duration;
    this.onTick    = onTick    ?? (() => {});
    this.onWarn    = onWarn    ?? (() => {});
    this.onExpire  = onExpire  ?? (() => {});
    this._id       = null;
    this._running  = false;
  }

  start() {
    if (this.duration === 0 || this._running) return;
    this._running = true;
    this._id = setInterval(() => {
      this.remaining--;
      this.onTick(this.remaining);
      if (this.remaining <= 5 && this.remaining > 0) {
        this.onWarn(this.remaining);
      }
      if (this.remaining <= 0) {
        this.stop();
        this.onExpire();
      }
    }, 1000);
  }

  stop() {
    clearInterval(this._id);
    this._id      = null;
    this._running = false;
  }

  reset() {
    this.stop();
    this.remaining = this.duration;
  }

  get isRunning() {
    return this._running;
  }
}
