/* tests/logic.test.js — headless self-evaluation of the pure logic layers.
 * Stubs a minimal browser, loads util/save/data/monetization, and asserts
 * the economy + progression behave correctly. Run: node tests/logic.test.js */
const fs = require("fs");
const path = require("path");
const vm = require("vm");

// ---- minimal browser stubs ----
const store = {};
const sandbox = {
  console,
  performance: { now: () => Date.now() },
  Math,
  Date,
  localStorage: {
    getItem: (k) => (k in store ? store[k] : null),
    setItem: (k, v) => (store[k] = String(v)),
    removeItem: (k) => delete store[k],
  },
  document: { createElement: () => ({ style: {}, getContext: () => ({}) }) },
};
sandbox.window = sandbox;
vm.createContext(sandbox);

function loadFile(rel) {
  const code = fs.readFileSync(path.join(__dirname, "..", rel), "utf8");
  vm.runInContext(code, sandbox, { filename: rel });
}

// audio/sprites/ui are stubbed so monetization's cross-calls don't crash
["js/util.js", "js/save.js", "js/data.js"].forEach(loadFile);
sandbox.M.audio = { sfx: new Proxy({}, { get: () => () => {} }) };
sandbox.M.ui = { toast: () => {} };
loadFile("js/monetization.js");

const M = sandbox.M;
const D = M.data;

// ---- tiny assert framework ----
let pass = 0, fail = 0;
function ok(name, cond, extra) {
  if (cond) { pass++; console.log("  ✓ " + name); }
  else { fail++; console.log("  ✗ " + name + (extra ? "  -> " + extra : "")); }
}
function approx(a, b, eps = 0.02) { return Math.abs(a - b) < eps; }

console.log("\n== DATA INTEGRITY ==");
ok("roster non-empty", D.ROSTER.length >= 6);
ok("every char has a valid starting weapon", D.ROSTER.every((id) => D.WEAPONS[D.CHARS[id].start]));
ok("every weapon dmg/cd arrays length match max", Object.values(D.WEAPONS).every((w) => w.dmg.length === w.max));
ok("gacha pool covers all roster", (() => {
  const pooled = [].concat(...Object.values(D.GACHA.pool));
  return D.ROSTER.every((id) => pooled.includes(id));
})());
ok("gacha base rates ~sum to 1", approx(D.GACHA.rates.SSR + D.GACHA.rates.SR + D.GACHA.rates.R, 1));

console.log("\n== SAVE ==");
M.save.reset();
ok("fresh save has starter char", M.save.data.rosterOwned.neo_echo === true);
ok("spend guard rejects overdraft", M.save.spend("redpills", 1e9) === false);
M.save.add("redpills", 100000);
ok("add+spend works", M.save.spend("redpills", 50000) === true);

console.log("\n== GACHA: pity / rates ==");
// effective SSR rate climbs toward hard pity
const r0 = M.mon.effectiveRates(0).SSR;
const rMid = M.mon.effectiveRates(D.GACHA.softPity + 10).SSR; // ramp begins after softPity
const rNear = M.mon.effectiveRates(D.GACHA.hardPity - 1).SSR;
ok("SSR rate ramps after soft pity", r0 <= rMid && rMid < rNear && rNear > 0.4, `${r0} <= ${rMid} < ${rNear}`);
// hard pity guarantees SSR
M.save.reset(); M.save.add("redpills", 1e9);
M.save.data.pity = D.GACHA.hardPity - 1;
const guaranteed = M.mon.pull(1);
ok("hard pity yields SSR", guaranteed.results[0].rar === "SSR", guaranteed.results[0].rar);
ok("pity resets after SSR", M.save.data.pity === 0);

// 10-pull always contains an SR or better
M.save.reset(); M.save.add("redpills", 1e9);
let sawGuarantee = true;
for (let i = 0; i < 200; i++) {
  M.save.data.pity = 0;
  const res = M.mon.pull(10);
  if (!res.results.some((r) => r.rar !== "R")) { sawGuarantee = false; break; }
}
ok("10-pull guarantees >=1 SR+ (200 trials)", sawGuarantee);

// statistical SSR rate sanity over many single pulls (no pity influence kept low)
M.save.reset(); M.save.add("redpills", 1e9);
let ssr = 0, N = 20000;
for (let i = 0; i < N; i++) { if (M.save.data.pity >= 50) M.save.data.pity = 0; const r = M.mon.pull(1); if (r.results[0].rar === "SSR") ssr++; }
const obs = ssr / N;
ok("observed SSR rate in sane band (0.01–0.06)", obs > 0.008 && obs < 0.06, obs.toFixed(4));

console.log("\n== DUPES -> SHARDS ==");
M.save.reset();
M.mon.unlockChar("neo_echo"); // already owned -> dupe
ok("dupe grants shards", (M.save.data.dupes.neo_echo || 0) > 0);

console.log("\n== LOGIN STREAK ==");
M.save.reset();
ok("login available on fresh save", M.mon.loginAvailable() === true);
const before = M.save.data.bytes;
const claim = M.mon.claimLogin();
ok("claim grants reward", claim && M.save.data.bytes >= before);
ok("login not available twice same day", M.mon.loginAvailable() === false);
ok("double-claim returns null", M.mon.claimLogin() === null);

console.log("\n== BATTLE PASS ==");
M.save.reset();
M.mon.addBpXp(D.BP.xpPerTier * 3 + 10);
ok("tier computed from xp", M.mon.bpTier() === 3);
const claimed = M.mon.bpClaim(0, "free");
ok("free tier claim ok", claimed.ok === true);
ok("re-claim blocked", M.mon.bpClaim(0, "free").error === "claimed");
ok("locked tier blocked", M.mon.bpClaim(20, "free").error === "locked");
ok("premium locked without pass", M.mon.bpClaim(0, "prem").error === "premium");
M.mon.bpBuyPremium();
ok("premium claim after buy", M.mon.bpClaim(0, "prem").ok === true);

console.log("\n== META UPGRADES ==");
M.save.reset(); M.save.add("bytes", 1e9);
const m0 = M.mon.metaBonus().power;
M.mon.metaBuy("m_power");
ok("meta level increments", M.mon.metaLevel("m_power") === 1);
ok("meta bonus applies", M.mon.metaBonus().power > m0);
// buy to max
let guard = 0;
while (M.mon.metaBuy("m_power").ok && guard++ < 50) {}
ok("meta caps at max", M.mon.metaLevel("m_power") === D.META.m_power.max);
ok("over-max returns error", M.mon.metaBuy("m_power").error === "max");

console.log("\n== OFFERS ==");
M.save.reset();
M.mon.checkDailies();
const beginner = M.mon.offerState("beginner");
ok("beginner offer armed with timer", beginner.remaining > 0);
const buy = M.mon.buyOffer("beginner");
ok("buy offer grants", buy.ok === true);

console.log("\n== RUN REWARDS ==");
M.save.reset();
const rw = M.mon.awardRun({ kills: 300, time: 600, level: 25, boss: true });
ok("run awards bytes", rw.bytes > 0);
ok("boss run awards redpills", rw.rp > 0);
ok("stats recorded", M.save.data.runs === 1 && M.save.data.bestTime === 600);

console.log("\n== DOLLARS + SHOP ==");
M.save.reset();
ok("user starts with $2", M.save.data.dollars === 2);
const rpBefore = M.save.data.redpills;
const b1 = M.mon.buyBundle("redpills", "rp1"); // $0.99 -> 80 (x2 first)
ok("buy deducts $ + delivers goods", b1.ok && M.save.data.dollars === +(2 - 0.99).toFixed(2) && M.save.data.redpills === rpBefore + D.BUNDLES.redpills[0].amt * 2, JSON.stringify(b1) + " $" + M.save.data.dollars);
ok("first buy doubled", b1.amt === D.BUNDLES.redpills[0].amt * 2);
const b2 = M.mon.buyBundle("redpills", "rp1");
ok("second buy not doubled", b2.amt === D.BUNDLES.redpills[0].amt);
const b3 = M.mon.buyBundle("redpills", "rp1");
ok("blocked when $ insufficient", b3.error === "dollars", JSON.stringify(b3));
M.save.reset();
const adb = M.mon.buyBundle("bytes", "by0"); // FREE ad pack
ok("ad pack free, grants bytes, no $ spent", adb.ok && M.save.data.dollars === 2);
M.save.reset(); M.save.add("redpills", 1000);
const byb = M.mon.buyBundle("bytes", "by1"); // costs redpills
ok("bytes pack spends redpills", byb.ok && M.save.data.redpills === 80 + 1000 - 100);

console.log("\n== EARNING $ ==");
M.save.reset();
const d0 = M.save.data.dollars;
const drw = M.mon.awardRun({ kills: 100, time: 180, level: 10, boss: true });
ok("run completion awards $", drw.dollars > 0 && M.save.data.dollars > d0, "rw=" + JSON.stringify(drw));
M.save.reset();
M.mon.addDollars(0.5);
ok("combat $ drop adds + tracks lifetime", M.save.data.dollars === 2.5 && M.save.data.dollarsEarned === 0.5);

console.log("\n== $ UNLOCKS: OFFERS + OPERATORS ==");
M.save.reset(); M.mon.checkDailies();
M.save.data.dollars = 10;
const bo = M.mon.buyOffer("beginner"); // $0.99
ok("offer charges $ on first acquire", bo.ok && bo.spent === 0.99 && M.save.data.dollars === 9.01, JSON.stringify(bo) + " $" + M.save.data.dollars);
M.save.reset(); M.mon.checkDailies(); M.save.data.dollars = 0.5;
const boPoor = M.mon.buyOffer("expert"); // $9.99
ok("offer blocked when $ short", boPoor.error === "dollars", JSON.stringify(boPoor));
// operators
M.save.reset();
const lockedId = D.ROSTER.find((id) => !M.save.data.rosterOwned[id] && D.CHARS[id].rarity === "R");
ok("operator price by rarity (R=$0.99)", M.mon.operatorPrice(lockedId) === 0.99);
M.save.data.dollars = 5;
const buyOp = M.mon.buyOperator(lockedId);
ok("buy operator deducts $ + unlocks", buyOp.ok && M.save.data.rosterOwned[lockedId] === true && M.save.data.dollars === +(5 - 0.99).toFixed(2), JSON.stringify(buyOp));
ok("re-buy owned operator blocked", M.mon.buyOperator(lockedId).error === "owned");
M.save.reset(); M.save.data.dollars = 0;
const ssrId = D.ROSTER.find((id) => D.CHARS[id].rarity === "SSR" && !M.save.data.rosterOwned[id]);
ok("operator blocked when $ short", M.mon.buyOperator(ssrId).error === "dollars");

console.log("\n== OFFLINE PERSISTENCE ==");
M.save.reset();
M.mon.addDollars(3.25);
M.save.data.bytes = 12345; M.mon.unlockChar("trace_ivory"); M.save.save();
M.save.load(); // simulate closing & reopening the browser
ok("$ persisted across reload", M.save.data.dollars === 5.25, "$" + M.save.data.dollars);
ok("bytes persisted across reload", M.save.data.bytes === 12345);
ok("roster persisted across reload", M.save.data.rosterOwned.trace_ivory === true);

console.log(`\n========================================`);
console.log(`  RESULT: ${pass} passed, ${fail} failed`);
console.log(`========================================\n`);
process.exit(fail ? 1 : 0);
