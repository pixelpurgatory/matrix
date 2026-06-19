/* game.js — the survivor engine: loop, player, weapons, spawn director, camera. */
(function () {
  const M = (window.M = window.M || {});
  const U = M.util, E = M.ent, S = M.sprites, D = M.data;
  const TAU = Math.PI * 2;

  /* ---------------- Player ---------------- */
  class Player {
    constructor(charId, metaBonus) {
      const c = D.CHARS[charId];
      this.char = c;
      this.x = 0; this.y = 0; this.r = 17; this.facing = 1;
      this.moving = false;
      const mb = metaBonus;
      this.baseHp = 100 * c.stats.hp + mb.maxhp;
      this.maxhp = this.baseHp;
      this.hp = this.maxhp;
      this.speedBase = 150 * c.stats.spd * (1 + mb.haste * 0.0);
      // stat multipliers from passives
      this.stat = { power: c.stats.dmg * mb.power, haste: 1 + mb.haste, speed: 1 + (mb.speed||0), magnet: 1 + mb.magnet, crit: 0.05, area: 1, regen: 0 };
      this.magnetRange = 80 * this.stat.magnet;
      this.level = 1; this.xp = 0; this.xpNext = 6;
      this.weapons = {}; this.passives = {};
      this.flash = 0; this.invuln = 0; this.revives = mb.revive || 0;
      this.addWeapon(c.start);
      this.killStreak = 0;
    }
    addWeapon(id) {
      if (this.weapons[id]) { this.weapons[id].lvl = Math.min(D.WEAPONS[id].max, this.weapons[id].lvl + 1); }
      else this.weapons[id] = { id, lvl: 1, t: 0, def: D.WEAPONS[id] };
      // (re)build orbiters / drones for those weapon kinds
      if (D.WEAPONS[id].kind === "orbit" || D.WEAPONS[id].kind === "drone") this.rebuildSatellites(id);
    }
    rebuildSatellites(id) {
      const w = this.weapons[id]; const def = w.def;
      w.sats = []; const n = def.count[w.lvl - 1];
      for (let i = 0; i < n; i++) w.sats.push({ a: (i / n) * TAU, fireT: 0 });
    }
    addPassive(id) {
      const def = D.PASSIVES[id];
      this.passives[id] = (this.passives[id] || 0) + 1;
      const lv = this.passives[id];
      // recompute derived
      if (def.stat === "maxhp") { const add = def.per; this.maxhp += add; this.hp += add; }
      else if (def.stat === "speed") this.stat.speed += def.per;
      else if (def.stat === "haste") this.stat.haste += def.per;
      else if (def.stat === "power") this.stat.power += def.per;
      else if (def.stat === "magnet") { this.stat.magnet += def.per; this.magnetRange = 80 * this.stat.magnet; }
      else if (def.stat === "regen") this.stat.regen += def.per;
      else if (def.stat === "crit") this.stat.crit += def.per;
      else if (def.stat === "area") this.stat.area += def.per;
    }
    get speed() { return this.speedBase * this.stat.speed; }
    gainXp(n, W) {
      this.xp += n;
      while (this.xp >= this.xpNext) {
        this.xp -= this.xpNext;
        this.level++;
        this.xpNext = Math.floor(6 + this.level * 3.2 + Math.pow(this.level, 1.5));
        W.onLevelUp();
      }
    }
    hurt(dmg, W) {
      if (this.invuln > 0) return;
      this.hp -= dmg; this.flash = 1; this.invuln = 0.5;
      W.shake(8); M.audio.sfx.hurt();
      W.killStreakReset && (this.killStreak = 0);
      if (this.hp <= 0) {
        if (this.revives > 0) { this.revives--; this.hp = this.maxhp * 0.6; this.invuln = 2; W.bigBomb(); W.toast("RELOAD SAVE // -1"); }
        else W.gameOver();
      }
    }
    update(dt, W, move) {
      this.flash = Math.max(0, this.flash - dt * 4);
      this.invuln = Math.max(0, this.invuln - dt);
      if (this.stat.regen > 0 && this.hp < this.maxhp) this.hp = Math.min(this.maxhp, this.hp + this.stat.regen * dt);
      this.moving = move.x !== 0 || move.y !== 0;
      if (this.moving) {
        const len = Math.hypot(move.x, move.y) || 1;
        this.x += (move.x / len) * this.speed * dt;
        this.y += (move.y / len) * this.speed * dt;
        if (move.x !== 0) this.facing = move.x > 0 ? 1 : -1;
        this.aim = Math.atan2(move.y, move.x);
      }
      // fire weapons
      for (const id in this.weapons) this.fire(this.weapons[id], dt, W);
    }
    fire(w, dt, W) {
      const def = w.def; const lv = w.lvl - 1;
      const power = this.stat.power;
      if (def.kind === "orbit") {
        const speed = def.rot * (1 + (this.stat.haste - 1) * 0.5);
        const rad = def.radius * this.stat.area;
        for (const sat of w.sats) {
          sat.a += speed * dt;
          sat.fireT -= dt;
          const sx = this.x + Math.cos(sat.a) * rad, sy = this.y + Math.sin(sat.a) * rad;
          sat.x = sx; sat.y = sy;
          // damage on contact (cooldown per sat)
          for (const e of W.enemies) {
            if (e.dead) continue;
            const rr = e.r + 12;
            if (U.dist2(sx, sy, e.x, e.y) < rr * rr && sat.fireT <= 0) {
              const { dmg, crit } = this.roll(def.dmg[lv] * power);
              e.hit(dmg, W, Math.cos(sat.a) * 120, Math.sin(sat.a) * 120, crit);
              sat.fireT = 0.18;
            }
          }
        }
        return;
      }
      if (def.kind === "drone") {
        const rad = 46;
        w.t += dt;
        for (let i = 0; i < w.sats.length; i++) {
          const sat = w.sats[i];
          sat.a += 1.4 * dt;
          sat.x = this.x + Math.cos(sat.a) * rad; sat.y = this.y + Math.sin(sat.a) * rad;
          sat.fireT = (sat.fireT || 0) - dt;
          if (sat.fireT <= 0) {
            const tgt = W.nearestEnemy(sat.x, sat.y);
            if (tgt) {
              const a = U.angle(sat.x, sat.y, tgt.x, tgt.y);
              W.addBullet(sat.x, sat.y, Math.cos(a) * def.speed, Math.sin(a) * def.speed, def.dmg[lv] * power, def.color, def.pierce, 0, 5, false);
              sat.fireT = def.cd[lv] / this.stat.haste;
              M.audio.sfx.shoot();
            }
          }
        }
        return;
      }
      // timed weapons
      w.t -= dt;
      if (w.t > 0) return;
      w.t = (def.cd[lv] || 1) / this.stat.haste;

      if (def.kind === "shoot") {
        const n = def.count[lv];
        let baseA;
        if (def.aimMove) baseA = this.aim != null ? this.aim : (this.facing > 0 ? 0 : Math.PI);
        else { const tgt = W.nearestEnemy(this.x, this.y); baseA = tgt ? U.angle(this.x, this.y, tgt.x, tgt.y) : (this.aim || 0); }
        const arc = def.spreadArc || 0;
        for (let i = 0; i < n; i++) {
          const off = n > 1 ? (i / (n - 1) - 0.5) * (arc || 0.25 * (n - 1)) : 0;
          const a = baseA + off;
          const b = W.addBullet(this.x, this.y, Math.cos(a) * def.speed, Math.sin(a) * def.speed,
            def.dmg[lv] * power, def.color, def.pierce, def.homing || 0, def.id === "trace" ? 8 : 6, false);
          b.explode = def.explode || 0; b.owner = this; b.crit = this.stat.crit;
        }
        M.audio.sfx.shoot();
        return;
      }
      if (def.kind === "nova") {
        const rad = def.radius[lv] * this.stat.area;
        W.nova(this.x, this.y, rad, def.dmg[lv] * power, def.color, def.knockback);
        M.audio.sfx.explode();
        return;
      }
      if (def.kind === "chain") {
        const first = W.nearestEnemy(this.x, this.y);
        if (first) W.chain(this.x, this.y, first, def.jumps[lv], def.dmg[lv] * power, def.color, def.rangeJump);
        M.audio.sfx.shoot();
      }
    }
    roll(base) {
      const crit = Math.random() < this.stat.crit;
      return { dmg: crit ? base * 2 : base, crit };
    }
    draw(ctx, t) {
      // locator ring so the operator stays findable in a dense swarm
      const pulse = 0.6 + 0.4 * Math.sin(t * 4);
      ctx.save();
      ctx.strokeStyle = S.hexa(this.char.accent, 0.5 * pulse);
      ctx.lineWidth = 2;
      ctx.beginPath(); ctx.ellipse(this.x, this.y + this.r * 0.7, this.r * 1.5, this.r * 0.6, 0, 0, TAU); ctx.stroke();
      ctx.restore();
      S.operator(ctx, this.x, this.y, this.r, t, this.char, this.facing, this.moving, this.flash);
      if (this.invuln > 0 && Math.floor(t * 20) % 2) {
        ctx.globalAlpha = 0.3; S.glow(ctx, this.x, this.y, this.r * 2, "#fff", 0.5); ctx.globalAlpha = 1;
      }
      // draw orbit/drone satellites
      for (const id in this.weapons) {
        const w = this.weapons[id];
        if (w.def.kind === "orbit" && w.sats) {
          for (const sat of w.sats) {
            S.glow(ctx, sat.x, sat.y, 16, w.def.color, 0.7);
            ctx.save(); ctx.translate(sat.x, sat.y); ctx.rotate(sat.a * 3);
            ctx.strokeStyle = "#fff"; ctx.lineWidth = 3; ctx.beginPath(); ctx.arc(0, 0, 9, 0, TAU); ctx.stroke();
            ctx.strokeStyle = w.def.color; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(0, 0, 9, 0, Math.PI * 1.4); ctx.stroke();
            ctx.restore();
          }
        }
        if (w.def.kind === "drone" && w.sats) {
          for (const sat of w.sats) S.sentinel(ctx, sat.x, sat.y, 10, t, false);
        }
      }
    }
  }

  /* ---------------- Game / World ---------------- */
  class Game {
    constructor(canvas) {
      this.c = canvas; this.ctx = canvas.getContext("2d");
      this.particles = new M.Pool(() => new E.Particle());
      this.bulletPool = new M.Pool(() => new E.Bullet());
      this.enemyPool = new M.Pool(() => new E.Enemy());
      this.pickupPool = new M.Pool(() => new E.Pickup());
      this.parts = []; this.dmgPool = new M.Pool(() => new E.DmgNum());
      this.dmgs = [];
      this.reset();
      this.resize();
      window.addEventListener("resize", () => this.resize());
    }
    reset() {
      this.enemies = []; this.bullets = []; this.eBullets = []; this.pickups = []; this.parts = []; this.dmgs = [];
      this.bossIdx = 0; this.nextBossT = 0;
      this.time = 0; this.kills = 0; this.cam = { x: 0, y: 0 }; this.shakeAmt = 0;
      this.spawnT = 0; this.bossSpawned = false; this.bossKilled = false; this.timeScale = 1;
      this.state = "idle"; this.runStats = null; this.rain = null;
    }
    resize() {
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      this.W = this.c.clientWidth; this.H = this.c.clientHeight;
      this.c.width = this.W * dpr; this.c.height = this.H * dpr;
      this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      // ZOOM: keep sprites large & readable on phones. Scale to the short edge.
      this.zoom = U.clamp(Math.min(this.W, this.H) / 230, 1.6, 2.6);
      this.vw = this.W / this.zoom; this.vh = this.H / this.zoom; // visible world size
    }

    start(charId) {
      this.reset();
      const mb = M.mon.metaBonus();
      this.player = new Player(charId, mb);
      this.stage = D.STAGES[(M.save.data.stage || 1) - 1] || D.STAGES[0];
      this.state = "playing";
      this.lastT = U.now();
      M.audio.combatMusic();
      this.loop();
    }

    /* ---- world API for entities ---- */
    spawnParticle(x, y, vx, vy, life, color, size, kind) {
      const p = this.particles.get().spawn(x, y, vx, vy, life, color, size, kind);
      this.parts.push(p); return p;
    }
    spawnDmg(x, y, v, crit) { this.dmgs.push(this.dmgPool.get().spawn(x, y, v, crit)); }
    addBullet(x, y, vx, vy, dmg, color, pierce, homing, r, fromEnemy) {
      const b = this.bulletPool.get().spawn({ x, y, vx, vy, dmg, color, pierce, homing, r, fromEnemy, crit: 0 });
      this.bullets.push(b); return b;
    }
    addEnemyBullet(x, y, vx, vy, dmg, color) {
      const b = this.bulletPool.get().spawn({ x, y, vx, vy, dmg, color, pierce: 1, homing: 0, r: 7, fromEnemy: true });
      this.eBullets.push(b); return b;
    }
    nearestEnemy(x, y, maxd) {
      let best = null, bd = maxd ? maxd * maxd : Infinity;
      for (const e of this.enemies) {
        if (e.dead) continue;
        const d = U.dist2(x, y, e.x, e.y);
        if (d < bd) { bd = d; best = e; }
      }
      return best;
    }
    nova(x, y, rad, dmg, color, kb) {
      this.spawnParticle(x, y, 0, 0, 0.5, color, rad / 3, "ring");
      this.spawnParticle(x, y, 0, 0, 0.35, color, rad / 4, "ring");
      this.shake(6);
      for (const e of this.enemies) {
        if (e.dead) continue;
        if (U.dist2(x, y, e.x, e.y) < rad * rad) {
          const a = U.angle(x, y, e.x, e.y);
          const cr = this.player.roll(dmg);
          e.hit(cr.dmg, this, Math.cos(a) * kb, Math.sin(a) * kb, cr.crit);
        }
      }
    }
    chain(x, y, first, jumps, dmg, color, range) {
      let cur = first; const hit = new Set(); let px = x, py = y;
      for (let j = 0; j < jumps && cur; j++) {
        hit.add(cur);
        this.lightning(px, py, cur.x, cur.y, color);
        const cr = this.player.roll(dmg);
        cur.hit(cr.dmg, this, 0, 0, cr.crit);
        px = cur.x; py = cur.y;
        // next nearest unhit
        let best = null, bd = range * range;
        for (const e of this.enemies) { if (e.dead || hit.has(e)) continue; const d = U.dist2(px, py, e.x, e.y); if (d < bd) { bd = d; best = e; } }
        cur = best;
      }
    }
    lightning(x0, y0, x1, y1, color) {
      const seg = 6; this._bolts = this._bolts || [];
      const pts = [[x0, y0]];
      for (let i = 1; i < seg; i++) {
        const t = i / seg;
        pts.push([U.lerp(x0, x1, t) + U.rand(-12, 12), U.lerp(y0, y1, t) + U.rand(-12, 12)]);
      }
      pts.push([x1, y1]);
      this._bolts.push({ pts, life: 0.12, max: 0.12, color });
    }
    onKill(e) {
      this.kills++; this.player.killStreak++;
      // drops
      const xpVal = e.t.xp;
      for (let i = 0; i < xpVal; i++)
        this.pickups.push(this.pickupPool.get().spawn("xp", e.x + U.rand(-8, 8), e.y + U.rand(-8, 8), 1));
      if (U.chance(0.35)) this.pickups.push(this.pickupPool.get().spawn("byte", e.x, e.y, e.t.byte));
      if (U.chance(e.t.boss ? 1 : 0.012)) this.pickups.push(this.pickupPool.get().spawn("heart", e.x, e.y, 20));
      if (U.chance(0.01)) this.pickups.push(this.pickupPool.get().spawn("magnet", e.x, e.y, 0));
      if (e.t.boss) { this.pickups.push(this.pickupPool.get().spawn("bomb", e.x, e.y, 0)); this.bossKilled = true; }
      this.enemyPool.put(e);
    }
    collect(p) {
      if (p.kind === "xp") { this.player.gainXp(p.val, this); M.audio.sfx.pickup(); }
      else if (p.kind === "byte") { this.runBytes = (this.runBytes || 0) + p.val; M.audio.sfx.coin(); }
      else if (p.kind === "heart") { this.player.hp = Math.min(this.player.maxhp, this.player.hp + p.val); this.toast("+" + p.val + " HP"); }
      else if (p.kind === "magnet") { this.magnetAll(); }
      else if (p.kind === "bomb") { this.bigBomb(); }
      this.pickupPool.put(p);
    }
    magnetAll() { for (const p of this.pickups) p.pull = true; this.toast("◈ DATA SWEEP"); }
    bigBomb() {
      this.shake(20); this.timeScale = 0.2; setTimeout(() => (this.timeScale = 1), 200);
      for (const e of this.enemies) { if (e.dead) continue; if (!e.t.boss) e.hit(99999, this); else e.hit(400, this); }
      this.spawnParticle(this.player.x, this.player.y, 0, 0, 0.6, "#fff", 200, "ring");
      M.audio.sfx.explode();
    }
    shake(a) { this.shakeAmt = Math.max(this.shakeAmt, a); }
    toast(t) { M.ui && M.ui.toast(t); }
    onLevelUp() { M.audio.sfx.levelup(); this._pendingLevels = (this._pendingLevels || 0) + 1; }

    /* ---- spawn director: ramps difficulty over time ---- */
    spawnDirector(dt) {
      this.spawnT -= dt;
      const min = this.time / 60;
      const rate = U.clamp(0.45 - min * 0.045, 0.05, 0.45); // faster spawns over time
      const cap = 320;
      if (this.spawnT <= 0 && this.enemies.length < cap) {
        this.spawnT = rate;
        const batch = 3 + Math.floor(min * 3);
        for (let i = 0; i < batch && this.enemies.length < cap; i++) this.spawnEnemy(min);
      }
      // elite waves every 30s
      if (Math.floor(this.time) > 0 && Math.floor(this.time) % 30 === 0 && !this._waveMark) {
        this._waveMark = true; this.toast("⚠ TRACE PROGRAM INCOMING");
        for (let i = 0; i < 8 + min * 3; i++) this.spawnEnemy(min, "sentinel");
      }
      if (Math.floor(this.time) % 30 !== 0) this._waveMark = false;
      // boss waves: first at stage.boss, then every 75s a new (tougher) archetype
      if (this.time >= (this.nextBossT || this.stage.boss)) {
        const cycle = E.BOSS_CYCLE;
        const type = cycle[this.bossIdx % cycle.length];
        const loops = Math.floor(this.bossIdx / cycle.length); // each full loop = stronger
        this.bossIdx++;
        this.bossSpawned = true;
        this.nextBossT = this.time + 75;
        const nm = E.ETYPE[type].name || "AGENT";
        this.toast("◤ " + nm + " MANIFESTING ◢"); M.audio.sfx.boss(); this.shake(16);
        this.spawnBoss(type, 1 + loops * 0.8 + min * 0.05);
      }
    }
    spawnBoss(type, hpScale) {
      const a = U.rand(TAU);
      const dist = Math.max(this.vw, this.vh) * 0.6 + 60;
      const x = this.player.x + Math.cos(a) * dist;
      const y = this.player.y + Math.sin(a) * dist;
      this.enemies.push(this.enemyPool.get().spawn(type, x, y, hpScale, 1 + this.time / 600));
    }
    spawnEnemy(min, force) {
      let type = force;
      if (!type) {
        const r = Math.random();
        if (min > 4 && r < 0.12) type = "brute";
        else if (min > 1.5 && r < 0.4) type = "sentinel";
        else if (r < 0.65) type = "agent";
        else type = "runner";
      }
      const a = U.rand(TAU);
      const dist = Math.max(this.vw, this.vh) * 0.6 + 40;
      const x = this.player.x + Math.cos(a) * dist;
      const y = this.player.y + Math.sin(a) * dist;
      const hpScale = 1 + min * 0.22;
      const dmgScale = 1 + min * 0.08;
      this.enemies.push(this.enemyPool.get().spawn(type, x, y, type === "boss" ? 1 : hpScale, dmgScale));
    }

    gameOver() {
      if (this.state !== "playing") return;
      this.state = "dead";
      this.runStats = { kills: this.kills, time: this.time, level: this.player.level, boss: this.bossKilled, bytes: this.runBytes || 0 };
      M.audio.fadeMusic(0.12, 1.5);
      setTimeout(() => M.ui.showGameOver(this.runStats), 600);
    }
    win() { this.gameOver(); }

    /* ---- update ---- */
    update(dt) {
      const ts = this.timeScale;
      dt *= ts;
      this.time += dt;
      this.spawnDirector(dt);

      // input -> player
      const mv = M.input.vector();
      this.player.update(dt, this, mv);

      // music intensity follows enemy pressure
      const pressure = U.clamp(this.enemies.length / 60 + (this.bossSpawned && !this.bossKilled ? 0.4 : 0), 0.3, 1);
      M.audio.setIntensity(pressure);

      for (const e of this.enemies) if (!e.dead) e.update(dt, this);
      // bullets
      for (const b of this.bullets) {
        if (b.dead) continue;
        b.update(dt, this);
        for (const e of this.enemies) {
          if (e.dead || b.hits.has(e)) continue;
          const rr = e.r + b.r;
          if (U.dist2(b.x, b.y, e.x, e.y) < rr * rr) {
            const crit = Math.random() < (b.crit || 0);
            e.hit(crit ? b.dmg * 2 : b.dmg, this, b.vx * 0.04, b.vy * 0.04, crit);
            b.hits.add(e); b.pierceLeft--;
            if (b.explode) this.nova(b.x, b.y, b.explode, b.dmg * 0.7, b.color, 60);
            if (b.pierceLeft <= 0) { b.dead = true; break; }
          }
        }
      }
      // enemy bullets vs player
      const pl = this.player;
      for (const b of this.eBullets) {
        if (b.dead) continue;
        b.age += dt; b.life -= dt;
        b.x += b.vx * dt; b.y += b.vy * dt;
        if (b.life <= 0) { b.dead = true; continue; }
        const rr = pl.r + b.r;
        if (U.dist2(b.x, b.y, pl.x, pl.y) < rr * rr) {
          pl.hurt(b.dmg, this);
          this.spawnParticle(b.x, b.y, 0, 0, 0.3, b.color, 6, "ring");
          b.dead = true;
        }
      }
      for (const p of this.pickups) if (!p.dead) p.update(dt, this);
      for (const p of this.parts) if (!p.dead) p.update(dt);
      for (const d of this.dmgs) if (!d.dead) d.update(dt);
      if (this._bolts) for (const bo of this._bolts) bo.life -= dt;

      // cull
      this.bullets = reclaim(this.bullets, this.bulletPool);
      this.eBullets = reclaim(this.eBullets, this.bulletPool);
      this.pickups = reclaim(this.pickups, this.pickupPool);
      this.parts = reclaim(this.parts, this.particles);
      this.dmgs = reclaim(this.dmgs, this.dmgPool);
      this.enemies = this.enemies.filter((e) => !e.dead);
      if (this._bolts) this._bolts = this._bolts.filter((b) => b.life > 0);

      // camera
      this.cam.x = U.lerp(this.cam.x, this.player.x, 0.12);
      this.cam.y = U.lerp(this.cam.y, this.player.y, 0.12);
      this.shakeAmt *= 0.86;

      // pending level ups -> open menu (pauses)
      if (this._pendingLevels > 0 && this.state === "playing") {
        this._pendingLevels--;
        this.openLevelUp();
      }
    }

    openLevelUp() {
      this.state = "levelup";
      M.audio.fadeMusic(0.3, 0.3);
      M.ui.showLevelUp(this.player, (choice) => {
        if (choice.type === "weapon") this.player.addWeapon(choice.id);
        else if (choice.type === "passive") this.player.addPassive(choice.id);
        else if (choice.type === "evolve") {
          delete this.player.weapons[choice.base];
          this.player.addWeapon(choice.into);
          this.toast("◆ EVOLVED // " + D.WEAPONS[choice.into].name);
          M.audio.sfx.levelup(); this.shake(10);
          this.spawnParticle(this.player.x, this.player.y, 0, 0, 0.6, "#fff", 120, "ring");
        }
        else if (choice.type === "heal") this.player.hp = this.player.maxhp;
        else if (choice.type === "bomb") this.bigBomb();
        else if (choice.type === "bytes") this.runBytes = (this.runBytes || 0) + 200;
        this.state = "playing"; this.lastT = U.now();
        M.audio.fadeMusic(0.55, 0.5);
      });
    }

    /* ---- render ---- */
    render() {
      const ctx = this.ctx, W = this.W, H = this.H;
      ctx.save();
      // background floor
      ctx.fillStyle = this.stage.floor; ctx.fillRect(0, 0, W, H);
      // shake (screen space)
      let sx = 0, sy = 0;
      if (this.shakeAmt > 0.3) { sx = U.rand(-this.shakeAmt, this.shakeAmt); sy = U.rand(-this.shakeAmt, this.shakeAmt); }
      // ZOOM transform: center on player, scale up, then world-translate
      const z = this.zoom || 1.8;
      ctx.translate(W / 2 + sx, H / 2 + sy);
      ctx.scale(z, z);
      ctx.translate(-this.cam.x, -this.cam.y);
      // visible world rect (top-left + size)
      const vx = this.cam.x - this.vw / 2, vy = this.cam.y - this.vh / 2;
      const vw = this.vw, vh = this.vh;

      this.drawBackground(ctx, vx, vy, vw, vh);
      this.drawProps(ctx, vx, vy, vw, vh);

      // pickups (under)
      for (const p of this.pickups) p.draw(ctx, this.time);
      // particles under
      for (const p of this.parts) if (p.kind !== "ring") p.draw(ctx);
      // bolts
      if (this._bolts) for (const bo of this._bolts) {
        const a = bo.life / bo.max;
        ctx.globalAlpha = a; ctx.strokeStyle = bo.color; ctx.lineWidth = 3; ctx.shadowColor = bo.color; ctx.shadowBlur = 12;
        ctx.beginPath(); ctx.moveTo(bo.pts[0][0], bo.pts[0][1]);
        for (const p of bo.pts) ctx.lineTo(p[0], p[1]);
        ctx.stroke(); ctx.shadowBlur = 0; ctx.globalAlpha = 1;
      }
      // enemies
      for (const e of this.enemies) e.draw(ctx, this.time);
      // player
      this.player.draw(ctx, this.time);
      // bullets over
      for (const b of this.bullets) b.draw(ctx);
      for (const b of this.eBullets) b.draw(ctx);
      // ring particles over
      for (const p of this.parts) if (p.kind === "ring") p.draw(ctx);
      // dmg numbers
      for (const d of this.dmgs) d.draw(ctx);

      ctx.restore();
      // vignette
      const vg = ctx.createRadialGradient(W/2, H/2, H*0.35, W/2, H/2, H*0.8);
      vg.addColorStop(0, "rgba(0,0,0,0)"); vg.addColorStop(1, "rgba(0,0,0,.55)");
      ctx.fillStyle = vg; ctx.fillRect(0, 0, W, H);

      M.ui.updateHud(this);
    }
    drawBackground(ctx, vx, vy, vw, vh) {
      const tint = this.stage.tint;
      // 1) ambient floor depth — radial lift toward the player
      const cgx = this.player.x, cgy = this.player.y;
      const amb = ctx.createRadialGradient(cgx, cgy, 0, cgx, cgy, Math.max(vw, vh) * 0.8);
      amb.addColorStop(0, S.hexa(tint, 0.16));
      amb.addColorStop(0.35, S.hexa(tint, 0.05));
      amb.addColorStop(1, "rgba(0,0,0,0)");
      ctx.fillStyle = amb; ctx.fillRect(vx, vy, vw, vh);

      // 2) glowing grid
      const g = 56;
      const x0 = Math.floor(vx / g) * g, y0 = Math.floor(vy / g) * g;
      ctx.lineWidth = 1 / (this.zoom || 1);
      ctx.strokeStyle = S.hexa(tint, 0.10);
      ctx.beginPath();
      for (let x = x0; x < vx + vw + g; x += g) { ctx.moveTo(x, vy); ctx.lineTo(x, vy + vh); }
      for (let y = y0; y < vy + vh + g; y += g) { ctx.moveTo(vx, y); ctx.lineTo(vx + vw, y); }
      ctx.stroke();
      ctx.fillStyle = S.hexa(tint, 0.5);
      for (let x = x0; x < vx + vw + g; x += g)
        for (let y = y0; y < vy + vh + g; y += g) {
          const d = U.dist(x, y, cgx, cgy);
          if (d < 150) { const a = (1 - d / 150) * 0.5; ctx.globalAlpha = a; ctx.fillRect(x - 1, y - 1, 2, 2); }
        }
      ctx.globalAlpha = 1;

      // 3) dense in-world digital rain
      const fs = 18, colW = fs;
      const startCx = Math.floor(vx / colW) * colW;
      ctx.font = `${fs}px monospace`; ctx.textBaseline = "top";
      const GG = "01ｱｶﾝｹﾐﾂｿﾘZ=+";
      for (let cx = startCx; cx < vx + vw + colW; cx += colW) {
        const colSeed = ((cx / colW) * 928371) & 1023;
        const speed = 60 + (colSeed % 90);
        const phase = (colSeed % 400);
        const head = ((this.time * speed + phase * 7) % (vh + 600)) + vy - 300;
        const len = 8 + (colSeed % 14);
        for (let j = 0; j < len; j++) {
          const gy = head - j * fs;
          if (gy < vy - fs || gy > vy + vh) continue;
          const ch = GG[(colSeed + j + ((this.time * 6) | 0)) % GG.length];
          if (j === 0) { ctx.fillStyle = "rgba(215,255,230,0.85)"; ctx.fillText(ch, cx, gy); }
          else { const a = (1 - j / len) * 0.32; ctx.fillStyle = S.hexa(tint, a); ctx.fillText(ch, cx, gy); }
        }
      }
    }

    /* ---- world props: roads, vehicles, trees, servers, buildings ---- */
    drawProps(ctx, vx, vy, vw, vh) {
      const tint = this.stage.tint;
      // ROADS on a fixed world lattice (every 520px). Asphalt + dashed centre line.
      const RD = 520, RW = 64;
      // horizontal roads
      let ry0 = Math.floor((vy - RW) / RD) * RD;
      for (let ry = ry0; ry < vy + vh + RW; ry += RD) {
        ctx.fillStyle = "rgba(4,8,8,0.85)"; ctx.fillRect(vx, ry - RW / 2, vw, RW);
        ctx.strokeStyle = S.hexa(tint, 0.25); ctx.lineWidth = 1;
        ctx.strokeRect(vx, ry - RW / 2, vw, RW);
        ctx.setLineDash([14, 14]); ctx.strokeStyle = S.hexa("#9effc0", 0.35); ctx.lineWidth = 2;
        ctx.beginPath(); ctx.moveTo(vx, ry); ctx.lineTo(vx + vw, ry); ctx.stroke(); ctx.setLineDash([]);
      }
      // vertical roads
      let rx0 = Math.floor((vx - RW) / RD) * RD;
      for (let rx = rx0; rx < vx + vw + RW; rx += RD) {
        ctx.fillStyle = "rgba(4,8,8,0.85)"; ctx.fillRect(rx - RW / 2, vy, RW, vh);
        ctx.setLineDash([14, 14]); ctx.strokeStyle = S.hexa("#9effc0", 0.35); ctx.lineWidth = 2;
        ctx.beginPath(); ctx.moveTo(rx, vy); ctx.lineTo(rx, vy + vh); ctx.stroke(); ctx.setLineDash([]);
      }

      // STATIC PROPS: deterministic per-cell (cell = 260px). Skip cells on roads.
      const C = 260;
      const cx0 = Math.floor(vx / C), cy0 = Math.floor(vy / C);
      const cx1 = Math.floor((vx + vw) / C), cy1 = Math.floor((vy + vh) / C);
      for (let ci = cx0; ci <= cx1; ci++) for (let cj = cy0; cj <= cy1; cj++) {
        const rnd = U.seed(ci * 73856093 ^ cj * 19349663);
        const px = ci * C + 40 + rnd() * (C - 80);
        const py = cj * C + 40 + rnd() * (C - 80);
        // keep props off the roadways
        if (Math.abs(((px % RD) + RD) % RD) < RW || Math.abs(((py % RD) + RD) % RD) < RW) continue;
        const roll = rnd();
        if (roll < 0.30) S.tree(ctx, px, py, 1.1 + rnd() * 0.5, this.time);
        else if (roll < 0.52) S.serverRack(ctx, px, py, 0.9 + rnd() * 0.4, this.time);
        else if (roll < 0.64) S.lamp(ctx, px, py, this.time);
        else if (roll < 0.80) S.building(ctx, px, py, 70 + rnd() * 90, 70 + rnd() * 110, this.time, (ci * 31 + cj) | 1);
        else if (roll < 0.90) S.car(ctx, px, py, 1, rnd() * TAU, this.time); // parked
      }

      // MOVING VEHICLES: stream along the visible roads
      this.drawVehicles(ctx, vx, vy, vw, vh, RD, RW);
    }
    drawVehicles(ctx, vx, vy, vw, vh, RD, RW) {
      const t = this.time;
      // cars on horizontal roads
      let ry0 = Math.floor((vy - RW) / RD) * RD;
      for (let ry = ry0; ry < vy + vh + RW; ry += RD) {
        const isRail = ((((ry / RD) % 3) + 3) % 3) === 0;
        const lane = RW * 0.22;
        if (isRail) {
          // a train streaming right
          const period = vw + 800;
          const headX = vx - 400 + ((t * 150 + (ry * 7)) % period);
          for (let k = 0; k < 6; k++) {
            const cxp = headX - k * 46;
            if (cxp > vx - 60 && cxp < vx + vw + 60) S.trainCar(ctx, cxp, ry, Math.PI / 2, 1, k === 0);
          }
          continue;
        }
        for (let dir of [1, -1]) {
          const speed = 120 + ((ry / RD) % 3) * 30;
          const spacing = 150;
          const yy = ry - dir * lane;
          for (let k = 0; k < Math.ceil(vw / spacing) + 2; k++) {
            let xx = vx - 100 + (((t * speed * dir + k * spacing + ry) % (vw + 200)) + (vw + 200)) % (vw + 200);
            S.car(ctx, xx, yy, 0.95, dir > 0 ? Math.PI / 2 : -Math.PI / 2, t, dir > 0 ? "#0c1016" : "#101418");
          }
        }
      }
      // cars on vertical roads
      let rx0 = Math.floor((vx - RW) / RD) * RD;
      for (let rx = rx0; rx < vx + vw + RW; rx += RD) {
        if (((((rx / RD) % 3) + 3) % 3) === 0) continue; // skip rail columns
        const lane = RW * 0.22;
        for (let dir of [1, -1]) {
          const speed = 120 + ((rx / RD) % 3) * 30;
          const spacing = 150;
          const xx = rx + dir * lane;
          for (let k = 0; k < Math.ceil(vh / spacing) + 2; k++) {
            let yy = vy - 100 + (((t * speed * dir + k * spacing + rx) % (vh + 200)) + (vh + 200)) % (vh + 200);
            S.car(ctx, xx, yy, 0.95, dir > 0 ? Math.PI : 0, t, "#0c1016");
          }
        }
      }
    }

    loop() {
      if (this.state === "idle" || this.state === "dead") { if (this.state === "dead") this.render(); return; }
      const now = U.now();
      let dt = Math.min(0.05, (now - this.lastT) / 1000);
      this.lastT = now;
      if (this.state === "playing") this.update(dt);
      this.render();
      requestAnimationFrame(() => this.loop());
    }
    resumeFromMenu() { if (this.state === "playing") { this.lastT = U.now(); this.loop(); } }
  }

  function reclaim(arr, pool) {
    const out = [];
    for (const o of arr) { if (o.dead) pool.put(o); else out.push(o); }
    return out;
  }

  M.Game = Game;
  M.Player = Player;
})();
