/*
 * save.js — セーブ／ロード（localStorage への往復）
 *
 * なぜ save.js が「メトリクスのスナップショット」まで保存するのか：
 *   本作の肝は、プレイヤーの“操作の癖”（クリック数・読み飛ばし・カーソル移動）を
 *   裏で常時計測し、終盤のメタ演出で神様的存在が「見透かす」こと。
 *   ここで metrics を一緒に保存・復元しないと、途中セーブ→ロードした瞬間に
 *   “癖”がリセットされ、見透かし（メタ演出）が成立しなくなる。
 *   だから save は player/flags/currentArea/counters に加えて、
 *   metrics のスナップショット（_curBlock* 等の作業用も含む）を必ず往復させる。
 *
 *   また game.player.cards / tendency / hp も player に含めてまるごと保存する
 *   （覚えたことば・Lv・凶暴/優しさの傾き・残りhp は、復帰時に欠けると別人になるため）。
 *
 * 保存先：localStorage。キーは "wo_rd_save_v1"（スキーマ変更時に v2 へ上げる前提の接尾辞）。
 *   スロット概念は簡易：slot を指定すると "wo_rd_save_v1:slotName" のように接尾辞を足すだけ。
 *   未指定時は既定スロット（接尾辞なし）を使う。
 *
 * ★ 削除はしない：本プロジェクトの安全方針に従い、delete系は使わず
 *   「上書き（同キーへの setItem）」だけで済ませる。clearSave も空オブジェクトの上書きで表現する。
 *
 * ※ ビルドなし・依存ゼロ・file:// 前提のため ES Modules は使わず、
 *   普通の <script>（data → audio → metrics → state → save の順）で読み、
 *   末尾で window へ明示エクスポートする（headless/ui チェッカは文字列 eval で読むので明示が要る）。
 */

// セーブの基底キー。スキーマを壊す変更をしたら v2 へ上げる（後方互換を切る合図）。
const SAVE_KEY = "wo_rd_save_v1";

// セーブ形式のバージョン。将来ロード側で互換判定に使えるよう、中身にも埋めておく。
const SAVE_VERSION = 1;

// ──────────────────────────────────────────
// localStorage の安全ラッパ
//   file:// やプライベートブラウズ等で localStorage が無い/書けない場合に
//   ゲーム全体が落ちないよう、ここで try/catch して無効化する（セーブ不可でも遊べる）。
// ──────────────────────────────────────────
function _hasLocalStorage() {
  try {
    return typeof localStorage !== "undefined" && localStorage !== null;
  } catch (e) {
    // 一部環境では localStorage への参照自体が例外を投げる（その場合は無効扱い）。
    return false;
  }
}

// slot から実際の localStorage キーを作る。
//   未指定（null/undefined/""）なら既定スロット＝基底キーそのもの。
//   指定があれば "wo_rd_save_v1:スロット名" にして複数スロットを区別する。
function _keyFor(slot) {
  if (slot === undefined || slot === null || slot === "") return SAVE_KEY;
  return SAVE_KEY + ":" + String(slot);
}

// ──────────────────────────────────────────
// metrics のスナップショットを取る／戻す
//   metricsSummary() は“集計済みの鏡”であって生カウンタではない。
//   復元後も計測を continue（_curBlock* の途中状態も含めて）続けたいので、
//   ここでは metrics オブジェクトの「生のカウンタ」を素直にコピーする。
//   （startedAt も保存：これがないと seconds が復帰直後に巻き戻る/暴れる）
// ──────────────────────────────────────────
function _snapshotMetrics() {
  // metrics が未初期化でも落ちないようガード（保険）。
  if (typeof metrics === "undefined" || !metrics) {
    return null;
  }
  return {
    clicks: metrics.clicks,
    cursorDist: metrics.cursorDist,
    skips: metrics.skips,
    blocksShown: metrics.blocksShown,
    blocksSkipped: metrics.blocksSkipped,
    dwellTotalMs: metrics.dwellTotalMs,
    startedAt: metrics.startedAt,
    // 提示中ブロックの作業用も持ち越す（ロード直後に textAdvanced しても破綻しないように）。
    _curBlockStart: metrics._curBlockStart,
    _curBlockChars: metrics._curBlockChars,
    _blockOpen: metrics._blockOpen,
  };
}

// 保存しておいた metrics スナップショットを、現在の metrics へ上書き復元する。
//   startMetrics() がリセットした後でも、ここで“癖”を丸ごと差し戻す＝メタ演出が途切れない。
function _restoreMetrics(snap) {
  if (typeof metrics === "undefined" || !metrics || !snap) return;
  // 旧セーブにキーが欠けていても 0/false に倒して安全に復元（後方互換の保険）。
  metrics.clicks = snap.clicks || 0;
  metrics.cursorDist = snap.cursorDist || 0;
  metrics.skips = snap.skips || 0;
  metrics.blocksShown = snap.blocksShown || 0;
  metrics.blocksSkipped = snap.blocksSkipped || 0;
  metrics.dwellTotalMs = snap.dwellTotalMs || 0;
  metrics.startedAt = snap.startedAt || 0;
  metrics._curBlockStart = snap._curBlockStart || 0;
  metrics._curBlockChars = snap._curBlockChars || 0;
  metrics._blockOpen = !!snap._blockOpen;
}

// ──────────────────────────────────────────
// セーブ：現ランの“続きに必要なもの”を1オブジェクトにまとめて保存する。
//   slot：省略可（既定スロット）。複数セーブが欲しくなったら呼び側で名前を渡す。
//   戻り値：成功 true / 失敗 false（localStorage 不在や未ゲームなら false）。
// ──────────────────────────────────────────
function saveGame(slot) {
  // まだ newGame() していない＝保存すべき状態が無いなら、何もしないで false。
  if (typeof game === "undefined" || !game) return false;
  if (!_hasLocalStorage()) return false;

  // 保存ペイロード。契約の必須5点を必ず含める：
  //   player（cards/tendency/hp 含む）・flags・currentArea・counters・metrics スナップショット。
  const payload = {
    version: SAVE_VERSION,   // 互換判定用（ロード側が将来見られるように）。
    savedAt: Date.now(),     // 表示用の保存時刻（listSaves で「いつのセーブか」を出せる）。
    // player はまるごと（cards=覚えたことばとLv / tendency=凶暴・優しさ / hp / 名前）。
    //   参照ではなく値で固める（後の操作でセーブ済みデータが汚れないように JSON で deep copy）。
    player: JSON.parse(JSON.stringify(game.player)),
    flags: JSON.parse(JSON.stringify(game.flags || {})),
    currentArea: game.currentArea,                 // どのエリアにいたか（復帰先）。
    counters: JSON.parse(JSON.stringify(game.counters || {})), // 勝ち方の集計（harsh/kind/battles）。
    state: game.state,                             // 進行ステート（任意。復帰画面の判断材料）。
    // ★ 計測の“癖”スナップショット。これが本作のセーブの肝（メタ演出の継続性）。
    metrics: _snapshotMetrics(),
  };

  try {
    // JSON 文字列にして同キーへ setItem（＝上書き）。削除APIは一切使わない。
    localStorage.setItem(_keyFor(slot), JSON.stringify(payload));
    return true;
  } catch (e) {
    // 容量超過やプライベートモード等で書けないことがある。落とさず false を返す。
    return false;
  }
}

// ──────────────────────────────────────────
// ロード：保存データを読み、game と metrics の“両方”を復元する。
//   slot：省略可（既定スロット）。
//   戻り値：成功 true / 失敗 false（データ無し・壊れている・localStorage 不在）。
//
//   設計判断：ロードは「まず newGame() で器を作り直し、その上に保存値を被せる」方式。
//   こうすると、保存に含まれない新フィールド（将来 state.js に増えた箱）も
//   newGame() の既定値で埋まり、未定義参照で落ちにくい（前方互換の保険）。
// ──────────────────────────────────────────
function loadGame(slot) {
  if (!_hasLocalStorage()) return false;

  let raw = null;
  try {
    raw = localStorage.getItem(_keyFor(slot));
  } catch (e) {
    return false; // 参照自体が投げる環境の保険。
  }
  if (!raw) return false; // セーブが無い。

  let data = null;
  try {
    data = JSON.parse(raw);
  } catch (e) {
    return false; // 壊れた/古い不正データはロード失敗扱い（上書きはしない＝消さない）。
  }
  if (!data || typeof data !== "object") return false;

  // 器を作り直す（既定値で全フィールドを満たしておく）。
  newGame();

  // 保存値を被せる（存在するものだけ。欠けていれば newGame の既定を維持）。
  if (data.player) game.player = data.player;
  if (data.flags) game.flags = data.flags;
  if (typeof data.currentArea !== "undefined") game.currentArea = data.currentArea;
  if (data.counters) game.counters = data.counters;
  if (typeof data.state !== "undefined") game.state = data.state;

  // ★ 計測の“癖”を現在の metrics へ復元（これでメタ演出が途切れない）。
  _restoreMetrics(data.metrics);

  // const game を書き換えたので、window 側の参照も貼り直す（state.js と同じ注意点）。
  if (typeof window !== "undefined") window.game = game;

  return true;
}

// ──────────────────────────────────────────
// セーブの有無を調べる（タイトルの「つづきから」ボタンの活性判定など）。
//   slot 省略時は「既定スロットがあるか」を返す。
//   戻り値：true/false。
// ──────────────────────────────────────────
function hasSave(slot) {
  if (!_hasLocalStorage()) return false;
  try {
    return localStorage.getItem(_keyFor(slot)) !== null;
  } catch (e) {
    return false;
  }
}

// ──────────────────────────────────────────
// 既存セーブの一覧を返す（複数スロット運用や「どのセーブを読むか」の選択UI用）。
//   wo_rd_save_v1 で始まる全キーを走査し、{ slot, key, savedAt, currentArea } を返す。
//   既定スロット（接尾辞なし）は slot=null として含める。
//   壊れたデータは savedAt 等を null にして“存在はする”形で返す（消さない方針）。
// ──────────────────────────────────────────
function listSaves() {
  const out = [];
  if (!_hasLocalStorage()) return out;

  try {
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (!key) continue;
      // 基底キーそのもの、または "基底キー:スロット名" だけを対象にする。
      const isDefault = key === SAVE_KEY;
      const isSlot = key.indexOf(SAVE_KEY + ":") === 0;
      if (!isDefault && !isSlot) continue;

      // slot 名を取り出す（既定は null）。
      const slot = isDefault ? null : key.slice((SAVE_KEY + ":").length);

      // 中身を覗いて表示用メタを拾う（壊れていても落とさない）。
      let savedAt = null;
      let currentArea = null;
      try {
        const data = JSON.parse(localStorage.getItem(key));
        if (data && typeof data === "object") {
          savedAt = data.savedAt || null;
          currentArea = (typeof data.currentArea !== "undefined") ? data.currentArea : null;
        }
      } catch (e) {
        // パース不能でも「セーブ枠としては存在する」ので残す。
      }

      out.push({ slot: slot, key: key, savedAt: savedAt, currentArea: currentArea });
    }
  } catch (e) {
    // 走査自体が投げる環境の保険：その時点までの結果を返す。
    return out;
  }

  // 新しい順（savedAt 降順）に並べる。savedAt が無いものは末尾へ。
  out.sort(function (a, b) {
    return (b.savedAt || 0) - (a.savedAt || 0);
  });
  return out;
}

// ──────────────────────────────────────────
// セーブを“空に上書き”して実質クリアする（任意ユーティリティ）。
//   ★ 削除APIは使わない方針なので removeItem ではなく、空印オブジェクトを setItem する。
//     こうするとキー自体は残るが hasSave 後にロードしても player 等が無く失敗扱いになり、
//     かつ「ファイル削除はしない（上書きのみ）」という制約を守れる。
//   戻り値：成功 true / 失敗 false。
// ──────────────────────────────────────────
function clearSave(slot) {
  if (!_hasLocalStorage()) return false;
  try {
    // version だけ持つ“空セーブ”で上書き（loadGame は player が無いので false を返す）。
    localStorage.setItem(_keyFor(slot), JSON.stringify({ version: SAVE_VERSION, cleared: true }));
    return true;
  } catch (e) {
    return false;
  }
}

// ── window へ明示エクスポート（headless/ui チェッカは文字列 eval で読むので明示する）。
//   ブラウザ実機でも const/function が window に乗らない環境があるため、念のため代入する。
if (typeof window !== "undefined") {
  window.SAVE_KEY = SAVE_KEY;
  window.saveGame = saveGame;
  window.loadGame = loadGame;
  window.hasSave = hasSave;
  window.listSaves = listSaves;
  window.clearSave = clearSave;
}
