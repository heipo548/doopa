/*
 * field.js — 見下ろしフィールドの“モデルと動き”（描画は ui.js が canvas に行う）。
 *
 *   ・enterArea(id)     … エリアに入る（当たり判定づくり・プレイヤー配置・BGMテーマ）。
 *   ・fieldUpdate(dt)   … 毎フレームの移動更新（キー入力 or クリック目標へ補間／タイル当たり判定）。
 *   ・nearestObject()   … 近くの“反応できる対象”を返す（名札の強調・しらべる に使う）。
 *   ・interactDescriptor(obj) … 対象に触れたとき“次に何が起きるか”を返す（遷移は main が指揮）。
 *   ・fieldHandleClick()… クリック先へ歩く／対象なら寄ってから起動。戻り値 true=対象, false=空き地。
 *
 * 座標系：タイル座標。プレイヤー位置 app.player.{x,y} もタイル単位の小数。
 * 地形：'.'くさ ','はな '='みち は歩ける。'T'き 'H'いえ '~'みず 'o'いし ' 'そと は塞ぐ。
 *
 * ※ DOM 非依存（canvas API は ui 側）。末尾で window へ明示エクスポート。
 */

const FIELD_TILE = 44;
const PLAYER_SPEED = 5.2;
const PLAYER_RADIUS = 0.32;

let _area = null, _solid = null;

function curArea() { return _area; }

function _terrainSolid(ch) {
  return ch === "T" || ch === "H" || ch === "~" || ch === "o" || ch === " ";
}
function _inBounds(tx, ty) { return _area && tx >= 0 && ty >= 0 && tx < _area.cols && ty < _area.rows; }
function _isSolidTile(tx, ty) {
  if (!_inBounds(tx, ty)) return true;
  return !!(_solid && _solid[ty] && _solid[ty][tx]);
}

function _buildSolid() {
  _solid = [];
  for (let y = 0; y < _area.rows; y++) {
    const row = [], line = _area.grid[y] || "";
    for (let x = 0; x < _area.cols; x++) row.push(_terrainSolid(line[x] || " "));
    _solid.push(row);
  }
  areaObjects().forEach((o) => { if (o.solid && _inBounds(o.tx, o.ty)) _solid[o.ty][o.tx] = true; });
}

// 現在エリアの“出ている”オブジェクト（appearWhen/hideWhen をフラグで判定）。
function areaObjects() {
  if (!_area || !_area.objects) return [];
  return _area.objects.filter((o) => {
    if (o.appearWhen && !hasFlag(o.appearWhen)) return false;
    if (o.hideWhen && hasFlag(o.hideWhen)) return false;
    return true;
  });
}

function enterArea(id, opts) {
  _area = AREAS[id];
  if (!_area) return null;
  game.currentArea = id;
  game.state = STATES.FIELD;
  app.screen = "field";
  _buildSolid();

  let sp = _area.spawn;
  if (opts && opts.fromSave && game.pos) sp = game.pos;
  else if (opts && opts.atTile) sp = opts.atTile;
  if (_isSolidTile(sp.tx, sp.ty)) sp = _area.spawn; // 塞がっていたら spawn に逃がす

  app.player = {
    x: sp.tx, y: sp.ty, dir: sp.dir || "down",
    target: null, pendingObj: null, justArrived: false,
    moving: false, bob: 0, stepT: 0, keys: {},
  };
  game.pos = { tx: sp.tx, ty: sp.ty, dir: app.player.dir };
  if (typeof setTheme === "function") setTheme(_area.theme);
  if (typeof setBgmTone === "function") setBgmTone(game.tone || 0);
  log(_area.name + " に はいった。");
  return _area;
}

// 当たり判定つき移動（軸ごとに動かして“壁ずり”）。
function _canStand(x, y) {
  const r = PLAYER_RADIUS;
  const x0 = Math.floor(x - r), x1 = Math.floor(x + r);
  const y0 = Math.floor(y - r), y1 = Math.floor(y + r);
  for (let ty = y0; ty <= y1; ty++)
    for (let tx = x0; tx <= x1; tx++)
      if (_isSolidTile(tx, ty)) return false;
  return true;
}
function _moveAxis(p, axis, delta) {
  if (!delta) return;
  const nx = axis === "x" ? p.x + delta : p.x;
  const ny = axis === "y" ? p.y + delta : p.y;
  if (_canStand(nx, ny)) { p.x = nx; p.y = ny; }
}

function fieldUpdate(dt) {
  const p = app.player;
  if (!p || !_area) return;
  if (dt > 0.1) dt = 0.1;

  let vx = 0, vy = 0;
  if (p.target) {
    const dx = p.target.x - p.x, dy = p.target.y - p.y;
    const d = Math.hypot(dx, dy);
    if (d < 0.08) { p.x = p.target.x; p.y = p.target.y; p.target = null; p.justArrived = true; }
    else { vx = dx / d; vy = dy / d; }
  } else {
    if (p.keys.left) vx -= 1; if (p.keys.right) vx += 1;
    if (p.keys.up) vy -= 1;   if (p.keys.down) vy += 1;
    if (vx || vy) { const m = Math.hypot(vx, vy) || 1; vx /= m; vy /= m; }
  }

  if (vx || vy) {
    if (Math.abs(vx) >= Math.abs(vy)) p.dir = vx < 0 ? "left" : "right";
    else p.dir = vy < 0 ? "up" : "down";
    const step = PLAYER_SPEED * dt;
    _moveAxis(p, "x", vx * step);
    _moveAxis(p, "y", vy * step);
    p.moving = true; p.bob += dt * 9;
    p.stepT += dt;
    if (p.stepT > 0.32) { p.stepT = 0; if (typeof playSe === "function") playSe("step"); }
  } else { p.moving = false; p.stepT = 0.32; }

  game.pos = { tx: Math.round(p.x), ty: Math.round(p.y), dir: p.dir };
  app.fieldNear = nearestObject(p.x, p.y);
}

function nearestObject(px, py) {
  if (px == null && app.player) { px = app.player.x; py = app.player.y; }
  let best = null, bestD = 999;
  areaObjects().forEach((o) => {
    if (o.kind === "scenic") return;
    const reach = o.reach != null ? o.reach : 1.35;
    const d = Math.hypot(o.tx - px, o.ty - py);
    if (d <= reach && d < bestD) { bestD = d; best = o; }
  });
  return best;
}

function interactDescriptor(obj) {
  if (!obj) return { type: "none" };
  switch (obj.kind) {
    case "look": return { type: "look", obj: obj };
    case "sign": return { type: "sign", obj: obj };
    case "npc": return { type: "npc", npcId: obj.ref, obj: obj };
    case "argue":
      if (obj.doneFlag && hasFlag(obj.doneFlag)) return { type: "doneLook", obj: obj };
      return { type: "argue", argueId: obj.ref, obj: obj };
    case "exit":
      if (obj.requires && !hasFlag(obj.requires)) return { type: "locked", obj: obj };
      return { type: "exit", area: obj.ref, obj: obj };
    default: return { type: "none" };
  }
}

// クリック処理。戻り値 true=対象に向かった / false=空き地（＝無駄クリック候補）。
function fieldHandleClick(cx, cy) {
  const p = app.player;
  if (!p || !_area) return false;
  const tx = cx / FIELD_TILE, ty = cy / FIELD_TILE;

  let hit = null, hitD = 1.1;
  areaObjects().forEach((o) => {
    if (o.kind === "scenic") return;
    const d = Math.hypot(o.tx - tx, o.ty - ty);
    if (d < hitD) { hitD = d; hit = o; }
  });

  if (hit) {
    const stand = _approachTile(hit, p);
    p.target = { x: stand.x, y: stand.y };
    p.pendingObj = hit.id;
    return true;
  }
  const gx = Math.max(PLAYER_RADIUS, Math.min(_area.cols - PLAYER_RADIUS, tx));
  const gy = Math.max(PLAYER_RADIUS, Math.min(_area.rows - PLAYER_RADIUS, ty));
  p.target = _canStand(gx, gy) ? { x: gx, y: gy } : { x: p.x, y: p.y };
  p.pendingObj = null;
  return false;
}

function _approachTile(obj, p) {
  if (!obj.solid && _canStand(obj.tx, obj.ty)) return { x: obj.tx, y: obj.ty };
  const dx = p.x - obj.tx, dy = p.y - obj.ty;
  const d = Math.hypot(dx, dy) || 1;
  const cand = { x: obj.tx + (dx / d), y: obj.ty + (dy / d) };
  if (_canStand(cand.x, cand.y)) return cand;
  const nb = [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [-1, 1], [1, -1], [-1, -1]];
  for (const [ox, oy] of nb) { const c = { x: obj.tx + ox, y: obj.ty + oy }; if (_canStand(c.x, c.y)) return c; }
  return { x: p.x, y: p.y };
}

function fieldObjective() { return _area ? objectiveText(_area.id) : ""; }

// ── window へ明示エクスポート ──
if (typeof window !== "undefined") {
  window.FIELD_TILE = FIELD_TILE;
  window.curArea = curArea;
  window.enterArea = enterArea;
  window.areaObjects = areaObjects;
  window.fieldUpdate = fieldUpdate;
  window.nearestObject = nearestObject;
  window.interactDescriptor = interactDescriptor;
  window.fieldHandleClick = fieldHandleClick;
  window.fieldObjective = fieldObjective;
}
