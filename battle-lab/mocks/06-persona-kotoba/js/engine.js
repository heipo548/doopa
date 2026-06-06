/*
 * engine.js — バトルの進行ルール（DOM非依存の“純粋ロジック”）
 *
 * 画面描画(ui.js)とは完全に分離してある。理由：
 *  ・ロジックだけを JXA（osascript）で自動テストできる（勝ち筋/負け筋を最後まで回す）
 *  ・今後 仮面や影を増やすとき、進行ルールの考え方を使い回せる
 *
 * 状態は単一のグローバル `state` に集約。関数はそれを書き換える。
 * （他モック proto と同じ「グローバル state ＋関数」スタイルに合わせている）
 *
 * ★ このモックで一番大事にしている流れ：
 *     ほころび(弱点)を突く → 心崩れ → もう一言 → 対話 or ことばの総鳴り
 */

var state = null; // 現在のバトル状態。newBattle() で作る

/* ───────────── ログ（画面の「やりとりの記録」） ───────────── */
function logMsg(msg) {
  state.log.push(msg);
  if (state.log.length > 60) state.log.shift(); // 長くなりすぎないよう直近だけ保持
}

/* ───────────── バトル開始 / リスタート ───────────── */
function newBattle() {
  state = {
    turn: 1,
    phase: 'player',     // 'player' | 'oneMore'（もう一言中）| 'enemy' | 'end'
    result: null,        // null | 'win' | 'lose'
    oneMoreUsed: false,  // このターン すでに「もう一言」を発生させたか（1ターン1回まで）
    silenceCount: 0,     // 「沈黙する」を使った回数（2回で 沈黙の仮面へ）
    dialogue: null,      // 対話中なら 'kuzure' | 'honne'、そうでなければ null
    player: {
      maxNoise: BALANCE.playerMaxNoise, noise: BALANCE.playerMaxNoise,
      maxKokoro: BALANCE.playerMaxKokoro, kokoro: BALANCE.playerMaxKokoro,
      juyou: 0,        // 受容（そのターンのブロック）
      mayoi: 0,        // 迷い（次の言葉技の効果量 -30%）
      meichuDown: 0,   // 命中低下（次の言葉技の命中 -20）
      imageName: LORE.imageName
    },
    enemy: {
      name: ENEMY.name, title: ENEMY.title,
      maxHeart: ENEMY.maxHeart, heart: ENEMY.maxHeart,
      maskId: ENEMY.initialMask,
      kuzure: false,        // 心崩れ中か
      weakenNext: 1.0,      // 次の村長行動の効果倍率（沈黙/まってで下げる）
      guardNext: false,     // 黙って見る：次に村長が受ける効果量 -20%
      revealed: {},         // 開示済みのタイプ → 'weak'|'resist'|'normal'（現在の仮面に対して）
      honneShown: false     // 本音ヒントを出したか
    },
    log: []
  };
  logMsg('村長の影が、仮面をかぶって こちらを見ている。');
  logMsg(MASKS[state.enemy.maskId].appearLog);
  return state;
}

function restart() { return newBattle(); }

/* ───────────── 仮面まわりの補助 ───────────── */
function currentMask() { return MASKS[state.enemy.maskId]; }

// 1つの言葉タイプが、いまの仮面に対して何になるか
function typeCategory(typeKey) {
  var mask = currentMask();
  if ((mask.weak || []).indexOf(typeKey) >= 0) return 'weak';
  if ((mask.resist || []).indexOf(typeKey) >= 0) return 'resist';
  return 'normal';
}

// 言葉技ぜんたいの判定：どれか1つでも弱点なら「ほころび」、全部が耐性なら「こわばり」
function categoryFor(skill) {
  var types = skill.types || [];
  for (var i = 0; i < types.length; i++) {
    if (typeCategory(types[i]) === 'weak') return 'weak';
  }
  var allResist = types.length > 0;
  for (var j = 0; j < types.length; j++) {
    if (typeCategory(types[j]) !== 'resist') { allResist = false; break; }
  }
  if (allResist) return 'resist';
  return 'normal';
}

// 仮面を変える。弱点が変わるので 開示状態（？？？）はリセットする
function setMask(maskId) {
  if (!MASKS[maskId] || state.enemy.maskId === maskId) return;
  state.enemy.maskId = maskId;
  state.enemy.revealed = {}; // 仮面が変わると 弱点/耐性が変わる → また ？？？ に戻る
  logMsg(MASKS[maskId].appearLog);
  if (MASKS[maskId].honne && !state.enemy.honneShown) {
    state.enemy.honneShown = true;
    logMsg('対話で、最後の言葉を選べる。');
  }
}

// 閉じた心が十分に薄くなったら 本音の仮面へ
function checkHonne() {
  if (state.result) return;
  if (state.enemy.heart <= BALANCE.honneThreshold && state.enemy.heart > 0 && !currentMask().honne) {
    setMask('honne');
  }
}

/* ───────────── 閉じた心を減らす ─────────────
 * dealToEnemy … 言葉技のダメージ用（黙って見る の -20% と 端数まるめを含む）
 * reduceHeart … 対話・総鳴りの固定ダメージ用（倍率をかけない素の減算）
 */
function dealToEnemy(amount) {
  var dmg = amount;
  if (state.enemy.guardNext) dmg *= BALANCE.guardReduce; // 黙って見る の効果
  dmg = Math.round(dmg);
  if (dmg < 0) dmg = 0;
  state.enemy.heart -= dmg;
  if (state.enemy.heart < 0) state.enemy.heart = 0;
  logMsg('閉じた心に ' + dmg + '（のこり ' + state.enemy.heart + '）。');
  return dmg;
}
function reduceHeart(n) {
  state.enemy.heart -= n;
  if (state.enemy.heart < 0) state.enemy.heart = 0;
  logMsg('閉じた心 −' + n + '（のこり ' + state.enemy.heart + '）。');
}

/* ───────────── L へノイズ ─────────────
 * まず受容(ブロック)で吸収し、あふれた分だけノイズ耐性を削る。
 */
function damageToPlayer(noise) {
  var absorbed = Math.min(state.player.juyou, noise);
  state.player.juyou -= absorbed;
  var through = noise - absorbed;
  state.player.noise -= through;
  if (state.player.noise < 0) state.player.noise = 0;
  if (absorbed > 0) {
    logMsg('ノイズ ' + noise + '（受容で ' + absorbed + ' 軽減 → ' + through + ' 通過、耐性のこり ' + state.player.noise + '）。');
  } else {
    logMsg('ノイズ ' + noise + '（耐性のこり ' + state.player.noise + '）。');
  }
}

/* ───────────── 言葉技を使う ─────────────
 * 戻り値：true=使えた / false=使えなかった（こころ不足・状況外など）
 */
function playSkill(skillId) {
  if (state.result || state.dialogue) return false;
  if (state.phase !== 'player' && state.phase !== 'oneMore') return false;
  var skill = SKILLS[skillId];
  if (!skill) return false;
  if (skill.cost > state.player.kokoro) return false; // こころが足りない

  var wasOneMore = (state.phase === 'oneMore');
  state.player.kokoro -= skill.cost;
  logMsg('Lは「' + skill.name + '」を つかった。');

  // ── 命中判定（外れても こころは消費する） ──
  var hit = skill.hit;
  if (state.player.meichuDown > 0) { hit -= BALANCE.meichuPenalty; state.player.meichuDown -= 1; }
  if (Math.random() * 100 >= hit) {
    logMsg('言葉は、届く前にほどけた。');
    afterPlayerAction(wasOneMore, false);
    return true;
  }

  // ── タイプを開示（一度使えば 弱点/耐性が画面に出る） ──
  for (var t = 0; t < skill.types.length; t++) {
    state.enemy.revealed[skill.types[t]] = typeCategory(skill.types[t]);
  }
  var cat = categoryFor(skill);

  // ── 閉じた心へのダメージを組み立てる ──
  var base = skill.power || 0;
  if (skill.damageOnlyOnWeak && cat !== 'weak') base = 0;            // 沈黙する：弱点のときだけ効く
  if (skill.condDmg && state.enemy.maskId === skill.condDmg.mask) {  // だいじょうぶ：不安なら追加
    base += skill.condDmg.amount;
  }
  if (base > 0) {
    // 迷い：効果量 -30%（攻撃するときだけ 1つ消費）
    if (state.player.mayoi > 0) {
      base *= BALANCE.mayoiPenalty;
      state.player.mayoi -= 1;
      logMsg('（迷いで、言葉が すこし弱まった）');
    }
    if (cat === 'weak') base *= BALANCE.weakMult;
    else if (cat === 'resist') base *= BALANCE.resistMult;
    dealToEnemy(base);
  }

  // ── 受容（ブロック） ──
  if (skill.block) {
    state.player.juyou += skill.block;
    logMsg('受容を ' + skill.block + ' 得た。');
  }
  // ── ノイズ耐性の回復（ありがとう） ──
  if (skill.selfHeal) {
    var before = state.player.noise;
    state.player.noise = Math.min(state.player.maxNoise, state.player.noise + skill.selfHeal);
    if (state.player.noise > before) logMsg('あたたかい音がした。ノイズ耐性 +' + (state.player.noise - before) + '。');
  }
  // ── 村長の次の行動を弱める（沈黙する / まって） ──
  if (skill.weakenNext) {
    state.enemy.weakenNext = Math.min(state.enemy.weakenNext, skill.weakenNext);
    logMsg(skill.weakenNext <= 0.3 ? '村長の次の言葉が、大きく ゆらいだ。' : '村長の次の言葉が、すこし 弱まった。');
  }
  // ── 沈黙する を数える（2回で 沈黙の仮面） ──
  if (skill.countsAsSilence) {
    state.silenceCount += 1;
    if (state.silenceCount >= 2 && state.enemy.maskId !== 'chinmoku' && !currentMask().honne) {
      setMask('chinmoku');
    }
  }
  // ── 本音のヒント（なまえ） ──
  if (skill.hintHonne) {
    logMsg('（ヒント：仮面の奥には "怖さ" がある。心崩れ中に「こわいの？」と たずねてみよう）');
  }

  // ── ほころび/こわばり/通常 の手応えと「心崩れ」 ──
  var triggeredOneMore = false;
  if (cat === 'weak') {
    logMsg('言葉が、ほころびに届いた。');
    if (!state.enemy.kuzure) logMsg('村長の心が崩れた。');
    state.enemy.kuzure = true;
    // もう一言：1ターン1回まで。もう一言中の弱点ヒットでは追加発生しない
    if (!state.oneMoreUsed && !wasOneMore) triggeredOneMore = true;
  } else if (cat === 'resist') {
    logMsg('言葉は、仮面の上をすべった。');
  } else {
    logMsg('言葉が届いた。');
  }

  // ── 仮面が確率で変わる（どうして？/なまえ → 隠し事） ──
  if (skill.changeMask && Math.random() < skill.changeMask.p) {
    setMask(skill.changeMask.to);
  }
  // ── 反動（いやだ：使用後 ノイズ耐性 -2） ──
  if (skill.selfNoise) {
    state.player.noise -= skill.selfNoise;
    if (state.player.noise < 0) state.player.noise = 0;
    logMsg('（拒絶の反動。ノイズ耐性 -' + skill.selfNoise + '）');
  }

  checkHonne();
  checkResult();
  if (state.result) { state.phase = 'end'; return true; }

  afterPlayerAction(wasOneMore, triggeredOneMore);
  return true;
}

/* ───────────── 受けとめる（防御コマンド） ─────────────
 * 受容 +6、こころ +2。言葉を使わずに ノイズを遠ざける。
 */
function uketomeru() {
  if (state.result || state.dialogue) return false;
  if (state.phase !== 'player' && state.phase !== 'oneMore') return false;
  var wasOneMore = (state.phase === 'oneMore');
  state.player.juyou += BALANCE.uketomeBlock;
  state.player.kokoro = Math.min(state.player.maxKokoro, state.player.kokoro + BALANCE.uketomeKokoro);
  logMsg('Lは、言葉を使わずに受けとめた。');
  logMsg('ノイズが少し遠ざかった。（受容 +' + BALANCE.uketomeBlock + ' / こころ +' + BALANCE.uketomeKokoro + '）');
  afterPlayerAction(wasOneMore, false);
  return true;
}

/* ───────────── ことばの総鳴り（心崩れ中の大技） ─────────────
 * 条件：相手が心崩れ。消費こころ0。閉じた心 -18。使用後 心崩れ解除 → 相手の番へ。
 */
function sounari() {
  if (state.result || state.dialogue) return false;
  if (state.phase !== 'player' && state.phase !== 'oneMore') return false;
  if (!state.enemy.kuzure) return false; // 心崩れ中しか撃てない
  for (var i = 0; i < SOUNARI_LOG.length; i++) logMsg(SOUNARI_LOG[i]);
  reduceHeart(BALANCE.sounariDamage);
  state.enemy.kuzure = false; // 総鳴りで 心崩れは解除
  checkHonne();
  checkResult();
  if (state.result) { state.phase = 'end'; return true; }
  goToEnemyPhase();
  return true;
}

/* ───────────── 対話（たずねる） ─────────────
 * 心崩れ中、または 本音の仮面のとき に選べる。openDialogue で選択肢を開き、
 * chooseDialogue(index) で1つ選んで解決する。
 */
function canTalk() {
  if (state.result) return false;
  if (state.phase !== 'player' && state.phase !== 'oneMore') return false;
  return currentMask().honne || state.enemy.kuzure;
}

function openDialogue() {
  if (state.dialogue) return false;
  if (!canTalk()) return false;
  state.dialogue = currentMask().honne ? 'honne' : 'kuzure';
  logMsg('Lは、たずねることにした。');
  return true;
}

function cancelDialogue() {
  if (!state.dialogue) return false;
  state.dialogue = null;
  return true;
}

function chooseDialogue(index) {
  if (!state.dialogue) return false;
  var set = DIALOGUES[state.dialogue];
  var choice = set.choices[index];
  if (!choice) return false;

  for (var i = 0; i < choice.log.length; i++) logMsg(choice.log[i]);
  if (choice.heartDown) reduceHeart(choice.heartDown);
  state.dialogue = null;
  state.enemy.kuzure = false; // 対話したら 心崩れは解ける

  if (choice.changeMask) setMask(choice.changeMask);

  if (choice.win) { state.result = 'win'; state.phase = 'end'; return true; }

  checkHonne();
  checkResult();
  if (state.result) { state.phase = 'end'; return true; }
  goToEnemyPhase();
  return true;
}

/* ───────────── プレイヤー行動の後始末 ─────────────
 * 弱点で「もう一言」が出たら 相手の番に行かず 追加行動を待つ。
 * それ以外（通常行動・もう一言中の行動）は 相手の番へ。
 */
function afterPlayerAction(wasOneMore, triggeredOneMore) {
  if (state.result) { state.phase = 'end'; return; }
  if (triggeredOneMore) {
    state.oneMoreUsed = true;
    state.phase = 'oneMore';
    logMsg('Lは、もう一言だけ言える。');
    return;
  }
  goToEnemyPhase();
}

function goToEnemyPhase() {
  state.phase = 'enemy';
  state.enemy.guardNext = false; // 黙って見る の -20% は このターンで使い切る
}

/* ───────────── 村長の行動を1つ選ぶ ─────────────
 * 条件（閉じた心・仮面）を満たす行動だけを候補にし、weight で重み付け抽選。
 */
function chooseEnemyMove() {
  var candidates = [];
  for (var key in ENEMY_MOVES) {
    if (!ENEMY_MOVES.hasOwnProperty(key)) continue;
    var m = ENEMY_MOVES[key];
    if (m.condHeartLE !== undefined && state.enemy.heart > m.condHeartLE) continue;
    if (m.condMask !== undefined && state.enemy.maskId !== m.condMask) continue;
    candidates.push(m);
  }
  if (candidates.length === 0) candidates = [ENEMY_MOVES.utagau];
  var total = 0;
  for (var i = 0; i < candidates.length; i++) total += (candidates[i].weight || 1);
  var r = Math.random() * total;
  var pick = candidates[0];
  for (var j = 0; j < candidates.length; j++) {
    r -= (candidates[j].weight || 1);
    if (r <= 0) { pick = candidates[j]; break; }
  }
  return pick;
}

/* ───────────── 相手の番 ───────────── */
function enemyTurn() {
  if (state.phase !== 'enemy' || state.result) return;
  var move = chooseEnemyMove();
  logMsg(move.line);

  // ノイズ（沈黙/まって で弱めた分を反映）
  if (move.noise && move.noise > 0) {
    var noise = Math.round(move.noise * state.enemy.weakenNext);
    damageToPlayer(noise);
  } else if (move.id === 'damatte') {
    logMsg('（村長は ためている。次にLが与える言葉が、少し届きにくい）');
  }
  // 状態異常を L へ
  if (move.applyPlayer) {
    if (move.applyPlayer.mayoi) {
      var ch = move.applyPlayer.chance;
      if (ch === undefined || Math.random() < ch) {
        state.player.mayoi += move.applyPlayer.mayoi;
        logMsg('Lは、少し迷っている。');
      }
    }
    if (move.applyPlayer.meichuDown) {
      state.player.meichuDown += move.applyPlayer.meichuDown;
      logMsg('村長の問いが、Lの言葉を鈍らせた。');
    }
  }
  // 黙って見る：次に村長が受ける効果量 -20%
  if (move.guardNext) state.enemy.guardNext = true;
  // 隠す：閉じた心を回復
  if (move.healEnemy) {
    state.enemy.heart = Math.min(state.enemy.maxHeart, state.enemy.heart + move.healEnemy);
    logMsg('村長は 何かを隠した。（閉じた心 +' + move.healEnemy + ' → ' + state.enemy.heart + '）');
  }
  // 心配する：仮面を 不安へ
  if (move.changeMask) setMask(move.changeMask);

  // 後始末：弱めは使い切る／受容は0に戻す／心崩れは相手の行動終了で解除
  state.enemy.weakenNext = 1.0;
  state.player.juyou = 0;
  if (state.enemy.kuzure) {
    state.enemy.kuzure = false;
    logMsg('村長は、仮面を かぶり直した。');
  }

  checkHonne();
  checkResult();
  if (!state.result) {
    state.turn += 1;
    startPlayerTurn();
  } else {
    state.phase = 'end';
  }
}

/* ───────────── 次の自分の番を始める ─────────────
 * こころを +2 回復（最大18）。もう一言フラグを戻す。
 */
function startPlayerTurn() {
  state.phase = 'player';
  state.oneMoreUsed = false;
  var before = state.player.kokoro;
  state.player.kokoro = Math.min(state.player.maxKokoro, state.player.kokoro + BALANCE.kokoroRegen);
  logMsg('—— あなたの番。こころ ' + state.player.kokoro + ' / ' + state.player.maxKokoro +
    (state.player.kokoro > before ? '（+' + (state.player.kokoro - before) + '）' : '') + '。');
}

/* ───────────── 勝敗判定 ─────────────
 * 勝ち：閉じた心0、または 本音の対話で「言葉を教えて」を選ぶ（chooseDialogue 側）。
 * 負け：ノイズ耐性0。
 */
function checkResult() {
  if (state.result) return;
  if (state.enemy.heart <= 0) { state.result = 'win'; state.phase = 'end'; }
  else if (state.player.noise <= 0) { state.result = 'lose'; state.phase = 'end'; }
}

// JXA / Node 双方から参照できるよう公開（ブラウザでは無視される）
if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    newBattle: newBattle, restart: restart,
    playSkill: playSkill, uketomeru: uketomeru, sounari: sounari,
    openDialogue: openDialogue, cancelDialogue: cancelDialogue, chooseDialogue: chooseDialogue,
    enemyTurn: enemyTurn, chooseEnemyMove: chooseEnemyMove,
    categoryFor: categoryFor, typeCategory: typeCategory, canTalk: canTalk,
    checkHonne: checkHonne, checkResult: checkResult, setMask: setMask,
    dealToEnemy: dealToEnemy, reduceHeart: reduceHeart, damageToPlayer: damageToPlayer,
    currentMask: currentMask,
    getState: function () { return state; }
  };
}
