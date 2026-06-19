/* tests/shot.js — load the real game in headless Chromium and screenshot
 * the home hub, gacha banner, and a live gameplay frame. */
const puppeteer = require("puppeteer");
const path = require("path");

(async () => {
  const browser = await puppeteer.launch({
    headless: "new",
    args: ["--no-sandbox", "--use-gl=swiftshader", "--enable-webgl", "--ignore-gpu-blocklist"],
  });
  const page = await browser.newPage();
  await page.setViewport({ width: 414, height: 896, deviceScaleFactor: 2 });
  const errs = [];
  page.on("pageerror", (e) => errs.push("PAGEERR: " + e.message));
  page.on("console", (m) => { if (m.type() === "error") errs.push("CONSOLE: " + m.text()); });

  await page.goto("http://127.0.0.1:8099/index.html", { waitUntil: "networkidle0" });
  const out = path.join(__dirname, "..", "assets");

  // boot screen
  await page.screenshot({ path: out + "/shot_boot.png" });

  // JACK IN
  await page.click("#bootBtn");
  await new Promise((r) => setTimeout(r, 1200));
  await page.screenshot({ path: out + "/shot_home.png" });

  // close any auto-opened login, then open gacha
  await page.evaluate(() => { window.M.ui.closeAll(); window.M.ui.showHome(); });
  await new Promise((r) => setTimeout(r, 900));
  await page.screenshot({ path: out + "/shot_home2.png" });

  await page.evaluate(() => window.M.ui.showGacha());
  await new Promise((r) => setTimeout(r, 1400));
  await page.screenshot({ path: out + "/shot_gacha.png" });

  await page.evaluate(() => { window.M.ui.closeAll(); window.M.ui.showShop(); });
  await new Promise((r) => setTimeout(r, 600));
  await page.screenshot({ path: out + "/shot_shop.png" });

  // start a run and let it build up, then screenshot combat
  await page.evaluate(() => { window.M.ui.closeAll(); window.M.game.start("morph_ada"); });
  // drive the player in a circle + accumulate time by faking input
  await page.evaluate(() => {
    let a = 0;
    window.__drive = setInterval(() => {
      a += 0.08;
      const v = { x: Math.cos(a), y: Math.sin(a) };
      window.M.input.vector = () => v;
    }, 50);
  });
  await new Promise((r) => setTimeout(r, 9000));
  // auto-pick any level-up to keep playing
  await page.evaluate(() => {
    const lu = document.querySelector("#levelup .lu-card");
    if (lu) lu.click();
  });
  await new Promise((r) => setTimeout(r, 500));
  await page.screenshot({ path: out + "/shot_combat.png" });

  await new Promise((r) => setTimeout(r, 6000));
  await page.evaluate(() => { const lu = document.querySelector("#levelup .lu-card"); if (lu) lu.click(); });
  await page.screenshot({ path: out + "/shot_combat2.png" });

  // force a boss for a visual check
  await page.evaluate(() => { window.M.game.spawnBoss("boss_sentinel", 1); window.M.game.spawnBoss("boss_twins", 1); });
  await new Promise((r) => setTimeout(r, 2500));
  await page.screenshot({ path: out + "/shot_boss.png" });

  const stats = await page.evaluate(() => ({
    state: window.M.game.state, time: Math.round(window.M.game.time),
    kills: window.M.game.kills, level: window.M.game.player.level,
    enemies: window.M.game.enemies.length, bullets: window.M.game.bullets.length,
  }));
  console.log("RUN STATE:", JSON.stringify(stats));
  console.log("ERRORS:", errs.length ? errs.slice(0, 8).join("\n") : "none");

  await browser.close();
  process.exit(errs.length ? 2 : 0);
})();
