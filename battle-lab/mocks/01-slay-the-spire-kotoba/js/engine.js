/*
 * engine.js — バトルの進行ルール（DOM非依存の“純粋ロジック”）
 *
 * 画面描画(ui.js)とは完全に分離してある。理由：
 *  ・ロジックだけを JXA で自動テストできる（勝ち筋/負け筋を最後まで回す）
 *  ・今後モックを増やすとき、進行ルールの考え方を使い回せる
 *
 * 状態は単一のグローバル `state` に集約。関数はそれを書き換える。
 * （proto03/04 と同じ「グローバル state＋関数」スタイルに合わせている）
 */

var state = null; // 現在のバトル状態。newBattle() で作る

// uid 採番用カウンタ（同じカードを複数枚 区別するため）
var _uidCounter = 0;

/* ───────────── 補助：シャッフル（Fisher–Yates） ───────────── */
function shuffle(arr) {
  for (var i = arr.length - 1; i > 0; i--) {
    var j = Math.floor(Math.random() * (i + 1));
    var tmp = arr[i]; arr[i] = arr[j]; arr[j] = tmp;
  }
  return arr;
}

/* ───────────── デッキを実カードに展開する ─────────────
 * STARTING_DECK の {id,count} を、1枚ずつの「カードインスタンス」に広げる。
 * 各インスタンスは定義(def)への参照＋自分専用の uid を持つ。
 */
function buildDeck() {
  var deck = [];
  for (var i = 0; i < STARTING_DECK.length; i++) {
    var entry = STARTING_DECK[i];
    var def = CARD_LIBRARY[entry.id];
    for (var n = 0; n < entry.count; n++) {
      deck.push({ uid: ++_uidCounter, defId: def.id });
    }
  }
  return deck;
}

// uid からカード定義を引く（手札はuidのリストで持つ）
function cardDef(uid) {
  var inst = findInst(uid);
  return inst ? CARD_LIBRARY[inst.defId] : null;
}
function findInst(uid) {
  var piles = [state.hand, state.drawPile, state.discard];
  for (var p = 0; p < piles.length; p++) {
    for (var i = 0; i < piles[p].length; i++) {
      if (piles[p][i].uid === uid) return piles[p][i];
    }
  }
  return null;
}

/* ───────────── ログ（画面下の「やりとりの記録」） ───────────── */
function logMsg(msg) {
  state.log.push(msg);
  // 長くなりすぎないよう直近だけ保持
  if (state.log.length > 40) state.log.shift();
}

/* ───────────── バトル開始 / リスタート ───────────── */
function newBattle(enemyId) {
  var enemyDef = ENEMIES[enemyId || 'sonchou'];
  state = {
    turn: 1,
    phase: 'player',   // 'player' | 'enemy' | 'end'
    result: null,      // null | 'win' | 'lose'
    energy: BALANCE.energyPerTurn,
    player: {
      maxNoise: BALANCE.playerMaxNoise,
      noise: BALANCE.playerMaxNoise, // 残りノイズ耐性
      juyou: 0,  // 受容（ブロック）
      mayoi: 0   // 迷い
    },
    enemy: {
      id: enemyDef.id,
      name: enemyDef.name,
      title: enemyDef.title,
      maxHeart: enemyDef.maxHeart,
      heart: enemyDef.maxHeart, // 閉じた心（残り）
      hokorobi: 0,  // ほころび
      charged: false, // 「黙って見る」で溜めている最中か
      moves: enemyDef.moves,
      intent: null   // 次の感情（行動予告）
    },
    drawPile: shuffle(buildDeck()),
    hand: [],
    discard: [],
    log: []
  };
  logMsg('村長と 向きあった。言葉で「閉じた心」を ほどけるか——');
  startPlayerTurn(true);
  return state;
}

function restart() {
  return newBattle(state ? state.enemy.id : 'sonchou');
}

/* ───────────── プレイヤーのターン開始 ─────────────
 * ・受容(ブロック)を0に戻す：受容は「直前の相手の番」を守るための一時値。
 *   自分の番が回ってきた時点で役目を終えるので、ここでリセットする。
 *   （仕様の「ターン中だけ有効／敵のノイズを軽減」を満たすのはこの順序）
 * ・こころ(エナジー)を満タンに、5枚ドロー、相手の「次の感情」を決めて予告。
 */
function startPlayerTurn(isFirst) {
  state.phase = 'player';
  state.player.juyou = 0;
  state.energy = BALANCE.energyPerTurn;
  draw(BALANCE.drawPerTurn);
  chooseEnemyIntent();
  if (!isFirst) logMsg('—— あなたの番。いまの こころは ' + state.energy + '。');
}

/* ───────────── ドロー ─────────────
 * 山札が尽きたら、捨て札を切り直して山札に戻す（デッキ循環）。
 */
function draw(n) {
  for (var i = 0; i < n; i++) {
    if (state.hand.length >= BALANCE.handLimit) break; // 手札上限
    if (state.drawPile.length === 0) {
      if (state.discard.length === 0) break; // 引く札がもう無い
      state.drawPile = shuffle(state.discard);
      state.discard = [];
      logMsg('語彙を 切りなおした（捨て札 → 山札）。');
    }
    state.hand.push(state.drawPile.pop());
  }
}

/* ───────────── 相手の「次の感情」を決める ─────────────
 * weight で重み付けランダム抽選。ただし「黙って見る」は2回続けない
 * （ずっと棒立ちにならないように）。STSのように、予告を見て言葉を選べる。
 */
function chooseEnemyIntent() {
  var moves = state.enemy.moves.slice();
  var prev = state.enemy.intent ? state.enemy.intent.id : null;
  if (prev === 'damatte') {
    moves = moves.filter(function (m) { return m.id !== 'damatte'; });
  }
  var total = 0;
  for (var i = 0; i < moves.length; i++) total += (moves[i].weight || 1);
  var r = Math.random() * total;
  var pick = moves[0];
  for (var j = 0; j < moves.length; j++) {
    r -= (moves[j].weight || 1);
    if (r <= 0) { pick = moves[j]; break; }
  }
  state.enemy.intent = pick;
}

// 予告に出す「実際に来るノイズ量」（溜め中なら加算して見せる＝正直な予告）
function intentNoise(move) {
  if (!move || move.kind !== 'attack') return 0;
  return move.noise + (state.enemy.charged ? BALANCE.chargeBonus : 0);
}

/* ───────────── カードを使う ─────────────
 * 戻り値：true=使えた / false=使えなかった（こころ不足など）
 */
function playCard(uid) {
  if (state.phase !== 'player' || state.result) return false;
  var idx = -1;
  for (var i = 0; i < state.hand.length; i++) {
    if (state.hand[i].uid === uid) { idx = i; break; }
  }
  if (idx === -1) return false;
  var inst = state.hand[idx];
  var def = CARD_LIBRARY[inst.defId];
  if (def.cost > state.energy) return false; // こころが足りない

  state.energy -= def.cost;
  state.hand.splice(idx, 1);   // 手札から取り除く
  state.discard.push(inst);    // 使った言葉は捨て札へ
  logMsg('「' + def.name + '」を つかった。');

  applyEffect(def);

  checkResult();
  return true;
}

/* ───────────── カード効果の適用（データ effect を解釈） ───────────── */
function applyEffect(def) {
  var e = def.effect || {};
  var isTell = (def.type === 'tell');

  if (typeof e.block === 'number' && e.block > 0) {
    state.player.juyou += e.block;
    logMsg('受容を ' + e.block + ' 得た（受容 ' + state.player.juyou + '）。');
  }
  if (typeof e.draw === 'number' && e.draw > 0) {
    draw(e.draw);
    logMsg('言葉を ' + e.draw + '枚 引いた。');
  }
  if (typeof e.damage === 'number' && e.damage > 0) {
    dealToEnemy(e.damage, isTell);
  }
  if (e.applyEnemy) {
    for (var k in e.applyEnemy) {
      if (!e.applyEnemy.hasOwnProperty(k)) continue;
      state.enemy[k] = (state.enemy[k] || 0) + e.applyEnemy[k];
      logMsg('相手に「' + (STATUS_DEFS[k] ? STATUS_DEFS[k].name : k) + '」を ' + e.applyEnemy[k] + ' 付与。');
    }
  }
  if (e.applySelf) {
    for (var k2 in e.applySelf) {
      if (!e.applySelf.hasOwnProperty(k2)) continue;
      state.player[k2] = (state.player[k2] || 0) + e.applySelf[k2];
    }
  }
  if (typeof e.discardRandom === 'number' && e.discardRandom > 0) {
    discardRandom(e.discardRandom);
  }
}

/* ───────────── 相手の「閉じた心」へダメージ ─────────────
 * 『つたえる』言葉のときだけ、迷い(自分の弱体)とほころび(相手の弱点)を反映：
 *   1) 迷い があれば -2 して 迷いを1消費
 *   2) ほころび があれば ×1.5 して ほころびを1消費
 */
function dealToEnemy(amount, isTell) {
  var dmg = amount;
  if (isTell && state.player.mayoi > 0) {
    dmg -= BALANCE.mayoiTellPenalty;
    state.player.mayoi -= 1;
    logMsg('（迷いで すこし 言いよどんだ）');
  }
  if (isTell && state.enemy.hokorobi > 0) {
    dmg = Math.round(dmg * BALANCE.hokorobiMultiplier);
    state.enemy.hokorobi -= 1;
    logMsg('（ほころびを 突いた）');
  }
  if (dmg < 0) dmg = 0;
  state.enemy.heart -= dmg;
  if (state.enemy.heart < 0) state.enemy.heart = 0;
  logMsg('閉じた心に ' + dmg + '（のこり ' + state.enemy.heart + '）。');
}

// 手札からランダムに n 枚 捨て札へ（沈黙する 用）
function discardRandom(n) {
  for (var i = 0; i < n; i++) {
    if (state.hand.length === 0) break;
    var r = Math.floor(Math.random() * state.hand.length);
    var inst = state.hand.splice(r, 1)[0];
    state.discard.push(inst);
    logMsg('言葉を ひとつ 飲み込んだ（' + CARD_LIBRARY[inst.defId].name + ' を捨てた）。');
  }
}

/* ───────────── ターン終了 → 相手の番 → 次の自分の番 ─────────────
 * 描画の都合で「相手の処理」と「次の自分の番開始」を分けて呼べるよう、
 * enemyTurn() を独立させてある（ui側で“間”を作れる）。
 */
function endTurn() {
  if (state.phase !== 'player' || state.result) return;
  // 使い切れなかった手札は捨て札へ（毎ターン引き直す方式）
  while (state.hand.length > 0) {
    state.discard.push(state.hand.pop());
  }
  state.phase = 'enemy';
  logMsg('—— あなたは 言葉を おさめた。');
}

// 相手の行動を実行する（endTurn の後に呼ぶ）
function enemyTurn() {
  if (state.phase !== 'enemy' || state.result) return;
  var move = state.enemy.intent;
  if (move.kind === 'attack') {
    var noise = intentNoise(move); // 溜め分を含む実ダメージ
    state.enemy.charged = false;   // 溜めは消費
    damageToPlayer(noise, move.name);
    if (move.applyPlayer) {
      for (var k in move.applyPlayer) {
        if (!move.applyPlayer.hasOwnProperty(k)) continue;
        state.player[k] = (state.player[k] || 0) + move.applyPlayer[k];
        logMsg('あなたに「' + (STATUS_DEFS[k] ? STATUS_DEFS[k].name : k) + '」が ' + move.applyPlayer[k] + '。');
      }
    }
  } else if (move.kind === 'charge') {
    state.enemy.charged = true;
    logMsg('村長は 黙って こちらを 見た。（次の ひと言が 強くなる）');
  }

  checkResult();
  if (!state.result) {
    state.turn += 1;
    startPlayerTurn(false);
  }
}

/* ───────────── プレイヤーへノイズ ─────────────
 * まず受容(ブロック)で吸収し、あふれた分だけノイズ耐性を削る。
 */
function damageToPlayer(noise, moveName) {
  var absorbed = Math.min(state.player.juyou, noise);
  state.player.juyou -= absorbed;
  var through = noise - absorbed;
  state.player.noise -= through;
  if (state.player.noise < 0) state.player.noise = 0;
  var label = moveName ? ('村長は「' + moveName + '」。') : '';
  logMsg(label + 'ノイズ ' + noise + '（受容で ' + absorbed + ' 軽減 → ' + through + ' 通過、耐性のこり ' + state.player.noise + '）。');
}

/* ───────────── 勝敗判定 ───────────── */
function checkResult() {
  if (state.enemy.heart <= 0) {
    state.result = 'win';
    state.phase = 'end';
  } else if (state.player.noise <= 0) {
    state.result = 'lose';
    state.phase = 'end';
  }
}

// JXA / Node 双方から参照できるよう公開（ブラウザでは無視される）
if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    newBattle: newBattle, restart: restart, playCard: playCard,
    endTurn: endTurn, enemyTurn: enemyTurn, draw: draw,
    intentNoise: intentNoise, cardDef: cardDef,
    getState: function () { return state; }
  };
}
