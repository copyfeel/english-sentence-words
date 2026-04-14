/* ══════════════════════════════════════
   confetti.js - Canvas 색종이 폭죽 애니메이션
══════════════════════════════════════ */

const COLORS = [
  '#FF6B6B', '#FFD93D', '#6BCB77', '#4D96FF',
  '#FF6FC8', '#A29BFE', '#FD79A8', '#00CEC9',
  '#FDCB6E', '#55EFC4', '#E17055', '#74B9FF',
];

export class Confetti {
  /** @param {HTMLCanvasElement} canvas */
  constructor(canvas) {
    this._canvas   = canvas;
    this._ctx      = canvas.getContext('2d');
    this._particles = [];
    this._animId   = null;
    this._active   = false;
  }

  /** 4초간 색종이 폭죽 실행 */
  launch(duration = 4000) {
    this._resize();
    this._particles = this._createParticles(180);
    this._active    = true;

    cancelAnimationFrame(this._animId);
    this._animate();

    setTimeout(() => this._fadeOut(), duration - 600);
    setTimeout(() => this.stop(), duration);
  }

  stop() {
    this._active = false;
    cancelAnimationFrame(this._animId);
    this._ctx.clearRect(0, 0, this._canvas.width, this._canvas.height);
    this._particles = [];
  }

  _resize() {
    this._canvas.width  = window.innerWidth;
    this._canvas.height = window.innerHeight;
  }

  _createParticles(count) {
    const w = this._canvas.width;
    const h = this._canvas.height;
    return Array.from({ length: count }, (_, i) => ({
      x:       w * 0.3 + Math.random() * w * 0.4,  // 중앙 근처에서 시작
      y:       h * 0.6 + Math.random() * h * 0.2,  // 화면 하단
      vx:      (Math.random() - 0.5) * 12,
      vy:      -(8 + Math.random() * 14),           // 위로 발사
      gravity: 0.25 + Math.random() * 0.15,
      color:   COLORS[i % COLORS.length],
      w:       6 + Math.random() * 10,
      h:       3 + Math.random() * 6,
      angle:   Math.random() * Math.PI * 2,
      spin:    (Math.random() - 0.5) * 0.3,
      opacity: 1,
      decay:   0,                                   // 나중에 fadeOut 시 설정
    }));
  }

  _animate() {
    const ctx = this._ctx;
    const W   = this._canvas.width;
    const H   = this._canvas.height;

    ctx.clearRect(0, 0, W, H);

    let alive = false;
    for (const p of this._particles) {
      if (p.opacity <= 0) continue;
      alive = true;

      p.x     += p.vx;
      p.y     += p.vy;
      p.vy    += p.gravity;
      p.angle += p.spin;
      if (p.decay > 0) p.opacity = Math.max(0, p.opacity - p.decay);

      ctx.save();
      ctx.globalAlpha = Math.max(0, p.opacity);
      ctx.translate(p.x, p.y);
      ctx.rotate(p.angle);
      ctx.fillStyle = p.color;
      ctx.fillRect(-p.w / 2, -p.h / 2, p.w, p.h);
      ctx.restore();
    }

    if (alive && this._active) {
      this._animId = requestAnimationFrame(() => this._animate());
    }
  }

  _fadeOut() {
    for (const p of this._particles) {
      p.decay = 0.02 + Math.random() * 0.015;
    }
  }
}
