/*
 * balance-probe.js — 口喧嘩バトルの“成立性”を測る簡易AIシミュレーション（Node不要・JXA）
 *
 * なぜ：狂気（ぶつけるの雪だるま）と ぬくもり（救いの雪だるま）を足したので、
 *   「ぶつける一辺倒」「やさしく言って むかえる」両方の道が、これまで通り 夜明け（ボス）まで
 *   到達できるか＝非対称が成立しているかを、ざっくり数字で裏付ける。
 *   ※あくまで“成立性チェック”。最終的な手触りは実機プレイで詰める。
 *
 * 使い方： osascript -l JavaScript prototypes/02-saigo-no-tomodachi/tools/balance-probe.js
 *         （カレントは prototype のルートを想定）
 */
ObjC.import('Foundation');

function readFile(p) {
  return $.NSString.stringWithContentsOfFileEncodingError(p, 4, null).js;
}

var cwd = $.NSFileManager.defaultManager.currentDirectoryPath.js;
var base = cwd + "/js/";
var files = ["data.js", "state.js", "battle.js", "cards.js"];
var src = files.map(function (f) { return readFile(base + f); }).join("\n");

// シミュレーション本体（同じ eval スコープで core 関数を使う）
var sim = [
  "function living(){ return livingEnemies(); }",

  // 1ラン回す。kind: 'harsh'（ぶつける主体）/ 'gentle'（きいてみる→手をのばす主体）
  "function runOne(kind){",
  "  newGame(); startWave();",
  "  var guard = 0;",
  "  while (guard++ < 600) {",
  "    if (game.state === STATES.DAWN || game.state === STATES.RUN_OVER) break;",
  "    if (game.state === STATES.LEVEL_UP) {",
  // カード選択：harsh は火力寄り、gentle は こころ/ことば寄りを優先。無ければ先頭。
  "      var cs = game.pendingCards || [];",
  "      var pick = cs[0];",
  "      if (kind === 'gentle') { pick = cs.find(function(c){return c.type==='maxKokoro'||c.type==='word'||c.id==='yasashii'||c.id==='negai';}) || cs[0]; }",
  "      else { pick = cs.find(function(c){return c.type==='weapon'||c.type==='weaponLv'||c.id==='fukai'||c.id==='hayaashi';}) || cs[0]; }",
  "      chooseCard(pick); continue;",
  "    }",
  "    if (game.state !== STATES.PLAYER_TURN) break;",
  "    var es = living();",
  "    if (es.length === 0) break;",
  "    if (kind === 'harsh') {",
  // 全体/前列ことばが複数体に効くなら優先、なければ単体で前列を狙う
  "      var aoe = game.player.weapons.find(function(id){return WEAPONS[id].target==='all'||WEAPONS[id].target==='front2'||WEAPONS[id].target==='front3';});",
  "      if (aoe && es.length>1) { cmdFight(aoe); }",
  "      else { var single = game.player.weapons.find(function(id){return WEAPONS[id].target==='single';}) || game.player.weapons[0]; var w=WEAPONS[single]; if(w.target==='single'){cmdFight(single, es[0].uid);} else {cmdFight(single);} }",
  "    } else {",
  // gentle：壁0がいれば むかえる／いなければ 効くことばで壁を下げる／こころ無ければ こらえる
  "      var savable = es.find(function(e){return e.wall===0;});",
  "      if (savable && game.player.kokoro >= BALANCE.saveCost) { cmdSave(savable.uid); }",
  "      else {",
  "        var tgt = es.slice().sort(function(a,b){return a.wall-b.wall;})[0];",
  "        var act = tgt.acts[0];",
  "        if (game.player.kokoro >= BALANCE.actCost) { cmdAct(act, tgt.uid); }",
  "        else { cmdDefend(); }",
  "      }",
  "    }",
  "  }",
  "  var st = runStats();",
  "  return { kind: kind, reached: st.reachedWave, save: st.save, kill: st.kill, rate: Math.round(st.saveRate*100), ending: game.ending ? game.ending.id : '(none)', state: game.state };",
  "}",

  "function summarize(kind, n){",
  "  var reach=0, dawn=0, rates=[], endings={};",
  "  for (var i=0;i<n;i++){ var r=runOne(kind); if(r.reached>=6) reach++; if(r.state==='DAWN'){dawn++; rates.push(r.rate); endings[r.ending]=(endings[r.ending]||0)+1;} }",
  "  var avg = rates.length? Math.round(rates.reduce(function(a,b){return a+b;},0)/rates.length):0;",
  "  return kind+': W6到達 '+reach+'/'+n+' / 夜明け '+dawn+'/'+n+' / 平均救済率(夜明け時) '+avg+'% / 結末 '+JSON.stringify(endings);",
  "}",

  "var __o=[];",
  "__o.push(summarize('harsh', 20));",
  "__o.push(summarize('gentle', 20));",
  "__o.join('\\n');"
].join("\n");

var output;
try {
  output = "BALANCE PROBE (20 runs each)\n" + eval(src + "\n" + sim);
} catch (e) {
  output = "PROBE ERROR: " + e;
}
output;
