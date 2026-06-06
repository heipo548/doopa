/*
 * battle.js — 口喧嘩＝ことばのカードバトル（ターン制・1体）
 *
 * 相手は二つのゲージを持つ：
 *   ・精神HP（見える / mindHp）……harsh で削る。0で「言い負かした」＝凶暴+（lastWinKind=false）。
 *   ・思いやり（見えない / omoiyari）…kind で満たす。満タンで「寄り添った」＝優しさ+（lastWinKind=true）。
 *   ★ 思いやりは UI に一切出さない。だから kind 行動の fx には“数値”を積まない（harsh は浮かぶ数字あり）。
 *      急ぐ人ほど、見えている精神HPを削る側＝凶暴へ無意識に流れる、という非対称が核。
 *
 * 速さの非対称（data の数値で表現）：harsh＝3〜4手で勝てる／kind＝6〜7手かかる（敵の言葉を多く浴びる）。
 *   kind の遅さを支えるため一部 kind は side（healSelf/lowerAtk）で“耐える”を成立させる。
 *
 * 必然性：この村は手を出せない＝相手はことばでぶつかり、こちらは言い負かすか寄り添うしかない。
 *   敵ターンは固定圧（毎ターン atk のことばダメージ）。理不尽な即死を作らない。非パーマデス。
 *
 * ※ DOM 非依存。<script>（…→battle→…）で読み、末尾で window へ明示エクスポート。
 */

// kind の side 効果の大きさ（data 側は "healSelf"/"lowerAtk" のフラグだけ持ち、量はここで一元管理）。
const SIDE_HEAL = 3;   // ganbatta：自分hpを+3（長期戦の燃料）
const SIDE_LOWER = 1;  // tonari：敵atkを-1（重ねるほど被弾が先細り）

// 演出イベントをキューに積む（ui.playFx が描画後に消費。非DOMでも落ちないよう配列push のみ）。
function pushFx(ev) {
  if (game && game.fx) game.fx.push(ev);
}
// 効果音（audio があれば鳴らす。無くても落ちない）。
function se(name) {
  if (typeof playSe === "function") {
    try { playSe(name); } catch (e) {}
  }
}
// 進行に応じて配列から1つ選ぶ（敵の言い返しを順に／最後はループ）。
function pickLineByTurn(lines, turn) {
  if (!lines || !lines.length) return "";
  return lines[Math.min(turn, lines.length - 1)];
}

// ──────────────────────────────────────────
// startBattle(enemyId)
//   敵の精神HP（可視）と思いやり（不可視）を初期化し、バトル状態へ。
// ──────────────────────────────────────────
function startBattle(enemyId) {
  const en = ENEMIES[enemyId];
  if (!en) return false;
  game.battle = {
    enemyId: enemyId,
    mindHp: en.mindHpMax,
    mindHpMax: en.mindHpMax,
    omoiyari: 0,            // 見えないゲージ（UI に出さない）
    omoiyariNeed: en.omoiyariNeed,
    atk: en.atk,            // kind の lowerAtk で下がりうる（floor 0）
    turn: 0,
    phase: "player",        // 'player' | 'enemy' | 'end'
  };
  game.lastWinKind = null;
  game.counters.battles++;
  game.state = STATES.BATTLE;
  app.screen = "battle";
  log("かどっこ が、ことばを にぎって こちらを 見ている。");
  return true;
}

// ──────────────────────────────────────────
// playerCard(wordId) — プレイヤーターン：手札のことばを1枚使う。
//   harsh→精神HPを削る（数字が浮かぶ）／kind→思いやりを満たす（数字は出さない）。
// ──────────────────────────────────────────
function playerCard(wordId) {
  const b = game.battle;
  if (!b || b.phase === "end") return false; // バトル外/決着後は無視（多重操作の安全弁）
  const w = WORDS[wordId];
  if (!w || !knowsCard(wordId)) return false; // 手札にないことばは使えない
  const pow = cardPower(wordId);
  game.lastWord = wordId;

  if (w.kind === "harsh") {
    b.mindHp = Math.max(0, b.mindHp - pow);
    addKyoubou(BALANCE.useHarsh);              // 使うだけで凶暴へ少し傾く
    pushFx({ type: "harshHit", n: pow });      // ★ harsh は数字が浮かぶ（見える攻撃）
    se("harsh");
    log("ルゥ：「" + cardFace(wordId) + "」");
  } else {
    // kind：思いやりを満たす。★ 数値の fx を積まない（見えないゲージ）。
    b.omoiyari = Math.min(b.omoiyariNeed, b.omoiyari + pow);
    addYasashisa(BALANCE.useKind);
    if (w.side === "healSelf") {
      game.player.hp = Math.min(game.player.maxHp, game.player.hp + SIDE_HEAL);
      pushFx({ type: "heal", n: SIDE_HEAL });
    } else if (w.side === "lowerAtk") {
      b.atk = Math.max(0, b.atk - SIDE_LOWER);
      pushFx({ type: "lowerAtk" });
    }
    pushFx({ type: "kindUse" });               // 数値なし＝見えない手応え（光/ことばで返す）
    se("kind");
    log("ルゥ：「" + cardFace(wordId) + "」");
  }

  b.turn++;
  if (checkWin()) return true; // 決着したら敵ターンは回さない
  enemyTurn();
  return true;
}

// ことばの“いまの言い方”（Lv に応じた表示文字列）。
function cardFace(wordId) {
  const w = WORDS[wordId];
  if (!w) return "";
  const lv = cardLevel(wordId);
  const idx = Math.min(Math.max(lv - 1, 0), w.levels.length - 1);
  return w.levels[idx];
}

// ──────────────────────────────────────────
// checkWin() — どちらかのゲージが満たされたら決着。
// ──────────────────────────────────────────
function checkWin() {
  const b = game.battle;
  if (!b) return false;
  if (b.mindHp <= 0) { winBattle(false); return true; }              // 言い負かし（harsh）
  if (b.omoiyari >= b.omoiyariNeed) { winBattle(true); return true; } // 寄り添い（kind）
  return false;
}

// ──────────────────────────────────────────
// enemyTurn() — 敵ターン：固定圧でプレイヤーhpを削る（非パーマデス）。
//   lowerAtk で atk が0になった敵は、もう攻めない（kindで“耐えた先”の手応え）。
// ──────────────────────────────────────────
function enemyTurn() {
  const b = game.battle;
  if (!b || b.phase === "end") return;
  b.phase = "enemy";
  const en = ENEMIES[b.enemyId];

  if (b.atk > 0) {
    game.player.hp = Math.max(0, game.player.hp - b.atk);
    pushFx({ type: "enemyHit", n: b.atk });
    se("enemyHit");
    log(en.name + (en.attackLines ? "：" + pickLineByTurn(en.attackLines, b.turn - 1) : " が ことばを ぶつけた。"));
  } else {
    log(en.name + "：「……もう、つよい ことばが、でてこない。」");
  }

  if (game.player.hp <= 0) { onGameOver(); return; }
  b.phase = "player";
}

// ──────────────────────────────────────────
// winBattle(kind) — 戦後処理：勝ち方を必ず傾向に記録する（このシーケンスの核）。
//   kind=true：寄り添い＝優しさ+、kindWins++、gift を授かる。
//   kind=false：言い負かし＝凶暴+、harshWins++。
//   → 結果（簡易エンド）へ。
// ──────────────────────────────────────────
function winBattle(kind) {
  const b = game.battle;
  const en = ENEMIES[b.enemyId];
  b.phase = "end";
  game.lastWinKind = kind;

  if (kind) {
    addYasashisa(BALANCE.winKind);
    game.counters.kindWins++;
    log(en.name + " の とげが、ほどけた。");
    if (en.gift && WORDS[en.gift]) {
      const r = addCard(en.gift); // 寄り添うと語彙を授かる
      if (r === "learned") log("ことばを ひとつ おぼえた：「" + WORDS[en.gift].levels[0] + "」");
    }
    se("winKind");
  } else {
    addKyoubou(BALANCE.winHarsh);
    game.counters.harshWins++;
    log(en.name + " は、もう なにも 言えなくなった。");
    se("winHarsh");
  }

  setFlag("battle_done");
  setFlag("defeated_" + en.id);
  game.battle = null; // 揮発状態を畳む（playerCard の多重操作ガードにも効く）

  if (en.isBoss) {
    // 最後の関門を越えた → 結末（簡易エンド）→ 神様メタ へ。
    setFlag("boss_done");
    setFlag("area_mura_clear");
    determineEnding();      // 傾向比で簡易エンドを確定（result 画面が参照）
    game.state = STATES.RESULT;
    app.screen = "result";
  } else {
    // 中ボス撃破 → 村へ戻る。戦間はセーブ（ことばの泉）で全回復し、奥に次の相手が現れる。
    setFlag("kado_done");
    game.player.hp = game.player.maxHp;
    game.state = STATES.FIELD;
    app.screen = "field";
  }
}

// ──────────────────────────────────────────
// onGameOver() — player.hp0。非パーマデス（直前セーブから再開できる）。
// ──────────────────────────────────────────
function onGameOver() {
  if (game.battle) game.battle.phase = "end";
  game.state = STATES.GAMEOVER;
  app.screen = "gameover";
  log("ルゥは ことばに のまれて、うずくまった。……でも、おわりじゃない。");
  se("gameover");
}

// 手札をバトルのコマンド一覧として返す（ui の command-bar 用：harsh/kind に分けて）。
function battleCommandList() {
  const harsh = [], kind = [];
  ownedCards().forEach((id) => {
    const w = WORDS[id];
    if (!w) return;
    (w.kind === "harsh" ? harsh : kind).push(id);
  });
  return { harsh: harsh, kind: kind };
}

// バトルが終わっているか（ui/main のガード用）。
function isBattleOver() {
  return !game.battle || game.battle.phase === "end";
}

// ── window へ明示エクスポート ──
if (typeof window !== "undefined") {
  window.startBattle = startBattle;
  window.playerCard = playerCard;
  window.enemyTurn = enemyTurn;
  window.checkWin = checkWin;
  window.winBattle = winBattle;
  window.onGameOver = onGameOver;
  window.battleCommandList = battleCommandList;
  window.isBattleOver = isBattleOver;
  window.cardFace = cardFace;
}
