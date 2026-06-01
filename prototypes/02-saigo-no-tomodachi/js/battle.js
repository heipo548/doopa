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

// ──────────────────────────────────────────
// 演出イベントを積む（UI が render 後に消費して、数字のフロートや画面の揺れを出す）。
// battle.js は DOM を触らない（JXA でのコア検証を壊さない）ため、
// 「何が起きたか」だけを game.fx に残し、見せ方は ui.js に任せる。
// ──────────────────────────────────────────
function pushFx(ev) {
  if (game && Array.isArray(game.fx)) game.fx.push(ev);
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
      game.player.exp += BALANCE.expPerKill; // ぶつけて退けると EXP 多め＝早く強くなる
      log(`  ${enemy.name} は ことばに 背を向けて 消えた…（おいはらった +1）`);
      pushFx({ t: "hit", uid: enemy.uid, dmg: dmg, dead: true }); // とどめ＝消える演出
    }
  } else {
    log(`  ${enemy.name} に ${dmg} ダメージ（HP ${enemy.hp}/${enemy.maxHp}）`);
    pushFx({ t: "hit", uid: enemy.uid, dmg: dmg, dead: false }); // ダメージ数字＋ゆれ
  }
}

// 心の壁を下げる（0になると「すくえそう」）
function reduceWall(enemy, amount) {
  if (enemy.dead || enemy.saved) return;
  const before = enemy.wall;
  enemy.wall = Math.max(0, enemy.wall - amount);
  if (enemy.wall === 0 && before > 0) {
    log(`  ${enemy.name} の心の壁が ほどけた…「すくえそう」`);
    pushFx({ t: "calm", uid: enemy.uid }); // おだやかになった瞬間の演出
  }
}

// ──────────────────────────────────────────
// ぶつける（FIGHT/KILL）：きついことばを相手にぶつける。ことばごとに対象が違う。
//   ※武器で殴るのではなく、言えなかった/とげとげした言葉をぶつける行動。
//   weaponId: 使う きついことば の id ／ targetUid: 単体ことばのときの対象
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

  // 狂気が高いほど ことばが鋭くなる（雪だるま）。倍率は控えめ＝“ぶつける一強”を避ける。
  const kyokiMul = 1 + game.player.kyoki * BALANCE.kyokiDmgScale;
  const base = weaponPower(weaponId);
  const said = w.word || w.name;
  game.lastWord = said;
  log(`▶ ${game.player.name}「${said}」！`);
  // 言ったことばを吹き出しで見せる（とげとげ＝不穏なトーン）
  pushFx({ t: "speak", text: said, cat: w.category || "toge" });
  for (const t of targets) {
    let dmg = base;
    // パッシブ「ふかいかなしみ」：悲しむ相手への与ダメ＋
    if (hasPassive("fukai") && t.sad) dmg += BALANCE.fukaiBonus;
    // パッシブ「おこりんぼ」：前列ことばの与ダメ＋
    if (hasPassive("okori") && (w.target === "front2" || w.target === "front3")) {
      dmg += BALANCE.okoriBonus;
    }
    dmg = Math.max(1, Math.round(dmg * kyokiMul)); // 狂気倍率を最後に乗せる（最低1）
    applyDamage(t, dmg);
    // 進化ことば（もう みんな きらい／いっしょに かえろう）は壁も下げる
    if (w.wallDown) reduceWall(t, w.wallDown);
  }
  // ことばの性質に応じて 狂気／ぬくもり を積む（「いっしょに かえろう」は ぬくもり側）
  if (w.kyoki) { gainKyoki(w.kyoki); pushFx({ t: "kyoki", amount: w.kyoki }); }
  if (w.nukumori) { const r = gainNukumori(w.nukumori); pushFx({ t: "nukumori", amount: w.nukumori, bonus: r }); }
  endPlayerTurn();
  return true;
}

// ──────────────────────────────────────────
// きいてみる（ACT）：相手に問いかける／やさしいことばをかける。
//   相手の声をきこうとする行動。敵ごとに「効くことばが違う」＝相手の声をきく手順パズル。
//   ・生まれつきの問いかけ(ACTS)：その相手に効けば 心の壁を下げる（atkDown/とめる も）。
//   ・学んで覚えた やさしいことば(KIND_WORDS)：相手を選ばず ことば固有の効果（回復/とげ↓/沈黙）が届く。
//   どちらも やさしく言えたぶん “ぬくもり” がたまる（救いルートの雪だるま）。
// ──────────────────────────────────────────
function cmdAct(actId, targetUid) {
  if (game.state !== STATES.PLAYER_TURN) return false;
  const t = findEnemy(targetUid);
  if (!t) return false;
  if (!knowsWord(actId)) return false;         // まだ覚えていないことばは使えない
  if (game.player.kokoro < BALANCE.actCost) {
    flash("こころが足りない");
    return false;
  }
  const word = wordById(actId);
  if (!word) return false;
  game.player.kokoro -= BALANCE.actCost; // 効いても外しても こころは減る（＝手探りのコスト）
  const said = word.word || word.name;
  game.lastWord = said;
  log(`▶ ${game.player.name}「${said}」（${t.name}へ）`);
  pushFx({ t: "speak", text: said, cat: word.category || "toi" });

  const isKind = !!KIND_WORDS[actId];          // 学んだ汎用語かどうか
  const effective = t.acts.includes(actId);    // 生まれつきの問いかけが、この相手に効くか
  let didSomething = false;

  // 生まれつきの問いかけ：効く相手にだけ 壁・とめる・とげ↓（手順パズルを保つ）
  if (effective) {
    reduceWall(t, word.wall || 1);
    if (word.atkDown) {
      t.atk = Math.max(0, t.atk - word.atkDown);
      log(`  ${t.name} の とげが すこし やわらいだ（攻撃 ${t.atk}）`);
    }
    if (word.silence) {
      t.status.silence = Math.max(t.status.silence, word.silence);
      log(`  ${t.name} は ことばに 立ちどまっている（次ターン うごけない）`);
    }
    didSomething = true;
  }

  // 学んだ やさしいことば：相手を選ばず “ことば固有の効果” が届く
  if (isKind) {
    if (word.heal && game.player.hp < game.player.maxHp) {
      const before = game.player.hp;
      game.player.hp = Math.min(game.player.maxHp, game.player.hp + word.heal);
      log(`  じぶんの こころも すこし軽くなった（HP＋${game.player.hp - before}）`);
      pushFx({ t: "pheal", amount: game.player.hp - before });
      didSomething = true;
    }
    if (word.atkDown) {
      t.atk = Math.max(0, t.atk - word.atkDown);
      log(`  ${t.name} の とげが やわらいだ（攻撃 ${t.atk}）`);
      didSomething = true;
    }
    // 沈黙（…）は、さみしい子の壁だけ そっと ほどく
    if (word.sadWall && t.sad) {
      reduceWall(t, word.sadWall);
      didSomething = true;
    }
  }

  if (!didSomething) {
    if (word.category === "silence") log(`  …しずかな間が ながれた`);
    else log(`  …${t.name} には 響いていない（このことばは いまの相手に効かない）`);
  }

  // やさしさ／とげ のゲージ（ことばの性質に応じて）
  if (word.nukumori) { const r = gainNukumori(word.nukumori); pushFx({ t: "nukumori", amount: word.nukumori, bonus: r }); }
  if (word.kyoki) { gainKyoki(word.kyoki); pushFx({ t: "kyoki", amount: word.kyoki }); }

  endPlayerTurn();
  return true;
}

// ──────────────────────────────────────────
// 手をのばす（SAVE/MERCY）：もう攻撃せず、心の壁0の相手を こちら側に迎える。
//   救済+1・きずな+1。そして その子の“ことば”を教わる＝語彙が増える（救済→成長の接続）。
// ──────────────────────────────────────────
function cmdSave(targetUid) {
  if (game.state !== STATES.PLAYER_TURN) return false;
  const t = findEnemy(targetUid);
  if (!t) return false;
  if (t.wall > 0) {
    flash("まだ心の壁がある（先に きいてみる）");
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
  game.player.exp += BALANCE.expPerSave; // むかえると EXP 少なめ（代わりに きずな と ことば が積み上がる）
  game.lastWord = "いっしょに かえろう";
  log(`▶ ${game.player.name}「いっしょに かえろう」 — ${t.name} に 手をのばした（むかえた +1・きずな +1）`);
  pushFx({ t: "speak", text: "いっしょに かえろう", cat: "yasashii" });
  pushFx({ t: "save", uid: t.uid }); // むかえた瞬間の やわらかい演出

  // むかえた友から “ことば” を教わる＝言えることが増える（救済→語彙の接続）。
  const base = ENEMIES[t.type] || {};
  if (base.gift) learnWord(base.gift);

  // 手をのばす行為そのものにも ぬくもりが宿る（救いルートの雪だるまを後押し）
  { const r = gainNukumori(1); pushFx({ t: "nukumori", amount: 1, bonus: r }); }

  // すくう と少し回復＝救済ルート固有の“持続力”。慈悲を重ねるほど夜を生き延びられる。
  if (BALANCE.saveHeal > 0 && game.player.hp < game.player.maxHp) {
    const before = game.player.hp;
    game.player.hp = Math.min(game.player.maxHp, game.player.hp + BALANCE.saveHeal);
    const got = game.player.hp - before;
    log(`  つながりがあたたかい（HP +${got}）`);
    pushFx({ t: "pheal", amount: got });
  }

  // いま「きずな」が群れの反撃をどれだけ和らげているかを、その場で見せる＝救う見返りの可視化。
  const bondNow = (typeof bondReduction === "function") ? bondReduction() : 0;
  if (bondNow > 0) log(`  きずな：助けた友が 反撃を −${bondNow} かばってくれる`);

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
// もちもの（ITEM）：おまもり・思い出など、小さな持ち物。回復など。所持数制限あり。
// ──────────────────────────────────────────
function cmdItem(itemId) {
  if (game.state !== STATES.PLAYER_TURN) return false;
  if (!game.player.items[itemId] || game.player.items[itemId] <= 0) {
    flash("その もちものが 無い");
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
// こらえる（DEFEND）：傷ついても耐える／ことばを飲み込む。このターンの被ダメ大幅減。
//   全体攻撃ウェーブのしのぎ手段。静かに待てば こころも すこし戻る（runEnemyTurn 参照）。
// ──────────────────────────────────────────
function cmdDefend() {
  if (game.state !== STATES.PLAYER_TURN) return false;
  game.player.defending = true;
  log(`▶ ${game.player.name} は ことばを のみこんで こらえた（このターン被ダメ減）`);
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
  // きずな：これまで救った友が、夜のあいだ かばってくれる＝群れの反撃をやわらげる。
  //   「救う」に“あとで効いてくる”見返りを与え、慈悲を重ねるほど生き延びやすくする核。
  const bond = (typeof bondReduction === "function") ? bondReduction() : 0;
  if (total > 0 && bond > 0) {
    const before = total;
    total = Math.max(0, total - bond);
    if (before > total) log(`  きずな：助けた友が かばってくれた（−${before - total}）`);
  }

  game.player.hp -= total;
  if (game.player.hp < 0) game.player.hp = 0;
  if (total > 0) {
    log(`  ${game.player.name} は ${total} ダメージ（HP ${game.player.hp}/${game.player.maxHp}）`);
    pushFx({ t: "pdmg", dmg: total }); // 画面の揺れ＋赤フラッシュで“被弾した感”を出す
  } else {
    log(`  …攻撃は とどかなかった`);
  }

  // しずけさの回復：このターン被弾0（total===0）かつ まだ救うべき敵が残っていて、
  //   こころに空きがあるなら、待つほど主人公が少しずつ こころを取り戻す。
  // なぜここか：こころは startWave でしか満タンに戻らないので、ウェーブ途中でこころが枯れ、
  //   残るのが「壁0＝おだやかで殴ってこない友」だけになると平和ルートが詰む（救う燃料が二度と戻らない）。
  //   被弾しているターンは回復しない＝祓う即殺の速さの優位は保ったまま、
  //   「静かな夜に待てば必ず救える」をデータ駆動の小さな加点で成立させる。
  if (
    total === 0 &&
    living.length > 0 &&
    BALANCE.calmKokoroRegen > 0 &&
    game.player.kokoro < game.player.maxKokoro
  ) {
    const before = game.player.kokoro;
    game.player.kokoro = Math.min(
      game.player.maxKokoro,
      game.player.kokoro + BALANCE.calmKokoroRegen
    );
    const got = game.player.kokoro - before;
    if (got > 0) {
      log(`  静けさに、こころが すこし もどる（＋${got}）`);
      pushFx({ t: "kregen", amount: got }); // UI が拾えれば こころ回復の演出に使える（無ければ無視される）
    }
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
