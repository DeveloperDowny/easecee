// Dev check: run `MOCK_AGENT=1 PORT=3111 node server.js` first, then `node test/smoke.js [screenshot.png]`
const { chromium } = require("playwright");
(async () => {
  const b = await chromium.launch(); const p = await b.newPage({ viewport: { width: 420, height: 1100 }, deviceScaleFactor: 1 });
  const errs = []; p.on("pageerror", (e) => errs.push(e.message)); p.on("console", (m) => m.type() === "error" && errs.push(m.text()));
  await p.goto("http://localhost:3111"); await p.fill("#q", "overview"); await p.click("#ask button");
  await p.waitForSelector(".stat .v"); 
  const first = await p.$$eval(".stat .v", (n) => n.map((x) => x.textContent));
  await p.click("button:has-text('7 days')"); await p.waitForTimeout(1500);
  const after = await p.$$eval(".stat .v", (n) => n.map((x) => x.textContent));
  const pressed = await p.$eval("button[aria-pressed=true]", (x) => x.textContent);
  await p.click("button:has-text('Yes, try it')");
  const done = await p.textContent(".done");
  await p.screenshot({ path: process.argv[2] || "smoke.png", fullPage: true });
  console.log(JSON.stringify({ first, after, pressed, done, errs, svgs: await p.$$eval("svg", (n) => n.length) }));
  await b.close();
})();
