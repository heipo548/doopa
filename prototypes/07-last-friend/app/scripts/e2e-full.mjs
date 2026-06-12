// デバッグジャンプを一切使わない「完全自然プレイスルー」E2E。
// §13 チェックリストの本丸:
//   - 新規開始→クリアまで詰みがない
//   - 「うそ」ルートで 1 プレイ 30 語コンプできる
//   - クリアで？？？解禁、リロード保持、localStorage 消去で初期化
//
// 設計方針: キー連打の「時間待ち」ではなく、ゲーム内部の状態
// （会話中か・パレットが開いているか・今どのタイルか・NPC が今どこにいるか）を
// 毎回読んでから次の操作を決める。タイミング依存のフレークを防ぐため。
import puppeteer from "puppeteer-core";

const URL = "http://127.0.0.1:4173/?debug=1";
const CHROME = "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
let failures = 0;

const browser = await puppeteer.launch({
  executablePath: CHROME,
  headless: "new",
  args: ["--no-sandbox", "--mute-audio", "--disable-gpu"],
});
const page = await browser.newPage();
const consoleErrors = [];
page.on("console", (m) => m.type() === "error" && consoleErrors.push(m.text()));
page.on("pageerror", (e) => consoleErrors.push(String(e)));

await page.goto(URL, { waitUntil: "networkidle0" });
await page.evaluate(() => localStorage.clear());
await page.goto(URL, { waitUntil: "networkidle0" });
await sleep(2500);

const ev = (fn) => page.evaluate(fn);
const has = (flag) => ev(`window.__LF.G.flags.has("${flag}")`);
const knows = (id) => ev(`window.__LF.G.learned.has("${id}")`);
const press = async (key, ms = 300) => {
  await page.keyboard.press(key);
  await sleep(ms);
};

// ゲームの「今」を1回の evaluate でまとめて取る。
// dlg: 会話進行中 / pal: ことばパレット表示中（このあいだ移動キーは効かない）
const SNAP = `(() => {
  const w = window.__LF.game.scene.getScene("World");
  return {
    x: window.__LF.G.x, y: window.__LF.G.y,
    map: window.__LF.G.map, phase: window.__LF.G.phase,
    learned: window.__LF.G.learned.size,
    dlg: !!(w && w.director && w.director.active),
    pal: !!window.__LF.palette.open,
  };
})()`;
const snap = () => ev(SNAP);

// NPC の今いるタイル（スプライト実座標から逆算。引っ越し・逃走後も追える）
const npcTile = (id) =>
  ev(`(() => {
    const w = window.__LF.game.scene.getScene("World");
    const n = w && w.npcSprites && w.npcSprites.find((n) => n.def.id === "${id}");
    if (!n) return null;
    return { x: Math.floor(n.sprite.x / 16), y: Math.floor(n.sprite.y / 16) };
  })()`);

// 失敗したらその場のゲーム状態も出す（原因調査を1往復で済ませるため）
const ok = async (name, cond, extra = "") => {
  console.log(`${cond ? "✅" : "❌"} ${name}${extra ? " — " + extra : ""}`);
  if (!cond) {
    failures++;
    try {
      const s = await snap();
      console.log(
        `   ↳ pos=(${s.x},${s.y}) map=${s.map} phase=${s.phase} learned=${s.learned} dlg=${s.dlg} pal=${s.pal}`
      );
    } catch {
      /* ページ遷移中などで取れないときは黙ってスキップ */
    }
  }
};

// 開いている会話・パレットを「送り切って」完全に閉じる。
// 次の話しかけ/しらべを空振りさせないために、各インタラクションの前に呼ぶ。
// 注意: パレットが開いていたらカーソル位置の語で決定してしまうので、
// 「選びたい語があるパレット」の前では呼ばないこと（そこは selectWord を使う）。
const settle = async (max = 40) => {
  for (let i = 0; i < max; i++) {
    const s = await snap();
    if (!s.dlg && !s.pal) return true;
    await press("KeyZ", 380);
  }
  return false;
};

// 述語が真になるまで Z で会話を送る（カットインのスキップも Z が兼ねる）
const zUntil = async (pred, max = 60, delay = 420) => {
  for (let i = 0; i < max; i++) {
    if (await pred()) return true;
    await press("KeyZ", delay);
  }
  return await pred();
};

// パレットが開くまで Z を送り、開いたら目的の語へ移動して決定
const selectWord = async (id, max = 40) => {
  for (let i = 0; i < max; i++) {
    const st = await ev("({...window.__LF.palette, items:[...window.__LF.palette.items]})");
    if (st.open) {
      let idx = st.items.indexOf(id);
      if (idx < 0) return false;
      let cur = st.cursor;
      while (cur < idx) {
        await press("ArrowRight", 90);
        cur++;
      }
      while (cur > idx) {
        await press("ArrowLeft", 90);
        cur--;
      }
      await press("KeyZ", 350);
      return true;
    }
    await press("KeyZ", 380);
  }
  return false;
};

// 現在地から目的タイルへの経路を BFS で探す（ページ内で計算）。
// 壁タイル・NPC のいるタイル・プロップ（おおきな木など）は通れない扱い。
// NPC が動いた直後でも、毎回その時点の状態で計算するのでズレない。
const findPath = (tx, ty) =>
  ev(`(() => {
    const w = window.__LF.game.scene.getScene("World");
    const G = window.__LF.G;
    const grid = w.mapDef.grid;
    const SOLID = new Set(["~","T","f","r","W","R","D","S","B","k","b"]); // tileLegend の COLLIDING_TILES と対応
    const H = grid.length, WD = grid[0].length;
    const npcs = new Set((w.npcSprites || []).map((n) =>
      Math.floor(n.sprite.x / 16) + "," + Math.floor(n.sprite.y / 16)));
    const props = w.mapDef.props || [];
    const blocked = (x, y) =>
      x < 0 || y < 0 || x >= WD || y >= H ||
      SOLID.has(grid[y][x]) || npcs.has(x + "," + y) ||
      props.some((p) => x >= p.x && x < p.x + (p.w || 1) && y >= p.y && y < p.y + (p.h || 1));
    const key = (x, y) => x + "," + y;
    const prev = new Map([[key(G.x, G.y), null]]);
    const q = [[G.x, G.y]];
    while (q.length) {
      const [cx, cy] = q.shift();
      if (cx === ${tx} && cy === ${ty}) {
        const path = [];
        let cur = [cx, cy];
        while (cur) { path.push(cur); cur = prev.get(key(cur[0], cur[1])); }
        return path.reverse();
      }
      for (const [dx, dy] of [[1,0],[-1,0],[0,1],[0,-1]]) {
        const nx = cx + dx, ny = cy + dy;
        if (blocked(nx, ny) || prev.has(key(nx, ny))) continue;
        prev.set(key(nx, ny), [cx, cy]);
        q.push([nx, ny]);
      }
    }
    return null; // 到達不能
  })()`);

// タイル単位の誘導。
// - 到着判定を最優先（到着と同時に発火したイベントはシナリオ側が扱う）
// - 会話中は移動キーが効かないので Z で送る
// - 経路は毎ステップ BFS で引き直す（途中でイベントや NPC 移動があっても自己修復）
const moveTo = async (tx, ty, max = 200) => {
  for (let i = 0; i < max; i++) {
    const s = await snap();
    if (s.x === tx && s.y === ty) return true;
    if (s.dlg || s.pal) {
      await press("KeyZ", 380);
      continue;
    }
    const path = await findPath(tx, ty);
    if (!path || path.length < 2) return false; // 到達不能（talkTo が次の候補を試す）
    const [nx, ny] = path[1];
    const key =
      nx > s.x ? "ArrowRight" : nx < s.x ? "ArrowLeft" : ny > s.y ? "ArrowDown" : "ArrowUp";
    // 移動は速度式（70px/s）なので、押しっぱなしにして
    // 「タイルが実際に変わるまで」ホールドする（固定時間だと半端な位置で止まり、
    // タイル境界のジッタで方向が振動して進まなくなる）
    await page.keyboard.down(key);
    let moved = false;
    for (let t = 0; t < 8; t++) {
      await sleep(80);
      const p = await snap();
      if (p.x !== s.x || p.y !== s.y) {
        moved = true;
        break;
      }
      if (p.dlg || p.pal) break; // 道中でイベントが発火したら手を止める
    }
    if (moved) await sleep(60); // タイルの内側まで入ってから離す（角で引っかからないように）
    await page.keyboard.up(key);
    await sleep(50);
  }
  return false;
};
const walk = async (...pts) => {
  for (const [x, y] of pts) {
    if (!(await moveTo(x, y))) return false;
  }
  return true;
};
const face = async (dir) => {
  await page.keyboard.down(dir);
  await sleep(60);
  await page.keyboard.up(dir);
  await sleep(120);
};
// 「会話を閉じる → 向く → しらべる」の定型（けいじばん・とびら など固定物用）
const talk = async (dir) => {
  await settle();
  if (dir) await face(dir);
  await press("KeyZ", 550);
};
// NPC に話しかける: 実座標を読んで「隣に立つ → 向く → Z」。
// NPC のタイル自体は通れないので、近い順に四方の隣タイルを試す
const talkTo = async (id) => {
  await settle();
  const t = await npcTile(id);
  if (!t) return false;
  const s = await snap();
  const cands = [
    { x: t.x, y: t.y - 1, dir: "ArrowDown" },
    { x: t.x - 1, y: t.y, dir: "ArrowRight" },
    { x: t.x + 1, y: t.y, dir: "ArrowLeft" },
    { x: t.x, y: t.y + 1, dir: "ArrowUp" },
  ].sort(
    (a, b) => Math.abs(a.x - s.x) + Math.abs(a.y - s.y) - (Math.abs(b.x - s.x) + Math.abs(b.y - s.y))
  );
  for (const c of cands) {
    if (await moveTo(c.x, c.y, 80)) {
      await settle(); // 道中で発火したイベントを閉じてから
      await face(c.dir);
      await press("KeyZ", 550);
      return true;
    }
  }
  return false;
};

// ============ E0: はじまりのおか ============
await press("KeyZ", 1200); // はじめから
for (let i = 0; i < 6; i++) await press("KeyZ", 650); // OP
await ok("E0: OP完了", await has("e0_op_done"));
await moveTo(8, 4); // 花に乗る
await zUntil(() => knows("hana"), 8, 600);
await ok("E0: はな（開始すぐの███解読）", await knows("hana"));
await moveTo(9, 6);
await moveTo(9, 7); // みはらしゾーン
await zUntil(async () => (await knows("sora")) && (await knows("kaze")), 30, 500);
await ok("E0: そら・かぜ", (await knows("sora")) && (await knows("kaze")));

// ============ E1: うさぎ → むらへ ============
await moveTo(9, 12); // ゲートのゾーン（到着と同時に E1 が発火する）
await zUntil(() => ev("window.__LF.palette.open"), 30, 500);
await ok("E1: 初パレット（こんにちは）", await selectWord("konnichiwa"));
await zUntil(() => ev('window.__LF.G.map === "village"'), 20, 550);
await ok("E1: むらへ", await ev('window.__LF.G.map === "village"'));
await ok("E1: Q1開始", await has("q1_started"));

// ============ E2: 自由探索（しらべ・あいさつ・Q2） ============
await walk([19, 11], [20, 11]);
await talk("ArrowUp"); // けいじばん
await zUntil(() => knows("mura"), 14, 450);
await ok("E2: むら（けいじばん）", await knows("mura"));

// カエル（あいさつ → パン → おいしい → Q2）
await ok("E2: カエルにあいさつ", (await talkTo("kaeru")) && (await selectWord("konnichiwa")));
await zUntil(() => has("has_pan"), 30, 450);
await ok(
  "E2: パン・おいしい・Q2うけおい",
  (await knows("pan")) && (await knows("oishii")) && (await has("has_pan"))
);

// ため池（みず）
await settle();
await walk([28, 14], [28, 16]);
await talk("ArrowRight");
await zUntil(() => knows("mizu"), 10, 450);
await ok("E2: みず（ため池）", await knows("mizu"));

// モグラ（あいさつ → はたけ）と はたけ（つち）
await ok("E2: モグラにあいさつ", (await talkTo("mogura")) && (await selectWord("konnichiwa")));
await zUntil(() => knows("hatake"), 16, 450);
await ok("E2: はたけ", await knows("hatake"));
await settle();
await moveTo(28, 21);
await talk("ArrowRight"); // はたけ を しらべる
await zUntil(() => knows("tsuchi"), 10, 450);
await ok("E2: つち（はたけしらべ）", await knows("tsuchi"));

// おばあ（あいさつ＋だいじょうぶ → パンとどけ → むかし → おもいで）
await ok("E2: おばあにあいさつ", (await talkTo("obaa")) && (await selectWord("konnichiwa")));
await zUntil(() => knows("daijoubu"), 16, 450);
await ok("E2: だいじょうぶ", await knows("daijoubu"));
await talkTo("obaa"); // 2回目: パンとどけ
await zUntil(() => has("q2_done"), 32, 480);
await ok("E2: Q2完走 → ありがとう", (await has("q2_done")) && (await knows("arigatou")));
await talkTo("obaa"); // 3回目: むかし
await zUntil(() => knows("mukashi"), 14, 450);
await talkTo("obaa"); // 4回目: おもいで
await zUntil(() => knows("omoide"), 14, 450);
await ok("E2: むかし・おもいで", (await knows("mukashi")) && (await knows("omoide")));

// もりはずれの木（き）
await settle();
await walk([7, 10], [5, 10], [5, 7], [5, 6]);
await talk("ArrowUp");
await zUntil(() => knows("ki"), 10, 450);
await ok("E2: き（おおきな木）", await knows("ki"));

// うさぎの家のとびら（いえ）
await settle();
await walk([5, 7], [15, 7], [16, 7]);
await talk("ArrowUp");
await zUntil(() => knows("ie"), 10, 450);
await ok("E2: いえ（とびら）", await knows("ie"));

// ことり（あいさつ4にんめ → Q1完了 / すき）
await ok("E2: ことりにあいさつ", (await talkTo("kotori")) && (await selectWord("konnichiwa")));
await zUntil(() => knows("suki"), 16, 450);
await ok("E2: すき", await knows("suki"));
await ok("Q1完了（4にん）", await has("q1_done"));

// ============ E3: みなみひろばの口げんか ============
await settle();
await walk([19, 14], [19, 20]);
await zUntil(() => knows("gomenne"), 20, 500);
await ok("E3: ごめんね（うさぎ）", await knows("gomenne"));
await zUntil(() => ev('window.__LF.game.scene.isActive("Battle")'), 20, 500);
await ok("E3: バトル開始", await ev('window.__LF.game.scene.isActive("Battle")'));
for (let i = 0; i < 30; i++) {
  if (await ev('window.__LF.game.scene.isActive("World")')) break;
  await selectWord("daijoubu", 12);
  await sleep(400);
}
await ok("E3: 口げんかに勝利", await ev('window.__LF.game.scene.isActive("World")'));
await zUntil(() => has("e3_done"), 40, 450);
await ok(
  "E3: なかなおり・いっしょ・どんぐり",
  (await knows("nakanaori")) && (await knows("issho")) && (await knows("donguri"))
);

// ============ E4: きつねのこ（うそルート） ============
await ok("E4-準備: きつねのこに会う", await talkTo("kitsune"));
await zUntil(() => has("e4_ran"), 24, 500); // 選択肢は先頭=「ちがうと いう」
await ok("E4: うそ習得・きつね逃走", (await knows("uso")) && (await has("e4_ran")));
await ok("E4: こころ dark+1", (await ev("window.__LF.G.kokoro.dark")) >= 1);
await ok("E4-準備: 泣いているきつねのこへ", await talkTo("kitsune"));
await zUntil(async () => (await knows("samishii")) && (await knows("kanashii")), 24, 500);
await ok(
  "E4: さみしい・かなしい（reveal_sad）",
  (await knows("samishii")) && (await knows("kanashii"))
);
await ok("E4: ごめんね を てつだう", await selectWord("gomenne"));
await zUntil(() => knows("tomodachi"), 20, 500);
await ok("E4: ともだち合成（すき＋いっしょ）", await knows("tomodachi"));
await ok("E4: ともだち、と こたえる", await selectWord("tomodachi"));
await zUntil(() => has("e4_done"), 20, 500);
await ok("E4: クライマックス成立", await has("e4_climax"));
await ok("E4: ゆうがたへ", await ev('window.__LF.G.phase === "evening"'));

// ============ E5〜E6: ほしみだいの うた → かみさまの よる ============
await settle();
await walk([7, 8], [7, 10], [18, 10], [19, 10], [24, 10], [31, 10], [31, 9]);
await zUntil(() => has("e6_done"), 60, 550);
await ok(
  "E5: うた・ほし・よる・たのしい",
  (await knows("uta")) && (await knows("hoshi")) && (await knows("yoru")) && (await knows("tanoshii"))
);
await ok("E6: かみさまの よる 完了", await has("e6_done"));
await ok("E7: あさ", await ev('window.__LF.G.phase === "morning"'));

// ============ E7: おはよう → 30語 → しろいカード ============
await sleep(1000);
await ok("E7-準備: うさぎに あさのあいさつ", await talkTo("usagi"));
await zUntil(() => knows("ohayou"), 14, 500);
await ok("E7: おはよう", await knows("ohayou"));
const count = await ev("window.__LF.G.learned.size");
await ok("★ うそルートで 30語 コンプ (§13)", count === 30, `learned=${count}`);

await settle();
await walk([19, 13]);
await sleep(2500);
await ok("E7: しろいカード", await ev('window.__LF.game.scene.isActive("Ending")'));
await sleep(2000);
await press("KeyZ", 1800);
await ok("クリア → タイトル", await ev('window.__LF.game.scene.isActive("Title")'));
await ok("？？？解禁", await ev("window.__LF.Save.isCleared()"));

// ============ 永続化まわり (§13) ============
await page.reload({ waitUntil: "networkidle0" });
await sleep(2000);
await ok("リロードで状態保持", await ev("window.__LF.Save.isCleared() && window.__LF.Save.hasGame()"));
await page.evaluate(() => localStorage.clear());
await page.reload({ waitUntil: "networkidle0" });
await sleep(2000);
await ok(
  "localStorage 消去で完全初期化",
  await ev("!window.__LF.Save.isCleared() && !window.__LF.Save.hasGame()")
);

await ok("全行程コンソールエラーなし", consoleErrors.length === 0, consoleErrors.slice(0, 5).join(" | "));

await browser.close();
console.log(failures === 0 ? "\n🎉 完全自然プレイスルー 全部通過" : `\n💥 失敗 ${failures} 件`);
process.exit(failures === 0 ? 0 : 1);
