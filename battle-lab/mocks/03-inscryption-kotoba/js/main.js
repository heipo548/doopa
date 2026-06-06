/*
 * main.js — 配線（engine と ui をつなぐ）＋ 設置操作のフロー
 *
 * クリック → engine を動かす → ui を描き直す、という橋渡し。
 * 「供える → 置く」の2段階操作は UI 都合なので、その途中状態(state.pending)を
 * ここで管理する（engine 側は原子的な doPlaceWord / doEchoCard を提供するだけ）。
 *
 * 設置の流れ：
 *   1) 手元の言葉をクリック（clickHandCard）
 *      ・供えが要らなければ そのまま 設置モードへ
 *      ・供えが要るなら 供えモードへ（足りなければ案内して中断）
 *   2) 場の自分の言霊をクリックして 必要数だけ供う（toggleOffering）
 *   3) 空いた声の道をクリックして 置く（placeAt）
 */

var Game = (function () {

  var BUSY = false; // レーン処理の演出中は二重操作を防ぐ

  // engine.js の関数（同名衝突を避けるための別名）
  function eOffer(def) { return effectiveOffer(def); }
  function eHasEmptyLane() { return hasEmptyLane(); }
  function eOwnBoardCount() { return ownBoardCount(); }

  // 手元の言葉から uid でインスタンスを探す
  function findHand(uid) {
    for (var i = 0; i < state.hand.length; i++) {
      if (state.hand[i].uid === uid) return state.hand[i];
    }
    return null;
  }

  // 軽い案内（ログに一言出して描き直す）
  function notify(msg) { logMsg(msg); UI.render(); }

  /* ── 1) 手元の言葉をクリック ── */
  function clickHandCard(uid) {
    if (BUSY || state.phase !== 'player' || state.result) return;

    // 同じカードを もう一度クリックしたら 選択解除
    if (state.pending && state.pending.uid === uid) { cancel(); return; }

    var inst = findHand(uid);
    if (!inst) return;
    var def = CARD_LIBRARY[inst.defId];

    // 残響カード（盤面に置かない）：即発動
    if (def.kind === 'echo') {
      state.pending = null;
      doEchoCard(uid); // engine：残響を払って効果（足りなければログを出して何もしない）
      UI.render();
      return;
    }

    // 盤面に置く言葉：置けるかどうかを先に確認
    var need = eOffer(def);
    if (!eHasEmptyLane()) { notify('置ける 空きの声の道が ない。'); return; }
    if (eOwnBoardCount() < need) {
      notify('「' + def.name + '」には 供え言葉が ' + need + 'つ 要る。場の言葉が 足りない。');
      return;
    }
    // 供えモード or（供え不要なら）設置モードへ
    state.pending = { uid: uid, defId: inst.defId, kind: 'word', need: need, offerings: [] };
    UI.render();
  }

  /* ── 2) 場の自分の言霊を 供う/取り消す ── */
  function toggleOffering(boardUid) {
    if (BUSY || !state.pending || state.pending.need <= 0) return;
    var arr = state.pending.offerings;
    var pos = arr.indexOf(boardUid);
    if (pos >= 0) {
      arr.splice(pos, 1);            // 取り消し
    } else if (arr.length < state.pending.need) {
      arr.push(boardUid);            // 供える（必要数まで）
    }
    UI.render();
  }

  /* ── 3) 空いた声の道に 置く ── */
  function placeAt(lane) {
    if (BUSY || !state.pending) return;
    if (state.pending.offerings.length < state.pending.need) return;
    var ok = doPlaceWord(state.pending.uid, lane, state.pending.offerings);
    state.pending = null;
    if (ok) UI.render();
  }

  // 設置の途中をやめる
  function cancel() {
    state.pending = null;
    UI.render();
  }

  /* ── ターン終了 → 「声の道が動く」演出 → レーン処理 ── */
  function endTurn() {
    if (BUSY || state.phase !== 'player' || state.result) return;
    cancel();             // 途中操作は片づける
    if (!endTurnEngine()) return; // phase=resolving
    UI.render();
    BUSY = true;
    // 予告どおりに 言葉がぶつかるのを “読む間”
    setTimeout(function () {
      resolveTurnEngine(); // レーン処理＋村長の予告→盤面＋次の番開始
      BUSY = false;
      UI.render();
    }, 850);
  }

  // リスタート
  function restart() {
    BUSY = false;
    restartEngine();
    UI.render();
  }

  return {
    clickHandCard: clickHandCard, toggleOffering: toggleOffering,
    placeAt: placeAt, cancel: cancel, endTurn: endTurn, restart: restart
  };
})();

// engine.js のグローバル関数を 別名で束ねる（Game 側と名前が衝突するため）
function endTurnEngine() { return endTurn(); }
function resolveTurnEngine() { return resolveTurn(); }
function restartEngine() { return restart(); }

// 起動：DOM ができてからバトル開始
function boot() {
  newBattle('sonchou');
  document.getElementById('end-turn-btn').onclick = function () { Game.endTurn(); };
  document.getElementById('cancel-btn').onclick = function () { Game.cancel(); };
  document.getElementById('restart-btn').onclick = function () { Game.restart(); };
  UI.render();
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', boot);
} else {
  boot();
}
