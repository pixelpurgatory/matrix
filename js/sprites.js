/* sprites.js — ALL art is procedural canvas drawing (original, no copyrighted assets).
 * Two tiers:
 *   - in-world animated sprites (compact, glow-lit, walk/idle cycles, ~24-40px)
 *   - menu/gacha PORTRAITS (large, detailed: faces, shades, coats, code aura)
 * Heavy attention paid to silhouette, lighting, accent colour, motion.
 */
(function () {
  const M = (window.M = window.M || {});
  const TAU = Math.PI * 2;

  /* ---------------- primitives ---------------- */
  function glow(ctx, x, y, r, color, a = 1) {
    const g = ctx.createRadialGradient(x, y, 0, x, y, r);
    g.addColorStop(0, hexa(color, 0.9 * a));
    g.addColorStop(0.5, hexa(color, 0.25 * a));
    g.addColorStop(1, hexa(color, 0));
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(x, y, r, 0, TAU);
    ctx.fill();
  }
  function hexa(hex, a) {
    // accepts #rgb/#rrggbb
    let h = hex.replace("#", "");
    if (h.length === 3) h = h.split("").map((c) => c + c).join("");
    const n = parseInt(h, 16);
    return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${a})`;
  }
  function rrect(ctx, x, y, w, h, r) {
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r);
    ctx.arcTo(x, y, x + w, y, r);
    ctx.closePath();
  }
  function lin(ctx, x0, y0, x1, y1, stops) {
    const g = ctx.createLinearGradient(x0, y0, x1, y1);
    stops.forEach((s) => g.addColorStop(s[0], s[1]));
    return g;
  }

  /* ============================================================
   *  IN-WORLD OPERATOR (player) — animated figure
   *  def: {coat, skin, hair, accent, hairStyle, build}
   * ============================================================ */
  function operator(ctx, x, y, r, t, def, facing = 1, moving = false, flash = 0) {
    const s = r / 16; // base scale: figure designed at 16px radius
    ctx.save();
    ctx.translate(x, y);
    ctx.scale(facing, 1);

    const walk = moving ? Math.sin(t * 11) : 0;
    const bob = moving ? Math.abs(Math.sin(t * 11)) * 1.2 * s : Math.sin(t * 2.5) * 0.6 * s;
    const accent = def.accent || "#00ff66";

    // ground shadow + accent rim glow
    ctx.save();
    ctx.scale(1, 0.4);
    glow(ctx, 0, (20 * s) / 0.4, 13 * s, "#000", 0.6);
    ctx.restore();
    glow(ctx, 0, -2 * s - bob, 17 * s, accent, 0.22 + flash * 0.5);

    ctx.translate(0, -bob);
    const lw = 2.2 * s;
    ctx.lineCap = "round";

    // ---- legs (trousers) ----
    ctx.strokeStyle = "#0b0e0c";
    ctx.lineWidth = lw * 1.5;
    leg(ctx, -3.2 * s, 7 * s, walk * 4 * s, s);
    leg(ctx, 3.2 * s, 7 * s, -walk * 4 * s, s);

    // ---- coat tails (flowing trench) ----
    const sway = Math.sin(t * 4) * 1.5 * s + walk * 2 * s;
    ctx.fillStyle = lin(ctx, 0, 0, 0, 18 * s, [[0, def.coat], [1, "#05060a"]]);
    ctx.beginPath();
    ctx.moveTo(-6 * s, 2 * s);
    ctx.quadraticCurveTo(-9 * s + sway, 12 * s, -5 * s + sway, 18 * s);
    ctx.lineTo(5 * s + sway, 18 * s);
    ctx.quadraticCurveTo(9 * s + sway, 12 * s, 6 * s, 2 * s);
    ctx.closePath();
    ctx.fill();

    // ---- torso / coat body ----
    ctx.fillStyle = lin(ctx, -6 * s, 0, 6 * s, 0, [[0, "#05060a"], [0.5, def.coat], [1, "#05060a"]]);
    rrect(ctx, -6 * s, -8 * s, 12 * s, 12 * s, 3 * s);
    ctx.fill();
    // inner shirt V
    ctx.fillStyle = def.shirt || "#0a1f12";
    ctx.beginPath();
    ctx.moveTo(-2.4 * s, -7 * s);
    ctx.lineTo(2.4 * s, -7 * s);
    ctx.lineTo(0, 2 * s);
    ctx.closePath();
    ctx.fill();
    // coat lapel accent lines
    ctx.strokeStyle = hexa(accent, 0.5);
    ctx.lineWidth = 0.8 * s;
    ctx.beginPath();
    ctx.moveTo(-3 * s, -7.5 * s); ctx.lineTo(-0.5 * s, 2 * s);
    ctx.moveTo(3 * s, -7.5 * s); ctx.lineTo(0.5 * s, 2 * s);
    ctx.stroke();

    // ---- arms ----
    ctx.strokeStyle = def.coat;
    ctx.lineWidth = lw * 1.4;
    const armSwing = walk * 3 * s;
    // back arm
    ctx.beginPath();
    ctx.moveTo(-5 * s, -6 * s);
    ctx.quadraticCurveTo(-9 * s, -2 * s, -7 * s + armSwing, 4 * s);
    ctx.stroke();
    // front arm (weapon hand forward)
    ctx.beginPath();
    ctx.moveTo(5 * s, -6 * s);
    ctx.quadraticCurveTo(9 * s, -3 * s, 9 * s - armSwing, 2 * s);
    ctx.stroke();

    // ---- head ----
    const hy = -12 * s;
    ctx.fillStyle = def.skin;
    ctx.beginPath();
    ctx.arc(0, hy, 3.6 * s, 0, TAU);
    ctx.fill();
    // jaw shade
    ctx.fillStyle = hexa("#000", 0.18);
    ctx.beginPath(); ctx.arc(-0.8 * s, hy + 1.2 * s, 3.4 * s, 0.1, Math.PI - 0.1); ctx.fill();
    // hair
    drawHair(ctx, hy, s, def);
    // sunglasses — signature
    ctx.fillStyle = "#000";
    rrect(ctx, -3.4 * s, hy - 0.8 * s, 6.8 * s, 2.4 * s, 1 * s);
    ctx.fill();
    ctx.fillStyle = hexa(accent, 0.85);
    rrect(ctx, -3.0 * s, hy - 0.5 * s, 2.6 * s, 1.6 * s, 0.6 * s); ctx.fill();
    rrect(ctx, 0.4 * s, hy - 0.5 * s, 2.6 * s, 1.6 * s, 0.6 * s); ctx.fill();
    // shades glint
    ctx.strokeStyle = "rgba(255,255,255,.7)"; ctx.lineWidth = 0.5 * s;
    ctx.beginPath(); ctx.moveTo(-2.6 * s, hy - 0.2 * s); ctx.lineTo(-1.6 * s, hy + 0.6 * s); ctx.stroke();

    ctx.restore();
  }
  function leg(ctx, x, y, k, s) {
    ctx.beginPath();
    ctx.moveTo(x, y - 2 * s);
    ctx.quadraticCurveTo(x, y + 4 * s, x + k, y + 9 * s);
    ctx.stroke();
  }
  function drawHair(ctx, hy, s, def) {
    ctx.fillStyle = def.hair;
    switch (def.hairStyle) {
      case "long": // flowing
        ctx.beginPath();
        ctx.moveTo(-3.8 * s, hy - 1 * s);
        ctx.quadraticCurveTo(-5.5 * s, hy + 3 * s, -4 * s, hy + 8 * s);
        ctx.quadraticCurveTo(-2 * s, hy + 5 * s, -3 * s, hy - 2 * s);
        ctx.arc(0, hy, 4 * s, Math.PI, 0);
        ctx.quadraticCurveTo(3 * s, hy + 3 * s, 4 * s, hy + 7 * s);
        ctx.quadraticCurveTo(5 * s, hy + 1 * s, 3.8 * s, hy - 1 * s);
        ctx.fill();
        break;
      case "buzz":
        ctx.beginPath(); ctx.arc(0, hy - 0.5 * s, 3.9 * s, Math.PI + 0.3, -0.3); ctx.fill();
        break;
      case "bob":
        ctx.beginPath();
        ctx.arc(0, hy, 4.3 * s, Math.PI - 0.2, 0.2);
        ctx.lineTo(4 * s, hy + 3 * s); ctx.lineTo(-4 * s, hy + 3 * s); ctx.closePath(); ctx.fill();
        break;
      default: // slick
        ctx.beginPath(); ctx.arc(0, hy - 0.6 * s, 4 * s, Math.PI + 0.2, -0.2);
        ctx.quadraticCurveTo(4.5 * s, hy - 1 * s, 3.5 * s, hy + 1 * s);
        ctx.lineTo(-3.5 * s, hy + 1 * s);
        ctx.quadraticCurveTo(-4.5 * s, hy - 1 * s, 0, hy - 4 * s); ctx.fill();
    }
  }

  /* ============================================================
   *  ENEMIES — each visually distinct + animated
   * ============================================================ */
  function agent(ctx, x, y, r, t, hue = "#11151b", moving = true) {
    const s = r / 16;
    ctx.save();
    ctx.translate(x, y);
    const walk = moving ? Math.sin(t * 9 + x) : 0;
    const bob = Math.abs(Math.sin(t * 9 + x)) * 1.0 * s;
    ctx.save(); ctx.scale(1, 0.4); glow(ctx, 0, 50 * s, 11 * s, "#000", 0.55); ctx.restore();
    ctx.translate(0, -bob);
    ctx.lineCap = "round";
    // legs
    ctx.strokeStyle = "#070809"; ctx.lineWidth = 3 * s;
    leg(ctx, -3 * s, 7 * s, walk * 3 * s, s); leg(ctx, 3 * s, 7 * s, -walk * 3 * s, s);
    // suit body
    ctx.fillStyle = lin(ctx, -6 * s, 0, 6 * s, 0, [[0, "#04060a"], [0.5, hue], [1, "#04060a"]]);
    rrect(ctx, -6 * s, -8 * s, 12 * s, 13 * s, 2.5 * s); ctx.fill();
    // tie + shirt
    ctx.fillStyle = "#cdd6d0";
    ctx.beginPath(); ctx.moveTo(-2 * s, -7 * s); ctx.lineTo(2 * s, -7 * s); ctx.lineTo(0, 0); ctx.closePath(); ctx.fill();
    ctx.fillStyle = "#101a16";
    ctx.beginPath(); ctx.moveTo(-0.9 * s, -6 * s); ctx.lineTo(0.9 * s, -6 * s); ctx.lineTo(0.6 * s, 1 * s); ctx.lineTo(-0.6 * s, 1 * s); ctx.fill();
    // arms
    ctx.strokeStyle = hue; ctx.lineWidth = 3 * s;
    ctx.beginPath(); ctx.moveTo(-5 * s, -6 * s); ctx.quadraticCurveTo(-8 * s, -1 * s, -6 * s - walk * 2 * s, 5 * s); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(5 * s, -6 * s); ctx.quadraticCurveTo(8 * s, -1 * s, 6 * s + walk * 2 * s, 5 * s); ctx.stroke();
    // head + earpiece + shades
    const hy = -12 * s;
    ctx.fillStyle = "#c9a07e"; ctx.beginPath(); ctx.arc(0, hy, 3.6 * s, 0, TAU); ctx.fill();
    ctx.fillStyle = "#1a120a"; // slick hair
    ctx.beginPath(); ctx.arc(0, hy - 0.5 * s, 3.8 * s, Math.PI + 0.25, -0.25); ctx.fill();
    ctx.fillStyle = "#000";
    rrect(ctx, -3.2 * s, hy - 0.6 * s, 6.4 * s, 2.1 * s, 0.8 * s); ctx.fill();
    // earpiece wire
    ctx.strokeStyle = "#2a2a2a"; ctx.lineWidth = 0.7 * s;
    ctx.beginPath(); ctx.moveTo(3.4 * s, hy + 0.5 * s); ctx.quadraticCurveTo(5 * s, hy + 3 * s, 4 * s, -5 * s); ctx.stroke();
    ctx.restore();
  }

  // Sentinel: mechanical squid, red eye, writhing tentacles
  function sentinel(ctx, x, y, r, t, moving = true) {
    const s = r / 16;
    ctx.save();
    ctx.translate(x, y);
    const pulse = 0.7 + 0.3 * Math.sin(t * 6 + x);
    glow(ctx, 0, 0, 16 * s, "#ff2b3a", 0.18 * pulse);
    // tentacles
    ctx.strokeStyle = "#1a1d22"; ctx.lineCap = "round";
    const N = 7;
    for (let i = 0; i < N; i++) {
      const a = (i / N) * TAU + Math.sin(t * 2) * 0.2;
      const wig = Math.sin(t * 7 + i * 1.7) * 3 * s;
      ctx.lineWidth = 2.4 * s;
      ctx.beginPath();
      ctx.moveTo(0, 2 * s);
      const mx = Math.cos(a) * 8 * s, my = Math.sin(a) * 8 * s + 4 * s;
      const ex = Math.cos(a) * 15 * s + wig, ey = Math.sin(a) * 15 * s + 7 * s;
      ctx.quadraticCurveTo(mx, my, ex, ey);
      ctx.stroke();
      // claw tip glint
      ctx.fillStyle = "#3a3f47"; ctx.beginPath(); ctx.arc(ex, ey, 1.1 * s, 0, TAU); ctx.fill();
    }
    // body — segmented metallic head
    const bg = ctx.createRadialGradient(-3 * s, -4 * s, 1, 0, 0, 10 * s);
    bg.addColorStop(0, "#4a525c"); bg.addColorStop(0.6, "#23272e"); bg.addColorStop(1, "#0c0e12");
    ctx.fillStyle = bg;
    ctx.beginPath(); ctx.ellipse(0, 0, 9 * s, 8 * s, 0, 0, TAU); ctx.fill();
    // plating lines
    ctx.strokeStyle = "rgba(0,0,0,.5)"; ctx.lineWidth = 0.8 * s;
    for (let i = -2; i <= 2; i++) { ctx.beginPath(); ctx.arc(0, 0, (i + 3) * 1.6 * s, -0.6, 0.6); ctx.stroke(); }
    // central red eye
    glow(ctx, 0, -1 * s, 5 * s, "#ff2b3a", pulse);
    ctx.fillStyle = "#ff5566";
    ctx.beginPath(); ctx.arc(0, -1 * s, 2.6 * s * pulse, 0, TAU); ctx.fill();
    ctx.fillStyle = "#fff"; ctx.beginPath(); ctx.arc(-0.7 * s, -1.7 * s, 0.8 * s, 0, TAU); ctx.fill();
    ctx.restore();
  }

  // Glitch wraith: corrupted human silhouette that flickers/tears
  function wraith(ctx, x, y, r, t) {
    const s = r / 16;
    ctx.save();
    ctx.translate(x, y);
    const j = (Math.random() - 0.5) * 1.5 * s;
    glow(ctx, 0, -2 * s, 14 * s, "#8a00ff", 0.2);
    ctx.translate(j, 0);
    // torn body
    ctx.fillStyle = "rgba(20,4,30,0.9)";
    ctx.beginPath();
    ctx.moveTo(-5 * s, -8 * s);
    for (let i = 0; i <= 10; i++) {
      const yy = -8 * s + (i / 10) * 16 * s;
      const xx = (i % 2 ? 5 : 4) * s + (Math.random() - 0.5) * 2 * s;
      ctx.lineTo(xx, yy);
    }
    for (let i = 10; i >= 0; i--) {
      const yy = -8 * s + (i / 10) * 16 * s;
      const xx = -((i % 2 ? 5 : 4) * s) + (Math.random() - 0.5) * 2 * s;
      ctx.lineTo(xx, yy);
    }
    ctx.closePath(); ctx.fill();
    // scanline tears
    ctx.fillStyle = "rgba(180,80,255,.5)";
    for (let i = 0; i < 3; i++) {
      const yy = -8 * s + Math.random() * 16 * s;
      ctx.fillRect(-6 * s, yy, 12 * s, 0.8 * s);
    }
    // hollow eyes
    ctx.fillStyle = "#d090ff";
    ctx.fillRect(-2.6 * s, -6 * s, 1.6 * s, 1.2 * s);
    ctx.fillRect(1 * s, -6 * s, 1.6 * s, 1.2 * s);
    ctx.restore();
  }

  // Boss: "The Smith" — massive replicating agent with code aura
  function boss(ctx, x, y, r, t) {
    const s = r / 16;
    ctx.save();
    ctx.translate(x, y);
    const pulse = 0.6 + 0.4 * Math.sin(t * 4);
    glow(ctx, 0, 0, 30 * s, "#00ff66", 0.22 * pulse);
    // afterimage replicas
    for (let k = -1; k <= 1; k++) {
      if (k === 0) continue;
      ctx.globalAlpha = 0.25;
      agent(ctx, k * 10 * s, 0, r * 0.85, t + k, "#0b1014", true);
      ctx.globalAlpha = 1;
    }
    agent(ctx, 0, 0, r, t, "#0a0d10", true);
    // green code aura ring
    ctx.strokeStyle = hexa("#00ff66", 0.5 * pulse);
    ctx.lineWidth = 1.4 * s;
    ctx.beginPath(); ctx.arc(0, -2 * s, 22 * s, 0, TAU); ctx.stroke();
    ctx.restore();
  }

  /* ============================================================
   *  PICKUPS
   * ============================================================ */
  function gem(ctx, x, y, r, t, color = "#00ff66") {
    ctx.save(); ctx.translate(x, y);
    const p = 0.7 + 0.3 * Math.sin(t * 5 + x);
    glow(ctx, 0, 0, r * 2.2, color, 0.5 * p);
    ctx.rotate(t * 1.2);
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.moveTo(0, -r); ctx.lineTo(r * 0.8, 0); ctx.lineTo(0, r); ctx.lineTo(-r * 0.8, 0); ctx.closePath();
    ctx.fill();
    ctx.fillStyle = "rgba(255,255,255,.8)";
    ctx.beginPath(); ctx.moveTo(0, -r); ctx.lineTo(r * 0.8, 0); ctx.lineTo(0, 0); ctx.closePath(); ctx.fill();
    ctx.restore();
  }

  /* ============================================================
   *  PORTRAITS — large, detailed render for menus & gacha.
   *  Draw into ctx filling rect (0,0,w,h). def carries palette/traits.
   * ============================================================ */
  function portrait(ctx, w, h, def, t = 0) {
    ctx.save();
    ctx.clearRect(0, 0, w, h);
    // backdrop: depth gradient + code rain + rim light in accent
    const accent = def.accent || "#00ff66";
    const bg = ctx.createLinearGradient(0, 0, 0, h);
    bg.addColorStop(0, def.bg0 || "#04130a");
    bg.addColorStop(1, "#01040a");
    ctx.fillStyle = bg; ctx.fillRect(0, 0, w, h);
    // faint code columns
    ctx.font = `${Math.round(w * 0.045)}px monospace`;
    ctx.textBaseline = "top";
    const cols = 14;
    for (let i = 0; i < cols; i++) {
      const cx = (i / cols) * w + (Math.sin(i * 9.1) * 0.5 + 0.5) * 6;
      const off = ((t * (20 + (i % 5) * 14) + i * 53) % (h + 80)) - 40;
      for (let j = 0; j < 8; j++) {
        const gy = off - j * w * 0.05;
        ctx.fillStyle = hexa(accent, j === 0 ? 0.5 : Math.max(0, 0.22 - j * 0.03));
        ctx.fillText("01ｱｶﾝｹﾐ"[(i + j) % 7], cx, gy);
      }
    }
    // vignette
    const vg = ctx.createRadialGradient(w / 2, h * 0.42, w * 0.2, w / 2, h * 0.5, w * 0.75);
    vg.addColorStop(0, "rgba(0,0,0,0)"); vg.addColorStop(1, "rgba(0,0,0,.75)");
    ctx.fillStyle = vg; ctx.fillRect(0, 0, w, h);

    // ---- figure: bust portrait, large ----
    const cx = w / 2, cy = h * 0.62, u = w / 22; // unit
    ctx.save();
    ctx.translate(cx, cy + Math.sin(t * 1.6) * u * 0.15);

    // rim glow behind
    glow(ctx, 0, -u * 2, u * 11, accent, 0.3);

    // shoulders / trench coat
    ctx.fillStyle = lin(ctx, -10 * u, 0, 10 * u, 0, [[0, "#05070b"], [0.5, def.coat], [1, "#05070b"]]);
    ctx.beginPath();
    ctx.moveTo(-11 * u, h);
    ctx.lineTo(-9 * u, -1 * u);
    ctx.quadraticCurveTo(-8 * u, -4 * u, -4 * u, -5 * u);
    ctx.lineTo(4 * u, -5 * u);
    ctx.quadraticCurveTo(8 * u, -4 * u, 9 * u, -1 * u);
    ctx.lineTo(11 * u, h);
    ctx.closePath(); ctx.fill();
    // collar
    ctx.fillStyle = "#05070b";
    ctx.beginPath();
    ctx.moveTo(-4 * u, -5 * u); ctx.lineTo(-1.5 * u, -1 * u); ctx.lineTo(0, -3 * u);
    ctx.lineTo(1.5 * u, -1 * u); ctx.lineTo(4 * u, -5 * u); ctx.closePath(); ctx.fill();
    // chest accent line glow
    ctx.strokeStyle = hexa(accent, 0.6); ctx.lineWidth = u * 0.25;
    ctx.beginPath(); ctx.moveTo(-3 * u, -4 * u); ctx.lineTo(-1 * u, 2 * u);
    ctx.moveTo(3 * u, -4 * u); ctx.lineTo(1 * u, 2 * u); ctx.stroke();

    // neck
    ctx.fillStyle = def.skin;
    ctx.fillRect(-1.7 * u, -8 * u, 3.4 * u, 4 * u);
    ctx.fillStyle = hexa("#000", 0.25);
    ctx.fillRect(-1.7 * u, -5 * u, 3.4 * u, 1.2 * u);

    // head shape
    ctx.fillStyle = def.skin;
    ctx.beginPath();
    ctx.moveTo(-3.4 * u, -11 * u);
    ctx.quadraticCurveTo(-3.7 * u, -7.5 * u, -2.4 * u, -6 * u);
    ctx.quadraticCurveTo(0, -4.6 * u, 2.4 * u, -6 * u);
    ctx.quadraticCurveTo(3.7 * u, -7.5 * u, 3.4 * u, -11 * u);
    ctx.quadraticCurveTo(3 * u, -14.5 * u, 0, -14.7 * u);
    ctx.quadraticCurveTo(-3 * u, -14.5 * u, -3.4 * u, -11 * u);
    ctx.fill();
    // cheek/jaw shading
    ctx.fillStyle = hexa("#000", 0.16);
    ctx.beginPath(); ctx.moveTo(2.4 * u, -11 * u); ctx.quadraticCurveTo(3.4 * u, -8 * u, 2.2 * u, -6 * u);
    ctx.lineTo(1.4 * u, -7 * u); ctx.closePath(); ctx.fill();
    // lips
    ctx.strokeStyle = def.lips || "#7a2230"; ctx.lineWidth = u * 0.5; ctx.lineCap = "round";
    ctx.beginPath(); ctx.moveTo(-1 * u, -6.6 * u); ctx.quadraticCurveTo(0, -6.2 * u, 1 * u, -6.6 * u); ctx.stroke();
    // nose hint
    ctx.strokeStyle = hexa("#000", 0.2); ctx.lineWidth = u * 0.3;
    ctx.beginPath(); ctx.moveTo(0, -9 * u); ctx.lineTo(-0.4 * u, -7.6 * u); ctx.stroke();

    // hair (large detailed)
    portraitHair(ctx, u, def);

    // sunglasses — sleek, reflective, signature
    ctx.fillStyle = "#05060a";
    rrect(ctx, -3.3 * u, -10 * u, 6.6 * u, 2.6 * u, 1.1 * u); ctx.fill();
    // bridge
    ctx.fillRect(-0.5 * u, -9.4 * u, 1 * u, 0.7 * u);
    // lens tint + scrolling code reflection
    [[-3.0, -1], [0.4, 1]].forEach(([lx]) => {
      ctx.save();
      rrect(ctx, lx * u, -9.7 * u, 2.6 * u, 1.9 * u, 0.7 * u); ctx.clip();
      const lg = ctx.createLinearGradient(lx * u, -9.7 * u, lx * u + 2.6 * u, -7.8 * u);
      lg.addColorStop(0, hexa(accent, 0.55)); lg.addColorStop(1, "#020403");
      ctx.fillStyle = lg; ctx.fillRect(lx * u, -9.7 * u, 2.6 * u, 1.9 * u);
      ctx.fillStyle = hexa(accent, 0.9); ctx.font = `${u}px monospace`;
      const o = (t * 18) % (u * 3);
      ctx.fillText("101", lx * u + 0.2 * u, -9.6 * u + o - u * 1.5);
      ctx.fillText("010", lx * u + 0.2 * u, -9.6 * u + o);
      ctx.restore();
      // glint
      ctx.strokeStyle = "rgba(255,255,255,.75)"; ctx.lineWidth = u * 0.18;
      ctx.beginPath(); ctx.moveTo(lx * u + 0.4 * u, -9.2 * u); ctx.lineTo(lx * u + 1.2 * u, -8.2 * u); ctx.stroke();
    });

    ctx.restore();
    // rarity-tinted outer frame light
    const fr = ctx.createLinearGradient(0, 0, 0, h);
    fr.addColorStop(0, hexa(accent, 0.0)); fr.addColorStop(1, hexa(accent, 0.08));
    ctx.fillStyle = fr; ctx.fillRect(0, 0, w, h);
    ctx.restore();
  }
  function portraitHair(ctx, u, def) {
    ctx.fillStyle = def.hair;
    switch (def.hairStyle) {
      case "long":
        ctx.beginPath();
        ctx.moveTo(-3.4 * u, -11 * u);
        ctx.quadraticCurveTo(-6 * u, -10 * u, -5.5 * u, -3 * u);
        ctx.quadraticCurveTo(-5 * u, 3 * u, -3 * u, 5 * u);
        ctx.lineTo(-2.2 * u, 2 * u);
        ctx.quadraticCurveTo(-3.2 * u, -6 * u, -2.6 * u, -10 * u);
        ctx.quadraticCurveTo(0, -15.6 * u, 2.6 * u, -10 * u);
        ctx.quadraticCurveTo(3.2 * u, -6 * u, 2.2 * u, 2 * u);
        ctx.lineTo(3 * u, 5 * u);
        ctx.quadraticCurveTo(5 * u, 3 * u, 5.5 * u, -3 * u);
        ctx.quadraticCurveTo(6 * u, -10 * u, 3.4 * u, -11 * u);
        ctx.quadraticCurveTo(2.5 * u, -14.8 * u, 0, -15 * u);
        ctx.quadraticCurveTo(-2.5 * u, -14.8 * u, -3.4 * u, -11 * u);
        ctx.fill();
        // strand highlights
        ctx.strokeStyle = hexa(def.hairHi || "#ffffff", 0.25); ctx.lineWidth = u * 0.25;
        for (let i = -2; i <= 2; i++) { ctx.beginPath(); ctx.moveTo(i * u, -13 * u); ctx.quadraticCurveTo(i * u * 1.6 - 4 * u, -4 * u, i * u * 1.3 - 3 * u, 3 * u); ctx.stroke(); }
        break;
      case "buzz":
        ctx.beginPath(); ctx.moveTo(-3.4 * u, -11 * u);
        ctx.quadraticCurveTo(0, -15.4 * u, 3.4 * u, -11 * u);
        ctx.quadraticCurveTo(2.6 * u, -12.6 * u, 0, -12.8 * u);
        ctx.quadraticCurveTo(-2.6 * u, -12.6 * u, -3.4 * u, -11 * u); ctx.fill();
        break;
      case "bob":
        ctx.beginPath(); ctx.moveTo(-3.6 * u, -11 * u);
        ctx.quadraticCurveTo(-4.4 * u, -6 * u, -3.6 * u, -5 * u);
        ctx.lineTo(-2.4 * u, -6.5 * u);
        ctx.quadraticCurveTo(-3 * u, -10 * u, 0, -15 * u);
        ctx.quadraticCurveTo(3 * u, -10 * u, 2.4 * u, -6.5 * u);
        ctx.lineTo(3.6 * u, -5 * u);
        ctx.quadraticCurveTo(4.4 * u, -6 * u, 3.6 * u, -11 * u);
        ctx.quadraticCurveTo(2.6 * u, -14.6 * u, 0, -14.8 * u);
        ctx.quadraticCurveTo(-2.6 * u, -14.6 * u, -3.6 * u, -11 * u); ctx.fill();
        break;
      default: // slick back
        ctx.beginPath(); ctx.moveTo(-3.5 * u, -10.5 * u);
        ctx.quadraticCurveTo(-4 * u, -14 * u, 0, -15.2 * u);
        ctx.quadraticCurveTo(4 * u, -14 * u, 3.5 * u, -10.5 * u);
        ctx.quadraticCurveTo(2 * u, -13 * u, 0, -13 * u);
        ctx.quadraticCurveTo(-2 * u, -13 * u, -3.5 * u, -10.5 * u); ctx.fill();
    }
  }

  /* ---- extra BOSS variants ---- */
  function bossSentinel(ctx, x, y, r, t) {
    const s = r / 16;
    ctx.save(); ctx.translate(x, y);
    const pulse = 0.6 + 0.4 * Math.sin(t * 5);
    glow(ctx, 0, 0, 40 * s, "#ff2b3a", 0.22 * pulse);
    // many writhing tentacles
    ctx.strokeStyle = "#15171c"; ctx.lineCap = "round";
    const N = 12;
    for (let i = 0; i < N; i++) {
      const a = (i / N) * TAU + Math.sin(t * 1.5) * 0.25;
      const wig = Math.sin(t * 6 + i * 1.3) * 5 * s;
      ctx.lineWidth = 3.4 * s;
      ctx.beginPath(); ctx.moveTo(0, 0);
      ctx.quadraticCurveTo(Math.cos(a) * 13 * s, Math.sin(a) * 13 * s, Math.cos(a) * 26 * s + wig, Math.sin(a) * 26 * s + wig);
      ctx.stroke();
      ctx.fillStyle = "#ff4455"; ctx.globalAlpha = 0.8;
      ctx.beginPath(); ctx.arc(Math.cos(a) * 26 * s + wig, Math.sin(a) * 26 * s + wig, 1.6 * s, 0, TAU); ctx.fill();
      ctx.globalAlpha = 1;
    }
    // armoured core
    const bg = ctx.createRadialGradient(-4 * s, -5 * s, 1, 0, 0, 16 * s);
    bg.addColorStop(0, "#5a626c"); bg.addColorStop(0.55, "#262b32"); bg.addColorStop(1, "#0a0c10");
    ctx.fillStyle = bg; ctx.beginPath(); ctx.ellipse(0, 0, 15 * s, 13 * s, 0, 0, TAU); ctx.fill();
    ctx.strokeStyle = "rgba(0,0,0,.6)"; ctx.lineWidth = 1 * s;
    for (let i = 1; i <= 4; i++) { ctx.beginPath(); ctx.arc(0, 0, i * 2.6 * s, -0.7, 0.7); ctx.stroke(); }
    // cluster of eyes
    for (const [ex, ey, er] of [[0, -2, 4], [-6, 2, 2.4], [6, 2, 2.4], [0, 6, 2]]) {
      glow(ctx, ex * s, ey * s, er * 2 * s, "#ff2b3a", pulse);
      ctx.fillStyle = "#ff6677"; ctx.beginPath(); ctx.arc(ex * s, ey * s, er * s * pulse, 0, TAU); ctx.fill();
      ctx.fillStyle = "#fff"; ctx.beginPath(); ctx.arc(ex * s - 0.6 * s, ey * s - 0.6 * s, er * 0.3 * s, 0, TAU); ctx.fill();
    }
    ctx.restore();
  }
  function bossTwin(ctx, x, y, r, t) {
    const s = r / 16;
    ctx.save(); ctx.translate(x, y);
    glow(ctx, 0, 0, 30 * s, "#c9b8ff", 0.25 * (0.6 + 0.4 * Math.sin(t * 4)));
    // two ghost-agents flanking, phasing in/out
    for (const k of [-1, 1]) {
      ctx.save();
      ctx.globalAlpha = 0.55 + 0.35 * Math.sin(t * 3 + k);
      ctx.translate(k * 9 * s, 0);
      // pale suit
      ctx.fillStyle = lin(ctx, -6 * s, 0, 6 * s, 0, [[0, "#1a1726"], [0.5, "#d8d2e8"], [1, "#1a1726"]]);
      rrect(ctx, -6 * s, -8 * s, 12 * s, 14 * s, 3 * s); ctx.fill();
      // glitch tears
      ctx.fillStyle = "rgba(201,184,255,.6)";
      for (let i = 0; i < 3; i++) ctx.fillRect(-6 * s, (-8 + Math.random() * 16) * s, 12 * s, 0.8 * s);
      // head + shades
      ctx.fillStyle = "#e8e0f0"; ctx.beginPath(); ctx.arc(0, -12 * s, 3.6 * s, 0, TAU); ctx.fill();
      ctx.fillStyle = "#c9b8ff"; ctx.beginPath(); ctx.arc(0, -13 * s, 3.8 * s, Math.PI + 0.3, -0.3); ctx.fill(); // silver hair
      ctx.fillStyle = "#000"; rrect(ctx, -3.2 * s, -12.6 * s, 6.4 * s, 2 * s, 0.8 * s); ctx.fill();
      ctx.restore();
    }
    ctx.restore();
  }

  /* ============================================================
   *  WORLD PROPS (top-down) — drawn behind entities in-game
   * ============================================================ */
  function tree(ctx, x, y, sc, t) {
    ctx.save(); ctx.translate(x, y);
    const sway = Math.sin(t * 1.5 + x) * 1.5;
    ctx.save(); ctx.scale(1, 0.5); glow(ctx, 0, 6 * sc / 0.5, 13 * sc, "#000", 0.5); ctx.restore();
    // trunk
    ctx.fillStyle = "#0a0d0a"; ctx.fillRect(-1.5 * sc, -2 * sc, 3 * sc, 8 * sc);
    // canopy: layered dark-green blobs
    const layers = [["#06160a", 13], ["#0a2a12", 10], ["#0e3a18", 6.5]];
    for (const [col, rad] of layers) {
      ctx.fillStyle = col;
      ctx.beginPath(); ctx.arc(sway, -6 * sc, rad * sc, 0, TAU); ctx.fill();
    }
    // rim light + code speckle
    ctx.strokeStyle = hexa("#00ff66", 0.25); ctx.lineWidth = 1;
    ctx.beginPath(); ctx.arc(sway, -6 * sc, 13 * sc, Math.PI * 1.1, Math.PI * 1.7); ctx.stroke();
    ctx.fillStyle = hexa("#00ff66", 0.4); ctx.font = `${5 * sc}px monospace`;
    for (let i = 0; i < 4; i++) ctx.fillText("01"[(i) % 2], sway + Math.sin(i * 2 + t) * 8 * sc, -6 * sc + Math.cos(i * 3) * 7 * sc);
    ctx.restore();
  }
  function car(ctx, x, y, sc, ang, t, tint = "#0c1016") {
    ctx.save(); ctx.translate(x, y); ctx.rotate(ang);
    ctx.save(); ctx.scale(1, 0.7); glow(ctx, 0, 4 * sc / 0.7, 11 * sc, "#000", 0.5); ctx.restore();
    // body
    ctx.fillStyle = lin(ctx, 0, -7 * sc, 0, 7 * sc, [[0, "#1a2028"], [0.5, tint], [1, "#05070a"]]);
    rrect(ctx, -6 * sc, -11 * sc, 12 * sc, 22 * sc, 3.5 * sc); ctx.fill();
    // cabin / glass with green code reflection
    ctx.fillStyle = hexa("#00ff66", 0.18); rrect(ctx, -4.5 * sc, -5 * sc, 9 * sc, 9 * sc, 2 * sc); ctx.fill();
    ctx.strokeStyle = "rgba(0,0,0,.5)"; ctx.lineWidth = 0.8 * sc; ctx.stroke();
    // headlights (front = +y)
    glow(ctx, -3.5 * sc, 11 * sc, 6 * sc, "#eaffff", 0.5); glow(ctx, 3.5 * sc, 11 * sc, 6 * sc, "#eaffff", 0.5);
    ctx.fillStyle = "#dffcff"; ctx.fillRect(-4.5 * sc, 10 * sc, 2 * sc, 1.6 * sc); ctx.fillRect(2.5 * sc, 10 * sc, 2 * sc, 1.6 * sc);
    // taillights (rear)
    ctx.fillStyle = "#ff2b4d"; ctx.fillRect(-4.5 * sc, -11.4 * sc, 2 * sc, 1.4 * sc); ctx.fillRect(2.5 * sc, -11.4 * sc, 2 * sc, 1.4 * sc);
    glow(ctx, 0, -11 * sc, 5 * sc, "#ff2b4d", 0.25);
    ctx.restore();
  }
  function serverRack(ctx, x, y, sc, t) {
    ctx.save(); ctx.translate(x, y);
    ctx.save(); ctx.scale(1, 0.6); glow(ctx, 0, 10 * sc / 0.6, 12 * sc, "#000", 0.5); ctx.restore();
    // cabinet
    ctx.fillStyle = "#0c1410"; rrect(ctx, -8 * sc, -12 * sc, 16 * sc, 22 * sc, 1.5 * sc); ctx.fill();
    ctx.strokeStyle = "#06ff7a"; ctx.lineWidth = 0.6 * sc; ctx.globalAlpha = 0.5; ctx.stroke(); ctx.globalAlpha = 1;
    // blinking LED rows
    for (let r2 = 0; r2 < 7; r2++) {
      for (let c = 0; c < 4; c++) {
        const on = ((Math.sin(t * 6 + r2 * 1.7 + c * 0.9) > 0.2) ? 1 : 0);
        ctx.fillStyle = on ? "#00ff66" : "#063a1c";
        if (on) { ctx.shadowColor = "#00ff66"; ctx.shadowBlur = 6 * sc; }
        ctx.fillRect(-6.5 * sc + c * 3.3 * sc, -10 * sc + r2 * 2.7 * sc, 2.2 * sc, 1.4 * sc);
        ctx.shadowBlur = 0;
      }
    }
    ctx.restore();
  }
  function building(ctx, x, y, w, h, t, seed = 1) {
    const rnd = M.util.seed(seed * 9301 + 49297);
    ctx.save(); ctx.translate(x, y);
    // footprint shadow + body
    ctx.fillStyle = "rgba(0,0,0,.5)"; rrect(ctx, -w / 2 + 4, -h / 2 + 4, w, h, 4); ctx.fill();
    ctx.fillStyle = "#070b0d"; rrect(ctx, -w / 2, -h / 2, w, h, 4); ctx.fill();
    // emissive edge
    ctx.strokeStyle = hexa("#00ff66", 0.3); ctx.lineWidth = 1.5; ctx.stroke();
    // rooftop windows/skylights lit
    const cols = Math.max(2, (w / 14) | 0), rows = Math.max(2, (h / 14) | 0);
    for (let i = 0; i < cols; i++) for (let j = 0; j < rows; j++) {
      if (rnd() > 0.55) continue;
      const wx = -w / 2 + 6 + i * ((w - 12) / cols);
      const wy = -h / 2 + 6 + j * ((h - 12) / rows);
      const fl = 0.3 + 0.7 * (Math.sin(t * 2 + i * 3 + j) > 0.6 ? 1 : 0.4);
      ctx.fillStyle = hexa("#00ff66", 0.25 + 0.4 * fl);
      ctx.fillRect(wx, wy, (w - 12) / cols - 3, (h - 12) / rows - 3);
    }
    // rooftop AC units
    ctx.fillStyle = "#10161a"; ctx.fillRect(-w / 4, -h / 6, w / 6, h / 6); ctx.fillRect(w / 8, h / 8, w / 8, h / 8);
    ctx.restore();
  }
  function lamp(ctx, x, y, t) {
    ctx.save(); ctx.translate(x, y);
    glow(ctx, 0, 0, 22, "#9effc0", 0.18 + 0.05 * Math.sin(t * 4 + x));
    ctx.fillStyle = "#0a0d0a"; ctx.fillRect(-1, -10, 2, 12);
    ctx.fillStyle = "#bfffd8"; ctx.beginPath(); ctx.arc(0, -10, 2.2, 0, TAU); ctx.fill();
    ctx.restore();
  }
  function trainCar(ctx, x, y, ang, sc, lead) {
    ctx.save(); ctx.translate(x, y); ctx.rotate(ang);
    glow(ctx, 0, 0, 26 * sc, "#000", 0.4);
    ctx.fillStyle = lin(ctx, -10 * sc, 0, 10 * sc, 0, [[0, "#0a1016"], [0.5, "#243038"], [1, "#0a1016"]]);
    rrect(ctx, -9 * sc, -22 * sc, 18 * sc, 44 * sc, lead ? 8 * sc : 3 * sc); ctx.fill();
    ctx.strokeStyle = hexa("#39e7ff", 0.4); ctx.lineWidth = 1; ctx.stroke();
    // windows glowing
    ctx.fillStyle = hexa("#bfeaff", 0.5);
    for (let i = 0; i < 5; i++) { ctx.fillRect(-6 * sc, -18 * sc + i * 8 * sc, 4.5 * sc, 4 * sc); ctx.fillRect(1.5 * sc, -18 * sc + i * 8 * sc, 4.5 * sc, 4 * sc); }
    if (lead) { glow(ctx, 0, 22 * sc, 14 * sc, "#eaffff", 0.6); }
    ctx.restore();
  }

  /* ============================================================
   *  MENU CITYSCAPE — side-view Matrix New York skyline
   * ============================================================ */
  function cityscape(ctx, w, h, t) {
    ctx.clearRect(0, 0, w, h);
    // sky: deep green-black with subtle aurora
    const sky = ctx.createLinearGradient(0, 0, 0, h);
    sky.addColorStop(0, "#02110a"); sky.addColorStop(0.5, "#041a0e"); sky.addColorStop(1, "#010604");
    ctx.fillStyle = sky; ctx.fillRect(0, 0, w, h);
    const aur = ctx.createRadialGradient(w * 0.5, h * 0.35, 10, w * 0.5, h * 0.35, w * 0.7);
    aur.addColorStop(0, "rgba(0,255,102,0.10)"); aur.addColorStop(1, "rgba(0,0,0,0)");
    ctx.fillStyle = aur; ctx.fillRect(0, 0, w, h);
    // code rain (background)
    ctx.font = `${Math.round(w * 0.022)}px monospace`; ctx.textBaseline = "top";
    const cols = 40;
    for (let i = 0; i < cols; i++) {
      const cx = (i / cols) * w;
      const off = ((t * (30 + (i % 6) * 18) + i * 61) % (h + 120)) - 60;
      for (let j = 0; j < 6; j++) {
        ctx.fillStyle = hexa("#00ff66", j === 0 ? 0.35 : Math.max(0, 0.16 - j * 0.025));
        ctx.fillText("01ｱｹﾐ"[(i + j) % 4], cx, off - j * w * 0.025);
      }
    }
    // three skyline layers (far -> near), each a row of buildings with lit windows
    // horizon glow so towers read as silhouettes against it
    const hz = ctx.createLinearGradient(0, h * 0.38, 0, h);
    hz.addColorStop(0, "rgba(0,0,0,0)"); hz.addColorStop(0.55, "rgba(0,90,40,0.18)"); hz.addColorStop(1, "rgba(0,30,14,0.05)");
    ctx.fillStyle = hz; ctx.fillRect(0, h * 0.38, w, h * 0.62);
    const layers = [
      { base: h * 0.60, hmin: 0.16, hmax: 0.38, wmin: 0.045, wmax: 0.09, col: "#06170d", alpha: 0.6, win: 0.22, step: 0.085 },
      { base: h * 0.80, hmin: 0.28, hmax: 0.58, wmin: 0.055, wmax: 0.11, col: "#030c07", alpha: 0.92, win: 0.34, step: 0.1 },
      { base: h * 1.02, hmin: 0.40, hmax: 0.78, wmin: 0.075, wmax: 0.14, col: "#010704", alpha: 1, win: 0.5, step: 0.13 },
    ];
    layers.forEach((L, li) => {
      let x = -0.05;
      const rnd = M.util.seed(1000 + li * 77);
      while (x < 1.05) {
        const bw = (L.wmin + rnd() * (L.wmax - L.wmin)) * w;
        const bh = (L.hmin + rnd() * (L.hmax - L.hmin)) * h;
        const bx = x * w;
        const by = L.base - bh;
        ctx.fillStyle = L.col; ctx.globalAlpha = L.alpha;
        ctx.fillRect(bx, by, bw, bh + 40);
        // antenna on tall ones
        if (bh > L.hmax * h * 0.85) { ctx.fillRect(bx + bw / 2 - 1, by - 14, 2, 14); ctx.fillStyle = "#ff3344"; ctx.fillRect(bx + bw / 2 - 1.5, by - 16, 3, 3); }
        // window grid
        ctx.globalAlpha = 1;
        const wc = Math.max(3, (bw / (w * 0.018)) | 0), wr = Math.max(4, (bh / (h * 0.03)) | 0);
        for (let i = 0; i < wc; i++) for (let j = 0; j < wr; j++) {
          if (rnd() > L.win) continue;
          const flick = Math.sin(t * 1.5 + i * 2.3 + j * 1.1 + li) > 0.5 ? 1 : 0.45;
          ctx.fillStyle = hexa("#00ff66", 0.12 + 0.5 * flick * L.alpha);
          const ww = bw / wc, wh2 = bh / wr;
          ctx.fillRect(bx + i * ww + ww * 0.2, by + j * wh2 + wh2 * 0.2, ww * 0.55, wh2 * 0.5);
        }
        ctx.strokeStyle = hexa("#00ff66", 0.12 * L.alpha); ctx.lineWidth = 1; ctx.strokeRect(bx, by, bw, bh);
        x += L.wmin + rnd() * (L.wmax - L.wmin) + 0.004;
      }
      ctx.globalAlpha = 1;
    });
    // ground fog
    const fog = ctx.createLinearGradient(0, h * 0.7, 0, h);
    fog.addColorStop(0, "rgba(0,0,0,0)"); fog.addColorStop(1, "rgba(0,40,16,0.4)");
    ctx.fillStyle = fog; ctx.fillRect(0, h * 0.7, w, h * 0.3);
    // vignette
    const vg = ctx.createRadialGradient(w / 2, h * 0.45, w * 0.25, w / 2, h * 0.5, w * 0.85);
    vg.addColorStop(0, "rgba(0,0,0,0)"); vg.addColorStop(1, "rgba(0,0,0,.7)");
    ctx.fillStyle = vg; ctx.fillRect(0, 0, w, h);
  }

  /* ============================================================
   *  LOGIN HERO — full-body operator on a neon podium (daily screen)
   *  Original procedural figure: trench coat, magenta shades, code aura.
   * ============================================================ */
  function loginHero(ctx, w, h, def, t) {
    ctx.clearRect(0, 0, w, h);
    const accent = def.accent || "#00ff66";
    const neon = "#ff3df0"; // magenta key light to echo the brief
    // backdrop
    const bg = ctx.createLinearGradient(0, 0, 0, h);
    bg.addColorStop(0, "#03110a"); bg.addColorStop(0.6, "#04140c"); bg.addColorStop(1, "#01060a");
    ctx.fillStyle = bg; ctx.fillRect(0, 0, w, h);
    // code rain
    ctx.font = `${Math.round(w * 0.03)}px monospace`; ctx.textBaseline = "top";
    for (let i = 0; i < 22; i++) {
      const cx = (i / 22) * w;
      const off = ((t * (26 + (i % 5) * 16) + i * 57) % (h + 100)) - 50;
      for (let j = 0; j < 7; j++) {
        ctx.fillStyle = hexa("#00ff66", j === 0 ? 0.4 : Math.max(0, 0.16 - j * 0.022));
        ctx.fillText("01ｱｹﾐ"[(i + j) % 4], cx, off - j * w * 0.03);
      }
    }
    // big key glow behind hero
    const cx = w * 0.5, cy = h * 0.56;
    glow(ctx, cx, cy - h * 0.05, w * 0.5, neon, 0.22);
    glow(ctx, cx, cy, w * 0.42, accent, 0.16);

    // podium rings
    ctx.save();
    ctx.translate(cx, h * 0.84);
    for (let k = 0; k < 3; k++) {
      const rr = w * (0.16 + k * 0.08);
      const pulse = 0.5 + 0.5 * Math.sin(t * 2 - k);
      ctx.strokeStyle = hexa(accent, (0.5 - k * 0.13) * (0.6 + 0.4 * pulse));
      ctx.lineWidth = 2 - k * 0.4;
      ctx.beginPath(); ctx.ellipse(0, 0, rr, rr * 0.3, 0, 0, TAU); ctx.stroke();
    }
    glow(ctx, 0, 0, w * 0.22, accent, 0.18);
    ctx.restore();

    // ---- the figure (large, fills the frame) ----
    const s = h / 430; // bigger => more presence
    const sway = Math.sin(t * 1.4) * 2.5 * s;
    ctx.save();
    ctx.translate(cx + sway, h * 0.5);
    drawHeroFigure(ctx, s, t, def, neon, accent);
    ctx.restore();

    // foreground floor light bloom
    const fl = ctx.createRadialGradient(cx, h * 0.84, 4, cx, h * 0.84, w * 0.4);
    fl.addColorStop(0, hexa(accent, 0.12)); fl.addColorStop(1, "rgba(0,0,0,0)");
    ctx.fillStyle = fl; ctx.fillRect(0, h * 0.66, w, h * 0.34);
  }
  // filled tapered segment along A -> control M -> B, width wa..wb
  function segFill(ctx, ax, ay, mx, my, bx, by, wa, wb) {
    const ang = Math.atan2(by - ay, bx - ax);
    const nx = Math.sin(ang), ny = -Math.cos(ang);
    const wm = (wa + wb) / 2;
    ctx.beginPath();
    ctx.moveTo(ax + nx * wa, ay + ny * wa);
    ctx.quadraticCurveTo(mx + nx * wm, my + ny * wm, bx + nx * wb, by + ny * wb);
    ctx.arc(bx, by, wb, ang - Math.PI / 2, ang + Math.PI / 2);
    ctx.quadraticCurveTo(mx - nx * wm, my - ny * wm, ax - nx * wa, ay - ny * wa);
    ctx.closePath();
  }

  function drawHeroFigure(ctx, s, t, def, neon, accent) {
    const u = 30 * s;
    const skin = def.skin || "#e6c6a6";
    const COAT0 = "#0a0e14", COAT1 = "#161b25";
    ctx.lineJoin = "round"; ctx.lineCap = "round";
    glow(ctx, 0, -1.0 * u, 4.4 * u, neon, 0.16);

    // ===== BACK: billowing trench cape =====
    const bil = Math.sin(t * 1.5) * 0.3 * u;
    ctx.fillStyle = lin(ctx, -2.6 * u, 0, 2.6 * u, 0, [[0, "#05070b"], [0.5, "#0c0f16"], [1, "#05070b"]]);
    ctx.beginPath();
    ctx.moveTo(-1.25 * u, -1.95 * u);
    ctx.quadraticCurveTo(-2.9 * u - bil, 0.8 * u, -2.2 * u - bil, 3.7 * u);
    ctx.quadraticCurveTo(-1.0 * u, 3.0 * u, -0.5 * u, 1.4 * u);
    ctx.lineTo(0.5 * u, 1.4 * u);
    ctx.quadraticCurveTo(1.0 * u, 3.0 * u, 2.2 * u + bil, 3.7 * u);
    ctx.quadraticCurveTo(2.9 * u + bil, 0.8 * u, 1.25 * u, -1.95 * u);
    ctx.closePath(); ctx.fill();
    ctx.strokeStyle = hexa(accent, 0.28); ctx.lineWidth = 1.4 * s; ctx.stroke();

    // ===== LEGS: contrapposto stance, thigh-high boots =====
    const stance = [[-1, 0.32, 1.0], [1, 0.62, 1.0]]; // [side, kneeOut, len]
    for (const [side, kx] of stance) {
      // thigh (skin) then boot (dark) over lower leg
      ctx.fillStyle = skin;
      segFill(ctx, side * 0.42 * u, 0.35 * u, side * (0.4 + kx) * u, 1.5 * u, side * (0.3 + kx) * u, 2.0 * u, 0.34 * u, 0.28 * u); ctx.fill();
      // boot
      ctx.fillStyle = lin(ctx, side * 0.4 * u, 1.6 * u, side * 0.9 * u, 3.7 * u, [[0, "#1b1f27"], [1, "#05070b"]]);
      segFill(ctx, side * (0.42 + kx * 0.6) * u, 1.55 * u, side * (0.45 + kx) * u, 2.7 * u, side * (0.42 + kx) * u, 3.7 * u, 0.34 * u, 0.26 * u); ctx.fill();
      // boot sheen + neon top band
      ctx.strokeStyle = "rgba(120,140,160,.4)"; ctx.lineWidth = 0.06 * u;
      ctx.beginPath(); ctx.moveTo(side * (0.3 + kx * 0.6) * u, 1.9 * u); ctx.quadraticCurveTo(side * (0.34 + kx) * u, 2.7 * u, side * (0.32 + kx) * u, 3.5 * u); ctx.stroke();
      ctx.strokeStyle = neon; ctx.lineWidth = 0.12 * u; ctx.shadowColor = neon; ctx.shadowBlur = 9 * s;
      ctx.beginPath(); ctx.moveTo(side * (0.18 + kx * 0.6) * u, 1.62 * u); ctx.lineTo(side * (0.66 + kx * 0.6) * u, 1.62 * u); ctx.stroke();
      ctx.shadowBlur = 0;
    }

    // ===== HIPS / bodysuit lower =====
    ctx.fillStyle = lin(ctx, 0, 0, 0, 1 * u, [[0, "#10131a"], [1, "#06080d"]]);
    ctx.beginPath();
    ctx.moveTo(-0.7 * u, -0.1 * u);
    ctx.quadraticCurveTo(-0.85 * u, 0.5 * u, -0.45 * u, 0.7 * u);
    ctx.quadraticCurveTo(0, 0.85 * u, 0.45 * u, 0.7 * u);
    ctx.quadraticCurveTo(0.85 * u, 0.5 * u, 0.7 * u, -0.1 * u);
    ctx.closePath(); ctx.fill();

    // ===== TORSO: hourglass bodysuit =====
    const torso = lin(ctx, 0, -1.95 * u, 0, 0.6 * u, [[0, "#141925"], [1, "#080b12"]]);
    ctx.fillStyle = torso;
    ctx.beginPath();
    ctx.moveTo(-1.02 * u, -1.85 * u);                 // L shoulder
    ctx.quadraticCurveTo(-0.95 * u, -1.0 * u, -0.5 * u, -0.55 * u); // waist in
    ctx.quadraticCurveTo(-0.7 * u, 0.0 * u, -0.7 * u, 0.1 * u);    // to hip
    ctx.lineTo(0.7 * u, 0.1 * u);
    ctx.quadraticCurveTo(0.7 * u, 0.0 * u, 0.5 * u, -0.55 * u);
    ctx.quadraticCurveTo(0.95 * u, -1.0 * u, 1.02 * u, -1.85 * u); // R shoulder
    ctx.closePath(); ctx.fill();
    // soft form shading (tasteful) + neon seams
    ctx.fillStyle = hexa("#000", 0.22);
    ctx.beginPath(); ctx.ellipse(-0.35 * u, -1.05 * u, 0.34 * u, 0.42 * u, -0.2, 0, TAU); ctx.fill();
    ctx.beginPath(); ctx.ellipse(0.35 * u, -1.05 * u, 0.34 * u, 0.42 * u, 0.2, 0, TAU); ctx.fill();
    ctx.strokeStyle = hexa(neon, 0.85); ctx.lineWidth = 0.09 * u; ctx.shadowColor = neon; ctx.shadowBlur = 8 * s;
    ctx.beginPath();
    ctx.moveTo(0, -1.55 * u); ctx.lineTo(0, 0.05 * u);                       // centre seam
    ctx.moveTo(-0.62 * u, -1.75 * u); ctx.quadraticCurveTo(0, -1.15 * u, 0.62 * u, -1.75 * u); // collarbone V
    ctx.stroke(); ctx.shadowBlur = 0;

    // ===== OPEN COAT FRONT PANELS (frame the torso) =====
    for (const side of [-1, 1]) {
      ctx.fillStyle = lin(ctx, side * 0.7 * u, -1.9 * u, side * 1.5 * u, 2 * u, [[0, COAT1], [1, COAT0]]);
      ctx.beginPath();
      ctx.moveTo(side * 0.95 * u, -1.9 * u);
      ctx.quadraticCurveTo(side * 1.5 * u, -0.3 * u, side * 1.25 * u, 2.6 * u);
      ctx.quadraticCurveTo(side * 0.95 * u, 2.4 * u, side * 0.82 * u, 1.0 * u);
      ctx.quadraticCurveTo(side * 0.78 * u, -0.6 * u, side * 0.7 * u, -1.7 * u);
      ctx.closePath(); ctx.fill();
      // lapel neon inner edge
      ctx.strokeStyle = hexa(accent, 0.55); ctx.lineWidth = 0.06 * u; ctx.shadowColor = accent; ctx.shadowBlur = 6 * s;
      ctx.beginPath(); ctx.moveTo(side * 0.72 * u, -1.7 * u); ctx.quadraticCurveTo(side * 0.8 * u, 0.4 * u, side * 0.86 * u, 1.6 * u); ctx.stroke();
      ctx.shadowBlur = 0;
    }

    // ===== ARMS (filled): left hand on hip, right arm out =====
    // left upper + forearm to hip
    ctx.fillStyle = COAT0;
    segFill(ctx, -0.98 * u, -1.78 * u, -1.65 * u, -0.95 * u, -1.5 * u, -0.15 * u, 0.32 * u, 0.24 * u); ctx.fill(); // upper arm out
    segFill(ctx, -1.5 * u, -0.15 * u, -1.2 * u, 0.3 * u, -0.62 * u, 0.45 * u, 0.24 * u, 0.18 * u); ctx.fill();    // forearm to hip
    // right arm out & slightly down
    segFill(ctx, 0.98 * u, -1.78 * u, 1.7 * u, -1.2 * u, 2.05 * u, -0.45 * u, 0.32 * u, 0.22 * u); ctx.fill();
    segFill(ctx, 2.05 * u, -0.45 * u, 2.2 * u, 0.1 * u, 2.25 * u, 0.7 * u, 0.22 * u, 0.16 * u); ctx.fill();
    // hands (skin) + neon cuffs
    ctx.fillStyle = skin;
    ctx.beginPath(); ctx.arc(-0.6 * u, 0.5 * u, 0.2 * u, 0, TAU); ctx.fill();
    ctx.beginPath(); ctx.arc(2.27 * u, 0.78 * u, 0.19 * u, 0, TAU); ctx.fill();
    ctx.strokeStyle = neon; ctx.lineWidth = 0.09 * u; ctx.shadowColor = neon; ctx.shadowBlur = 8 * s;
    ctx.beginPath(); ctx.moveTo(-0.78 * u, 0.34 * u); ctx.lineTo(-0.5 * u, 0.5 * u); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(2.12 * u, 0.55 * u); ctx.lineTo(2.32 * u, 0.62 * u); ctx.stroke();
    ctx.shadowBlur = 0;
    // raised trench collar
    ctx.fillStyle = COAT1;
    ctx.beginPath();
    ctx.moveTo(-0.55 * u, -1.9 * u); ctx.lineTo(-0.95 * u, -2.45 * u); ctx.lineTo(-0.3 * u, -2.0 * u); ctx.closePath();
    ctx.moveTo(0.55 * u, -1.9 * u); ctx.lineTo(0.95 * u, -2.45 * u); ctx.lineTo(0.3 * u, -2.0 * u); ctx.closePath();
    ctx.fill();

    // ===== NECK + HEAD =====
    ctx.fillStyle = skin; ctx.fillRect(-0.2 * u, -2.45 * u, 0.4 * u, 0.65 * u);
    ctx.fillStyle = hexa("#000", 0.2); ctx.fillRect(-0.2 * u, -2.0 * u, 0.4 * u, 0.18 * u);
    // choker
    ctx.strokeStyle = neon; ctx.lineWidth = 0.08 * u; ctx.shadowColor = neon; ctx.shadowBlur = 6 * s;
    ctx.beginPath(); ctx.moveTo(-0.22 * u, -1.92 * u); ctx.lineTo(0.22 * u, -1.92 * u); ctx.stroke(); ctx.shadowBlur = 0;
    const hy = -2.85 * u;
    // hair back
    ctx.fillStyle = def.hair || "#15110f";
    ctx.beginPath(); ctx.ellipse(0, hy + 0.05 * u, 0.6 * u, 0.7 * u, 0, 0, TAU); ctx.fill();
    // face
    ctx.fillStyle = skin;
    ctx.beginPath();
    ctx.moveTo(-0.42 * u, hy - 0.05 * u);
    ctx.quadraticCurveTo(-0.46 * u, hy + 0.42 * u, 0, hy + 0.6 * u);
    ctx.quadraticCurveTo(0.46 * u, hy + 0.42 * u, 0.42 * u, hy - 0.05 * u);
    ctx.quadraticCurveTo(0.4 * u, hy - 0.5 * u, 0, hy - 0.52 * u);
    ctx.quadraticCurveTo(-0.4 * u, hy - 0.5 * u, -0.42 * u, hy - 0.05 * u);
    ctx.fill();
    // jaw shade + lips
    ctx.fillStyle = hexa("#000", 0.12); ctx.beginPath(); ctx.ellipse(0.16 * u, hy + 0.2 * u, 0.4 * u, 0.4 * u, 0, 0, Math.PI); ctx.fill();
    ctx.strokeStyle = def.lips || "#9a3450"; ctx.lineWidth = 0.07 * u; ctx.lineCap = "round";
    ctx.beginPath(); ctx.moveTo(-0.12 * u, hy + 0.34 * u); ctx.quadraticCurveTo(0, hy + 0.4 * u, 0.12 * u, hy + 0.34 * u); ctx.stroke();
    // bob fringe over forehead
    ctx.fillStyle = def.hair || "#15110f";
    ctx.beginPath();
    ctx.moveTo(-0.5 * u, hy + 0.15 * u);
    ctx.quadraticCurveTo(-0.66 * u, hy - 0.55 * u, 0, hy - 0.62 * u);
    ctx.quadraticCurveTo(0.66 * u, hy - 0.55 * u, 0.5 * u, hy + 0.15 * u);
    ctx.lineTo(0.34 * u, hy + 0.02 * u);
    ctx.quadraticCurveTo(0.28 * u, hy - 0.32 * u, 0, hy - 0.34 * u);
    ctx.quadraticCurveTo(-0.28 * u, hy - 0.32 * u, -0.34 * u, hy + 0.02 * u);
    ctx.closePath(); ctx.fill();
    // magenta wrap shades
    const sy = hy + 0.05 * u;
    ctx.fillStyle = "#0a0309"; rrect(ctx, -0.46 * u, sy - 0.16 * u, 0.92 * u, 0.32 * u, 0.13 * u); ctx.fill();
    const lg = lin(ctx, -0.42 * u, sy, 0.42 * u, sy, [[0, hexa(neon, 0.95)], [0.5, "#7a0f6e"], [1, hexa(neon, 0.95)]]);
    ctx.fillStyle = lg; ctx.shadowColor = neon; ctx.shadowBlur = 10 * s;
    rrect(ctx, -0.42 * u, sy - 0.1 * u, 0.84 * u, 0.22 * u, 0.09 * u); ctx.fill(); ctx.shadowBlur = 0;
    ctx.strokeStyle = "rgba(255,255,255,.8)"; ctx.lineWidth = 0.04 * u;
    ctx.beginPath(); ctx.moveTo(-0.3 * u, sy + 0.02 * u); ctx.lineTo(-0.14 * u, sy + 0.1 * u); ctx.stroke();

    // rim light: magenta on left edge, green on right
    ctx.lineWidth = 0.05 * u; ctx.shadowBlur = 7 * s;
    ctx.strokeStyle = hexa(neon, 0.5); ctx.shadowColor = neon;
    ctx.beginPath(); ctx.moveTo(-1.0 * u, -1.85 * u); ctx.quadraticCurveTo(-0.95 * u, -0.9 * u, -0.55 * u, -0.5 * u); ctx.stroke();
    ctx.strokeStyle = hexa(accent, 0.5); ctx.shadowColor = accent;
    ctx.beginPath(); ctx.moveTo(1.0 * u, -1.85 * u); ctx.quadraticCurveTo(0.95 * u, -0.9 * u, 0.55 * u, -0.5 * u); ctx.stroke();
    ctx.shadowBlur = 0;
  }

  M.sprites = {
    operator, agent, sentinel, wraith, boss, bossSentinel, bossTwin, gem, portrait,
    tree, car, serverRack, building, lamp, trainCar, cityscape, loginHero, glow, hexa, rrect,
  };
})();
