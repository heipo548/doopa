// サブパス配信の動作確認（開発用）: GitHub Pages 相当の配置で
// アセットが解決し、タイトル→ワールドが起動するかを実ブラウザで見る。
import puppeteer from 'puppeteer-core';
const CHROME = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const URL = process.env.URL ?? 'http://localhost:4188/prototypes/08-mana/?debug=1';
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const px = (x) => (x * 1280) / 960;
const py = (y) => (y * 720) / 540;

const errors = [];
const browser = await puppeteer.launch({
  executablePath: CHROME, headless: true,
  args: ['--no-sandbox', '--mute-audio', '--enable-unsafe-swiftshader'],
});
const page = await browser.newPage();
await page.setViewport({ width: 1280, height: 720 });
page.on('pageerror', (e) => errors.push(`pageerror: ${e.message}`));
page.on('console', (m) => { if (m.type() === 'error') errors.push(`console: ${m.text()}`); });
page.on('requestfailed', (r) => errors.push(`reqfail: ${r.url()} ${r.failure()?.errorText}`));

await page.goto(URL, { waitUntil: 'networkidle2', timeout: 30000 });
await sleep(5000);
await page.screenshot({ path: 'dist-verify-title.png' });
await page.mouse.click(px(480), py(448)); // はじめる
await sleep(1500);
await page.keyboard.down('Escape'); await sleep(1400); await page.keyboard.up('Escape'); // プロローグskip
await sleep(1800);
const world = await page.evaluate(() => window.__mana?.scene.isActive('World') ?? false);
await page.screenshot({ path: 'dist-verify-world.png' });
await browser.close();

// フォント等の外部 404 以外の致命的エラーだけを厳しく見る
const fatal = errors.filter((e) => !e.includes('fonts.g') && !e.includes('favicon'));
console.log('World active:', world);
if (fatal.length) { console.log('FATAL:\n' + fatal.join('\n')); process.exit(1); }
if (!world) { console.log('World に到達せず'); process.exit(1); }
console.log('SUBPATH OK — サブフォルダ配信でアセット解決・起動を確認');
