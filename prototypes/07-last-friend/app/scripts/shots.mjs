// 主要画面のスクリーンショット撮影（目視確認用）。/tmp/lf-shots/ に保存。
import puppeteer from "puppeteer-core";
import { mkdirSync } from "node:fs";

const URL = "http://127.0.0.1:4173/?debug=1";
const CHROME = "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";
const OUT = "/tmp/lf-shots";
mkdirSync(OUT, { recursive: true });

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const browser = await puppeteer.launch({
  executablePath: CHROME,
  headless: "new",
  args: ["--no-sandbox", "--mute-audio", "--window-size=700,420"],
  defaultViewport: { width: 700, height: 420 },
});
const page = await browser.newPage();
const shot = (name) => page.screenshot({ path: `${OUT}/${name}.png` });

await page.goto(URL, { waitUntil: "networkidle0" });
await page.evaluate(() => localStorage.clear());
await page.goto(URL, { waitUntil: "networkidle0" });
await sleep(2500);
await shot("01-title");

// はじめから → OP（███ナレーション）
await page.keyboard.press("KeyZ");
await sleep(1400);
await shot("02-op-masked");
await page.keyboard.press("KeyZ");
await sleep(1200);
await shot("03-op-token");
for (let i = 0; i < 5; i++) {
  await page.keyboard.press("KeyZ");
  await sleep(600);
}
await sleep(1400);
await shot("04-hill-wake");

// 花をしらべて習得カットイン
const moveTo = async (tx, ty) => {
  for (let i = 0; i < 80; i++) {
    const pos = await page.evaluate(() => ({ x: window.__LF.G.x, y: window.__LF.G.y }));
    if (pos.x === tx && pos.y === ty) return true;
    const key =
      pos.x > tx ? "ArrowLeft" : pos.x < tx ? "ArrowRight" : pos.y > ty ? "ArrowUp" : "ArrowDown";
    await page.keyboard.down(key);
    await sleep(150);
    await page.keyboard.up(key);
    await sleep(80);
  }
  return false;
};
await moveTo(8, 4);
await page.keyboard.press("KeyZ");
await sleep(700);
await page.keyboard.press("KeyZ");
await sleep(450);
await shot("05-learn-cutin");
await sleep(900);
await page.keyboard.press("KeyZ");
await sleep(600);
await shot("06-learned-line");

// E2: 村とけいじばん・ノート
await page.evaluate(() => window.__LF.Debug.hooks.jumpTo("E2"));
await sleep(1600);
await shot("07-village");
await page.keyboard.press("KeyC");
await sleep(600);
await shot("08-notebook");
await page.keyboard.press("KeyX");
await sleep(400);

// うさぎに話しかけ → あいさつパレット確認用に E2 のカエルへ
await moveTo(25, 15);
await page.keyboard.press("ArrowRight");
await sleep(200);
await page.keyboard.press("KeyZ");
await sleep(900);
await page.keyboard.press("KeyZ");
await sleep(700);
await shot("09-palette");

// E3 バトル
await page.evaluate(() => window.__LF.Debug.hooks.jumpTo("E3"));
await sleep(1500);
await page.keyboard.down("ArrowDown");
await sleep(700);
await page.keyboard.up("ArrowDown");
for (let i = 0; i < 40; i++) {
  await page.keyboard.press("KeyZ");
  await sleep(420);
  if (await page.evaluate(() => window.__LF.game.scene.isActive("Battle"))) break;
}
await sleep(1600);
await shot("10-battle-line");
await page.keyboard.press("KeyZ");
await sleep(900);
await page.keyboard.press("KeyZ");
await sleep(900);
await shot("11-battle-palette");

// E5 → かみさまの夜
await page.evaluate(() => window.__LF.Debug.hooks.jumpTo("E5"));
await sleep(1500);
await shot("12-evening");
await page.keyboard.down("ArrowRight");
await sleep(800);
await page.keyboard.up("ArrowRight");
await page.keyboard.down("ArrowUp");
await sleep(500);
await page.keyboard.up("ArrowUp");
for (let i = 0; i < 14; i++) {
  await page.keyboard.press("KeyZ");
  await sleep(600);
}
await sleep(500);
await shot("13-e5-night");
for (let i = 0; i < 12; i++) {
  await page.keyboard.press("KeyZ");
  await sleep(600);
  const black = await page.evaluate(() => window.__LF.G.flags.has("e5_done"));
  if (black) break;
}
await sleep(3500);
await shot("14-kamisama");

// E7 エンディングカード → クリア後タイトル
await page.evaluate(() => window.__LF.Debug.hooks.jumpTo("E7"));
await sleep(1500);
await page.keyboard.down("ArrowDown");
await sleep(1600);
await page.keyboard.up("ArrowDown");
await sleep(3200);
await shot("15-ending-card");
await page.keyboard.press("KeyZ");
await sleep(1800);
await shot("16-title-cleared");

await browser.close();
console.log("shots saved to " + OUT);
