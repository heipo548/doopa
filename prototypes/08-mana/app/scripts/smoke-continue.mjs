// 「つづきから」検証（開発用）: 直前の E2E 走破で書かれたセーブから復帰できるか
import puppeteer from 'puppeteer-core';

const CHROME = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const URL = process.env.SMOKE_URL ?? 'http://localhost:4173/?debug=1';
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const px = (x) => (x * 1280) / 960;
const py = (y) => (y * 720) / 540;

const browser = await puppeteer.launch({
  executablePath: CHROME,
  headless: true,
  args: ['--no-sandbox', '--mute-audio', '--disable-dev-shm-usage', '--enable-unsafe-swiftshader'],
});
const page = await browser.newPage();
await page.setViewport({ width: 1280, height: 720 });
const errors = [];
page.on('pageerror', (e) => errors.push(e.message));

await page.goto(URL, { waitUntil: 'networkidle2' });
await sleep(4500);

// E2E と同じセーブ内容を直接書き込んでから（ベンチ保存時点の再現）リロード
await page.evaluate(() => {
  localStorage.setItem(
    'mana-demo-v1',
    JSON.stringify({
      name: 'ツヅキ',
      flags: ['intro_done', 'p0_done', 'p1_done', 'p2_bridge', 'bench1_built'],
      knownGlyphs: ['人', '火', '点', '日', '月', '明', '木', '休'],
      gems: 0,
      pos: { x: 1880, y: 1195 },
      playtime: 300,
      hintLevels: { kamado: 3, bigshadow: 1 },
    }),
  );
});
await page.reload({ waitUntil: 'networkidle2' });
await sleep(4500);
await page.screenshot({ path: 'smoke-out/20_title_continue.png' });

// つづきから（2ボタン目: y=498）
await page.mouse.click(px(480), py(498));
await sleep(2500);

const checks = await page.evaluate(() => {
  const g = window.__mana;
  const ctx = g.registry.get('ctx');
  const w = g.scene.getScene('World');
  const p = w.playerPos();
  return {
    world: g.scene.isActive('World'),
    name: ctx.playerName,
    pos: p,
    bridge: ctx.flags.has('p2_bridge'),
    glyphs: ctx.inv.list().join(''),
    hintKamado: ctx.hints.stage('kamado'),
    playtime: Math.round(ctx.playtime),
  };
});
await page.screenshot({ path: 'smoke-out/21_continued.png' });
console.log(JSON.stringify(checks, null, 2));

const ok =
  checks.world &&
  checks.name === 'ツヅキ' &&
  Math.abs(checks.pos.x - 1880) < 5 &&
  checks.bridge &&
  checks.glyphs.includes('明') &&
  checks.hintKamado === 3 &&
  checks.playtime >= 300;

await browser.close();
if (errors.length) {
  console.log('JS ERRORS:', errors.join(' / '));
  process.exit(1);
}
if (!ok) {
  console.log('CONTINUE NG');
  process.exit(1);
}
console.log('CONTINUE OK — セーブ復帰・状態復元を確認');
