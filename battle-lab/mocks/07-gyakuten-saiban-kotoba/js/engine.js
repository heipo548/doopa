/*
 * engine.js — 尋問バトルの「進行ルール」だけを書く純粋ロジック（DOM非依存）
 *
 * ここは画面（DOM）に一切触らない。状態 `state` を持ち、関数で書き換えるだけ。
 * こうしておくと、ブラウザを開かなくても tools/headless-check.js（JXA）で
 * ルールの正しさを自動点検できる。描画は ui.js、配線は main.js が担当する。
 *
 * 操作は3つ＋証拠突きつけ：
 *   ・selectLine(id) … 発言を1行選ぶ
 *   ・ask()          … 選択中の発言を「たずねる」（ノイズは減らない）
 *   ・think()        … 「考える」で論点を表示（ノイズは減らない）
 *   ・beginPresent() / cancelPresent() … 「つきつける」モードの開始/取消
 *   ・present(kind,id)… 記憶のかけら or 言葉を突きつける（判定はここ）
 *
 * 進行の芯：
 *   正しい発言に正しい「記憶のかけら」を突きつける → 閉じた心 -1 → 次の証言へ。
 *   閉じた心が0で勝利（本音のページ）。
 *   間違った記憶を突きつける → ノイズ耐性 -1。0で敗北。
 *   言葉はどれを突きつけてもサブ反応のみ（ノイズは減らない・進行もしない）。
 */

// ゲーム全体の状態。ui.js / main.js / headless-check からは素のグローバルとして読む。
var state = null;

/* ───────── ログ ─────────
 * ログは「ブロック」の配列。1ブロック ＝ { tone, lines:[...] }。
 * tone は見た目の手がかり：
 *   'open'(開幕) / 'speak'(やりとり) / 'hint'(ヒント) / 'think'(論点) /
 *   'sub'(言葉のサブ反応) / 'fail'(失敗) / 'success'(逆転) / 'system'(進行) / 'result'(勝敗)
 */
function logBlock(tone, lines) {
  // 文字列1つでも配列でも受けられるようにしておく
  if (typeof lines === 'string') lines = [lines];
  state.log.push({ tone: tone, lines: lines });
}

/* ───────── 初期化 ───────── */
function newBattle() {
  state = {
    stageIndex: 0,                                   // 今どの証言か（0..2）
    selected: null,                                  // 選択中の発言ID
    mode: 'idle',                                    // 'idle' | 'present'（突きつけ待ち）
    shown: {},                                       // この証言で“出現済み”の隠し行ID
    askedHint: false,                                // 直近の操作でヒントを出したか（描画補助）
    player: { name: PLAYER_INIT.name, noise: PLAYER_INIT.noise, maxNoise: PLAYER_INIT.maxNoise },
    enemy:  { name: ENEMY_INIT.name, heart: ENEMY_INIT.heart, maxHeart: ENEMY_INIT.maxHeart },
    result: null,                                    // null | 'win' | 'lose'
    log: []
  };
  // 開幕ログ＋最初の証言の入りを出す
  logBlock('open', [OPENING_LOG]);
  announceTestimony();
  return state;
}

// いまの証言オブジェクトを返す
function currentStage() { return TESTIMONIES[state.stageIndex]; }

// 画面に出すべき行（隠し行は“出現済み”のものだけ）を順番どおりに返す
function visibleLines() {
  var st = currentStage();
  var out = [];
  for (var i = 0; i < st.lines.length; i++) {
    var ln = st.lines[i];
    if (!ln.hidden || state.shown[ln.id]) out.push(ln);
  }
  return out;
}

// 行IDから行オブジェクトを引く（今の証言内）
function findLine(id) {
  var st = currentStage();
  for (var i = 0; i < st.lines.length; i++) if (st.lines[i].id === id) return st.lines[i];
  return null;
}

// 証言の頭出しログ（証言タイトルを示す）
function announceTestimony() {
  var st = currentStage();
  logBlock('system', ['証言：「' + st.title + '」']);
}

/* ───────── 発言を選ぶ ───────── */
function selectLine(id) {
  if (state.result) return false;
  // 出現していない行は選べない（隠し行の安全策）
  var visible = visibleLines();
  var okId = false;
  for (var i = 0; i < visible.length; i++) if (visible[i].id === id) okId = true;
  if (!okId) return false;
  state.selected = id;
  // 行を選び直したら、突きつけモードはいったん解除（誤爆防止）
  state.mode = 'idle';
  return true;
}

/* ───────── たずねる（ゆさぶる）─────────
 * 追加のやりとり・ヒントを出す。場合により隠し行が出現する。ノイズは減らない。
 */
function ask() {
  if (state.result || !state.selected) return false;
  var st = currentStage();
  var a = st.asks[state.selected];
  if (!a) return false;

  logBlock('speak', a.speech.slice());            // やりとりを表示

  // 隠し行の出現（例：第2証言の b3 をたずねると b5 が現れる）
  if (a.reveal && !state.shown[a.reveal]) {
    state.shown[a.reveal] = true;
    var revealed = findLine(a.reveal);
    logBlock('system', ['発話ログに、新しい一行が増えた。', '「' + revealed.text + '」']);
  }

  // ヒントがあれば添える
  if (a.hint) logBlock('hint', ['（気づき）' + a.hint]);

  state.mode = 'idle';
  return true;
}

/* ───────── 考える ─────────
 * いまの論点（軽いヒント）を表示する。詰まったときの補助。ノイズは減らない。
 */
function think() {
  if (state.result) return false;
  var t = currentStage().think;
  logBlock('think', [t.log, '', '論点：', t.ronten]);
  return true;
}

/* ───────── つきつけるモードの開始 / 取消 ─────────
 * 「つきつける」は (1)発言を選ぶ → (2)つきつける → (3)記憶/言葉を選ぶ の3手。
 * モードを分けることで「どの発言に突きつけるのか」を取り違えにくくする。
 */
function beginPresent() {
  if (state.result || !state.selected) return false;
  state.mode = 'present';
  return true;
}
function cancelPresent() {
  if (state.result) return false;   // 決着後は他の操作と同様に受け付けない（一貫性）
  state.mode = 'idle';
  return true;
}

/* ───────── つきつける（判定の本体）─────────
 * kind: 'memory'（記憶のかけら）| 'word'（言葉）
 * 返り値: { type: 'success'|'fail'|'sub', win?, lose?, advanced? }
 */
function present(kind, id) {
  if (state.result || !state.selected) return null;
  var st = currentStage();

  /* --- 言葉：必ずサブ反応。正解にならず、ノイズも減らない（安全な手札）--- */
  if (kind === 'word') {
    var sp = lookupWordReaction(state.stageIndex, state.selected, id);
    logBlock('sub', sp.slice());
    state.mode = 'idle';
    return { type: 'sub' };
  }

  /* --- 記憶のかけら：正解 / 間違い を判定 ---
   * 'word' でも 'memory' でもない種別が来たら、安全のため何もしない。
   * （UIからは 'memory'/'word' しか渡らないが、将来 engine を直接呼ぶ拡張に備える）*/
  if (kind !== 'memory') return null;
  var ans = st.answer;
  var correct = (id === ans.memoryId && state.selected === ans.lineId);

  if (correct) {
    // 逆転の演出ログ → 閉じた心を1つ開く
    logBlock('success', st.success.slice());
    state.enemy.heart = Math.max(0, state.enemy.heart - 1);
    logBlock('system', ['閉じた心：' + heartBar()]);
    state.mode = 'idle';
    state.selected = null;

    if (state.enemy.heart <= 0) {
      // すべての矛盾がほどけた → 本音のページが開く＝勝利
      state.result = 'win';
      logBlock('result', WIN_TEXT.slice());
      return { type: 'success', win: true };
    }
    // まだ続く → 次の証言へ
    state.stageIndex++;
    state.shown = {};
    logBlock('system', ['', '村長は、次の言葉を話しはじめた。']);
    announceTestimony();
    return { type: 'success', advanced: true };
  }

  // 間違った記憶 → ノイズ耐性 -1
  var fail = MEMORY_FAIL_SPECIAL[id] ? MEMORY_FAIL_SPECIAL[id] : FAIL_GENERIC;
  logBlock('fail', fail.slice().concat(['', 'ノイズ耐性 −1']));
  state.player.noise = Math.max(0, state.player.noise - 1);
  state.mode = 'idle';

  if (state.player.noise <= 0) {
    // ノイズ耐性0 → ほんとうとうその区別がつかなくなる＝敗北
    state.result = 'lose';
    logBlock('result', LOSE_TEXT.slice());
    return { type: 'fail', lose: true };
  }
  return { type: 'fail' };
}

// 言葉のサブ反応を探す（特別反応を優先し、無ければ汎用反応）
function lookupWordReaction(stageIndex, lineId, wordId) {
  for (var i = 0; i < WORD_SPECIAL.length; i++) {
    var w = WORD_SPECIAL[i];
    if (w.stage === stageIndex && w.lineId === lineId && w.wordId === wordId) return w.speech;
  }
  return WORD_GENERIC[wordId] || ['Lは、その言葉を差し出した。', '村長「……」', '矛盾は、まだそこにある。'];
}

// 閉じた心の見た目（■＝閉じている / □＝開いた）
function heartBar() {
  var s = '';
  for (var i = 0; i < state.enemy.maxHeart; i++) s += (i < state.enemy.heart ? '■' : '□');
  return s;
}

/* ───────── リスタート ───────── */
function restart() { return newBattle(); }

/*
 * Node など CommonJS 環境（将来テストを足す場合）でも読めるように一応 export。
 * ブラウザ／JXA では module が無いので、この行は単に無視される。
 */
if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    newBattle: newBattle, selectLine: selectLine, ask: ask, think: think,
    beginPresent: beginPresent, cancelPresent: cancelPresent, present: present,
    visibleLines: visibleLines, currentStage: currentStage, heartBar: heartBar,
    restart: restart, get state() { return state; }
  };
}
