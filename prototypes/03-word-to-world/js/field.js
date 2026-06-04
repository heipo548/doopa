/*
 * field.js — フィールド（ポップな村／不穏な洞窟の“道”をマウス追従で歩く）
 *
 * このゲームの「移動」は、矢印キーではなくマウスカーソル追従だけで行う
 * （02-saigo-no-tomodachi の流儀：指数ダンプ lerp ＋ 最高速 clamp ＋ デッドゾーン）。
 * 道の上に置かれた node（npc/enemy/sign/save/school/boss/exit）に十分近づくと
 * “発火”し、会話・戦闘・ショップ・セーブ・立て札・次エリアへの遷移が起きる。
 *
 * ── 責務分離（state.js のコメントが宣言した通り）──
 *   ・実際の戦闘処理 → battle.js（ここは startBattle を呼ぶだけ）
 *   ・3択カード     → cards.js（ここは offerCards を呼ぶだけ）
 *   ・結末の文面決定 → state.js の determineEnding（ここは“いつ呼ぶか”だけ持つ）
 *   ・描画          → ui.js の render()（このファイルは DOM を直接いじらない）
 * このファイルが持つのは「いまどのエリアの・どこに居て・どこへ向かうか」だけ。
 *
 * ※ ビルドなし・依存ゼロで file:// から動かすため ES Modules は使わない。
 *   普通の <script> として読み込み、window 直書きで共有する
 *   （…→ save.js → battle.js → cards.js → field.js → ui.js → main.js の順）。
 *   末尾で window へ明示エクスポートする。
 *
 * ※ 他ファイル（battle.js / cards.js / save.js / ui.js / audio.js）はまだ無い場面でも
 *   このファイル単体が落ちないよう、外部関数の呼び出しは必ず typeof ガードで包む
 *   （02 の field.js と同じ“呼べたら呼ぶ”流儀。検証チェッカで単体 eval できる）。
 */

// ──────────────────────────────────────────
// グローバル field（現エリアの歩行状態）
//   道は 2D：x=進行方向(0..1, 右ほど先＝出口)、y=道の上下のばらつき(0..1, 0.5が中央)。
//   data.js の node.x / node.y も 0..1 なので、同じ座標系で近接判定できる。
//   ★思いやりゲージ同様、この座標は“見える化”の都合だけ。ゲーム本体の傾向には影響しない。
// ──────────────────────────────────────────
const field = {
  areaId: null,       // いま歩いているエリアid（AREAS のキー）。
  nodes: [],          // このエリアの node 配列（data.js の AREAS[id].nodes をそのまま参照）。
  x: 0.02,            // L（主人公）の横位置 0..1。入口=ほぼ左端から始める。
  y: 0.5,             // L の縦位置 0..1。0.5＝道の中央。
  targetX: 0.02,      // マウスが指す目標 横位置（fieldSetTarget が更新）。
  targetY: 0.5,       // マウスが指す目標 縦位置。
  paused: false,      // 会話/戦闘/ショップ等へ抜けている間は追従を止める。
  message: "",        // 足元に出す短い案内（立て札の本文や状況説明）。
  _raf: null,         // requestAnimationFrame ハンドル（追従ループ）。
  _lastT: 0,          // 直近フレーム時刻（dt 補正＝フレームレート非依存にするため）。
  _maxv: 0.6,         // 最高速（割合/秒）。瞬間ワープ防止の clamp 基準。
};

// 追従パラメータ（Webの定石：指数ダンプ lerp ＋ デッドゾーン ＋ 最高速 clamp）。
//   02 の値を踏襲。FOLLOW は 60fps 基準の追従率で、dt 補正して端末非依存にする。
const FOLLOW = 0.16;        // 追従の強さ（0.12〜0.20 が“ぬるっと気持ちいい”帯）。
const DEADZONE = 0.01;      // 微振動止め（このぶん以内は動かさない）。
                            //   到達判定(R_NODE)はこれより十分外側にして“詰み”を防ぐ。
const R_NODE = 0.06;        // node に触れたとみなす近接半径（x,y とも 0..1 空間）。
const R_EXIT = 0.05;        // exit はやや手前から発火（右端で確実に踏める）。

// ──────────────────────────────────────────
// enterArea(areaId)：エリアに入る＝場を組み立てて FIELD へ
//   currentArea/state/app.screen を更新し、プレイヤーを入口（左端）に置く。BGM を切替。
//   再入場（負けてセーブから等）でも素直に作り直す＝歩行状態は毎回リセット。
// ──────────────────────────────────────────
function enterArea(areaId) {
  const area = (typeof AREAS !== "undefined") ? AREAS[areaId] : null;
  if (!area) return; // 未知エリアは無視（data.js を直接いじったときの事故防止）。

  // モデル側（進行）とビュー側（表示先）を両方そろえる。混同しないよう別物として持つ。
  if (game) game.currentArea = areaId;
  if (game) game.state = STATES.FIELD;
  app.screen = "field";

  // 歩行状態を初期化。node は data.js の配列をそのまま使う（_glow/_done だけ後付けする）。
  field.areaId = areaId;
  field.nodes = (area.nodes || []).map((n) => Object.assign({}, n, { _done: false, _glow: 0 }));
  field.x = 0.02; field.y = 0.5;          // 入口＝道の左端・中央から。
  field.targetX = field.x; field.targetY = field.y;
  field.paused = false;
  field._lastT = 0;
  field.message = area.name ? area.name + "。マウスで すすむ（みぎ＝さき）。" : "";

  // 一度きりのエリア導入ログ（既読なら出さない）。02 の seen と同じ間引き。
  if (game && game.seen && !game.seen["area_" + areaId]) {
    game.seen["area_" + areaId] = true;
    if (typeof log === "function") log(area.name + " に ついた。");
  }

  // BGM とトーン（darkLevel が高いほど翳る）を更新。audio.js が無くても落ちないよう guard。
  if (typeof playBgm === "function") playBgm(area.bgm || "village");
  if (typeof setTone === "function" && typeof darkLevel === "function") setTone(darkLevel());

  // window.game は参照渡しではないので、newGame 後の再代入慣習にならって同期しておく。
  if (typeof window !== "undefined") window.game = game;

  if (typeof render === "function") render();
  startFieldLoop(); // マウス追従アニメ開始（ブラウザのみ。検証は手動で fieldStep を回す）。
}

// ──────────────────────────────────────────
// fieldSetTarget(nx,ny)：マウス位置（道内の割合 0..1）→ 目標位置（必ずクランプ）
//   main.js の pointermove/pointerdown から呼ぶ。範囲外マウスでも 0..1 に丸める＝はみ出し防止。
//   ny 省略時は縦を据え置き（横だけ動かしたい呼び出しにも耐える後方互換）。
// ──────────────────────────────────────────
function fieldSetTarget(nx, ny) {
  if (app.screen !== "field" || field.paused) return;
  field.targetX = _clamp01(nx);
  if (typeof ny === "number") field.targetY = _clamp01(ny);
}

// 0..1 にクランプ（NaN は中央/原点側へ倒して安全側に）。
function _clamp01(v) {
  if (typeof v !== "number" || isNaN(v)) return 0;
  return v < 0 ? 0 : (v > 1 ? 1 : v);
}

// ──────────────────────────────────────────
// fieldStep(t)：1フレームぶん、L を (targetX,targetY) へ近づける（追従の本体）
//   t: ブラウザは requestAnimationFrame の timestamp（performance.now 相当）。
//      検証(JXA/Node なし)では未指定でも落ちないよう内部で補完する。
//   近づけたあと fieldCheckNodes() で node 発火を判定する。
// ──────────────────────────────────────────
function fieldStep(t) {
  if (app.screen !== "field" || field.paused) return;

  // 時刻補完：performance.now があれば使う。無ければ前フレーム＋1フレーム分とみなす。
  if (typeof t !== "number") {
    t = (typeof performance !== "undefined" && performance.now)
      ? performance.now() : (field._lastT + 16.7);
  }
  // dt は 50ms で上限クランプ＝タブ復帰時の“ワープ”暴走を防ぐ。
  const dt = field._lastT ? Math.min(t - field._lastT, 50) : 16.7;
  field._lastT = t;

  // フレームレート非依存の指数ダンプ係数（60fps基準を dt で補正）と、1フレーム最大移動量。
  const k = 1 - Math.pow(1 - FOLLOW, dt / (1000 / 60));
  const maxStep = field._maxv * dt / 1000;

  _stepAxis("x", "targetX", k, maxStep);
  _stepAxis("y", "targetY", k, maxStep);

  fieldCheckNodes();                 // 触れた node を発火（発火時はこの中で paused になる）。
  if (typeof render === "function") render(); // 軽い再描画は ui に任せる（02 は専用 paint だが流儀は同じ）。
}

// 1軸ぶんの追従（指数ダンプ＋最高速 clamp＋デッドゾーン）。x も y も 0..1 にクランプ。
function _stepAxis(ax, tgtKey, k, maxStep) {
  const cur = field[ax];
  const d = field[tgtKey] - cur;
  if (Math.abs(d) < DEADZONE) return;            // デッドゾーン内は動かさない（微振動止め）。
  let s = d * k;
  s = Math.max(-maxStep, Math.min(maxStep, s));  // 瞬間ワープ防止（等速感の保持）。
  field[ax] = _clamp01(cur + s);
}

// ──────────────────────────────────────────
// fieldCheckNodes()：近接した node を発火（最近接1件だけ＝同フレーム多重発火を防ぐ）
//   ・requires 未達の node は“通行不可”＝触れても発火しない（グレーアウトは ui 側）。
//   ・exit は requires（ボス撃破フラグ）が無いと進めない。
//   ・発火したら field.paused=true にして、その画面へ遷移する。
// ──────────────────────────────────────────
function fieldCheckNodes() {
  let best = null, bestD = Infinity;
  for (const n of field.nodes) {
    if (n._done) continue;

    // requires 未達は通行不可（触れても無反応）。グロー値だけ 0 にしておく。
    if (n.requires && !(typeof hasFlag === "function" && hasFlag(n.requires))) {
      n._glow = 0;
      continue;
    }

    const nx = (typeof n.x === "number") ? n.x : 0.5;
    const ny = (typeof n.y === "number") ? n.y : 0.5;
    const d = Math.sqrt((field.x - nx) * (field.x - nx) + (field.y - ny) * (field.y - ny));
    const R = (n.type === "exit") ? R_EXIT : R_NODE;

    // 近いほど 1 に近づくグロー値（ui がハイライトに使う＝“ここに行ける”の手触り）。
    n._glow = Math.max(0, 1 - d / R);
    if (d <= R && d < bestD) { best = n; bestD = d; }
  }
  if (best) fireNode(best);
}

// ──────────────────────────────────────────
// fireNode(node)：node 種別ごとの発火（契約の対応表をそのまま実装）
//   npc→dialogue / enemy・boss→startBattle / school→shop / save→saveGame /
//   sign→テキスト / exit→次エリア(requires 確認・dokutsu の出口は ENDING)。
//   多くは画面遷移なので、まず追従を止めて L をその場に固定する。
// ──────────────────────────────────────────
function fireNode(node) {
  switch (node.type) {

    // ── NPC：会話へ（話し終わると offerCards で 3択カード入手＝givesCard）──
    case "npc": {
      node._done = true;
      field.paused = true;
      game.dialogue = startNpcDialogue(node.ref); // 会話状態を作って ui に渡す（下で定義）。
      app.screen = "dialogue";
      if (typeof playSe === "function") playSe("page");
      if (typeof render === "function") render();
      break;
    }

    // ── 敵／ボス：戦闘へ（startBattle に委譲）──
    //   勝敗後の“フィールド復帰”や“フラグ立て”は onBattleResolved() が受ける。
    case "enemy":
    case "boss": {
      node._done = true;          // 同じ node で多重戦闘しない（撃破/再戦は別フラグ管理）。
      field.paused = true;
      field._pendingNode = node;  // この戦闘がどの node 由来か覚える（勝敗後のフラグ立てに使う）。
      stopFieldLoop();            // 追従アニメを止めてから戦闘へ。
      if (typeof startBattle === "function") {
        startBattle(node.ref, { from: "field", node: node });
      } else {
        // battle.js 未実装でも検証で落ちないように：素通り扱い（フィールドに留まる）。
        field.paused = false; startFieldLoop();
      }
      break;
    }

    // ── 学校＝ことばショップへ ──
    case "school": {
      field.paused = true;
      field._pendingNode = node;  // 戻り先（フィールド）を覚える。
      app.screen = "shop";
      if (typeof game !== "undefined" && game) game.shopRef = node.ref || "school";
      if (typeof playSe === "function") playSe("select");
      // save/sign と同じく、戻った瞬間に L が学校の上に立ったままで“即再入店”しないよう
      //   一旦 _done にし、その場から離れたら再点灯する（再訪は可能・連打発火だけ防ぐ）。
      node._done = true;
      _rearmNodeWhenAway(node);
      if (typeof render === "function") render();
      break;
    }

    // ── セーブ地点：その場でセーブしてトースト（画面遷移はしない）──
    //   delete はせず localStorage 上書きのみ（save.js の方針）。歩行は止めない。
    case "save": {
      let ok = false;
      if (typeof saveGame === "function") ok = !!saveGame(0); // 体験版は単一スロット運用。
      field.message = ok ? "ここまでを セーブした。" : "セーブできなかった…";
      if (typeof log === "function") log(field.message);
      if (typeof showToast === "function") showToast(field.message);
      if (typeof playSe === "function") playSe("calm");
      // すぐ再発火しないよう、いま居る save から少しでも離れるまで一時 _done 化する。
      node._done = true;
      _rearmNodeWhenAway(node);
      if (typeof render === "function") render();
      break;
    }

    // ── 立て札：本文を足元メッセージ＆ログに出す（読み物。歩行は止めない）──
    case "sign": {
      const text = (typeof SIGNS !== "undefined" && SIGNS[node.ref]) ? SIGNS[node.ref] : "…なにか 書いてある。";
      field.message = text;
      // typewriter 表示と読み飛ばし計測は ui 側。ここでは“何文字 提示したか”を metrics に伝える。
      //   ※ textShown は metrics.js の“グローバル関数”（metrics.textShown という method は無い）。
      if (typeof textShown === "function") {
        textShown(text.length);
      }
      if (typeof log === "function") log(text.replace(/\n/g, " "));
      if (typeof playSe === "function") playSe("page");
      node._done = true;
      _rearmNodeWhenAway(node); // 立て札は読み返せるよう、離れたら再点灯。
      if (typeof render === "function") render();
      break;
    }

    // ── 出口：次エリアへ（requires は上の通行不可判定で既に担保済み）──
    //   AREAS[area].next が次のエリア。next が null（dokutsu）なら結末＝ENDING へ。
    case "exit": {
      node._done = true;
      field.paused = true;
      stopFieldLoop();
      goToNextArea();
      break;
    }

    default:
      // 未知 type は無視（data.js 追加に備えた安全側）。歩行は続行。
      break;
  }
}

// ──────────────────────────────────────────
// NPC 会話の状態づくり（dialogue 画面が読む）
//   data.js の NPCS[id].dialogue（行配列）と givesCard を渡すだけ。会話送りは ui.js。
//   会話を最後まで送り終えたら endNpcDialogue() が呼ばれる（givesCard なら offerCards）。
// ──────────────────────────────────────────
function startNpcDialogue(npcId) {
  const npc = (typeof NPCS !== "undefined") ? NPCS[npcId] : null;
  return {
    npcId: npcId,
    name: npc ? npc.name : "？",
    shape: npc ? npc.shape : "villager",
    color: npc ? npc.color : "#cccccc",
    lines: npc ? (npc.dialogue || []) : [],
    index: 0,                         // 何行目まで読んだか（ui が進める）。
    givesCard: !!(npc && npc.givesCard),
  };
}

// 会話の終わり。givesCard なら 3択カードへ、そうでなければフィールドに戻る。
//   ui の typewriter が最終行を送り切ったら呼ぶ想定（ここは“次に何をするか”だけ持つ）。
function endNpcDialogue() {
  const d = game ? game.dialogue : null;
  game && (game.dialogue = null);
  if (d && d.givesCard && typeof offerCards === "function") {
    // 入手イベント由来＝戻り先はフィールド。cards.js が app.screen="cards" にする。
    field._pendingNode = field._pendingNode || { type: "npc", returnTo: "field" };
    offerCards({ from: "field", reason: "npc" });
  } else {
    backToField();
  }
}

// ──────────────────────────────────────────
// onBattleResolved — ★現状どこからも呼ばれていない「予約フック」。
//   実際の決着処理（ボス撃破フラグ立て→報酬3択→ピック後 backToField で復帰）は
//   battle.js の winBattle() と ui.onPickCard() 側で完結している（そちらが正典）。
//   ここは将来「戦闘結果をフィールド側で受けて演出を足したい」場合の差し込み口として残す
//   （削除しない＝拡張の余地。呼ぶ場合は winBattle のフラグ立てと二重にならないよう注意）。
// ──────────────────────────────────────────
function onBattleResolved(result) {
  const node = field._pendingNode || (result && result.node) || null;
  field._pendingNode = null;

  // ボス撃破フラグ：data.js の exit.requires と対応づける（mura→mura_boss / dokutsu→dokutsu_boss）。
  if (node && node.type === "boss") {
    const areaId = field.areaId;
    const flagByArea = { mura: "mura_boss", dokutsu: "dokutsu_boss" };
    const flag = flagByArea[areaId];
    if (flag && typeof setFlag === "function") {
      setFlag(flag);
      if (typeof log === "function") log("出口が ひらいた。");
    }
  }
  // 翳り（darkLevel）が進んでいれば BGM/トーンを翳らせ直す（harsh で押し切ったランの可視化）。
  if (typeof setTone === "function" && typeof darkLevel === "function") setTone(darkLevel());

  // 報酬3択を battle.js 側が出していなければ、ここでフィールドへ復帰させる保険。
  if (app.screen !== "cards") backToField();
}

// ──────────────────────────────────────────
// 出口処理：次エリア or 結末
//   AREAS[現エリア].next を見て分岐。
//   ・next があれば enterArea(next)（村→洞窟）。
//   ・next が null（dokutsu）＝体験版の終端。ここが署名どおり determineEnding→ENDING→result。
// ──────────────────────────────────────────
function goToNextArea() {
  const area = (typeof AREAS !== "undefined") ? AREAS[field.areaId] : null;
  const next = area ? area.next : null;

  if (next && (typeof AREAS !== "undefined") && AREAS[next]) {
    if (typeof log === "function") log("つぎの ばしょへ……");
    enterArea(next);
    return;
  }

  // next が無い＝最後のエリア（洞窟）を抜けた＝結末へ。
  //   契約：dokutsu のボス撃破後は determineEnding→game.state=ENDING→app.screen=result。
  if (typeof determineEnding === "function") determineEnding(); // game.ending を確定。
  if (game) game.state = STATES.ENDING;
  app.screen = "result";
  if (typeof window !== "undefined") window.game = game;

  // 結末トーン（cruel/gray/warm）で BGM を寄せる。audio が無くても落ちない。
  const tone = (game && game.ending) ? game.ending.tone : "gray";
  if (typeof playBgm === "function") playBgm("meta"); // 結末→メタへ向かう静かな曲。
  if (typeof setTone === "function" && typeof darkLevel === "function") setTone(darkLevel());
  if (typeof log === "function" && game && game.ending) log("――" + game.ending.title);
  if (typeof render === "function") render();
}

// ──────────────────────────────────────────
// 各画面から「フィールドに戻る」共通処理
//   会話/ショップ/カード後にここへ。state を FIELD・screen を field に戻し、追従を再開。
//   いまの位置を目標の下限にして、戻った瞬間ぽちが固まらないようにする（02 の fieldResume 流儀）。
// ──────────────────────────────────────────
function backToField() {
  if (game) game.state = STATES.FIELD;
  app.screen = "field";
  field.paused = false;
  field._lastT = 0; // dt をリセット（戻り直後の大ジャンプ防止）。
  // 目標がいまの位置より手前なら、その場で止まる。カーソルへ自然に再始動できるよう下限合わせ。
  if (field.targetX < field.x) field.targetX = field.x;
  if (typeof window !== "undefined") window.game = game;
  if (typeof render === "function") render();
  startFieldLoop();
}

// ──────────────────────────────────────────
// 追従アニメのループ（ブラウザのみ。rAF が無ければ動かない＝検証は手動で fieldStep を回す）
//   02 と同じく rAF の timestamp を fieldStep に渡して dt 補正に使う。
// ──────────────────────────────────────────
function fieldLoop(now) {
  if (app.screen !== "field") { field._raf = null; return; }
  fieldStep(now);
  field._raf = (typeof requestAnimationFrame === "function") ? requestAnimationFrame(fieldLoop) : null;
}
function startFieldLoop() {
  if (typeof requestAnimationFrame !== "function") return; // 検証環境(JXA)は手動で fieldStep。
  if (field._raf) return;
  field._raf = requestAnimationFrame(fieldLoop);
}
function stopFieldLoop() {
  if (field._raf != null && typeof cancelAnimationFrame === "function") cancelAnimationFrame(field._raf);
  field._raf = null;
}

// ──────────────────────────────────────────
// 補助：sign/save を“その場で連打発火”させない再点灯
//   一度発火した sign/save は _done=true にし、L がその node から R_NODE より離れたら
//   再び _done=false に戻す（読み返し・再セーブできるが、留まっても鳴り続けない）。
//   rAF が無い検証環境では setTimeout も無いことがあるので、その時は再点灯しない（実害なし）。
// ──────────────────────────────────────────
function _rearmNodeWhenAway(node) {
  if (typeof setTimeout !== "function") return;
  const tick = function () {
    if (!node || app.screen !== "field") return;
    const nx = (typeof node.x === "number") ? node.x : 0.5;
    const ny = (typeof node.y === "number") ? node.y : 0.5;
    const d = Math.sqrt((field.x - nx) * (field.x - nx) + (field.y - ny) * (field.y - ny));
    if (d > R_NODE * 1.6) { node._done = false; return; } // 十分離れたら再点灯。
    setTimeout(tick, 220);
  };
  setTimeout(tick, 220);
}

// ──────────────────────────────────────────
// ui 用の小さなヘルパー（renderField が node を描くときに使う）
//   その node が「いま通れるか（requires 達成済みか）」を返す＝グレーアウト判定の一元化。
// ──────────────────────────────────────────
function nodePassable(node) {
  if (!node) return false;
  if (!node.requires) return true;
  return !!(typeof hasFlag === "function" && hasFlag(node.requires));
}

// ── window へ明示エクスポート（headless/ui チェッカは文字列 eval で読むので明示する）。
//   ブラウザ実機でも const/function が window に乗らない環境があるため、念のため代入する。
if (typeof window !== "undefined") {
  window.field = field;
  window.enterArea = enterArea;
  window.fieldSetTarget = fieldSetTarget;
  window.fieldStep = fieldStep;
  window.fieldCheckNodes = fieldCheckNodes;
  window.fireNode = fireNode;
  window.startNpcDialogue = startNpcDialogue;
  window.endNpcDialogue = endNpcDialogue;
  window.onBattleResolved = onBattleResolved;
  window.goToNextArea = goToNextArea;
  window.backToField = backToField;
  window.fieldLoop = fieldLoop;
  window.startFieldLoop = startFieldLoop;
  window.stopFieldLoop = stopFieldLoop;
  window.nodePassable = nodePassable;
}
