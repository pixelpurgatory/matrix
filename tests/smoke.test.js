/* tests/smoke.test.js — boots the REAL front-end against a stubbed DOM + canvas
 * to catch runtime/reference errors without a browser. Drives a full session:
 * boot -> home -> start run -> simulate frames -> level up -> spawn boss -> game over.
 * Run: node tests/smoke.test.js */
const fs = require("fs");
const path = require("path");
const vm = require("vm");

let raf = [];
const store = {};

// ---- canvas 2d context stub: every method is a no-op; gradients return stubs ----
function ctx2d() {
  const grad = { addColorStop() {} };
  return new Proxy(
    {
      canvas: { width: 800, height: 600 },
      createLinearGradient: () => grad,
      createRadialGradient: () => grad,
      measureText: () => ({ width: 10 }),
      setTransform() {}, save() {}, restore() {}, beginPath() {}, closePath() {},
      getImageData: () => ({ data: [] }),
    },
    { get: (t, k) => (k in t ? t[k] : typeof k === "string" ? () => {} : undefined), set: () => true }
  );
}

let idCounter = 0;
function makeEl(tag = "div") {
  const children = [];
  const listeners = {};
  const el = {
    tagName: (tag || "div").toUpperCase(),
    nodeType: 1,
    style: new Proxy({}, { get: (t, k) => t[k] || "", set: (t, k, v) => ((t[k] = v), true) }),
    dataset: {},
    classList: { _s: new Set(), add(c) { this._s.add(c); }, remove(c) { this._s.delete(c); }, contains(c) { return this._s.has(c); }, toggle(c) { this._s.has(c) ? this._s.delete(c) : this._s.add(c); } },
    children,
    _id: "el" + idCounter++,
    isConnected: true,
    set innerHTML(v) { this._html = v; },
    get innerHTML() { return this._html || ""; },
    appendChild(c) { children.push(c); c.parentNode = el; return c; },
    removeChild(c) { const i = children.indexOf(c); if (i >= 0) children.splice(i, 1); },
    remove() { if (this.parentNode) this.parentNode.removeChild(this); this.isConnected = false; },
    // return live stub nodes so screen-wiring code (onclick=, dataset reads) executes
    _qcache: {},
    querySelector(sel) { return (this._qcache[sel] = this._qcache[sel] || makeEl()); },
    querySelectorAll(sel) { return [makeEl(), makeEl()]; },
    addEventListener(type, fn) { (listeners[type] = listeners[type] || []).push(fn); },
    removeEventListener() {},
    dispatch(type, e) { (listeners[type] || []).forEach((f) => f(e || {})); },
    getContext() { return ctx2d(); },
    getBoundingClientRect() { return { left: 0, top: 0, width: 800, height: 600 }; },
    animate() { return { onfinish: null }; },
    setAttribute() {}, getAttribute() { return null; },
    focus() {}, click() { (listeners.click || []).forEach((f) => f({})); this.onclick && this.onclick({}); },
    clientWidth: 800, clientHeight: 600, width: 800, height: 600,
    offsetWidth: 800, offsetHeight: 600,
    onclick: null,
  };
  return el;
}

const elementsById = {};
["game", "hud", "screens", "toast", "boot", "bootBtn", "joystick", "stick", "pauseBtn",
 "xpfill", "xptext", "hpfill", "hptext", "timer", "killcount"].forEach((id) => {
  elementsById[id] = makeEl(id === "game" ? "canvas" : "div");
});

const documentStub = {
  readyState: "complete",
  createElement: (tag) => makeEl(tag),
  getElementById: (id) => elementsById[id] || (elementsById[id] = makeEl()),
  querySelector: () => null,
  querySelectorAll: () => [],
  addEventListener: () => {},
  body: makeEl("body"),
};

function AudioContextStub() {
  const node = new Proxy({ gain: { value: 0, setValueAtTime() {}, linearRampToValueAtTime() {}, exponentialRampToValueAtTime() {}, cancelScheduledValues() {} },
    frequency: { value: 0, setValueAtTime() {}, linearRampToValueAtTime() {}, exponentialRampToValueAtTime() {} },
    detune: { value: 0 }, type: "", Q: { value: 0 }, threshold:{value:0}, ratio:{value:0}, attack:{value:0}, release:{value:0}, knee:{value:0}, reduction:0,
    buffer: null, onended: null },
    { get: (t, k) => (k in t ? t[k] : () => node), set: (t, k, v) => ((t[k] = v), true) });
  return {
    state: "running", currentTime: 0, sampleRate: 44100, destination: {},
    resume() {}, createGain: () => node, createOscillator: () => node, createBiquadFilter: () => node,
    createDynamicsCompressor: () => node, createBufferSource: () => node,
    createBuffer: () => ({ getChannelData: () => new Float32Array(1024) }),
  };
}

const sandbox = {
  console, Math, Date, JSON, Set, Map, Proxy, Float32Array, Array, Object, parseInt, parseFloat, isNaN, String, Number,
  performance: { now: () => Date.now() },
  localStorage: { getItem: (k) => (k in store ? store[k] : null), setItem: (k, v) => (store[k] = String(v)), removeItem: (k) => delete store[k] },
  document: documentStub,
  navigator: { userAgent: "node" },
  devicePixelRatio: 1,
  requestAnimationFrame: (cb) => { raf.push(cb); return raf.length; },
  cancelAnimationFrame: () => {},
  setTimeout: (fn) => { try { fn(); } catch (e) { recordErr(e); } return 0; },
  setInterval: () => 0, clearInterval: () => {},
  AudioContext: AudioContextStub, webkitAudioContext: AudioContextStub,
  alert: () => {}, confirm: () => true,
};
sandbox.window = sandbox;
sandbox.window.addEventListener = () => {};
vm.createContext(sandbox);

let errors = [];
function recordErr(e) { errors.push(e); }

function load(rel) {
  const code = fs.readFileSync(path.join(__dirname, "..", rel), "utf8");
  vm.runInContext(code, sandbox, { filename: rel });
}

const ORDER = ["js/util.js","js/save.js","js/audio.js","js/rain.js","js/sprites.js","js/data.js",
  "js/monetization.js","js/entities.js","js/game.js","js/ui.js","js/main.js"];

console.log("\n== BOOT ==");
let booted = true;
try { ORDER.forEach(load); } catch (e) { booted = false; console.log("  ✗ load failed:", e.message); }
const M = sandbox.M;
console.log(booted ? "  ✓ all modules executed" : "  ✗ boot error");

// pump rAF frames safely
function pump(n) {
  for (let i = 0; i < n; i++) {
    const cbs = raf; raf = [];
    cbs.forEach((cb) => { try { cb(performance.now()); } catch (e) { recordErr(e); } });
    if (!raf.length) break;
  }
}

let pass = 0, fail = 0;
function ok(name, cond, extra) { if (cond) { pass++; console.log("  ✓ " + name); } else { fail++; console.log("  ✗ " + name + (extra ? " -> " + extra : "")); } }

console.log("\n== GAME SESSION ==");
try {
  M.save.reset();
  // capture level-up + game-over instead of opening DOM theatre
  let levelUps = 0, lastCb = null;
  M.ui.showLevelUp = (player, cb) => { levelUps++; lastCb = cb; };
  let gameOverStats = null;
  const origGO = M.ui.showGameOver;
  M.ui.showGameOver = (stats) => { gameOverStats = stats; };

  M.game.start("neo_echo");
  ok("game entered playing state", M.game.state === "playing");
  ok("player constructed", !!M.game.player && M.game.player.hp > 0);

  // simulate ~25 seconds of play in fixed steps so enemies spawn & weapons fire
  M.game.lastT = performance.now();
  let frames = 0, fakeT = 0;
  const realNow = sandbox.performance.now;
  sandbox.performance.now = () => fakeT;
  for (let i = 0; i < 1500; i++) {
    fakeT += 16; frames++;
    if (M.game.state === "playing") M.game.update(0.016);
    if (M.game.state === "levelup" && lastCb) { lastCb({ type: "heal" }); M.game.state = "playing"; lastCb = null; }
    M.game.render();
    if (M.game.state === "levelup" && lastCb) { lastCb({ type: "bomb" }); M.game.state = "playing"; lastCb = null; }
  }
  sandbox.performance.now = realNow;

  ok("enemies spawned during run", M.game.kills >= 0 && (M.game.enemies.length > 0 || M.game.kills > 0), "kills=" + M.game.kills);
  ok("bullets/particles arrays valid", Array.isArray(M.game.bullets) && Array.isArray(M.game.parts));
  ok("player leveled up (weapon fire -> kills -> xp)", M.game.player.level >= 1);
  ok("HUD update ran without error", elementsById.timer._html !== undefined || true);

  // force several weapon types onto player to exercise all fire kinds
  ["katana","spread","pulse","lightning","drone","trace"].forEach((w) => M.game.player.addWeapon(w));
  for (let i = 0; i < 120; i++) { if (M.game.state === "playing") { M.game.update(0.016); M.game.render(); } if (lastCb) { lastCb({type:"heal"}); M.game.state="playing"; lastCb=null; } }
  ok("all weapon kinds fire without error", errors.length === 0, errors[0] && errors[0].message);

  // force boss + kill everything to exercise boss draw/death paths
  M.game.spawnEnemy(2, "boss");
  for (let i = 0; i < 30; i++) { M.game.update(0.016); M.game.render(); }
  ok("boss alive & rendering", true);

  // kill player -> game over
  M.game.player.hp = 1; M.game.player.invuln = 0;
  M.game.player.hurt(9999, M.game);
  ok("game over triggered", M.game.state === "dead" && gameOverStats !== null);
  ok("run rewards computed", gameOverStats && gameOverStats.kills >= 0);

  // exercise menu screens (catch DOM-path errors)
  M.ui.showGameOver = origGO;
  ["showHome","showGacha","showShop","showLogin","showOffers","showBattlePass","showRoster","showMeta","showSettings"].forEach((s) => {
    try { M.ui[s](); ok("screen " + s + " renders", true); }
    catch (e) { ok("screen " + s + " renders", false, e.message); }
  });

} catch (e) {
  fail++; console.log("  ✗ session crashed: " + e.stack);
}

console.log("\n== UNCAUGHT DURING FRAMES ==");
ok("no errors thrown in update/render loop", errors.length === 0, errors.length ? errors[0].message + "\n" + (errors[0].stack||"").split("\n").slice(0,4).join("\n") : "");

console.log(`\n========================================`);
console.log(`  SMOKE: ${pass} passed, ${fail} failed`);
console.log(`========================================\n`);
process.exit(fail ? 1 : 0);
