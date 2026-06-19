/* util.js — tiny helpers, shared math, RNG. Global namespace M. */
(function () {
  const M = (window.M = window.M || {});

  const U = (M.util = {
    TAU: Math.PI * 2,
    clamp: (v, a, b) => (v < a ? a : v > b ? b : v),
    lerp: (a, b, t) => a + (b - a) * t,
    rand: (a = 1, b) => (b === undefined ? Math.random() * a : a + Math.random() * (b - a)),
    randInt: (a, b) => Math.floor(U.rand(a, b + 1)),
    pick: (arr) => arr[(Math.random() * arr.length) | 0],
    chance: (p) => Math.random() < p,
    dist2: (ax, ay, bx, by) => {
      const dx = ax - bx, dy = ay - by;
      return dx * dx + dy * dy;
    },
    dist: (ax, ay, bx, by) => Math.hypot(ax - bx, ay - by),
    angle: (ax, ay, bx, by) => Math.atan2(by - ay, bx - ax),
    now: () => performance.now(),
    fmtTime: (s) => {
      s = Math.max(0, Math.floor(s));
      const m = (s / 60) | 0;
      const ss = s % 60;
      return String(m).padStart(2, "0") + ":" + String(ss).padStart(2, "0");
    },
    fmtNum: (n) => {
      if (n < 1000) return "" + (n | 0);
      if (n < 1e6) return (n / 1000).toFixed(n < 1e4 ? 1 : 0) + "K";
      return (n / 1e6).toFixed(1) + "M";
    },
    // weighted pick: items=[{w, ...}] -> returns item
    weighted: (items) => {
      let total = 0;
      for (const it of items) total += it.w;
      let r = Math.random() * total;
      for (const it of items) {
        r -= it.w;
        if (r <= 0) return it;
      }
      return items[items.length - 1];
    },
    // seedable PRNG (mulberry32) for deterministic art
    seed: (a) => () => {
      a |= 0;
      a = (a + 0x6d2b79f5) | 0;
      let t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    },
    el: (tag, cls, html) => {
      const e = document.createElement(tag);
      if (cls) e.className = cls;
      if (html != null) e.innerHTML = html;
      return e;
    },
    $: (s, root = document) => root.querySelector(s),
    $$: (s, root = document) => [...root.querySelectorAll(s)],
  });

  // simple object pool to avoid GC churn in the bullet hell
  M.Pool = class {
    constructor(factory) {
      this.factory = factory;
      this.free = [];
    }
    get() {
      return this.free.pop() || this.factory();
    }
    put(o) {
      this.free.push(o);
    }
  };
})();
