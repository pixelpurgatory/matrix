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
  await page.evaluate(() => { window.M.save.reset(); window.M.ui.closeAll(); window.M.ui.showShop(); });
  await new Promise((r) => setTimeout(r, 700));
  await page.screenshot({ path: out + "/shot_shop.png" });

  // perform a real purchase via the actual DOM button and check state
  const before = await page.evaluate(() => ({ d: window.M.save.data.dollars, rp: window.M.save.data.redpills }));
  await page.evaluate(() => { const b = document.querySelector('[data-bundle="redpills:rp1"]'); if (b) b.click(); });
  await new Promise((r) => setTimeout(r, 500));
  const after = await page.evaluate(() => ({ d: window.M.save.data.dollars, rp: window.M.save.data.redpills }));

  // verify offline persistence: reload the page, read localStorage-backed save
  await page.reload({ waitUntil: "networkidle0" });
  const persisted = await page.evaluate(() => { window.M.save.load(); return { d: window.M.save.data.dollars, rp: window.M.save.data.redpills }; });

  console.log("BEFORE :", JSON.stringify(before));
  console.log("AFTER  :", JSON.stringify(after), "(expect $-0.99, +160 redpills)");
  console.log("RELOAD :", JSON.stringify(persisted), "(should equal AFTER -> offline save works)");
  console.log("ERRORS :", errs.length ? errs.slice(0, 4).join(" | ") : "none");
  await browser.close();
})();
