/*
 * field.js — 街（拠点）／夜のフィールド（横スクロールの道）／いくつもの夜の周回
 *
 * v0.4 メタループの中枢。既存の戦闘FSM（state.js / battle.js）は一切変えず、
 * その“外側”に物語の器（STORY.md）を巻きつける：
 *
 *   タイトル → 街(TOWN) → 夜のフィールド(FIELD/横スクロール) → 既存戦闘 → 夜明け(DAWN)
 *            → 街にかえる（夜カウンタ+1・灯り+・くらしのことば） → … → さいごの夜 → マクロ結末
 *
 * このファイルは DOM を直接いじらない（描画は ui.js の renderTown/renderField/showMacroResult）。
 * 「いまどの画面か(app.screen)」と「夜の道の歩行状態(field)」と「夜またぎのメタ(meta)」を持つ。
 */

// いまどの画面を見せているか。render() がこれを見て描き分ける。
//   "title" / "town" / "field" / "battle"(=既存戦闘, game.state を使う) / "macro"(最終結末)
let app = { screen: "title" };

// 夜のフィールド（見下ろし帯）の歩行状態
//   操作は「マウスカーソル追従」のみ（キーボード不使用）。
//   主軸は横(x:0→goal=朝へ)を保ちつつ、縦(y:-1..+1)に薄い遊び幅を足して“自由に歩ける”身体性を出す。
const field = {
  goal: 0,            // 朝（道のおわり＝群れのけはい）までの距離（目盛り）
  x: 0,               // ぽちの横位置（0..goal の連続値。右=朝）
  y: 0,               // ぽちの縦位置（-1..+1。0が道の中央）
  targetX: 0,         // マウスカーソルが指す目標 横位置
  targetY: 0,         // マウスカーソルが指す目標 縦位置
  paused: false,      // 友と向き合う/道のおわり 等で 追従を止めているか
  reachedBattle: false, // 道のおわり（群れのけはい）に到達したか
  dusk: 0,            // よふけメーター（0..100）。滞在・救いで満ちる＝戦闘の入りに効く（NIGHTFALL）
  nodes: [],          // 道に点在する出来事 [{at, y, type:"word"|"friend"|"battle", ...}]
  message: "",        // 足元に出す短い案内
  picked: [],         // この夜ひろった ことば（id・演出用）
  activeFriend: null, // いま「こえをかける／とおりすぎる」を待っている友ノード
  macro: null,        // マクロ結末の計算結果 {rate, ending}
  townWordJustGiven: null, // 直前に街で授かった くらしのことば（id・街演出用）
  _raf: null,         // requestAnimationFrame のハンドル（追従ループ）
  _lastT: 0,          // 直近フレームの時刻（dt補正＝フレームレート非依存にするため）
  _maxv: 1,           // 最高速（目盛り/秒）。buildField で goal から算出（瞬間ワープ防止）
  _lastStep: 0,       // 直近で踏んだ“目盛り”（足音SEを刻むため）
  _pochiEl: null, _progEl: null, _msgEl: null, _duskEl: null, // 毎フレーム軽く動かすための要素キャッシュ
};

// 追従パラメータ（Webの定石：指数ダンプ lerp＋デッドゾーン＋最高速clamp）。
//   FOLLOW=基準60fpsでの追従率（0.12〜0.20が“ぬるっと気持ちいい”帯）。dtで端末非依存に補正する。
const FOLLOW = 0.16;       // 追従の強さ
const DEADZONE_X = 0.12;   // 横の微振動止め（このぶん以内は動かない＝足音連打も防ぐ）
                           //   ※小さめ：大きいと道のおわり(goal)に届かず詰む。到達判定はこれより外側にする。
const DEADZONE_Y = 0.05;   // 縦の微振動止め
const R_WORD = 0.7;        // ことばを拾う近接半径
const R_FRIEND = 0.95;     // 友に出会う近接半径（縦に外せば“とおりすぎる”が成立＝身体性）

// ──────────────────────────────────────────
// メタ進行（夜をまたいで持ち越す）の初期化
//   newGame() では消えない別グローバル meta（state.js 宣言）に作る。
// ──────────────────────────────────────────
function initMeta() {
  meta = {
    night: 1,
    maxNights: (typeof META !== "undefined" && META.maxNights) ? META.maxNights : 3,
    friends: [],   // 街に住む友（救った友の累積）{type,name,color,shape}
    learnedWords: (PLAYER_INIT.startWords || []).slice(), // 覚えた やさしい/くらし のことば（持ち越し）
    townGiven: 0,  // 街で授けた くらしのことば の数（次に授ける語を決めるカーソル）
    totalKill: 0,  // マクロ結末用の累計
    totalSave: 0,
    history: [],   // 各夜の記録 {night, saveRate, endingId}
    // 物語ビート（一度きり）の既読フラグ。遊びながら小出しに見せ、二度目は出さない。
    _seenFirstWalk: false, _seenFirstFriend: false, _seenFirstSave: false,
    _seenFirstLight: false, _seenFirstNoLight: false,
  };
  return meta;
}

// 街に住む友の数（メタきずなの計算などで使う・null安全）
function metaFriendsCount() {
  return (meta && meta.friends) ? meta.friends.length : 0;
}

// 小さな配列シャッフル（ui.js の shuffleArr に依存しないよう自前で持つ）
function _shuffleField(arr) {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    const t = arr[i]; arr[i] = arr[j]; arr[j] = t;
  }
  return arr;
}

// ──────────────────────────────────────────
// 街（TOWN）へ
// ──────────────────────────────────────────
function enterTown() {
  if (!meta) initMeta();
  if (typeof stopFieldLoop === "function") stopFieldLoop();
  app.screen = "town";
  field.activeFriend = null;
  if (typeof document !== "undefined" && document.body) document.body.className = "theme-town";
  if (typeof startBgm === "function") startBgm("town");
  if (typeof render === "function") render();
}

// 街から夜へ出発（フィールドを組み立てて FIELD へ）
function goToField() {
  if (!meta) initMeta();
  // この夜のはじめに 街の友の数を控える＝夜明けに「灯りが ふえたか」を判定する基準（非対称の可視化）。
  meta.nightStartFriends = meta.friends.length;
  buildField();
  app.screen = "field";
  if (typeof document !== "undefined" && document.body) document.body.className = "theme-night";
  if (typeof startBgm === "function") startBgm("field");
  if (typeof render === "function") render();
  startFieldLoop(); // マウス追従のアニメーションを開始（ブラウザのみ）
}

// この夜が「さいごの夜」か
function isLastNight() {
  return !!(meta && meta.night >= meta.maxNights);
}

// 第一夜（meta.night===1）＝チュートリアル：短く静かな 一本道（寄り道なし・よふけ無し）。
//   いきなり 拾う/分岐/よふけ を出さず「歩く→1体と出会う」だけに絞る（P0-2）。
function buildTutorialField() {
  field.goal = 2.6;            // 数歩で 道のおわり（1体）に着く短さ
  field.x = 0; field.y = 0; field.targetX = 0; field.targetY = 0;
  field.paused = false; field.reachedBattle = false;
  field.dusk = 0; field._lastT = 0; field._maxv = field.goal / 4; field._lastStep = 0;
  field.picked = []; field.activeFriend = null;
  field.tutorial = true;       // renderField/歩行で よふけバーを隠す目印
  field.message = "よるの みち。マウスで ぽちを みぎへ。……だれかが、いる。";
  if (meta) meta._seenFirstWalk = true;
  field.nodes = [{ at: field.goal, y: 0, type: "battle", done: false }];
}

// 夜の道を組み立てる（夜ごとに すこし違う並びを乱数で）
function buildField() {
  // 第一夜だけ チュートリアルの短い道に差し替える。
  if (meta && meta.night === 1) { buildTutorialField(); return; }
  field.tutorial = false;
  let goal = (typeof META !== "undefined" && META.fieldGoal) ? META.fieldGoal : 10;
  // さいごの夜だけ 道を少し延ばす＝“さいご”に向かう手触り（3夜が同じにならないように）。
  if (isLastNight() && typeof META !== "undefined" && META.lastNightExtra) goal += META.lastNightExtra;
  field.goal = goal;
  field.x = 0; field.y = 0;
  field.targetX = 0; field.targetY = 0;
  field.paused = false;
  field.reachedBattle = false;
  field.dusk = 0;             // よふけメーターは毎夜リセット
  field._lastT = 0;
  field._maxv = goal / 6;     // 道を約6秒で踏破できる最高速（瞬間ワープ防止のclamp基準）
  field._lastStep = 0;
  field.picked = [];
  field.activeFriend = null;
  field.nodes = [];
  // 物語ビート：初めて夜の道に出る夜だけ、操作の意味を一拍だけ言う（二度目は情景文に戻す）。
  if (meta && !meta._seenFirstWalk) {
    field.message = "よるの みち。マウスで ぽちを じゆうに。みぎ＝朝、たて＝寄り道。";
    meta._seenFirstWalk = true;
  } else {
    field.message = "よるの みち。マウスで じゆうに（みぎ＝朝／はしの ことばは たてに 寄り道して ひろう）。";
  }

  // 落ちていることば：まだ覚えていない やさしいことば から
  const wordPool = (typeof FIELD_WORD_POOL !== "undefined" ? FIELD_WORD_POOL.slice() : [])
    .filter((id) => meta.learnedWords.indexOf(id) < 0);
  // 救いを待つ友：道で うずくまっている子。まだ街にいない“新しい顔”を優先＝夜ごとに会う相手が変わる（顔枯れ防止）。
  const allFriends = (typeof FIELD_FRIEND_POOL !== "undefined" ? FIELD_FRIEND_POOL.slice() : []);
  const homeTypes = (meta.friends || []).map((f) => f.type);
  let friendPool = allFriends.filter((id) => homeTypes.indexOf(id) < 0);
  if (!friendPool.length) friendPool = allFriends.slice(); // 全員 もう街にいるなら 再会もあり
  _shuffleField(wordPool); _shuffleField(friendPool);

  // 道の途中スロットに「友／ことば」を 2D に散らす（“右に行くだけ”の解消）。
  //   ・友 ＝ 中央寄り(y≈±0.4)：必ず出会い「むかえる／とおりすぎる」を選ぶ（物語の分岐）。
  //   ・ことば ＝ 端(y≈±0.85)：拾うには 縦に“寄り道”が要る＝任意の探索。寄るほど時間を食い よふけが濃くなる
  //     （リスク/リターン：急いで朝に近づく vs 語彙を増やして夜を重くする）。
  //   横位置(at)も間隔をばらして、一本道の単調さを消す。
  const slots = (typeof META !== "undefined" && META.fieldEventSlots) ? META.fieldEventSlots : [1.5, 3, 4.3, 5.6];
  let wi = 0, fi = 0;
  slots.forEach((at, i) => {
    const friendY = (i % 4 === 0) ? -0.4 : 0.4;   // 友は中央寄り（上下で変化）
    const wordY = (i % 4 === 1) ? -0.85 : 0.85;   // ことばは端（縦に寄り道して拾う）
    if (i % 2 === 0 && fi < friendPool.length) {
      field.nodes.push({ at: at, y: friendY, type: "friend", enemy: friendPool[fi++], done: false });
    } else if (wi < wordPool.length) {
      field.nodes.push({ at: at, y: wordY, type: "word", word: wordPool[wi++], done: false });
    } else if (fi < friendPool.length) {
      field.nodes.push({ at: at, y: friendY, type: "friend", enemy: friendPool[fi++], done: false });
    }
  });
  // 道のおわり：群れの けはい（既存戦闘へ）。縦中央に固定＝縦ズレで朝に着けない事故を防ぐ。
  field.nodes.push({ at: field.goal, y: 0, type: "battle", done: false });
}

// この夜まだ残っている「戦闘ノード」（=道のおわり）
function fieldBattleNode() {
  return field.nodes.find((n) => n.type === "battle") || null;
}

// ──────────────────────────────────────────
// マウスカーソル追従の移動（キーボード不使用）
//   ・マウスを動かす → fieldSetTarget で targetX を更新
//   ・毎フレーム fieldStepToward で x を targetX へ なめらかに近づける
//   ・通り過ぎた出来事（ことば/友/群れ）に触れたら fieldCheckNodes が反応する
// ──────────────────────────────────────────

// マウス位置（道の左上=0,0 〜 右下=1,1 の割合）から 目標位置を決める。
//   fracX/fracY は 0..1。main.js の pointermove から呼ぶ。fracY 省略時は縦を据え置き（後方互換）。
function fieldSetTarget(fracX, fracY) {
  if (app.screen !== "field") return;
  field.targetX = Math.max(0, Math.min(1, fracX)) * field.goal;
  if (typeof fracY === "number") field.targetY = Math.max(0, Math.min(1, fracY)) * 2 - 1; // 0..1 → -1..+1
}

// 1軸ぶんの追従（指数ダンプ＋最高速clamp＋デッドゾーン）。
function _stepAxis(ax, k, maxStep, lo, hi, dead) {
  const cur = field[ax];
  const tgt = field[ax === "x" ? "targetX" : "targetY"];
  const dx = tgt - cur;
  if (Math.abs(dx) < dead) return false; // デッドゾーン内は動かない（微振動・足音連打を防ぐ）
  let s = dx * k;
  s = Math.max(-maxStep, Math.min(maxStep, s)); // 瞬間ワープ防止（等速感の保持）
  field[ax] = Math.max(lo, Math.min(hi, cur + s));
  return true;
}

// 1フレームぶん、ぽちを (targetX,targetY) へ近づける（追従の本体）。
//   now: ブラウザは requestAnimationFrame の timestamp（performance.now）。検証は手動注入（未指定でも落ちない）。
function fieldStepToward(now) {
  if (app.screen !== "field" || field.paused) return;
  if (typeof now !== "number") {
    now = (typeof performance !== "undefined" && performance.now) ? performance.now() : (field._lastT + 16.7);
  }
  const dt = field._lastT ? Math.min(now - field._lastT, 50) : 16.7; // 50ms上限＝タブ復帰の暴走を防ぐ
  field._lastT = now;
  // フレームレート非依存の指数ダンプ係数（60fps基準を dt で補正）。
  const k = 1 - Math.pow(1 - FOLLOW, dt / (1000 / 60));
  const maxStep = field._maxv * dt / 1000;
  _stepAxis("x", k, maxStep, 0, field.goal, DEADZONE_X);
  _stepAxis("y", k, maxStep, -1, 1, DEADZONE_Y);

  // よふけメーター：滞在しているだけで じわっと満ちる（dtで時間補正＝端末非依存）。
  //   ＝「急ぐほど夜は浅い／長居・救いを重ねるほど夜は濃い」を時間で表現（NIGHTFALL）。
  //   ※第一夜チュートリアルでは出さない（要素を絞る＝P0-2）。
  if (typeof NIGHTFALL !== "undefined" && !field.tutorial) {
    field.dusk = Math.min(NIGHTFALL.max, field.dusk + NIGHTFALL.risePerFrame * (dt / (1000 / 60)));
  }

  // 目盛りを横に跨ぐたびに 足音（コッ）＋足元の情景＝歩いている手触り（縦移動だけでは鳴らさない）。
  const cur = Math.floor(field.x);
  if (cur > field._lastStep) {
    field._lastStep = cur;
    if (typeof playSe === "function") playSe("step");
    if (typeof FIELD_SCENERY !== "undefined" && FIELD_SCENERY.length && cur < field.goal) {
      field.message = FIELD_SCENERY[cur % FIELD_SCENERY.length];
    }
  }
  fieldPaint();      // 重い再描画はせず、ぽち・進捗・足元メッセージ・よふけバーだけ動かす
  fieldCheckNodes(); // 出来事に触れたか
}

// いまの位置で「まだ済んでいない出来事」に触れたら反応する（2D近接＝円判定）。
//   ・戦闘ノードだけは従来式（x>=goal-ε）＝縦ズレで朝に着けない事故を防ぐ。
//   ・ことば/友は「最近接1件」だけ発火（同フレーム多重発火を防ぐ）。縦に外せば素通り＝“とおりすぎる”。
function fieldCheckNodes() {
  for (const n of field.nodes) {
    if (n.done || n.type !== "battle") continue;
    // 到達判定は デッドゾーンより外側に＝右端を狙えば必ず道のおわりに着ける（詰み防止）。
    if (field.x >= field.goal - (DEADZONE_X + 0.18) && !field.reachedBattle) {
      n.done = true;
      field.reachedBattle = true;
      field.paused = true;
      field.message = "みちの おわり。群れの けはい…！";
      if (typeof render === "function") render();
      return;
    }
  }
  // word/friend：半径内に入った最近接1件だけ。近接度 _glow も入れて演出に使う。
  let best = null, bestD = Infinity;
  for (const n of field.nodes) {
    if (n.done || n.type === "battle") continue;
    const ny = n.y || 0;
    const d = Math.sqrt((field.x - n.at) * (field.x - n.at) + (field.y - ny) * (field.y - ny));
    const R = n.type === "friend" ? R_FRIEND : R_WORD;
    n._glow = Math.max(0, 1 - d / R); // 近いほど 1（renderField でグロー）
    if (d <= R && d < bestD) { best = n; bestD = d; }
  }
  if (!best) return;

  if (best.type === "word") {
    best.done = true;
    const w = KIND_WORDS[best.word];
    if (w && meta.learnedWords.indexOf(best.word) < 0) {
      meta.learnedWords.push(best.word);
      field.picked.push(best.word);
      field.message = `おちていた ことばを ひろった：「${w.word}」`;
      if (typeof playSe === "function") playSe("learn");
    } else {
      field.message = "…なにか おちていた（もう しっている ことばだ）";
    }
    // ひと呼吸 止まって “ひろった”を読ませる＝カーソルを振り切っても語が増えた手応えが消えない。
    field.paused = true;
    if (typeof setTimeout === "function") setTimeout(function () { field.paused = false; startFieldLoop(); }, 280);
    else field.paused = false;
    if (typeof renderField === "function") renderField();
  } else if (best.type === "friend") {
    // 友に近づいたら 追従を止め、「こえをかける／とおりすぎる」を選ばせる。
    field.activeFriend = best;
    field.paused = true;
    const base = ENEMIES[best.enemy] || {};
    // 物語ビート：初めて友に出会う夜だけ、一拍の語り。二度目からは素直に状況だけ。
    //   一度 とおりすぎた相手と再会したら、その子は こちらを少し覚えている（P1-2・責めない短い一言）。
    if (meta && meta._passed && meta._passed.indexOf(best.enemy) >= 0 && typeof FRIEND_REUNION_LINES !== "undefined") {
      const r = FRIEND_REUNION_LINES[Math.floor(Math.random() * FRIEND_REUNION_LINES.length)];
      field.message = `${base.name}「${r}」`;
    } else if (meta && !meta._seenFirstFriend) {
      field.message = "だれかが、うずくまってる。こわくないよ。……こえ、かけてみる？";
      meta._seenFirstFriend = true;
    } else {
      field.message = `${base.name} が、みちばたで うずくまっている。`;
    }
    if (typeof playSe === "function") playSe("calm");
    if (typeof render === "function") render();
  }
}

// 毎フレームの軽い反映（再描画せず、要素を直接動かす）。
//   横=left%(x)・縦=top%(y を 0..100% へ)・進捗バー・足元メッセージ・よふけバー。
function fieldPaint() {
  const pct = field.goal > 0 ? (field.x / field.goal) * 100 : 0;
  const topPct = 50 + (field.y || 0) * 38; // -1..+1 → 12%..88%（道幅を広げ、縦移動に意味を持たせる）
  if (field._pochiEl) { field._pochiEl.style.left = pct + "%"; field._pochiEl.style.top = topPct + "%"; }
  if (field._progEl) field._progEl.style.width = pct + "%";
  if (field._msgEl) field._msgEl.textContent = field.message || "";
  if (field._duskEl) field._duskEl.style.width = Math.round(field.dusk || 0) + "%";
}

// 追従アニメーションのループ（ブラウザのみ。requestAnimationFrame が無ければ動かない＝検証時は手動）。
//   rAF のコールバック引数 timestamp(=performance.now 相当) を fieldStepToward に渡し dt 補正に使う。
function fieldLoop(now) {
  if (app.screen !== "field") { field._raf = null; return; }
  fieldStepToward(now);
  field._raf = (typeof requestAnimationFrame === "function") ? requestAnimationFrame(fieldLoop) : null;
}
function startFieldLoop() {
  if (typeof requestAnimationFrame !== "function") return; // 検証環境(JXA)は手動で fieldStepToward を回す
  if (field._raf) return;
  field._raf = requestAnimationFrame(fieldLoop);
}
function stopFieldLoop() {
  if (field._raf && typeof cancelAnimationFrame === "function") cancelAnimationFrame(field._raf);
  field._raf = null;
}

// 道の友に「こえをかける」＝戦わずに むかえる（街の友に加わる・その子のことばを教わる）
function fieldGreet() {
  const node = field.activeFriend;
  if (!node) return;
  node.done = true;
  field.activeFriend = null;
  const base = ENEMIES[node.enemy] || {};
  // 街の友に加える（種類でユニーク化＝街が散らからないように）
  if (!meta.friends.some((m) => m.type === node.enemy)) {
    meta.friends.push({ type: node.enemy, name: base.name, color: base.color, shape: base.shape });
  }
  // その子の ことば(gift) を教わる
  if (base.gift && KIND_WORDS[base.gift] && meta.learnedWords.indexOf(base.gift) < 0) {
    meta.learnedWords.push(base.gift);
    field.picked.push(base.gift);
  }
  // 救う＝時間を食う＝夜が濃くなる（先を急ぐメリットの対価。NIGHTFALL）。
  if (typeof NIGHTFALL !== "undefined") {
    field.dusk = Math.min(NIGHTFALL.max, field.dusk + NIGHTFALL.riseOnGreet);
  }
  // 物語ビート：初めて手をのばした瞬間だけ、一拍の語り。
  if (meta && !meta._seenFirstSave) {
    field.message = "て を のばした。つめたくなかった。いっしょに、いこう。";
    meta._seenFirstSave = true;
  } else {
    field.message = `${base.name} を むかえた。いっしょに いこう。`;
  }
  if (typeof playSe === "function") playSe("save");
  fieldResume();
}

// 友を「とおりすぎる」（救わない＝寄り道をしない選択）
//   一度通りすぎた友には その夜 二度と会えない＝選択に重みを持たせる（“心が止まる”）。
function fieldPass() {
  const node = field.activeFriend;
  if (node) node.done = true;
  // とおりすぎた相手の種類を控える＝あとの夜の再会で「世界が少し覚えている」を出す（P1-2）。
  if (node && meta) { meta._passed = meta._passed || []; if (meta._passed.indexOf(node.enemy) < 0) meta._passed.push(node.enemy); }
  field.activeFriend = null;
  field.message = "…とおりすぎた。もう、あえないかもしれない。";
  if (typeof playSe === "function") playSe("miss");
  fieldResume();
}

// 選択を終えて 追従を再開（マウスへ また ついていく）。
function fieldResume() {
  field.paused = false;
  // いまの位置を 目標の下限に＝ぽちが その場で止まらず、カーソル方向へ自然に再始動できる。
  if (field.targetX < field.x) field.targetX = field.x;
  if (typeof render === "function") render();
  startFieldLoop();
}

// 道のおわりで戦闘へ（既存の戦闘を そのまま 起動）
function startNightBattle() {
  stopFieldLoop(); // 追従アニメを止めてから戦闘へ
  const bn = fieldBattleNode();
  if (bn) bn.done = true;
  // さいごの夜だけ、戦闘に入る前に ひと拍 語りを差し込む（“さいご”の重み）。
  if (isLastNight() && typeof showToast === "function") {
    const lines = (typeof TOWN_LINES !== "undefined") ? TOWN_LINES : [];
    showToast(lines[2] || "さいごの夜だよ。");
  }
  app.screen = "battle";
  startRun();                 // battle.js（無改変）：newGame（meta.learnedWords を語彙に種まき）→ startWave
  applyNightfallToBattle();   // よふけメーター → 戦闘の入りの有利/不利へ（startRun 直後＝game.player 存在）
  if (typeof document !== "undefined" && document.body) document.body.className = "theme-night";
  if (typeof startBgm === "function") startBgm("night");
  if (typeof render === "function") render();
}

// よふけ(field.dusk)を「戦闘開始時だけ」の有利/不利に変換する（battle.js には一切触れない）。
//   急いだ夜(dusk低)＝こころ＋ぬくもりの好スタート／長居・救い過多(dusk高)＝こころ減＋世界が翳る(狂気)。
//   非対称ガード：rush報酬に 祓い火力(weaponLv/EXP/weapons) は絶対に混ぜない（こころ＋ぬくもりだけ）。
//   refillKokoroEachWave=true なので効果は“1ウェーブ目の入り”に集中＝「夜の濃さで戦いの入りが決まる」。
function applyNightfallToBattle() {
  if (typeof game === "undefined" || !game || !game.player) return;
  if (typeof NIGHTFALL === "undefined") return;
  const N = NIGHTFALL, p = game.player;
  const kMax = (typeof BALANCE !== "undefined" && BALANCE.kyokiMax) ? BALANCE.kyokiMax : 12;
  const d = field.dusk || 0;
  if (d < N.rushUnder) {
    p.kokoro = Math.min(p.maxKokoro, p.kokoro + N.rushKokoro);
    p.nukumori = (p.nukumori || 0) + N.rushNukumori;
  } else if (d >= N.lateOver) {
    p.kokoro = Math.max(0, p.kokoro + N.lateKokoro);
    p.kyoki = Math.min(kMax, (p.kyoki || 0) + N.lateKyoki);
  } else {
    p.kyoki = Math.min(kMax, (p.kyoki || 0) + N.midKyoki);
  }
}

// ──────────────────────────────────────────
// 夜明け（DAWN 結末画面）から「街へ かえる」
//   この夜の戦果をメタに積み、次の夜 or マクロ結末へ。
// ──────────────────────────────────────────
function returnToTown() {
  if (!meta) initMeta();
  if (game) {
    meta.totalKill += game.counters.kill;
    meta.totalSave += game.counters.save;
    const total = game.counters.kill + game.counters.save;
    const sr = total > 0 ? game.counters.save / total : 0;
    meta.history.push({ night: meta.night, saveRate: sr, endingId: game.ending ? game.ending.id : null });
    // この夜 戦闘で むかえた友を 街に（種類でユニーク化）
    (game.savedFriends || []).forEach((f) => {
      if (!meta.friends.some((m) => m.type === f.type)) meta.friends.push(f);
    });
    // この夜 覚えたことばを 持ち越し
    (game.player.words || []).forEach((id) => {
      if (meta.learnedWords.indexOf(id) < 0) meta.learnedWords.push(id);
    });
    // 第一夜（チュートリアル）の結果を控える＝街の景色で返すため（P0-4）。
    //   A=手をのばした（迎えた） / C=きいたが手をのばさず / B=ぶつけた（きかなかった）。
    if (meta.night === 1) {
      meta._n1 = {
        outcome: game.counters.save > 0 ? "A" : (game.listened ? "C" : "B"),
        shown: false,
      };
    }
  }
  // ゆうべ「灯りが ふえたか」＝この夜に新しい友を迎えたか（街の非対称を可視化するフラグ）。
  //   倒すだけの夜は friends が増えない＝「街は さみしいまま」を街でそっと言語化する（renderTown）。
  meta.gainedLightLastNight = meta.friends.length > (meta.nightStartFriends || 0);
  grantTownWord();            // 街で くらしのことば を ひとつ 授かる（友がいるほど）
  meta.night++;
  if (meta.night > meta.maxNights) { macroEnding(); return; }
  enterTown();
}

// HP0 で 夜が明けなかったとき：夜カウンタは進めず、街にもどって もう一度（メタは保持）
function townRetry() {
  if (!meta) initMeta();
  enterTown();
}

// 街で「くらしのことば」を1つ授かる（救った友が街にいるほど＝街がやわらかくなる）
function grantTownWord() {
  field.townWordJustGiven = null;
  const seq = (typeof TOWN_WORD_SEQUENCE !== "undefined") ? TOWN_WORD_SEQUENCE : [];
  if (!meta.friends.length) return; // 友がいないと街は さみしいまま（くらしのことばは増えにくい）
  while (meta.townGiven < seq.length) {
    const id = seq[meta.townGiven];
    meta.townGiven++;
    if (KIND_WORDS[id] && meta.learnedWords.indexOf(id) < 0) {
      meta.learnedWords.push(id);
      field.townWordJustGiven = id;
      return;
    }
  }
}

// ──────────────────────────────────────────
// マクロ結末（いくつもの夜の総和で「ほんとうの夜明け」の色を決める）
// ──────────────────────────────────────────
function macroEnding() {
  if (typeof stopFieldLoop === "function") stopFieldLoop();
  const total = meta.totalKill + meta.totalSave;
  const baseRate = total > 0 ? meta.totalSave / total : 0;
  // マクロ結末は「いくつもの夜の総和」。街に住む友が多いほど ひかり に寄せる
  //   ＝周回（救った数＝街の灯り）が結末に効く（一夜版のしきい値の丸投げにしない）。
  const friendBonus = Math.min(0.15, meta.friends.length * 0.03);
  const rate = Math.min(1, baseRate + friendBonus);
  field.macro = { rate: rate, baseRate: baseRate, friendBonus: friendBonus, ending: determineEnding(rate) };
  app.screen = "macro";
  if (typeof document !== "undefined" && document.body) document.body.className = "theme-" + field.macro.ending.theme;
  if (typeof setBgmTheme === "function") setBgmTheme(field.macro.ending.theme);
  if (typeof render === "function") render();
}

// マクロ結末から「はじめから」＝メタを作り直して第一夜の街へ
function restartJourney() {
  initMeta();
  field.macro = null;
  enterTown();
}
