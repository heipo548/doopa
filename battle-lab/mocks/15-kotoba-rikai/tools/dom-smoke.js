/*
 * dom-smoke.js — UI配線の自動点検（依存ゼロ・JXA / Node 両対応）
 *
 * ブラウザを開かずに「ui.js / main.js が参照する要素ID」が index.html に
 * 実在するか、選択肢カテゴリに対応する CSS クラスが style.css にあるかを点検する。
 * （DOMの“契約”がズレる＝getElementById で null を踏む、という最頻バグを早期に潰す）
 *
 * 使い方：
 *   ・macOS（JXA）：MOCKDIR="$PWD" osascript -l JavaScript tools/dom-smoke.js
 *   ・Node         ：node tools/dom-smoke.js
 */

/* ── 環境判定とファイル読み込み（JXA / Node 両対応）── */
var isNode = (typeof process !== 'undefined' && process.versions && process.versions.node);
var readFile, base;

if (isNode) {
  var fs = require('fs'), path = require('path');
  base = (process.env.MOCKDIR || path.resolve(__dirname, '..')) + path.sep;
  readFile = function (rel) { return fs.readFileSync(base + rel.replace(/\//g, path.sep), 'utf8'); };
} else {
  ObjC.import('Foundation');
  var env = $.NSProcessInfo.processInfo.environment.js;
  base = (env['MOCKDIR'] ? env['MOCKDIR'].js : $.NSFileManager.defaultManager.currentDirectoryPath.js);
  if (base.charAt(base.length - 1) !== '/') base += '/';
  readFile = function (rel) { return $.NSString.stringWithContentsOfFileEncodingError(base + rel, 4, null).js; };
}

var html = readFile('index.html');
var uiSrc = readFile('js/ui.js');
var mainSrc = readFile('js/main.js');
var css = readFile('style.css');
var dataSrc = readFile('js/data.js');

var passed = 0, failed = 0, lines = [];
function ok(cond, label) { if (cond) { passed++; lines.push('  PASS ' + label); } else { failed++; lines.push('  FAIL ' + label); } }

/* ── index.html が定義する id を集める ── */
function matchAll(src, re) { var m, out = []; while ((m = re.exec(src)) !== null) out.push(m[1]); return out; }
var definedIds = {};
matchAll(html, /id="([^"]+)"/g).forEach(function (id) { definedIds[id] = true; });

/* ── ui.js / main.js が getElementById で参照する id（文字列リテラルのみ）── */
var referenced = {};
matchAll(uiSrc + '\n' + mainSrc, /getElementById\(['"]([^'"]+)['"]\)/g).forEach(function (id) { referenced[id] = true; });

/* ── 動的に生成される id（コードが createElement で作る）は除外 ── */
var dynamicIds = { 'tutor-bar': 1, 'tutor-objective': 1, 'tutor-overlay': 1, 'tutor-terms': 1, 'bgm-btn': 1 };

var missing = [];
Object.keys(referenced).forEach(function (id) {
  if (!definedIds[id] && !dynamicIds[id]) missing.push(id);
});
ok(missing.length === 0, 'getElementById の参照IDが index.html に実在する' + (missing.length ? '（不足: ' + missing.join(', ') + '）' : ''));

/* ── 主要IDが揃っているか（最低限の契約）── */
['enemy-name', 'enemy-face', 'enemy-look', 'enemy-states', 'und-fill', 'und-word',
 'alert-fill', 'alert-word', 'comp-fill', 'comp-word', 'choices', 'log',
 'overlay', 'overlay-title', 'overlay-text', 'reward', 'restart-btn', 'next-enc-btn', 'mock-intro'
].forEach(function (id) { ok(definedIds[id], '必須ID: ' + id); });

/* ── スクリプトの読み込み順（data→engine→audio→tutor→ui→main）── */
var order = ['js/data.js', 'js/engine.js', 'js/audio.js', 'js/tutor.js', 'js/ui.js', 'js/main.js'];
var pos = order.map(function (f) { return html.indexOf(f); });
var ordered = pos.every(function (p, i) { return p >= 0 && (i === 0 || p > pos[i - 1]); });
ok(ordered, 'script の読み込み順が data→engine→audio→tutor→ui→main');

/* ── 選択肢カテゴリ（data.js の CATEGORIES キー）に対応する CSS クラスがある ── */
var catKeys = matchAll(dataSrc, /\b(kiku|uketomeru|tsutaeru|kansatsu|kyori|sashidasu):\s*\{\s*key:'/g);
// CATEGORIES の6キーを直接確認
['kiku', 'uketomeru', 'tsutaeru', 'kansatsu', 'kyori', 'sashidasu'].forEach(function (k) {
  ok(css.indexOf('.choice.cat-' + k) >= 0, 'CSS: .choice.cat-' + k + ' が style.css にある');
});

/* ── tutor.css / style.css が index.html から読み込まれている ── */
ok(html.indexOf('style.css') >= 0 && html.indexOf('tutor.css') >= 0, 'style.css と tutor.css を読み込んでいる');

/* ── レポート ── */
var header = '=== Battle 15 dom-smoke（UI配線の点検）===';
var footer = (failed === 0) ? ('PASS — ' + passed + '件すべてOK') : ('FAIL — ' + failed + '件 失敗 / ' + passed + '件 成功');
var report = [header].concat(lines).concat([footer]).join('\n');
if (typeof console !== 'undefined' && console.log) console.log(report);
else $.NSFileHandle.fileHandleWithStandardOutput.writeData($.NSString.alloc.initWithString(report + '\n').dataUsingEncoding(4));
