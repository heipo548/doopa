/* =========================================================================
   field.js — 魔王城（1フロア）の探索。タイルマップを敷いて魔王を歩かせ、
   各部署のNPC・水晶・掲示板に近づいて「調べる」と main.js に通知する。
   キャンバスは 320x240 ＝ マップ全体（20x15タイル）。スクロール無し。
   ========================================================================= */
const Field = (() => {
  const M = DATA.map, T = M.tile;
  let grid = [];          // [row][col]：1=壁 0=床
  let floorCol = [];      // 各タイルの床色
  const blocked = new Set(); // 調べもの（NPC等）が立つタイル＝通行不可
  const things = M.things.map(t => ({ ...t }));
  // §9/§10：城の小物。通行可（上に乗れる）で、cond が真の週だけ現れる調べもの。
  const props = (typeof DATA !== 'undefined' && DATA.props ? DATA.props : []).map(p => ({ ...p, kind: 'prop' }));
  function activeProps() { return props.filter(p => !p.cond || p.cond()); }
  const player = { tx: M.start[0], ty: M.start[1], px: 0, py: 0, dir: 'down', anim: 0, moving: false, fromX: 0, fromY: 0, toX: 0, toY: 0, mt: 0 };
  let onInteract = null;  // (thing) => {}
  let onNearChange = null;// (thing|null) => {}  ラベル表示用
  let near = null;
  let locked = false;     // 会話中などは操作ロック
  let path = [];          // タップ移動の経路（BFSで作る {tx,ty} の列）
  let pendingInteract = null; // 経路の終点で調べる相手（タップでNPCを選んだ時）

  function feet(tx, ty) { return [tx * T + T / 2, ty * T + T - 3]; }

  function build() {
    grid = []; floorCol = [];
    for (let y = 0; y < M.rows; y++) { grid.push(new Array(M.cols).fill(1)); floorCol.push(new Array(M.cols).fill('#2a2142')); }
    const carve = (x, y, col) => { if (x >= 0 && x < M.cols && y >= 0 && y < M.rows) { grid[y][x] = 0; if (col) floorCol[y][x] = col; } };
    // 部屋の内側
    M.rooms.forEach(r => { for (let y = r.ry; y < r.ry + r.rh; y++) for (let x = r.rx; x < r.rx + r.rw; x++) carve(x, y, r.floor); r._door = r.door; });
    // 廊下
    const ch = M.corridorH, cv = M.corridorV; const corCol = '#332a48';
    for (let y = ch.y0; y <= ch.y1; y++) for (let x = ch.x0; x <= ch.x1; x++) carve(x, y, corCol);
    for (let y = cv.y0; y <= cv.y1; y++) for (let x = cv.x0; x <= cv.x1; x++) carve(x, y, corCol);
    // 扉
    M.rooms.forEach(r => carve(r.door[0], r.door[1], '#3a3050'));
    // 調べものを通行不可に
    blocked.clear();
    things.forEach(t => { blocked.add(t.tx + ',' + t.ty); });
    // プレイヤー初期ピクセル位置
    const f = feet(player.tx, player.ty); player.px = f[0]; player.py = f[1];
  }

  function walkable(tx, ty) {
    if (tx < 0 || ty < 0 || tx >= M.cols || ty >= M.rows) return false;
    if (grid[ty][tx] !== 0) return false;
    if (blocked.has(tx + ',' + ty)) return false;
    return true;
  }

  const DIRS = { up: [0, -1], down: [0, 1], left: [-1, 0], right: [1, 0] };

  // 1タイルぶんの移動を開始（なめらかに補間）
  function beginStep(nx, ny) {
    player.fromX = player.px; player.fromY = player.py;
    const f = feet(nx, ny); player.toX = f[0]; player.toY = f[1];
    player.tx = nx; player.ty = ny; player.moving = true; player.mt = 0;
    SFX.play('move');
  }
  function tryMove(dir) {
    if (locked || player.moving) return;
    cancelPath(); // 手動操作はタップ移動より優先（自動歩行を打ち切る）
    player.dir = dir;
    const [dx, dy] = DIRS[dir];
    const nx = player.tx + dx, ny = player.ty + dy;
    updateNear();
    if (!walkable(nx, ny)) { SFX.play('bump'); return; }
    beginStep(nx, ny);
  }
  function cancelPath() { path = []; pendingInteract = null; }

  // ── タップ移動：BFSで目的地（または相手の隣）まで歩く ──
  const ORTHO = [[0, -1], [0, 1], [-1, 0], [1, 0]];
  function bfsPath(isGoal) {
    const sx = player.tx, sy = player.ty;
    if (isGoal(sx, sy)) return [];
    const q = [[sx, sy]]; const seen = new Set([sx + ',' + sy]); const prev = {};
    while (q.length) {
      const [cx, cy] = q.shift();
      for (const [dx, dy] of ORTHO) {
        const nx = cx + dx, ny = cy + dy, key = nx + ',' + ny;
        if (seen.has(key) || !walkable(nx, ny)) continue;
        seen.add(key); prev[key] = [cx, cy];
        if (isGoal(nx, ny)) {
          const out = []; let cur = [nx, ny];
          while (!(cur[0] === sx && cur[1] === sy)) { out.unshift({ tx: cur[0], ty: cur[1] }); cur = prev[cur[0] + ',' + cur[1]]; }
          return out;
        }
        q.push([nx, ny]);
      }
    }
    return null;
  }
  const orthAdj = (x, y, tx, ty) => Math.abs(x - tx) + Math.abs(y - ty) === 1;
  function dirToward(tx, ty) {
    const dx = tx - player.tx, dy = ty - player.ty;
    return Math.abs(dx) >= Math.abs(dy) ? (dx > 0 ? 'right' : 'left') : (dy > 0 ? 'down' : 'up');
  }
  function navTo(tx, ty) {
    if (locked) return;
    const thing = things.find(o => o.tx === tx && o.ty === ty);
    if (thing) {
      // 相手の隣まで歩いて調べる
      const p = bfsPath((x, y) => orthAdj(x, y, thing.tx, thing.ty));
      if (p && p.length === 0) { player.dir = dirToward(thing.tx, thing.ty); if (onInteract) onInteract(thing); return; }
      if (p) { path = p; pendingInteract = thing; }
      return;
    }
    // 小物：そのタイルまで歩いて（通行可）、着いたら調べる
    const prp = activeProps().find(o => o.tx === tx && o.ty === ty);
    if (prp) {
      if (player.tx === tx && player.ty === ty) { if (onInteract) onInteract(prp); return; }
      const p = bfsPath((x, y) => x === tx && y === ty);
      if (p && p.length === 0) { if (onInteract) onInteract(prp); return; }
      if (p) { path = p; pendingInteract = prp; }
      return;
    }
    if (!walkable(tx, ty)) return;
    const p = bfsPath((x, y) => x === tx && y === ty);
    if (p && p.length) { path = p; pendingInteract = null; }
  }

  // 目の前（向いている方向）の調べもの。無ければ隣接のどれか。
  function facedThing() {
    const [dx, dy] = DIRS[player.dir];
    const fx = player.tx + dx, fy = player.ty + dy;
    let t = things.find(o => o.tx === fx && o.ty === fy);
    if (t) return t;
    // 目の前の小物（通行可なので向いた先にあればそれを優先）
    let p = activeProps().find(o => o.tx === fx && o.ty === fy);
    if (p) return p;
    // 今いるタイルの小物（小物は上に乗れる＝足元のものも調べられる）
    p = activeProps().find(o => o.tx === player.tx && o.ty === player.ty);
    if (p) return p;
    // 隣接の保険（モバイルで向き合わせが面倒なため。things のみ）
    for (const d of Object.values(DIRS)) {
      t = things.find(o => o.tx === player.tx + d[0] && o.ty === player.ty + d[1]);
      if (t) return t;
    }
    return null;
  }

  function interact() {
    if (locked || player.moving) return;
    const t = facedThing();
    if (t && onInteract) { onInteract(t); }
  }

  function updateNear() {
    const t = facedThing();
    if (t !== near) { near = t; if (onNearChange) onNearChange(t); }
  }

  function update(dt) {
    if (player.moving) {
      player.mt += dt; const dur = 120; const k = Math.min(1, player.mt / dur);
      player.px = player.fromX + (player.toX - player.fromX) * k;
      player.py = player.fromY + (player.toY - player.fromY) * k;
      player.anim += dt;
      if (k >= 1) { player.moving = false; updateNear(); onArrive(); }
    } else { onArrive(); } // 静止中も経路の続きを進める
  }
  // 1タイル進み終わったら：経路の続き→終点で調べる
  function onArrive() {
    if (locked || player.moving) return;
    if (path.length) {
      const n = path.shift();
      player.dir = dirToward(n.tx, n.ty);
      if (walkable(n.tx, n.ty)) beginStep(n.tx, n.ty); else cancelPath();
      return;
    }
    if (pendingInteract) {
      const t = pendingInteract; pendingInteract = null;
      player.dir = dirToward(t.tx, t.ty); updateNear();
      if (onInteract) onInteract(t);
    }
  }

  function draw(ctx, t) {
    ctx.clearRect(0, 0, 320, 240);
    // 床
    for (let y = 0; y < M.rows; y++) for (let x = 0; x < M.cols; x++) {
      if (grid[y][x] === 0) {
        ctx.fillStyle = floorCol[y][x]; ctx.fillRect(x * T, y * T, T, T);
        // 床の格子目
        ctx.fillStyle = 'rgba(0,0,0,0.12)'; ctx.fillRect(x * T, y * T, T, 1); ctx.fillRect(x * T, y * T, 1, T);
      }
    }
    // 壁（床に隣接する壁だけ立体的に）
    for (let y = 0; y < M.rows; y++) for (let x = 0; x < M.cols; x++) {
      if (grid[y][x] === 1) {
        const open = (y + 1 < M.rows && grid[y + 1][x] === 0); // 下が床＝壁の“面”が見える
        ctx.fillStyle = '#1d1630'; ctx.fillRect(x * T, y * T, T, T);
        if (open) { ctx.fillStyle = '#3a2f54'; ctx.fillRect(x * T, y * T + T - 5, T, 5); ctx.fillStyle = '#4a3f64'; ctx.fillRect(x * T, y * T + T - 6, T, 1); }
        else { ctx.fillStyle = '#241b3a'; ctx.fillRect(x * T + 1, y * T + 1, T - 2, T - 2); }
      }
    }
    // 部屋名の小さな看板（読みやすいサンセリフで）
    ctx.font = 'bold 9px "Hiragino Sans","Yu Gothic",sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'alphabetic';
    M.rooms.forEach(r => {
      const cx = (r.rx + r.rw / 2) * T, ty = r.ry * T + 9;
      const w = ctx.measureText(r.name).width;
      ctx.fillStyle = 'rgba(0,0,0,0.5)'; ctx.fillRect(cx - w / 2 - 3, ty - 9, w + 6, 12);
      ctx.fillStyle = '#e8ddff'; ctx.fillText(r.name, cx, ty);
    });
    // 松明（玉座の左右）でゆらぎ
    [[1, 6], [18, 6], [1, 8], [18, 8]].forEach(([tx, ty]) => {
      const cx = tx * T + T / 2, cy = ty * T + 4; const fl = 2 + Math.sin(t / 130 + tx) * 1.5;
      ctx.fillStyle = '#ff8a3a'; ctx.beginPath(); ctx.moveTo(cx, cy - 2); ctx.lineTo(cx - fl, cy + 4); ctx.lineTo(cx + fl, cy + 4); ctx.fill();
    });

    // 調べもの＋小物＋プレイヤーを y 順で描く（重なりの前後）
    const drawables = things.map(o => ({ kind: 'thing', y: o.ty * T, o }))
      .concat(activeProps().map(o => ({ kind: 'prop', y: o.ty * T, o })))
      .concat([{ kind: 'player', y: player.py }]);
    drawables.sort((a, b) => a.y - b.y);
    drawables.forEach(d => {
      if (d.kind === 'thing') { const [cx, cy] = feet(d.o.tx, d.o.ty); Sprites.thing(ctx, d.o, cx, cy, t); }
      else if (d.kind === 'prop') { const [cx, cy] = feet(d.o.tx, d.o.ty); Sprites.prop(ctx, d.o.icon, cx, cy, t); }
      else { Sprites.chibi(ctx, 'maou', player.px, player.py, 1.6, player.anim, player.moving); }
    });

    // 近くの調べものを淡く強調
    if (near) {
      const [cx, cy] = feet(near.tx, near.ty);
      ctx.strokeStyle = 'rgba(255,180,84,' + (0.4 + 0.3 * Math.sin(t / 200)) + ')'; ctx.lineWidth = 1;
      ctx.strokeRect(near.tx * T + 1, near.ty * T + 1, T - 2, T - 2);
    }
  }

  function setPlayer(tx, ty) { cancelPath(); player.tx = tx; player.ty = ty; const f = feet(tx, ty); player.px = f[0]; player.py = f[1]; player.moving = false; updateNear(); }
  function lock(v) { locked = v; if (v) { cancelPath(); near = null; if (onNearChange) onNearChange(null); } else updateNear(); }
  function getThing(id) { return things.find(t => t.id === id); }

  return {
    build, draw, update, tryMove, interact, navTo, setPlayer, lock,
    getThing, get player() { return player; },
    set onInteract(fn) { onInteract = fn; }, set onNearChange(fn) { onNearChange = fn; },
  };
})();
