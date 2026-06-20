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

  /* タイル上の“調べもの”を描く（field.js から呼ぶ） */
  function thing(c, t, cx, cy, time) {
    if (t.kind === 'crystal') { crystalBall(c, cx, cy + 4, time); return; }
    if (t.kind === 'board') { noticeBoard(c, cx, cy + 6, time); return; }
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
      default: bg(c, '#241a38', '#0e0a16');
    }
  }

  /* ── エンディング絵（320x180） ── */
  function ending(c, key, t) {
    c.clearRect(0, 0, 320, 180);
    const bgE = (a, b) => { const g = c.createLinearGradient(0, 0, 0, 180); g.addColorStop(0, a); g.addColorStop(1, b); c.fillStyle = g; c.fillRect(0, 0, 320, 180); };
    switch (key) {
      case 'end_retire': // パン屋
        bgE('#ffce8a', '#d98a4a'); px(c, 0, 130, 320, 50, '#8a5a2a');
        px(c, 110, 60, 100, 70, '#f2d6a8'); px(c, 100, 52, 120, 10, '#b8472f'); px(c, 150, 90, 22, 40, '#6a4a2a');
        px(c, 118, 74, 30, 10, '#e0556b'); // 看板
        chibi(c, 'leon', 70, 168, 3.2, t, false);
        // 花輪
        c.strokeStyle = '#6fcf7f'; c.lineWidth = 3; c.beginPath(); c.arc(250, 100, 16, 0, Math.PI * 2); c.stroke();
        break;
      case 'end_disband': // それぞれの道
        bgE('#3a2f5a', '#15101f'); px(c, 0, 140, 320, 40, '#241a38');
        chibi(c, 'garud', 60, 165, 2.6, t, false); chibi(c, 'miria', 120, 165, 2.6, t, false);
        chibi(c, 'noel', 180, 165, 2.6, t, false); chibi(c, 'leon', 250, 165, 2.6, t, false);
        for (let i = 0; i < 4; i++) px(c, 50 + i * 60, 150, 1, 12, 'rgba(255,255,255,0.3)');
        break;
      case 'end_treaty': // 旗と日の出
        bgE('#ffd76a', '#ff9a5a'); px(c, 0, 120, 320, 60, '#3a5a3a');
        c.fillStyle = '#fff4c0'; c.beginPath(); c.arc(160, 120, 40, Math.PI, 0); c.fill();
        px(c, 150, 70, 4, 60, '#5a3a1a'); px(c, 154, 70, 30, 18, '#e0556b'); px(c, 158, 76, 22, 8, '#fff');
        break;
      case 'end_meeting': // 会議室で握手手前
        bgE('#241a38', '#0e0a16'); px(c, 0, 120, 320, 60, '#1a1430');
        px(c, 110, 96, 100, 14, '#4a3a2a'); // テーブル
        chibi(c, 'maou', 120, 96, 3, t, false); chibi(c, 'leon', 200, 96, 3, t, false);
        break;
      case 'end_fight': // バッドエンド：書類
        bgE('#1a0e14', '#080406'); chibi(c, 'leon', 110, 150, 3.4, t, false); chibi(c, 'maou', 210, 150, 3.4, t, false);
        // 腕輪の光
        const g = 0.4 + 0.4 * Math.abs(Math.sin(t / 200)); c.fillStyle = `rgba(255,90,107,${g})`; c.fillRect(196, 130, 8, 4);
        for (let i = 0; i < 6; i++) px(c, 30 + i * 50, 40 + (i % 2) * 20, 14, 18, '#e8e0d0'); // 舞う書類
        break;
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

  return { face, portrait, chibi, thing, throne, crystalBall, noticeBoard, scene, ending, title, px };
})();
