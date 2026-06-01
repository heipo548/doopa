/*
 * headless-check.js — DOM非依存コア(data/state/battle/cards)の回帰確認（Node不要）
 *
 * なぜ：このPCはNode無しなので、JXA(osascript -l JavaScript)で“画面なし”の中核だけを
 *       読み込んで動かし、構文エラーや関数欠落（きずな等）を素早く検出する。
 * 使い方： osascript -l JavaScript prototypes/02-saigo-no-tomodachi/tools/headless-check.js
 *         （カレントは prototype のルートを想定。js/ を相対で読む）
 */
ObjC.import('Foundation');

function readFile(p) {
  // Foundationでファイルを読む（4 = NSUTF8StringEncoding）
  return $.NSString.stringWithContentsOfFileEncodingError(p, 4, null).js;
}

// カレントディレクトリ基準で js/ を読む（リポジトリのどこに置いても動くように）
var cwd = $.NSFileManager.defaultManager.currentDirectoryPath.js;
var base = cwd + "/js/";
var files = ["data.js", "state.js", "battle.js", "cards.js"]; // audio/ui/main は DOM依存なので除外

// 4ファイル＋テストコードを“1つの文字列”にして一度に eval する。
// 理由：const/let は eval ブロック内スコープなので、テストも同じ eval 文字列の中に書くと
//       game / BALANCE / 各関数を参照できる（別々に eval すると見えなくなる）。
var src = files.map(function (f) { return readFile(base + f); }).join("\n");

var test = [
  "var __o = [];",
  "newGame();",
  "__o.push('newGame: hp=' + game.player.hp + ' kokoro=' + game.player.kokoro);",
  "startWave();",
  "__o.push('startWave: enemies=' + game.enemies.length + ' state=' + game.state);",
  "__o.push('bondReduction exists: ' + (typeof bondReduction === 'function'));",
  "__o.push('bond@0save=' + bondReduction());",
  "game.counters.save = 3;",
  "__o.push('bond@3save=' + bondReduction() + ' (期待: min(bondReduceMax, 3*perSave))');",
  "game.counters.save = 99;",
  "__o.push('bond@99save=' + bondReduction() + ' (上限キャップ確認)');",
  "__o.push('ending(0.1)=' + determineEnding(0.1).id);",
  "__o.push('ending(0.5)=' + determineEnding(0.5).id);",
  "__o.push('ending(0.9)=' + determineEnding(0.9).id);",
  "__o.push('AoE hikari perLv=' + (WEAPONS.hikari ? WEAPONS.hikari.perLv : 'NA') + ' daikouzui power=' + (WEAPONS.daikouzui ? WEAPONS.daikouzui.power : 'NA'));",

  // ── ソフトロック修正の再現テスト（純・救いルートの詰み解消）──
  // 「おだやかな友(壁0)しか残らず・こころ0」の状況を作り、敵ターンを回すと
  // calmKokoroRegen ぶん こころが戻ることを確認する（待てば救える＝詰まない の根拠）。
  "newGame(); startWave();",
  "game.enemies.forEach(function(e){ e.wall = 0; });",  // 全敵を おだやか(壁0)=被弾0 に
  "game.player.kokoro = 0;",                             // こころ枯れ（途中で燃料切れの再現）
  "var __k0 = game.player.kokoro;",
  "runEnemyTurn();",                                     // 静かな夜の敵ターン
  "__o.push('calmRegen: kokoro ' + __k0 + ' -> ' + game.player.kokoro + ' (期待: +' + BALANCE.calmKokoroRegen + ', max ' + game.player.maxKokoro + ')');",
  "__o.push('calmRegen OK? ' + (game.player.kokoro === Math.min(game.player.maxKokoro, __k0 + BALANCE.calmKokoroRegen)));",
  // 被弾しているターンは回復しないこと（祓う即殺の優位を壊さない）も確認：
  // 敵を1体だけ壁ありに戻し、こころを0にしてから敵ターン→ regen しない想定。
  "newGame(); startWave();",
  "game.enemies.forEach(function(e){ e.wall = 0; });",
  "if (game.enemies[0]) game.enemies[0].wall = 5;",      // 1体だけ壁あり＝殴ってくる
  "game.player.kokoro = 0;",
  "var __k1 = game.player.kokoro;",
  "runEnemyTurn();",
  "__o.push('hitTurnNoRegen OK? ' + (game.player.kokoro === __k1) + ' (被弾ターンは回復しない / kokoro=' + game.player.kokoro + ')');",

  "__o.join('\\n');"
].join("\n");

var output;
try {
  output = "CORE OK\n" + eval(src + "\n" + test);
} catch (e) {
  output = "CORE ERROR: " + e;
}
output; // osascript が最後の式を出力する
