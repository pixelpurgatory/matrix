/* main.js — bootstrap, input (touch joystick + keyboard), boot gate, pause. */
(function () {
  const M = (window.M = window.M || {});
  const U = M.util;

  /* ---------------- input ---------------- */
  const keys = {};
  let touchId = null, joyBase = { x: 0, y: 0 }, joyVec = { x: 0, y: 0 }, touching = false;

  window.addEventListener("keydown", (e) => { keys[e.key.toLowerCase()] = true; if (e.key === " ") e.preventDefault(); });
  window.addEventListener("keyup", (e) => { keys[e.key.toLowerCase()] = false; });

  const canvas = document.getElementById("game");
  const joy = document.getElementById("joystick");
  const stick = document.getElementById("stick");

  function startTouch(x, y, id) {
    touching = true; touchId = id; joyBase = { x, y };
    joy.style.left = x + "px"; joy.style.top = y + "px";
    joy.classList.remove("hidden");
    stick.style.transform = "translate(-50%,-50%)";
  }
  function moveTouch(x, y) {
    if (!touching) return;
    let dx = x - joyBase.x, dy = y - joyBase.y;
    const max = 55, len = Math.hypot(dx, dy);
    if (len > max) { dx = dx / len * max; dy = dy / len * max; }
    stick.style.transform = `translate(calc(-50% + ${dx}px),calc(-50% + ${dy}px))`;
    joyVec = { x: dx / max, y: dy / max };
  }
  function endTouch() { touching = false; touchId = null; joyVec = { x: 0, y: 0 }; joy.classList.add("hidden"); }

  canvas.addEventListener("touchstart", (e) => {
    const t = e.changedTouches[0]; startTouch(t.clientX, t.clientY, t.identifier);
  }, { passive: true });
  canvas.addEventListener("touchmove", (e) => {
    for (const t of e.changedTouches) if (t.identifier === touchId) moveTouch(t.clientX, t.clientY);
  }, { passive: true });
  canvas.addEventListener("touchend", (e) => {
    for (const t of e.changedTouches) if (t.identifier === touchId) endTouch();
  }, { passive: true });

  // mouse (desktop) drag-to-move
  canvas.addEventListener("mousedown", (e) => startTouch(e.clientX, e.clientY, "mouse"));
  window.addEventListener("mousemove", (e) => { if (touchId === "mouse") moveTouch(e.clientX, e.clientY); });
  window.addEventListener("mouseup", () => { if (touchId === "mouse") endTouch(); });

  M.input = {
    vector() {
      let x = 0, y = 0;
      if (keys["arrowleft"] || keys["a"]) x -= 1;
      if (keys["arrowright"] || keys["d"]) x += 1;
      if (keys["arrowup"] || keys["w"]) y -= 1;
      if (keys["arrowdown"] || keys["s"]) y += 1;
      if (x || y) return { x, y };
      if (touching && (joyVec.x || joyVec.y)) return joyVec;
      return { x: 0, y: 0 };
    },
  };

  /* ---------------- pause ---------------- */
  const pauseBtn = document.getElementById("pauseBtn");
  pauseBtn.onclick = () => {
    const g = M.game; if (!g || g.state !== "playing" && g.state !== "paused") return;
    M.audio.sfx.ui();
    if (g.state === "playing") {
      g.state = "paused";
      M.ui.toast("PAUSED — tap to resume");
      showPauseMenu();
    }
  };
  function showPauseMenu() {
    const scr = U.el("div", "screen"); scr.id = "pause";
    scr.innerHTML = `<div class="lu-wrap" style="text-align:center">
      <div class="lu-title" style="animation:none">PAUSED</div>
      <div class="lu-sub">// connection held</div>
      <div style="display:flex;flex-direction:column;gap:12px;margin-top:20px">
        <button class="btn primary big" id="resume">▶ RESUME</button>
        <button class="btn" id="abort">ABORT TO HUB</button>
      </div></div>`;
    document.getElementById("screens").appendChild(scr);
    scr.querySelector("#resume").onclick = () => { M.audio.sfx.ui(); scr.remove(); M.game.state = "playing"; M.game.lastT = U.now(); M.game.loop(); };
    scr.querySelector("#abort").onclick = () => { M.audio.sfx.ui(); scr.remove(); M.game.state = "idle"; M.ui.showHome(); };
  }

  /* ---------------- boot ---------------- */
  function boot() {
    M.save.load();
    M.game = new M.Game(canvas);
    const bootEl = document.getElementById("boot");
    const btn = document.getElementById("bootBtn");
    btn.onclick = () => {
      M.audio.resume(); M.audio.menuMusic();
      bootEl.style.transition = "opacity .5s"; bootEl.style.opacity = "0";
      setTimeout(() => bootEl.remove(), 500);
      M.ui.showHome();
    };
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", boot);
  else boot();
})();
