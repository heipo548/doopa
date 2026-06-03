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
  // v0.4 メタループ（戦闘の“外側”）。実体の制御は field.js。
  TOWN: "TOWN",               // 街（拠点）ハブ
  FIELD: "FIELD",             // 夜のフィールド（横スクロールの道）
};

// 現在のランの状態（1ラン分＝“ひと夜の戦闘”をまるごと保持するグローバル）
let game = null;

// メタ進行（いくつもの夜をまたいで持ち越す）。newGame では消えない別グローバル。
//   実体は field.js の initMeta() で作る。戦闘コア(headless/probe)では未初期化(null)のまま＝従来挙動。
let meta = null;

// 敵インスタンスに付ける通し番号（同じ種類が複数いても区別できるように）
let _enemyUid = 0;

// ──────────────────────────────────────────
// 新しいランを作る（ローグライトなので失敗したら最初から、で毎回これを呼ぶ）
// ──────────────────────────────────────────
function newGame() {
  _enemyUid = 0;
  // 開始の きついことば（罵声）は複数持てる。startWeapons があればそれを、無ければ単体 startWeapon を使う。
  const startWeapons = (PLAYER_INIT.startWeapons && PLAYER_INIT.startWeapons.length)
    ? PLAYER_INIT.startWeapons.slice()
    : [PLAYER_INIT.startWeapon];
  const startWeaponLv = {};
  startWeapons.forEach((id) => { startWeaponLv[id] = 1; });
  game = {
    state: STATES.RUN_START,
    player: {
      name: PLAYER_INIT.name,
      hp: PLAYER_INIT.maxHp,
      maxHp: PLAYER_INIT.maxHp,
      kokoro: PLAYER_INIT.maxKokoro,
      maxKokoro: PLAYER_INIT.maxKokoro,
      weapons: startWeapons,      // 持っている きついことば（ぶつけるで使う・複数）
      weaponLv: startWeaponLv,    // ことばごとの Lv（とがり具合）
      // 覚えた やさしいことば（KIND_WORDS の id。増えていく）。
      //   v0.4：メタループ中は 前の夜までに覚えたことばを持ち越す（言えることは消えない）。
      //   meta 未初期化（戦闘コア単体の検証）では従来どおり PLAYER_INIT.startWords（=空）から。
      words: (meta && meta.learnedWords && meta.learnedWords.length)
        ? meta.learnedWords.slice()
        : (PLAYER_INIT.startWords || []).slice(),
      passives: {},          // 取得済みパッシブ key -> true
      items: Object.assign({}, PLAYER_INIT.items), // もちもの所持数
      level: 1,
      exp: 0,                // ぶつける/手をのばす でたまる。一定で“ボーナス3択”
      defending: false,      // このターン「こらえる」中か
      // ── 口喧嘩バトルの2ゲージ（ことばの積み方＝ビルド）──
      kyoki: 0,              // 狂気：きついことばを言うほど上がる（与ダメ↑・世界が翳る）
      nukumori: 0,           // ぬくもり：やさしいことばを言うほど上がる（最大HP↑・回復）
      nukumoriApplied: 0,    // ぬくもり閾値の発火済み回数（恩恵を二重に与えないため）
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
    lastWord: null,          // 最後に言ったことば（結末で「さいごに のこった ことば」に使う）
    newWords: [],            // このランで新しく覚えたことば（語彙が増えた手応えの可視化用）
    savedFriends: [],        // むかえた友（{type,name,color,shape}）＝画面上部の「なかま」に並べて“救った感”を出す
    tutorial: false,         // この夜が 第一夜チュートリアルか（startWave で wave.tutorial から設定）
    listened: false,         // この夜「きいてみる」を1回でもしたか（第一夜の街の返し方＝P0-4 の分岐に使う）
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
  const waves = currentWaves();
  const wave = waves[game.waveIndex];
  const elite = !!wave.elite;
  game.tutorial = !!wave.tutorial; // 第一夜チュートリアルの1体ウェーブか
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
  //   第一夜チュートリアルの くろまる だけは、説明的な flavor ではなく“出会いがしらの一言”を出す。
  for (const e of game.enemies) {
    if (!game.seenTypes[e.type]) {
      game.seenTypes[e.type] = true;
      if (game.tutorial && typeof TUTORIAL !== "undefined" && e.type === TUTORIAL.enemy) {
        log(`  ${TUTORIAL.intro}`);
      } else {
        const base = ENEMIES[e.type];
        if (base && base.flavor) log(`  〔${base.name}〕${base.flavor}`);
      }
    }
  }
}

// 今この夜で使うウェーブ構成。第一夜（meta.night===1）だけ チュートリアルの1体ウェーブに差し替える。
//   ※ meta が無い（balance-probe / headless 等のコア単体検証）ときは 従来の WAVES のまま＝挙動不変。
function currentWaves() {
  if (typeof meta !== "undefined" && meta && meta.night === 1 && typeof WAVES_TUTORIAL !== "undefined") {
    return WAVES_TUTORIAL;
  }
  return WAVES;
}
// このウェーブが チュートリアル用（クリアで即・夜明け、レベルアップ3択を出さない）か
function isTutorialWave() { return !!(game && game.tutorial); }

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
function isBossWave() { return !!currentWaves()[game.waveIndex].boss; }
function waveNumber() { return game.waveIndex + 1; }
function totalWaves() { return currentWaves().length; }

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
//   v0.4：この夜の救済（counters.save）に加え、街に住む友（meta.friends＝前の夜に救った子）も
//         そっと かばう。ただし合計は bondReduceMax でクランプ＝積み過ぎても祓いを腐らせない。
//   ※ meta が無い（戦闘コア単体の検証）ときは メタ項が 0 ＝従来とまったく同じ値を返す。
function bondReduction() {
  let n = game.counters.save * BALANCE.bondReducePerSave;
  if (meta && meta.friends && meta.friends.length) {
    n += Math.min(BALANCE.metaBondMax || 0, meta.friends.length * (BALANCE.metaBondPerFriend || 0));
  }
  return Math.min(BALANCE.bondReduceMax, n);
}

// ──────────────────────────────────────────
// ことば（語彙）まわりのヘルパー
//   ALL_WORDS は data.js で ACTS（敵ごとに効く問いかけ/やさしい）＋ KIND_WORDS（学べる汎用）を
//   ひとつに見たテーブル。id からことばの定義を引く。
// ──────────────────────────────────────────
function wordById(id) { return ALL_WORDS[id] || null; }

// 「このことばを いま使えるか」：生まれつき知っている問いかけ(ACTS)か、学んで覚えた汎用語(words)か。
function knowsWord(id) {
  if (ACTS[id]) return true;                 // 生まれつきの問いかけ／やさしいことば
  return game.player.words.includes(id);     // 学んで増えた語彙
}

// 学んだ汎用語の id 一覧（きいてみる の選択肢に足す＝言えることが増える手触り）。
function learnedKindWords() {
  return game.player.words.filter((id) => !!KIND_WORDS[id]);
}

// 新しいことばを覚える（3択カード／友をむかえた時の gift から呼ぶ）。
//   すでに知っていれば何もしない。覚えたら newWords に積んで“増えた”ことを可視化。
function learnWord(id) {
  if (!KIND_WORDS[id]) return false;         // 汎用語以外は対象外（問いかけは生まれつき）
  if (game.player.words.includes(id)) return false;
  game.player.words.push(id);
  game.newWords.push(id);
  const w = KIND_WORDS[id];
  log(`＋ ことばを おぼえた：「${w.word}」`);
  return true;
}

// 狂気を積む（上限でクランプ）。きついことばを言うほど高まる。
function gainKyoki(n) {
  if (!n) return;
  game.player.kyoki = Math.min(BALANCE.kyokiMax, game.player.kyoki + n);
}

// ぬくもりを積み、閾値（nukumoriStep ごと）を新たに跨いだぶんだけ
//   最大HP＋／即時回復 の恩恵を与える。やさしく言うほど夜に強くなる＝救いルートの雪だるま。
//   戻り値：{ hpUp, healed } 今回の発火ぶん（UI 演出のため）。
function gainNukumori(n) {
  const out = { hpUp: 0, healed: 0 };
  if (!n) return out;
  game.player.nukumori += n;
  // いまのぬくもりで何回ぶんの閾値を超えているか。まだ恩恵を渡していない回数だけ発火する。
  const reached = Math.floor(game.player.nukumori / BALANCE.nukumoriStep);
  while (game.player.nukumoriApplied < reached) {
    game.player.nukumoriApplied++;
    game.player.maxHp += BALANCE.nukumoriHpBonus;
    out.hpUp += BALANCE.nukumoriHpBonus;
    const before = game.player.hp;
    game.player.hp = Math.min(game.player.maxHp, game.player.hp + BALANCE.nukumoriHealBonus);
    out.healed += game.player.hp - before;
  }
  if (out.hpUp > 0) log(`  ぬくもりが あふれた（最大HP＋${out.hpUp}・HP＋${out.healed}）`);
  return out;
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
