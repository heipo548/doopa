/*
 * battle.js — 戦闘ロジック（コマンド処理・敵ターン・状態遷移）
 *
 * プレイヤーが1コマンド選ぶ → 敵ターンで群れが反撃、の繰り返し。
 * 各コマンド関数は「ターンを消費したら true / 弾いたら false」を返します。
 * UI 側は true のときだけ画面を進める想定。
 *
 * 仕様の核：祓う＝1ターンで即・強く／救う＝数ターン＆こころ消費＆その間も被弾。
 * この“非対称”がプレイヤーを毎ターン迷わせる。
 */

// ──────────────────────────────────────────
// 共通：UI へ一時メッセージ（トースト）を出す。ui.js の showToast があれば使う。
// （戦闘ログを汚さずに「こころが足りない」等の却下理由を伝えるため）
// ──────────────────────────────────────────
function flash(msg) {
  if (typeof showToast === "function") showToast(msg);
}

// uid から “まだ場にいる” 敵を探す
function findEnemy(uid) {
  return game.enemies.find((e) => e.uid === uid && !e.dead && !e.saved) || null;
}

// ──────────────────────────────────────────
// ダメージを与える（HP0で「祓った＝殲滅」）
// ──────────────────────────────────────────
function applyDamage(enemy, dmg) {
  enemy.hp -= dmg;
  if (enemy.hp <= 0) {
    enemy.hp = 0;
    if (!enemy.dead && !enemy.saved) {
      enemy.dead = true;
      game.counters.kill++;
      game.player.exp += BALANCE.expPerKill; // 祓うと EXP 多め＝早く強くなる
      log(`  ${enemy.name} を 祓った（殲滅 +1）`);
    }
  } else {
    log(`  ${enemy.name} に ${dmg} ダメージ（HP ${enemy.hp}/${enemy.maxHp}）`);
  }
}

// 心の壁を下げる（0になると「すくえそう」）
function reduceWall(enemy, amount) {
  if (enemy.dead || enemy.saved) return;
  const before = enemy.wall;
  enemy.wall = Math.max(0, enemy.wall - amount);
  if (enemy.wall === 0 && before > 0) {
    log(`  ${enemy.name} の心の壁が ほどけた…「すくえそう」`);
  }
}

// ──────────────────────────────────────────
// 祓う（FIGHT/KILL）：装備中の武器で攻撃。武器ごとに対象が違う。
//   weaponId: 使う武器 ／ targetUid: 単体武器のときの対象
// ──────────────────────────────────────────
function cmdFight(weaponId, targetUid) {
  if (game.state !== STATES.PLAYER_TURN) return false;
  if (!game.player.weapons.includes(weaponId)) return false;
  const w = WEAPONS[weaponId];

  // 対象を決める（単体は指定、それ以外は自動）
  let targets = [];
  if (w.target === "single") {
    const t = findEnemy(targetUid);
    if (!t) return false;
    targets = [t];
  } else if (w.target === "front2") {
    targets = frontEnemies(2);
  } else if (w.target === "front3") {
    targets = frontEnemies(3);
  } else if (w.target === "all") {
    targets = livingEnemies();
  }
  if (targets.length === 0) return false;

  const base = weaponPower(weaponId);
  log(`▶ ${game.player.name} の「${w.name}」！`);
  for (const t of targets) {
    let dmg = base;
    // パッシブ「ふかいかなしみ」：悲しむ敵への与ダメ＋
    if (hasPassive("fukai") && t.sad) dmg += BALANCE.fukaiBonus;
    // パッシブ「おこりんぼ」：前列攻撃の与ダメ＋
    if (hasPassive("okori") && (w.target === "front2" || w.target === "front3")) {
      dmg += BALANCE.okoriBonus;
    }
    applyDamage(t, dmg);
    // 進化武器（大こうずい/救済の光）は壁も下げる＝祓いながら救済準備
    if (w.wallDown) reduceWall(t, w.wallDown);
  }
  endPlayerTurn();
  return true;
}

// ──────────────────────────────────────────
// こころみる（ACT）：心の壁を下げる。敵ごとに効くACTが違う＝手順パズル。
// ──────────────────────────────────────────
function cmdAct(actId, targetUid) {
  if (game.state !== STATES.PLAYER_TURN) return false;
  const t = findEnemy(targetUid);
  if (!t) return false;
  if (game.player.kokoro < BALANCE.actCost) {
    flash("こころが足りない");
    return false;
  }
  const act = ACTS[actId];
  game.player.kokoro -= BALANCE.actCost; // 効いても外しても こころは減る（＝手探りのコスト）
  log(`▶ ${game.player.name} は ${t.name} に「${act.name}」`);

  if (t.acts.includes(actId)) {
    reduceWall(t, act.wall || 1);
    if (act.atkDown) {
      t.atk = Math.max(0, t.atk - act.atkDown);
      log(`  ${t.name} の攻撃力が さがった（${t.atk}）`);
    }
    if (act.silence) {
      t.status.silence = Math.max(t.status.silence, act.silence);
      log(`  ${t.name} は ひるんでいる（次ターン無力化）`);
    }
  } else {
    // 効かないACT＝壁は下がらないが、こころとターンは消費済み
    log(`  …${t.name} には 響いていない（このACTは効かない）`);
  }
  endPlayerTurn();
  return true;
}

// ──────────────────────────────────────────
// すくう（SAVE/MERCY）：心の壁0の敵を戦線から外す。救済+1・記憶のカケラ+1。
// ──────────────────────────────────────────
function cmdSave(targetUid) {
  if (game.state !== STATES.PLAYER_TURN) return false;
  const t = findEnemy(targetUid);
  if (!t) return false;
  if (t.wall > 0) {
    flash("まだ心の壁がある");
    return false;
  }
  if (game.player.kokoro < BALANCE.saveCost) {
    flash("こころが足りない");
    return false;
  }
  game.player.kokoro -= BALANCE.saveCost;
  t.saved = true;
  game.counters.save++;
  game.counters.memory++;
  game.player.exp += BALANCE.expPerSave; // 救うと EXP 少なめ（代わりに記憶のカケラ）
  log(`▶ ${t.name} を すくった！（救済 +1・記憶のカケラ +1）`);

  // すくう と少し回復＝救済ルート固有の“持続力”。慈悲を重ねるほど夜を生き延びられる。
  if (BALANCE.saveHeal > 0 && game.player.hp < game.player.maxHp) {
    const before = game.player.hp;
    game.player.hp = Math.min(game.player.maxHp, game.player.hp + BALANCE.saveHeal);
    log(`  つながりがあたたかい（HP +${game.player.hp - before}）`);
  }

  // パッシブ「やさしいて」：隣（pos差1）の1体の壁を連鎖で−1
  if (hasPassive("yasashii")) {
    const neighbor = livingEnemies().find((e) => Math.abs(e.pos - t.pos) === 1);
    if (neighbor) {
      reduceWall(neighbor, 1);
      log(`  やさしいて：となりの ${neighbor.name} の壁が −1`);
    }
  }
  endPlayerTurn();
  return true;
}

// ──────────────────────────────────────────
// どうぐ（ITEM）：回復など。所持数制限あり（リソース管理）。
// ──────────────────────────────────────────
function cmdItem(itemId) {
  if (game.state !== STATES.PLAYER_TURN) return false;
  if (!game.player.items[itemId] || game.player.items[itemId] <= 0) {
    flash("そのどうぐが無い");
    return false;
  }
  const item = ITEMS[itemId];
  game.player.items[itemId]--;
  if (item.effect === "heal") {
    const before = game.player.hp;
    game.player.hp = Math.min(game.player.maxHp, game.player.hp + item.amount);
    log(`▶ 「${item.name}」を つかった（HP +${game.player.hp - before}）`);
  }
  endPlayerTurn();
  return true;
}

// ──────────────────────────────────────────
// まもる（DEFEND）：このターンの被ダメ大幅減。全体攻撃ウェーブのしのぎ手段。
// ──────────────────────────────────────────
function cmdDefend() {
  if (game.state !== STATES.PLAYER_TURN) return false;
  game.player.defending = true;
  log(`▶ ${game.player.name} は 身をかまえた（このターン被ダメ減）`);
  endPlayerTurn();
  return true;
}

// ──────────────────────────────────────────
// プレイヤーのターン終わり → クリア判定 → 敵ターン → 死亡判定
// ──────────────────────────────────────────
function endPlayerTurn() {
  if (waveCleared()) {
    onWaveCleared();
    return;
  }
  runEnemyTurn();
  if (game.player.hp <= 0) {
    onRunOver();
    return;
  }
  // 次のプレイヤーターンへ
  game.turn++;
  game.player.defending = false; // まもるは直後の敵ターン1回だけ有効
  game.state = STATES.PLAYER_TURN;
}

// ──────────────────────────────────────────
// 敵ターン：場の敵が主人公を攻撃（PoCは仲間なしなので全攻撃が主人公へ）
// ──────────────────────────────────────────
function runEnemyTurn() {
  game.state = STATES.ENEMY_TURN;
  const living = livingEnemies();
  if (living.length === 0) return;
  log("― 群れの反撃 ―");
  let total = 0;
  for (const e of living) {
    // 心の壁がほどけた敵（wall<=0）は おだやかになり、もう攻撃してこない。
    // ＝「壁を下げる」こと自体が被弾を減らす手段になり、すくうルートが成立する。
    // （祓うルートは敵を消すので元から被弾が減る。救うルートにも“同等の生存手段”を与える狙い）
    if (e.wall <= 0) {
      log(`  ${e.name} は おだやかな顔で待っている`);
      continue;
    }
    // 無力化中はスキップ（よびかける の効果）
    if (e.status.silence > 0) {
      e.status.silence--;
      log(`  ${e.name} は 動けない`);
      continue;
    }
    // パッシブ「はやあし」：一定確率で被弾を回避
    if (hasPassive("hayaashi") && Math.random() < BALANCE.hayaashiDodgeRate) {
      log(`  ${e.name} の攻撃を かわした！`);
      continue;
    }
    let dmg = e.atk;
    if (game.player.defending) {
      dmg = Math.ceil(dmg * (1 - BALANCE.defendReduction)); // 70%カット
    }
    total += dmg;
  }
  game.player.hp -= total;
  if (game.player.hp < 0) game.player.hp = 0;
  if (total > 0) {
    log(`  ${game.player.name} は ${total} ダメージ（HP ${game.player.hp}/${game.player.maxHp}）`);
  } else {
    log(`  …攻撃は とどかなかった`);
  }
}

// ──────────────────────────────────────────
// ウェーブクリア（全滅 or 全救済）
// ──────────────────────────────────────────
function onWaveCleared() {
  game.state = STATES.WAVE_CLEAR;
  log(`― WAVE ${waveNumber()} クリア ―`);

  if (isBossWave()) {
    onDawn(); // ボスを退けたら夜明け
    return;
  }

  // 通常レベルアップ1回 ＋ EXPがたまっていればボーナス回数を追加
  // （祓って稼いだEXPで“もう1回3択”＝早く強くなる道を表現）
  game.pendingLevelUps = 1;
  while (game.player.exp >= BALANCE.expToBonusLevel) {
    game.player.exp -= BALANCE.expToBonusLevel;
    game.pendingLevelUps++;
  }
  beginLevelUp();
}

// レベルアップ開始：3択を1セット用意（cards.js）
function beginLevelUp() {
  game.player.level++;
  game.pendingCards = drawCards();
  game.state = STATES.LEVEL_UP;
}

// 3択を選び終えた後に呼ばれる：残りがあればもう1セット、無ければ次ウェーブ
function afterCardChosen() {
  game.pendingLevelUps--;
  if (game.pendingLevelUps > 0) {
    beginLevelUp();
    return;
  }
  game.waveIndex++;
  if (game.waveIndex >= totalWaves()) {
    onDawn();
    return;
  }
  startWave();
}

// ──────────────────────────────────────────
// 夜明け（DAWN）：救済率で結末を確定＋計測ログ出力
// ──────────────────────────────────────────
function onDawn() {
  const stats = runStats();
  game.ending = determineEnding(stats.saveRate);
  game.state = STATES.DAWN;
  log(`夜が明ける…（救済率 ${Math.round(stats.saveRate * 100)}%）`);
  // 仕様書「計測の仕込み」：ラン毎に殲滅/救済/時間/到達ウェーブを出力
  console.log("[さいごのともだち] RUN STATS", stats, "ending =", game.ending.id);
}

// ──────────────────────────────────────────
// RUN OVER（HP0）
// ──────────────────────────────────────────
function onRunOver() {
  game.state = STATES.RUN_OVER;
  log(`${game.player.name} は たおれてしまった… RUN OVER`);
  console.log("[さいごのともだち] RUN OVER", runStats());
}

// ──────────────────────────────────────────
// ラン開始（newGame して最初のウェーブへ）
// ──────────────────────────────────────────
function startRun() {
  newGame();
  startWave();
}
