/*
 * playthrough.js — 村→洞窟→結末 を“最後まで”自動踏破する通しプレイ検証（JXA・Node不要）
 *
 * なぜ：headless-check は1戦ぶんの決着を、ui-syntax-check は各画面が落ちないかを見る。
 *   だが「タイトル→村(NPC/ショップ/雑魚/村長)→洞窟(雑魚/悪党)→結末→メタ」という
 *   “1本の道”が ソフトロックせず最後まで通るか は、実際に歩いてみないと分からない。
 *   ここでは ui/audio/main を読まず（DOM非依存のコアだけ）、画面遷移(app.screen)を
 *   ui ハンドラと同じ順で手動再現し、傾向別3戦略でゴール到達と結末分岐を検証する。
 *
 * 使い方： cd prototypes/03-word-to-world && osascript -l JavaScript tools/playthrough.js
 *
 * 検証する不変条件：
 *   - どの戦略でも screen=="result" に到達する（ソフトロックしない）。
 *   - cruel(harshのみ) → 結末 cruel・darkLevel が上がる。
 *   - warm(kindのみ)   → 結末 warm・途中でゲームオーバーしない（救いルートが成立）。
 *   - gray(混在)       → 結末 gray。
 *   - 読み飛ばし(skip)した戦略ほど metricsSummary().skipRatio が高い（見透かしの素が貯まる）。
 */
ObjC.import('Foundation');

function readFile(p) {
  return $.NSString.stringWithContentsOfFileEncodingError(p, 4, null).js;
}

var cwd = $.NSFileManager.defaultManager.currentDirectoryPath.js;
var base = cwd + "/js/";
// DOM非依存のコアだけ（audio/ui/main/save は読まない。field/battle/cards は typeof ガードで素通り）。
var files = ["data.js", "metrics.js", "state.js", "battle.js", "cards.js", "field.js"];
var src = files.map(function (f) { return readFile(base + f); }).join("\n");

// ── 1本の道を自動で歩く“ドライバ”。ui ハンドラ(onPickCard/advanceText/onShopBuy)と同じ遷移を再現する ──
var drive = [
  "var __out = [];",

  // 戦闘で次に言うことばを戦略に応じて選ぶ。
  //   cruel=いちばん強い harsh / warm=生存優先の kind(issho で敵atkを削り daijoubu で回復) / gray=交互。
  "function chooseWord(strat){",
  "  var owned = ownedCards();",
  "  var harsh = owned.filter(function(id){return WORDS[id].kind==='harsh';});",
  "  var kind  = owned.filter(function(id){return WORDS[id].kind==='kind';});",
  "  harsh.sort(function(a,b){return cardPower(b)-cardPower(a);});",
  "  kind.sort(function(a,b){return cardPower(b)-cardPower(a);});",
  "  var en = game.battle.enemy;",
  "  function kindMove(){",                                                 // 生存優先の kind 手
  "    if(kind.indexOf('issho')>=0 && en.atk>1) return 'issho';",          // まず敵の攻撃を削る
  "    if(game.player.hp <= game.player.maxHp-3 && kind.indexOf('daijoubu')>=0) return 'daijoubu';", // 傷んだら回復
  "    return kind[0] || harsh[0];",                                        // あとは思いやりを積む
  "  }",
  "  if(strat==='cruel'){ return harsh[0] || kind[0]; }",
  "  if(strat==='warm'){ return kindMove(); }",
  // gray＝“戦闘ごとに勝ち方を変える”現実的な混在プレイ：奇数戦は寄り添い(kind)、偶数戦は言い負かし(harsh)。
  //   1戦の中で混ぜると harsh が先に精神HPを削り切るので、混在は「戦ごと」に作るのが自然。
  "  var kindBattle = (game.counters.battles % 2 === 1);",
  "  return kindBattle ? kindMove() : (harsh[0] || kind[0]);",
  "}",

  // 1戦を最後まで（自分のターンが続く限りことばを言う）。決着で screen は cards へ移る。
  "function fight(strat){",
  "  var g=0;",
  "  while(game.battle && game.battle.phase==='player' && g++<60){",
  "    var wid = chooseWord(strat);",
  "    if(!wid){ break; }",
  "    playerCard(wid);",
  "    if(game.state==='GAMEOVER'){ return 'GAMEOVER'; }",
  "  }",
  "  return 'ok';",
  "}",

  // 3択カードを戦略に沿って1枚選ぶ（ui.onPickCard と同じ：pickCard→field なら backToField）。
  "function pick(strat){",
  "  var cards = game.pendingCards || [];",
  "  var idx = 0;",
  // gray は“優しさ率を 0.5 に寄せる”ように選ぶ（少ない側のカードを取る）＝バランス維持。
  "  var wantKind = (strat==='warm') || (strat==='gray' && game.player.tendency.yasashisa <= game.player.tendency.kyoubou);",
  "  var wantHarsh = (strat==='cruel') || (strat==='gray' && !wantKind);",
  "  for(var i=0;i<cards.length;i++){",
  "    if(wantHarsh && cards[i].kind==='harsh'){ idx=i; break; }",
  "    if(wantKind  && cards[i].kind==='kind'){ idx=i; break; }",
  "  }",
  "  pickCard(idx);",
  "  if(typeof backToField==='function' && app.screen==='field') backToField();",
  "}",

  // NPC会話：各行を metrics に通して（skip有無で読み癖を作る）会話を終える。
  "function talk(strat, skip){",
  "  var d = game.dialogue;",
  "  if(d && d.lines){",
  "    for(var i=0;i<d.lines.length;i++){",
  "      textShown(String(d.lines[i]).length);",
  "      textAdvanced({skipped: !!skip});",
  "    }",
  "  }",
  "  endNpcDialogue();", // givesCard なら offerCards(screen=cards)、でなければ backToField
  "}",

  // 学校：戦略に合う1語を買って（onShopBuy→cards→pick）退店する（school は _done 化済みで再発火しない）。
  "function shop(strat){",
  "  var ids = (typeof SHOP!=='undefined' && SHOP.words) ? SHOP.words.map(function(w){return w.wordId;}) : [];",
  "  var buy = null;",
  "  for(var i=0;i<ids.length;i++){",
  "    var w = WORDS[ids[i]]; if(!w) continue; if(cardLevel(ids[i])>=3) continue;",
    // gray も kind(issho等)を買って、戦ごとの寄り添いプレイ(奇数戦)を生存可能にする。
  "    if((strat==='warm'||strat==='gray') && w.kind==='kind'){ buy=ids[i]; break; }",
  "    if(strat==='cruel' && w.kind==='harsh'){ buy=ids[i]; break; }",
  "  }",
  "  if(buy){ offerCards({pool:[buy], from:'shop', reason:'shop', harshKind:false}); pickCard(0); }",
  "  if(typeof backToField==='function') backToField(); else { app.screen='field'; }",
  "}",

  // フィールドで次に発火すべき node（最小x・未done・通行可）を1つ撃つ。無ければ false。
  "function fireNext(){",
  "  var best=null;",
  "  for(var i=0;i<field.nodes.length;i++){",
  "    var n=field.nodes[i];",
  "    if(n._done) continue;",
  "    if(n.requires && !hasFlag(n.requires)) continue;",
  "    if(best===null || n.x<best.x) best=n;",
  "  }",
  "  if(!best) return false;",
  "  fireNode(best);",
  "  return true;",
  "}",

  // 1プレイを最後まで。戦略 strat と 読み飛ばし skip を受け、結末画面に着くまで歩く。
  "function playthrough(strat, skip){",
  "  newGame(); startMetrics();",
  "  enterArea('mura');",
  "  var guard=0, dead=false;",
  "  while(app.screen!=='result' && guard++<400){",
  "    noteClick();", // 1操作=1クリック相当（クリック癖の素）
  "    if(game.state==='GAMEOVER'){ dead=true; break; }",
  "    if(app.screen==='dialogue'){ talk(strat, skip); continue; }",
  "    if(app.screen==='cards'){ pick(strat); continue; }",
  "    if(app.screen==='shop'){ shop(strat); continue; }",
  "    if(app.screen==='battle'){ var r=fight(strat); if(r==='GAMEOVER'){ dead=true; break; } continue; }",
  "    if(app.screen==='field'){ if(!fireNext()){ break; } continue; }",
  "    break;",
  "  }",
  "  var ms = metricsSummary();",
  "  return {",
  "    strat: strat, skip: !!skip, dead: dead, guard: guard,",
  "    screen: app.screen,",
  "    ending: game.ending ? game.ending.id : null,",
  "    dark: darkLevel(),",
  "    kyoubou: game.player.tendency.kyoubou,",
  "    yasashisa: game.player.tendency.yasashisa,",
  "    harshWins: game.counters.harshWins, kindWins: game.counters.kindWins, battles: game.counters.battles,",
  "    hp: game.player.hp + '/' + game.player.maxHp,",
  "    cards: ownedCards().map(function(id){return id+':'+cardLevel(id);}).join(','),",
  "    skipRatio: Math.round(ms.skipRatio*100)/100, blocksShown: ms.blocksShown, clicks: ms.clicks,",
  "  };",
  "}",

  // ── 3戦略を回す ───────────────────────────────
  "var R = {};",
  "R.cruel = playthrough('cruel', true);",   // 凶暴＋読み飛ばし
  "R.warm  = playthrough('warm', false);",   // 優しさ＋じっくり読む
  "R.gray  = playthrough('gray', false);",   // 混在

  "function line(k){ var r=R[k]; return k.toUpperCase()+': screen='+r.screen+' ending='+r.ending+' dark='+r.dark+' (凶暴'+r.kyoubou+'/優'+r.yasashisa+') wins(harsh'+r.harshWins+'/kind'+r.kindWins+'/全'+r.battles+') hp='+r.hp+' dead='+r.dead+' skipRatio='+r.skipRatio+' blocks='+r.blocksShown+' steps='+r.guard; }",
  "__out.push(line('cruel'));",
  "__out.push(line('warm'));",
  "__out.push(line('gray'));",
  "__out.push('cards(cruel): '+R.cruel.cards);",
  "__out.push('cards(warm):  '+R.warm.cards);",

  // ── 不変条件アサーション ──────────────────────
  "function ok(name, cond){ __out.push((cond?'PASS ':'FAIL ')+name); return cond; }",
  "var allPass = true;",
  "allPass &= ok('cruel ゴール到達(result)', R.cruel.screen==='result');",
  "allPass &= ok('warm  ゴール到達(result)', R.warm.screen==='result');",
  "allPass &= ok('gray  ゴール到達(result)', R.gray.screen==='result');",
  "allPass &= ok('cruel 結末=cruel', R.cruel.ending==='cruel');",
  "allPass &= ok('warm  結末=warm',  R.warm.ending==='warm');",
  "allPass &= ok('gray  結末=gray',  R.gray.ending==='gray');",
  "allPass &= ok('cruel ダーク化(dark>=2)', R.cruel.dark>=2);",
  "allPass &= ok('warm  途中で死なない(救いルート成立)', R.warm.dead===false);",
  "allPass &= ok('warm  ダークに傾かない(dark<=1)', R.warm.dark<=1);",
  "allPass &= ok('skip計測: cruel(飛ばし) > warm(読む)', R.cruel.skipRatio > R.warm.skipRatio);",
  "allPass &= ok('cruel は harsh勝ちが主, warm は kind勝ちが主', R.cruel.harshWins>=R.cruel.kindWins && R.warm.kindWins>=R.warm.harshWins);",

  "__out.unshift(allPass ? 'PLAYTHROUGH OK' : 'PLAYTHROUGH FAIL');",
  "return __out.join('\\n');"
].join("\n");

var output;
try {
  // IIFE で包む（ui.js は読まないが、$ など名前衝突の保険。headless-check と同流儀）。
  output = eval("(function(){\n" + src + "\n" + drive + "\n})()");
} catch (e) {
  output = "PLAYTHROUGH ERROR: " + e + (e.line ? (" (line " + e.line + ")") : "");
}
output;
