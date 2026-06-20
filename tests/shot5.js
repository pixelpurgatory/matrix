const puppeteer = require("puppeteer");
const path = require("path");
(async () => {
  const browser = await puppeteer.launch({ headless: "new", args: ["--no-sandbox", "--use-gl=swiftshader"] });
  const page = await browser.newPage();
  await page.setViewport({ width: 414, height: 896, deviceScaleFactor: 2 });
  const errs = []; page.on("pageerror", (e) => errs.push(e.message));
  await page.goto("http://127.0.0.1:8099/index.html", { waitUntil: "networkidle0" });
  const out = path.join(__dirname, "..", "assets");
  await page.click("#bootBtn");
  await new Promise((r) => setTimeout(r, 800));
  // clean home (claim login so it won't auto-open)
  await page.evaluate(() => { try { window.M.mon.claimLogin(); } catch (e) {} window.M.save.data.dollars = 7.5; window.M.save.save(); window.M.ui.closeAll(); window.M.ui.showHome(); });
  await new Promise((r) => setTimeout(r, 1400));
  await page.screenshot({ path: out + "/shot_home_big.png" });
  // roster (shows $ unlock on locked operators)
  await page.evaluate(() => window.M.ui.showRoster());
  await new Promise((r) => setTimeout(r, 900));
  await page.screenshot({ path: out + "/shot_roster.png" });
  // offers (shows $ pricing + bottom close)
  await page.evaluate(() => { window.M.ui.closeAll(); window.M.ui.showHome(); window.M.ui.showOffers(); });
  await new Promise((r) => setTimeout(r, 700));
  await page.screenshot({ path: out + "/shot_offers.png" });

  // early combat: confirm gentle start (count enemies at ~8s) + HUD $ counter
  await page.evaluate(() => { window.M.ui.closeAll(); window.M.game.start("morph_ada"); });
  let counts = [];
  for (const sec of [5, 10, 22, 30]) {
    await page.evaluate(() => { window.M.input.vector = () => ({ x: Math.cos(Date.now()/300), y: Math.sin(Date.now()/300) }); });
    await new Promise((r) => setTimeout(r, sec === 5 ? 5000 : (sec - counts.length ? 0 : 0)));
  }
  // simpler: sample enemy count over time
  counts = [];
  for (let i = 0; i < 6; i++) { const c = await page.evaluate(() => window.M.game.enemies.length); counts.push(c); await new Promise(r => setTimeout(r, 4000)); }
  await page.screenshot({ path: out + "/shot_combat_early.png" });
  console.log("ENEMY COUNT every ~4s:", counts.join(", "));
  console.log("ERRORS:", errs.length ? errs.slice(0, 5).join(" | ") : "none");
  await browser.close();
})();
