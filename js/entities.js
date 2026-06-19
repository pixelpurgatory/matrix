/* entities.js — simulation objects. Pooled where it matters (bullets, particles).
 * World interface `W` is supplied by game.js. */
(function () {
  const M = (window.M = window.M || {});
  const U = M.util;
  const TAU = Math.PI * 2;

  /* ---------------- particles ---------------- */
  class Particle {
    constructor() { this.dead = true; }
    spawn(x, y, vx, vy, life, color, size, kind) {
      this.x = x; this.y = y; this.vx = vx; this.vy = vy;
      this.life = life; this.max = life; this.color = color; this.size = size;
      this.kind = kind || "spark"; this.dead = false; this.rot = U.rand(TAU); this.spin = U.rand(-6, 6);
      return this;
    }
    update(dt) {
      this.life -= dt;
      if (this.life <= 0) { this.dead = true; return; }
      this.x += this.vx * dt; this.y += this.vy * dt;
      this.vx *= 0.92; this.vy *= 0.92; this.rot += this.spin * dt;
      if (this.kind === "rise") this.vy -= 60 * dt;
    }
    draw(ctx) {
      const a = this.life / this.max;
      ctx.globalAlpha = a;
      if (this.kind === "glyph") {
        ctx.fillStyle = this.color; ctx.font = `${this.size * 2}px monospace`;
        ctx.fillText("01ｱｹ"[(this.x | 0) % 4], this.x, this.y);
      } else if (this.kind === "ring") {
        ctx.strokeStyle = this.color; ctx.lineWidth = 2 * a;
        ctx.beginPath(); ctx.arc(this.x, this.y, this.size * (1 - a) * 3 + this.size, 0, TAU); ctx.stroke();
      } else {
        ctx.fillStyle = this.color;
        ctx.beginPath(); ctx.arc(this.x, this.y, this.size * a, 0, TAU); ctx.fill();
      }
      ctx.globalAlpha = 1;
    }
  }

  /* ---------------- damage numbers ---------------- */
  class DmgNum {
    constructor() { this.dead = true; }
    spawn(x, y, val, crit) {
      this.x = x + U.rand(-6, 6); this.y = y; this.val = Math.round(val);
      this.life = 0.7; this.crit = crit; this.dead = false; this.vy = -70; return this;
    }
    update(dt) { this.life -= dt; this.y += this.vy * dt; this.vy *= 0.9; if (this.life <= 0) this.dead = true; }
    draw(ctx) {
      const a = U.clamp(this.life / 0.7, 0, 1);
      ctx.globalAlpha = a;
      ctx.font = `${this.crit ? "bold " : ""}${this.crit ? 20 : 14}px monospace`;
      ctx.fillStyle = this.crit ? "#fff36b" : "#eaffef";
      ctx.strokeStyle = "rgba(0,0,0,.7)"; ctx.lineWidth = 3;
      ctx.textAlign = "center";
      ctx.strokeText(this.val + (this.crit ? "!" : ""), this.x, this.y);
      ctx.fillText(this.val + (this.crit ? "!" : ""), this.x, this.y);
      ctx.globalAlpha = 1; ctx.textAlign = "left";
    }
  }

  /* ---------------- projectiles ---------------- */
  class Bullet {
    constructor() { this.dead = true; }
    spawn(o) {
      Object.assign(this, o);
      this.dead = false; this.life = o.life || 2.2; this.age = 0;
      this.hits = new Set(); this.pierceLeft = o.pierce || 1; this.r = o.r || 6;
      this.trail = [];
      return this;
    }
    update(dt, W) {
      this.age += dt; this.life -= dt;
      if (this.life <= 0) { this.dead = true; return; }
      if (this.homing && W.enemies.length) {
        const tgt = W.nearestEnemy(this.x, this.y);
        if (tgt) {
          const a = U.angle(this.x, this.y, tgt.x, tgt.y);
          const cur = Math.atan2(this.vy, this.vx);
          let da = a - cur; while (da > Math.PI) da -= TAU; while (da < -Math.PI) da += TAU;
          const na = cur + da * Math.min(1, this.homing * 60 * dt);
          const sp = Math.hypot(this.vx, this.vy);
          this.vx = Math.cos(na) * sp; this.vy = Math.sin(na) * sp;
        }
      }
      this.x += this.vx * dt; this.y += this.vy * dt;
      this.trail.push(this.x, this.y); if (this.trail.length > 8) this.trail.splice(0, 2);
    }
    draw(ctx) {
      ctx.lineCap = "round";
      // tracer
      if (this.trail.length > 2) {
        ctx.strokeStyle = M.sprites.hexa(this.color, 0.4); ctx.lineWidth = this.r * 0.9;
        ctx.beginPath(); ctx.moveTo(this.trail[0], this.trail[1]);
        for (let i = 2; i < this.trail.length; i += 2) ctx.lineTo(this.trail[i], this.trail[i + 1]);
        ctx.stroke();
      }
      M.sprites.glow(ctx, this.x, this.y, this.r * 2.4, this.color, 0.7);
      ctx.fillStyle = "#fff";
      ctx.beginPath(); ctx.arc(this.x, this.y, this.r * 0.6, 0, TAU); ctx.fill();
      ctx.fillStyle = this.color;
      ctx.beginPath(); ctx.arc(this.x, this.y, this.r, 0, TAU); ctx.fill();
    }
  }

  /* ---------------- enemies ---------------- */
  const ETYPE = {
    agent:    { hp: 22, spd: 58, r: 16, dmg: 8, xp: 1, draw: "agent", byte: 1, color:"#11151b" },
    runner:   { hp: 12, spd: 96, r: 13, dmg: 6, xp: 1, draw: "wraith", byte: 1, color:"#8a00ff" },
    sentinel: { hp: 46, spd: 46, r: 18, dmg: 12, xp: 2, draw: "sentinel", byte: 2, color:"#ff2b3a" },
    brute:    { hp: 140, spd: 34, r: 26, dmg: 18, xp: 4, draw: "sentinel", byte: 4, big: 1.5, color:"#ff2b3a" },
    boss:     { hp: 2600, spd: 40, r: 40, dmg: 26, xp: 40, draw: "boss", byte: 120, color:"#00ff66", boss: true },
    // ---- boss roster (cycled by the director) ----
    boss_smith:    { hp: 2600, spd: 44, r: 40, dmg: 26, xp: 40, draw: "boss", byte: 120, color:"#00ff66", boss: true, name:"AGENT SMITH",
                     ranged: { cd: 2.2, n: 5, arc: 1.2, spd: 230, dmg: 14, color:"#00ff66" } },
    boss_sentinel: { hp: 4200, spd: 34, r: 50, dmg: 30, xp: 60, draw: "bossSentinel", byte: 160, color:"#ff2b3a", boss: true, name:"SENTINEL PRIME",
                     ranged: { cd: 1.6, n: 8, arc: 6.28, spd: 190, dmg: 12, color:"#ff2b3a" } },
    boss_twins:    { hp: 3200, spd: 70, r: 34, dmg: 24, xp: 55, draw: "bossTwin", byte: 150, color:"#c9b8ff", boss: true, name:"THE TWINS", phase: true,
                     ranged: { cd: 1.1, n: 3, arc: 0.5, spd: 280, dmg: 16, color:"#c9b8ff" } },
    boss_architect:{ hp: 6000, spd: 30, r: 46, dmg: 34, xp: 90, draw: "boss", byte: 240, color:"#ffd24a", boss: true, name:"THE ARCHITECT",
                     ranged: { cd: 1.4, n: 12, arc: 6.28, spd: 210, dmg: 14, color:"#ffd24a" } },
  };
  const BOSS_CYCLE = ["boss_smith", "boss_sentinel", "boss_twins", "boss_architect"];
  class Enemy {
    constructor() { this.dead = true; }
    spawn(type, x, y, hpScale, dmgScale) {
      const t = ETYPE[type];
      this.type = type; this.t = t; this.x = x; this.y = y;
      this.hp = t.hp * (hpScale || 1); this.maxhp = this.hp;
      this.spd = t.spd; this.r = t.r * (t.big || 1); this.dmg = t.dmg * (dmgScale || 1);
      this.dead = false; this.flash = 0; this.hitCD = 0; this.kb = { x: 0, y: 0 };
      this.seed = U.rand(100); this.slow = 0;
      this.fireT = t.ranged ? U.rand(1, t.ranged.cd) : 0;
      return this;
    }
    update(dt, W) {
      this.flash = Math.max(0, this.flash - dt * 4);
      this.hitCD = Math.max(0, this.hitCD - dt);
      this.slow = Math.max(0, this.slow - dt);
      const p = W.player;
      const a = U.angle(this.x, this.y, p.x, p.y);
      const sp = this.spd * (this.slow > 0 ? 0.45 : 1);
      this.x += (Math.cos(a) * sp + this.kb.x) * dt;
      this.y += (Math.sin(a) * sp + this.kb.y) * dt;
      this.kb.x *= 0.86; this.kb.y *= 0.86;
      // ranged attack (bosses): telegraphed spread of hostile code-bolts
      if (this.t.ranged) {
        this.fireT -= dt;
        if (this.fireT <= 0) {
          this.fireT = this.t.ranged.cd;
          const R = this.t.ranged;
          const base = U.angle(this.x, this.y, p.x, p.y);
          for (let i = 0; i < R.n; i++) {
            const off = R.n > 1 ? (i / (R.n - 1) - 0.5) * R.arc : 0;
            const ang = base + off + (R.arc >= 6 ? i * (R.arc / R.n) : 0);
            W.addEnemyBullet(this.x, this.y, Math.cos(ang) * R.spd, Math.sin(ang) * R.spd, R.dmg, R.color);
          }
          M.audio.sfx.shoot();
        }
      }
      // contact damage
      const rr = this.r + p.r;
      if (U.dist2(this.x, this.y, p.x, p.y) < rr * rr && this.hitCD <= 0) {
        p.hurt(this.dmg, W); this.hitCD = 0.6;
      }
    }
    hit(dmg, W, kbx = 0, kby = 0, crit = false) {
      this.hp -= dmg; this.flash = 1;
      W.spawnDmg(this.x, this.y - this.r, dmg, crit);
      this.kb.x += kbx; this.kb.y += kby;
      for (let i = 0; i < 3; i++)
        W.spawnParticle(this.x, this.y, U.rand(-90, 90), U.rand(-90, 90), 0.3, this.t.color, 2, "spark");
      M.audio.sfx.hit();
      if (this.hp <= 0) this.die(W);
    }
    die(W) {
      this.dead = true;
      W.onKill(this);
      for (let i = 0; i < (this.t.boss ? 40 : 8); i++)
        W.spawnParticle(this.x, this.y, U.rand(-180, 180), U.rand(-180, 180), U.rand(0.3, 0.7), this.t.color, U.rand(2, 4), U.chance(0.5) ? "glyph" : "spark");
      W.spawnParticle(this.x, this.y, 0, 0, 0.4, this.t.color, this.r, "ring");
      if (this.t.boss) M.audio.sfx.explode();
    }
    draw(ctx, t) {
      const S = M.sprites;
      ctx.save();
      if (this.flash > 0.01) { ctx.globalCompositeOperation = "lighter"; }
      const fn = S[this.t.draw];
      fn(ctx, this.x, this.y, this.r, t + this.seed, this.t.color, true);
      ctx.restore();
      // hp bar for tough/boss
      if ((this.maxhp > 60 || this.t.boss) && this.hp < this.maxhp) {
        const w = this.r * 2, h = this.t.boss ? 6 : 3;
        ctx.fillStyle = "rgba(0,0,0,.6)"; ctx.fillRect(this.x - w / 2, this.y - this.r - 10, w, h);
        ctx.fillStyle = this.t.boss ? "#ff2b4d" : "#7CFF4E";
        ctx.fillRect(this.x - w / 2, this.y - this.r - 10, w * (this.hp / this.maxhp), h);
      }
    }
  }

  /* ---------------- pickups ---------------- */
  class Pickup {
    constructor() { this.dead = true; }
    spawn(kind, x, y, val) {
      this.kind = kind; this.x = x; this.y = y; this.val = val; this.dead = false;
      this.vx = U.rand(-40, 40); this.vy = U.rand(-40, 40); this.pull = false; this.seed = U.rand(10);
      return this;
    }
    update(dt, W) {
      const p = W.player;
      const d2 = U.dist2(this.x, this.y, p.x, p.y);
      const range = p.magnetRange;
      if (this.pull || d2 < range * range) {
        this.pull = true;
        const a = U.angle(this.x, this.y, p.x, p.y);
        const sp = 420;
        this.x += Math.cos(a) * sp * dt; this.y += Math.sin(a) * sp * dt;
      } else {
        this.x += this.vx * dt; this.y += this.vy * dt; this.vx *= 0.9; this.vy *= 0.9;
      }
      const rr = p.r + 14;
      if (d2 < rr * rr || U.dist2(this.x, this.y, p.x, p.y) < rr * rr) {
        W.collect(this); this.dead = true;
      }
    }
    draw(ctx, t) {
      const S = M.sprites;
      if (this.kind === "xp") S.gem(ctx, this.x, this.y, 6, t + this.seed, "#00ff66");
      else if (this.kind === "byte") S.gem(ctx, this.x, this.y, 6, t + this.seed, "#ffd24a");
      else if (this.kind === "heart") {
        S.glow(ctx, this.x, this.y, 14, "#ff2b4d", 0.6);
        ctx.fillStyle = "#ff2b4d"; ctx.font = "16px monospace"; ctx.textAlign = "center";
        ctx.fillText("♥", this.x, this.y + 5); ctx.textAlign = "left";
      } else if (this.kind === "magnet") {
        S.glow(ctx, this.x, this.y, 14, "#39e7ff", 0.6);
        ctx.fillStyle = "#39e7ff"; ctx.font = "16px monospace"; ctx.textAlign = "center";
        ctx.fillText("◈", this.x, this.y + 5); ctx.textAlign = "left";
      } else if (this.kind === "bomb") {
        S.glow(ctx, this.x, this.y, 16, "#ffb300", 0.7);
        ctx.fillStyle = "#ffb300"; ctx.font = "18px monospace"; ctx.textAlign = "center";
        ctx.fillText("✸", this.x, this.y + 6); ctx.textAlign = "left";
      }
    }
  }

  M.ent = { Particle, DmgNum, Bullet, Enemy, Pickup, ETYPE, BOSS_CYCLE };
})();
