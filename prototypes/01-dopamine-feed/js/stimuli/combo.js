/* ============================================================
   刺激: ⚡ 連打ゲージ（達成系）
   ・4秒間ひたすらクリック連打
   ・ゲージが MAX に達すると爆裂演出
   ・連打しなくても自然減衰しないので、押した分だけ気持ちいい
   ============================================================ */

const Combo = (() => {
  const id = 'combo';
  const label = '⚡ 連打ゲージ';

  function init(host, cb) {
    host.innerHTML = '';
    const stage = document.createElement('div');
    stage.className = 'combo-stage';
    stage.innerHTML = `
      <div class="combo-text">TAP! TAP! TAP!</div>
      <div class="combo-bar"><div class="combo-fill"></div></div>
      <div class="combo-count">0</div>
    `;
    host.appendChild(stage);
    const fill = stage.querySelector('.combo-fill');
    const countEl = stage.querySelector('.combo-count');
    const text = stage.querySelector('.combo-text');

    const DURATION = 4000;
    const MAX = 50;
    let count = 0;
    let maxed = false;
    let alive = true;

    function update() {
      const pct = Math.min(100, (count / MAX) * 100);
      fill.style.width = pct + '%';
      countEl.textContent = count;
      if (!maxed && count >= MAX) {
        maxed = true;
        stage.classList.add('maxed');
        text.textContent = 'MAX!!!';
        Effects.sfx.fanfare();
        Effects.flash('rgba(0,247,255,0.4)', 200);
        Effects.boom(host, 'MAX!', '#00f7ff');
      }
    }

    function onTap(e) {
      if (!alive) return;
      count++;
      cb.onDopamine(maxed ? 0.4 : 0.8);
      update();
      Effects.sfx.tap();
      const rect = stage.getBoundingClientRect();
      if (e) {
        Effects.burst(e.clientX, e.clientY,
          { count: 4, colors: ['#00f7ff','#ff2bd6','#fff200'], speed: 3, size: 2 });
      }
    }
    stage.addEventListener('mousedown', onTap);

    const endT = setTimeout(() => {
      if (!alive) return;
      const result = maxed ? 'PERFECT!' : (count >= MAX*0.5 ? 'NICE!' : 'OK!');
      Effects.boom(host, result, maxed ? '#fff200' : '#fff');
      if (maxed) Effects.sfx.fanfare(); else Effects.sfx.levelup();
      setTimeout(() => cb.onDone({ score: count, maxed }), 600);
    }, DURATION);

    return function cleanup() {
      alive = false;
      clearTimeout(endT);
      stage.removeEventListener('mousedown', onTap);
    };
  }

  return { id, label, init };
})();
