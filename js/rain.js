/* rain.js — the iconic falling green glyph cascade, rendered procedurally.
   Used as the world backdrop AND on menus. Original implementation. */
(function () {
  const M = (window.M = window.M || {});
  // half-width katakana-ish + latin + digits glyph set (original char pool)
  const GLYPHS =
    "ｱｲｳｴｵｶｷｸｹｺｻｼｽｾｿﾀﾁﾂﾃﾄﾅﾆﾇﾈﾉﾊﾋﾌﾍﾎﾏﾐﾑﾒﾓﾔﾕﾖﾗﾘﾙﾚﾛﾜﾝ0123456789ABCDEFZ:.=*+<>".split("");

  class Rain {
    constructor(canvas, opts = {}) {
      this.c = canvas;
      this.ctx = canvas.getContext("2d");
      this.fontSize = opts.fontSize || 16;
      this.color = opts.color || "#00ff66";
      this.density = opts.density || 1;
      this.fade = opts.fade || 0.08;
      this.speed = opts.speed || 1;
      this.cols = [];
      this.resize();
    }
    resize() {
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      const w = this.c.clientWidth || window.innerWidth;
      const h = this.c.clientHeight || window.innerHeight;
      this.c.width = w * dpr;
      this.c.height = h * dpr;
      this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      this.w = w; this.h = h;
      const n = Math.floor((w / this.fontSize) * this.density);
      this.cols = [];
      for (let i = 0; i < n; i++) {
        this.cols.push({
          x: (i / this.density) * this.fontSize,
          y: Math.random() * -h,
          spd: (0.5 + Math.random() * 1.5) * this.speed,
          len: 6 + (Math.random() * 22) | 0,
          glyphs: [],
          tick: 0,
        });
      }
    }
    step(dt) {
      const ctx = this.ctx;
      // trail fade
      ctx.fillStyle = `rgba(0,8,2,${this.fade})`;
      ctx.fillRect(0, 0, this.w, this.h);
      ctx.font = `${this.fontSize}px monospace`;
      ctx.textBaseline = "top";
      for (const col of this.cols) {
        col.y += col.spd * this.fontSize * dt * 18;
        // mutate the lead glyph occasionally
        col.tick += dt;
        const headY = col.y;
        for (let j = 0; j < col.len; j++) {
          const gy = headY - j * this.fontSize;
          if (gy < -this.fontSize || gy > this.h) continue;
          const g = GLYPHS[(Math.random() * GLYPHS.length) | 0];
          if (j === 0) {
            ctx.fillStyle = "#d7ffe6"; // bright head
            ctx.shadowColor = this.color;
            ctx.shadowBlur = 8;
          } else {
            const a = 1 - j / col.len;
            ctx.fillStyle = `rgba(0,255,102,${a * 0.9})`;
            ctx.shadowBlur = 0;
          }
          ctx.fillText(g, col.x, gy);
        }
        ctx.shadowBlur = 0;
        if (headY - col.len * this.fontSize > this.h) {
          col.y = Math.random() * -200;
          col.spd = (0.5 + Math.random() * 1.5) * this.speed;
          col.len = 6 + (Math.random() * 22) | 0;
        }
      }
    }
  }

  M.Rain = Rain;

  // lightweight standalone rain that runs its own RAF (for menu canvases/banners)
  M.spawnRain = function (canvas, opts) {
    const r = new Rain(canvas, opts);
    let last = performance.now();
    let alive = true;
    function loop(t) {
      if (!alive) return;
      const dt = Math.min(0.05, (t - last) / 1000);
      last = t;
      r.step(dt);
      requestAnimationFrame(loop);
    }
    requestAnimationFrame(loop);
    return {
      stop() { alive = false; },
      resize() { r.resize(); },
    };
  };
})();
