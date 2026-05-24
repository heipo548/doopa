/* ============================================================
   刺激: 💰 コイン雨（収集系）
   ・上から降ってくるコインをマウスカーソル付近で自動キャッチ
   ・落とすことはあるが「失敗」表示はない、集めた数だけが残る
   ・7秒で自動終了
   ============================================================ */

const Coin = (() => {
  const id = 'coin';
  const label = '💰 コイン雨';

  function init(host, cb) {
    host.innerHTML = '';
    host.style.position = 'relative';
    const DURATION = 7000;
    const CATCH_RADIUS = 64;

    // スコア表示
    const score = document.createElement('div');
    score.className = 'coin-score';
    score.textContent = '0';
    host.appendChild(score);

    // カーソル位置の輪っか
    const cursor = document.createElement('div');
    cursor.className = 'coin-cursor';
    cursor.style.left = (host.clientWidth/2) + 'px';
    cursor.style.top = (host.clientHeight/2) + 'px';
    host.appendChild(cursor);

    let mx = host.clientWidth / 2;
    let my = host.clientHeight / 2;
    let collected = 0;
    let alive = true;
    const coins = [];

    function onMove(e) {
      const r = host.getBoundingClientRect();
      mx = e.clientX - r.left;
      my = e.clientY - r.top;
      cursor.style.left = mx + 'px';
      cursor.style.top = my + 'px';
    }
    host.addEventListener('mousemove', onMove);

    // コイン定期生成
    const spawnT = setInterval(() => {
      if (!alive) return;
      const el = document.createElement('div');
      el.className = 'coin';
      const isSpecial = Math.random() < 0.08;
      el.textContent = isSpecial ? '💎' : '🪙';
      const x = 16 + Math.random() * (host.clientWidth - 48);
      let y = -40;
      el.style.left = x + 'px';
      el.style.top = y + 'px';
      host.appendChild(el);
      const c = { el, x, y, vy: 2 + Math.random() * 2, value: isSpecial ? 5 : 1, caught: false };
      coins.push(c);
    }, 180);

    // 落下＆当たり判定ループ
    let raf;
    function tick() {
      if (!alive) return;
      for (let i = coins.length - 1; i >= 0; i--) {
        const c = coins[i];
        if (c.caught) continue;
        c.y += c.vy;
        c.el.style.top = c.y + 'px';
        const cx = c.x + 16, cy = c.y + 16;
        const dx = cx - mx, dy = cy - my;
        if (dx*dx + dy*dy < CATCH_RADIUS * CATCH_RADIUS) {
          c.caught = true;
          c.el.classList.add('caught');
          collected += c.value;
          score.textContent = collected;
          Effects.sfx.coin();
          cb.onDopamine(c.value * 0.6);
          const r = c.el.getBoundingClientRect();
          Effects.burst(r.left + r.width/2, r.top + r.height/2,
            { count: 8, colors: c.value > 1 ? ['#00f7ff','#fff'] : ['#fff200','#ffd700'], speed: 3, size: 3 });
          setTimeout(() => c.el.remove(), 380);
        } else if (c.y > host.clientHeight + 40) {
          c.el.remove();
          coins.splice(i, 1);
        }
      }
      raf = requestAnimationFrame(tick);
    }
    raf = requestAnimationFrame(tick);

    const endT = setTimeout(() => {
      if (!alive) return;
      Effects.boom(host, collected + ' GET!', 'gold');
      Effects.sfx.fanfare();
      setTimeout(() => cb.onDone({ score: collected }), 600);
    }, DURATION);

    return function cleanup() {
      alive = false;
      clearTimeout(endT);
      clearInterval(spawnT);
      cancelAnimationFrame(raf);
      host.removeEventListener('mousemove', onMove);
      coins.forEach(c => c.el.remove());
    };
  }

  return { id, label, init };
})();
