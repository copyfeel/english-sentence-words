/* ══════════════════════════════════════
   ticker.js - Web Audio API 틱 소리 생성
   iOS: 사용자 제스처 후 init() 필수
══════════════════════════════════════ */

class Ticker {
  constructor() {
    this._ctx = null;
  }

  /** 사용자 제스처 후 AudioContext 초기화 */
  init() {
    if (this._ctx) return;
    try {
      this._ctx = new (window.AudioContext || window.webkitAudioContext)();
    } catch (e) {
      console.warn('[Ticker] AudioContext 생성 실패:', e);
    }
  }

  /** 짧은 틱 소리 1회 재생 */
  tick() {
    if (!this._ctx) return;
    try {
      // suspended 상태면 재개
      if (this._ctx.state === 'suspended') {
        this._ctx.resume();
      }
      const now  = this._ctx.currentTime;
      const osc  = this._ctx.createOscillator();
      const gain = this._ctx.createGain();

      osc.connect(gain);
      gain.connect(this._ctx.destination);

      osc.type = 'sine';
      osc.frequency.setValueAtTime(900, now);
      osc.frequency.exponentialRampToValueAtTime(700, now + 0.06);

      gain.gain.setValueAtTime(0.35, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.1);

      osc.start(now);
      osc.stop(now + 0.12);
    } catch (e) {
      console.warn('[Ticker] tick 실패:', e);
    }
  }

  stop() {
    // 개별 tick은 자동 종료되므로 별도 stop 불필요
  }
}

export const ticker = new Ticker();
