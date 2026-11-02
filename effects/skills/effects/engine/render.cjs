// Renders a prepared job folder (effects.html + cfg.js + frames/ [+ cut/]) to PNG frames with headless Chromium.
//   node render.cjs <jobDir> <outDir> <w> <h> <fps> <nf> [workers]
const path = require('path'), fs = require('fs');
let chromium;
try { ({ chromium } = require('playwright')); } catch (e) {
  try { ({ chromium } = require(path.join(__dirname, 'node_modules', 'playwright'))); } catch (e2) {
    console.error('playwright not found. Run: cd "' + __dirname + '" && npm install playwright && npx playwright install chromium'); process.exit(2); }
}
(async () => {
  const [job, out, w, h, fps, nf, workersArg] = process.argv.slice(2);
  const W = +w, H = +h, FPS = +fps, NF = +nf, WK = Math.max(1, Math.min(8, +(workersArg || 3)));
  fs.mkdirSync(out, { recursive: true });
  const browser = await chromium.launch({ args: ['--allow-file-access-from-files', '--disable-web-security', '--force-color-profile=srgb', '--hide-scrollbars'] });
  const url = 'file://' + path.resolve(job, 'effects.html');
  let next = 0, done = 0; const t0 = Date.now();
  const worker = async () => {
    const page = await browser.newPage({ viewport: { width: W, height: H }, deviceScaleFactor: 1 });
    page.on('pageerror', e => console.error('page error:', e.message));
    await page.goto(url);
    await page.waitForFunction(() => window.__ready === true, null, { timeout: 120000, polling: 100 });
    const err = await page.evaluate(() => window.__err || null); if (err) throw new Error(err);
    while (true) {
      const i = next++; if (i >= NF) break;
      await page.evaluate(t => window.renderFrame(t).then(() => true), i / FPS);
      await page.screenshot({ path: path.join(out, String(i + 1).padStart(5, '0') + '.png'), type: 'png', clip: { x: 0, y: 0, width: W, height: H } });
      done++; if (done % 30 === 0) process.stdout.write(`  rendered ${done}/${NF} frames\r`);
    }
    await page.close();
  };
  await Promise.all(Array.from({ length: WK }, worker));
  await browser.close();
  console.log(`  rendered ${NF} frames in ${((Date.now() - t0) / 1000).toFixed(1)} s          `);
})().catch(e => { console.error(String(e && e.stack || e)); process.exit(1); });
