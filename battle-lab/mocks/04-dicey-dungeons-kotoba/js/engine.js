/*
 * engine.js — バトルの進行ルール（DOM非依存の“純粋ロジック”）
 *
 * 画面描画(ui.js)とは完全に分離してある。理由：
 *  ・ロジックだけを JXA で自動テストできる（勝ち筋/負け筋を最後まで回す）
 *  ・今後モックを増やすとき、進行ルールの考え方を使い回せる
 *
 * 状態は単一のグローバル `state` に集約。関数はそれを書き換える。
 * （mock01 / proto03・04 と同じ「グローバル state＋関数」スタイルに合わせている）
 *
 * このモックの肝：
 *   毎ターン「ことばの欠片（1〜6の音）」が出る → それを「言葉装置」に装填する →
 *   装置ごとの条件を満たせば効果が出る → 使わなかった欠片はターン終了で消える。
 *   どの欠片を どの装置に入れるか、で悩ませるのが目的（＝Dicey Dungeons 型の検証）。
 */

var state = null; // 現在のバトル状態。newBattle() で作る

var _kidCounter = 0; // ことばの欠片に振る通し番号（1枚ずつ区別するため）

/* ───────────── 補助 ───────────── */
// min〜max の整数を1つ返す（＝サイコロを振る＝「音の強さ」を決める）
function randInt(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

// ログ（画面下の「やりとりの記録」）
function logMsg(msg) {
  state.log.push(msg);
  if (state.log.length > 40) state.log.shift(); // 長くなりすぎないよう直近だけ
}

/* ───────────── バトル開始 / リスタート ───────────── */
function newBattle(enemyId) {
  var enemyDef = ENEMIES[enemyId || 'sonchou'];
  _kidCounter = 0;
  state = {
    turn: 1,
    phase: 'player',  // 'player' | 'enemy' | 'end'
    result: null,     // null | 'win' | 'lose'
    player: {
      maxNoise: BALANCE.playerMaxNoise,
      noise: BALANCE.playerMaxNoise, // 残りノイズ耐性
      juyou: 0                        // 受容（このターンのブロック）
    },
    enemy: {
      id: enemyDef.id,
      name: enemyDef.name,
      title: enemyDef.title,
      maxHeart: enemyDef.maxHeart,
      heart: enemyDef.maxHeart, // 閉じた心（残り）
      charged: false,           // 「黙って見る」で溜めている最中か
      nextNoiseDown: 0,         // 次に受けるノイズの軽減量（まって/ありがとう）
      moves: enemyDef.moves,
      intent: null              // 次の感情（行動予告）
    },
    // 言葉装置：定義(def)への参照は DEVICE_BY_ID で引く。loaded は「装填中の欠片」
    devices: DEVICE_LIST.map(function (d) { return { id: d.id, loaded: [] }; }),
    pool: [],            // いま出ている「ことばの欠片」
    nextBonusKakera: 0,  // 次ターンだけ欠片を多く振る（どうして？）
    pendingKasure: 0,    // 次ターン、かすれにする欠片の数（問いかける）
    pendingWhite: 0,     // 次ターン、もらえる白い欠片の数（心配する）
    lastError: null,     // 直近の「入れられなかった」理由（UIの一言用）
    log: []
  };
  logMsg('村長と 向きあった。ことばの欠片で「閉じた心」を ほどけるか——');
  startPlayerTurn(true);
  return state;
}

function restart() {
  return newBattle(state ? state.enemy.id : 'sonchou');
}

/* ───────────── プレイヤーのターン開始 ─────────────
 * ・受容(ブロック)と「次ノイズ軽減」を0に戻す（前の相手の番を守る一時値なので役目を終える）
 * ・ことばの欠片を振り直す（前ターンの“予兆”＝かすれ/白/欠片＋ を反映）
 * ・相手の「次の感情」を決めて予告する
 */
function startPlayerTurn(isFirst) {
  state.phase = 'player';
  state.player.juyou = 0;
  state.enemy.nextNoiseDown = 0;
  rollKakera();
  chooseEnemyIntent(false);
  if (!isFirst) logMsg('—— あなたの番。ことばの欠片が ' + state.pool.length + 'つ 出た。');
}

/* ───────────── ことばの欠片を振る ─────────────
 * 基本数＋「次ターン欠片＋1（どうして？）」を振る。
 * さらに「かすれ（音1固定）」「白い欠片（どの条件にも使える）」の予兆を反映する。
 */
function rollKakera() {
  state.pool = [];
  state.devices.forEach(function (d) { d.loaded = []; }); // 装填状態もリセット

  var count = BALANCE.kakeraPerTurn + state.nextBonusKakera;
  state.nextBonusKakera = 0;

  for (var i = 0; i < count; i++) {
    state.pool.push({
      id: 'k' + (++_kidCounter),
      value: randInt(BALANCE.diceMin, BALANCE.diceMax),
      white: false,
      kasure: false
    });
  }

  // かすれ：先頭から n 個の欠片を「音1」に固定（村長の問いかけの効果）
  var kasure = Math.min(state.pendingKasure, state.pool.length);
  for (var j = 0; j < kasure; j++) {
    state.pool[j].value = 1;
    state.pool[j].kasure = true;
  }
  if (kasure > 0) logMsg('村長の問いかけで、ことばの欠片が ' + kasure + 'つ かすれた。');
  state.pendingKasure = 0;

  // 白い欠片：基本の欠片に“追加”でもらう（村長の心配からの贈りもの）
  for (var w = 0; w < state.pendingWhite; w++) {
    state.pool.push({
      id: 'k' + (++_kidCounter),
      value: BALANCE.whiteKakeraValue,
      white: true,
      kasure: false
    });
  }
  if (state.pendingWhite > 0) logMsg('村長の心配が、白い欠片に なって 残った。');
  state.pendingWhite = 0;
}

/* ───────────── 相手の「次の感情」を決める ─────────────
 * weight で重み付けランダム抽選。ただし
 *  ・「黙って見る」は2回続けない（ずっと棒立ちにならないように）
 *  ・「心配する」は 閉じた心が低い時（or 低確率）だけ候補に入る
 * isReroll … ほんとう？ の「引き直し」から呼ばれたときは true（ログだけ変える）
 */
function chooseEnemyIntent(isReroll) {
  var prev = state.enemy.intent ? state.enemy.intent.id : null;
  var lowHeart = state.enemy.heart <= BALANCE.worryHeartThreshold;
  var worryNow = lowHeart || (Math.random() < BALANCE.worryRandomChance);

  var moves = state.enemy.moves.filter(function (m) {
    if (m.id === 'damatte' && prev === 'damatte') return false; // 連続の棒立ちは避ける
    if (m.requiresLowHeart && !worryNow) return false;          // 心配するは条件付き
    return true;
  });

  var total = 0;
  for (var i = 0; i < moves.length; i++) total += (moves[i].weight || 1);
  var r = Math.random() * total;
  var pick = moves[0];
  for (var k = 0; k < moves.length; k++) {
    r -= (moves[k].weight || 1);
    if (r <= 0) { pick = moves[k]; break; }
  }
  state.enemy.intent = pick;
  if (isReroll) logMsg('「ほんとう？」——村長の感情が、ゆらいで 選び直された。');
}

// 予告に出す「実際に来るノイズ量」（溜め分を足し、軽減分を引く＝正直な予告）
function intentNoise(move) {
  if (!move) return 0;
  var n = move.noise || 0;
  if (n <= 0) return 0; // 黙って見る（noise:0）は 0 のまま
  if (state.enemy.charged) n += BALANCE.chargeBonus;
  n -= state.enemy.nextNoiseDown;
  return n < 0 ? 0 : n;
}

/* ───────────── ことばの欠片を 言葉装置に装填する ─────────────
 * UI（クリック）からも、検証(JXA)からも、ここが唯一の入口。
 * 戻り値：{ ok:true } / { ok:false, reason:'...' }
 *
 * 流れ：
 *   1) 欠片と装置を特定する
 *   2) 条件（accept）に合うか判定。合わなければ弾く（「この欠片では言葉にならない」）
 *   3) 欠片をプールから装置の loaded へ移す
 *   4) 必要数（capacity）そろったら効果発動 → 欠片は消費。そろわなければ装填継続（ほんとう？）
 */
function loadKakera(kakeraId, deviceId) {
  if (state.phase !== 'player' || state.result) return { ok: false, reason: 'いまは 入れられない' };

  var dev = findDevice(deviceId);
  var def = DEVICE_BY_ID[deviceId];
  if (!dev || !def) return { ok: false, reason: '装置が ない' };

  // プールから欠片を探す
  var idx = -1;
  for (var i = 0; i < state.pool.length; i++) {
    if (state.pool[i].id === kakeraId) { idx = i; break; }
  }
  if (idx === -1) return { ok: false, reason: 'その欠片は もう ない' };
  var kakera = state.pool[idx];

  // 条件判定
  if (!kakeraFits(kakera, def, dev.loaded)) {
    state.lastError = 'この欠片では「' + def.name + '」に ならない';
    logMsg('「' + def.name + '」に [' + kakeraLabel(kakera) + '] は 入らなかった。');
    return { ok: false, reason: state.lastError };
  }

  // プール → 装置へ移す
  state.pool.splice(idx, 1);
  dev.loaded.push(kakera);
  state.lastError = null;

  if (dev.loaded.length >= def.capacity) {
    fireDevice(dev, def);   // 必要数そろった → 発動して消費
  } else {
    // ほんとう？ の1つ目：もう1つ「同じ音」を待つ
    logMsg('「' + def.name + '」に [' + kakeraLabel(kakera) + '] を 装填。あと ' +
      (def.capacity - dev.loaded.length) + 'つ（同じ音）。');
  }

  checkResult();
  return { ok: true };
}

// 装填中の欠片をプールへ戻す（ほんとう？ の途中でやめたいとき用）
function unloadDevice(deviceId) {
  if (state.phase !== 'player' || state.result) return false;
  var dev = findDevice(deviceId);
  if (!dev || dev.loaded.length === 0) return false;
  while (dev.loaded.length > 0) {
    state.pool.push(dev.loaded.pop());
  }
  logMsg('装填を もどした。');
  return true;
}

function findDevice(deviceId) {
  for (var i = 0; i < state.devices.length; i++) {
    if (state.devices[i].id === deviceId) return state.devices[i];
  }
  return null;
}

// 欠片の見た目ラベル（ログ用）。白＝「白3」、かすれ＝「1?」
function kakeraLabel(k) {
  if (k.white) return '白' + k.value;
  if (k.kasure) return k.value + '·';
  return '' + k.value;
}

/* ───────────── 条件判定（accept） ─────────────
 * 白い欠片は「どの条件にも合う」ワイルドカード。
 * samePair（ほんとう？）は、1つ目は何でもよく、2つ目は1つ目と同じ音（白は何にでも合う）。
 */
function kakeraFits(kakera, def, loaded) {
  if (kakera.white) return true; // 白はどこにでも入る
  switch (def.accept) {
    case 'any':     return true;
    case 'discard': return true;
    case 'odd':     return kakera.value % 2 === 1;
    case 'even':    return kakera.value % 2 === 0;
    case 'max4':    return kakera.value <= 4;
    case 'min4':    return kakera.value >= 4;
    case 'samePair':
      if (!loaded || loaded.length === 0) return true; // 1つ目はどれでも
      var first = loaded[0];
      if (first.white) return true;                    // 白が先なら何でも対になる
      return kakera.value === first.value;             // 2つ目は同じ音
    default: return false;
  }
}

/* ───────────── 装置の効果を発動する（データ effect を解釈） ─────────────
 * 発動した時点で、装填されていた欠片は「消費」される（loaded は呼び出し側でクリア）。
 */
function fireDevice(dev, def) {
  var loaded = dev.loaded;
  var e = def.effect || {};

  // 装填した音の合計と、特別な欠片の数を数える
  var sum = 0, hasOne = false, whiteCount = 0;
  for (var i = 0; i < loaded.length; i++) {
    sum += loaded[i].value;
    if (!loaded[i].white && loaded[i].value === 1) hasOne = true;
    if (loaded[i].white) whiteCount++;
  }

  logMsg('「' + def.name + '」を 発話した。');

  if (e.heartByValue) dealToEnemy(sum);
  if (typeof e.heart === 'number' && e.heart > 0) dealToEnemy(e.heart);
  if (e.blockByValue) addBlock(sum);
  if (typeof e.block === 'number' && e.block > 0) addBlock(e.block);
  if (e.blockIfHasOne && hasOne) addBlock(e.blockIfHasOne);
  if (e.kakeraNext) {
    state.nextBonusKakera += e.kakeraNext;
    logMsg('（次のターン、ことばの欠片が ' + e.kakeraNext + 'つ 増える）');
  }
  if (e.noiseDownNext) {
    state.enemy.nextNoiseDown += e.noiseDownNext;
    logMsg('（次に受けるノイズが ' + e.noiseDownNext + ' やわらぐ）');
  }
  if (e.selfNoise) {
    state.player.noise -= e.selfNoise;
    if (state.player.noise < 0) state.player.noise = 0;
    logMsg('（強い言葉の反動。ノイズ耐性 −' + e.selfNoise + '）');
  }
  if (e.rerollIntent) chooseEnemyIntent(true);

  // 白い欠片ボーナス：使った白の数だけ 受容 を上乗せ（心配を受け取る感覚）
  if (whiteCount > 0) addBlock(whiteCount * BALANCE.whiteBonusBlock);

  dev.loaded = []; // 装填した欠片は消費した
}

/* ───────────── 効果の最小単位 ───────────── */
// 相手の「閉じた心」を削る
function dealToEnemy(amount) {
  if (amount <= 0) return;
  state.enemy.heart -= amount;
  if (state.enemy.heart < 0) state.enemy.heart = 0;
  logMsg('閉じた心に ' + amount + '（のこり ' + state.enemy.heart + '）。');
}
// 受容（このターンのブロック）を得る
function addBlock(amount) {
  if (amount <= 0) return;
  state.player.juyou += amount;
  logMsg('受容を ' + amount + ' 得た（受容 ' + state.player.juyou + '）。');
}

/* ───────────── ターン終了 → 相手の番 → 次の自分の番 ─────────────
 * 描画の都合で「相手の処理」を enemyTurn() に分け、ui側で“間”を作れるようにしてある。
 */
function endTurn() {
  if (state.phase !== 'player' || state.result) return;
  // 使わなかった欠片・装填しかけの欠片は消える（毎ターン振り直す方式）
  var left = state.pool.length;
  state.devices.forEach(function (d) { left += d.loaded.length; d.loaded = []; });
  state.pool = [];
  if (left > 0) logMsg('使わなかった ことばの欠片（' + left + 'つ）は 消えた。');
  state.phase = 'enemy';
  logMsg('—— あなたは ことばを おさめた。');
}

// 相手の行動を実行する（endTurn の後に呼ぶ）
function enemyTurn() {
  if (state.phase !== 'enemy' || state.result) return;
  var move = state.enemy.intent;

  if (move.charge) {
    // 黙って見る：その番は何もしない。次の攻撃が少し強くなる
    state.enemy.charged = true;
    logMsg('村長は 黙って こちらを 見た。（次の ひと言が 強くなる）');
  } else {
    var noise = intentNoise(move);   // 溜め分＋軽減分を反映した実ノイズ
    state.enemy.charged = false;     // 溜めは消費
    damageToPlayer(noise, move.name);
    if (move.kasureNext) {
      state.pendingKasure += move.kasureNext;
      logMsg('（次のターン、ことばの欠片が ' + move.kasureNext + 'つ かすれる）');
    }
    if (move.whiteNext) {
      state.pendingWhite += move.whiteNext;
      logMsg('（次のターン、白い欠片を ' + move.whiteNext + 'つ もらえる）');
    }
  }

  // 受容と「次ノイズ軽減」はここで役目を終える（敵ターン終了後に0へ戻す）
  state.player.juyou = 0;
  state.enemy.nextNoiseDown = 0;

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
  logMsg(label + 'ノイズ ' + noise + '（受容で ' + absorbed + ' 軽減 → ' + through +
    ' 通過、耐性のこり ' + state.player.noise + '）。');
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
    newBattle: newBattle, restart: restart,
    loadKakera: loadKakera, unloadDevice: unloadDevice,
    endTurn: endTurn, enemyTurn: enemyTurn,
    rollKakera: rollKakera, chooseEnemyIntent: chooseEnemyIntent,
    intentNoise: intentNoise, kakeraFits: kakeraFits, fireDevice: fireDevice,
    dealToEnemy: dealToEnemy, addBlock: addBlock, damageToPlayer: damageToPlayer,
    findDevice: findDevice, checkResult: checkResult,
    getState: function () { return state; }
  };
}
