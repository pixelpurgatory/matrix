/* ui.js — all DOM screens, HUD, navigation, and the gacha/shop/pass theatre. */
(function () {
  const M = (window.M = window.M || {});
  const U = M.util, D = M.data, mon = M.mon, S = M.save;
  const $ = U.$, el = U.el;
  const screens = () => document.getElementById("screens");
  const hud = () => document.getElementById("hud");

  let activeRain = []; // running banner rains to stop on close

  /* ---------------- toast ---------------- */
  function toast(text) {
    const box = document.getElementById("toast");
    const t = el("div", "toast-item", text);
    box.appendChild(t);
    setTimeout(() => t.remove(), 2100);
  }

  /* ---------------- currency bar ---------------- */
  function curIco(kind) {
    return { bytes: "¤", redpills: "◆", keys: "⚿" }[kind] || "•";
  }
  function curBar() {
    const d = S.data;
    return `<div class="curbar">
      <div class="cur gold"><span class="ico">¤</span><b>${U.fmtNum(d.bytes)}</b></div>
      <div class="cur red"><span class="ico">◆</span><b>${U.fmtNum(d.redpills)}</b></div>
      <div class="cur"><span class="ico">⚿</span><b>${d.keys}</b></div>
    </div>`;
  }
  function refreshCur(root) {
    const d = S.data;
    const c = (root || document).querySelectorAll(".curbar .cur b");
    if (c[0]) c[0].textContent = U.fmtNum(d.bytes);
    if (c[1]) c[1].textContent = U.fmtNum(d.redpills);
    if (c[2]) c[2].textContent = d.keys;
  }

  /* ---------------- screen scaffold ---------------- */
  function openScreen(id, title, bodyHtml, opts = {}) {
    closeRains();
    const scr = el("div", "screen" + (opts.solid ? " solid" : ""));
    scr.id = id;
    scr.innerHTML = `
      <div class="scr-head">
        <div class="scr-title">${title}</div>
        <button class="x-btn" data-close>✕</button>
      </div>
      ${opts.noCur ? "" : curBar()}
      <div class="scr-body">${bodyHtml}</div>`;
    screens().appendChild(scr);
    scr.querySelector("[data-close]").onclick = () => { M.audio.sfx.ui(); close(scr); opts.onClose && opts.onClose(); };
    return scr;
  }
  function close(scr) { closeRains(); scr.remove(); }
  function closeAll() { closeRains(); screens().innerHTML = ""; }
  function closeRains() { activeRain.forEach((r) => r.stop()); activeRain = []; }

  /* ================= HOME HUB ================= */
  function showHome() {
    closeAll(); hud().classList.add("hidden");
    M.audio.menuMusic();
    mon.checkDailies();
    const d = S.data;
    const c = D.CHARS[d.selected];
    const home = el("div", "screen solid"); home.id = "home";
    home.innerHTML = `
      <canvas id="cityBg"></canvas>
      ${curBar()}
      <div class="home-hero">
        <canvas class="home-char" id="homePortrait"></canvas>
        <div class="home-charname rarlabel r-${c.rarity}">${c.name}</div>
        <div class="home-charsub">${c.title} · <span class="rarlabel r-${c.rarity}">${c.rarity}</span></div>
      </div>

      <div class="side-rail left">
        ${railBtn("login", "✉", "Login", mon.loginAvailable() ? "!" : "")}
        ${railBtn("offers", "🎁", "Offers", offersBadge())}
        ${railBtn("pass", "⛤", "Pass", bpBadge())}
        ${railBtn("shop", "◆", "Shop", "")}
      </div>
      <div class="side-rail right">
        ${railBtn("gacha", "✦", "Construct", "", true)}
        ${railBtn("roster", "☰", "Operators", "")}
        ${railBtn("meta", "▲", "Upgrades", "")}
        ${railBtn("settings", "⚙", "System", "")}
      </div>

      <div class="home-actions">
        <div class="stage-pick">
          <button data-stage="-1">◀</button>
          <span id="stageName">${D.STAGES[(d.stage||1)-1].name}</span>
          <button data-stage="1">▶</button>
        </div>
        <button class="btn primary big" id="startBtn">▶ JACK IN</button>
        <div class="muted center">best survive: ${U.fmtTime(d.bestTime)} · runs: ${d.runs}</div>
      </div>`;
    screens().appendChild(home);

    // animated Matrix-NYC skyline behind everything
    animateCity($("#cityBg", home));
    // render portrait (animated)
    animatePortrait($("#homePortrait", home), c);

    // rail nav
    U.$$(".rail-btn", home).forEach((b) => {
      b.onclick = () => { M.audio.sfx.ui(); nav(b.dataset.nav); };
    });
    $("#startBtn", home).onclick = () => { M.audio.sfx.ui(); startRun(); };
    U.$$("[data-stage]", home).forEach((b) => b.onclick = () => {
      M.audio.sfx.ui();
      const max = Object.keys(d.rosterOwned).length >= 1 ? D.STAGES.length : 1;
      d.stage = U.clamp((d.stage || 1) + (+b.dataset.stage), 1, D.STAGES.length);
      S.save(); $("#stageName", home).textContent = D.STAGES[d.stage - 1].name;
    });

    // first-visit: auto pop login if available (habit hook)
    if (mon.loginAvailable()) setTimeout(() => nav("login"), 350);
  }
  function railBtn(nav, ico, label, badge, hot) {
    return `<div class="rail-btn ${hot ? "hot" : ""}" data-nav="${nav}">
      ${badge ? `<span class="badge">${badge === "!" ? "!" : badge}</span>` : ""}
      <span class="ri">${ico}</span><span>${label}</span></div>`;
  }
  function offersBadge() { let n = 0; for (const o of D.OFFERS) { const st = mon.offerState(o.id); if (!st.done && st.remaining > 0) n++; } return n || ""; }
  function bpBadge() { const t = mon.bpTier(); for (let i = 0; i <= t; i++) if (!S.data.bpClaimed[i + ":free"]) return "!"; return ""; }

  function animatePortrait(canvas, char) {
    if (!canvas) return;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const w = canvas.clientWidth || 240, h = canvas.clientHeight || 320;
    canvas.width = w * dpr; canvas.height = h * dpr;
    const ctx = canvas.getContext("2d"); ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    let t0 = performance.now(); let alive = true;
    const r = { stop() { alive = false; } }; activeRain.push(r);
    (function loop(t) {
      if (!alive || !canvas.isConnected) { r.stop(); return; }
      M.sprites.portrait(ctx, w, h, char, (t - t0) / 1000);
      requestAnimationFrame(loop);
    })(t0);
  }

  function animateCity(canvas) {
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    let alive = true; const t0 = performance.now();
    const r = { stop() { alive = false; } }; activeRain.push(r);
    function sizeIt() {
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      const w = canvas.clientWidth || window.innerWidth, h = canvas.clientHeight || window.innerHeight;
      canvas.width = w * dpr; canvas.height = h * dpr;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0); canvas._w = w; canvas._h = h;
    }
    sizeIt();
    (function loop(t) {
      if (!alive || !canvas.isConnected) { r.stop(); return; }
      if (canvas.clientWidth && canvas.clientWidth * (Math.min(window.devicePixelRatio||1,2)) !== canvas.width) sizeIt();
      M.sprites.cityscape(ctx, canvas._w, canvas._h, (t - t0) / 1000);
      requestAnimationFrame(loop);
    })(t0);
  }

  function nav(where) {
    switch (where) {
      case "login": return showLogin();
      case "offers": return showOffers();
      case "pass": return showBattlePass();
      case "shop": return showShop();
      case "gacha": return showGacha();
      case "roster": return showRoster();
      case "meta": return showMeta();
      case "settings": return showSettings();
    }
  }

  function startRun() {
    closeAll(); hud().classList.remove("hidden");
    document.getElementById("joystick").classList.add("hidden");
    M.game.start(S.data.selected);
  }

  /* ================= LOGIN ================= */
  function showLogin() {
    const d = S.data; const todayIdx = d.loginDay % 7;
    const cells = D.LOGIN.map((r, i) => {
      const claimed = i < todayIdx || (i === todayIdx && d.loginClaimedToday);
      const today = i === todayIdx && !d.loginClaimedToday;
      return `<div class="login-day ${claimed ? "claimed" : ""} ${today ? "today" : ""} ${r.big ? "rar r-SSR" : ""}">
        <div class="d">DAY ${r.d}</div>
        <div class="ri" style="font-size:20px">${curIco(r.cur)}</div>
        <div class="amt">${r.big ? "★" : ""}${U.fmtNum(r.amt)}</div>
      </div>`;
    }).join("");
    const scr = openScreen("login", "7-DAY UPLINK", `
      <p class="muted center">Log in daily. Miss a day and the streak resets — your brain hates the loss more than it wanted the reward.</p>
      <div class="login-grid">${cells}</div>
      <div class="center" style="margin-top:20px">
        <button class="btn primary big" id="claimLogin" ${d.loginClaimedToday ? "disabled" : ""}>${d.loginClaimedToday ? "CLAIMED TODAY" : "CLAIM DAY " + (todayIdx + 1)}</button>
      </div>`);
    const btn = $("#claimLogin", scr);
    if (btn) btn.onclick = () => {
      const r = mon.claimLogin();
      if (r) { M.audio.sfx.coin(); toast("+" + r.label); refreshCur(scr); btn.disabled = true; btn.textContent = "CLAIMED TODAY";
        U.$$(".login-day", scr)[todayIdx].classList.add("claimed");
        refreshHomeBadges(); }
    };
  }

  /* ================= OFFERS ================= */
  function showOffers() {
    const items = D.OFFERS.map((o) => offerCard(o)).join("");
    const scr = openScreen("offers", "LIMITED // BLACK MARKET", items);
    wireOffers(scr);
    tickTimers(scr);
  }
  function offerCard(o) {
    const st = mon.offerState(o.id);
    if (o.once && st.done) return "";
    const flag = o.flag ? `<div class="value-flag">${o.flag}</div>` : "";
    const give = o.tiers ? o.tiers[Math.min(st.bought, o.tiers.length - 1)].give : o.give;
    const giveTxt = give.map(([k, v]) => k === "char" ? "★ " + D.CHARS[v].name : U.fmtNum(v) + " " + k).join(" · ");
    return `<div class="offer" data-offer="${o.id}">
      ${flag}
      <div class="oico" style="background:radial-gradient(circle,#2a1d05,#0a0702);display:flex;align-items:center;justify-content:center;font-size:30px">🎁</div>
      <div class="otxt">
        <h4>${o.name}</h4>
        <p>${o.blurb}</p>
        <p style="color:#eaffef;margin-top:4px">${giveTxt}</p>
        <div class="otimer" data-exp="${S.data.offerExpires[o.id] || 0}">⏳ —</div>
      </div>
      <button class="btn gold" data-buy="${o.id}">${o.price}</button>
    </div>`;
  }
  function wireOffers(scr) {
    U.$$("[data-buy]", scr).forEach((b) => b.onclick = () => {
      const id = b.dataset.buy;
      const r = mon.buyOffer(id);
      if (r.ok) {
        M.audio.sfx.coin(); toast("ACQUIRED"); confettiFlash();
        refreshCur(scr); refreshHomeBadges();
        // re-render that card
        const o = D.OFFERS.find((x) => x.id === id);
        const card = b.closest(".offer");
        const st = mon.offerState(id);
        if (st.done) { card.style.transition = ".3s"; card.style.opacity = ".4"; b.disabled = true; b.textContent = "DONE"; }
        else card.outerHTML = offerCard(o), wireOffers(scr);
      }
    });
  }

  /* ================= SHOP (currency bundles) ================= */
  function showShop() {
    const rp = D.BUNDLES.redpills.map((b) => bundleRow("redpills", b)).join("");
    const by = D.BUNDLES.bytes.map((b) => bundleRow("bytes", b)).join("");
    const scr = openScreen("shop", "SHOP // TOP-UP", `
      <div class="section-h">◆ REDPILLS</div>${rp}
      <div class="section-h">¤ BYTES</div>${by}
      <p class="disclaimer">SIMULATED STORE — no real payment, no network. "Prices" are cosmetic labels; tapping grants in-game currency only. First top-up of each pack is doubled (a real conversion tactic, reproduced here for study).</p>`);
    U.$$("[data-bundle]", scr).forEach((b) => b.onclick = () => {
      const [type, id] = b.dataset.bundle.split(":");
      const r = mon.buyBundle(type, id);
      if (r.ok) { M.audio.sfx.coin(); confettiFlash(); toast("+" + U.fmtNum(r.amt) + " " + type); refreshCur(scr);
        b.closest(".bundle").querySelector(".firstx") && (b.closest(".bundle").querySelector(".firstx").style.display = "none"); }
      else if (r.error === "poor") toast("NOT ENOUGH ◆");
    });
  }
  function bundleRow(type, b) {
    const d = S.data; const first = !b.cur && !d.firstTopup[b.id];
    const price = b.cur ? `${b.price} ${curIco(b.cur)}` : b.price;
    return `<div class="bundle">
      <div class="amt2"><span style="font-size:22px">${curIco(type)}</span> ${U.fmtNum(b.amt)}
        ${first ? `<span class="firstx" style="color:var(--gold);font-size:11px;margin-left:6px">2× FIRST!</span>` : ""}
        ${b.best ? `<span class="tag best" style="position:static;margin-left:6px">BEST VALUE</span>` : ""}</div>
      <button class="price" data-bundle="${type}:${b.id}">${price}${b.ad ? " ▶" : ""}</button>
    </div>`;
  }

  /* ================= GACHA ================= */
  function showGacha() {
    const g = D.GACHA; const d = S.data;
    const feat = D.CHARS[g.featured];
    const scr = openScreen("gacha", "CONSTRUCT LOADOUT", `
      <div class="banner">
        <canvas id="banCanvas"></canvas>
        <div class="banner-info">
          <h3>${feat.name} <span class="rarlabel r-SSR">SSR</span></h3>
          <div class="rateup">★ RATE-UP // ${feat.title}</div>
        </div>
      </div>
      <div class="pity">pity <b>${d.pity}</b> / ${g.hardPity} — guaranteed SSR at hard pity.
        <br><span class="muted">SSR ${(mon.effectiveRates(d.pity).SSR*100).toFixed(2)}% · SR ${(g.rates.SR*100)|0}% · R ${(g.rates.R*100)|0}%</span></div>
      <div class="pull-row">
        <button class="btn" data-pull="1">PULL ×1<small>◆ ${g.cost1}</small></button>
        <button class="btn gold" data-pull="10">PULL ×10<small>◆ ${g.cost10} · 1 SR+ guaranteed</small></button>
      </div>
      <p class="disclaimer">Variable-ratio reward schedule + pity counter (goal-gradient). This is the core dopamine engine of gacha. Currency here is simulated.</p>`);
    // animated banner portrait + rain
    const ban = $("#banCanvas", scr);
    animatePortrait(ban, feat);
    U.$$("[data-pull]", scr).forEach((b) => b.onclick = () => doPull(+b.dataset.pull, scr));
  }
  function doPull(n, scr) {
    const r = mon.pull(n);
    if (r.error === "insufficient") { toast("NEED ◆ " + r.need + " MORE"); shake(scr); return showShop(); }
    M.audio.sfx.riser(1.2);
    setTimeout(() => revealPulls(r.results, () => {
      refreshCur(scr);
      // rebuild pity text
      showGacha();
    }), 1100);
  }
  function revealPulls(results, done) {
    let i = 0;
    const overlay = el("div"); overlay.id = "reveal"; document.body.appendChild(overlay);
    const best = results.reduce((a, b) => rank(b.rar) > rank(a.rar) ? b : a, results[0]);
    function rank(r) { return { R: 0, SR: 1, SSR: 2 }[r]; }

    function showOne(res) {
      overlay.innerHTML = "";
      const c = res.char;
      const card = el("div", "reveal-card rar r-" + res.rar);
      card.style.cssText += `width:min(70vw,300px);background:linear-gradient(160deg,${M.sprites.hexa(c.accent,.2)},#02040a);`;
      const cv = el("canvas"); cv.style.cssText = "position:absolute;inset:0;width:100%;height:100%;border-radius:12px";
      card.appendChild(cv);
      const name = el("div", "reveal-name", `<span class="rarlabel r-${res.rar}">${res.rar}</span> ${c.name}${res.dupe ? `<br><small style="font-size:13px;color:#9dffc4">DUPLICATE → +${res.shards} shards</small>` : `<br><small style="font-size:13px;color:#9dffc4">${res.dupe ? "" : "NEW OPERATOR"}</small>`}`);
      card.appendChild(name);
      overlay.appendChild(card);
      const skip = el("div", "reveal-skip", "tap to continue ▸"); overlay.appendChild(skip);
      // draw portrait
      requestAnimationFrame(() => animatePortrait(cv, c));
      M.audio.sfx.reveal(res.rar);
      if (res.rar !== "R") confettiFlash(res.rar === "SSR" ? "#ffd24a" : "#b14cff");
    }
    function next() {
      if (i >= results.length) {
        // multi summary if 10-pull
        if (results.length > 1) return summary();
        cleanup(); return;
      }
      showOne(results[i]); i++;
    }
    function summary() {
      overlay.innerHTML = "";
      const wrap = el("div", "reveal-multi");
      results.forEach((res) => {
        const m = el("div", "mini rar r-" + res.rar, "");
        m.style.background = `linear-gradient(160deg,${M.sprites.hexa(res.char.accent,.4)},#02040a)`;
        const cv = el("canvas"); cv.style.cssText = "position:absolute;inset:0;width:100%;height:100%;border-radius:8px";
        m.style.position = "relative"; m.appendChild(cv);
        m.appendChild(el("div", "un", res.char.name + (res.dupe ? " +" + res.shards : "")));
        m.querySelector(".un") || m.appendChild(el("div"));
        wrap.appendChild(m);
        requestAnimationFrame(() => smallPortrait(cv, res.char));
      });
      overlay.appendChild(wrap);
      const cont = el("button", "btn primary", "CONTINUE"); cont.style.marginTop = "16px";
      cont.onclick = cleanup; overlay.appendChild(cont);
    }
    function cleanup() { overlay.remove(); done && done(); }
    overlay.onclick = (e) => { if (e.target.tagName !== "BUTTON") next(); };
    next();
  }
  function smallPortrait(canvas, char) {
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const w = canvas.clientWidth || 64, h = canvas.clientHeight || 85;
    canvas.width = w * dpr; canvas.height = h * dpr;
    const ctx = canvas.getContext("2d"); ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    M.sprites.portrait(ctx, w, h, char, 0);
  }

  /* ================= ROSTER ================= */
  function showRoster() {
    const d = S.data;
    const cells = D.ROSTER.map((id) => {
      const c = D.CHARS[id]; const owned = d.rosterOwned[id]; const sel = d.selected === id;
      return `<div class="unit rar r-${c.rarity} ${owned ? "" : "locked"} ${sel ? "sel" : ""}" data-pick="${id}">
        <canvas class="unitc"></canvas>
        ${owned ? "" : '<div class="lock">🔒</div>'}
        <div class="un"><span class="rarlabel r-${c.rarity}">${c.rarity}</span> ${c.name}</div>
      </div>`;
    }).join("");
    const scr = openScreen("roster", "OPERATORS", `<div class="roster">${cells}</div>
      <div id="unitInfo" class="card" style="margin-top:14px"><p class="muted center">select an operator</p></div>`);
    U.$$(".unit", scr).forEach((u) => {
      const id = u.dataset.pick; const c = D.CHARS[id];
      const cv = u.querySelector(".unitc"); cv.style.cssText = "width:100%;height:100%;display:block";
      requestAnimationFrame(() => smallPortrait(cv, c));
      u.onclick = () => {
        M.audio.sfx.ui();
        if (!d.rosterOwned[id]) { toast("LOCKED — pull on Construct"); return; }
        d.selected = id; S.save();
        U.$$(".unit", scr).forEach((x) => x.classList.remove("sel")); u.classList.add("sel");
        $("#unitInfo", scr).innerHTML = `<div class="rarlabel r-${c.rarity}" style="font-size:18px">${c.name} — ${c.title}</div>
          <p class="muted">${c.desc}</p>
          <p class="muted">HP ×${c.stats.hp} · DMG ×${c.stats.dmg} · SPD ×${c.stats.spd}</p>
          <p style="color:#eaffef">START: ${D.WEAPONS[c.start].name} — ULT: ${c.ult}</p>`;
      };
    });
  }

  /* ================= META UPGRADES ================= */
  function showMeta() {
    const rows = Object.values(D.META).map((m) => metaRow(m)).join("");
    const scr = openScreen("meta", "PERMANENT UPGRADES", `
      <p class="muted center">Spend ¤ Bytes for permanent power across every run.</p>${rows}`);
    wireMeta(scr);
  }
  function metaRow(m) {
    const lv = mon.metaLevel(m.id); const maxed = lv >= m.max;
    const cost = maxed ? 0 : m.cost[lv];
    const pips = Array.from({ length: m.max }, (_, i) => `<div class="pip ${i < lv ? "on" : ""}"></div>`).join("");
    return `<div class="meta-row" data-meta="${m.id}">
      <div class="mi">${m.icon}</div>
      <div class="mt"><h4>${m.name} <span style="color:#9dffc4">Lv ${lv}/${m.max}</span></h4>
        <p>${m.desc}</p><div class="pips">${pips}</div></div>
      <button class="btn gold" data-buymeta="${m.id}" ${maxed ? "disabled" : ""}>${maxed ? "MAX" : "¤ " + U.fmtNum(cost)}</button>
    </div>`;
  }
  function wireMeta(scr) {
    U.$$("[data-buymeta]", scr).forEach((b) => b.onclick = () => {
      const id = b.dataset.buymeta; const r = mon.metaBuy(id);
      if (r.ok) { M.audio.sfx.levelup(); refreshCur(scr); const row = b.closest(".meta-row"); row.outerHTML = metaRow(D.META[id]); wireMeta(scr); }
      else if (r.error === "poor") { toast("NEED ¤ " + r.need); shake(scr); }
    });
  }

  /* ================= BATTLE PASS ================= */
  function showBattlePass() {
    const d = S.data; const prog = mon.bpProgress();
    const tiers = Array.from({ length: D.BP.maxTier }, (_, t) => {
      const rw = D.BP.reward(t); const unlocked = t <= prog.tier;
      const fc = d.bpClaimed[t + ":free"], pc = d.bpClaimed[t + ":prem"];
      return `<div class="bp-tier">
        <div class="lvl">T${t + 1}</div>
        <div class="bp-cell prem ${!d.bpPremium ? "locked" : pc ? "claimed" : ""}" data-bp="${t}:prem">${rwTxt(rw.prem)}</div>
        <div class="bp-cell ${!unlocked ? "locked" : fc ? "claimed" : ""}" data-bp="${t}:free">${rwTxt(rw.free)}</div>
      </div>`;
    }).join("");
    const scr = openScreen("pass", D.BP.name, `
      <div class="bp-head">
        <div>TIER <b style="color:var(--gold)">${prog.tier + 1}</b> / ${D.BP.maxTier} · ${prog.into}/${prog.need} XP</div>
        <div id="xpbar" style="max-width:340px;margin:8px auto"><div id="xpfill" style="width:${prog.pct*100}%"></div></div>
        ${d.bpPremium ? '<div class="rarlabel r-SSR">★ PREMIUM ACTIVE</div>' : '<button class="btn gold" id="buyBp">UNLOCK PREMIUM // ' + D.BP.premiumPrice + '</button>'}
      </div>
      <p class="muted center">Top row = premium. Earn XP by playing & pulling. Endowed progress drives completion.</p>
      <div class="bp-track">${tiers}</div>`);
    U.$$("[data-bp]", scr).forEach((cell) => cell.onclick = () => {
      const [t, track] = cell.dataset.bp.split(":");
      const r = mon.bpClaim(+t, track);
      if (r.ok) { M.audio.sfx.coin(); toast("CLAIMED"); refreshCur(scr); cell.classList.add("claimed"); refreshHomeBadges(); }
      else if (r.error === "premium") toast("PREMIUM LOCKED");
      else if (r.error === "locked") toast("TIER LOCKED — earn XP");
    });
    const bp = $("#buyBp", scr);
    if (bp) bp.onclick = () => { mon.bpBuyPremium(); M.audio.sfx.coin(); confettiFlash("#ffd24a"); showBattlePass(); };
  }
  function rwTxt(rw) { const [k, v] = rw; return `<span style="font-size:16px">${curIco(k)}</span><span>${U.fmtNum(v)}</span>`; }

  /* ================= SETTINGS ================= */
  function showSettings() {
    const d = S.data;
    const scr = openScreen("settings", "SYSTEM", `
      <div class="meta-row"><div class="mi">♪</div><div class="mt"><h4>Music</h4><p>synthwave combat score</p></div>
        <button class="btn" id="tg-music">${d.musicOn === false ? "OFF" : "ON"}</button></div>
      <div class="meta-row"><div class="mi">🔊</div><div class="mt"><h4>SFX</h4><p>impacts & UI</p></div>
        <button class="btn" id="tg-sfx">${d.sfxOn === false ? "OFF" : "ON"}</button></div>
      <div class="meta-row"><div class="mi">⌨</div><div class="mt"><h4>Controls</h4><p>WASD / arrows + mouse on desktop · drag anywhere on touch</p></div></div>
      <div class="center" style="margin-top:20px"><button class="btn red" id="wipe">WIPE SAVE</button></div>
      <p class="disclaimer">RESIDUAL — an original Matrix-aesthetic survivor built as a study of live-service monetization. All art & audio generated procedurally in-engine. No real currency, accounts, or network.</p>`);
    $("#tg-music", scr).onclick = (e) => { const on = !(d.musicOn !== false); M.audio.toggleMusic(on); e.target.textContent = on ? "ON" : "OFF"; };
    $("#tg-sfx", scr).onclick = (e) => { const on = !(d.sfxOn !== false); M.audio.toggleSfx(on); e.target.textContent = on ? "ON" : "OFF"; M.audio.sfx.ui(); };
    $("#wipe", scr).onclick = () => { if (confirm("Erase all progress?")) { S.reset(); close(scr); showHome(); } };
  }

  /* ================= LEVEL UP ================= */
  function showLevelUp(player, cb) {
    const choices = rollChoices(player);
    const cards = choices.map((ch, i) => luCard(ch, i)).join("");
    const scr = el("div", "screen"); scr.id = "levelup";
    scr.innerHTML = `<div class="lu-wrap">
      <div class="lu-title">LEVEL ${player.level}</div>
      <div class="lu-sub">// SELECT UPGRADE</div>
      <div class="lu-cards">${cards}</div>
    </div>`;
    screens().appendChild(scr);
    U.$$(".lu-card", scr).forEach((cardEl, i) => cardEl.onclick = () => {
      M.audio.sfx.ui(); scr.remove(); cb(choices[i]);
    });
  }
  function rollChoices(player) {
    const pool = [];
    // EVOLUTIONS available right now (base maxed + required passive maxed)
    const evos = [];
    for (const base in D.EVO) {
      const rec = D.EVO[base];
      const w = player.weapons[base];
      const passLv = player.passives[rec.passive] || 0;
      if (w && w.lvl >= w.def.max && passLv >= D.PASSIVES[rec.passive].max && !player.weapons[rec.into])
        evos.push({ type: "evolve", base, into: rec.into });
    }
    // upgrade owned weapons not maxed (evolved weapons have max 1 so they drop out)
    for (const id in player.weapons) { const w = player.weapons[id]; if (w.lvl < w.def.max) pool.push({ type: "weapon", id, lvlTo: w.lvl + 1, owned: true }); }
    // new weapons (cap at 6 weapons; never offer evolved forms directly)
    const wcount = Object.keys(player.weapons).length;
    if (wcount < 6) for (const id in D.WEAPONS) if (!player.weapons[id] && !D.WEAPONS[id].evolved) pool.push({ type: "weapon", id, lvlTo: 1, owned: false });
    // passives
    for (const id in D.PASSIVES) { const lv = player.passives[id] || 0; if (lv < D.PASSIVES[id].max) pool.push({ type: "passive", id, lvlTo: lv + 1, owned: lv > 0 }); }
    // shuffle, then guarantee any available evolution is shown first
    const shuffled = pool.sort(() => Math.random() - 0.5);
    const out = evos.slice(0, 2);
    for (const c of shuffled) { if (out.length >= 3) break; out.push(c); }
    while (out.length < 3) out.push(U.chance(0.5) ? { type: "heal" } : { type: "bytes" });
    return out.slice(0, 3);
  }
  function luCard(ch, i) {
    if (ch.type === "heal") return `<div class="lu-card"><div class="luico" style="color:#ff6b8a">✚</div><div class="lutxt"><h4>Full Recompile</h4><p>Restore all HP.</p></div></div>`;
    if (ch.type === "bytes") return `<div class="lu-card"><div class="luico" style="color:#ffd24a">¤</div><div class="lutxt"><h4>Data Cache</h4><p>+200 Bytes this run.</p></div></div>`;
    if (ch.type === "evolve") {
      const ev = D.WEAPONS[ch.into];
      return `<div class="lu-card evo"><div class="luico" style="color:${ev.color};font-size:26px">${ev.icon}</div>
        <div class="lutxt"><h4>${ev.name} <span style="color:#ffd24a">★ EVOLVE</span></h4><p>${ev.desc}</p></div>
        <div class="lu-lv" style="color:#ffd24a">MAX</div></div>`;
    }
    const def = ch.type === "weapon" ? D.WEAPONS[ch.id] : D.PASSIVES[ch.id];
    const isNew = !ch.owned;
    return `<div class="lu-card ${ch.lvlTo >= (def.max || 5) ? "evo" : ""}">
      <div class="luico" style="color:${def.color};font-size:26px">${def.icon}</div>
      <div class="lutxt"><h4>${def.name} ${isNew ? '<span style="color:#7CFF4E">NEW</span>' : ""}</h4><p>${def.desc}</p></div>
      <div class="lu-lv">Lv ${ch.lvlTo}</div>
    </div>`;
  }

  /* ================= GAME OVER ================= */
  function showGameOver(stats) {
    hud().classList.add("hidden");
    const reward = mon.awardRun(stats);
    const won = stats.boss;
    const scr = el("div", "screen solid"); scr.id = "gameover";
    scr.innerHTML = `
      <div class="go-title">${won ? "SYSTEM CLEARED" : "DECOMPILED"}</div>
      <div class="go-sub">${won ? "// the agent fell" : "// connection terminated"}</div>
      <div class="go-stats">
        <div class="go-stat"><b>${U.fmtTime(stats.time)}</b><span>SURVIVED</span></div>
        <div class="go-stat"><b>${stats.kills}</b><span>PURGED</span></div>
        <div class="go-stat"><b>${stats.level}</b><span>LEVEL</span></div>
      </div>
      <div class="go-reward">EXTRACTED &nbsp; ¤ ${U.fmtNum(reward.bytes)} ${reward.rp ? "· ◆ " + reward.rp : ""}</div>
      <div style="display:flex;gap:12px">
        <button class="btn" id="goHome">HUB</button>
        <button class="btn primary" id="goAgain">RE-ENTER</button>
      </div>`;
    screens().appendChild(scr);
    confettiFlash(won ? "#ffd24a" : "#00ff66");
    $("#goAgain", scr).onclick = () => { M.audio.sfx.ui(); closeAll(); hud().classList.remove("hidden"); M.game.start(S.data.selected); };
    $("#goHome", scr).onclick = () => { M.audio.sfx.ui(); showHome(); };
  }

  /* ================= HUD ================= */
  function updateHud(game) {
    const p = game.player; if (!p) return;
    const xpf = document.getElementById("xpfill"); if (xpf) xpf.style.width = (p.xp / p.xpNext * 100) + "%";
    const xpt = document.getElementById("xptext"); if (xpt) xpt.textContent = "LV " + p.level;
    const hpf = document.getElementById("hpfill"); if (hpf) hpf.style.width = U.clamp(p.hp / p.maxhp * 100, 0, 100) + "%";
    const hpt = document.getElementById("hptext"); if (hpt) hpt.textContent = Math.ceil(Math.max(0, p.hp)) + " / " + Math.ceil(p.maxhp);
    const tm = document.getElementById("timer"); if (tm) tm.textContent = U.fmtTime(game.time);
    const kc = document.getElementById("killcount"); if (kc) kc.textContent = "⛧ " + game.kills;
  }

  /* ---------------- helpers ---------------- */
  function refreshHomeBadges() {
    const home = document.getElementById("home"); if (!home) return;
    // simplest: just re-evaluate badges by re-rendering rails would lose state; instead toggle login badge
    const loginBtn = home.querySelector('[data-nav="login"] .badge');
    if (mon.loginAvailable()) { if (!loginBtn) {} } else if (loginBtn) loginBtn.remove();
  }
  function tickTimers(scr) {
    const update = () => {
      if (!scr.isConnected) return;
      U.$$("[data-exp]", scr).forEach((e) => {
        const exp = +e.dataset.exp; const rem = exp - Date.now();
        e.textContent = rem > 0 ? "⏳ DISAPPEARS IN " + U.fmtTime(rem / 1000) + (rem > 3600e3 ? " (" + Math.floor(rem / 3600e3) + "h)" : "") : "⏳ EXPIRED";
      });
      requestAnimationFrame(update);
    };
    update();
  }
  function confettiFlash(color = "#00ff66") {
    const f = el("div");
    f.style.cssText = `position:fixed;inset:0;z-index:70;pointer-events:none;background:radial-gradient(circle at 50% 45%,${M.sprites.hexa(color,.5)},transparent 60%);opacity:0;transition:opacity .15s`;
    document.body.appendChild(f);
    requestAnimationFrame(() => { f.style.opacity = "1"; setTimeout(() => { f.style.opacity = "0"; setTimeout(() => f.remove(), 300); }, 120); });
  }
  function shake(node) { node.animate([{ transform: "translateX(0)" }, { transform: "translateX(-8px)" }, { transform: "translateX(8px)" }, { transform: "translateX(0)" }], { duration: 200 }); }

  M.ui = {
    toast, showHome, showLevelUp, showGameOver, updateHud,
    showGacha, showShop, showLogin, showOffers, showBattlePass, showRoster, showMeta, showSettings,
    nav, closeAll,
  };
})();
