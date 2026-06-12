// E2E スモークテスト（開発用・提出物には含めない）
// タイトル→プロローグ→P0〜P4→S1〜S3→ボス3フェーズ→エンドカードまで自動走破する。
// 実行: npm run build && npx vite preview --port 4173 & node scripts/smoke.mjs
import puppeteer from 'puppeteer-core';
import { mkdirSync } from 'node:fs';

const CHROME = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const URL = process.env.SMOKE_URL ?? 'http://localhost:4173/?debug=1';
const OUT = 'smoke-out';
mkdirSync(OUT, { recursive: true });

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const px = (x) => (x * 1280) / 960;
const py = (y) => (y * 720) / 540;

const errors = [];
const browser = await puppeteer.launch({
  executablePath: CHROME,
  headless: true,
  args: ['--no-sandbox', '--mute-audio', '--disable-dev-shm-usage', '--enable-unsafe-swiftshader'],
  protocolTimeout: 120000,
});
const page = await browser.newPage();
await page.setViewport({ width: 1280, height: 720 });
page.on('pageerror', (e) => errors.push(`pageerror: ${e.message}`));
page.on('console', (m) => {
  if (m.type() === 'error' && !m.text().includes('404')) errors.push(`console: ${m.text()}`);
});

const shot = (name) => page.screenshot({ path: `${OUT}/${name}.png` });
const fail = async (msg) => {
  console.log(`FAIL: ${msg}`);
  if (errors.length) {
    console.log('=== JS ERRORS ===');
    for (const e of errors) console.log(e);
  }
  await shot('ZZ_fail');
  await browser.close();
  process.exit(1);
};

// --- ゲーム内状態の読み取りヘルパ（?debug=1 で window.__mana を公開している） ---
const playerPos = () => page.evaluate(() => window.__mana.scene.getScene('World').playerPos());
const hasFlag = (f) => page.evaluate((ff) => window.__mana.registry.get('ctx').flags.has(ff), f);
const hasGlyph = (g) => page.evaluate((gg) => window.__mana.registry.get('ctx').inv.has(gg), g);
const gems = () => page.evaluate(() => window.__mana.registry.get('ctx').inv.gems);
const dlgBusy = () => page.evaluate(() => window.__mana.scene.getScene('Dialogue').busy);
const bossPhase = () => page.evaluate(() => window.__mana.scene.getScene('World').boss.phase);
const sceneActive = (k) => page.evaluate((kk) => window.__mana.scene.isActive(kk), k);
const vocab = () => page.evaluate(() => window.__mana.registry.get('ctx').inv.list());

async function clickDialogue() {
  await page.mouse.click(px(480), py(500));
}

/** ダイアログが始まるのを待って、終わるまで送る */
async function clearDialogue(waitStart = 3500) {
  const t0 = Date.now();
  while (!(await dlgBusy())) {
    if (Date.now() - t0 > waitStart) return;
    await sleep(150);
  }
  while (await dlgBusy()) {
    await clickDialogue();
    await sleep(280);
  }
  await sleep(350);
}

/** プレイヤー座標を読みながら目的地へ歩く（途中の会話は送る） */
async function walkTo(tx, ty, timeout = 30000) {
  const t0 = Date.now();
  while (Date.now() - t0 < timeout) {
    if (await dlgBusy()) {
      await clickDialogue();
      await sleep(250);
      continue;
    }
    const p = await playerPos();
    const dx = tx - p.x;
    const dy = ty - p.y;
    if (Math.hypot(dx, dy) < 26) return true;
    const keys = [];
    if (dx > 10) keys.push('d');
    else if (dx < -10) keys.push('a');
    if (dy > 10) keys.push('s');
    else if (dy < -10) keys.push('w');
    for (const k of keys) await page.keyboard.down(k);
    await sleep(Math.min(450, Math.max(90, (Math.hypot(dx, dy) / 160) * 500)));
    for (const k of keys) await page.keyboard.up(k);
    await sleep(40);
  }
  await fail(`walkTo(${tx},${ty}) timeout`);
  return false;
}

async function pressE() {
  await page.keyboard.down('e');
  await sleep(90);
  await page.keyboard.up('e');
  await sleep(450);
}

async function listen() {
  await page.keyboard.down('q');
  await sleep(950);
  await page.keyboard.up('q');
  await clearDialogue(2000);
}

/** 語彙パレットのチップ座標（NamingOverlay のレイアウトと同期） */
async function chipXY(glyph) {
  const list = await vocab();
  const i = list.indexOf(glyph);
  if (i < 0) await fail(`vocab に ${glyph} がない`);
  const cols = 12;
  const n = Math.min(list.length, cols);
  return { x: 480 + ((i % cols) - (n - 1) / 2) * 70, y: 372 + Math.floor(i / cols) * 72 };
}

/** 名付け: Space → (タブ) → チップ → 決定 */
async function nameIt(chips, { tab } = {}) {
  await page.keyboard.down('Space');
  await sleep(90);
  await page.keyboard.up('Space');
  await sleep(900);
  if (!(await sceneActive('NamingOverlay'))) await fail(`overlay が開かない (chips=${chips})`);
  if (tab === 'ketsuji2') await page.mouse.click(px(535), py(92)); // 単字/結字の2タブ時の結字
  await sleep(300);
  for (const g of chips) {
    const c = await chipXY(g);
    await page.mouse.click(px(c.x), py(c.y));
    await sleep(300);
  }
  await page.mouse.click(px(850), py(504)); // 決定
  await sleep(2600); // 閉じ→和音→結晶化→効果
  await clearDialogue(2500);
}

const assert = async (cond, msg) => {
  if (!cond) await fail(msg);
  console.log(`ok: ${msg}`);
};

// ============================================================ 走破開始

console.log('goto', URL);
await page.goto(URL, { waitUntil: 'networkidle2', timeout: 30000 });
await sleep(5000);
await shot('01_title');

await page.mouse.click(px(480), py(448)); // はじめる
await sleep(1600);
// プロローグを Esc 長押しでスキップ
await page.keyboard.down('Escape');
await sleep(1400);
await page.keyboard.up('Escape');
await sleep(1600);
await assert(await sceneActive('World'), 'World へ遷移');
await clearDialogue(); // コトノ婆イントロ
await shot('02_world');

// ---- P0: 火 ----
await walkTo(880, 940);
await pressE();
await assert(await hasGlyph('火'), '言ノ葉「火」を拾った');
await walkTo(852, 928);
await listen();
await nameIt(['火']);
await assert(await hasFlag('p0_done'), 'P0: 竈に火が灯った');
await assert(await hasGlyph('点'), '点を授かった');
await shot('03_p0_done');

// ---- P1: 明 ----
await walkTo(1200, 900);
await walkTo(1460, 940);
await pressE();
await assert(await hasGlyph('日'), '日を拾った');
await walkTo(1600, 880);
await walkTo(1750, 810);
await pressE();
await assert(await hasGlyph('月'), '月を拾った');
await walkTo(1590, 880);
await nameIt(['日', '月'], { tab: 'ketsuji2' });
await assert(await hasFlag('p1_done'), 'P1: 明（くらやみ解除）');
await shot('04_p1_done');

// ---- P2: 木（橋）＋ 休（ベンチ） ----
await walkTo(1900, 960);
await walkTo(1900, 1150);
await walkTo(1900, 1245);
await pressE();
await assert(await hasGlyph('木'), '木を拾った');
await walkTo(1930, 1295);
await nameIt(['木']);
await assert(await hasFlag('p2_bridge'), 'P2: 橋が架かった');
await walkTo(1880, 1195);
await nameIt(['人', '木'], { tab: 'ketsuji2' });
await assert(await hasFlag('bench1_built'), '休: ベンチ設置');
await pressE(); // ひとやすみ（セーブ）
await clearDialogue(2000);
await assert(
  await page.evaluate(() => localStorage.getItem('mana-demo-v1') !== null),
  'セーブが書き込まれた',
);
await shot('05_p2_done');

// ---- S1: 烏→鳥 ----
await walkTo(2030, 1300); // 橋を渡る
await walkTo(2160, 1360);
await walkTo(2195, 1432);
await nameIt(['点']);
await assert(await hasFlag('s1_done'), 'S1: 烏→鳥');
await assert((await gems()) >= 1, '玉 1個目');

// ---- S3: 水 ----
await walkTo(2390, 1135);
await pressE();
await assert(await hasGlyph('水'), '水を拾った');
await walkTo(2355, 1205);
await nameIt(['水']);
await assert(await hasFlag('s3_done'), 'S3: 井戸が満ちた');
await shot('06_east_done');

// ---- P3: 犬 ----
await walkTo(2030, 1300);
await walkTo(1850, 1300);
await walkTo(1400, 1300);
await walkTo(1090, 1230);
await walkTo(1080, 950);
await walkTo(820, 820);
await walkTo(700, 642);
await listen();
await listen(); // 段階2で「大」判明
await nameIt(['点']);
await assert(await hasFlag('p3_done'), 'P3: 大＋点＝犬');
await shot('07_dog');

// ---- 止を拾って P4: 凪 ----
await walkTo(700, 470);
await walkTo(600, 360);
await walkTo(565, 312);
await pressE();
await assert(await hasGlyph('止'), '止を拾った');
await walkTo(792, 335);
await listen();
await listen();
await nameIt(['止']);
await assert(await hasFlag('p4_done'), 'P4: 風＋止＝凪');

// ---- S2: 王→玉（参道） ----
await walkTo(1085, 330);
await nameIt(['点']);
await assert(await hasFlag('s2_done'), 'S2: 王＋点＝玉');
await assert((await gems()) === 3, '玉 3個そろった');
await shot('08_before_boss');

// ---- ボス戦 ----
await walkTo(1250, 270);
await clearDialogue(6000); // INTRO 3行
await assert((await bossPhase()) === 'p1', 'ボス P1 開始');
await nameIt(['火']);
await sleep(1500);
await clearDialogue(4000);
await assert((await bossPhase()) === 'p2', 'ボス P2（炎）へ');
await shot('09_boss_p2');

// 鐘 → 丁 → （もう一度鐘で鎮め直し）→ 灯
await walkTo(1402, 238);
await pressE(); // 鐘: 鎮み＋丁落下
await clearDialogue(2000);
await walkTo(1430, 240);
await pressE(); // 丁を拾う
await assert(await hasGlyph('丁'), '丁を拾った');
await walkTo(1402, 238);
await pressE(); // 鐘で鎮め直し（タイマー更新）
await clearDialogue(1500);
await nameIt(['丁']); // 改字UI: 火＋丁＝灯 → RESOLVE
await sleep(3000);
await shot('10_resolve');

// 彩色クライマックス〜エンドカード
const t0 = Date.now();
while (!(await sceneActive('EndCard'))) {
  if (Date.now() - t0 > 60000) await fail('EndCard に到達しない');
  if (await dlgBusy()) await clickDialogue();
  await sleep(600);
}
await sleep(4500);
await shot('11_endcard');
await assert(await hasFlag('boss_done'), 'ボス解決');
console.log('プレイ時間(秒):', await page.evaluate(() => Math.round(window.__mana.registry.get('ctx').playtime)));

await browser.close();

if (errors.length) {
  console.log('\n=== JS ERRORS ===');
  for (const e of errors) console.log(e);
  process.exit(1);
}
console.log('\nSMOKE OK — タイトル→エンドカードまで通し走破・JSエラーなし');
