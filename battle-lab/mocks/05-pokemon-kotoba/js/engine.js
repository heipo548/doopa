/*
 * engine.js — バトルの進行ルール（DOM非依存の“純粋ロジック”）
 *
 * 画面描画(ui.js)とは完全に分離してある。理由：
 *  ・ロジックだけを JXA で自動テストできる（勝ち筋/負け筋を最後まで回す）
 *  ・今後 言葉技や相手を増やすとき、進行ルールの考え方を使い回せる
 *
 * 状態は単一のグローバル `state` に集約。関数はそれを書き換える。
 * （battle-lab の他モックと同じ「グローバル state＋関数」スタイルに合わせている）
 *
 * ── ポケモン型の流れ ─────────────────────────────
 *   1ターン ＝ 「L が 4つの言葉技から1つ選ぶ」→「村長が1つ行動する」。
 *   カードバトル(モック01)と違い、L が打てるのは1ターン1手だけ。
 */

var state = null; // 現在のバトル状態。newBattle() で作る

/* ───────────── 補助：確率ロール ─────────────
 * p（0〜1）の確率で true。テストのとき Math.random を差し替えれば決定的にできる。
 */
function roll(p) { return Math.random() < p; }

/* ───────────── タイプ相性の倍率を返す ─────────────
 * 「言葉タイプ wordType」を「感情タイプ emotion」の相手に使ったときの倍率。
 *   よく届く：1.5 / 普通：1.0 / 少しずれる：0.5
 * 相性表に無い感情（将来用）は すべて 1.0 にしておく（安全側）。
 */
function typeMultiplier(wordType, emotion) {
  var m = MATCHUP[emotion];
  if (!m) return BALANCE.multNeutral;
  if (m.good.indexOf(wordType) >= 0) return BALANCE.multEffective;
  if (m.bad.indexOf(wordType) >= 0) return BALANCE.multResisted;
  return BALANCE.multNeutral;
}

// 倍率に対応する相性メッセージのキーを返す（ログ表示用）
function relKey(mult) {
  if (mult >= BALANCE.multEffective) return 'effective';
  if (mult <= BALANCE.multResisted) return 'resisted';
  return 'neutral';
}

/* ───────────── ログ（画面下の「やりとりの記録」） ───────────── */
function logMsg(msg) {
  state.log.push(msg);
  if (state.log.length > 50) state.log.shift(); // 長くなりすぎないよう直近だけ保持
}

/* ───────────── バトル開始 / リスタート ───────────── */
function newBattle(enemyId) {
  var enemyDef = ENEMIES[enemyId || 'sonchou'];

  // L が装備している4つの言葉技を、残響(PP)つきの実体に展開する
  var moves = [];
  for (var i = 0; i < STARTING_MOVES.length; i++) {
    var def = MOVE_LIBRARY[STARTING_MOVES[i]];
    moves.push({ id: def.id, pp: def.maxPp, maxPp: def.maxPp });
  }

  state = {
    turn: 1,
    phase: 'player',   // 'player' | 'enemy' | 'end'
    result: null,      // null | 'win' | 'lose'
    player: {
      name: LORE.playerName,
      maxNoise: BALANCE.playerMaxNoise,
      noise: BALANCE.playerMaxNoise, // 残りノイズ耐性
      juyou: 0,        // 受容（そのターンのブロック）
      mayoi: 0,        // 迷い（次の言葉技 -30%）
      aimDownNext: false, // 次の言葉技の命中 -20%
      mitigateNext: 0, // 次に受けるノイズの軽減量（沈黙する）
      chinmokuCount: 0 // 「沈黙する」を使った回数（2回以上で相手が沈黙化）
    },
    enemy: {
      id: enemyDef.id,
      name: enemyDef.name,
      title: enemyDef.title,
      maxHeart: enemyDef.maxHeart,
      heart: enemyDef.maxHeart, // 閉じた心（残り）
      emotion: enemyDef.startEmotion, // 感情タイプ（変化する）
      keikai: true,     // 警戒（最初の3ターン 受ける効果量-20%）
      hokorobi: 0,      // ほころび（次に受ける効果量+50%）
      guardNext: false, // 黙って見る（次ターン受ける効果量-30%）
      weakenedNext: false, // まって等で 次の行動が弱まっている
      lowHeartThreshold: enemyDef.lowHeartThreshold,
      moves: enemyDef.moves,
      lastMoveId: null,
      line: enemyDef.firstLine // 画面に出す村長のセリフ
    },
    moves: moves,
    log: []
  };

  logMsg('村長と 向きあった。言葉で「閉じた心」を ほどけるか——');
  logMsg(enemyDef.firstLine);
  return state;
}

function restart() {
  return newBattle(state ? state.enemy.id : 'sonchou');
}

/* ───────────── 警戒が効いているか ─────────────
 * 仕様の「実装が複雑なら 最初の3ターンだけ -20%」を採用。
 * keikai フラグ＋ターン数の両方で判定する（4ターン目には自然にほどける）。
 */
function keikaiActive() {
  return state.enemy.keikai && state.turn <= BALANCE.keikaiTurns;
}

/* ───────────── 言葉技の def を引く（装備中のものから） ───────────── */
function moveDefByIndex(idx) {
  var inst = state.moves[idx];
  return inst ? MOVE_LIBRARY[inst.id] : null;
}
function findMoveInst(moveId) {
  for (var i = 0; i < state.moves.length; i++) {
    if (state.moves[i].id === moveId) return state.moves[i];
  }
  return null;
}

/* ───────────── 閉じた心への効果量を計算して適用 ─────────────
 * primary=true は「言葉技そのものの届いた量」（相性・迷い・ほころびを反映）。
 * primary=false は「追加効果(bonusVs)」など固定の上乗せ分（相性等は反映しない）。
 * どちらも 村長側の軽減（警戒・身がまえ）は受ける。
 * 戻り値：実際に減らした量。
 */
function applyHeart(rawAmount, opts) {
  opts = opts || {};
  var dmg = rawAmount;

  if (opts.primary) {
    // 迷い：次の言葉技 -30%（1回で消費）
    if (state.player.mayoi > 0) {
      dmg *= (1 - BALANCE.mayoiReduce);
      state.player.mayoi -= 1;
    }
    // ほころび：次に受ける効果量 +50%（1回で消費）
    if (state.enemy.hokorobi > 0) {
      dmg *= (1 + BALANCE.hokorobiBonus);
      state.enemy.hokorobi -= 1;
    }
  }
  // 警戒：最初の3ターン -20%
  if (keikaiActive()) dmg *= (1 - BALANCE.keikaiReduce);
  // 身がまえ（黙って見る）：このターンは -30%
  if (state.enemy.guardNext) dmg *= (1 - BALANCE.guardReduce);

  dmg = Math.round(dmg);
  if (dmg < 0) dmg = 0;
  state.enemy.heart -= dmg;
  if (state.enemy.heart < 0) state.enemy.heart = 0;
  return dmg;
}

/* ───────────── L が言葉技を使う ─────────────
 * 戻り値：true=使えた（ターンが進む） / false=使えなかった（残響切れ等）
 * 流れ：残響チェック → 残響-1 → 命中判定 → 相性 → 効果 → 勝敗 → 相手の番へ
 */
function useMove(moveId) {
  if (state.phase !== 'player' || state.result) return false;
  var inst = findMoveInst(moveId);
  if (!inst) return false;
  var def = MOVE_LIBRARY[inst.id];

  // 残響（PP）切れは使えない
  if (inst.pp <= 0) {
    logMsg('その言葉は、もう残っていない。');
    return false;
  }
  inst.pp -= 1; // 失敗しても残響は1減る（仕様）

  logMsg('Lは「' + def.name + '」を つかった。');

  // ── 命中判定（命中100未満のときだけ判定。問いかけられた直後は -20%）──
  var effAcc = def.acc - (state.player.aimDownNext ? BALANCE.aimDownAmount : 0);
  var hadAimDown = state.player.aimDownNext;
  state.player.aimDownNext = false; // ぶれは1回で消費
  if (effAcc < 100 && !roll(effAcc / 100)) {
    logMsg(REL_MSG.miss + (hadAimDown ? '（言葉が ぶれていた）' : ''));
    endPlayerTurn();
    return true;
  }

  var e = def.effect || {};

  // ── 主効果：閉じた心への「届いた量」（相性で増減）──
  if (typeof e.damage === 'number' && e.damage > 0) {
    var mult = typeMultiplier(def.wordType, state.enemy.emotion);
    logMsg(REL_MSG[relKey(mult)]);
    var dealt = applyHeart(e.damage * mult, { primary: true });
    logMsg('村長の閉じた心 -' + dealt + '（のこり ' + state.enemy.heart + '）。');
  }

  // ── 受容（自分のブロック）──
  if (typeof e.selfJuyou === 'number' && e.selfJuyou > 0) {
    state.player.juyou += e.selfJuyou;
    logMsg('Lは すこし 受け入れた（受容 +' + e.selfJuyou + ' → ' + state.player.juyou + '）。');
  }
  // ── ノイズ耐性 回復（ありがとう）──
  if (typeof e.selfNoise === 'number' && e.selfNoise > 0) {
    var before = state.player.noise;
    state.player.noise = Math.min(state.player.maxNoise, state.player.noise + e.selfNoise);
    if (state.player.noise > before) logMsg('あたたかい音がした（ノイズ耐性 +' + (state.player.noise - before) + '）。');
  }
  // ── 次に受けるノイズの軽減（沈黙する）──
  if (typeof e.mitigateNext === 'number' && e.mitigateNext > 0) {
    state.player.mitigateNext += e.mitigateNext;
    logMsg('しずけさが 次のノイズを やわらげる（-' + e.mitigateNext + '）。');
  }
  // ── 村長の次の行動を弱める（まって）──
  if (e.weakenEnemy) {
    state.enemy.weakenedNext = true;
    logMsg('村長は 言葉を 急げなくなった。');
  }
  // ── 感情に刺さる追加効果（bonusVs）──
  if (e.bonusVs) {
    for (var b = 0; b < e.bonusVs.length; b++) {
      var bv = e.bonusVs[b];
      if (bv.emotions.indexOf(state.enemy.emotion) >= 0) {
        var bonus = applyHeart(bv.damage, { primary: false });
        logMsg('その言葉は、いまの村長に 染みた（閉じた心 -' + bonus + ' → のこり ' + state.enemy.heart + '）。');
      }
    }
  }
  // ── ほころびを付与（どうして？ 低確率）──
  if (e.hokorobi && roll(e.hokorobi.chance)) {
    state.enemy.hokorobi += 1;
    logMsg('村長の閉じた心に、ほころびが生まれた。');
  }
  // ── 感情タイプを変える（どうして？ / なまえ）──
  if (e.changeEmotion && roll(e.changeEmotion.chance)) {
    setEmotion(e.changeEmotion.to);
  }
  // ── 本音らしきテキスト（なまえ）──
  if (e.revealHonne) {
    var line = HONNE_LINES[Math.floor(Math.random() * HONNE_LINES.length)];
    state.enemy.line = line;
    logMsg(line);
  }
  // ── 沈黙するを数える：2回以上で相手が「沈黙」に ──
  if (e.chinmokuCount) {
    state.player.chinmokuCount += 1;
    if (state.player.chinmokuCount >= 2 && state.enemy.emotion !== 'chinmoku') {
      setEmotion('chinmoku');
    }
  }
  // ── 使用後コスト（いやだ）──
  if (typeof e.selfNoiseCost === 'number' && e.selfNoiseCost > 0) {
    state.player.noise -= e.selfNoiseCost;
    if (state.player.noise < 0) state.player.noise = 0;
    logMsg('拒絶の反動で、Lの音が すこし削れた（ノイズ耐性 -' + e.selfNoiseCost + '）。');
  }

  checkResult();
  if (!state.result) endPlayerTurn();
  return true;
}

/* 感情タイプを変える（重複変更のログを避けつつ表示） */
function setEmotion(to) {
  if (state.enemy.emotion === to) return;
  state.enemy.emotion = to;
  var label = EMOTION_TYPES[to] ? EMOTION_TYPES[to].label : to;
  logMsg('村長の様子が 変わった……（感情タイプ：' + label + '）');
}

/* L のターンを閉じる：身がまえ(黙って見る)はこのターン限りなので消費する */
function endPlayerTurn() {
  state.enemy.guardNext = false; // 「次ターン-30%」はこの1手で使い切る
  if (!state.result) state.phase = 'enemy';
}

/* ───────────── 村長の行動を決める ─────────────
 * weight で重み付けランダム。ただし
 *   ・「黙って見る」は2連続しない（棒立ち防止）
 *   ・「心配する」は 閉じた心が threshold 以下のときだけ候補に入る
 * 閉じた心が少ないほど「心配する＝不安化」が出やすい（仕様の“不安になりやすい”）。
 */
function chooseEnemyMove() {
  var en = state.enemy;
  var low = en.heart <= en.lowHeartThreshold;
  var cand = [];
  for (var i = 0; i < en.moves.length; i++) {
    var mv = en.moves[i];
    if (mv.condition === 'lowHeart' && !low) continue;     // 心配する は HP低下後のみ
    if (mv.id === 'damatte' && en.lastMoveId === 'damatte') continue; // 連続しない
    cand.push(mv);
  }
  if (cand.length === 0) cand = en.moves.slice(); // 念のため

  var total = 0;
  for (var j = 0; j < cand.length; j++) total += (cand[j].weight || 1);
  var r = Math.random() * total;
  var pick = cand[0];
  for (var k = 0; k < cand.length; k++) {
    r -= (cand[k].weight || 1);
    if (r <= 0) { pick = cand[k]; break; }
  }
  return pick;
}

/* ───────────── 村長のターンを実行する（useMove の後に呼ぶ） ───────────── */
function enemyTurn() {
  if (state.phase !== 'enemy' || state.result) return;
  var en = state.enemy;
  var move = chooseEnemyMove();
  en.lastMoveId = move.id;
  en.line = move.line;
  logMsg(move.line);

  // 感情タイプを変える行動（心配する → 不安）
  if (move.setEmotionTo) setEmotion(move.setEmotionTo);

  // 身がまえ（黙って見る）
  if (move.guard) {
    en.guardNext = true;
    logMsg('村長は 身がまえた。（次に届く言葉が、少し かたくなる）');
  }

  // ノイズ攻撃
  if (move.kind === 'attack' && move.noise > 0) {
    var noise = move.noise;
    // まって等で弱まっているなら半減
    if (en.weakenedNext) {
      noise = Math.ceil(noise * (1 - BALANCE.weakenReduce));
      en.weakenedNext = false;
      logMsg('（村長の言葉は 力をなくしていた）');
    }
    damageToPlayer(noise, move.name);
  }

  // L に心の乱れを付与（迷い／ぶれ など）
  if (move.apply && roll(move.apply.chance)) {
    var key = move.apply.key;
    if (key === 'aimdown') {
      state.player.aimDownNext = true;
      logMsg('Lの次の言葉が、すこし ぶれそうだ。');
    } else {
      state.player[key] = (state.player[key] || 0) + 1;
      if (key === 'mayoi') logMsg('Lは、少し迷っている。');
    }
  }

  // 受容は「直前の相手の番」を守るための一時値。役目を終えたのでリセット。
  state.player.juyou = 0;

  checkResult();
  if (!state.result) {
    state.turn += 1;
    startPlayerTurn();
  }
}

/* ───────────── プレイヤーのターン開始（次ターンの頭で呼ぶ） ─────────────
 * 警戒が自然にほどける瞬間（4ターン目）をログで知らせる。
 */
function startPlayerTurn() {
  state.phase = 'player';
  if (state.enemy.keikai && state.turn > BALANCE.keikaiTurns) {
    state.enemy.keikai = false;
    logMsg('村長の警戒が、少しほどけた。');
  }
}

/* ───────────── L へノイズ ─────────────
 * まず「しずけさ(mitigateNext)」で前もって軽減し、
 * 次に「受容(juyou)」で吸収し、あふれた分だけノイズ耐性を削る。
 */
function damageToPlayer(noise, moveName) {
  var raw = noise;
  // 沈黙するの余韻（次に受けるノイズを軽減）
  if (state.player.mitigateNext > 0) {
    var cut = Math.min(state.player.mitigateNext, raw);
    raw -= cut;
    state.player.mitigateNext = 0;
  }
  // 受容で吸収
  var absorbed = Math.min(state.player.juyou, raw);
  state.player.juyou -= absorbed;
  var through = raw - absorbed;
  state.player.noise -= through;
  if (state.player.noise < 0) state.player.noise = 0;

  logMsg('ノイズ ' + noise + '（受容で ' + absorbed + ' 軽減 → ' + through +
    ' 通過、耐性のこり ' + state.player.noise + '）。');
}

/* ───────────── 勝敗判定 ───────────── */
function checkResult() {
  if (state.enemy.heart <= 0) {
    state.enemy.heart = 0;
    state.result = 'win';
    state.phase = 'end';
  } else if (state.player.noise <= 0) {
    state.player.noise = 0;
    state.result = 'lose';
    state.phase = 'end';
  }
}

// JXA / Node 双方から参照できるよう公開（ブラウザでは無視される）
if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    newBattle: newBattle, restart: restart, useMove: useMove,
    enemyTurn: enemyTurn, checkResult: checkResult,
    typeMultiplier: typeMultiplier, relKey: relKey, applyHeart: applyHeart,
    damageToPlayer: damageToPlayer, setEmotion: setEmotion,
    keikaiActive: keikaiActive, chooseEnemyMove: chooseEnemyMove,
    getState: function () { return state; }
  };
}
