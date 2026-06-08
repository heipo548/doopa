/*
 * engine.js — バトルの進行ルール（DOM非依存の“純粋ロジック”）
 *
 * 画面描画(ui.js)とは完全に分離。理由：
 *  ・ロジックだけを JXA / Node で自動テストできる（tools/headless-check.js）。
 *  ・選択肢・相手・相性を増やすとき、進行ルールを使い回せる。
 *
 * 状態は単一のグローバル `state` に集約。関数はそれを書き換える。
 * （battle-lab の他モックと同じ「グローバル state＋関数」スタイル）
 *
 * ── 1ターンの流れ（spec 4）─────────────────────────────
 *   相手の様子を見る → 3択が出る → 1つ選ぶ → 相手が反応 → 状態が更新 → 次ターン。
 *   敵の“攻撃フェーズ”は無い。会話なので、毎ターン プレイヤーが1手を選ぶ。
 */

var state = null; // 現在のバトル状態。newBattle() で作る

/* ───────────── 補助：乱数（テストでは Math.random を差し替えて決定的にできる）───────────── */
function pick01() { return Math.random(); }
function clamp(v, lo, hi) { return v < lo ? lo : (v > hi ? hi : v); }

/* ───────────── ログ ───────────── */
function logMsg(msg) {
  if (!msg) return;
  state.log.push(msg);
  if (state.log.length > 60) state.log.shift();
}

/* ───────────── 状態（安心・沈黙・強がり・動揺）の出し入れ ───────────── */
function hasState(key) { return state.enemy.states.indexOf(key) >= 0; }
function addState(key) {
  if (!STATES[key] || hasState(key)) return;
  // 相反する状態は同時に持たない：安心↔動揺、沈黙↔安心 はぶつかるので整理
  if (key === 'anshin') removeState('doyo');
  if (key === 'doyo') removeState('anshin');
  if (key === 'anshin') removeState('chinmoku');
  state.enemy.states.push(key);
  logMsg('（相手は「' + STATES[key].label + '」の様子になった）');
}
function removeState(key) {
  var i = state.enemy.states.indexOf(key);
  if (i >= 0) state.enemy.states.splice(i, 1);
}

/* ───────────── いまの相手データ ───────────── */
function ENC() { return ENCOUNTERS[state.encounterId]; }

/* ───────────── 相性判定（カテゴリ × 相手タイプ）─────────────
 * bad > good の優先。どれか1タイプでも苦手なら身構える。
 * 戻り値：'good' | 'neutral' | 'bad'
 */
function typeMatch(category) {
  var types = state.enemy.types, isBad = false, isGood = false;
  for (var i = 0; i < types.length; i++) {
    var t = ENEMY_TYPES[types[i]];
    if (!t) continue;
    if (t.bad.indexOf(category) >= 0) isBad = true;
    if (t.good.indexOf(category) >= 0) isGood = true;
  }
  if (isBad) return 'bad';
  if (isGood) return 'good';
  return 'neutral';
}

/* ───────────── 条件評価（risk.cond と requires で使う）─────────────
 * cond = { any:[pred,...] } または { all:[pred,...] }
 *   pred: { flag:'x' } | { state:'x' } | { minUnderstanding:n }
 * any … どれか1つ満たせば true（“機が熟したか”の判定に使う）
 */
function predTrue(p) {
  if (p.flag != null) return !!state.flags[p.flag];
  if (p.state != null) return hasState(p.state);
  if (p.minUnderstanding != null) return state.understanding >= p.minUnderstanding;
  return false;
}
function evalCond(cond) {
  if (!cond) return true;
  if (cond.any) {
    for (var i = 0; i < cond.any.length; i++) if (predTrue(cond.any[i])) return true;
    return false;
  }
  if (cond.all) {
    for (var j = 0; j < cond.all.length; j++) if (!predTrue(cond.all[j])) return false;
    return true;
  }
  return true;
}

/* ───────────── 選択肢が今ターン出せるか（requires）───────────── */
function choiceEligible(c) {
  var r = c.requires || {};
  if (r.minTurn != null && state.turn < r.minTurn) return false;
  if (r.maxTurn != null && state.turn > r.maxTurn) return false;
  if (r.flag != null && !state.flags[r.flag]) return false;
  if (r.notFlag != null && state.flags[r.notFlag]) return false;
  if (r.state != null && !hasState(r.state)) return false;
  if (r.notState != null && hasState(r.notState)) return false;
  if (r.minUnderstanding != null && state.understanding < r.minUnderstanding) return false;
  if (c.limited && state.sashidasuUses <= 0) return false;
  if (c.once && state.usedOnce[c.id]) return false;
  return true;
}

/* ───────────── ゲージを“ことば”にする（spec 10.2）───────────── */
function gaugeWord(kind, value) {
  var table = GAUGE_WORDS[kind];
  for (var i = 0; i < table.length; i++) if (value <= table[i].upTo) return table[i].text;
  return table[table.length - 1].text;
}

/* ───────────── ターン開始時の「相手の様子」テキスト ─────────────
 * 状態 > 理解度ステージ の順で、いちばん相応しい一文を選ぶ。
 */
function lookText() {
  var look = ENC().look, en = state.enemy;
  // 状態優先（動揺・沈黙・安心・強がり）
  var order = ['doyo', 'chinmoku', 'anshin', 'bluff'];
  for (var i = 0; i < order.length; i++) {
    if (hasState(order[i]) && look.byState && look.byState[order[i]]) return look.byState[order[i]];
  }
  // 観察した直後の1ターンだけ、見つけたヒントを様子として見せる
  if (state.freshHint) return state.freshHint;
  // 理解度ステージ
  var u = state.understanding;
  if (u >= 56 && look.highU) return look.highU;
  if (u >= 28 && look.midU) return look.midU;
  if (u > 0 && look.lowU) return look.lowU;
  return look.default;
}

/* ───────────── バトル開始 / リスタート ───────────── */
function newBattle(encounterId) {
  var id = encounterId || 'naku_ko';
  var enc = ENCOUNTERS[id];

  state = {
    encounterId: id,
    turn: 1,
    phase: 'player',     // 'player' | 'end'
    result: null,        // null | 'win' | 'warmwin' | 'reject' | 'surface'
    understanding: 0,
    alert: enc.alertStart,
    composure: enc.composureStart,
    enemy: {
      id: enc.id, name: enc.name, title: enc.title, face: enc.face,
      types: enc.types.slice(),
      goal: enc.understandingGoal,
      alertCap: BALANCE.alertCap,
      turnLimit: enc.turnLimit,
      states: enc.startStates.slice(),
      line: enc.firstLine
    },
    sashidasuUses: enc.sashidasuUses,
    flags: {},
    hints: [],
    freshHint: null,
    usedOnce: {},
    uketomeruStreak: 0,
    disengageStreak: 0,
    lastCategory: null,        // 同じカテゴリの連発を鈍らせる（read-the-room を促す）
    sameCategoryStreak: 0,
    lastChoiceIds: [],
    choices: [],
    lastOutcome: null,
    fx: null,
    log: []
  };

  logMsg('——' + enc.name + 'と 向きあった。');
  logMsg(enc.firstLine);
  buildChoices();
  return state;
}

function restart() {
  return newBattle(state ? state.encounterId : 'naku_ko');
}

/* ───────────── 観察ヒントを積む（次ターンの様子で見せる）───────────── */
function pushHint(h) {
  if (!h) return;
  state.freshHint = h;          // 観察した“直後の1ターン”だけ、様子として見せる
  state.hints.push(h);
  if (state.hints.length > 4) state.hints.shift();
}

/* ───────────── 反応テキストを選ぶ ───────────── */
function reactLine(c, quality) {
  if (c.react) {
    if (quality === 'good' && c.react.good) return c.react.good;
    if (quality === 'bad' && c.react.bad) return c.react.bad;
    if (c.react.neutral) return c.react.neutral;
    if (c.react.good) return c.react.good; // 1つしか無いときの保険
  }
  var bank = REACT[quality] || REACT.neutral;
  return bank[Math.floor(pick01() * bank.length)];
}

/* ───────────── プレイヤーが1つ選ぶ（中核）─────────────
 * 戻り値：true=選べた（ターンが進む） / false=選べない（無効ID等）
 */
function choose(choiceId) {
  if (state.phase !== 'player' || state.result) return false;
  var c = null;
  for (var i = 0; i < state.choices.length; i++) if (state.choices[i].id === choiceId) c = state.choices[i];
  if (!c) return false;

  state.fx = null;
  state.freshHint = null;        // 前ターンの観察ヒントは、もう古い
  logMsg('L：' + c.text);         // ログは「行動 → 補足 → 反応」の順。まず L が言葉を選ぶ。

  // ── 余裕の消費／回復 ──
  state.composure -= (c.cost || 0);
  if (c.recover) state.composure += c.recover;
  state.composure = clamp(state.composure, 0, BALANCE.composureMax);

  // ── 基本の変化量 ──
  var u = c.understanding || 0;
  var a = c.alert || 0;

  // ── 高リスク選択：cond を満たせば success、外せば fail ──
  var riskOutcome = null, pendingSetState = null;
  if (c.risk) {
    var hit = evalCond(c.risk.cond);
    var br = hit ? c.risk.success : c.risk.fail;
    riskOutcome = hit ? 'success' : 'fail';
    if (br.understanding != null) u = br.understanding;
    if (br.alert != null) a = br.alert;
    if (br.setState) pendingSetState = br.setState;
  }
  if (c.setState) pendingSetState = c.setState;

  // ── 相性（カテゴリ × タイプ）──
  var m = typeMatch(c.category);
  if (m === 'good') { u *= BALANCE.goodU; a = (a > 0) ? a * BALANCE.goodA : a * 1.2; }
  // 苦手なとき：やさしい言葉も“はぐらかされて”ほとんど効かない（下がっても わずか）。露骨に逆効果にはしない。
  else if (m === 'bad') { u *= BALANCE.badU; a = (a > 0) ? a * BALANCE.badA : (a * 0.5 + 3); }

  // ── 相手の状態による補正（この手を打つ“前”の状態で判定）──
  if (hasState('anshin')) {
    if (a > 0) a *= BALANCE.anshinAlertMult;
    if (c.category === 'kiku') u *= BALANCE.anshinKikuU;
  }
  if (hasState('chinmoku')) {
    // 沈黙中に、無理に「聞く／核心」を押すと 警戒が大きく上がる
    if ((c.category === 'kiku' || c.core) && !c.gentle) a += BALANCE.chinmokuPushAlert;
  }
  if (hasState('bluff')) {
    // 強がりは、崩すまで 聞く／伝える が効きにくい（観察やクリア手は除く）
    if ((c.category === 'kiku' || c.category === 'tsutaeru') && c.clearState !== 'bluff') u *= BALANCE.bluffEffU;
  }
  if (hasState('doyo')) {
    u *= BALANCE.doyoU;
    if (a > 0) a *= BALANCE.doyoAlertMult; // 動揺中の踏み込みすぎは致命的
    else a *= 1.3;                          // 動揺中の やわらかい手は 強く効く
  }

  // ── やわらかい核心が、機が熟していれば「動揺」を生む（リスク選択で外したときは除く）──
  if (c.core && c.gentle && m !== 'bad' && riskOutcome !== 'fail' && !hasState('doyo') &&
      state.understanding >= BALANCE.doyoCoreUnderstanding && !pendingSetState) {
    pendingSetState = 'doyo';
  }

  // ── 強がり(bluff)を崩す前は「動揺」しない。先に観察などで“ふり”をはがす必要がある（spec 7.3）──
  // これが無いと「伝える」連打だけで動揺→押し切れてしまい、観察の意味が薄れる。
  if (pendingSetState === 'doyo' && hasState('bluff')) pendingSetState = null;

  // ── 同じカテゴリの連発は効きが鈍る（“読み”を促す：spec 14・19）──
  // 同じ言葉を続けるほど、理解の伸びも 警戒の和らぎも 小さくなる。だから相手に合わせて手を変える。
  var repeat = (c.category === state.lastCategory) ? state.sameCategoryStreak : 0;
  var monotony = Math.max(0.5, 1 - 0.2 * repeat);
  u *= monotony;
  if (a < 0) a *= monotony;   // 連発すると 警戒を下げる力も鈍る（プラスのスパイクは鈍らせない）
  state.sameCategoryStreak = (c.category === state.lastCategory) ? state.sameCategoryStreak + 1 : 1;
  state.lastCategory = c.category;

  // ── 確定して適用 ──
  u = Math.round(u);
  a = Math.round(a);
  var uBefore = state.understanding, aBefore = state.alert;
  state.understanding = clamp(state.understanding + u, 0, BALANCE.understandingMax);
  state.alert = clamp(state.alert + a, 0, BALANCE.alertCap);
  var dU = state.understanding - uBefore, dA = state.alert - aBefore;

  // ── 差し出す／once の消費 ──
  if (c.limited) state.sashidasuUses = Math.max(0, state.sashidasuUses - 1);
  if (c.once) state.usedOnce[c.id] = true;

  // ── フラグ・ヒント・状態の更新 ──
  if (c.reveal) { state.flags[c.reveal] = true; if (c.hint) pushHint(c.hint); }
  if (c.clearState && hasState(c.clearState)) {
    var cleared = STATES[c.clearState];
    removeState(c.clearState);
    if (cleared) logMsg('（' + cleared.label + 'が、すこし ほどけた）');
  }
  // 待つ・距離・差し出す・受け止める は 沈黙を解く
  if (hasState('chinmoku') &&
      (c.category === 'kyori' || c.category === 'kansatsu' || c.category === 'sashidasu' || c.category === 'uketomeru')) {
    removeState('chinmoku');
    logMsg('（沈黙が、すこし ほどけた）');
  }
  if (pendingSetState) addState(pendingSetState);

  // ── 受け止める連続成功 → 安心 ──
  if (c.category === 'uketomeru' && dA <= 2) {
    state.uketomeruStreak += 1;
    // このターンに動揺を新規付与したなら、安心(=動揺を消す)で上書きしない。動揺の大チャンスを潰さないため。
    if (state.uketomeruStreak >= BALANCE.anshinStreak && !hasState('anshin') && pendingSetState !== 'doyo') addState('anshin');
  } else {
    state.uketomeruStreak = 0;
  }

  // ── 無理に踏み込んで 警戒が大きく跳ねると、相手は口をつぐむ（沈黙）──
  // spec 7.2：沈黙すると選べる言葉が減り、無理に聞くとさらに警戒が上がる。待つ・距離・差し出す・受け止めるで解ける。
  if (dA >= 18 && state.alert < state.enemy.alertCap && !hasState('chinmoku') && !hasState('doyo')) {
    addState('chinmoku');
  }

  // ── 結果の良し悪し（反応テキスト＆SE用）──
  var quality;
  if (riskOutcome === 'fail' || dA >= 12) quality = 'bad';
  else if (dU >= 12 && dA <= 4) quality = 'good';
  else quality = 'neutral';
  state.lastOutcome = quality;

  // SE フラグ（ui/main が拾って鳴らす）
  if (dA >= 12) state.fx = 'alert';
  else if (c.reveal) state.fx = 'reveal';
  else if (dU >= 12) state.fx = 'understand';
  else state.fx = 'choice';

  // ── 相手の反応（直前の手への返事）。L の言葉は冒頭で既にログ済み ──
  var line = reactLine(c, quality);
  if (line) { state.enemy.line = line; logMsg(line); }

  // ── 勝敗判定：まず プレイヤーの一手で決まる（理解度ゴール／拒絶）を優先 ──
  checkResult();

  // ── 受動的な変化（さびしがりの“放置”ペナルティ等）は、その手で決着しなかった時だけ走らせる ──
  // 理解度ゴールに届いたターンを、受動ペナルティ +警戒 で拒絶に化けさせないため、checkResult の後に置く。
  if (!state.result) {
    enemyTick(c);
    checkResult();
  }

  // ── ターン送り ──
  if (!state.result) {
    state.turn += 1;
    if (state.turn > state.enemy.turnLimit) {
      state.result = 'surface';
      state.phase = 'end';
    } else {
      buildChoices();
    }
  } else {
    state.phase = 'end';
  }
  return true;
}

/* ───────────── 相手の受動的な変化（毎手 呼ぶ）───────────── */
function enemyTick(c) {
  var disengage = (c.category === 'kyori' || c.category === 'kansatsu');
  if (disengage) state.disengageStreak += 1; else state.disengageStreak = 0;

  // さびしがりは“放置”に弱い：距離/観察が2手続くと、すこし不安に（警戒+）
  var lonely = state.enemy.types.indexOf('sabishigari') >= 0;
  if (lonely && state.disengageStreak >= 2 && !state.result) {
    state.alert = clamp(state.alert + 6, 0, BALANCE.alertCap);
    logMsg('（相手は、置いていかれた ような顔を した）');
    state.disengageStreak = 0;
  }
}

/* ───────────── 勝敗判定 ─────────────
 *   理解度ゴール到達（警戒が上限未満）→ win / 警戒が低ければ warmwin（良エンド）
 *   警戒度が上限 → reject（相手が拒絶）
 *   ※ ターン切れ surface は choose() 側で判定（理解度が足りなかった場合）
 */
function checkResult() {
  if (state.alert >= state.enemy.alertCap) {
    state.alert = state.enemy.alertCap;
    state.result = 'reject';
    state.phase = 'end';
    return;
  }
  if (state.understanding >= state.enemy.goal) {
    state.result = (state.alert < BALANCE.warmWinAlert) ? 'warmwin' : 'win';
    state.phase = 'end';
  }
}

/* ───────────── 3択（沈黙中は2択）を組み立てる（spec 8）─────────────
 * 構成は「安全・小／高リスク・大／状況しだい」の三角を基本に。
 * 余裕が尽きていたら“焦り”の選択肢になる（spec 16）。
 */
function buildChoices() {
  if (state.result) { state.choices = []; return; }

  // 焦り：余裕0
  if (state.composure <= 0) {
    state.choices = PANIC_CHOICES.slice(0, 3);
    state.lastChoiceIds = state.choices.map(function (c) { return c.id; });
    if (state.log[state.log.length - 1] !== '（余裕が なくなって、焦った言葉しか 出てこない）') {
      logMsg('（余裕が なくなって、焦った言葉しか 出てこない）');
    }
    return;
  }

  var pool = ENC().choicePool;
  var eligible = pool.filter(choiceEligible);

  var silent = hasState('chinmoku');
  var n = silent ? 2 : 3;
  var chosen = [];

  function takeRole(roles) {
    var bucket = eligible.filter(function (c) {
      return roles.indexOf(c.role) >= 0 && chosen.indexOf(c) < 0;
    });
    if (!bucket.length) return;
    var fresh = bucket.filter(function (c) { return state.lastChoiceIds.indexOf(c.id) < 0; });
    var src = fresh.length ? fresh : bucket;
    chosen.push(src[Math.floor(pick01() * src.length)]);
  }

  if (silent) {
    // 落ち着いた手だけ：距離・観察・差し出す・受け止める
    takeRole(['distance']);
    takeRole(['observe', 'situational', 'safe']);
  } else {
    takeRole(['safe']);                                   // 安全・小
    takeRole(['risk', 'offer']);                          // 高リスク・大
    takeRole(['situational', 'observe', 'distance']);     // 状況しだい
  }

  // 足りない分は、残りから埋める（新鮮さ優先）。沈黙中は“落ち着いた手”だけで埋める（踏み込み手を混ぜない）。
  var calmRoles = ['distance', 'observe', 'situational', 'safe'];
  var guard = 0;
  while (chosen.length < n && guard < 20) {
    guard++;
    var rest = eligible.filter(function (c) {
      return chosen.indexOf(c) < 0 && (!silent || calmRoles.indexOf(c.role) >= 0);
    });
    if (!rest.length) break;
    var fresh2 = rest.filter(function (c) { return state.lastChoiceIds.indexOf(c.id) < 0; });
    var src2 = fresh2.length ? fresh2 : rest;
    chosen.push(src2[Math.floor(pick01() * src2.length)]);
  }

  state.choices = chosen.slice(0, n);
  state.lastChoiceIds = state.choices.map(function (c) { return c.id; });
}

/* ───────────── 報酬（覚えられることば）の一覧 ───────────── */
function rewardChoices() {
  var enc = ENC();
  var out = [];
  for (var i = 0; i < enc.rewards.length; i++) {
    var w = WORD_REWARDS[enc.rewards[i]];
    if (w) out.push(w);
  }
  return out;
}

/* JXA / Node 双方から参照できるよう公開（ブラウザでは無視される） */
if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    newBattle: newBattle, restart: restart, choose: choose,
    buildChoices: buildChoices, checkResult: checkResult,
    typeMatch: typeMatch, evalCond: evalCond, choiceEligible: choiceEligible,
    hasState: hasState, addState: addState, removeState: removeState,
    gaugeWord: gaugeWord, lookText: lookText, rewardChoices: rewardChoices,
    getState: function () { return state; },
    setState: function (s) { state = s; }
  };
}
