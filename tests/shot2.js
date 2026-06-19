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
  // clean skyline: claim login so it won't auto-reopen, then re-show home
  await page.evaluate(() => { try { window.M.mon.claimLogin(); } catch (e) {} window.M.ui.closeAll(); window.M.ui.showHome(); });
  await new Promise((r) => setTimeout(r, 1400));
  await page.screenshot({ path: out + "/shot_home_city.png" });

  // boss arena: start run, pin player invulnerable + parked, spawn bosses
  await page.evaluate(() => { window.M.ui.closeAll(); window.M.game.start("morph_ada"); });
  await new Promise((r) => setTimeout(r, 4000));
  await page.evaluate(() => {
    const g = window.M.game;
    g.player.invuln = 9999; g.player.maxhp = 99999; g.player.hp = 99999;
    window.M.input.vector = () => ({ x: 0, y: 0 });
    g.spawnBoss("boss_sentinel", 1.2);
    g.spawnBoss("boss_twins", 1.2);
  });
  await new Promise((r) => setTimeout(r, 3500));
  await page.screenshot({ path: out + "/shot_boss.png" });
  console.log("ERRORS:", errs.length ? errs.slice(0, 5).join(" | ") : "none");
  await browser.close();
})();
