/* =========================================================================
   crystal.js — 水晶玉ごしの「勇者パーティー観察」。
   3つの可視状態を“数値ではなく隊列・姿勢・表情”で見せるのが本作の肝。
   ・仲間の不満  → 4人の隊列の近さ／バラけ方
   ・勇者の迷い  → 勇者の姿勢（前傾・立ち止まり・剣に手・剣の点滅）
   ・世間の評判  → 沿道の村人の反応
   main.js の描画ループが Crystal.drawParty(ctx,t) を毎フレーム呼ぶ。
   ========================================================================= */
const Crystal = (() => {
  // パーティーの並び（基準オフセット）。nakama 段階でばらけさせる。
  const BASE = [
    { who: 'leon',  x: 165, lead: true },
    { who: 'garud', x: 120 },
    { who: 'miria', x: 200 },
    { who: 'noel',  x: 95 },
  ];

  function drawParty(ctx, t) {
    ctx.clearRect(0, 0, 320, 240);
    // 夜空〜地平
    const g = ctx.createLinearGradient(0, 0, 0, 240);
    g.addColorStop(0, '#141026'); g.addColorStop(0.55, '#1c1838'); g.addColorStop(1, '#0d0a18');
    ctx.fillStyle = g; ctx.fillRect(0, 0, 320, 240);
    // 星
    for (let i = 0; i < 24; i++) { const x = (i * 47) % 320, y = (i * 31) % 110; ctx.fillStyle = `rgba(255,255,255,${0.3 + 0.4 * Math.abs(Math.sin(t / 700 + i))})`; ctx.fillRect(x, y, 1, 1); }

    // 遠くの魔王城（distance が縮むほど大きく＝近づく）
    const prog = Math.max(0, Math.min(1, (10 - State.distance) / 9));
    const cw = 26 + prog * 26, cy = 96 - prog * 8;
    ctx.fillStyle = '#0e0a18'; ctx.fillRect(160 - cw / 2, cy - cw * 0.7, cw, cw * 0.7);
    ctx.fillStyle = '#1a1228';
    for (let i = 0; i < 3; i++) ctx.fillRect(160 - cw / 2 + i * (cw / 3), cy - cw * 0.7 - 6, cw / 4, 8); // 尖塔
    const lit = (t % 1400) > 500; ctx.fillStyle = lit ? 'rgba(255,180,84,0.7)' : '#2a2010';
    ctx.fillRect(160 - 2, cy - cw * 0.4, 4, 5);

    // 地面（道）
    ctx.fillStyle = '#241c30'; ctx.fillRect(0, 150, 320, 90);
    ctx.fillStyle = '#33283f'; ctx.beginPath(); ctx.moveTo(120, 150); ctx.lineTo(200, 150); ctx.lineTo(280, 240); ctx.lineTo(40, 240); ctx.fill();
    // 道のセンターライン
    for (let i = 0; i < 5; i++) { const yy = 160 + i * 18; ctx.fillStyle = 'rgba(255,255,255,0.08)'; ctx.fillRect(158, yy, 4, 8); }

    const nak = State.stage('nakama');  // 0..4
    const may = State.stage('mayoi');
    const sek = State.stage('seken');

    // 沿道の村人（評判で反応が変わる）
    drawVillager(ctx, 36, 196, sek, t, -1);
    drawVillager(ctx, 286, 200, sek, t, 1);

    // 隊列：nakama が高いほど散らばり、僧侶/魔法は離れて背を向ける
    const spread = nak * 7;             // ばらけ幅
    const drift = nak >= 2 ? nak * 4 : 0;
    const members = BASE.map((m, i) => {
      let x = m.x + (i % 2 ? spread : -spread) * (i / 2);
      let y = 198 + (i === 0 ? 6 : 0) - (i >= 2 && nak >= 2 ? drift : 0); // 温度差で後方/上へ
      if (i === 1 && nak >= 1) y -= 8;  // 戦士が少し遅れる→上(奥)へ
      const face = (i >= 2 && nak >= 2);  // 背を向ける表現（左右反転）
      return { who: m.who, x: Math.max(24, Math.min(296, x)), y, lead: m.lead, face };
    });
    // 奥のものから描く
    members.slice().sort((a, b) => a.y - b.y).forEach(m => {
      Sprites.chibi(ctx, m.who, m.x, m.y, 3.2, t, false);
      if (m.lead) drawHeroPose(ctx, m.x, m.y, may, t);
      // §5：段階ごとの“仕草”を、絵で。
      if (m.who === 'garud' && nak === 1) { const r = (t % 2600) > 2200; if (r) emote(ctx, m.x, m.y - 30, '〜', t); } // 肩を回す
      if (m.who === 'noel' && nak >= 2) { ctx.fillStyle = '#e8e0d0'; ctx.fillRect(m.x - 12, m.y - 20, 11, 8); ctx.fillStyle = '#9a8'; ctx.fillRect(m.x - 6, m.y - 20, 1, 8); } // 歩きながら本を読む
      if (m.who === 'miria' && nak >= 2) emote(ctx, m.x, m.y - 30, '…', t); // 勇者でなく村の方を見る間
      if (m.who === 'garud' && nak >= 3) emote(ctx, m.x, m.y - 32, '💢', t);
      if (m.who === 'noel' && nak >= 3) emote(ctx, m.x, m.y - 32, '💢', t);

      // §7：残留——一度起きた変化が、持ち物・仕草として以降ずっと残る。
      if (m.who === 'garud' && State.flag('warriorKeptFlyer')) { const fy = m.y - 17 + Math.sin(t / 420) * 1; ctx.fillStyle = '#f2e6c8'; ctx.fillRect(Math.round(m.x + 8), Math.round(fy), 6, 8); ctx.fillStyle = '#3a2c1c'; ctx.fillRect(Math.round(m.x + 9), Math.round(fy + 2), 4, 1); ctx.fillRect(Math.round(m.x + 9), Math.round(fy + 4), 3, 1); } // ポケットの求人票
      if (m.who === 'miria' && (State.flag('priestDoubtsChurch') || State.flag('priestVisitedOrphanage'))) emote(ctx, m.x, m.y - 30, '🌼', t); // 魔族の子からの花
      if (m.who === 'leon' && State.flag('heroSawApology')) { ctx.fillStyle = '#e0d8c8'; ctx.fillRect(Math.round(m.x - 13), Math.round(m.y - 15), 5, 6); } // 会見の切り抜き
    });

    // 口論寸前/解散寸前の地の文っぽいモヤ
    if (nak >= 4) { ctx.fillStyle = 'rgba(120,40,60,0.12)'; ctx.fillRect(0, 150, 320, 90); }
  }

  // 勇者の姿勢（迷いの段階を“動き”で）
  function drawHeroPose(ctx, x, y, stage, t) {
    if (stage === 0) {       // 討伐一直線：前傾（前のめりの線）
      ctx.strokeStyle = 'rgba(255,90,107,0.5)'; ctx.lineWidth = 1;
      ctx.beginPath(); ctx.moveTo(x + 12, y - 24); ctx.lineTo(x + 18, y - 20); ctx.stroke();
    } else if (stage === 1) { // 違和感：「…」
      emote(ctx, x, y - 34, '…', t);
    } else if (stage === 2) { // 迷い：焚き火を見つめる→？
      emote(ctx, x, y - 34, '？', t);
    } else if (stage === 3) { // 葛藤：剣に手をかけて止まる
      ctx.fillStyle = '#cfd6e8'; ctx.fillRect(x + 9, y - 26, 2, 12);
      emote(ctx, x, y - 36, '⚡', t);
    } else if (stage >= 4) {  // 剣を置きそう：剣アイコンが点滅
      const bl = (t % 700) > 350; if (bl) { ctx.fillStyle = '#ffd76a'; ctx.fillRect(x + 8, y - 30, 3, 16); ctx.fillRect(x + 6, y - 18, 7, 2); }
      emote(ctx, x, y - 40, '🕊', t);
    }
  }

  function drawVillager(ctx, x, y, sek, t, facing) {
    // 評判が低いと逃げる／高いと手を振る、を簡易表現
    if (sek <= 0) { Sprites.chibi(ctx, 'villager', x, y, 2.4, t, false); ctx.fillStyle = '#e0556b'; emote(ctx, x, y - 24, '✕', t); }
    else if (sek === 1) { Sprites.chibi(ctx, 'villager', x + facing * 6, y, 2.4, t, false); emote(ctx, x, y - 24, '!', t); }
    else if (sek === 2) { Sprites.chibi(ctx, 'villager', x, y, 2.4, t, false); }
    else { Sprites.chibi(ctx, 'villager', x, y, 2.4, t, false); emote(ctx, x, y - 26, '♪', t); }
  }

  function emote(ctx, x, y, sym, t) {
    const fy = y + Math.sin(t / 250) * 2;
    ctx.fillStyle = 'rgba(20,14,30,0.85)'; ctx.beginPath(); ctx.roundRect ? ctx.roundRect(x - 9, fy - 11, 18, 16, 4) : ctx.rect(x - 9, fy - 11, 18, 16); ctx.fill();
    ctx.font = '11px DotGothic16, sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillStyle = '#ffe6a0'; ctx.fillText(sym, x, fy - 2);
  }

  // 直近に施策が無いときの“地の会話”：一番動いている状態を拾う
  function ambientLines() {
    const cand = [['mayoi', State.stage('mayoi')], ['nakama', State.stage('nakama')], ['seken', State.stage('seken')]];
    // 初期段階（団結/警戒など）より進んでいる軸を優先。同点なら mayoi。
    cand.sort((a, b) => b[1] - a[1]);
    const key = cand[0][0]; const st = cand[0][1];
    return DATA.ambient[key][st].slice();
  }

  return { drawParty, ambientLines };
})();
