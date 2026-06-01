/*
 * state.js — ゲームの状態と、有限ステートマシンの土台
 *
 * 仕様書の「バトルは有限ステートマシン
 *   （WaveStart→PlayerTurn⇄EnemyTurn→Clear→LevelUp→…→Boss→Dawn）」を表現します。
 * ここでは “状態そのもの” と “状態を作る・調べる” 関数を置き、
 * 実際の戦闘処理は battle.js、3択は cards.js に分けています（責務の分離）。
 */

// バトルの状態（ステートマシンの各ステート）
const STATES = {
  RUN_START: "RUN_START",     // ラン開始
  WAVE_START: "WAVE_START",   // 群れが出現
  PLAYER_TURN: "PLAYER_TURN", // プレイヤーがコマンドを選ぶ
  ENEMY_TURN: "ENEMY_TURN",   // 群れの反撃
  WAVE_CLEAR: "WAVE_CLEAR",   // 全滅 or 全救済
  LEVEL_UP: "LEVEL_UP",       // 3択でビルド強化
  DAWN: "DAWN",               // 夜明け＝結末分岐
  RUN_OVER: "RUN_OVER",       // HP0。最初から
};

// 現在のランの状態（1ラン分をまるごと保持するグローバル）
let game = null;

// 敵インスタンスに付ける通し番号（同じ種類が複数いても区別できるように）
let _enemyUid = 0;

// ──────────────────────────────────────────
// 新しいランを作る（ローグライトなので失敗したら最初から、で毎回これを呼ぶ）
// ──────────────────────────────────────────
function newGame() {
  _enemyUid = 0;
  game = {
    state: STATES.RUN_START,
    player: {
      name: PLAYER_INIT.name,
      hp: PLAYER_INIT.maxHp,
      maxHp: PLAYER_INIT.maxHp,
      kokoro: PLAYER_INIT.maxKokoro,
      maxKokoro: PLAYER_INIT.maxKokoro,
      weapons: [PLAYER_INIT.startWeapon], // 所持武器（祓うで使える）
      weaponLv: { [PLAYER_INIT.startWeapon]: 1 }, // 武器ごとのLv
      passives: {},          // 取得済みパッシブ key -> true
      items: Object.assign({}, PLAYER_INIT.items), // どうぐ所持数
      level: 1,
      exp: 0,                // 祓う/すくうでたまる。一定で“ボーナス3択”
      defending: false,      // このターン「まもる」中か
    },
    waveIndex: 0,            // 0始まり（ウェーブ番号 = waveIndex + 1）
    enemies: [],             // 現ウェーブの敵インスタンス
    turn: 0,                 // ウェーブ内のターン数
    log: [],                 // 戦闘ログ（画面下に流す）
    counters: { kill: 0, save: 0, memory: 0 }, // 殲滅／救済／記憶のカケラ
    startTime: Date.now(),   // ラン所要時間の計測用
    pendingCards: null,      // 現在提示中の3択（[card,card,card]）
    ending: null,            // 確定した結末
    seenTypes: {},           // 既に出会った敵タイプ（flavor を一度だけ流すため）
    tips: {},                // 初見チュートリアルで“もう見せた”ヒントの記録
    fx: [],                  // 演出イベントの一時キュー（ダメージ数字・揺れ等。UIが描画後に消費）
  };
  return game;
}

// ──────────────────────────────────────────
// 敵インスタンスを1体作る
//   elite=true（強化個体ウェーブ）のときは HP と攻撃力を上乗せする
// ──────────────────────────────────────────
function makeEnemy(typeId, pos, elite) {
  const base = ENEMIES[typeId];
  const hp = base.hp + (elite ? BALANCE.eliteHpBonus : 0);
  const atk = base.atk + (elite ? BALANCE.eliteAtkBonus : 0);
  return {
    uid: ++_enemyUid,
    type: typeId,
    name: base.name + (elite ? "（強化）" : ""),
    hp: hp, maxHp: hp,
    atk: atk, baseAtk: atk,
    wall: base.wall, maxWall: base.wall, // 心の壁（0で「すくえそう」）
    target: base.target,
    acts: base.acts.slice(),  // この敵に効くACTのID配列
    sad: !!base.sad,
    boss: !!base.boss,
    shape: base.shape, color: base.color,
    pos: pos,                 // 並び順（前列/列攻撃・隣接連鎖の判定に使う）
    status: { silence: 0 },   // 無力化の残りターン数など
    saved: false,             // すくった
    dead: false,              // 祓って倒した
  };
}

// ──────────────────────────────────────────
// ウェーブを開始する（群れを並べ、こころを補充）
// ──────────────────────────────────────────
function startWave() {
  const wave = WAVES[game.waveIndex];
  const elite = !!wave.elite;
  game.enemies = wave.enemies.map((t, i) => makeEnemy(t, i, elite));
  game.turn = 0;
  game.player.defending = false;
  // 毎ウェーブ こころを満タンに（各ウェーブを“誰を救うか”の判断にするため）
  if (BALANCE.refillKokoroEachWave) {
    game.player.kokoro = game.player.maxKokoro;
  }
  // 2ウェーブ目以降は最大HPの一定割合を回復（“一息ついて次の群れへ”）。
  // 1人で全波を耐える総HPを確保しつつ、全快にはしないので緊張は残る。
  if (game.waveIndex > 0 && BALANCE.healOnWaveStartPct > 0) {
    const heal = Math.ceil(game.player.maxHp * BALANCE.healOnWaveStartPct);
    const before = game.player.hp;
    game.player.hp = Math.min(game.player.maxHp, game.player.hp + heal);
    const got = game.player.hp - before;
    if (got > 0) log(`ひと息ついて HP+${got}`);
  }
  game.state = STATES.PLAYER_TURN;
  log(`── WAVE ${waveNumber()} / ${totalWaves()} ──`);
  if (wave.boss) log("ぬしさま が あらわれた…！");

  // はじめて出会う子だけ、その素性（flavor）を一度だけ流す＝物語の手触り。
  for (const e of game.enemies) {
    if (!game.seenTypes[e.type]) {
      game.seenTypes[e.type] = true;
      const base = ENEMIES[e.type];
      if (base && base.flavor) log(`  〔${base.name}〕${base.flavor}`);
    }
  }
}

// ──────────────────────────────────────────
// 状態を調べる小さなヘルパー群
// ──────────────────────────────────────────
// まだ場に残っている敵（倒されてもいない・救われてもいない）
function livingEnemies() {
  return game.enemies.filter((e) => !e.dead && !e.saved);
}
// ウェーブクリア＝場に敵がいない（全滅 or 全救済 or その混合）
function waveCleared() {
  return livingEnemies().length === 0;
}
// 前列 n 体（並び順 pos が小さいほど前）
function frontEnemies(n) {
  return livingEnemies()
    .slice()
    .sort((a, b) => a.pos - b.pos)
    .slice(0, n);
}
function isBossWave() { return !!WAVES[game.waveIndex].boss; }
function waveNumber() { return game.waveIndex + 1; }
function totalWaves() { return WAVES.length; }

// 武器まわりのアクセサ
function weaponLevel(id) { return game.player.weaponLv[id] || 1; }
function weaponPower(id) {
  const w = WEAPONS[id];
  if (w.evolved) return w.power;               // 進化武器はLvなし
  return w.power + (weaponLevel(id) - 1) * (w.perLv || 0);
}
function hasPassive(key) { return !!game.player.passives[key]; }

// きずな：これまで救った友の数ぶん、群れの反撃をやわらげる（上限あり）。
//   救うほど夜を生き延びやすくなる＝「救う」の見返りを“数字に出る形”で返すための関数。
function bondReduction() {
  return Math.min(BALANCE.bondReduceMax, game.counters.save * BALANCE.bondReducePerSave);
}

// ──────────────────────────────────────────
// 戦闘ログ（古いものは捨てて、画面が重くならないように）
// ──────────────────────────────────────────
function log(msg) {
  game.log.push(msg);
  if (game.log.length > 80) game.log.shift();
}

// ──────────────────────────────────────────
// 計測（仕様書「ラン毎に 殲滅数/救済数/ラン時間/到達ウェーブ をログ出力」）
//   救済率 = 救済数 ÷ (救済数 ＋ 殲滅数)
// ──────────────────────────────────────────
function runStats() {
  const sec = Math.round((Date.now() - game.startTime) / 1000);
  const total = game.counters.kill + game.counters.save;
  const rate = total > 0 ? game.counters.save / total : 0;
  return {
    kill: game.counters.kill,
    save: game.counters.save,
    memory: game.counters.memory,
    seconds: sec,
    reachedWave: waveNumber(),
    saveRate: rate,
  };
}

// 救済率から結末を決める（閾値の高い順で最初に満たしたもの）
function determineEnding(rate) {
  for (const e of ENDINGS) {
    if (rate >= e.min) return e;
  }
  return ENDINGS[ENDINGS.length - 1];
}
