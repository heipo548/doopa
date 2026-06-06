/*
 * engine.js — Battle 08「こころの時間差バトル」の進行ルール（DOM非依存）
 *
 * 画面には一切触らない。状態 `state` を持ち、関数で書き換えるだけ。
 * これで tools/headless-check.js（JXA）からルールだけを自動点検できる。
 *
 * 時間モデル：`now` が tick で進む。プレイヤーの言葉には cast（待ち時間）があり、
 *   その tick ぶんだけ時間が進む間に、村長は ENEMY_PLAN を循環して行動する。
 *   爆発ゲージが満ちる前に強い言葉を“間に合わせる”のが核。
 */

var state = null;

// ログは {tone, lines:[...]} のブロック配列。tone は見た目の手がかり。
function logBlock(tone, lines) {
  if (typeof lines === 'string') lines = [lines];
  state.log.push({ tone: tone, lines: lines });
}

/* ───────── 初期化 ───────── */
function newBattle() {
  state = {
    now: 0,
    turn: 0,
    player: {
      name: PLAYER_INIT.name,
      kokoro: PLAYER_INIT.kokoro, maxKokoro: PLAYER_INIT.maxKokoro,
      kotoba: PLAYER_INIT.kotoba, maxKotoba: PLAYER_INIT.maxKotoba,
      ochitsuki: PLAYER_INIT.ochitsuki, maxOchitsuki: PLAYER_INIT.maxOchitsuki
    },
    enemy: {
      name: ENEMY_INIT.name,
      zawameki: ENEMY_INIT.zawameki, maxZawameki: ENEMY_INIT.maxZawameki,
      bakuhatsu: ENEMY_INIT.bakuhatsu, maxBakuhatsu: ENEMY_INIT.maxBakuhatsu,
      planIndex: 0,
      timer: ENEMY_PLAN[0].interval,    // 次の行動まで何 tick か
      nextId: ENEMY_PLAN[0].id          // 次に来る行動（予兆として画面に出す）
    },
    secretDelayed: false,   // 「なまえをよぶ」で秘密を止めた直後か（特殊終了の鍵）
    result: null,           // null | 'win' | 'lose' | 'special'
    endKind: null,          // どの終わり方か
    log: []
  };
  logBlock('open', [OPENING_LOG]);
  logBlock('system', ['時間軸が、しずかに動きはじめた。']);
  return state;
}

// 村長の行動オブジェクトを id から引く
function planById(id) {
  for (var i = 0; i < ENEMY_PLAN.length; i++) if (ENEMY_PLAN[i].id === id) return ENEMY_PLAN[i];
  return null;
}
// コマンドを id から引く
function cmdById(id) {
  for (var i = 0; i < COMMANDS.length; i++) if (COMMANDS[i].id === id) return COMMANDS[i];
  return null;
}

/* ───────── 時間を 1 tick 進める ─────────
 * ことばが自然回復し、村長のタイマーが減る。0 になったら村長が動く。
 */
function tick() {
  if (state.result) return;
  state.now++;
  state.player.kotoba = Math.min(state.player.maxKotoba, state.player.kotoba + 1);
  state.enemy.timer--;
  if (state.enemy.timer <= 0) enemyAct();
}

// 村長が現在の予定行動を実行し、次の行動を予約する
function enemyAct() {
  var act = ENEMY_PLAN[state.enemy.planIndex];
  applyEnemyEffect(act);
  // 次の行動へ進める（循環）
  state.enemy.planIndex = (state.enemy.planIndex + 1) % ENEMY_PLAN.length;
  var next = ENEMY_PLAN[state.enemy.planIndex];
  state.enemy.timer = next.interval;
  state.enemy.nextId = next.id;
  checkEnd();
}

// 村長の効果を反映（こころダメージは おちつき が肩代わり）
function applyEnemyEffect(act) {
  var lines = act.log.slice();
  if (act.kokoro) {
    var dmg = act.kokoro;
    var absorbed = Math.min(state.player.ochitsuki, dmg);
    if (absorbed > 0) {
      state.player.ochitsuki -= absorbed;
      dmg -= absorbed;
      lines.push('（おちつきが ' + absorbed + ' 肩代わりした）');
    }
    state.player.kokoro = Math.max(0, state.player.kokoro - dmg);
  }
  if (act.bakuhatsu) {
    state.enemy.bakuhatsu = Math.min(state.enemy.maxBakuhatsu, state.enemy.bakuhatsu + act.bakuhatsu);
  }
  logBlock('enemy', lines);
}

/* ───────── 終了判定 ───────── */
function checkEnd() {
  if (state.result) return;
  // 爆発ゲージが満ちた → 村長が爆発（敗北）
  if (state.enemy.bakuhatsu >= state.enemy.maxBakuhatsu) {
    state.player.kokoro = 0;
    state.result = 'lose'; state.endKind = 'explode';
    logBlock('result', LOSE_TEXT.explode.slice());
    return;
  }
  // こころが尽きた（敗北）
  if (state.player.kokoro <= 0) {
    state.result = 'lose'; state.endKind = 'kokoro';
    logBlock('result', LOSE_TEXT.kokoro.slice());
    return;
  }
  // ざわめきが静まった（勝利）
  if (state.enemy.zawameki <= 0) {
    state.result = 'win'; state.endKind = 'zawameki';
    logBlock('result', WIN_TEXT.zawameki.slice());
    return;
  }
}

/* ───────── コマンド選択（プレイヤーの1手）─────────
 * 返り値: {ok:true} 成功 / {ok:false,reason} 失敗
 */
function chooseCommand(id) {
  if (state.result) return { ok:false, reason:'ended' };
  var cmd = cmdById(id);
  if (!cmd) return { ok:false, reason:'unknown' };
  if (state.player.kotoba < cmd.cost) {
    logBlock('system', ['ことばが足りない。Lは、まだその言葉を持てない。']);
    return { ok:false, reason:'kotoba' };
  }

  // 「なまえをよぶ」で“秘密を言いかけている村長”を止める特別処理（cast前に確定）
  if (cmd.id === 'namewoyobu' && state.enemy.nextId === 'secret') {
    state.secretDelayed = true;
    state.enemy.timer += 5;  // 秘密の発動を大きく遅らせる
    logBlock('player', ['L「……（なまえを、よんだ）」', '言いかけた村長の口が、ふっと止まる。']);
  }
  // 「きく」は、秘密を止めた直後（まだ秘密が予兆として残っている）なら特殊終了へ。
  // 秘密が既に発火して予兆が消えていれば、矛盾する結末を出さないよう通常処理へ流す。
  if (cmd.id === 'kiku' && state.secretDelayed && state.enemy.nextId === 'secret') {
    state.player.kotoba -= cmd.cost;
    state.result = 'special'; state.endKind = 'secret';
    logBlock('player', ['L「……むらの ひみつは?」']);
    logBlock('result', WIN_TEXT.secret.slice());
    state.turn++;
    return { ok:true, special:true };
  }

  state.player.kotoba -= cmd.cost;

  // cast ぶん時間を進める（この間に村長が動く＝間に合うかの緊張）
  for (var t = 0; t < cmd.cast && !state.result; t++) tick();

  // cast 中に決着していなければ、言葉が“届く”
  if (!state.result) resolvePlayer(cmd);

  state.turn++;

  // 一定ターン、爆発させずに耐えきれば耐久勝利
  if (!state.result && state.turn >= TURN_LIMIT && state.enemy.zawameki > 0) {
    state.result = 'win'; state.endKind = 'endure';
    logBlock('result', WIN_TEXT.endure.slice());
  }
  if (!state.result) checkEnd();
  return { ok:true };
}

// 言葉が届いたときの効果
function resolvePlayer(cmd) {
  if (cmd.id === 'kiku') {
    state.enemy.bakuhatsu = Math.max(0, state.enemy.bakuhatsu - 1);
    var nx = planById(state.enemy.nextId);
    logBlock('player', ['L「……つぎは?」', '（予兆）村長の次：' + nx.name + '（あと ' + state.enemy.timer + '）']);
  } else if (cmd.id === 'koewokakeru') {
    state.enemy.bakuhatsu = Math.max(0, state.enemy.bakuhatsu - 2);
    logBlock('player', ['L「……だいじょうぶ?」', '村長の爆発ゲージが、少し落ちついた。']);
  } else if (cmd.id === 'namewoyobu') {
    state.enemy.zawameki = Math.max(0, state.enemy.zawameki - 3);
    logBlock('player', ['L「……むらおさ」', '名前を呼ばれて、村長のざわめきが和らいだ。']);
  } else if (cmd.id === 'damaru') {
    state.player.ochitsuki = Math.min(state.player.maxOchitsuki, state.player.ochitsuki + 2);
    logBlock('player', ['Lは、だまって となりにいた。', 'おちつきが、戻ってくる。']);
  } else if (cmd.id === 'tewonobasu') {
    state.enemy.zawameki = Math.max(0, state.enemy.zawameki - 5);
    logBlock('player', ['Lは、そっと手をのばした。', '村長のざわめきが、大きく和らいだ。']);
  }
}

// 爆発ゲージの見た目（●＝満ち / ○＝空き）
function bakuhatsuBar() {
  var s = '';
  for (var i = 0; i < state.enemy.maxBakuhatsu; i++) s += (i < state.enemy.bakuhatsu ? '●' : '○');
  return s;
}

/* ───────── リスタート ───────── */
function restart() { return newBattle(); }

// CommonJS でも一応読めるように（ブラウザ／JXA では無視される）
if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    newBattle: newBattle, chooseCommand: chooseCommand, tick: tick,
    bakuhatsuBar: bakuhatsuBar, planById: planById, cmdById: cmdById,
    restart: restart, get state() { return state; }
  };
}
