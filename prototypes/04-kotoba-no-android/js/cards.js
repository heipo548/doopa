/*
 * cards.js — ことばカードの3択（入手の瞬間の選択）
 *
 * NPC に「どの言葉を知りたい?」と投げかけられ、提示された3枚から1枚を選ぶ。
 * 何を選ぶか（とがった/やわらかい）が、人格を傾ける“最初の選択”になる。
 *   ・選ぶだけで pickHarsh/pickKind ぶん傾向が少し動く（バトル前から人格は始まっている）。
 *   ・既知のことばを選べば Lv が上がる（同じことばを育てる手触り）。
 *
 * ※ DOM 非依存。battle.js を参照しない（疎結合）。末尾で window へ明示エクスポート。
 */

// ──────────────────────────────────────────
// offerCards(npcId) — NPC が用意した3枚を提示状態にする。
//   data の NPCS[npcId].gives（3つの wordId）をそのまま提示。
// ──────────────────────────────────────────
function offerCards(npcId) {
  const npc = NPCS[npcId];
  if (!npc || !Array.isArray(npc.gives) || npc.gives.length === 0) return false;
  // 実在id だけに絞る（データ事故防止）。3枚に満たなくても落ちない。
  game.pendingCards = npc.gives.filter((id) => !!WORDS[id]);
  game.state = STATES.CARDS;
  app.screen = "cards";
  return true;
}

// ──────────────────────────────────────────
// chooseCard(wordId) — 提示3枚から1枚を選ぶ。
//   手札へ加える（既知なら Lv↑）。選んだ色で傾向を少し傾ける。got_card を立てる。
//   戻り値：addCard の結果（"learned"/"leveled"/"max"）。
// ──────────────────────────────────────────
function chooseCard(wordId) {
  if (!game.pendingCards || game.pendingCards.indexOf(wordId) < 0) return null; // 提示外は無効
  const w = WORDS[wordId];
  if (!w) return null;

  const r = addCard(wordId);

  // 入手の瞬間にも“人格”が少し動く（強いが凶暴／弱いが優しい のトレードオフ）。
  if (w.kind === "harsh") addKyoubou(BALANCE.pickHarsh);
  else addYasashisa(BALANCE.pickKind);

  game.pendingCards = null;
  setFlag("got_card");
  log("「" + w.levels[0] + "」を ひろった。");
  return r;
}

// ── window へ明示エクスポート ──
if (typeof window !== "undefined") {
  window.offerCards = offerCards;
  window.chooseCard = chooseCard;
}
