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
  await new Promise((r) => setTimeout(r, 900));
  // ensure login is fresh + visible
  await page.evaluate(() => { window.M.save.reset(); window.M.ui.closeAll(); window.M.ui.showLogin(); });
  await new Promise((r) => setTimeout(r, 1600));
  await page.screenshot({ path: out + "/shot_login.png" });
  // claim, capture post-claim state
  await page.evaluate(() => document.getElementById("claimLogin").click());
  await new Promise((r) => setTimeout(r, 900));
  await page.screenshot({ path: out + "/shot_login_claimed.png" });
  console.log("ERRORS:", errs.length ? errs.slice(0, 5).join(" | ") : "none");
  await browser.close();
})();
