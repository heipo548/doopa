/*
 * battle.js — ことばのカードバトル（二つのゲージを攻める核ロジック）
 *
 * このプロトの署名メカニクス：相手には“ふたつのゲージ”がある。
 *   ・精神HP（見える / mindHp）   … harsh なことばで削る。0で「言い負かした」＝凶暴+。速い。
 *   ・思いやり（見えない / omoiyari）… kind なことばで満たす。満タンで「寄り添った」＝優しさ+。遅い。
 * 思いやりは UI に一切出さない（数値も fx で出さない）。急ぐ人ほど無意識に harsh＝凶暴へ流れる設計。
 *
 * プレイヤーにも hp(見える) があり、敵は毎ターン atk ぶん削る。0でゲームオーバー（セーブからやり直し）。
 *   → harsh は2〜4ターンで勝てる（速い＝凶暴）／kind は5〜8ターン積む（遅い＝優しい・その間 多く被弾）。
 *     この“速さと重みの非対称”が核。data.js の数値（mindHpMax/omoiyariNeed/atk/power）が両ルート成立を保証する。
 *
 * ── 設計方針（02-saigo-no-tomodachi の流儀を踏襲）──
 *   ・battle.js は DOM を触らない。「何が起きたか」だけを game.fx へ積み、見せ方は ui.js に任せる
 *     （JXA でのヘッドレス検証を壊さないため）。
 *   ・ことばの却下理由などは flash()（トースト）で。戦闘ログ(log)は state.js の log() を使う。
 *   ・状態名は state.js の STATES に、グローバルは game/app に合わせる（ES Modules は使わない）。
 *
 * ※ ビルドなし・依存ゼロで file:// から動く。普通の <script> として読み込み、window 直書きで共有する。
 *   読み込み順は data.js → audio.js → metrics.js → state.js → save.js → battle.js（state より後）。
 */

// ──────────────────────────────────────────
// 共通：UI へ一時メッセージ（トースト）。ui.js の showToast があれば使う。
//   戦闘ログ(log)を汚さずに、却下理由や小さな気づきを伝えるため（02 の flash に倣う）。
// ──────────────────────────────────────────
function flash(msg) {
  if (typeof showToast === "function") showToast(msg);
}

// ──────────────────────────────────────────
// 演出イベントを積む（ui.playFx が render 後に消費して、数字フロートや揺れを出す）。
//   battle.js は DOM を触らず「何が起きたか」だけ残す（02 の pushFx に倣う）。
//   ★思いやり(omoiyari)に関する数値は ここで絶対に積まない＝見えないゲージを守る核。
// ──────────────────────────────────────────
function pushFx(ev) {
  if (game && Array.isArray(game.fx)) game.fx.push(ev);
}

// ──────────────────────────────────────────
// 効果音の薄いラッパ。audio.js の playSe があれば鳴らす（無くても落ちない）。
//   harsh/kind/hit/calm/win/lose を ことばの性質に応じて鳴らし分けるため。
// ──────────────────────────────────────────
function se(name) {
  if (typeof playSe === "function") playSe(name);
}

// 不穏度に応じて敵セリフを選ぶ（配列なら、ダークが進むほど後ろ＝より刺々しい/不穏な一言を引く）。
//   主人公(L)が翳るほど世界の見え方も変わる、という空気を敵の反応にも薄く乗せる。
function pickLine(lines) {
  if (!Array.isArray(lines) || lines.length === 0) return "";
  // darkLevel(0..3)で後方の行を引きやすくする。範囲外は末尾でクランプ。
  const dl = (typeof darkLevel === "function") ? darkLevel() : 0;
  const idx = Math.min(lines.length - 1, Math.max(0, dl));
  return lines[idx];
}

// ──────────────────────────────────────────
// startBattle(enemyId, opts?)
//   敵テンプレ(ENEMIES[enemyId])から“戦闘インスタンス”を作って game.battle に据える。
//   インスタンスは mindHp=mindHpMax から減らし、omoiyari=0 を omoiyariNeed まで満たす。
//   enemyAtkScale を掛けた atk を持たせ、毎ターンのプレイヤー被弾量にする。
// ──────────────────────────────────────────
function startBattle(enemyId, opts) {
  const base = ENEMIES[enemyId];
  if (!base) { flash("敵データが ない"); return false; }

  // 敵の攻撃力は BALANCE.enemyAtkScale で一括調整（救いルートが詰むなら下げる安全弁）。
  const scale = (BALANCE && typeof BALANCE.enemyAtkScale === "number") ? BALANCE.enemyAtkScale : 1.0;
  const atk = Math.max(0, Math.round(base.atk * scale));

  game.battle = {
    enemyId: enemyId,
    enemy: {
      // 表示・演出に使う見た目情報（テンプレからコピー）。
      id: base.id, name: base.name, shape: base.shape, color: base.color,
      boss: !!base.boss, gift: base.gift || null, lines: base.lines || {},
      // ふたつのゲージ。mindHp は見える／omoiyari は見えない（need まで満たすと寄り添い勝ち）。
      mindHp: base.mindHpMax, mindHpMax: base.mindHpMax,
      omoiyari: 0, omoiyariNeed: base.omoiyariNeed,
      atk: atk,                 // 毎ターンのプレイヤー hp ダメージ（kind の side で下げられる）。
    },
    phase: "player",            // バトル内サブ状態："player"|"enemy"|"end"（state.STATES とは別物）。
    turn: 0,
    opts: opts || {},           // フィールド復帰用の情報（撃破フラグ等を field 側が読む）。
  };

  game.state = STATES.BATTLE;
  app.screen = "battle";
  game.lastWinKind = null;      // 今回の勝ち方は未決着。
  game.counters.battles++;

  // 導入セリフは一度だけ流す（seen で既読管理。02 同様、intro/flavor のくどい再掲を避ける）。
  if (base.intro && !game.seen[`intro_${enemyId}`]) {
    log(base.intro);
    game.seen[`intro_${enemyId}`] = true;
  }
  // BGM トーンを翳りに合わせる（audio.setTone があれば）。主人公の不穏化と空気を合わせる。
  if (typeof setTone === "function" && typeof darkLevel === "function") setTone(darkLevel());

  return true;
}

// ──────────────────────────────────────────
// playerCard(wordId)
//   手札の1枚を使う。harsh なら精神HPを削り凶暴を積む／kind なら思いやりを満たし優しさを積む。
//   ことばの威力は cardPower(id)（state.js）が Lv に応じて返す＝同じことばが育つ手触り。
//   1コマンド消費したら enemyTurn() を回す（終了していなければ）。
//   戻り値：ターンを消費したら true／弾いたら false（ui は true のときだけ画面を進める）。
// ──────────────────────────────────────────
function playerCard(wordId) {
  if (!game.battle) return false;
  if (game.battle.phase !== "player") return false; // 敵ターン中/決着後は受け付けない。
  if (!knowsCard(wordId)) { flash("その ことばを まだ しらない"); return false; } // 未習得は弾く。

  const w = WORDS[wordId];
  if (!w) return false;
  const en = game.battle.enemy;
  const lv = cardLevel(wordId);                 // 1..3
  const power = cardPower(wordId);              // harsh=mindHpダメージ / kind=思いやり充填量
  const said = (w.levels && w.levels[Math.min(lv - 1, w.levels.length - 1)]) || w.id; // Lvに応じた言い回し。
  game.lastWord = wordId;                       // “さいごのことば”として記録（結末/メタ演出用）。

  if (w.kind === "harsh") {
    // ── harsh：精神HPを削る（速い＝凶暴ルート）─────────────────
    en.mindHp = Math.max(0, en.mindHp - power);
    addKyoubou(BALANCE.useHarsh);               // 使うたび凶暴+（無意識の癖を貯める核）。
    log(`▶ ${game.player.displayName}「${said}」！`);
    // 言ったことばを吹き出しで（toge＝とげとげした不穏なトーン）。被弾数字は ui が mindHp 差から出す。
    pushFx({ t: "speak", text: said, cat: "harsh" });
    pushFx({ t: "hit", dmg: power, mindHp: en.mindHp, mindHpMax: en.mindHpMax }); // 精神HP被弾＝数字フロート（見えるゲージ）。
    se("harsh");
    // 被弾セリフ（不穏度で出し分け）。
    const oh = pickLine(en.lines.onHarsh);
    if (oh) { log(`  ${en.name}「${oh}」`); }

  } else {
    // ── kind：思いやりを満たす（遅い＝優しさルート）───────────
    //   ★思いやりは見えないゲージ。数値を fx に積まない＝UI に一切表示させない（署名メカニクスの核）。
    en.omoiyari = Math.min(en.omoiyariNeed, en.omoiyari + power);
    addYasashisa(BALANCE.useKind);              // 使うたび優しさ+（harsh より1回が軽いが手数で追いつく）。
    log(`▶ ${game.player.displayName}「${said}」`);
    pushFx({ t: "speak", text: said, cat: "kind" });
    pushFx({ t: "calm" });                      // やわらかい演出のみ。思いやりの“量”は決して見せない。
    se("kind");

    // side（kind の一部だけが持つ副次効果）：長期戦(5〜8ターン)を生き延びるための“耐える”手段。
    if (w.side) {
      // healSelf：自分hpを回復（だいじょうぶ）。敵atk数ターン分を相殺し、寄り添い切るまで耐える。
      if (w.side.healSelf && game.player.hp < game.player.maxHp) {
        const before = game.player.hp;
        game.player.hp = Math.min(game.player.maxHp, game.player.hp + w.side.healSelf);
        const got = game.player.hp - before;
        if (got > 0) { log(`  じぶんの こころも すこし 軽くなった（HP +${got}）`); pushFx({ t: "pheal", amount: got }); }
      }
      // lowerAtk：敵の攻撃力を下げる（いっしょだよ）。重ねるほど被弾が先細り、8ターン戦が詰まない。
      if (w.side.lowerAtk) {
        const before = en.atk;
        en.atk = Math.max(0, en.atk - w.side.lowerAtk);
        if (en.atk < before) { log(`  ${en.name} の とげが すこし ひっこんだ（攻撃 ${en.atk}）`); pushFx({ t: "calm" }); }
      }
    }
    // 被弾(＝寄り添われ)セリフ（不穏度で出し分け）。
    const ok = pickLine(en.lines.onKind);
    if (ok) { log(`  ${en.name}「${ok}」`); }
  }

  // ── 勝敗チェック → 未決着なら敵ターン ─────────────────
  if (checkWin()) return true;     // どちらかのゲージが決着＝勝利処理へ（敵ターンは回さない）。
  enemyTurn();                     // 敵の反撃（プレイヤー hp を削る）。負けたら GAMEOVER。
  return true;
}

// ──────────────────────────────────────────
// checkWin()
//   毎プレイヤー行動後に呼ぶ。ふたつのゲージのどちらかが決着していれば勝利処理をして true。
//   ・mindHp<=0      → harsh 勝ち「言い負かした」：凶暴+winHarsh, harshWins++, defeatHarsh。
//   ・omoiyari>=need → kind  勝ち「寄り添った」  ：優しさ+winKind, kindWins++, gift習得, defeatKind。
//   ★同時成立は基本起きない（1コマンドは harsh か kind のどちらかしか動かさない）が、保険で mindHp を先に見る。
// ──────────────────────────────────────────
function checkWin() {
  const b = game.battle;
  if (!b) return false;
  const en = b.enemy;

  if (en.mindHp <= 0) { winBattle(false); return true; } // 言い負かし（harsh）。
  if (en.omoiyari >= en.omoiyariNeed) { winBattle(true); return true; } // 寄り添い（kind）。
  return false;
}

// ──────────────────────────────────────────
// winBattle(kind)
//   kind=true：寄り添って勝った（優しさ＋gift習得）／kind=false：言い負かして勝った（凶暴）。
//   勝ち方を game.lastWinKind と counters に記録（“どう勝ったか”がエンド分岐・メタ演出の素）。
//   勝利後は cards.offerCards() で報酬3択を提示（ピック後に field へ戻るのは cards.js の責務）。
// ──────────────────────────────────────────
function winBattle(kind) {
  const b = game.battle;
  const en = b.enemy;
  b.phase = "end";                 // 以後この戦闘はコマンドを受け付けない。
  game.lastWinKind = kind;

  if (kind) {
    // ── kind 勝ち：寄り添った ───────────────────
    addYasashisa(BALANCE.winKind);                 // 勝ち方の大きな加点（左右対称＝勝ち方が結末を決める）。
    game.counters.kindWins++;
    if (en.lines.defeatKind) log(en.lines.defeatKind);
    // gift：寄り添って勝つと“ことば”を教わる＝優しさルートの語彙報酬（救いルートの燃料補給）。
    if (en.gift) {
      const res = addCard(en.gift);                // learned/leveled/max を返す。
      const gw = WORDS[en.gift];
      const label = (gw && gw.levels && gw.levels[0]) || en.gift;
      if (res === "learned") { log(`  「${label}」を おぼえた。`); pushFx({ t: "learn", text: label }); }
      else if (res === "leveled") { log(`  「${label}」の 言い方が 一段 やさしくなった。`); pushFx({ t: "learn", text: label }); }
      // max のときは黙って流す（語彙は増えないが、寄り添えた事実は defeatKind で十分伝わる）。
    }
    pushFx({ t: "win", kind: true });
    se("win");
  } else {
    // ── harsh 勝ち：言い負かした ─────────────────
    addKyoubou(BALANCE.winHarsh);                  // 凶暴の大きな加点（darkLevel が進み、世界が翳る）。
    game.counters.harshWins++;
    if (en.lines.defeatHarsh) log(en.lines.defeatHarsh);
    pushFx({ t: "win", kind: false });
    pushFx({ t: "dark" });                         // 言い負かした瞬間のダーク化パルス（主人公だけ翳る演出）。
    se("win");
  }

  // 撃破フラグ：ボスなら field 側の関門解放に使う（mura_boss / dokutsu_boss）。
  //   どちらの勝ち方でも“倒した”ことは同じ＝先へ進める（勝ち方は人格に効くが、進行は等価）。
  if (en.boss) {
    if (game.currentArea === "mura") setFlag("mura_boss");
    else if (game.currentArea === "dokutsu") setFlag("dokutsu_boss");
  }
  // 個別撃破フラグも立てておく（field の node が requires で参照できるよう汎用化）。
  setFlag(`beat_${b.enemyId}`);

  // 翳りが進んだかもしれないので BGM トーンを更新（主人公の不穏化と空気を合わせる）。
  if (typeof setTone === "function" && typeof darkLevel === "function") setTone(darkLevel());

  // 報酬3択へ（cards.js）。offerCards 内で app.screen="cards" になり、ピック後に field へ戻る。
  //   ★戻り先は "field"：ピックすると pickCard が screen を field に戻し、ui.onPickCard が
  //     backToField() で追従を再開する（"battle" にすると決着済みの戦闘画面へ戻ってソフトロックする）。
  //     ボス撃破フラグは上で既に立てているので、field 側 onBattleResolved に頼らずここで完結する。
  if (typeof offerCards === "function") {
    offerCards({ from: "field", reason: "win", enemyId: b.enemyId });
  } else {
    // cards.js 未読込でも詰まないフォールバック（戦闘だけ単体検証する場合の保険）。
    endBattleToField();
  }
}

// ──────────────────────────────────────────
// enemyTurn()
//   敵の反撃。lines から一言（不穏度で出し分け）＋プレイヤー hp -= atk。
//   hp<=0 で GAMEOVER（セーブからやり直し）。生き残ったら手番をプレイヤーへ戻す。
//   ★kind ルートは長期戦＝ここを多く通る。だから side(healSelf/lowerAtk) で耐える設計が効いてくる。
// ──────────────────────────────────────────
function enemyTurn() {
  const b = game.battle;
  if (!b) return;
  b.phase = "enemy";
  const en = b.enemy;

  // 敵が一言（onHarsh/onKind とは別の“反撃の気配”として、直近の被弾系セリフを薄く再利用しない。
  //   ここでは攻撃の手触りを log とfxに寄せ、セリフ過多を避ける）。
  let dmg = en.atk;
  game.player.hp -= dmg;
  if (game.player.hp < 0) game.player.hp = 0;

  if (dmg > 0) {
    log(`  ${en.name} の ことばが ささる（HP ${game.player.hp}/${game.player.maxHp}）`);
    pushFx({ t: "pdmg", dmg: dmg }); // 画面の揺れ＋赤フラッシュで“被弾した感”（プレイヤー hp は見えるゲージ）。
    se("hit");
  } else {
    // lowerAtk を重ねて atk が0になった敵は、もう刺してこない＝kind ルートの“耐えた先”の手応え。
    log(`  ${en.name} は もう、つよい ことばを もって いない。`);
  }

  // ゲームオーバー判定（セーブからやり直せる）。
  if (game.player.hp <= 0) {
    onGameOver();
    return;
  }

  // 手番をプレイヤーへ戻す。
  b.turn++;
  b.phase = "player";
}

// ──────────────────────────────────────────
// onGameOver()
//   プレイヤー hp 0。state を GAMEOVER に。やり直しは save.loadGame（ui/main 側の導線）。
//   ※ここではファイルを消したりセーブを壊したりしない（やり直し導線は別レイヤ）。
// ──────────────────────────────────────────
function onGameOver() {
  if (game.battle) game.battle.phase = "end";
  game.state = STATES.GAMEOVER;
  // 専用のゲームオーバー画面へ（決着済みのバトル画面に取り残さない）。
  //   ui.renderGameover が「セーブから やりなおす／タイトルへ」の導線を出す。
  app.screen = "gameover";
  log(`${game.player.displayName} は ことばに のまれて、うずくまった……`);
  pushFx({ t: "lose" });
  se("lose");
  if (typeof window !== "undefined") window.game = game;
}

// ──────────────────────────────────────────
// endBattleToField()
//   報酬3択を経ない場合のフィールド復帰フォールバック（cards.js 未読込時の保険）。
//   通常は cards.pickCard が field へ戻すので、ここは検証/退避用の最小処理。
// ──────────────────────────────────────────
function endBattleToField() {
  game.battle = null;
  game.state = STATES.FIELD;
  app.screen = "field";
}

// ──────────────────────────────────────────
// battleCommandList()（ui 用ヘルパー）
//   手札(ownedCards)を harsh/kind に振り分け、コマンドバーが色分け表示できる形で返す。
//   ★omoiyari（思いやり）の情報は一切含めない＝見えないゲージを UI に漏らさない。
//   各エントリ：{ id, kind, label(=現Lvの言い回し), power, lv, flavor }
//     ・harsh の power は「精神HPダメージ」、kind の power は将来用に持つが UI は“数値を出さない方が無難”
//       （ことに kind は遅さ＝重みを数字で見せない方が没入が保てる。表示するかは ui.js の判断に委ねる）。
// ──────────────────────────────────────────
function battleCommandList() {
  const harsh = [];
  const kind = [];
  for (const id of ownedCards()) {
    const w = WORDS[id];
    if (!w) continue;
    const lv = cardLevel(id);
    const label = (w.levels && w.levels[Math.min(lv - 1, w.levels.length - 1)]) || id;
    const entry = {
      id: id,
      kind: w.kind,            // "harsh" | "kind"（ui の色分け用）。
      label: label,            // 今の Lv に応じた言い回し（育つ手触りをコマンドにも出す）。
      power: cardPower(id),    // harsh=精神HPダメージ。kind は充填量だが ui は出さない判断でよい。
      lv: lv,                  // 1..3。
      flavor: w.flavor || "",
    };
    (w.kind === "kind" ? kind : harsh).push(entry);
  }
  // harsh（速い・凶暴）を左、kind（遅い・優しい）を右に並べる想定で別々に返す。
  return { harsh: harsh, kind: kind };
}

// ── window へ明示エクスポート（headless/ui チェッカは文字列 eval で読むので明示する）。
//   ブラウザ実機でも const/function が window に乗らない環境があるため、念のため代入する。
if (typeof window !== "undefined") {
  window.startBattle = startBattle;
  window.playerCard = playerCard;
  window.enemyTurn = enemyTurn;
  window.winBattle = winBattle;
  window.checkWin = checkWin;
  window.onGameOver = onGameOver;
  window.battleCommandList = battleCommandList;
  window.endBattleToField = endBattleToField;
  // 補助（ui/audio から使う場合に備えて公開）。
  window.flash = window.flash || flash;
  window.pushFx = window.pushFx || pushFx;
}
