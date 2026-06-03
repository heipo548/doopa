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

// 夜のフィールド（横スクロールの道）の歩行状態
//   操作は「マウスカーソル追従」のみ（キーボード不使用）。ぽちは x を 0→goal へ なめらかに進む。
const field = {
  goal: 0,            // 朝（道のおわり＝群れのけはい）までの距離（目盛り）
  x: 0,               // ぽちの現在位置（0..goal の連続値）
  targetX: 0,         // マウスカーソルが指す目標位置（0..goal）。ぽちは ここへ追従する
  paused: false,      // 友と向き合う/道のおわり 等で 追従を止めているか
  reachedBattle: false, // 道のおわり（群れのけはい）に到達したか
  nodes: [],          // 道に点在する出来事 [{at, type:"word"|"friend"|"battle", ...}]
  message: "",        // 足元に出す短い案内
  picked: [],         // この夜ひろった ことば（id・演出用）
  activeFriend: null, // いま「こえをかける／とおりすぎる」を待っている友ノード
  macro: null,        // マクロ結末の計算結果 {rate, ending}
  townWordJustGiven: null, // 直前に街で授かった くらしのことば（id・街演出用）
  _raf: null,         // requestAnimationFrame のハンドル（追従ループ）
  _lastStep: 0,       // 直近で踏んだ“目盛り”（足音SEを刻むため）
  _pochiEl: null, _progEl: null, _msgEl: null, // 毎フレーム軽く動かすための要素キャッシュ
};

// 追従の速さ（1フレームで進む 目盛り量）。小さすぎず大きすぎず＝出来事を飛ばさない。
const FIELD_SPEED = 0.12;

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

// 夜の道を組み立てる（夜ごとに すこし違う並びを乱数で）
function buildField() {
  let goal = (typeof META !== "undefined" && META.fieldGoal) ? META.fieldGoal : 10;
  // さいごの夜だけ 道を少し延ばす＝“さいご”に向かう手触り（3夜が同じにならないように）。
  if (isLastNight() && typeof META !== "undefined" && META.lastNightExtra) goal += META.lastNightExtra;
  field.goal = goal;
  field.x = 0;
  field.targetX = 0;
  field.paused = false;
  field.reachedBattle = false;
  field._lastStep = 0;
  field.picked = [];
  field.activeFriend = null;
  field.nodes = [];
  field.message = "よるの みち。マウスで ぽちを みちびこう（みぎへ すすむと 朝）。";

  // 落ちていることば：まだ覚えていない やさしいことば から
  const wordPool = (typeof FIELD_WORD_POOL !== "undefined" ? FIELD_WORD_POOL.slice() : [])
    .filter((id) => meta.learnedWords.indexOf(id) < 0);
  // 救いを待つ友：道で うずくまっている子の種類
  const friendPool = (typeof FIELD_FRIEND_POOL !== "undefined" ? FIELD_FRIEND_POOL.slice() : []);
  _shuffleField(wordPool); _shuffleField(friendPool);

  // 道の途中スロットに「友／ことば」を交互に置く（偶数番は 友、奇数番は ことば）
  const slots = (typeof META !== "undefined" && META.fieldEventSlots) ? META.fieldEventSlots : [3, 6, 8];
  let wi = 0, fi = 0;
  slots.forEach((at, i) => {
    if (i % 2 === 0 && fi < friendPool.length) {
      field.nodes.push({ at: at, type: "friend", enemy: friendPool[fi++], done: false });
    } else if (wi < wordPool.length) {
      field.nodes.push({ at: at, type: "word", word: wordPool[wi++], done: false });
    } else if (fi < friendPool.length) {
      field.nodes.push({ at: at, type: "friend", enemy: friendPool[fi++], done: false });
    }
  });
  // 道のおわり：群れの けはい（既存戦闘へ）
  field.nodes.push({ at: field.goal, type: "battle", done: false });
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

// マウス位置（道の左端=0 〜 右端=goal の割合）から 目標位置を決める。
//   引数 frac は 0..1（道に対する横位置の割合）。ui.js / main.js のポインタ処理から呼ぶ。
function fieldSetTarget(frac) {
  if (app.screen !== "field") return;
  const f = Math.max(0, Math.min(1, frac));
  field.targetX = f * field.goal;
}

// 1フレームぶん、ぽちを targetX へ近づける（追従の本体）。
function fieldStepToward() {
  if (app.screen !== "field" || field.paused) return;
  const dx = field.targetX - field.x;
  if (Math.abs(dx) > 0.0005) {
    const stepv = Math.max(-FIELD_SPEED, Math.min(FIELD_SPEED, dx));
    field.x = Math.max(0, Math.min(field.goal, field.x + stepv));
    // 目盛りを跨ぐたびに 足音（コッ）＋足元の情景＝歩いている手触り（無音の単調さを避ける）。
    const cur = Math.floor(field.x);
    if (cur > field._lastStep) {
      field._lastStep = cur;
      if (typeof playSe === "function") playSe("step");
      if (typeof FIELD_SCENERY !== "undefined" && FIELD_SCENERY.length && cur < field.goal) {
        field.message = FIELD_SCENERY[cur % FIELD_SCENERY.length];
      }
    }
  }
  fieldPaint();      // 重い再描画はせず、ぽち・進捗・足元メッセージだけ動かす
  fieldCheckNodes(); // 出来事に触れたか
}

// いまの x で「まだ済んでいない出来事」に触れたら反応する。
//   ぽちは右へ進んで朝を目指すので、近づいた（x が ノード位置を超えた）出来事が順に発火する。
function fieldCheckNodes() {
  for (const n of field.nodes) {
    if (n.done) continue;
    if (field.x < n.at - 0.08) continue; // まだ届いていない
    if (n.type === "word") {
      n.done = true;
      const w = KIND_WORDS[n.word];
      if (w && meta.learnedWords.indexOf(n.word) < 0) {
        meta.learnedWords.push(n.word);
        field.picked.push(n.word);
        field.message = `おちていた ことばを ひろった：「${w.word}」`;
        if (typeof playSe === "function") playSe("learn");
      } else {
        field.message = "…なにか おちていた（もう しっている ことばだ）";
      }
      if (typeof renderField === "function") renderField(); // 拾った印（done）を反映
    } else if (n.type === "friend") {
      // 友に出会ったら 追従を止め、「こえをかける／とおりすぎる」を選ばせる（素通りさせない）。
      field.activeFriend = n;
      field.paused = true;
      const base = ENEMIES[n.enemy] || {};
      field.message = `${base.name} が、みちばたで うずくまっている。`;
      if (typeof playSe === "function") playSe("calm");
      if (typeof render === "function") render();
      return;
    } else if (n.type === "battle") {
      // 道のおわり＝群れのけはい。止まって「群れと むきあう」を出す。
      n.done = true;
      field.reachedBattle = true;
      field.paused = true;
      field.message = "みちの おわり。群れの けはい…！";
      if (typeof render === "function") render();
      return;
    }
  }
}

// 毎フレームの軽い反映（再描画せず、要素を直接動かす）。
function fieldPaint() {
  const pct = field.goal > 0 ? (field.x / field.goal) * 100 : 0;
  if (field._pochiEl) field._pochiEl.style.left = pct + "%";
  if (field._progEl) field._progEl.style.width = pct + "%";
  if (field._msgEl) field._msgEl.textContent = field.message || "";
}

// 追従アニメーションのループ（ブラウザのみ。requestAnimationFrame が無ければ動かない＝検証時は手動）。
function fieldLoop() {
  if (app.screen !== "field") { field._raf = null; return; }
  fieldStepToward();
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
  field.message = `${base.name} を むかえた。いっしょに いこう。`;
  if (typeof playSe === "function") playSe("save");
  fieldResume();
}

// 友を「とおりすぎる」（救わない＝寄り道をしない選択）
//   一度通りすぎた友には その夜 二度と会えない＝選択に重みを持たせる（“心が止まる”）。
function fieldPass() {
  const node = field.activeFriend;
  if (node) node.done = true;
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
  startRun();                 // battle.js：newGame（meta.learnedWords を語彙に種まき）→ startWave
  if (typeof document !== "undefined" && document.body) document.body.className = "theme-night";
  if (typeof startBgm === "function") startBgm("night");
  if (typeof render === "function") render();
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
