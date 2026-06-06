/*
 * engine.js — バトルの進行ルール（DOM非依存の“純粋ロジック”）
 *
 * 画面描画(ui.js)とは完全に分離してある。理由：
 *  ・ロジックだけを JXA で自動テストできる（勝ち筋/負け筋を最後まで回す）
 *  ・今後モックや敵・カードを増やすとき、進行ルールの考え方を使い回せる
 *
 * 状態は単一のグローバル `state` に集約。関数はそれを書き換える。
 * （proto03/04 や mock01 と同じ「グローバル state＋関数」スタイルに合わせている）
 *
 * 盤面の考え方：
 *   声の道(レーン)が BALANCE.lanes 本。各レーンに player / enemy の言霊が1つずつ向き合う。
 *   pBoard[lane] と eBoard[lane] が「正面」同士。ターン終了時にレーンごとに処理する。
 */

var state = null;   // 現在のバトル状態。newBattle() で作る
var _uid = 0;       // カード／言霊を区別するための通し番号

/* ───────────── 補助：シャッフル（Fisher–Yates） ───────────── */
function shuffle(arr) {
  for (var i = arr.length - 1; i > 0; i--) {
    var j = Math.floor(Math.random() * (i + 1));
    var t = arr[i]; arr[i] = arr[j]; arr[j] = t;
  }
  return arr;
}

/* ───────────── ログ（画面の「やりとりの記録」） ───────────── */
function logMsg(msg) {
  state.log.push(msg);
  if (state.log.length > 60) state.log.shift(); // 長くなりすぎないよう直近だけ
}

/* ───────────── 語彙束を実カードに展開する ─────────────
 * STARTING_DECK の {id,count} を、1枚ずつの「カードインスタンス」に広げる。
 * 各インスタンスは定義IDへの参照＋自分専用の uid を持つ。
 */
function buildDeck() {
  var deck = [];
  for (var i = 0; i < STARTING_DECK.length; i++) {
    var entry = STARTING_DECK[i];
    for (var n = 0; n < entry.count; n++) {
      deck.push({ uid: ++_uid, defId: entry.id });
    }
  }
  return deck;
}

// uid から手札インスタンスを探す
function handIndexOf(uid) {
  for (var i = 0; i < state.hand.length; i++) {
    if (state.hand[i].uid === uid) return i;
  }
  return -1;
}

/* ───────────── バトル開始 / リスタート ───────────── */
function newBattle(enemyId) {
  var en = ENEMIES[enemyId || 'sonchou'];
  var L = BALANCE.lanes;
  state = {
    turn: 1,
    phase: 'player',     // 'player' | 'resolving' | 'end'
    result: null,        // null | 'win' | 'lose'
    echo: BALANCE.echoStart,
    player: { maxNoise: BALANCE.playerMaxNoise, noise: BALANCE.playerMaxNoise },
    enemy: {
      id: en.id, name: en.name, title: en.title,
      maxHeart: en.maxHeart, heart: en.maxHeart,
      wordPool: en.wordPool
    },
    lanes: L,
    pBoard: makeRow(L),    // L の言霊（下側の声の道）
    eBoard: makeRow(L),    // 村長の言霊（上側の声の道）
    intent: makeRow(L),    // 村長の予告（次に出てくる言葉。defId or null）
    deepPeek: null,        // のぞく：さらに先の予告の「気配」
    drawPile: [],
    hand: [],
    discard: [],
    log: [],
    sacrificeMemory: {},   // defId -> 供えた回数（不穏ギミック②）
    pending: null,         // 設置の途中状態（供え→設置）。ui の操作用
    speakCooldown: 0       // 喋る言葉札のクールダウン（不穏ギミック①）
  };
  state.drawPile = shuffle(buildDeck());

  logMsg('村長と 机をはさんで 向きあった。言葉で「閉じた心」を ほどけるか——');
  // 開始時の予告（盤面イメージは2枚）
  chooseEnemyIntent(BALANCE.enemyIntentInitial);
  startPlayerTurn(true);
  return state;
}

// null 埋めの配列を作る（レーン行の初期化）
function makeRow(n) {
  var a = [];
  for (var i = 0; i < n; i++) a.push(null);
  return a;
}

function restart() {
  return newBattle(state ? state.enemy.id : 'sonchou');
}

/* ───────────── プレイヤーのターン開始 ─────────────
 * 1枚引く（初手は handStart 枚）。盤面の言霊は そのまま残る（Inscryption 型）。
 */
function startPlayerTurn(isFirst) {
  state.phase = 'player';
  draw(isFirst ? BALANCE.handStart : BALANCE.drawPerTurn);
  if (!isFirst) {
    logMsg('—— あなたの番。手元に 言葉を 1つ 引いた。');
    maybeSpeak(); // 数ターンに一度、言葉が ひとこと 漏らす
  }
}

/* ───────────── ドロー ─────────────
 * 山札が尽きたら、捨て札を切り直して山札に戻す（語彙束の循環）。
 */
function draw(n) {
  for (var i = 0; i < n; i++) {
    if (state.hand.length >= BALANCE.handLimit) break; // 手札上限
    if (state.drawPile.length === 0) {
      if (state.discard.length === 0) break;           // もう引けない
      state.drawPile = shuffle(state.discard);
      state.discard = [];
      logMsg('語彙束を 切りなおした（捨て札 → 山札）。');
    }
    state.hand.push(state.drawPile.pop());
  }
}

/* ───────────── 供え言葉コストの実値 ─────────────
 * 基本コスト + 場の村長「問い（重い）」があれば +omoiOfferPlus。
 * 「強い言葉を出すには、別の言葉を手放さねばならない」不穏さの中心。
 */
function effectiveOffer(def) {
  if (!def || def.kind !== 'word') return 0;
  var extra = 0;
  for (var i = 0; i < state.eBoard.length; i++) {
    var w = state.eBoard[i];
    if (w && ENEMY_WORDS[w.defId] && ENEMY_WORDS[w.defId].nature === 'omoi') {
      extra += BALANCE.omoiOfferPlus;
    }
  }
  return (def.offer || 0) + extra;
}

// 自分の盤面にある言霊の数（供えられる言葉の数）
function ownBoardCount() {
  var c = 0;
  for (var i = 0; i < state.pBoard.length; i++) if (state.pBoard[i]) c++;
  return c;
}

// 空いている自分の声の道があるか
function hasEmptyLane() {
  for (var i = 0; i < state.pBoard.length; i++) if (!state.pBoard[i]) return true;
  return false;
}

/* ───────────── 言葉を場に置く（中核・原子的） ─────────────
 * handUid     : 置く手札の言葉
 * lane        : 置き先の声の道（自分側の空きレーン）
 * offeringUids: 供える自分の言霊（盤面）の uid 配列
 *
 * 供え→設置までを1関数で行う（JXA 検証もこれを直接呼ぶ＝決定的に試せる）。
 * 戻り値：true=置けた / false=置けなかった（コスト不足・レーン埋まり等）
 */
function doPlaceWord(handUid, lane, offeringUids) {
  if (state.phase !== 'player' || state.result) return false;
  var hi = handIndexOf(handUid);
  if (hi === -1) return false;
  var inst = state.hand[hi];
  var def = CARD_LIBRARY[inst.defId];
  if (!def || def.kind !== 'word') return false;          // 盤面に置ける言葉のみ
  if (lane < 0 || lane >= state.lanes || state.pBoard[lane]) return false; // 空きレーン必須

  var need = effectiveOffer(def);
  offeringUids = offeringUids || [];
  if (offeringUids.length < need) return false;           // 供え言葉が足りない

  // 供える分だけ（多く渡されても need ぶんだけ使う）
  var used = offeringUids.slice(0, need);
  for (var u = 0; u < used.length; u++) {
    if (!sacrificeBoardWord(used[u])) return false;       // 自分の盤面の言霊でなければ失敗
  }

  // 手札から取り除いて盤面へ
  state.hand.splice(hi, 1);
  state.pBoard[lane] = { uid: inst.uid, defId: inst.defId, dur: def.dur, age: 0 };
  logMsg('L は「' + def.name + '」を 声の道' + (lane + 1) + ' に 置いた。');

  // 性質「のぞく」：さらに先の予告の気配を のぞき見る
  if (def.nature === 'nozoku') peekAhead();

  return true;
}

/* ───────────── 1つの言霊を供える（盤面 → 捨て札） ─────────────
 * 残響 +1。供えた回数を記憶し、不穏な ひとことを出す。
 */
function sacrificeBoardWord(uid) {
  for (var i = 0; i < state.pBoard.length; i++) {
    var w = state.pBoard[i];
    if (w && w.uid === uid) {
      var def = CARD_LIBRARY[w.defId];
      state.pBoard[i] = null;
      state.discard.push({ uid: w.uid, defId: w.defId });
      state.echo += 1; // 残響：言葉を手放すと増える
      // 供えるときの ひとこと（軽め・少し不穏）
      var oline = OFFER_LINES[w.defId] || OFFER_LINES.GENERIC.replace('{name}', def.name);
      logMsg(oline + '（残響 +1 → ' + state.echo + '）');
      // 同じ言葉を繰り返し供うと、盤が それを覚えている
      state.sacrificeMemory[w.defId] = (state.sacrificeMemory[w.defId] || 0) + 1;
      if (state.sacrificeMemory[w.defId] >= 2) {
        var mline = MEMORY_LINES[w.defId] || MEMORY_LINES.GENERIC.replace('{name}', def.name);
        logMsg(mline);
      }
      return true;
    }
  }
  return false;
}

/* ───────────── 残響を使う特別な言葉（盤面に置かない） ─────────────
 * いまは「もう一度」だけ：残響を払い、捨て札からランダムに1枚 手元へ戻す。
 */
function doEchoCard(handUid) {
  if (state.phase !== 'player' || state.result) return false;
  var hi = handIndexOf(handUid);
  if (hi === -1) return false;
  var inst = state.hand[hi];
  var def = CARD_LIBRARY[inst.defId];
  if (!def || def.kind !== 'echo') return false;
  if (state.echo < def.echoCost) {                 // 残響が足りない
    logMsg('残響が 足りない（' + state.echo + ' / ' + def.echoCost + '）。');
    return false;
  }

  // 効果の前に、戻せる言葉があるか確認（無ければ不発で残響も使わない）
  if (def.effect === 'recoverRandom' && state.discard.length === 0) {
    logMsg('捨て札に 戻せる言葉が ない。');
    return false;
  }

  state.echo -= def.echoCost;
  state.hand.splice(hi, 1);
  logMsg('L は「' + def.name + '」を 使った（残響 -' + def.echoCost + ' → ' + state.echo + '）。');

  // 効果は「もう一度」自身を捨て札へ入れる前に行う（自分自身を回収しないように）
  if (def.effect === 'recoverRandom') {
    var r = Math.floor(Math.random() * state.discard.length);
    var back = state.discard.splice(r, 1)[0];
    state.hand.push(back);
    logMsg('捨て札から「' + CARD_LIBRARY[back.defId].name + '」が 手元に 戻ってきた。');
  }
  state.discard.push(inst); // 使い終えた「もう一度」自身は 最後に 捨て札へ
  return true;
}

/* ───────────── ターン終了 → レーン処理へ ─────────────
 * 描画の“間”を作れるよう、フェーズ移行と本処理(resolveTurn)を分けてある。
 */
function endTurn() {
  if (state.phase !== 'player' || state.result) return false;
  state.pending = null;       // 設置の途中状態は破棄
  state.phase = 'resolving';
  logMsg('—— L は 言葉を 置きおえた。声の道が 動きはじめる。');
  return true;
}

/* ───────────── レーン処理 本体（ターンの山場） ─────────────
 * 1) レーンごとに、正面の言葉同士を処理（ぶつかる / 届く）
 * 2) ほどける（心配）の判定
 * 3) 勝敗判定（決まれば終了）
 * 4) 村長の予告カードが場に出る
 * 5) 次の予告を決める → 次の自分の番へ
 */
function resolveTurn() {
  if (state.phase !== 'resolving' || state.result) return;

  resolveLanes();          // 1) ぶつかる / 届く
  agingAndHodokeru();      // 2) 生き残った言霊の経過＋ほどける
  checkResult();           // 3) 勝敗
  if (state.result) { state.phase = 'end'; return; }

  enemyPlaceIntent();      // 4) 予告 → 盤面へ
  chooseEnemyIntent(BALANCE.enemyIntentPerTurn); // 5) 次の予告

  state.turn += 1;
  startPlayerTurn(false);
}

/* ───────────── レーンごとの処理 ───────────── */
function resolveLanes() {
  for (var lane = 0; lane < state.lanes; lane++) {
    var p = state.pBoard[lane];
    var e = state.eBoard[lane];

    if (p && e) {
      // 正面で言葉同士が ぶつかる（互いの届く力ぶん、こわれにくさが減る）
      clash(lane, p, e);
    } else if (p && !e) {
      // 正面が空 → L の言葉が 村長の閉じた心へ届く
      reachEnemyHeart(lane, p);
    } else if (!p && e) {
      // 正面が空 → 村長の言葉が L のノイズ耐性へ届く
      reachPlayerNoise(lane, e);
    }
    // 双方とも空なら 何も起きない

    // こわれた言葉を片づける（残響処理込み）
    breakIfDead(lane);
  }
}

// ぶつかり：各々が相手の「届く力」ぶん、こわれにくさを失う（守るで軽減）
function clash(lane, p, e) {
  var pDef = CARD_LIBRARY[p.defId];
  var eDef = ENEMY_WORDS[e.defId];

  var toE = pDef.reach;  // L → 村長の言葉 への ダメージ
  var toP = eDef.reach;  // 村長 → L の言葉 への ダメージ

  // 性質「守る」：受ける こわれにくさ を軽減（L 側 daijoubu 用）
  if (pDef.nature === 'mamoru') toP = Math.max(0, toP - BALANCE.mamoruReduce);
  if (eDef.nature === 'mamoru') toE = Math.max(0, toE - BALANCE.mamoruReduce);

  e.dur -= toE;
  p.dur -= toP;
  logMsg('声の道' + (lane + 1) + '：「' + pDef.name + '」が「' + eDef.name + '」と ぶつかった。'
    + '（' + eDef.name + ' のこわれにくさ -' + toE + '／' + pDef.name + ' のこわれにくさ -' + toP + '）');
}

// L の言葉が 閉じた心へ届く（壁は届かない／まっすぐは強く届く）
function reachEnemyHeart(lane, p) {
  var def = CARD_LIBRARY[p.defId];
  if (def.nature === 'kabe') {
    logMsg('声の道' + (lane + 1) + '：「' + def.name + '」は 壁。閉じた心には 届かない。');
    return;
  }
  var dmg = def.reach + (def.nature === 'massugu' ? BALANCE.massuguBonus : 0);
  if (dmg <= 0) return;
  state.enemy.heart -= dmg;
  if (state.enemy.heart < 0) state.enemy.heart = 0;
  logMsg('声の道' + (lane + 1) + '：「' + def.name + '」が 村長に 届いた。閉じた心 -' + dmg
    + '（のこり ' + state.enemy.heart + '）。');
}

// 村長の言葉が L のノイズ耐性へ届く（壁は届かない）
function reachPlayerNoise(lane, e) {
  var def = ENEMY_WORDS[e.defId];
  if (def.nature === 'kabe') return; // 沈黙は こちらへも届かない
  var dmg = def.reach;
  if (dmg <= 0) return;
  state.player.noise -= dmg;
  if (state.player.noise < 0) state.player.noise = 0;
  logMsg('声の道' + (lane + 1) + '：村長の「' + def.name + '」が L に 届いた。ノイズ耐性 -' + dmg
    + '（のこり ' + state.player.noise + '）。');
}

// こわれにくさが0以下になった言葉を 場から消す（捨て札へ／残響処理）
function breakIfDead(lane) {
  var p = state.pBoard[lane];
  var e = state.eBoard[lane];
  if (p && p.dur <= 0) {
    var pDef = CARD_LIBRARY[p.defId];
    state.pBoard[lane] = null;
    state.discard.push({ uid: p.uid, defId: p.defId });
    state.echo += 1; // L の言葉が壊れた → 残響 +1
    logMsg('「' + pDef.name + '」が こわれた。捨て札へ（残響 +1 → ' + state.echo + '）。');
  }
  if (e && e.dur <= 0) {
    var eDef = ENEMY_WORDS[e.defId];
    state.eBoard[lane] = null;
    logMsg('村長の「' + eDef.name + '」が ほどけて 消えた。');
  }
}

/* ───────────── 経過とほどける（心配） ─────────────
 * 生き残った村長の言葉の age を進め、「ほどける」性質が規定ターン残ったら
 * 閉じた心が少し ほどける（壊さず 残すことが報われる、優しい抜け道）。
 */
function agingAndHodokeru() {
  for (var lane = 0; lane < state.lanes; lane++) {
    var e = state.eBoard[lane];
    if (!e) continue;
    e.age += 1;
    var def = ENEMY_WORDS[e.defId];
    if (def.nature === 'hodokeru' && e.age >= BALANCE.hodokeruTurns) {
      state.eBoard[lane] = null;
      state.enemy.heart -= BALANCE.hodokeruHeal;
      if (state.enemy.heart < 0) state.enemy.heart = 0;
      logMsg('村長の「' + def.name + '」が、すこし ほどけた。閉じた心 -' + BALANCE.hodokeruHeal
        + '（のこり ' + state.enemy.heart + '）。');
    }
  }
  // L 側の言霊も経過（将来の効果用に age を進めておく）
  for (var l2 = 0; l2 < state.lanes; l2++) {
    if (state.pBoard[l2]) state.pBoard[l2].age += 1;
  }
}

/* ───────────── 村長：予告 → 盤面へ ───────────── */
function enemyPlaceIntent() {
  for (var lane = 0; lane < state.lanes; lane++) {
    var defId = state.intent[lane];
    if (!defId) continue;
    if (state.eBoard[lane]) continue; // 既に埋まっていたら不発（基本は空きにしか予告しない）
    var def = ENEMY_WORDS[defId];
    state.eBoard[lane] = { uid: ++_uid, defId: defId, dur: def.dur, age: 0 };
    logMsg('村長の「' + def.name + '」が 声の道' + (lane + 1) + ' に 出てきた。');
  }
  state.intent = makeRow(state.lanes); // 予告を消費
}

/* ───────────── 村長：次の予告を決める ─────────────
 * 空いている村長側の声の道から最大 desired 本に、重み付き抽選で言葉を予告する。
 * 予告は1ターン前に見えるので、L は どの声の道を 守る/攻めるか 考えられる。
 */
function chooseEnemyIntent(desired) {
  var empties = [];
  for (var i = 0; i < state.lanes; i++) {
    if (!state.eBoard[i] && !state.intent[i]) empties.push(i);
  }
  shuffle(empties);
  var count = Math.min(desired, empties.length);
  for (var k = 0; k < count; k++) {
    state.intent[empties[k]] = pickEnemyWord();
  }
  state.deepPeek = null; // 新しい予告が決まったら「気配」は消える
}

// 村長の言葉を重み付きで1つ選ぶ
function pickEnemyWord() {
  var pool = state.enemy.wordPool;
  var total = 0, i;
  for (i = 0; i < pool.length; i++) total += (ENEMY_WORDS[pool[i]].weight || 1);
  var r = Math.random() * total;
  for (i = 0; i < pool.length; i++) {
    r -= (ENEMY_WORDS[pool[i]].weight || 1);
    if (r <= 0) return pool[i];
  }
  return pool[0];
}

/* ───────────── のぞく：さらに先の予告の「気配」を読む ─────────────
 * いまの予告とは別に、次に来そうな言葉を1つ 仮抽選して見せる（変わることがある）。
 * 「わからないことを、わからないままにしない」という どうして？ の性質。
 */
function peekAhead() {
  state.deepPeek = pickEnemyWord();
  logMsg('「どうして？」——村長の さらに先の気配が、すこし 見えた。');
}

/* ───────────── 喋る言葉札（不穏ギミック①） ─────────────
 * クールダウンが明けていれば、手元 or 場 の言葉が ひとこと 漏らす。
 */
function maybeSpeak() {
  if (state.speakCooldown > 0) { state.speakCooldown -= 1; return; }
  // 候補：手元の言葉＋自分の盤面の言霊
  var cands = [];
  var i;
  for (i = 0; i < state.hand.length; i++) cands.push(state.hand[i].defId);
  for (i = 0; i < state.pBoard.length; i++) if (state.pBoard[i]) cands.push(state.pBoard[i].defId);
  // セリフを持つものだけ
  cands = cands.filter(function (id) { return SPEAK_LINES[id]; });
  if (cands.length === 0) return;
  var id = cands[Math.floor(Math.random() * cands.length)];
  var lines = SPEAK_LINES[id];
  var line = lines[Math.floor(Math.random() * lines.length)];
  logMsg(CARD_LIBRARY[id].name + line);
  state.speakCooldown = BALANCE.speakEveryTurns; // しばらく黙る
}

/* ───────────── 勝敗判定 ───────────── */
function checkResult() {
  if (state.enemy.heart <= 0) { state.result = 'win'; state.phase = 'end'; }
  else if (state.player.noise <= 0) { state.result = 'lose'; state.phase = 'end'; }
}

// JXA / Node 双方から参照できるよう公開（ブラウザでは無視される）
if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    newBattle: newBattle, restart: restart,
    startPlayerTurn: startPlayerTurn, draw: draw,
    effectiveOffer: effectiveOffer, ownBoardCount: ownBoardCount, hasEmptyLane: hasEmptyLane,
    doPlaceWord: doPlaceWord, sacrificeBoardWord: sacrificeBoardWord, doEchoCard: doEchoCard,
    endTurn: endTurn, resolveTurn: resolveTurn, resolveLanes: resolveLanes,
    clash: clash, reachEnemyHeart: reachEnemyHeart, reachPlayerNoise: reachPlayerNoise,
    agingAndHodokeru: agingAndHodokeru, enemyPlaceIntent: enemyPlaceIntent,
    chooseEnemyIntent: chooseEnemyIntent, checkResult: checkResult,
    getState: function () { return state; }
  };
}
