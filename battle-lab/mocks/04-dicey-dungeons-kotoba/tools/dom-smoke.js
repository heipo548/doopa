/*
 * dom-smoke.js — UI層(ui.js / main.js)まで通す“煙テスト”（Node不要・JXAで動く）
 *
 * headless-check.js は data＋engine だけを点検する。こちらは最小の DOM スタブを用意して
 * ui.js / main.js も読み込み、実際に boot()→描画→「欠片を選ぶ→装置に入れる→ターン終了→
 * 相手の番」までを動かして、配線や描画で例外が出ないことを確認する。
 *
 * 使い方（モックのフォルダで実行）：
 *   osascript -l JavaScript tools/dom-smoke.js
 */
ObjC.import('Foundation');

function readFile(p) { return $.NSString.stringWithContentsOfFileEncodingError(p, 4, null).js; }
var env = $.NSProcessInfo.processInfo.environment.js;
var base = (env['MOCKDIR'] ? env['MOCKDIR'].js : $.NSFileManager.defaultManager.currentDirectoryPath.js);
if (base.charAt(base.length - 1) !== '/') base += '/';
var jsdir = base + 'js/';

/* ───────── 最小の DOM スタブ ───────── */
function makeEl(tag) {
  var el = {
    tagName: tag, _children: [], textContent: '', className: '',
    title: '', disabled: false, onclick: null, style: {}, scrollTop: 0, scrollHeight: 0,
    _classes: {}
  };
  el.appendChild = function (c) { el._children.push(c); return c; };
  el.removeChild = function (c) {
    var i = el._children.indexOf(c); if (i >= 0) el._children.splice(i, 1); return c;
  };
  el.setAttribute = function () {};
  el.classList = {
    add: function (c) { el._classes[c] = true; },
    remove: function (c) { delete el._classes[c]; },
    contains: function (c) { return !!el._classes[c]; }
  };
  // innerHTML='' で子要素をクリアできるようにする（ui.js が多用する）
  Object.defineProperty(el, 'innerHTML', {
    get: function () { return ''; },
    set: function (v) { if (v === '') el._children = []; }
  });
  return el;
}

var _byId = {};
var document = {
  readyState: 'complete', // boot() を即実行させる
  getElementById: function (id) { if (!_byId[id]) _byId[id] = makeEl('div'); return _byId[id]; },
  createElement: function (tag) { return makeEl(tag); },
  createTextNode: function (t) { return { nodeType: 3, textContent: t }; },
  addEventListener: function () {}
};
// JXA には setTimeout が無いので、その場で同期実行するスタブにする
function setTimeout(fn) { fn(); return 0; }

/* ───────── 4ファイルを読み込んで起動 ───────── */
var src = readFile(jsdir + 'data.js') + '\n' + readFile(jsdir + 'engine.js') + '\n'
        + readFile(jsdir + 'ui.js') + '\n' + readFile(jsdir + 'main.js');

var passed = 0, failed = 0, lines = [];
function ok(cond, label) {
  if (cond) { passed++; lines.push('  ✅ ' + label); }
  else { failed++; lines.push('  ❌ ' + label); }
}

var booted = true;
try { eval(src); } // ← この中で boot() が走り、newBattle＋UI.render() される
catch (e) { booted = false; lines.push('  ❌ 起動で例外: ' + e); }
ok(booted, '起動: data/engine/ui/main を読み込んで boot() が例外なく走る');

if (booted) {
  // 説明文（howto）が差し込まれた
  ok(_byId['howto']._children.length === LORE.howto.length, '描画: 説明文(howto)が ' + LORE.howto.length + '行 差し込まれた');
  // HUD の初期表示
  ok(_byId['enemy-heart-num'].textContent === '30 / 30', '描画: 閉じた心 30 / 30');
  ok(_byId['player-noise-num'].textContent === '24 / 24', '描画: ノイズ耐性 24 / 24');
  ok(_byId['kakera']._children.length === 3, '描画: ことばの欠片チップが 3つ');
  ok(_byId['devices']._children.length === 8, '描画: 言葉装置カードが 8つ');
  ok(_byId['intent-label'].textContent && _byId['intent-label'].textContent.length > 0, '描画: 次の感情が 表示されている');

  // 操作：欠片を選ぶ → こんにちは に入れる → 閉じた心が減る
  var drove = true;
  try {
    var kid = state.pool[0].id;
    var hBefore = state.enemy.heart;
    Game.selectKakera(kid);
    ok(Game.getSelected() === kid, '操作: 欠片を選択できる');
    Game.loadInto('konnichiwa');
    ok(state.enemy.heart < hBefore, '操作: こんにちは に入れて 閉じた心が減る');
    ok(Game.getSelected() === null, '操作: 入れたら 選択が解除される');
    // ターン終了 → 相手の番（setTimeout 同期スタブで enemyTurn まで進む）
    var t0 = state.turn;
    Game.endTurn();
    ok(state.result || state.turn === t0 + 1, '操作: ターン終了で 相手の番→次ターンへ進む（または決着）');
    ok(state.phase === 'player' || state.result, '操作: 進行後はプレイヤーの番 or 決着');
  } catch (e) { drove = false; lines.push('  ❌ 操作中に例外: ' + e); }
  ok(drove, '操作: 選ぶ→入れる→ターン終了 が例外なく動く');

  // 勝利オーバーレイの描画
  var won = true;
  try {
    state.enemy.heart = 2;
    var wid = state.pool.length ? state.pool[0].id : null;
    if (!wid) { state.pool.push({ id: 'wk', value: 6, white: false, kasure: false }); wid = 'wk'; }
    else { state.pool[0].value = 6; }
    Game.selectKakera(wid);
    Game.loadInto('konnichiwa'); // 6ダメージで 2→0
    ok(state.result === 'win', '勝利: 閉じた心0で win になる');
    ok(_byId['overlay'].classList.contains('show'), '勝利: オーバーレイが表示される');
    ok(_byId['overlay-text']._children.length === WIN_TEXT.length, '勝利: 勝利メッセージ ' + WIN_TEXT.length + '行が描画される');
  } catch (e) { won = false; lines.push('  ❌ 勝利描画で例外: ' + e); }
  ok(won, '勝利: オーバーレイまで例外なく描画');
}

var header = '=== 言葉サイコロ装填バトル dom-smoke ===';
var footer = (failed === 0) ? ('PASS — ' + passed + '件すべてOK')
                            : ('FAIL — ' + failed + '件 失敗 / ' + passed + '件 成功');
console.log([header].concat(lines).concat([footer]).join('\n'));
