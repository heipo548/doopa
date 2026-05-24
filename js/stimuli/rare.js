/* ============================================================
   刺激: ✨ レアガチャ（発見系）
   ・自動で次々アイテムが出現（N/R/SR/SSR）
   ・SSR が出ると画面全体が爆発演出
   ・タップで次のアイテムを早送り
   ・8秒で 7〜9 枚出る
   ============================================================ */

const Rare = (() => {
  const id = 'rare';
  const label = '✨ レアガチャ';

  const TIERS = [
    { name: 'N',  weight: 60, glyphs: ['📦','💩','🌾','🍞','🧱','🥚'] },
    { name: 'R',  weight: 25, glyphs: ['🔮','🧪','📜','🗝️','🎁'] },
    { name: 'SR', weight: 12, glyphs: ['🦄','🐉','👑','💎','🏆'] },
    { name: 'SSR', weight: 3, glyphs: ['🌟','🪐','🔱','⚡','♾️'] },
  ];

  function pickTier() {
    const total = TIERS.reduce((s, t) => s + t.weight, 0);
    let r = Math.random() * total;
    for (const t of TIERS) { r -= t.weight; if (r <= 0) return t; }
    return TIERS[0];
  }

  function init(host, cb) {
    host.innerHTML = '';
    const stage = document.createElement('div');
    stage.className = 'rare-stage';
    host.appendChild(stage);

    let interval = 950;
    let timer;
    let alive = true;
    let pulled = 0;
    let bestTier = 'N';
    const tierRank = { N:0, R:1, SR:2, SSR:3 };
    const DURATION = 8000;

    function showCard() {
      if (!alive) return;
      const t = pickTier();
      const glyph = t.glyphs[Math.floor(Math.random() * t.glyphs.length)];
      pulled++;
      if (tierRank[t.name] > tierRank[bestTier]) bestTier = t.name;

      // 既存カードを消す
      stage.querySelectorAll('.rare-card').forEach(el => el.remove());

      const card = document.createElement('div');
      card.className = `rare-card tier-${t.name} appear`;
      card.innerHTML = `
        <div class="glyph">${glyph}</div>
        <div class="rank">${t.name}</div>
      `;
      stage.appendChild(card);

      // 報酬と演出
      const reward = { N: 0.5, R: 1.5, SR: 3, SSR: 8 }[t.name];
      cb.onDopamine(reward);

      if (t.name === 'SSR') {
        Effects.sfx.rare();
        Effects.flash('rgba(255,215,0,0.6)', 200);
        const r = card.getBoundingClientRect();
        Effects.burst(r.left + r.width/2, r.top + r.height/2,
          { count: 50, colors: ['#fff200','#ffaa00','#ff2bd6','#fff'], speed: 8, size: 5 });
        Effects.shake(document.getElementById('app'), 12, 400);
        Effects.boom(host, 'SSR!!!', '#fff200');
      } else if (t.name === 'SR') {
        Effects.sfx.fanfare();
        const r = card.getBoundingClientRect();
        Effects.burst(r.left + r.width/2, r.top + r.height/2,
          { count: 24, colors: ['#ff5fdf','#fff'], speed: 5, size: 4 });
      } else if (t.name === 'R') {
        Effects.sfx.coin();
      } else {
        Effects.sfx.tap();
      }
    }

    function loop() {
      showCard();
      timer = setTimeout(loop, interval);
      // 徐々に速度UP（ガチャの "止まらない" 感）
      interval = Math.max(450, interval * 0.92);
    }
    timer = setTimeout(loop, 250);

    // タップで早送り
    function onTap() {
      if (!alive) return;
      clearTimeout(timer);
      interval = Math.max(300, interval * 0.7);
      showCard();
      timer = setTimeout(loop, interval);
    }
    stage.addEventListener('mousedown', onTap);

    const endT = setTimeout(() => {
      if (!alive) return;
      Effects.boom(host, `BEST: ${bestTier}`, bestTier === 'SSR' ? '#fff200' : '#fff');
      Effects.sfx.fanfare();
      setTimeout(() => cb.onDone({ pulled, bestTier }), 700);
    }, DURATION);

    return function cleanup() {
      alive = false;
      clearTimeout(timer);
      clearTimeout(endT);
      stage.removeEventListener('mousedown', onTap);
    };
  }

  return { id, label, init };
})();
