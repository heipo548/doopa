/* =========================================================================
   sprites.js — ドット絵を全部「その場で描く」（画像ファイル不使用）。
   キャラの顔（会話ポートレート）／フィールドのチビキャラ／部屋の家具／
   施策の演出シーン／エンディング絵 を手続き的に生成する。
   ========================================================================= */
const Sprites = (() => {
  // 1ピクセル＝小さな四角を置くだけのヘルパー
  function px(c, x, y, w, h, col) { c.fillStyle = col; c.fillRect(x, y, w, h); }

  /* ──────────────────────────────────────────────────────────────
     顔（会話ポートレート）。16x16 の論理グリッドを scale 倍で描く。
     expr で目・口の形を変える。距離感のある“ドット顔”。
     ────────────────────────────────────────────────────────────── */
  function face(c, charId, expr, S, ox, oy) {
    S = S || 3; ox = ox || 0; oy = oy || 0;
    const ch = DATA.chars[charId] || DATA.chars.villager;
    const P = (x, y, w, h, col) => px(c, ox + x * S, oy + y * S, w * S, h * S, col);

    if (ch.narr) { return; } // ナレーションは顔なし

    // 背景の薄い縁取り
    P(0, 0, 16, 16, 'rgba(0,0,0,0)');

    // 角（魔王・サキュバス系）
    if (ch.horns) { P(3, 1, 2, 2, '#caa'); P(11, 1, 2, 2, '#caa'); P(3, 0, 1, 1, '#caa'); P(12, 0, 1, 1, '#caa'); }

    // 髪（頭の上＋もみあげ）
    P(3, 2, 10, 4, ch.hair);
    P(2, 3, 1, 6, ch.hair); P(13, 3, 1, 6, ch.hair);
    // 顔
    P(3, 4, 10, 9, ch.skin);
    P(4, 13, 8, 1, ch.skin);
    // ほっぺ（ほんのり）
    P(4, 9, 1, 1, 'rgba(255,120,120,0.35)'); P(11, 9, 1, 1, 'rgba(255,120,120,0.35)');

    // 忍者の口元布
    if (ch.ninja) { P(3, 9, 10, 4, ch.cape || '#222'); }

    // 目・眉・口（表情）
    const eyeC = ch.eye || '#222';
    const setEyes = (pattern) => {
      // pattern: 'dot'|'happy'|'sad'|'angry'|'wide'|'half'|'look'
      if (pattern === 'happy') { // ^ ^
        P(5, 7, 1, 1, eyeC); P(4, 8, 3, 1, eyeC); P(10, 7, 1, 1, eyeC); P(9, 8, 3, 1, eyeC);
      } else if (pattern === 'sad') {
        P(4, 7, 2, 1, eyeC); P(5, 8, 1, 1, eyeC); P(10, 7, 2, 1, eyeC); P(10, 8, 1, 1, eyeC);
        P(4, 6, 2, 1, ch.hair); P(10, 6, 2, 1, ch.hair); // 下がり眉
      } else if (pattern === 'angry') {
        P(4, 6, 3, 1, ch.hair); P(9, 6, 3, 1, ch.hair); // つり眉
        P(5, 8, 2, 1, eyeC); P(9, 8, 2, 1, eyeC);
      } else if (pattern === 'wide') {
        P(4, 7, 2, 2, '#fff'); P(5, 7, 1, 2, eyeC); P(10, 7, 2, 2, '#fff'); P(10, 7, 1, 2, eyeC);
      } else if (pattern === 'half') {
        P(4, 8, 3, 1, eyeC); P(9, 8, 3, 1, eyeC);
      } else if (pattern === 'look') {
        P(6, 8, 1, 1, eyeC); P(11, 8, 1, 1, eyeC); // 視線を外す
      } else { // dot
        P(5, 8, 1, 2, eyeC); P(10, 8, 1, 2, eyeC);
      }
    };
    const setMouth = (m) => {
      if (m === 'smile') { P(6, 11, 4, 1, '#7a3a3a'); P(5, 10, 1, 1, '#7a3a3a'); P(10, 10, 1, 1, '#7a3a3a'); }
      else if (m === 'open') { P(6, 11, 4, 2, '#5a2a2a'); }
      else if (m === 'frown') { P(6, 12, 4, 1, '#7a3a3a'); P(5, 11, 1, 1, '#7a3a3a'); P(10, 11, 1, 1, '#7a3a3a'); }
      else if (m === 'grit') { P(6, 11, 4, 1, '#fff'); P(7, 11, 1, 1, '#5a2a2a'); P(9, 11, 1, 1, '#5a2a2a'); }
      else { P(6, 11, 4, 1, '#7a3a3a'); } // flat
    };

    const map = {
      neutral:  ['dot', 'flat'], happy: ['happy', 'smile'], cheer: ['happy', 'smile'],
      sad:      ['sad', 'frown'], falter: ['sad', 'frown'], think: ['look', 'flat'],
      angry:    ['angry', 'grit'], mad: ['angry', 'grit'], cold: ['half', 'flat'],
      surprised:['wide', 'open'], scared: ['wide', 'open'], wary: ['dot', 'flat'],
      split:    ['sad', 'flat'],
    };
    const [e, m] = map[expr] || map.neutral;
    if (!ch.ninja) setMouth(m);
    setEyes(e);

    // メガネ（ベルゼ）
    if (ch.glasses) { P(4, 7, 3, 3, 'rgba(180,220,255,0.25)'); P(9, 7, 3, 3, 'rgba(180,220,255,0.25)');
      c.strokeStyle = '#cfe6ff'; c.lineWidth = 1; c.strokeRect(ox + 4 * S, oy + 7 * S, 3 * S, 3 * S); c.strokeRect(ox + 9 * S, oy + 7 * S, 3 * S, 3 * S); }
    // 勇者のサークレット
    if (ch.hero) { P(4, 2, 8, 1, '#ffd76a'); P(7, 1, 2, 1, '#ffd76a'); }
  }

  /* 会話ポートレート：指定 canvas に1キャラの顔をはめる */
  function portrait(canvas, charId, expr) {
    const c = canvas.getContext('2d');
    c.clearRect(0, 0, canvas.width, canvas.height);
    const ch = DATA.chars[charId];
    if (!ch || ch.narr) { return; }
    // 背景
    c.fillStyle = ch.cape || '#241a38'; c.fillRect(0, 0, canvas.width, canvas.height);
    face(c, charId, expr, Math.floor(canvas.width / 16), 0, 0);
  }

  /* ──────────────────────────────────────────────────────────────
     フィールド／シーン用のチビキャラ（正面向き）。cx,cy=足元中央。
     ────────────────────────────────────────────────────────────── */
  function chibi(c, charId, cx, cy, s, t, walk) {
    const ch = DATA.chars[charId] || DATA.chars.villager;
    const P = (x, y, w, h, col) => px(c, Math.round(cx + x * s), Math.round(cy + y * s), Math.ceil(w * s), Math.ceil(h * s), col);
    const bob = walk ? (Math.floor((t || 0) / 160) % 2 ? 0 : -0.6) : 0;
    // 影
    c.fillStyle = 'rgba(0,0,0,0.3)'; c.beginPath();
    c.ellipse(cx, cy, 4.2 * s, 1.6 * s, 0, 0, Math.PI * 2); c.fill();
    const oy2 = bob;
    // マント／体
    P(-3, -7 + oy2, 6, 6, ch.cape || ch.skin);
    // 角
    if (ch.horns) { P(-3, -13 + oy2, 1, 2, '#caa'); P(2, -13 + oy2, 1, 2, '#caa'); }
    // 頭
    P(-3, -12 + oy2, 6, 5, ch.skin);
    P(-3, -13 + oy2, 6, 2, ch.hair); P(-3, -11 + oy2, 1, 3, ch.hair); P(2, -11 + oy2, 1, 3, ch.hair);
    if (ch.hero) { P(-3, -13 + oy2, 6, 1, '#ffd76a'); }
    if (ch.ninja) { P(-3, -10 + oy2, 6, 2, ch.cape || '#222'); }
    // 目
    P(-2, -10 + oy2, 1, 1, ch.eye || '#222'); P(1, -10 + oy2, 1, 1, ch.eye || '#222');
    // 足（歩行で交互）
    const step = walk && (Math.floor((t || 0) / 160) % 2);
    P(-2, -1, 2, 1, ch.hair); P(0, -1, 2, 1, ch.hair);
    if (step) { P(-2, 0, 1, 1, ch.hair); } else { P(1, 0, 1, 1, ch.hair); }
  }

  /* ── 家具・調べもの ── */
  function throne(c, x, y) { // 玉座
    px(c, x - 7, y - 18, 14, 18, '#5a3a7a'); px(c, x - 9, y - 20, 18, 4, '#7a4a9a');
    px(c, x - 9, y - 16, 2, 16, '#3a1a5a'); px(c, x + 7, y - 16, 2, 16, '#3a1a5a');
    px(c, x - 5, y - 22, 2, 3, '#ffd76a'); px(c, x + 3, y - 22, 2, 3, '#ffd76a'); // 飾り
  }
  function deskFor(c, x, y, dept) { // 各部署の机
    const col = { '広報室': '#b8472f', '人事室': '#caa23a', '福祉室': '#5fae6a', '諜報室': '#5a6aa8' }[dept] || '#8a6a4a';
    px(c, x - 8, y - 4, 16, 6, '#6a4a2a'); px(c, x - 8, y - 5, 16, 1, '#8a6a4a');
    px(c, x - 6, y - 8, 5, 3, col); // 部署カラーの掲示物
  }
  function crystalBall(c, x, y, t) {
    px(c, x - 4, y - 2, 8, 4, '#3a2a1a'); // 台座
    const glow = 0.6 + 0.4 * Math.sin((t || 0) / 300);
    c.save(); c.globalAlpha = glow;
    c.fillStyle = '#6db5ff'; c.beginPath(); c.arc(x, y - 9, 7, 0, Math.PI * 2); c.fill();
    c.restore();
    c.fillStyle = 'rgba(220,240,255,0.85)'; c.beginPath(); c.arc(x, y - 9, 7, 0, Math.PI * 2); c.stroke();
    px(c, x - 3, y - 12, 2, 2, 'rgba(255,255,255,0.8)'); // ハイライト
  }
  function noticeBoard(c, x, y) {
    px(c, x - 8, y - 14, 16, 12, '#7a5a3a'); px(c, x - 9, y - 15, 18, 2, '#5a3a1a');
    px(c, x - 6, y - 12, 5, 7, '#e8e0d0'); px(c, x + 1, y - 12, 5, 7, '#e8e0d0'); // 貼り紙
    px(c, x - 1, y - 2, 2, 4, '#4a2f1a'); // 脚
  }
  function cabinet(c, x, y) { // §8：資料棚（書類のキャビネット）
    px(c, x - 8, y - 17, 16, 17, '#4a3a5a'); px(c, x - 9, y - 18, 18, 2, '#6a5a7a'); // 本体
    for (let i = 0; i < 3; i++) { px(c, x - 6, y - 15 + i * 5, 12, 4, '#2e2440'); px(c, x - 1, y - 14 + i * 5, 2, 1, '#caa23a'); } // 引き出し＋取っ手
    px(c, x - 5, y - 16, 3, 2, '#e8e0d0'); px(c, x + 2, y - 16, 3, 2, '#9ad'); // 上に積んだ書類
  }

  /* タイル上の“調べもの”を描く（field.js から呼ぶ） */
  function thing(c, t, cx, cy, time) {
    if (t.kind === 'crystal') { crystalBall(c, cx, cy + 4, time); return; }
    if (t.kind === 'board') { noticeBoard(c, cx, cy + 6, time); return; }
    if (t.kind === 'cabinet') { cabinet(c, cx, cy + 6); return; }
    // NPC（机つきの部署 or ベルゼ）
    if (t.kind === 'dept') deskFor(c, cx, cy + 7, t.dept);
    if (t.id === 'belze') throne(c, cx, cy + 6);
    chibi(c, t.char, cx, cy + 5, 1.5, time, false);
  }

  /* ──────────────────────────────────────────────────────────────
     施策・イベントの演出シーン（320x240 の scene-canvas に描く）。
     t は経過ms。背景＋情景＋小さなアニメ。
     ────────────────────────────────────────────────────────────── */
  function bg(c, top, bottom) {
    const g = c.createLinearGradient(0, 0, 0, 240); g.addColorStop(0, top); g.addColorStop(1, bottom);
    c.fillStyle = g; c.fillRect(0, 0, 320, 240);
  }
  function ground(c, col, y) { px(c, 0, y, 320, 240 - y, col); }
  function star(c, t) { for (let i = 0; i < 30; i++) { const x = (i * 53) % 320, y = (i * 29) % 120; const a = 0.4 + 0.6 * Math.abs(Math.sin(t / 600 + i)); c.fillStyle = `rgba(255,255,255,${a * 0.7})`; c.fillRect(x, y, 1, 1); } }
  // 部署フォーカス（スポットライトで1人を照らす）
  function deptFocus(c, char, accent, t) {
    bg(c, '#0c0a16', '#050409');
    const g = c.createRadialGradient(160, 118, 8, 160, 118, 150);
    g.addColorStop(0, accent + '66'); g.addColorStop(1, 'rgba(0,0,0,0)');
    c.fillStyle = g; c.fillRect(0, 0, 320, 240);
    c.fillStyle = 'rgba(255,255,255,0.06)'; c.beginPath(); c.ellipse(160, 200, 72, 18, 0, 0, Math.PI * 2); c.fill();
    chibi(c, char, 160, 202, 7.2, t, false);
    c.strokeStyle = accent; c.lineWidth = 3; c.strokeRect(7, 7, 306, 226);
    // 四隅のアクセント
    [[7, 7], [313, 7], [7, 233], [313, 233]].forEach(([x, y]) => { px(c, x - 5, y - 1, 11, 2, accent); px(c, x - 1, y - 5, 2, 11, accent); });
  }
  // 小さな吹き出し記号（シーン内で使う）
  function emoteS(c, x, y, sym, t) {
    const fy = y + Math.sin((t || 0) / 250) * 2;
    c.fillStyle = 'rgba(20,14,30,0.85)'; c.fillRect(x - 9, fy - 11, 18, 16);
    c.font = '12px "Hiragino Sans",sans-serif'; c.textAlign = 'center'; c.textBaseline = 'middle';
    c.fillStyle = '#ffe6a0'; c.fillText(sym, x, fy - 2);
  }

  function scene(c, key, t) {
    c.clearRect(0, 0, 320, 240);
    switch (key) {
      case 'poster': { // ホワイト企業宣言
        bg(c, '#3a2f2f', '#1a1410'); ground(c, '#2a2018', 180);
        // 掲示板
        px(c, 110, 70, 100, 80, '#7a5a3a'); px(c, 106, 66, 108, 6, '#5a3a1a');
        px(c, 118, 80, 84, 56, '#f2e6c8');
        px(c, 128, 90, 64, 6, '#b8472f'); px(c, 128, 104, 50, 4, '#3a2c1c'); px(c, 128, 114, 56, 4, '#3a2c1c'); px(c, 128, 124, 40, 4, '#3a2c1c');
        chibi(c, 'villager', 70, 190, 3, t, false); chibi(c, 'villager', 250, 195, 3, t, false);
        break; }
      case 'flyer': { // 求人チラシを拾う
        bg(c, '#4a3a2a', '#1a140e'); ground(c, '#5a4a2a', 175);
        // 街道
        px(c, 0, 175, 320, 8, '#3a2e1a');
        chibi(c, 'garud', 160, 188, 4.5, t, false);
        // チラシ
        const fy = 150 + Math.sin(t / 400) * 4; px(c, 150, fy, 18, 12, '#f2e6c8'); px(c, 154, fy + 3, 10, 1, '#3a2c1c'); px(c, 154, fy + 6, 8, 1, '#3a2c1c');
        break; }
      case 'clinic': { // 村のクリニックに母子
        bg(c, '#1a1830', '#0e0c1a'); star(c, t); ground(c, '#20242a', 180);
        px(c, 100, 96, 120, 84, '#e8e0d0'); px(c, 96, 88, 128, 10, '#6fcf7f'); // 建物＋緑の屋根
        px(c, 150, 130, 20, 50, '#6a4a3a'); // ドア
        const lit = (t % 1600) > 600; px(c, 116, 110, 18, 16, lit ? '#ffd76a' : '#3a3a2a'); px(c, 186, 110, 18, 16, lit ? '#ffd76a' : '#3a3a2a');
        px(c, 132, 124, 4, 6, '#fff'); px(c, 134, 124, 1, 6, '#6fcf7f'); // 十字
        chibi(c, 'villager', 160, 178, 2.4, t, false); chibi(c, 'child', 168, 178, 1.6, t, false);
        // §1：最後のひと手で見た目が変わる——旗を出す／明かりだけ
        if (typeof State !== 'undefined') {
          if (State.flag('clinicFlagUp')) { px(c, 104, 64, 2, 26, '#5a3a1a'); const sw = Math.sin(t / 220) * 3; c.fillStyle = '#b8472f'; c.beginPath(); c.moveTo(106, 66); c.lineTo(132 + sw, 70); c.lineTo(106, 80); c.fill(); px(c, 112, 70, 8, 2, '#fff'); }
          else if (State.flag('clinicLightOnly')) { const g = (t % 1300) > 450; c.fillStyle = g ? 'rgba(255,215,106,0.5)' : 'rgba(255,215,106,0.1)'; c.beginPath(); c.arc(160, 132, 16, 0, Math.PI * 2); c.fill(); }
        }
        break; }
      case 'spy': { // 諜報
        bg(c, '#0e0c18', '#060509'); star(c, t);
        chibi(c, 'shadow', 160, 180, 5, t, false);
        for (let i = 0; i < 8; i++) { const a = 0.2 + 0.2 * Math.sin(t / 300 + i); px(c, 60 + i * 26, 60 + (i % 3) * 14, 2, 2, `rgba(109,181,255,${a})`); }
        break; }
      case 'press': { // 謝罪会見
        bg(c, '#241a38', '#0e0a16'); ground(c, '#1a1430', 185);
        px(c, 130, 120, 60, 12, '#4a3a6a'); // 演台
        chibi(c, 'maou', 160, 120, 4, t, false);
        // フラッシュ
        for (let i = 0; i < 5; i++) { const on = (Math.floor(t / 220) % 5) === i; px(c, 40 + i * 56, 150, 8, 6, on ? '#fff' : '#3a3a4a'); if (on) { c.fillStyle = 'rgba(255,255,255,0.25)'; c.fillRect(0, 0, 320, 240); } }
        break; }
      case 'sign': { // ダンジョン看板
        bg(c, '#1a1622', '#0c0a12'); ground(c, '#241c2a', 180);
        px(c, 120, 150, 80, 30, '#0a0610'); // 落とし穴
        px(c, 90, 120, 6, 40, '#6a4a2a'); px(c, 78, 110, 36, 16, '#caa23a'); px(c, 84, 116, 24, 2, '#3a2c1c'); px(c, 84, 120, 18, 2, '#3a2c1c'); // 看板
        break; }
      case 'rebut': { // 反論掲示
        bg(c, '#2a2030', '#100c18'); ground(c, '#201826', 185);
        px(c, 100, 70, 120, 80, '#3a2c4a'); px(c, 110, 80, 100, 8, '#6db5ff'); px(c, 110, 96, 80, 4, '#e8e0d0'); px(c, 110, 106, 90, 4, '#e8e0d0'); px(c, 110, 116, 70, 4, '#e8e0d0');
        chibi(c, 'villager', 70, 195, 3, t, false); chibi(c, 'villager', 250, 198, 3, t, false);
        break; }
      case 'orphan': { // 孤児院で花
        bg(c, '#22182e', '#0e0a16'); ground(c, '#283a2e', 180);
        chibi(c, 'miria', 130, 180, 4.5, t, false); chibi(c, 'child', 195, 182, 2.2, t, false); chibi(c, 'child', 215, 184, 2, t, false);
        const fy = 150 + Math.sin(t / 350) * 3; px(c, 168, fy, 3, 3, '#ff88bb'); px(c, 166, fy + 2, 7, 1, '#6fcf7f'); // 花
        break; }
      case 'research': { // 魔法使いが資料を読む
        bg(c, '#1a1630', '#0c0a18'); ground(c, '#241c30', 185);
        px(c, 120, 150, 80, 8, '#4a3a2a'); // 机
        chibi(c, 'noel', 160, 150, 4, t, false);
        px(c, 140, 130, 40, 22, '#e8e0d0'); px(c, 160, 130, 1, 22, '#caa'); // 本
        break; }
      case 'kingdom_poster': { // 王国の誤解報道
        bg(c, '#2a1a1a', '#120a0a'); ground(c, '#241818', 180);
        px(c, 110, 70, 100, 80, '#7a5a3a'); px(c, 120, 80, 80, 60, '#e0d0c0'); px(c, 130, 92, 60, 6, '#b8472f'); px(c, 130, 104, 50, 4, '#3a2c1c');
        chibi(c, 'soldier', 90, 190, 3.4, t, false); chibi(c, 'soldier', 230, 192, 3.4, t, false);
        break; }
      case 'campfire': { // 夜営／焚き火
        bg(c, '#0e0c1c', '#06050c'); star(c, t);
        const fl = 6 + Math.sin(t / 120) * 2;
        c.fillStyle = '#ff8a3a'; c.beginPath(); c.moveTo(160, 200); c.lineTo(160 - fl, 215); c.lineTo(160 + fl, 215); c.fill();
        c.fillStyle = '#ffd76a'; c.beginPath(); c.moveTo(160, 206); c.lineTo(160 - fl / 2, 215); c.lineTo(160 + fl / 2, 215); c.fill();
        px(c, 146, 214, 28, 4, '#4a2f1a');
        chibi(c, 'leon', 110, 210, 3.2, t, false); chibi(c, 'garud', 210, 212, 3.2, t, false);
        break; }
      case 'throne_meeting': { // 玉座の間・定例会議（導入の絵）
        bg(c, '#2a2142', '#140e22'); ground(c, '#1d1630', 182);
        px(c, 34, 36, 12, 150, '#241a3a'); px(c, 274, 36, 12, 150, '#241a3a'); // 柱
        px(c, 92, 30, 18, 70, '#3a1a4a'); px(c, 210, 30, 18, 70, '#3a1a4a'); // 旗
        px(c, 96, 38, 10, 26, '#e0556b'); px(c, 214, 38, 10, 26, '#e0556b');
        throne(c, 160, 150); chibi(c, 'maou', 160, 146, 3.2, t, false);
        chibi(c, 'belze', 214, 168, 2.8, t, false);        // 軍師
        const sx = 74 + Math.max(0, Math.sin(t / 320)) * 6; chibi(c, 'soldier', sx, 172, 2.8, t, true); // 駆け込む兵士
        [58, 262].forEach(x => { px(c, x - 1, 58, 2, 24, '#5a3a1a'); const fl = 3 + Math.sin(t / 120 + x) * 2; c.fillStyle = '#ff8a3a'; c.beginPath(); c.moveTo(x, 52); c.lineTo(x - fl, 60); c.lineTo(x + fl, 60); c.fill(); });
        break; }
      case 'monologue': { // 勇者ひとり、焚き火を見つめる
        bg(c, '#0c0a1a', '#050409'); star(c, t);
        const fl = 7 + Math.sin(t / 110) * 3;
        c.fillStyle = 'rgba(255,140,60,' + (0.07 + 0.05 * Math.sin(t / 120)) + ')'; c.fillRect(0, 70, 320, 130); // 火明かりのにじみ
        c.fillStyle = '#ff8a3a'; c.beginPath(); c.moveTo(120, 168); c.lineTo(120 - fl, 188); c.lineTo(120 + fl, 188); c.fill();
        c.fillStyle = '#ffd76a'; c.beginPath(); c.moveTo(120, 176); c.lineTo(120 - fl / 2, 188); c.lineTo(120 + fl / 2, 188); c.fill();
        px(c, 104, 187, 32, 4, '#4a2f1a');
        chibi(c, 'leon', 198, 178, 5.2, t, false); // 大きめの勇者（横顔の寄り）
        break; }
      case 'flyer_keep': { // 戦士がこっそり求人を持っている
        bg(c, '#0e0c1c', '#06050c'); star(c, t); ground(c, '#1a1626', 182);
        chibi(c, 'garud', 130, 182, 5, t, false);
        const fy = 150 + Math.sin(t / 300) * 2; px(c, 150, fy, 18, 13, '#f2e6c8'); px(c, 153, fy + 3, 12, 1, '#3a2c1c'); px(c, 153, fy + 6, 9, 1, '#3a2c1c'); px(c, 153, fy + 9, 11, 1, '#3a2c1c');
        chibi(c, 'noel', 244, 188, 3, t, false); // 見ているノエル
        break; }
      case 'bracelet': { // 和平の腕輪・クローズアップ（なぜ殴れないかを画で）
        bg(c, '#1a0a14', '#070306');
        const pulse = 0.45 + 0.55 * Math.abs(Math.sin(t / 170));
        for (let i = 0; i < 14; i++) { const a = i * Math.PI / 7 + t / 1400; c.strokeStyle = `rgba(224,85,107,${0.10 * pulse})`; c.lineWidth = 2; c.beginPath(); c.moveTo(160, 116); c.lineTo(160 + Math.cos(a) * 220, 116 + Math.sin(a) * 220); c.stroke(); }
        c.save(); c.translate(160, 120); c.rotate(-0.28);
        px(c, -96, -20, 192, 42, '#6b4a86'); px(c, -96, -20, 192, 6, '#9166ad'); px(c, -96, 16, 192, 6, '#4a2f63'); // 前腕
        px(c, -20, -30, 40, 62, '#caa84a'); px(c, -20, -30, 40, 6, '#ffe39a'); px(c, -20, 26, 40, 6, '#8a6a1a'); // 腕輪
        px(c, -20, -4, 40, 8, '#a88a3a');
        c.fillStyle = `rgba(255,${(70 + 130 * pulse) | 0},110,1)`; c.beginPath(); c.arc(0, 1, 12, 0, Math.PI * 2); c.fill(); // 宝玉
        c.fillStyle = `rgba(255,255,255,${0.7 * pulse})`; c.beginPath(); c.arc(-4, -3, 3.5, 0, Math.PI * 2); c.fill();
        c.restore();
        // 下：明滅する結界に守られた村（消えかけ＝賭けるもの）
        const vx = 160, vy = 210;
        px(c, vx - 30, vy, 60, 6, '#243024'); px(c, vx - 18, vy - 12, 12, 12, '#5a4a3a'); px(c, vx + 6, vy - 12, 12, 12, '#5a4a3a'); px(c, vx - 14, vy - 16, 8, 4, '#b8472f'); px(c, vx + 10, vy - 16, 8, 4, '#b8472f');
        c.strokeStyle = `rgba(120,200,255,${0.55 * (1 - pulse * 0.7)})`; c.lineWidth = 2; c.beginPath(); c.arc(vx, vy, 28, Math.PI, 0); c.stroke();
        break; }
      case 'focus_pr':      deptFocus(c, 'pazuzu', '#e07a4a', t); break;
      case 'focus_hr':      deptFocus(c, 'ririmu', '#e0a23a', t); break;
      case 'focus_welfare': deptFocus(c, 'ork',    '#5fae6a', t); break;
      case 'focus_recon':   deptFocus(c, 'shadow', '#6a8aff', t); break;
      case 'clinic_fail': { // 診療所の前に王国兵＋“前線基地”ポスター
        bg(c, '#2a1818', '#100808'); ground(c, '#241818', 180);
        px(c, 96, 96, 120, 84, '#e0d0c0'); px(c, 92, 88, 128, 10, '#6fcf7f'); px(c, 150, 130, 20, 50, '#6a4a3a');
        px(c, 132, 116, 4, 6, '#fff'); px(c, 134, 116, 1, 6, '#6fcf7f'); // 十字
        chibi(c, 'soldier', 70, 188, 3.4, t, false); chibi(c, 'soldier', 250, 190, 3.4, t, false);
        px(c, 40, 60, 40, 30, '#7a3a2a'); px(c, 46, 66, 28, 5, '#e0556b'); px(c, 46, 76, 22, 3, '#e8d8d0'); // 反魔王ポスター
        break; }
      case 'flyer_fail': { // 勇者がチラシを焚き火へ
        bg(c, '#160e12', '#070406'); star(c, t);
        const fl = 6 + Math.sin(t / 110) * 2; c.fillStyle = '#ff8a3a'; c.beginPath(); c.moveTo(160, 196); c.lineTo(160 - fl, 212); c.lineTo(160 + fl, 212); c.fill();
        px(c, 146, 211, 28, 4, '#4a2f1a');
        chibi(c, 'leon', 120, 196, 4, t, false); chibi(c, 'garud', 220, 200, 3.2, t, false);
        const py2 = 150 + (t / 18 % 40); px(c, 156, py2, 14, 9, '#f2e6c8'); // 落ちていくチラシ
        break; }
      case 'press_fail': { // 会見・記者に詰められしどろもどろ
        bg(c, '#241a30', '#0e0a16'); ground(c, '#1a1430', 185);
        px(c, 130, 120, 60, 12, '#4a3a6a'); chibi(c, 'maou', 160, 120, 4, t, false);
        px(c, 156, 96, 4, 3, '#cfe6ff'); px(c, 150, 98, 16, 2, 'rgba(160,200,255,0.5)'); // 汗
        for (let i = 0; i < 6; i++) { const on = (Math.floor(t / 140) % 6) === i; px(c, 28 + i * 48, 150, 9, 7, on ? '#fff' : '#3a3a4a'); if (on) { c.fillStyle = 'rgba(255,255,255,0.3)'; c.fillRect(0, 0, 320, 240); } chibi(c, 'soldier', 30 + i * 48, 200, 2, t, false); }
        break; }
      case 'rebut_fail': { // 反論失敗・王国の追加ポスターが優勢
        bg(c, '#241622', '#0e0a14'); ground(c, '#201826', 185);
        px(c, 60, 64, 80, 86, '#3a2c4a'); px(c, 70, 74, 60, 8, '#6db5ff'); px(c, 70, 90, 44, 4, '#cfd6e8'); // 魔王軍（小）
        px(c, 168, 56, 92, 96, '#7a3a2a'); px(c, 178, 66, 72, 10, '#e0556b'); px(c, 178, 82, 56, 4, '#e8d8d0'); px(c, 178, 92, 60, 4, '#e8d8d0'); // 王国（大・優勢）
        chibi(c, 'villager', 110, 196, 3, t, false); emoteS(c, 110, 168, '？', t);
        break; }
      default: bg(c, '#241a38', '#0e0a16');
    }
  }

  /* ── エンディング絵（320x180・アニメ＆粒子つき） ── */
  function ending(c, key, t) {
    c.clearRect(0, 0, 320, 180);
    const bgE = (a, b) => { const g = c.createLinearGradient(0, 0, 0, 180); g.addColorStop(0, a); g.addColorStop(1, b); c.fillStyle = g; c.fillRect(0, 0, 320, 180); };
    const starsE = (col) => { for (let i = 0; i < 26; i++) { const x = (i * 61) % 320, y = (i * 37) % 90; const a = 0.3 + 0.6 * Math.abs(Math.sin(t / 500 + i)); c.fillStyle = (col || `rgba(255,255,255,${a})`); c.fillRect(x, y, 1, 1); } };
    switch (key) {
      case 'end_retire': { // パン屋（夕日・湯気・舞う花びら）
        bgE('#ffd79a', '#e08a4a');
        c.fillStyle = '#fff0c0'; c.beginPath(); c.arc(270, 36, 22, 0, Math.PI * 2); c.fill(); // 夕日
        px(c, 0, 132, 320, 48, '#9a6230'); px(c, 0, 132, 320, 3, '#c98a4a'); // 地面
        // パン屋
        px(c, 96, 56, 128, 78, '#f3d9aa'); px(c, 86, 46, 148, 12, '#b8472f'); // 屋根
        for (let i = 0; i < 7; i++) px(c, 90 + i * 22, 46, 11, 12, i % 2 ? '#b8472f' : '#e8e0d0'); // ストライプ庇
        px(c, 150, 92, 24, 42, '#7a4a26'); px(c, 168, 110, 3, 3, '#ffd76a'); // ドア
        px(c, 110, 80, 24, 18, '#3a2a52'); px(c, 190, 80, 24, 18, '#3a2a52'); // 窓
        px(c, 116, 64, 30, 9, '#e0556b'); px(c, 120, 66, 22, 2, '#fff'); // 看板「PAN」
        // パン陳列＋湯気
        for (let i = 0; i < 3; i++) { px(c, 112 + i * 28, 120, 14, 8, '#caa063'); const sy = 112 - (t / 30 + i * 40) % 30; c.fillStyle = `rgba(255,255,255,${0.18})`; c.fillRect(116 + i * 28, sy, 3, 6); }
        chibi(c, 'leon', 60, 170, 3.4, t, false); px(c, 52, 158, 16, 10, '#f0f0f0'); // エプロン
        // 花輪（魔王軍からの祝い）
        c.strokeStyle = '#6fcf7f'; c.lineWidth = 4; c.beginPath(); c.arc(262, 120, 17, 0, Math.PI * 2); c.stroke();
        for (let i = 0; i < 6; i++) { const a = i * Math.PI / 3 + t / 800; px(c, 262 + Math.cos(a) * 17 - 1, 120 + Math.sin(a) * 17 - 1, 3, 3, i % 2 ? '#e0556b' : '#ffd76a'); }
        px(c, 258, 100, 8, 5, '#e0556b'); // リボン
        // 舞う花びら
        for (let i = 0; i < 10; i++) { const x = (i * 71 + t / 20) % 320, y = (i * 53 + t / 12) % 170; c.fillStyle = `rgba(255,${150 + i * 8},190,0.8)`; c.fillRect(x, y, 2, 2); }
        break; }
      case 'end_disband': { // それぞれの道（夜・分かれ道・遠ざかる4人）
        bgE('#2a2350', '#0e0a1c'); starsE();
        // 分かれ道（消失点へ）
        c.fillStyle = '#1a1530'; c.beginPath(); c.moveTo(160, 70); c.lineTo(20, 180); c.lineTo(300, 180); c.fill();
        for (let i = 0; i < 4; i++) { c.strokeStyle = 'rgba(180,180,220,0.25)'; c.lineWidth = 1; c.beginPath(); c.moveTo(160, 72); c.lineTo(20 + i * 90, 180); c.stroke(); }
        px(c, 156, 60, 8, 14, '#5a4a3a'); px(c, 150, 58, 20, 6, '#caa23a'); // 道標
        // 遠ざかる4人（手前ほど大きく散る）
        const wob = Math.sin(t / 220) * 1;
        chibi(c, 'garud', 50, 172 + wob, 2.6, t, true); chibi(c, 'miria', 116, 150, 2.0, t, true);
        chibi(c, 'noel', 208, 150, 2.0, t, true); chibi(c, 'leon', 280, 172 - wob, 2.6, t, true);
        // 各自のランタン
        [[50, 160], [116, 140], [208, 140], [280, 160]].forEach(([x, y]) => { c.fillStyle = `rgba(255,200,120,${0.5 + 0.3 * Math.sin(t / 200 + x)})`; c.beginPath(); c.arc(x + 6, y, 3, 0, Math.PI * 2); c.fill(); });
        break; }
      case 'end_treaty': { // 共存・夜明け（回る光条・はためく旗・鳩）
        bgE('#ffe09a', '#ff8f5a');
        // 回転する光条
        c.save(); c.translate(160, 150);
        for (let i = 0; i < 12; i++) { const a = i * Math.PI / 6 + t / 1600; c.fillStyle = 'rgba(255,250,210,0.18)'; c.beginPath(); c.moveTo(0, 0); c.lineTo(Math.cos(a - 0.06) * 240, Math.sin(a - 0.06) * 240); c.lineTo(Math.cos(a + 0.06) * 240, Math.sin(a + 0.06) * 240); c.fill(); }
        c.restore();
        c.fillStyle = '#fff6cc'; c.beginPath(); c.arc(160, 150, 46, Math.PI, 0); c.fill(); // 朝日
        px(c, 0, 150, 320, 30, '#3f6a3f'); px(c, 0, 150, 320, 3, '#5fae6a'); // 緑の丘
        // はためく旗
        const sway = Math.sin(t / 200) * 4;
        px(c, 150, 78, 4, 74, '#5a3a1a');
        c.fillStyle = '#e0556b'; c.beginPath(); c.moveTo(154, 80); c.lineTo(196 + sway, 86); c.lineTo(196 + sway, 104); c.lineTo(154, 100); c.fill();
        px(c, 160, 86, 22, 3, '#fff'); px(c, 160, 92, 16, 3, '#fff');
        // 村の家
        px(c, 60, 134, 16, 16, '#8a5a3a'); px(c, 244, 132, 18, 18, '#8a5a3a'); px(c, 58, 128, 20, 7, '#b8472f'); px(c, 242, 126, 22, 7, '#b8472f');
        // 飛ぶ鳩
        for (let i = 0; i < 4; i++) { const x = (60 + i * 70 + t / 18) % 340 - 10, y = 44 + Math.sin(t / 300 + i) * 8; const f = Math.sin(t / 90 + i) * 4; c.strokeStyle = '#fff'; c.lineWidth = 2; c.beginPath(); c.moveTo(x - 5, y + f); c.lineTo(x, y); c.lineTo(x + 5, y + f); c.stroke(); }
        break; }
      case 'end_meeting': { // 最終面談・会議室（茶の湯気・あたたかい灯）
        bgE('#3a2c4e', '#14102a');
        c.fillStyle = 'rgba(255,200,120,0.16)'; c.beginPath(); c.arc(160, 70, 60, 0, Math.PI * 2); c.fill(); // ランプの光
        px(c, 156, 20, 8, 26, '#3a2a1a'); px(c, 146, 44, 28, 10, '#ffd76a'); // 吊りランプ
        px(c, 70, 120, 180, 16, '#5a4326'); px(c, 70, 116, 180, 4, '#7a5a36'); // テーブル
        chibi(c, 'maou', 110, 122, 3.2, t, false); chibi(c, 'leon', 210, 122, 3.2, t, false);
        chibi(c, 'belze', 285, 128, 2.2, t, false); // 隅のベルゼ
        // 茶碗＋湯気
        [140, 180].forEach(x => { px(c, x, 110, 9, 6, '#cfd6e8'); for (let i = 0; i < 3; i++) { const sy = 108 - (t / 26 + i * 22) % 26; c.fillStyle = 'rgba(255,255,255,0.22)'; c.fillRect(x + 4, sy, 2, 5); } });
        px(c, 156, 108, 12, 4, '#e8e0d0'); // 書類（剣ではなく）
        break; }
      case 'end_fight': { // 討伐続行・法務部（書類の山・舞う紙・腕輪の光）
        bgE('#241620', '#080406');
        px(c, 0, 150, 320, 30, '#1a1018');
        // 書類の山
        for (let i = 0; i < 5; i++) px(c, 40 + i * 4, 120 - i * 6, 70 - i * 4, 8, i % 2 ? '#e8e0d0' : '#cfc7ba');
        for (let i = 0; i < 5; i++) px(c, 210 + i * 4, 124 - i * 5, 64 - i * 4, 8, i % 2 ? '#e8e0d0' : '#cfc7ba');
        // 「法務部」デスクの札
        px(c, 132, 96, 56, 14, '#3a2c4a'); px(c, 138, 100, 44, 2, '#9ad'); px(c, 138, 105, 30, 2, '#9ad');
        chibi(c, 'leon', 90, 150, 3.2, t, false); chibi(c, 'maou', 230, 150, 3.4, t, false);
        const gl = 0.4 + 0.45 * Math.abs(Math.sin(t / 200)); c.fillStyle = `rgba(255,90,107,${gl})`; c.fillRect(218, 132, 9, 4); // 腕輪
        // 延々と舞う書類
        for (let i = 0; i < 9; i++) { const x = (i * 47 + t / 14) % 330 - 8, y = (i * 31 + t / 22) % 130 + 10, r = (t / 200 + i); c.save(); c.translate(x, y); c.rotate(r); c.fillStyle = 'rgba(232,224,214,0.9)'; c.fillRect(-7, -9, 14, 18); c.fillStyle = '#9a8'; c.fillRect(-4, -5, 8, 1); c.fillRect(-4, -1, 6, 1); c.restore(); }
        break; }
      case 'end_hire': { // 勇者、転職（魔王軍に新部署・レオン課長）
        bgE('#2a2150', '#140e2c'); px(c, 0, 130, 320, 50, '#1f1740');
        // デスクとレオン課長
        px(c, 60, 108, 90, 14, '#5a4326'); px(c, 60, 104, 90, 4, '#7a5a36');
        chibi(c, 'leon', 105, 110, 3.2, t, false);
        px(c, 92, 96, 30, 9, '#e8e0d0'); px(c, 96, 99, 22, 1, '#3a2c1c'); // 名札「渉外課」
        // 魔王軍の同僚たち
        chibi(c, 'maou', 210, 130, 2.8, t, false); chibi(c, 'pazuzu', 250, 132, 2.4, t, false); chibi(c, 'ork', 285, 134, 2.4, t, false);
        // 書類の受け渡し
        const fy = 96 + Math.sin(t / 300) * 3; px(c, 150, fy, 14, 9, '#f2e6c8');
        // 紙吹雪（祝い）
        for (let i = 0; i < 12; i++) { const x = (i * 59 + t / 22) % 320, y = (i * 41 + t / 16) % 130; c.fillStyle = ['#ffd76a', '#e0556b', '#6fcf7f', '#6db5ff'][i % 4]; c.fillRect(x, y, 2, 3); }
        break; }
      default: bgE('#241a38', '#0e0a16');
    }
  }

  /* ── タイトルロゴ用の小演出（玉座に座る魔王＋松明） ── */
  function title(c, t) {
    c.clearRect(0, 0, 240, 120);
    const g = c.createLinearGradient(0, 0, 0, 120); g.addColorStop(0, '#34204a'); g.addColorStop(1, '#120a1e'); c.fillStyle = g; c.fillRect(0, 0, 240, 120);
    px(c, 0, 96, 240, 24, '#1a1228');
    throne(c, 120, 96);
    chibi(c, 'maou', 120, 92, 3, t, false);
    // 両脇の松明
    [40, 200].forEach(x => { px(c, x - 1, 50, 2, 30, '#5a3a1a'); const fl = 4 + Math.sin(t / 130 + x) * 2; c.fillStyle = '#ff8a3a'; c.beginPath(); c.moveTo(x, 44); c.lineTo(x - fl, 52); c.lineTo(x + fl, 52); c.fill(); });
    // 腕輪のきらめき
    const a = 0.5 + 0.5 * Math.abs(Math.sin(t / 250)); px(c, 132, 84, 4, 3, `rgba(255,90,107,${a})`);
  }

  /* ── §9/§10：城の小物アイコン（field.js が調べものの隣に小さく描く） ── */
  function prop(c, id, cx, cy, t) {
    const P = (x, y, w, h, col) => px(c, Math.round(cx + x), Math.round(cy + y), w, h, col);
    c.fillStyle = 'rgba(0,0,0,0.22)'; c.beginPath(); c.ellipse(cx, cy, 6, 2, 0, 0, Math.PI * 2); c.fill();
    switch (id) {
      case 'mug': // 魔王のマグカップ（湯気つき）
        P(-4, -8, 8, 7, '#cfd6e8'); P(-4, -8, 8, 2, '#eef'); P(4, -7, 2, 4, '#cfd6e8'); P(-3, -7, 6, 1, '#4a3a2a');
        for (let i = 0; i < 2; i++) { const sy = -9 - ((t / 45 + i * 7) % 10); c.fillStyle = 'rgba(255,255,255,0.28)'; c.fillRect(Math.round(cx - 1 + i * 3), Math.round(cy + sy), 1, 3); } break;
      case 'copier': // スライムコピー機（紙を吐く）
        P(-7, -10, 14, 10, '#5a6aa8'); P(-7, -10, 14, 2, '#7a8ad0'); P(-5, -7, 4, 2, '#9ad'); P(-3, -3, 9, 4, '#e8e0d0'); P(-3, -3, 9, 1, '#fff'); break;
      case 'poster': // ダンジョン安全ポスター
        P(-1, -13, 2, 13, '#6a4a2a'); P(-7, -14, 14, 9, '#caa23a'); P(-7, -14, 14, 1, '#e0c869'); P(-4, -11, 8, 1, '#3a2c1c'); P(-4, -9, 6, 1, '#3a2c1c'); break;
      case 'slogan': // 今日の魔王軍標語（掲示板）
        P(-8, -13, 16, 10, '#7a5a3a'); P(-8, -14, 16, 2, '#5a3a1a'); P(-6, -11, 12, 1, '#e8e0d0'); P(-6, -9, 9, 1, '#e8e0d0'); P(-6, -7, 11, 1, '#e8e0d0'); break;
      case 'flower': // 机の上の花（クリニック成功の残留）
        P(-2, -5, 4, 5, '#6a4a3a'); P(-1, -9, 2, 4, '#5fae6a'); P(-3, -10, 3, 3, '#ff88bb'); P(1, -11, 3, 3, '#ffd76a'); break;
      case 'papers': // 積まれた書類／散らかった原稿
        for (let i = 0; i < 4; i++) P(-6 + i, -3 - i * 2, 11 - i, 2, i % 2 ? '#e8e0d0' : '#cfc7ba'); break;
      case 'clip': // 壁の切り抜き（ピンどめ）
        P(-6, -13, 12, 12, '#e8e0d0'); P(-4, -10, 8, 1, '#b8472f'); P(-4, -7, 6, 1, '#3a2c1c'); P(0, -14, 1, 2, '#d04a4a'); break;
      case 'map': // 壁の地図＋赤丸
        P(-7, -13, 14, 12, '#d8cdb0'); P(-7, -13, 14, 1, '#b8a87a');
        c.strokeStyle = '#8a6a3a'; c.lineWidth = 1; c.beginPath(); c.moveTo(cx - 5, cy - 10); c.lineTo(cx + 3, cy - 4); c.stroke();
        c.strokeStyle = '#d04a4a'; c.lineWidth = 1; c.beginPath(); c.arc(cx + 1, cy - 6, 2, 0, Math.PI * 2); c.stroke(); break;
      default: P(-3, -6, 6, 6, '#8a8a9a');
    }
  }

  /* ── §2：魔王の承認印（朱の角印）。ui.js が stamp 演出で1回描く ── */
  function rr(c, x, y, w, h, r) { c.beginPath(); if (c.roundRect) c.roundRect(x, y, w, h, r); else c.rect(x, y, w, h); }
  function seal(c, label) {
    const W = c.canvas.width, H = c.canvas.height; c.clearRect(0, 0, W, H);
    c.save(); c.translate(W / 2, H / 2); c.rotate(-0.1);
    const R = '#c5292b';
    c.fillStyle = 'rgba(197,41,43,0.10)'; rr(c, -W * 0.36, -H * 0.30, W * 0.72, H * 0.60, 12); c.fill();
    c.strokeStyle = R; c.lineWidth = 5; rr(c, -W * 0.32, -H * 0.26, W * 0.64, H * 0.52, 10); c.stroke();
    c.strokeStyle = R; c.lineWidth = 2; rr(c, -W * 0.26, -H * 0.20, W * 0.52, H * 0.40, 7); c.stroke();
    c.fillStyle = R; c.textAlign = 'center'; c.textBaseline = 'middle';
    const n = (label || '').length;
    const lines = n <= 3 ? [label] : [label.slice(0, Math.ceil(n / 2)), label.slice(Math.ceil(n / 2))];
    const fs = lines.length > 1 ? Math.floor(H * 0.17) : Math.floor(H * 0.22);
    c.font = `bold ${fs}px "Hiragino Sans","Yu Gothic",sans-serif`;
    lines.forEach((ln, i) => c.fillText(ln, 0, (i - (lines.length - 1) / 2) * fs * 1.15));
    c.restore();
  }

  return { face, portrait, chibi, thing, throne, crystalBall, noticeBoard, scene, ending, title, prop, seal, px };
})();
