/* monetization.js — the "live-service" economy systems.
 *
 * NOTE ON DESIGN: this faithfully models the engagement/retention loops used by
 * Chinese survivor-gacha titles (the reference screenshots) so the project is a
 * realistic study of them. EVERYTHING is simulated locally — there is NO real
 * payment, NO network, NO real currency. "Purchases" just grant fake currency.
 *
 * Each loop is annotated with the behavioural mechanism it exploits:
 *  - Variable-ratio reward (gacha)        -> dopaminergic reward-prediction error
 *  - Near-miss + pity counter             -> sunk-cost + goal-gradient
 *  - Daily login streak                   -> habit formation / loss aversion
 *  - Countdown limited offers (FOMO)      -> scarcity + urgency
 *  - Battle pass (endowed progress)       -> completion drive / IKEA effect
 *  - First-purchase 2x                    -> foot-in-the-door conversion
 * These are documented so the build is transparent about what it is doing.
 */
(function () {
  const M = (window.M = window.M || {});
  const { GACHA, LOGIN, OFFERS, BP, CHARS, data } = (() => M.data)() && {
    GACHA: M.data.GACHA, LOGIN: M.data.LOGIN, OFFERS: M.data.OFFERS, BP: M.data.BP, CHARS: M.data.CHARS, data: M.data,
  };
  const S = () => M.save.data;

  /* ---------------- daily / login ---------------- */
  function dayStamp(ts = Date.now()) {
    const d = new Date(ts);
    return d.getFullYear() * 372 + d.getMonth() * 31 + d.getDate();
  }
  function checkDailies() {
    const s = S();
    const today = dayStamp();
    if (s._today !== today) {
      s._today = today;
      s.loginClaimedToday = false;
      // refresh daily offers
      for (const o of OFFERS) if (o.refresh) { delete s.boughtOffers[o.id]; s.offerExpires[o.id] = Date.now() + o.durH * 3600e3; }
    }
    // arm beginner/limited timers on first run
    for (const o of OFFERS) {
      if (o.refresh) continue;
      if (!s.offerExpires[o.id] && !(o.once && s.boughtOffers[o.id])) {
        s.offerExpires[o.id] = Date.now() + o.durH * 3600e3;
      }
    }
    M.save.save();
  }
  function loginAvailable() { return !S().loginClaimedToday; }
  function claimLogin() {
    const s = S();
    if (s.loginClaimedToday) return null;
    const idx = s.loginDay % 7; // streak cycles weekly
    const r = LOGIN[idx];
    grant([[r.cur, r.amt]]);
    s.loginDay += 1;
    s.loginClaimedToday = true;
    M.save.save();
    return r;
  }

  /* ---------------- granting helpers ---------------- */
  function grant(list) {
    for (const [k, v] of list) {
      if (k === "char") unlockChar(v);
      else M.save.add(k, v);
    }
  }
  function unlockChar(id) {
    const s = S();
    if (s.rosterOwned[id]) {
      // dupe -> shards
      const rar = CHARS[id].rarity;
      const sh = data.GACHA.dupeShards[rar] || 5;
      s.dupes[id] = (s.dupes[id] || 0) + sh;
      M.save.save();
      return { dupe: true, shards: sh };
    }
    s.rosterOwned[id] = true;
    M.save.save();
    return { dupe: false };
  }

  /* ---------------- GACHA (variable-ratio + pity) ---------------- */
  function effectiveRates(pity) {
    // goal-gradient: SSR rate ramps hard near hard pity (the "so close" feeling)
    let ssr = GACHA.rates.SSR;
    if (pity >= GACHA.softPity) {
      const k = (pity - GACHA.softPity) / (GACHA.hardPity - GACHA.softPity);
      ssr = GACHA.rates.SSR + k * (0.6 - GACHA.rates.SSR);
    }
    const sr = GACHA.rates.SR;
    return { SSR: Math.min(0.6, ssr), SR: sr, R: Math.max(0, 1 - Math.min(0.6, ssr) - sr) };
  }
  function rollRarity(pity) {
    if (pity + 1 >= GACHA.hardPity) return "SSR"; // hard pity guarantee
    const r = effectiveRates(pity);
    const x = Math.random();
    if (x < r.SSR) return "SSR";
    if (x < r.SSR + r.SR) return "SR";
    return "R";
  }
  function pickFromPool(rar) {
    const pool = GACHA.pool[rar];
    // featured rate-up: 50% of SSR is the featured unit
    if (rar === "SSR" && Math.random() < 0.5) return GACHA.featured;
    return M.util.pick(pool);
  }
  function pull(n) {
    const s = S();
    const cost = n === 10 ? GACHA.cost10 : GACHA.cost1 * n;
    if (!M.save.spend(GACHA.curr, cost)) return { error: "insufficient", need: cost - s[GACHA.curr] };
    const results = [];
    let got10SR = false;
    for (let i = 0; i < n; i++) {
      let rar = rollRarity(s.pity);
      // 10-pull guarantees at least one SR+
      if (n === 10 && i === n - 1 && !got10SR && rar === "R") rar = "SR";
      if (rar === "SR" || rar === "SSR") got10SR = true;
      if (rar === "SSR") s.pity = 0; else s.pity += 1;
      const id = pickFromPool(rar);
      const res = unlockChar(id);
      results.push({ id, rar, dupe: res.dupe, shards: res.shards || 0, char: CHARS[id] });
    }
    // pulling feeds the battle pass too (cross-system reinforcement)
    addBpXp(n * 10);
    M.save.save();
    return { results };
  }

  /* ---------------- OFFERS ---------------- */
  function offerState(id) {
    const s = S();
    const o = OFFERS.find((x) => x.id === id);
    const exp = s.offerExpires[id] || 0;
    const remaining = Math.max(0, exp - Date.now());
    const bought = s.boughtOffers[id] || 0;
    const tiers = o.tiers ? o.tiers.length : 1;
    return { o, remaining, bought, done: o.once ? bought >= 1 : bought >= tiers, expired: remaining <= 0 && exp > 0 };
  }
  // "buy" = spend $ credits (if the pack has a $ price), then grant rewards
  function buyOffer(id) {
    const s = S();
    const o = OFFERS.find((x) => x.id === id);
    const st = offerState(id);
    if (st.done) return { error: "done" };
    // charge the $ price once, when first acquiring this offer (tiers then unlock free)
    const price = parsePrice(o.price);
    let spent = 0;
    if (price != null && price > 0 && (s.boughtOffers[id] || 0) === 0) {
      if ((s.dollars || 0) + 1e-9 < price) return { error: "dollars", need: +(price - (s.dollars || 0)).toFixed(2), price };
      s.dollars = +((s.dollars - price).toFixed(2));
      spent = price;
    }
    if (o.tiers) grant(o.tiers[st.bought].give);
    else grant(o.give);
    s.boughtOffers[id] = (s.boughtOffers[id] || 0) + 1;
    if (o.refresh) s.offerExpires[id] = Date.now() + o.durH * 3600e3;
    M.save.save();
    return { ok: true, spent };
  }

  /* ---------------- buy operators with $ ---------------- */
  const OP_PRICE = { R: 0.99, SR: 2.99, SSR: 4.99 };
  function operatorPrice(id) { return OP_PRICE[CHARS[id].rarity] || 0.99; }
  function buyOperator(id) {
    const s = S();
    if (s.rosterOwned[id]) return { error: "owned" };
    const price = operatorPrice(id);
    if ((s.dollars || 0) + 1e-9 < price) return { error: "dollars", need: +(price - (s.dollars || 0)).toFixed(2), price };
    s.dollars = +((s.dollars - price).toFixed(2));
    s.rosterOwned[id] = true;
    M.save.save();
    return { ok: true, price };
  }

  /* ---------------- BATTLE PASS ---------------- */
  function bpTier() { return Math.min(BP.maxTier - 1, Math.floor(S().bpXp / BP.xpPerTier)); }
  function bpProgress() {
    const t = bpTier();
    const into = S().bpXp - t * BP.xpPerTier;
    return { tier: t, into, need: BP.xpPerTier, pct: into / BP.xpPerTier };
  }
  function addBpXp(n) {
    S().bpXp += n;
    M.save.save();
  }
  function bpClaim(tier, track) {
    const s = S();
    if (tier > bpTier()) return { error: "locked" };
    if (track === "prem" && !s.bpPremium) return { error: "premium" };
    const key = tier + ":" + track;
    if (s.bpClaimed[key]) return { error: "claimed" };
    const rw = BP.reward(tier)[track];
    grant([rw]);
    s.bpClaimed[key] = true;
    M.save.save();
    return { ok: true, reward: rw };
  }
  function bpBuyPremium() { S().bpPremium = true; M.save.save(); }

  /* ---------------- META upgrades ---------------- */
  function metaLevel(id) { return S().meta[id] || 0; }
  function metaBuy(id) {
    const s = S();
    const def = data.META[id];
    const lv = metaLevel(id);
    if (lv >= def.max) return { error: "max" };
    const cost = def.cost[lv];
    if (!M.save.spend("bytes", cost)) return { error: "poor", need: cost };
    s.meta[id] = lv + 1;
    M.save.save();
    return { ok: true };
  }
  // aggregate meta stat bonuses applied at run start
  function metaBonus() {
    const out = { power: 1, maxhp: 0, haste: 0, magnet: 0, greed: 1, revive: 0 };
    for (const id in data.META) {
      const def = data.META[id];
      const lv = metaLevel(id);
      if (!lv) continue;
      if (def.stat === "power") out.power += def.per * lv;
      else if (def.stat === "greed") out.greed += def.per * lv;
      else out[def.stat] = (out[def.stat] || 0) + def.per * lv;
    }
    return out;
  }

  /* ---------------- dollar credits ($, spendable, local) ---------------- */
  function parsePrice(p) {
    if (typeof p === "number") return p;
    if (typeof p === "string" && p[0] === "$") return parseFloat(p.slice(1)) || 0;
    return null; // "FREE" or non-dollar price
  }
  function addDollars(amt) {
    const s = S();
    s.dollars = +(((s.dollars || 0) + amt).toFixed(2));
    s.dollarsEarned = +(((s.dollarsEarned || 0) + amt).toFixed(2));
    M.save.save();
    return s.dollars;
  }

  /* ---------------- currency bundles (spend $ credits) ---------------- */
  function buyBundle(type, id) {
    const b = data.BUNDLES[type].find((x) => x.id === id);
    if (!b) return { error: "no" };
    const s = S();
    let amt = b.amt, spent = 0;
    if (b.cur) {
      // paid with another in-game currency (e.g. Bytes bought with Redpills)
      if (!M.save.spend(b.cur, b.price)) return { error: "poor" };
    } else if (b.ad) {
      // "watch ad" freebie — no cost
    } else {
      // dollar-priced pack: deduct the player's $ balance
      const price = parsePrice(b.price);
      if (price != null && price > 0) {
        if ((s.dollars || 0) + 1e-9 < price)
          return { error: "dollars", need: +(price - (s.dollars || 0)).toFixed(2), price };
        s.dollars = +((s.dollars - price).toFixed(2));
        spent = price;
      }
      // first-purchase doubling (foot-in-the-door)
      if (!s.firstTopup[id]) { amt *= 2; s.firstTopup[id] = true; }
    }
    M.save.add(type, amt); // grants the goods + persists
    M.save.save();
    return { ok: true, amt, spent };
  }

  /* ---------------- end-of-run rewards ---------------- */
  function awardRun(stats) {
    const s = S();
    const bonus = metaBonus();
    const bytes = Math.floor((40 + stats.kills * 1.4 + stats.time * 3 + stats.level * 25) * bonus.greed);
    const rp = Math.floor(stats.time / 60) * 5 + (stats.boss ? 30 : 0);
    // $ credits for completing the run: base + time + boss bonus
    const dollars = +((0.25 + Math.floor(stats.time / 60) * 0.15 + (stats.boss ? 0.75 : 0)).toFixed(2));
    M.save.add("bytes", bytes);
    if (rp > 0) M.save.add("redpills", rp);
    if (dollars > 0) addDollars(dollars);
    s.totalKills += stats.kills;
    s.runs += 1;
    if (stats.time > s.bestTime) s.bestTime = stats.time;
    addBpXp(Math.floor(stats.time / 6) + stats.level * 4 + (stats.boss ? 40 : 0));
    M.save.save();
    return { bytes, rp, dollars };
  }

  function badgeCount() {
    // red dots drive compulsive checking (notification-as-reward)
    let n = 0;
    if (loginAvailable()) n++;
    for (const o of OFFERS) { const st = offerState(o.id); if (!st.done && st.remaining > 0) n++; }
    // claimable BP tiers
    const t = bpTier();
    for (let i = 0; i <= t; i++) { if (!S().bpClaimed[i + ":free"]) { n++; break; } }
    return n;
  }

  M.mon = {
    checkDailies, loginAvailable, claimLogin,
    pull, effectiveRates, unlockChar,
    offerState, buyOffer,
    operatorPrice, buyOperator,
    bpTier, bpProgress, addBpXp, bpClaim, bpBuyPremium,
    metaLevel, metaBuy, metaBonus,
    buyBundle, parsePrice, addDollars, awardRun, grant, badgeCount,
  };
})();
