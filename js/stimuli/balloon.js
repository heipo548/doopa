/* ============================================================
   刺激: 🎈 風船パンッ（破壊系）
   ・下から上に流れてくる風船をクリックで割る
   ・失敗概念なし。割っても割らなくても完走でドーパミン+
   ============================================================ */

const Balloon = (() => {
  const id = 'balloon';
  const label = '🎈 風船パンッ';

  /**
   * @param {HTMLElement} host
   * @param {{ onDone:Function, onDopamine:Function }} cb
   */
  function init(host, cb) {
    host.innerHTML = '';
    host.style.position = 'relative';
    const DURATION_MS = 6000;
    const POP_REWARD = 1;
    const startedAt = performance.now();
    let popped = 0;
    let alive = true;
    const balloons = [];
    let spawnT;

    const EMOJIS = ['🎈','🎈','🎈','🎈','🟣','🔴','🟡','🔵'];

    function spawn() {
      if (!alive) return;
      const el = document.createElement('div');
      el.className = 'balloon';
      el.textContent = EMOJIS[Math.floor(Math.random() * EMOJIS.length)];
      const x = 16 + Math.random() * (host.clientWidth - 80);
      el.style.left = x + 'px';
      el.style.top = host.clientHeight + 'px';
      el.style.fontSize = (44 + Math.random() * 28) + 'px';
      host.appendChild(el);

      // 上昇アニメ
      const dur = 2200 + Math.random() * 1400;
      const sway = (Math.random() - 0.5) * 80;
      el.animate(
        [
          { transform: `translate(0, 0)` },
          { transform: `translate(${sway}px, -${host.clientHeight + 120}px)` },
        ],
        { duration: dur, easing: 'linear', fill: 'forwards' }
      ).onfinish = () => el.remove();

      // クリックで割る
      el.addEventListener('mousedown', (e) => {
        if (el.classList.contains('pop')) return;
        e.stopPropagation();
        const rect = el.getBoundingClientRect();
        el.classList.add('pop');
        Effects.sfx.pop();
        Effects.burst(rect.left + rect.width / 2, rect.top + rect.height / 2,
          { count: 16, colors: ['#ff2bd6','#fff200','#00f7ff'], speed: 4, size: 3 });
        popped++;
        cb.onDopamine(POP_REWARD);
        if (popped > 0 && popped % 5 === 0) {
          Effects.boom(host, `${popped} POP!`, '#ff2bd6');
        }
        setTimeout(() => el.remove(), 350);
      });
      balloons.push(el);
    }

    // 一定間隔で湧かす
    spawnT = setInterval(spawn, 280);

    // 完走で終了
    const endT = setTimeout(() => {
      if (!alive) return;
      cb.onDone({ score: popped });
    }, DURATION_MS);

    return function cleanup() {
      alive = false;
      clearInterval(spawnT);
      clearTimeout(endT);
      // 残っている風船は静かに消す
      balloons.forEach(b => b.remove());
    };
  }

  return { id, label, init };
})();
