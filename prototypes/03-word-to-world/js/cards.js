/*
 * cards.js — ことばを学ぶ「3択」（カード入手／Lv上げ）
 *
 * このゲームの“成長”は2種類ある：
 *   1) 新しいことばを覚える（語彙が増える＝言えることが増える）
 *   2) 同じことばを育てる（Lv1→3、言い方が一段つよく/やさしくなる）
 * どちらも offerCards() の3択を通して起きる。引き＆選びでビルド（人格の傾き）が分岐する。
 *
 * ── 署名メカニクスのうち cards.js が支える核 ──
 *   ・harsh と kind を必ず“混ぜて”出す。3択のたびに「速いが凶暴／遅いが優しい」の
 *     トレードオフを目の前に置き、無意識の癖（=傾向）を一手ずつ積ませる。
 *   ・選んだ瞬間に小さく傾向を動かす（pickHarsh→凶暴 / pickKind→優しさ）。
 *     “選択もまた人格になる”という設計（勝ち方ほどではないが効く）。
 *   ・既知のことばが候補に出たら「Lv上げ」として提示してよい＝同じことばの成長体験。
 *
 * ※ ビルドなし・依存ゼロ。普通の <script> として読まれる（… → save.js → battle.js →
 *   cards.js → … の順）。data.js の WORDS / BALANCE、state.js の addCard/cardLevel/
 *   knowsCard/addKyoubou/addYasashisa/log、audio.js の playSe を前提に動く。
 *   02-saigo-no-tomodachi の cards.js（drawCards/chooseCard）の流儀を踏襲しつつ、
 *   本作の契約に合わせ offerCards(opts?) / pickCard(i) の名前と引数にしている。
 */

// 配列をその場でシャッフル（Fisher–Yates）。3択をランダムに選ぶために使う。
//   02 の shuffle と同形。偏りなく混ぜることで“どのことばに出会うか”の意外性を出す。
function shuffleCards(arr) {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

// ──────────────────────────────────────────
// 1枚分の「カード候補」を WORDS の id から組み立てる
//   表示に必要なものを 1つの辞書にまとめておく（ui.renderCards が素直に描けるように）。
//   ・isLevelUp … 既知のことば＝Lv上げ提示か（新規習得なら false）。
//   ・curLv/nextLv … Lv上げ時の「Lv2 → Lv3」表示用。
//   ・label … 今のLvの“言い方”（levels[lv-1]）。Lv上げなら一段上の言い方を見せる。
//   ・tradeoff … 「速いが凶暴／遅いが優しい」を毎回ことばで明示する核のテキスト。
// ──────────────────────────────────────────
function makeCardOption(id) {
  const w = WORDS[id];
  if (!w) return null; // 未知idは候補にしない（data.js を直接いじったときの事故防止）。

  // 現在Lv（未習得は0）。Lv上げ提示かどうかの判定に使う。
  const cur = (typeof cardLevel === "function") ? cardLevel(id) : 0;
  const isLevelUp = cur > 0;

  // Lv上げのときは「次のLvの言い方」を見せて成長を予感させる。新規なら L1 の言い方。
  //   levels は3要素前提だが、念のため範囲内にクランプして落ちないようにする。
  const showLvIdx = isLevelUp ? Math.min(cur, w.levels.length - 1) // cur(1..2)→次のindex
                              : 0;
  const label = w.levels[Math.max(0, Math.min(showLvIdx, w.levels.length - 1))];

  // トレードオフ文：harsh=速いが凶暴／kind=遅いが優しい、を毎回はっきり言う。
  //   side（kind の耐久補助）があれば、その“やさしさの実利”も一言添える。
  let tradeoff;
  if (w.kind === "harsh") {
    tradeoff = "速いが 凶暴：精神HPを 大きく 削る。けれど 言うほど 世界が 翳る。";
  } else {
    tradeoff = "遅いが 優しい：思いやりを 小刻みに 満たす。勝つには 手数が いる。";
    if (w.side && w.side.healSelf) tradeoff += `（自分の hpも +${w.side.healSelf} 回復）`;
    if (w.side && w.side.lowerAtk) tradeoff += `（相手の こうげきを -${w.side.lowerAtk}）`;
  }

  return {
    id: id,
    kind: w.kind,                 // "harsh" | "kind"（ui の色分け／pick の傾向ナッジに使う）。
    isLevelUp: isLevelUp,         // true=既知のLv上げ提示 / false=新規習得。
    curLv: cur,                   // 0(新規) または 1..2（Lv上げ前）。
    nextLv: isLevelUp ? Math.min(3, cur + 1) : 1, // 取得後のLv（表示用）。
    isMax: isLevelUp && cur >= 3, // 既に最大（出さない方針だが保険で持つ）。
    label: label,                 // 今／次の“言い方”（card-name に出す）。
    flavor: w.flavor || "",       // 一言（card-desc 上段）。
    tradeoff: tradeoff,           // 速い凶暴／遅い優しさ の明示（card-desc 下段＝この作の核）。
  };
}

// ──────────────────────────────────────────
// 3択を提示する
//   opts:
//     ・from   … 入手のきっかけ画面。"field"(戦闘勝利後) / "dialogue"(NPC会話) / "shop" 等。
//                pickCard 後にどこへ戻すかの記憶に使う（途切れない体験のため）。
//     ・pool   … 候補をしぼりたいとき（ショップ等）。未指定なら WORDS 全体から。
//     ・harshKind … true（既定）なら harsh と kind を“必ず混ぜる”。
//   方針（02 drawCards の流儀）：
//     ・最大Lv(3)に達したことばは候補から外す（死にカード防止）。
//     ・harsh/kind を最低1枚ずつ確保してから3枚に整える＝毎回トレードオフを目の前に置く。
//   返り値：3枚のカードオプション配列（game.pendingCards にも入れる）。
// ──────────────────────────────────────────
function offerCards(opts) {
  opts = opts || {};
  const harshKind = opts.harshKind !== false; // 既定で混在させる。

  // 候補の元になる id 群。pool 指定があればそれ、なければ WORDS 全部。
  const baseIds = (opts.pool && opts.pool.length) ? opts.pool.slice() : Object.keys(WORDS);

  // 「まだ伸びる」ことばだけ残す：最大Lv3に達したものは出さない（死にカード防止）。
  const valid = baseIds.filter((id) => {
    if (!WORDS[id]) return false;
    const lv = (typeof cardLevel === "function") ? cardLevel(id) : 0;
    return lv < 3; // 未習得(0)〜Lv2 は候補。Lv3 は除外。
  });

  // harsh/kind に仕分け（混在を保証するため）。
  const harshIds = shuffleCards(valid.filter((id) => WORDS[id].kind === "harsh"));
  const kindIds  = shuffleCards(valid.filter((id) => WORDS[id].kind === "kind"));

  const pickIds = [];
  if (harshKind) {
    // まず harsh と kind を1枚ずつ確保＝毎回「速い凶暴／遅い優しさ」の二択を必ず見せる。
    if (harshIds.length) pickIds.push(harshIds.shift());
    if (kindIds.length)  pickIds.push(kindIds.shift());
  }

  // 残り枠を、両カテゴリの残りを混ぜたプールから埋めて 3枚にする。
  const rest = shuffleCards(harshIds.concat(kindIds));
  while (pickIds.length < 3 && rest.length) {
    pickIds.push(rest.shift());
  }

  // それでも 3枚に満たない（手札が育ち切っている）場合は、出せるものから重複を許して埋める。
  //   体験版では“何度でも3択を出せる”ことを優先（空の3択でゲームが止まらないように）。
  if (pickIds.length < 3) {
    const fallback = valid.length ? valid : Object.keys(WORDS);
    let i = 0;
    while (pickIds.length < 3 && fallback.length) {
      pickIds.push(fallback[i % fallback.length]);
      i++;
    }
  }

  // id をカードオプションへ変換（null は念のため除去）。
  const cards = pickIds.map((id) => makeCardOption(id)).filter(Boolean).slice(0, 3);

  // pendingCards に “3択そのもの” と “戻り先などの文脈” を一緒に持たせる。
  //   配列としても扱えるよう、まずは配列を入れ、付帯情報は別フィールドで保持する。
  game.pendingCards = cards;
  game.cardsContext = {
    from: opts.from || app.screen || "field", // 既定はフィールド復帰（戦闘勝利後の主用途）。
    reason: opts.reason || null,              // "win"(勝利報酬) / "npc" / "shop" 等の任意ラベル。
  };

  // 画面をカード提示へ。STATES（モデル進行）は呼び元（battle/field）が管理するため触らない。
  app.screen = "cards";
  return cards;
}

// ──────────────────────────────────────────
// 3択から1枚を選ぶ
//   i：選んだカードの“添字”（0..2）。ui 側はクリックされたカードの index を渡す。
//   やること：
//     1) addCard で習得 or Lv上げ（state.js が learned/leveled/max を返す）。
//     2) 選んだ瞬間の傾向ナッジ：harsh→addKyoubou(pickHarsh) / kind→addYasashisa(pickKind)。
//        “選択もまた人格になる”（勝ち方ほど大きくはないが、無意識の癖として積む）。
//     3) 提示を閉じ、文脈(from)に応じて元の画面へ戻して続行する。
//   返り値：addCard の結果（"learned"|"leveled"|"max"）。ui のトースト出し分けに使える。
// ──────────────────────────────────────────
function pickCard(i) {
  const cards = game.pendingCards || [];
  const card = cards[i];
  if (!card) return null; // 範囲外クリック等は無視（安全側）。

  if (typeof playSe === "function") playSe("select"); // 選択音（02 同様、操作のフィードバック）。

  // 1) 習得 or Lv上げ。state.js の addCard が辞書を更新して結果文字列を返す。
  const result = (typeof addCard === "function") ? addCard(card.id) : "max";

  // 2) 選択による傾向ナッジ（小）。kind/harsh で別の軸を積む。
  //    最大Lv済み(max)でも“選んだ”事実は人格に効くので、ナッジは結果に関わらず行う。
  if (card.kind === "harsh") {
    if (typeof addKyoubou === "function") addKyoubou(BALANCE.pickHarsh);
  } else {
    if (typeof addYasashisa === "function") addYasashisa(BALANCE.pickKind);
  }

  // ログ：覚えたのか／育てたのか／既に最大か、で文言を変える（成長の手触りを言語化）。
  if (typeof log === "function") {
    if (result === "learned") {
      log(`あたらしい ことばを おぼえた：「${card.label}」`);
    } else if (result === "leveled") {
      log(`「${card.label}」を Lv${card.nextLv} に 育てた。`);
    } else {
      // max：これ以上育たないことばを選んだ（候補から外している想定だが保険）。
      log(`「${card.label}」は もう これ以上 育たない。`);
    }
  }

  // 3) 提示を閉じる。文脈は pickCard 内で先に読んでからクリアする。
  const ctx = game.cardsContext || { from: "field" };
  game.pendingCards = null;
  game.cardsContext = null;

  // 戻り先へ。戦闘勝利後はフィールド、NPC会話/ショップ等は元画面へ続行する。
  //   STATES（モデル進行）は呼び元が握るので、ここではビュー(app.screen)だけ戻す。
  //   ※ field.js / battle.js 側で screen 切替の最終調整をしてよい（責務の重複を避ける）。
  app.screen = ctx.from || "field";
  return result;
}

// ── window へ明示エクスポート（headless/ui チェッカは文字列 eval で読むので明示する）。
//   ブラウザ実機でも const/function が window に乗らない環境があるため、念のため代入する。
if (typeof window !== "undefined") {
  window.shuffleCards = shuffleCards;
  window.makeCardOption = makeCardOption;
  window.offerCards = offerCards;
  window.pickCard = pickCard;
}
