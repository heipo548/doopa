/*
 * cards.js — ローグライトの3択と、武器進化（イボルブ）
 *
 * ウェーブクリアごとに3枚提示 → 1枚取得。引きと選択でビルドが分岐する＝リプレイ性。
 * 取得後に「武器Lv MAX ＋ 対応パッシブ」がそろっていれば、自動で究極形態へ進化。
 */

// 配列をその場でシャッフル（Fisher–Yates）。3択をランダムに選ぶために使う。
function shuffle(arr) {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

// 1つの武器が「これ以上強化できるか（進化前かつLv未満）」
function canUpgradeAnyWeapon() {
  return game.player.weapons.some(
    (id) => !WEAPONS[id].evolved && weaponLevel(id) < BALANCE.weaponMaxLv
  );
}

// ──────────────────────────────────────────
// 3択カードを引く
//   ・すでに持っている武器／パッシブは出さない
//   ・武器強化は「強化できる武器がある時だけ」出す（死にカード防止）
//   ・候補が3枚に満たないときは +たいりょく/+こころ で埋める（何度でも取れる）
// ──────────────────────────────────────────
function drawCards() {
  const p = game.player;
  const valid = CARDS.filter((c) => {
    if (c.type === "weapon") return !p.weapons.includes(c.weapon);
    if (c.type === "passive") return !p.passives[c.key];
    if (c.type === "weaponLv") return canUpgradeAnyWeapon();
    return true; // maxHp / maxKokoro は重ねがけOK
  });

  const pool = shuffle(valid.slice());
  const pick = pool.slice(0, 3);

  if (pick.length < 3) {
    const fillers = CARDS.filter((c) => c.id === "hp" || c.id === "kokoro");
    let i = 0;
    while (pick.length < 3) {
      pick.push(fillers[i % fillers.length]);
      i++;
    }
  }
  return pick;
}

// ──────────────────────────────────────────
// カードを1枚選んで効果を適用する
//   card: 選んだカード ／ param: 武器強化のとき「どの武器を強化するか」のID
// ──────────────────────────────────────────
function chooseCard(card, param) {
  const p = game.player;

  if (card.type === "weapon") {
    if (!p.weapons.includes(card.weapon)) {
      p.weapons.push(card.weapon);
      p.weaponLv[card.weapon] = 1;
    }
    log(`カード獲得：新武器「${WEAPONS[card.weapon].name}」`);

  } else if (card.type === "weaponLv") {
    // param が無ければ「進化前の武器」から自動で1つ選ぶ
    let target = param;
    if (!target || WEAPONS[target].evolved) {
      target = p.weapons.find((id) => !WEAPONS[id].evolved && weaponLevel(id) < BALANCE.weaponMaxLv);
    }
    if (target) {
      p.weaponLv[target] = Math.min(BALANCE.weaponMaxLv, weaponLevel(target) + 1);
      log(`カード獲得：「${WEAPONS[target].name}」を Lv${p.weaponLv[target]} に強化`);
    }

  } else if (card.type === "maxHp") {
    p.maxHp += card.amount;
    p.hp += card.amount; // 増えた分はその場で回復
    log(`カード獲得：最大HP +${card.amount}`);

  } else if (card.type === "maxKokoro") {
    p.maxKokoro += card.amount;
    p.kokoro = Math.min(p.maxKokoro, p.kokoro + card.amount);
    log(`カード獲得：最大こころ +${card.amount}`);

  } else if (card.type === "passive") {
    p.passives[card.key] = true;
    log(`カード獲得：パッシブ「${card.name}」`);
  }

  game.pendingCards = null;
  checkEvolutions();  // 取得後、進化条件を満たしたら進化
  afterCardChosen();  // battle.js：もう1回3択 or 次のウェーブへ
}

// ──────────────────────────────────────────
// 武器進化のチェック（武器Lv MAX ＋ 対応パッシブ取得 → 究極形態へ）
// ──────────────────────────────────────────
function checkEvolutions() {
  for (const id of game.player.weapons.slice()) {
    const w = WEAPONS[id];
    if (!w || w.evolved || !w.evolveTo) continue;
    if (weaponLevel(id) >= BALANCE.weaponMaxLv && hasPassive(w.evolveKey)) {
      evolveWeapon(id);
    }
  }
}

function evolveWeapon(fromId) {
  const w = WEAPONS[fromId];
  const toId = w.evolveTo;
  const idx = game.player.weapons.indexOf(fromId);
  if (idx >= 0) game.player.weapons[idx] = toId; // 武器リストを進化形に差し替え
  delete game.player.weaponLv[fromId];
  log(`★進化！「${w.name}」が「${WEAPONS[toId].name}」になった！`);
  // UI に進化演出フックがあれば呼ぶ
  if (typeof onEvolve === "function") onEvolve(WEAPONS[toId]);
}
