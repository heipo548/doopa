/*
 * bullet.js — 感情回避フェーズ（弾よけ）の“フィールド模型”
 *
 * なるべく DOM に触れない純粋ロジックにしてある。理由：
 *  ・当たり判定や難度（警戒度スケール）を JXA でヘッドレス検証できる
 *  ・描画(ui.js)と入力(main.js)を差し替えても、ルールは変わらないようにする
 *
 * 使い方（リアルタイム側）：
 *   var field = makeDodgeField({ emotion, wariness, slow, guard, w, h });
 *   毎フレーム：field.input に上下左右/ポインタを入れて tickDodge(field, dt) を呼ぶ
 *   field.done === true になったら終了。field.damageTaken / field.shardsCollected を集計に使う。
 *
 * 座標系：左上(0,0)〜右下(w,h)。1秒=1.0、dt は秒。
 */

/* 基本の出現レート（1秒あたり何個出すか。emotion.spawn 倍率と警戒度で増減する） */
var DODGE_BASE_RATE = { doubt: 1.4, anger: 0.9, shard: 0.7 };

function makeDodgeField(opts) {
  opts = opts || {};
  var w = opts.w || 300;
  var h = opts.h || 180;
  // 警戒度 0→×1.0、100→×(1+waryScale)。弾の数と速さを少しだけ上げる
  var wary = clampNum(opts.wariness || 0, 0, 100);
  var intensity = 1 + (wary / 100) * (typeof BALANCE !== 'undefined' ? BALANCE.waryScale : 0.9);
  var slow = !!opts.slow;
  var slowF = slow ? (typeof BALANCE !== 'undefined' ? BALANCE.slowFactor : 0.72) : 1;

  return {
    w: w, h: h,
    player: { x: w / 2, y: h / 2, r: 7 },
    playerSpeed: 165,            // キー操作の移動速度(px/秒)
    bullets: [],                 // 避ける弾（？！）
    shards: [],                  // 記憶のかけら（◇＝触ると理解度+）
    t: 0,                        // 経過秒
    duration: (typeof BALANCE !== 'undefined' ? BALANCE.dodgeSeconds : 5.5),
    spawnStop: null,             // この秒以降は新規出現を止める（最後は避けやすく）
    intensity: intensity,
    slowFactor: slowF,
    invuln: 0,                   // 被弾後の無敵残り秒
    emotion: opts.emotion || EMOTIONS.utagau,
    acc: { doubt: 0, anger: 0, shard: 0 }, // 出現の端数をためる
    damageTaken: 0,
    shardsCollected: 0,
    hitFlash: 0,                 // 被弾演出用（描画が参照）
    done: false,
    // 入力（main.js が毎フレーム書き込む）
    input: { up: false, down: false, left: false, right: false,
             pointer: { active: false, x: 0, y: 0 } }
  };
}

// data.js が読み込まれていない環境でも単体で動くよう、最小の clamp を内蔵
function clampNum(v, lo, hi) { return Math.max(lo, Math.min(hi, v)); }

/* ───────────── 1フレーム進める ───────────── */
function tickDodge(field, dt) {
  if (field.done) return;
  // dt が極端に大きいフレーム（タブ復帰など）で“すり抜け”ないよう上限を設ける
  if (dt > 0.05) dt = 0.05;
  field.t += dt;
  if (field.invuln > 0) field.invuln -= dt;
  if (field.hitFlash > 0) field.hitFlash -= dt;

  movePlayer(field, dt);
  // 終了間際は新規出現を止めて、避けきれる“締め”にする
  var stopAt = field.duration - 0.9;
  if (field.t < stopAt) spawnNoise(field, dt);
  moveBullets(field, dt);
  moveShards(field, dt);
  collide(field);

  if (field.t >= field.duration) field.done = true;
}

/* プレイヤー移動：キー（上下左右）＋ポインタ（ドラッグ）。エリア内にクランプ */
function movePlayer(field, dt) {
  var p = field.player;
  var inp = field.input;
  var dx = 0, dy = 0;
  if (inp.left) dx -= 1;
  if (inp.right) dx += 1;
  if (inp.up) dy -= 1;
  if (inp.down) dy += 1;
  if (dx !== 0 || dy !== 0) {
    var len = Math.sqrt(dx * dx + dy * dy);
    p.x += (dx / len) * field.playerSpeed * dt;
    p.y += (dy / len) * field.playerSpeed * dt;
  }
  // ポインタ（タッチ/マウス）追従：目標へ向かってなめらかに寄せる
  if (inp.pointer && inp.pointer.active) {
    var tx = inp.pointer.x - p.x;
    var ty = inp.pointer.y - p.y;
    var d = Math.sqrt(tx * tx + ty * ty);
    var step = field.playerSpeed * 1.25 * dt; // 指の方が少し速く動けると気持ちいい
    if (d > step) { p.x += (tx / d) * step; p.y += (ty / d) * step; }
    else { p.x = inp.pointer.x; p.y = inp.pointer.y; }
  }
  p.x = clampNum(p.x, p.r, field.w - p.r);
  p.y = clampNum(p.y, p.r, field.h - p.r);
}

/* ノイズ出現：emotion.spawn の倍率 × 基本レート × 警戒度 × まって減速 */
function spawnNoise(field, dt) {
  var sp = field.emotion.spawn || {};
  var keys = ['doubt', 'anger', 'shard'];
  for (var i = 0; i < keys.length; i++) {
    var key = keys[i];
    var rate = (DODGE_BASE_RATE[key] || 0) * (sp[key] || 0) * field.intensity * field.slowFactor;
    field.acc[key] += rate * dt;
    while (field.acc[key] >= 1) {
      field.acc[key] -= 1;
      if (key === 'shard') spawnShard(field);
      else spawnBullet(field, NOISE_TYPES[key]);
    }
  }
}

// 避ける弾（？！）：画面の端から出て、出現時のプレイヤー位置へ向かう
function spawnBullet(field, def) {
  var edge = Math.floor(Math.random() * 4); // 0上 1右 2下 3左
  var x, y;
  if (edge === 0) { x = rand(0, field.w); y = -10; }
  else if (edge === 1) { x = field.w + 10; y = rand(0, field.h); }
  else if (edge === 2) { x = rand(0, field.w); y = field.h + 10; }
  else { x = -10; y = rand(0, field.h); }

  // プレイヤーへ向かうベクトル（jitter で少しブレさせると“疑い”っぽくなる）
  var tx = field.player.x - x;
  var ty = field.player.y - y;
  var ang = Math.atan2(ty, tx) + (Math.random() - 0.5) * (def.jitter || 0);
  var speed = def.speed * field.intensity * field.slowFactor;

  field.bullets.push({
    x: x, y: y,
    vx: Math.cos(ang) * speed, vy: Math.sin(ang) * speed,
    r: def.radius, damage: def.damage, glyph: def.glyph, cls: def.cls
  });
}

// 記憶のかけら（◇）：上からゆっくり落ちる。触れると理解度+（避けない弾）
function spawnShard(field) {
  var def = NOISE_TYPES.shard;
  var glyph = def.glyphs ? def.glyphs[Math.floor(Math.random() * def.glyphs.length)] : def.glyph;
  field.shards.push({
    x: rand(20, field.w - 20), y: -10,
    vx: (Math.random() - 0.5) * 20,
    vy: def.speed * field.slowFactor, // 落下はゆっくり（警戒度では速くしない＝拾いやすく）
    r: def.radius, heal: def.heal, glyph: glyph, cls: def.cls
  });
}

function moveBullets(field, dt) {
  var keep = [];
  for (var i = 0; i < field.bullets.length; i++) {
    var b = field.bullets[i];
    b.x += b.vx * dt; b.y += b.vy * dt;
    // 画面外に十分出たら捨てる（メモリと当たり判定の節約）
    if (b.x > -30 && b.x < field.w + 30 && b.y > -30 && b.y < field.h + 30) keep.push(b);
  }
  field.bullets = keep;
}

function moveShards(field, dt) {
  var keep = [];
  for (var i = 0; i < field.shards.length; i++) {
    var s = field.shards[i];
    s.x += s.vx * dt; s.y += s.vy * dt;
    if (s.y < field.h + 30) keep.push(s); // 下に落ちきったら消える
  }
  field.shards = keep;
}

/* 当たり判定：弾＝ダメージ（無敵中は無視）、かけら＝理解度（常に拾える） */
function collide(field) {
  var p = field.player;
  // 弾（？！）
  var keep = [];
  for (var i = 0; i < field.bullets.length; i++) {
    var b = field.bullets[i];
    if (hit(p, b)) {
      if (field.invuln <= 0) {
        field.damageTaken += b.damage;
        field.invuln = (typeof BALANCE !== 'undefined' ? BALANCE.invulnSeconds : 0.7);
        field.hitFlash = 0.25;
        // 当たった弾は消す（同じ弾で連続ダメージにしない）
        continue;
      }
      // 無敵中は当たってもダメージ無し。弾は残す（通り抜け演出）
    }
    keep.push(b);
  }
  field.bullets = keep;

  // 記憶のかけら（◇）：触れたら理解度カウント＋消す
  var keepS = [];
  for (var j = 0; j < field.shards.length; j++) {
    var s = field.shards[j];
    if (hit(p, s)) { field.shardsCollected += 1; continue; }
    keepS.push(s);
  }
  field.shards = keepS;
}

// 円と円の重なり判定
function hit(p, o) {
  var dx = p.x - o.x, dy = p.y - o.y;
  var rr = p.r + o.r;
  return (dx * dx + dy * dy) <= rr * rr;
}

function rand(a, b) { return a + Math.random() * (b - a); }

// 集計（resolveDodge に渡す形）
function dodgeSummary(field) {
  return { damage: field.damageTaken, shards: field.shardsCollected };
}

// JXA / Node 双方から参照できるよう公開（ブラウザでは無視される）
if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    makeDodgeField: makeDodgeField, tickDodge: tickDodge,
    dodgeSummary: dodgeSummary, DODGE_BASE_RATE: DODGE_BASE_RATE
  };
}
