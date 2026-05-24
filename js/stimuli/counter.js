/* ============================================================
   刺激: 🔢 数字爆増（成長系）
   ・クリックで内部値が「×2」される（指数関数的成長の快感）
   ・桁が増えるたびに派手な演出
   ・5秒で自動終了
   ============================================================ */

const Counter = (() => {
  const id = 'counter';
  const label = '🔢 数字爆増';

  function format(n) {
    if (n < 1000) return String(n);
    if (n < 1e6) return (n/1e3).toFixed(1) + 'K';
    if (n < 1e9) return (n/1e6).toFixed(1) + 'M';
    if (n < 1e12) return (n/1e9).toFixed(1) + 'B';
    return (n/1e12).toFixed(1) + 'T';
  }

  function init(host, cb) {
    host.innerHTML = '';
    const stage = document.createElement('div');
    stage.className = 'counter-stage';
    stage.innerHTML = `
      <div class="counter-num">1</div>
      <div class="counter-hint">CLICK TO MULTIPLY</div>
    `;
    host.appendChild(stage);

    const num = stage.querySelector('.counter-num');
    let value = 1;
    let lastDigits = 1;
    let alive = true;

    const DURATION = 5000;
    const startedAt = performance.now();

    function update() {
      num.textContent = format(value);
      num.classList.remove('pump');
      // 強制リフロー → アニメ再適用
      void num.offsetWidth;
      num.classList.add('pump');
    }

    function onTap(e) {
      if (!alive) return;
      const prev = value;
      value = Math.floor(value * 2 + Math.random() * 3);
      const reward = Math.min(3, 1 + Math.log10(value));
      cb.onDopamine(reward);

      // 飛んでいくスコア表示
      const float = document.createElement('div');
      float.className = 'counter-floater';
      float.textContent = '+' + format(value - prev);
      float.style.fontSize = '20px';
      const rect = stage.getBoundingClientRect();
      const hostRect = host.getBoundingClientRect();
      const fx = (e ? e.clientX : rect.left + rect.width/2) - hostRect.left;
      const fy = (e ? e.clientY : rect.top + 100) - hostRect.top;
      float.style.left = fx + 'px';
      float.style.top = fy + 'px';
      host.appendChild(float);
      setTimeout(() => float.remove(), 800);

      update();
      Effects.sfx.tap();

      // 桁が増えたら派手に
      const digits = String(value).length;
      if (digits > lastDigits) {
        lastDigits = digits;
        Effects.sfx.levelup();
        Effects.boom(host, digits + ' DIGITS!', '#fff200');
        Effects.flash('rgba(255,242,0,0.25)', 100);
      }
    }

    stage.addEventListener('mousedown', onTap);

    const endT = setTimeout(() => {
      if (!alive) return;
      Effects.boom(host, format(value), '#fff200');
      Effects.sfx.fanfare();
      setTimeout(() => cb.onDone({ score: value }), 600);
    }, DURATION);

    return function cleanup() {
      alive = false;
      clearTimeout(endT);
      stage.removeEventListener('mousedown', onTap);
    };
  }

  return { id, label, init };
})();
