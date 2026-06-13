// UI クローズアップ撮影（開発用）: 会話枠と名付け盤のスクリーンショットを撮る
import puppeteer from 'puppeteer-core';
const CHROME = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const URL = 'http://localhost:4173/?debug=1';
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const px = (x) => (x * 1280) / 960;
const py = (y) => (y * 540 * (720 / 540)) / 540; // = y*1.333

const browser = await puppeteer.launch({
  executablePath: CHROME,
  headless: true,
  args: ['--no-sandbox', '--mute-audio', '--enable-unsafe-swiftshader'],
});
const page = await browser.newPage();
await page.setViewport({ width: 1280, height: 720 });
await page.goto(URL, { waitUntil: 'networkidle2' });
await sleep(4800);
await page.mouse.click(px(480), py(448)); // はじめる
await sleep(1600);
await page.keyboard.down('Escape');
await sleep(1400);
await page.keyboard.up('Escape');
await sleep(2200); // ワールド・イントロ会話が開く
await page.screenshot({ path: 'smoke-out/20_dialogue.png' });

// 会話を送る
const dlgBusy = () => page.evaluate(() => window.__mana.scene.getScene('Dialogue').busy);
while (await dlgBusy()) {
  await page.mouse.click(px(480), py(500));
  await sleep(300);
}
// 全語彙付与 → 竈へ → 名付け盤
await page.keyboard.press('g');
await sleep(300);
await page.keyboard.down('d');
await sleep(880);
await page.keyboard.up('d');
await page.keyboard.down('w');
await sleep(160);
await page.keyboard.up('w');
await sleep(250);
await page.keyboard.down('Space');
await sleep(90);
await page.keyboard.up('Space');
await sleep(1100);
await page.screenshot({ path: 'smoke-out/21_overlay.png' });
// 結字タブも見る
await page.mouse.click(px(535), py(92));
await sleep(500);
// 日と月を置いてみる（おすすめ明滅つき）
const chip = await page.evaluate(() => {
  const list = window.__mana.registry.get('ctx').inv.list();
  const n = Math.min(list.length, 12);
  const xOf = (g) => 480 + ((list.indexOf(g) % 12) - (n - 1) / 2) * 70;
  const yOf = (g) => 372 + Math.floor(list.indexOf(g) / 12) * 72;
  return { hi: { x: xOf('日'), y: yOf('日') }, tsuki: { x: xOf('月'), y: yOf('月') } };
});
await page.mouse.click(px(chip.hi.x), py(chip.hi.y));
await sleep(500);
await page.screenshot({ path: 'smoke-out/22_overlay_ketsuji.png' });
await browser.close();
console.log('UI shots saved');
