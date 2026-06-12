// 自動プレイテスト（puppeteer-core + 手元の Chrome）。
// 使い方: npm run build → npx vite preview --port 4173 → node scripts/e2e.mjs
// ?debug=1 の window.__LF フック経由で内部状態を検証する。
import puppeteer from "puppeteer-core";

const URL = "http://127.0.0.1:4173/?debug=1";
const CHROME = "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
let failures = 0;
const ok = (name, cond, extra = "") => {
  console.log(`${cond ? "✅" : "❌"} ${name}${extra ? " — " + extra : ""}`);
  if (!cond) failures++;
};

const browser = await puppeteer.launch({
  executablePath: CHROME,
  headless: "new",
  args: ["--no-sandbox", "--mute-audio", "--disable-gpu"],
});
const page = await browser.newPage();

const consoleErrors = [];
page.on("console", (msg) => {
  if (msg.type() === "error") consoleErrors.push(msg.text());
});
page.on("pageerror", (err) => consoleErrors.push(String(err)));
const requests = [];
page.on("request", (req) => requests.push(req.url()));

// 毎回まっさらな状態から
await page.goto(URL, { waitUntil: "networkidle0" });
await page.evaluate(() => localStorage.clear());
await page.goto(URL, { waitUntil: "networkidle0" });
await sleep(2500);

// ---- 1. 起動・外部通信ゼロ (§13) ----
ok("起動時コンソールエラーなし", consoleErrors.length === 0, consoleErrors.slice(0, 3).join(" | "));
// data: URI は Phaser 内蔵のデフォルトテクスチャで、ネットワーク通信ではない
const external = requests.filter(
  (u) => !u.startsWith("http://127.0.0.1:4173") && !u.startsWith("data:")
);
ok("外部リクエストゼロ", external.length === 0, external.join(", "));

const lf = await page.evaluate(() => typeof window.__LF);
ok("デバッグフックあり", lf === "object");

const sceneActive = (name) =>
  page.evaluate((n) => window.__LF.game.scene.isActive(n), name);

ok("タイトル表示", await sceneActive("Title"));

// ---- 2. はじめから → E0 オープニング ----
await page.keyboard.press("KeyZ"); // はじめから
await sleep(1200);
ok("ワールド開始（はじまりのおか）", await page.evaluate(() => window.__LF.G.map === "hill"));
for (let i = 0; i < 6; i++) {
  await page.keyboard.press("KeyZ"); // OP ナレーション送り
  await sleep(700);
}
ok(
  "E0 オープニング完了",
  await page.evaluate(() => window.__LF.G.flags.has("e0_op_done"))
);

// 花まで歩いて しらべる（はな習得）。G.x/G.y を読みながらタイル単位で誘導する
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
ok("花まで移動", await moveTo(8, 4)); // 花のタイルに乗る（自タイルしらべ）
await sleep(200);
for (let i = 0; i < 6; i++) {
  await page.keyboard.press("KeyZ");
  await sleep(650);
  if (await page.evaluate(() => window.__LF.G.learned.has("hana"))) break;
}
ok("E0: はな を習得（最初の███解読）", await page.evaluate(() => window.__LF.G.learned.has("hana")));

// ---- 3. E3 ジャンプ → 口げんかバトル一周 ----
await page.evaluate(() => window.__LF.Debug.hooks.jumpTo("E3"));
await sleep(1500);
ok("E3 プリセット適用", await page.evaluate(() => window.__LF.G.flags.has("q1_done")));

// みなみひろばのゾーンへ（(19,19) から下へ）
await page.keyboard.down("ArrowDown");
await sleep(700);
await page.keyboard.up("ArrowDown");
await sleep(300);
// 口論イベント → 選択肢「あいだに はいる」→ バトル
for (let i = 0; i < 40; i++) {
  await page.keyboard.press("KeyZ");
  await sleep(450);
  if (await sceneActive("Battle")) break;
}
ok("バトル開始", await sceneActive("Battle"));

// パレット連打で口論を進める（負けは存在しない仕様なので必ず終わる）
for (let i = 0; i < 220; i++) {
  await page.keyboard.press("KeyZ");
  await sleep(260);
  if (await sceneActive("World")) break;
}
ok("バトル勝利でワールドへ", await sceneActive("World"));
for (let i = 0; i < 30; i++) {
  await page.keyboard.press("KeyZ");
  await sleep(400);
  const done = await page.evaluate(() => window.__LF.G.flags.has("e3_done"));
  if (done) break;
}
ok("E3 完了", await page.evaluate(() => window.__LF.G.flags.has("e3_done")));
ok(
  "なかなおり・いっしょ・どんぐり習得",
  await page.evaluate(
    () =>
      window.__LF.G.learned.has("nakanaori") &&
      window.__LF.G.learned.has("issho") &&
      window.__LF.G.learned.has("donguri")
  )
);

// ---- 4. E5 ジャンプ → うた → E6 かみさま → E7 エンディング ----
await page.evaluate(() => window.__LF.Debug.hooks.jumpTo("E5"));
await sleep(1500);
ok("E5: ゆうがた", await page.evaluate(() => window.__LF.G.phase === "evening"));
// (28,10) → ほしみだいの階段ゾーン (29..34, 8..9) へ
await page.keyboard.down("ArrowRight");
await sleep(800);
await page.keyboard.up("ArrowRight");
await page.keyboard.down("ArrowUp");
await sleep(500);
await page.keyboard.up("ArrowUp");
await sleep(300);
for (let i = 0; i < 60; i++) {
  await page.keyboard.press("KeyZ");
  await sleep(500);
  const slept = await page.evaluate(() => window.__LF.G.flags.has("e6_done"));
  if (slept) break;
}
ok("E5→E6 完了（かみさまの夜）", await page.evaluate(() => window.__LF.G.flags.has("e6_done")));
ok(
  "うた・ほし・よる・たのしい習得",
  await page.evaluate(
    () =>
      window.__LF.G.learned.has("uta") &&
      window.__LF.G.learned.has("hoshi") &&
      window.__LF.G.learned.has("yoru") &&
      window.__LF.G.learned.has("tanoshii")
  )
);
ok("あさ になった", await page.evaluate(() => window.__LF.G.phase === "morning"));

// ひろば中心 (19,13) へ歩く（(19,8)スタート）
await sleep(1200);
await page.keyboard.down("ArrowDown");
await sleep(1600);
await page.keyboard.up("ArrowDown");
await sleep(1500);
ok("E7: エンディングカード", await sceneActive("Ending"));
await sleep(3500);
await page.keyboard.press("KeyZ");
await sleep(1800);
ok("クリア後タイトルへ", await sceneActive("Title"));
ok("？？？解禁（cleared）", await page.evaluate(() => window.__LF.Save.isCleared()));

// ---- 5. リロードしても状態保持 → localStorage 消去で完全初期化 (§13) ----
await page.reload({ waitUntil: "networkidle0" });
await sleep(2000);
ok("リロード後も cleared 保持", await page.evaluate(() => window.__LF.Save.isCleared()));
await page.evaluate(() => localStorage.clear());
await page.reload({ waitUntil: "networkidle0" });
await sleep(2000);
ok(
  "localStorage 消去で完全初期状態",
  await page.evaluate(() => !window.__LF.Save.isCleared() && !window.__LF.Save.hasGame())
);

ok("実行中コンソールエラーなし", consoleErrors.length === 0, consoleErrors.slice(0, 5).join(" | "));

await browser.close();
console.log(failures === 0 ? "\n🎉 E2E 全部通過" : `\n💥 失敗 ${failures} 件`);
process.exit(failures === 0 ? 0 : 1);
