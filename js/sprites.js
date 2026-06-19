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

  M.sprites = { operator, agent, sentinel, wraith, boss, gem, portrait, glow, hexa, rrect };
})();
