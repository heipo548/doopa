/*
 * ui-syntax-check.js — DOM依存（audio/field/ui/main）の構文＆参照チェック（Node不要・JXA）
 *
 * なぜ：ui.js / audio.js / field.js / main.js は document/window/AudioContext/rAF に依存するため、
 *   headless-check.js（コアのみ）では読めない。ここでは最小の DOM スタブを用意して
 *   全ファイルを読み込み、各画面（app.screen）の描画関数・演出を実際に呼び、ReferenceError や
 *   関数の打ち間違い（creatureSVG / battleCommandList / nodePassable / metricsSummary 等）を検出する。
 *   ※見た目の正しさは検証しない（それは実機）。あくまで「JSが落ちない」ことの確認。
 *   02-saigo-no-tomodachi の ui-syntax-check.js の流儀を厳密に踏襲する：
 *     ・ObjC.import('Foundation') ＋ readFile
 *     ・index.html と同じ読み込み順で cwd/js/ を全ファイル読む
 *     ・最小 DOM/Window スタブ＋全ソース＋ドライバを“1つの IIFE”で eval（ui.js の function $() が
 *       JXA グローバル $（Objective-C ブリッジ）と衝突しないよう関数スコープに包む）
 *     ・先頭は "UI/AUDIO/MAIN OK"。
 *
 * 使い方： osascript -l JavaScript prototypes/03-word-to-world/tools/ui-syntax-check.js
 */
ObjC.import('Foundation');

function readFile(p) {
  return $.NSString.stringWithContentsOfFileEncodingError(p, 4, null).js;
}

var cwd = $.NSFileManager.defaultManager.currentDirectoryPath.js;
var base = cwd + "/js/";
// index.html と同じ読み込み順：data → audio → metrics → state → save → battle → cards → field → ui → main
var files = ["data.js", "audio.js", "metrics.js", "state.js", "save.js", "battle.js", "cards.js", "field.js", "ui.js", "main.js"];
var src = files.map(function (f) { return readFile(base + f); }).join("\n");

// ── 最小 DOM/Window スタブ ─────────────────────────────
//   ・__el()：あらゆる DOM 操作を吸収する“何でも要素”。innerHTML/textContent は getter/setter で保持。
//     querySelector/querySelectorAll は子も __el を返し、forEach 可能な配列を返す（playFx の走査用）。
//     getBoundingClientRect は数値矩形を返す（field の getBoundingClientRect / captureEnemyRect 用）。
//   ・classList.toggle は applyScreen が第2引数つきで呼ぶので可変長で受ける。
//   ・document.body は classList を持つ実体（applyDark が dark-N を付け外しする）。
//   ・window.AudioContext を undefined にして initAudio を無音素通りさせる（音は実機でのみ）。
//   ・requestAnimationFrame は“呼ばれても回さない”noop（main の rAF ループを起こさない）。
//   ・setTimeout はコールバックを“その場で”実行＝遅延演出(playFx の stagger 等)の参照エラーも検出。
var stub = [
  "function __el(){ var e={ _h:'', _t:'', style:{ setProperty:function(){} }, dataset:{}, disabled:false, scrollTop:0, scrollHeight:0,",
  "  classList:{ add:function(){}, remove:function(){}, contains:function(){return false;}, toggle:function(){} },",
  "  setAttribute:function(){}, getAttribute:function(){return null;},",
  "  addEventListener:function(){}, removeEventListener:function(){},",
  "  appendChild:function(c){return c;}, removeChild:function(){}, remove:function(){},",
  "  closest:function(){return null;}, focus:function(){},",
  "  querySelector:function(){return __el();}, querySelectorAll:function(){return [];},",
  "  getBoundingClientRect:function(){return {left:0,top:0,width:100,height:60,right:100,bottom:60};} };",
  "  e.onclick=null;",
  "  Object.defineProperty(e,'innerHTML',{get:function(){return e._h;},set:function(v){e._h=v;}});",
  "  Object.defineProperty(e,'textContent',{get:function(){return e._t;},set:function(v){e._t=v;}});",
  "  return e; }",
  "var document={ getElementById:function(){return __el();}, createElement:function(){return __el();},",
  "  querySelector:function(){return __el();}, querySelectorAll:function(){return [];},",
  "  body:__el(), addEventListener:function(){} };",
  "var window={ addEventListener:function(){}, AudioContext:undefined, webkitAudioContext:undefined };",
  "function requestAnimationFrame(){ return 0; } function cancelAnimationFrame(){}",
  "function setTimeout(fn){ if(typeof fn==='function'){ try{ fn(); }catch(e){} } return 0; }",
  "function clearTimeout(){} function setInterval(){return 0;} function clearInterval(){}",
  // localStorage：save.js が hasSave/saveGame で触る。メモリ連想配列で代用（往復は headless 側で検証）。
  "var localStorage=(function(){var _m={};return{ get length(){return Object.keys(_m).length;}, key:function(i){return Object.keys(_m)[i];}, getItem:function(k){return Object.prototype.hasOwnProperty.call(_m,k)?_m[k]:null;}, setItem:function(k,v){_m[k]=String(v);}, removeItem:function(k){delete _m[k];} };})();",
].join("\n");

// ── 各画面・演出を実際に呼んで、落ちないか確認する ──
var drive = [
  "var __o=[];",

  // ── タイトル：renderTitle は game 未生成でも描ける（実機もタイトルは静的HTML＋renderTitleのみ）。
  //   ※ render() 経由は applyDark→darkLevel→game.player を読むため、タイトル時点（game=null）では
  //     実機同様に呼ばない。タイトル描画関数そのものの健全性だけを確かめる。
  "app.screen='title'; renderTitle(); __o.push('renderTitle (game未生成) ok');",

  // ── newGame → 以降は render() 経由で各画面を順に（applyDark が game.player.tendency を読むため newGame 必須）。
  "newGame(); render(); __o.push('render title (newGame後) ok');",

  // ── フィールド：enterArea で道を組み、fieldStep を手で数フレーム回して node 接近→render を通す。
  "enterArea('mura'); __o.push('enterArea mura ok (screen=' + app.screen + ', nodes=' + field.nodes.length + ')');",
  "fieldSetTarget(1, 0.45);",
  "var __g=0; while(app.screen==='field' && __g++ < 400){ fieldStep(__g*16.7); }",
  "__o.push('field walk ok (x=' + (Math.round(field.x*100)/100) + ', 何か発火して screen=' + app.screen + ')');",
  "app.screen='field'; backToField(); render(); __o.push('render field (backToField) ok');",

  // ── 会話：NPC 会話状態を作って renderDialogue（typeInto→finishTyping→metrics 計測経路）を通す。
  "game.dialogue = startNpcDialogue('hanako'); app.screen='dialogue'; render(); __o.push('render dialogue ok (name=' + (game.dialogue?game.dialogue.name:'?') + ')');",

  // ── バトル：startBattle → renderBattle（精神HP/プレイヤーhp/コマンドバー）。思いやりは描かれない。
  "startBattle('villageChief'); render(); __o.push('render battle ok (enemy=' + game.battle.enemy.name + ', mindHp=' + game.battle.enemy.mindHp + ')');",
  // onSayWord 相当：実際に harsh を1手撃って render→playFx の一連（被弾数字/揺れ/吹き出し）を通す。
  "onSayWord('baka'); __o.push('onSayWord(baka) ok (mindHp=' + game.battle.enemy.mindHp + ', phase=' + game.battle.phase + ')');",
  // kind も1手（calm 演出・思いやりは数値を出さない）。
  "if(game.battle && game.battle.phase==='player'){ onSayWord('arigatou'); } __o.push('onSayWord(arigatou) ok');",

  // ── playFx 全イベントを直接 game.fx に積んで一括描画（battle.js が積みうる種類を網羅）──
  //   speak(harsh/kind) / hit(被弾・撃破) / calm / pheal / learn(gift) / dark(翳りパルス) /
  //   win(kind=温度光 / harsh) / pdmg(プレイヤー被弾) / lose。setTimeout 即時実行で遅延経路も踏む。
  "startBattle('kojika');",
  "var __uid = game.battle.enemy.id;",
  "game.fx = [",
  "  { t:'speak', text:'ばーか', cat:'harsh' },",
  "  { t:'speak', text:'ありがとう', cat:'kind' },",
  "  { t:'hit', dmg:12, mindHp:6, mindHpMax:18 },",
  "  { t:'hit', dmg:20, mindHp:0, mindHpMax:18 },",   // 撃破（deadPoof 経路）
  "  { t:'calm' },",
  "  { t:'pheal', amount:3 },",
  "  { t:'soften', uid:__uid },",   // lowerAtk＝とげが引っ込む（新fx）
  "  { t:'recoil', uid:__uid },",   // harshヒット後の敵リコイル（新fx）
  "  { t:'learn', text:'だいじょうぶ' },",
  "  { t:'dark' },",
  "  { t:'win', kind:true },",
  "  { t:'win', kind:false },",
  "  { t:'pdmg', dmg:4 },",
  "  { t:'lose' }",
  "];",
  "playFx({}); __o.push('playFx 全イベント(speak・hit・撃破・calm・pheal・soften・recoil・learn・dark・win両方・pdmg・lose) ok');",

  // ── 敵反応の段階化（pickLineByProgress）と 敵スプライト直下のセリフ表示／表情の omoiyari 連動 ──
  "newGame(); startBattle('villain');",
  "__o.push('pickLineByProgress: 0%=' + JSON.stringify(pickLineByProgress(ENEMIES.villain.lines.onKind,0)) + ' 50%=' + JSON.stringify(pickLineByProgress(ENEMIES.villain.lines.onKind,0.5)) + ' 100%=' + JSON.stringify(pickLineByProgress(ENEMIES.villain.lines.onKind,1)) + ' 段階差? ' + (pickLineByProgress(ENEMIES.villain.lines.onKind,0)!==pickLineByProgress(ENEMIES.villain.lines.onKind,1)));",
  "game.battle.enemy.omoiyari = game.battle.enemy.omoiyariNeed; game.battle.lastReact='……ありがとう。'; game.battle.lastReactKind=true; render(); var __ehtml=document.getElementById('enemy-area').innerHTML; __o.push('敵反応表示＆表情ほどけ ok (思いやり満タンで omoiyari数値は出さない? ' + !/思いやり|omoiyari/i.test(__ehtml) + ')');",

  // ── 3択カード：offerCards → renderCards（harsh/kind 色分け・トレードオフ文）。
  "offerCards({ from:'field', reason:'win' }); render(); __o.push('render cards ok (pending=' + (game.pendingCards?game.pendingCards.length:0) + ')');",
  // onPickCard：pickCard → トースト → backToField の経路（添字0を選ぶ）。
  "if(game.pendingCards && game.pendingCards.length){ onPickCard(0); } __o.push('onPickCard ok (screen=' + app.screen + ')');",

  // ── ショップ：renderShop（SHOP.words を並べる）→ onShopBuy（1語を pool に絞って cards へ）。
  "app.screen='shop'; render(); __o.push('render shop ok');",
  "onShopBuy('issho'); render(); __o.push('onShopBuy ok (screen=' + app.screen + ', pending=' + (game.pendingCards?game.pendingCards.length:0) + ')');",

  // ── 結末：determineEnding で game.ending を確定 → renderResult（typewriter で本文）。
  "newGame(); game.player.tendency.yasashisa=9; game.player.tendency.kyoubou=1; determineEnding(); game.lastWord='arigatou'; app.screen='result'; render(); __o.push('render result ok (ending=' + (game.ending?game.ending.id:'?') + ')');",

  // ── メタ：神様的存在が metricsSummary を提示 → 綴り WO_RD に L を差し込み WORLD を見せる。
  //   skip 高/低・click 高/低 の両分岐を踏むため、metrics を作ってから renderMeta を複数回叩く。
  "startMetrics(); metrics.blocksShown=10; metrics.blocksSkipped=6; metrics.skips=6; metrics.clicks=80; metrics.dwellTotalMs=1000;",
  "game.metaUi=null; app.screen='meta'; render(); __o.push('render meta (skip高/click高) ok');",
  // 台本を最後まで送り切り、綴りアニメ（worldLineIndex 到達＝WORLD 表示）まで踏ませる。
  "var __m=0; while(game.metaUi && game.metaUi.i < 30 && __m++ < 60){ var __pi=game.metaUi.i; advanceText(); if(game.metaUi.i===__pi) break; }",
  "__o.push('meta 台本送り ok (metaUi.i=' + (game.metaUi?game.metaUi.i:'?') + ')');",
  // skip 低/click 低 の分岐も描く。
  "metrics.blocksShown=10; metrics.blocksSkipped=1; metrics.skips=1; metrics.clicks=5; game.metaUi=null; renderMeta(); __o.push('render meta (skip低/click低) ok');",

  // ── ポーズ：renderPause（つづける/セーブ/ミュート/タイトルへ）。戻り先(field/battle)を覚えて開く。
  "newGame(); enterArea('mura'); game._pauseReturn='field'; app.screen='pause'; render(); __o.push('render pause(field) ok');",
  "newGame(); startBattle('kojika'); game._pauseReturn='battle'; app.screen='pause'; render(); __o.push('render pause(battle) ok');",

  // ── メタの締め：台本最後で showMetaEnd（周回示唆＋もう一度/タイトルへ）。world-done 発光。
  "newGame(); startMetrics(); game.metaUi={i:999}; app.screen='meta'; renderMeta(); showMetaEnd(); __o.push('meta end (周回示唆＋導線) ok');",

  // ── ゲームオーバー：敵ターンで hp を 0 にして onGameOver → renderGameover（やりなおす/タイトルへ）。
  "newGame(); startBattle('villain'); game.player.hp=1; enemyTurn(); __o.push('onGameOver 遷移 ok (state=' + game.state + ', screen=' + app.screen + ')'); render(); __o.push('render gameover ok');",
  // タイトルへ戻す共通処理（dark/tone を剥がして title へ）。
  "goToTitle(); __o.push('goToTitle ok (screen=' + app.screen + ')');",

  // ── 全 shape × 全 expr のピクセルスプライトが壊れず生成されるか（rect 数で簡易検証）──
  "['robot','villager','circle','ghost','bunny','boss'].forEach(function(sh){ ['neutral','happy','sad','unstable'].forEach(function(ex){ var s=creatureSVG('#8f9ee0',sh,ex); if(!/^<svg/.test(s) || (s.match(/<rect/g)||[]).length < 12) throw 'sprite broken: '+sh+'/'+ex+' (rects=' + ((s.match(/<rect/g)||[]).length) + ')'; }); });",
  "__o.push('sprites: 全shape(robot/villager/circle/ghost/bunny/boss)×表情(neutral/happy/sad/unstable) 生成OK');",
  // L 専用スプライト（翳ると unstable 顔）。
  "newGame(); var __pNorm=playerSVG('neutral'); game.player.tendency.kyoubou=BALANCE.darkenAt[0]+1; ui.lastDark=-1; var __pDark=playerSVG('neutral'); __o.push('playerSVG ダーク化 ok (isUnstable=' + isUnstable() + ', 翳り顔が別物? ' + (__pNorm !== __pDark) + ')');",

  // ── 音まわり：initAudio（AudioContext 無しでも素通り）→ playSe 全名 → playBgm 全テーマ → setTone。
  "initAudio(); ['select','harsh','kind','hit','calm','win','lose','page'].forEach(function(n){ playSe(n); }); ['village','cave','meta'].forEach(function(b){ playBgm(b); }); setTone(0); setTone(3); stopBgm(); var __mz=toggleMute(); toggleMute(); __o.push('audio: playSe/playBgm/setTone/stopBgm/toggleMute ok (muted toggled=' + (typeof __mz==='boolean') + ')');",

  // ── main の入口：startGame / continueGame が落ちずに走るか（DOMContentLoaded は発火しないので直接呼ぶ）。
  "startGame(); __o.push('startGame ok (screen=' + app.screen + ')');",
  "var __cg = continueGame; __o.push('continueGame 関数 ok? ' + (typeof __cg==='function'));",

  "return __o.join('\\n');"
].join("\n");

// すべて IIFE の中で eval する。理由：ui.js は `function $(id){…}` を宣言するが、
//   JXA のグローバル `$`（Objective-C ブリッジ）は再定義できない。関数スコープに包めば
//   ゲーム側の `$` はローカルになり衝突しない（ブラウザ実機の挙動とも一致）。
var program = "(function(){\n" + stub + "\n" + src + "\n" + drive + "\n})()";

var output;
try {
  output = "UI/AUDIO/MAIN OK\n" + eval(program);
} catch (e) {
  output = "UI CHECK ERROR: " + e + (e.line ? (" (line " + e.line + ")") : "");
}
output;
