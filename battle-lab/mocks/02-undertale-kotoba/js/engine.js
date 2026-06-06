/*
 * engine.js — コマンドフェーズの進行ルール（DOM非依存の“純粋ロジック”）
 *
 * 画面描画(ui.js)・弾よけ(bullet.js のリアルタイム部分)とは分離してある。理由：
 *  ・理解度/警戒度/ノイズ耐性の変化や勝敗判定だけを JXA で自動テストできる
 *  ・今後「相手ごとの専用セリフ」「複数の勝利ルート」を足すとき考え方を使い回せる
 *
 * 状態は単一のグローバル `state` に集約（mock01 / proto03,04 と同じスタイル）。
 *
 * 1ターンの流れ（phase の移り変わり）：
 *   command（コマンド選択）
 *     → applyCommand() で 理解度/警戒度/耐性 が変化＆村長セリフ
 *     → dodge（感情回避フェーズ。bullet.js が実時間で回す）
 *     → resolveDodge() で 被ダメ反映・記憶のかけら反映・勝敗判定 → 次の command
 */

var state = null; // 現在のバトル状態。newBattle() で作る

/* ───────────── 補助 ───────────── */
function clamp(v, lo, hi) { return Math.max(lo, Math.min(hi, v)); }

function logMsg(msg) {
  state.log.push(msg);
  if (state.log.length > 40) state.log.shift(); // 長くなりすぎ防止
}

// data.js のコマンド option を id から引く（'tsutaeru'/'konnichiwa' などの親子idで探す）
function findOption(optId) {
  for (var c = 0; c < COMMAND_TREE.length; c++) {
    var opts = COMMAND_TREE[c].options;
    for (var o = 0; o < opts.length; o++) {
      if (opts[o].id === optId) return { cat: COMMAND_TREE[c], opt: opts[o] };
    }
  }
  return null;
}

/* ───────────── 使用可能条件の判定 ─────────────
 * data.js の requires キーを解釈する。UI はこれで「選べるか」を判断する。
 * 'understand80'（ほどく）は“ボタンは出すが、押すと成否が分かれる”ので、
 *   ここでは「画面に出してよいか」を true で返す（成否は applyCommand 側）。
 */
function isOptionVisible(opt) {
  if (!opt.requires) return true;
  if (opt.requires === 'shinpaiUnlocked') return !!state.flags.shinpaiUnlocked;
  if (opt.requires === 'understand80') return true; // 常に出す（押すと成否判定）
  return true;
}
// そのコマンドが今“有効”か（押して意味があるか）
function isOptionEnabled(opt) {
  if (opt.requires === 'shinpaiUnlocked') return !!state.flags.shinpaiUnlocked;
  return true; // ほどく も含め、基本は押せる（ほどくは押した結果で成否）
}

/* ───────────── バトル開始 / リスタート ───────────── */
function newBattle() {
  state = {
    turn: 1,
    phase: 'command',   // 'command' | 'dodge' | 'end'
    result: null,       // null | 'win' | 'lose'
    player: {
      maxNoise: BALANCE.playerMaxNoise,
      noise: BALANCE.playerMaxNoise // 残りノイズ耐性（0で敗北）
    },
    enemy: {
      name: LORE.enemyName,
      title: LORE.enemyTitle,
      understanding: 0,   // 理解度 0〜100（80以上で ほどける）
      wariness: 0,        // 警戒度 0〜100（高いほど回避フェーズが激しい）
      emotion: null       // 次の感情（回避フェーズの弾幕を決める）
    },
    flags: {
      shinpaiUnlocked: false, // 『まねる』で true。つたえるに「心配している」が出る
      slowNext: false,        // 『まって』で true。次の回避フェーズを少し遅く
      guardNext: false        // 『沈黙する』で true。次の回避フェーズの被ダメ軽減
    },
    pendingFail: null, // 『ほどく』失敗時のセリフを一時保持（UI用）
    log: []
  };
  chooseEmotion(); // 最初の「次の感情」を決めておく（プレイヤーが見て言葉を選べる）
  logMsg('村長と 向きあった。言葉で「閉じた心」を ほどけるか——');
  return state;
}

function restartBattle() { return newBattle(); }

/* ───────────── 次の「感情」を決める ─────────────
 * weight で重み付け抽選。心配する は理解度60以上のときだけ候補に入る。
 * 直前と同じ感情は避けて、回避フェーズに変化を出す。
 */
function chooseEmotion() {
  var prev = state.enemy.emotion ? state.enemy.emotion.id : null;
  var pool = [];
  for (var k in EMOTIONS) {
    if (!EMOTIONS.hasOwnProperty(k)) continue;
    var em = EMOTIONS[k];
    if (em.requiresUnderstanding && state.enemy.understanding < em.requiresUnderstanding) continue;
    if (em.id === prev) continue; // 直前と同じは除く（候補が1つしか無ければ後で救済）
    pool.push(em);
  }
  if (pool.length === 0) { // 救済：全部はじかれたら直前も含めて選ぶ
    for (var k2 in EMOTIONS) {
      if (!EMOTIONS.hasOwnProperty(k2)) continue;
      var em2 = EMOTIONS[k2];
      if (em2.requiresUnderstanding && state.enemy.understanding < em2.requiresUnderstanding) continue;
      pool.push(em2);
    }
  }
  var total = 0;
  for (var i = 0; i < pool.length; i++) total += (pool[i].weight || 1);
  var r = Math.random() * total;
  var pick = pool[0];
  for (var j = 0; j < pool.length; j++) {
    r -= (pool[j].weight || 1);
    if (r <= 0) { pick = pool[j]; break; }
  }
  state.enemy.emotion = pick;
}

/* ───────────── コマンドを実行する ─────────────
 * 戻り値（UIが次に何をするか分かるように）：
 *   { kind:'dodge' }  … 効果を反映した。続けて回避フェーズへ
 *   { kind:'win' }    … 『ほどく』成功（勝利）
 *   { kind:'fail' }   … 『ほどく』を押したが理解度不足。コマンド選択に留まる
 *   { kind:'none' }   … 何もしなかった（条件未達など）
 */
function applyCommand(optId) {
  if (state.phase !== 'command' || state.result) return { kind: 'none' };
  var found = findOption(optId);
  if (!found) return { kind: 'none' };
  var opt = found.opt;
  if (!isOptionEnabled(opt)) return { kind: 'none' };

  var e = opt.effect || {};

  // 『ほどく』：勝敗が分かれる特別なコマンド
  if (e.win) {
    if (state.enemy.understanding >= BALANCE.winThreshold) {
      logMsg('Lは「ほどく」を選んだ。');
      pushLines(opt.winLines || []);
      state.result = 'win';
      state.phase = 'end';
      return { kind: 'win' };
    } else {
      // 失敗：ターンは消費せず、コマンド選択に留まる（やさしい仕様）
      logMsg('Lは「ほどく」を試みた……が、まだ早い。');
      pushLines(opt.failLines || []);
      state.pendingFail = (opt.failLines || []).slice();
      return { kind: 'fail' };
    }
  }

  // 通常コマンド：理解度・警戒度・回復・解禁・次フェーズ修飾を反映
  if (typeof e.und === 'number') {
    state.enemy.understanding = clamp(state.enemy.understanding + e.und, 0, BALANCE.understandingMax);
  }
  if (typeof e.war === 'number') {
    state.enemy.wariness = clamp(state.enemy.wariness + e.war, 0, BALANCE.warinessMax);
  }
  if (typeof e.heal === 'number') {
    state.player.noise = clamp(state.player.noise + e.heal, 0, state.player.maxNoise);
  }
  if (e.unlock) {
    if (e.unlock === 'shinpai') state.flags.shinpaiUnlocked = true;
  }
  if (e.slowNext) state.flags.slowNext = true;
  if (e.guardNext) state.flags.guardNext = true;

  pushLines(opt.lines || []);

  // 効果を反映したら、感情回避フェーズへ
  state.phase = 'dodge';
  return { kind: 'dodge' };
}

// セリフをログへ流す（会話欄はログから読む）
function pushLines(lines) {
  for (var i = 0; i < lines.length; i++) logMsg(lines[i]);
}

/* ───────────── 回避フェーズの結果を反映 ─────────────
 * bullet.js が回したフィールドの集計（被ダメ・拾った記憶のかけら数）を受け取り、
 * ノイズ耐性と理解度に反映する。『沈黙する』があれば被ダメを軽減。
 * その後、勝敗判定 → 続くなら次ターンの感情を決めて command へ戻る。
 *
 * resultSummary: { damage:Number, shards:Number }
 */
function resolveDodge(resultSummary) {
  if (state.phase !== 'dodge' || state.result) return;
  var dmg = (resultSummary && resultSummary.damage) || 0;
  var shards = (resultSummary && resultSummary.shards) || 0;

  // 沈黙する：このフェーズの被ダメを軽減（切り捨て）。フラグは1回で消費
  if (state.flags.guardNext && dmg > 0) {
    var reduced = Math.floor(dmg * BALANCE.guardReduce);
    logMsg('（沈黙が ノイズを 受け止めた：' + dmg + ' → ' + reduced + '）');
    dmg = reduced;
  }
  state.flags.guardNext = false;
  state.flags.slowNext = false; // まって も1フェーズで消費

  if (dmg > 0) {
    state.player.noise = clamp(state.player.noise - dmg, 0, state.player.maxNoise);
    logMsg('感情の ノイズを ' + dmg + ' 受けた（耐性のこり ' + state.player.noise + '）。');
  } else {
    logMsg('ノイズを すべて 避けきった。');
  }

  // 記憶のかけら：触れた数 × 3 だけ理解度が上がる
  if (shards > 0) {
    var gain = shards * (NOISE_TYPES.shard.heal || 3);
    state.enemy.understanding = clamp(state.enemy.understanding + gain, 0, BALANCE.understandingMax);
    logMsg('記憶のかけらに ' + shards + '回 触れた（理解度 +' + gain + '）。');
  }

  checkResult();
  if (!state.result) {
    state.turn += 1;
    chooseEmotion();           // 次ターンの「次の感情」を用意
    state.phase = 'command';
  }
}

/* ───────────── 勝敗判定 ───────────── */
function checkResult() {
  if (state.player.noise <= 0) {
    state.player.noise = 0;
    state.result = 'lose';
    state.phase = 'end';
  }
  // 勝利は『ほどく』成功でのみ確定する（理解度80でも自動勝利にはしない）
}

// JXA / Node 双方から参照できるよう公開（ブラウザでは無視される）
if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    newBattle: newBattle, restartBattle: restartBattle,
    chooseEmotion: chooseEmotion, applyCommand: applyCommand,
    resolveDodge: resolveDodge, checkResult: checkResult,
    findOption: findOption, isOptionVisible: isOptionVisible,
    isOptionEnabled: isOptionEnabled,
    getState: function () { return state; }
  };
}
