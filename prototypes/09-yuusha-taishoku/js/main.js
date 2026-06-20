/* =========================================================================
   main.js — 全体の指揮。起動・描画ループ・入力・チュートリアル・ターン進行。
   1ターン＝1週。城を歩く→施策を1つ→演出→水晶で観察→ベルゼで次の週へ。
   勇者は10週後に到着。可視3状態のどれかが最大になれば即エンディング（A/B/C）。
   10週を越えると最終面談（D：成功／E：討伐続行）。
   ========================================================================= */
const Game = (() => {
  let fieldCtx, sceneCtx, titleCtx;
  let last = 0, t = 0;
  let phase = 'title';
  let resultTap = null;     // 演出シーンをタップで進めるためのコールバック
  let newsLog = [];

  /* ── 起動 ── */
  function boot() {
    UI.init(); // 先に DOM 要素をキャッシュしてから canvas を取得する
    fieldCtx = document.getElementById('field-canvas').getContext('2d');
    sceneCtx = document.getElementById('scene-canvas').getContext('2d');
    titleCtx = document.getElementById('title-canvas').getContext('2d');
    Field.build();
    Field.onInteract = onInteract;
    Field.onNearChange = (thing) => { if (phase === 'field') UI.fieldLabel(thing); };

    // コンティニュー表示
    if (State.hasSave()) UI.E['btn-continue'].classList.remove('hidden');
    UI.E['btn-start'].addEventListener('click', () => { SFX.init(); newGame(); });
    UI.E['btn-continue'].addEventListener('click', () => { SFX.init(); if (State.load()) startLoaded(); else newGame(); });

    bindInput();
    UI.show('title'); document.body.dataset.scene = 'title';
    SFX.bgm('title');
    requestAnimationFrame(loop);
  }

  /* ── 新規ゲーム ── */
  function newGame() {
    State.reset();
    newsLog = ['王国、新たな勇者レオンを任命。「魔王討伐」を布告。'];
    UI.syncStages();
    setDistance();
    Field.setPlayer(DATA.map.start[0], DATA.map.start[1]);
    UI.show('field'); UI.renderHUD();
    SFX.bgm('castle');
    phase = 'field';
    runTutorial();
  }
  function startLoaded() {
    newsLog = ['（前回のつづき）'];
    UI.syncStages(); setDistance();
    Field.setPlayer(DATA.map.start[0], DATA.map.start[1]);
    UI.show('field'); UI.renderHUD();
    SFX.bgm('castle');
    phase = 'field';
    UI.toast(`第${State.turn}週・つづきから`);
  }
  function setDistance() {
    // 表示は実際の進行（10週で到達）と一致させる。1週ごとに1ずつ縮む。
    State.distance = Math.max(1, 11 - State.turn);
  }

  /* ════════════ チュートリアル（導入＋4択） ════════════ */
  function runTutorial() {
    if (State.tutorialDone) { phase = 'field'; return; }
    phase = 'dialogue'; Field.lock(true);
    // 導入は玉座の間の絵を背景に（情景を想像しやすく）
    UI.show('scene'); UI.setSceneDraw((c, tt) => Sprites.scene(c, 'throne_meeting', tt)); UI.sceneCaption('— 魔王城・玉座の間／定例会議 —');
    const intro = [
      { who: 'belze', text: '次の議題です。村の診療所から、回復魔力の供給量を増やしてほしいと要望が来ています。' },
      { who: 'maou',  text: '冬前だからな。通しておけ。' },
      { who: 'belze', text: '続いて、ダンジョン第3層の落とし穴に、安全柵をつける件ですが。' },
      { who: 'maou',  text: 'まだついてなかったのか。' },
      { who: 'narr',  text: 'そこへ、兵士が駆け込んでくる。' },
      { who: 'soldier', text: '魔王様！ 王国が、新たな勇者を任命しました！' },
      { who: 'maou',  text: '……勇者？' },
      { who: 'soldier', text: 'はい。目的は——魔王様の、討伐です。' },
      { who: 'maou',  text: '……なぜ？' },
      { who: 'belze', text: '王国の発表では「魔王軍が人間の村に拠点を増やし、侵略準備を進めているため」と。' },
      { who: 'maou',  text: '診療所だぞ。' },
      { who: 'belze', text: '王国から見れば、前線基地だそうです。' },
      { who: 'maou',  text: '診療所だぞ？' },
    ];
    UI.runDialogue(intro, tutorialChoice);
  }
  function tutorialChoice() {
    UI.runDialogue(
      [{ who: 'narr', text: '勇者、接近。——魔王よ、どうする。' }],
      null,
      {
        choices: [
          { id: 'attack', label: '⚔ 勇者を攻撃する' },
          { id: 'burn',   label: '🔥 村を焼いて足止めする' },
          { id: 'curse',  label: '💀 呪いをかける' },
          { id: 'meeting',label: '📋 会議を開く' },
        ],
        onChoice: (ch) => {
          if (ch.id === 'meeting') { tutorialResolve(); return; }
          SFX.play('bracelet');
          UI.runDialogue([
            { who: 'narr',  text: '——魔王の腕で、和平の腕輪が、強く光った。' },
            { who: 'belze', text: '魔王様、その腕輪を、お忘れですか。' },
            { who: 'belze', text: '人間を傷つければ——魔族の村を守る、結界が消えます。' },
            { who: 'maou',  text: '勇者ひとりのために、民を危険にさらすわけには、いかないか。' },
            { who: 'belze', text: 'はい。ですので今回は、殴らずに解決しましょう。' },
            { who: 'maou',  text: '魔王なのに？' },
            { who: 'belze', text: '魔王なのに、です。' },
          ], tutorialChoice); // もう一度4択へ
        },
      }
    );
  }
  function tutorialResolve() {
    UI.runDialogue([
      { who: 'belze', text: 'では——勇者を倒すのではなく、勇者が「戦う理由」を、なくしましょう。' },
      { who: 'narr',  text: '〘 勇者を倒すのではなく、勇者が戦う理由をなくす。〙' },
      { who: 'belze', text: '勝ち筋は3つ。上の3つのゲージを、どれかひとつ「最大」にできれば、勇者は引き返します。' },
      { who: 'belze', text: '①勇者の迷い … 最大にすれば、勇者は剣を置く（退職）。\n②仲間の不満 … 最大にすれば、パーティーは解散。\n③世間の評判 … 最大にすれば、王国が討伐を中止。' },
      { who: 'belze', text: '広報・人事・福祉・諜報。各部署をまわって、1週に施策を1つ。水晶で勇者のようすを見て、私のところで週を進めてください。' },
      { who: 'belze', text: 'さあ、魔王様。あなたの“運営”を、はじめましょう。勇者の到着まで、あと10週です。' },
    ], () => {
      State.tutorialDone = true; State.save();
      backToField('各部署で施策を1つ。水晶で観察し、玉座のベルゼで次の週へ。');
    });
  }

  /* ════════════ 調べる：相手ごとの分岐 ════════════ */
  function onInteract(thing) {
    if (phase !== 'field') return;
    SFX.play('select');
    Field.lock(true);
    if (thing.id === 'belze') return talkBelze();
    if (thing.kind === 'dept') return talkDept(thing);
    if (thing.kind === 'crystal') return observeCrystal();
    if (thing.kind === 'board') return showBoard();
    unlockField();
  }
  function unlockField() { phase = 'field'; Field.lock(false); }

  /* ベルゼ：状況確認 ＋ 次の週へ */
  function talkBelze() {
    phase = 'dialogue';
    UI.runDialogue(DATA.belzeHint(), () => {
      if (State.policyDone) {
        // 施策済み→次の週へ進めるか聞く（選択後にオーバーレイは UI 側で閉じる）
        UI.runDialogue([{ who: 'belze', text: '今週の手は、打ちました。次の週へ進みますか？' }], null, {
          choices: [
            { id: 'next', label: '▶ 次の週へ進む', hint: '勇者がさらに近づく' },
            { id: 'stay', label: '× まだ城を歩く' },
          ],
          onChoice: (ch) => { if (ch.id === 'next') advanceWeek(); else unlockField(); },
        });
      } else {
        // まだ施策していない→案内して城へ戻す
        UI.runDialogue([{ who: 'belze', text: 'まずは各部署で、今週の施策を1つ。水晶で勇者を見てから、私のところへ。' }], unlockField);
      }
    });
  }

  /* 部署NPC：施策メニュー */
  function talkDept(thing) {
    phase = 'dialogue';
    if (State.policyDone) {
      UI.runDialogue([
        { who: thing.char, text: deptBusyLine(thing) },
      ], unlockField);
      return;
    }
    const greet = deptGreet(thing);
    UI.runDialogue([{ who: thing.char, text: greet }], () => openDeptPolicies(thing));
  }
  function openDeptPolicies(thing) {
    // この部署の施策一覧を作る
    let list = DATA.policies.filter(p => p.dept === thing.dept).map(p => ({
      policy: p, spent: false,
      locked: p.requires && !State.flag(p.requires),
      lockMsg: p.id === 'rebut' ? '王国の誤解報道のあとで解放される' : 'まだ解放されていない',
    }));
    // 諜報室は過去調査の後、追加の情報施策が出る
    if (thing.dept === '諜報室' && State.reconUnlocked) {
      DATA.reconExtra.forEach(p => { if (!State.flag(p.id)) list.push({ policy: p, spent: false, locked: false }); });
    }
    UI.openPolicy(thing.dept, list,
      (policy) => execPolicy(policy),
      () => unlockField()
    );
  }
  function deptGreet(thing) {
    return {
      pazuzu: 'よっ、魔王様！広報のパズズですよ。世間ウケなら任せて——炎上だけは勘弁してくださいね。',
      ririmu: 'あら魔王様。人事のリリムよ。いい人材はね、今の職場の不満を“数字”で見せられた瞬間に、ぐらっとくるの。——勇者ご一行、けっこう揺れてるわよ。',
      ork:    'おお魔王様。福祉のオークだ。こわい顔ですまんな。村の連中の暮らし、よくしてやりたくてな。',
      shadow: '……シャドウだ。知りたいことが、あるなら。言え。',
    }[thing.char] || '……';
  }
  function deptBusyLine(thing) {
    return {
      pazuzu: '今週の発表はもう打ちましたよ！……今のところ炎上ナシ、ヨシ。水晶で反応見て、ベルゼさんへどうぞ！',
      ririmu: '今週の人事は、もう動かしたわ。あとは結果待ち。水晶で見てらっしゃい。',
      ork:    '今週の手配は済んだ。あとは、村の連中次第だ。水晶で見てみるといい。',
      shadow: '……今週は、もう動いた。次の週まで、待て。',
    }[thing.char] || '今週はもう手を打った。';
  }

  /* ════════════ 施策の実行 → 演出 → 観察 ════════════ */
  function execPolicy(policy) {
    // 施策の前後で可視状態の段階を比較し、好転したら「キラッ」を鳴らす（手応えの強化）
    const before = ['mayoi', 'nakama', 'seken'].map(m => State.stage(m));
    State.policyDone = true; State.lastPolicy = policy;
    policy.effect();
    stageUp = ['mayoi', 'nakama', 'seken'].some((m, i) => State.stage(m) > before[i]);
    if (policy.id === 'recon_past') State.reconUnlocked = true;
    if (policy.news) newsLog.unshift(policy.news);
    setDistance();
    // ターン途中はセーブしない（中断後は常に週頭から再開＝「1ターン1施策」を守る）

    // 演出シーン
    phase = 'result';
    UI.show('scene'); UI.setSceneDraw((c, tt) => Sprites.scene(c, policy.result.scene, tt));
    UI.sceneCaption(policy.result.cap + '\n（タップで つづく）');
    SFX.play('effect');
    resultTap = () => {
      resultTap = null;
      // 観察フェーズ：水晶ごしの会話
      observeAfterPolicy(policy);
    };
  }
  let stageUp = false;
  function observeAfterPolicy(policy) {
    phase = 'observe';
    UI.show('scene'); UI.setSceneDraw((c, tt) => Crystal.drawParty(c, tt)); UI.sceneCaption('— 水晶玉、勇者パーティー —');
    UI.runDialogue(policy.talk, () => {
      UI.renderHUD();
      if (stageUp) { SFX.play('good'); UI.toast('手応えあり——状態が動いた'); stageUp = false; }
      State.observedThisTurn = true;
      // 状態が最大ならエンディング
      const end = State.reachedEnding();
      if (end) { goEnding(end); return; }
      // フィールドへ戻る
      backToField('効いているか？　玉座のベルゼで、次の週へ。');
    });
  }
  function backToField(msg) {
    phase = 'field'; UI.show('field'); UI.renderHUD(); Field.lock(false);
    if (msg) UI.fieldMsg(msg);
  }

  /* 水晶を直接調べる（施策の直後でなくても、ようすを見る） */
  function observeCrystal() {
    phase = 'observe';
    UI.show('scene'); UI.setSceneDraw((c, tt) => Crystal.drawParty(c, tt)); UI.sceneCaption('— 水晶玉、勇者パーティー —');
    const lines = (State.lastPolicy && !State.observedThisTurn) ? State.lastPolicy.talk : Crystal.ambientLines();
    UI.runDialogue(lines, () => {
      State.observedThisTurn = true;
      const end = State.reachedEnding();
      if (end) { goEnding(end); return; }
      backToField();
    });
  }

  /* 掲示板：ニュース */
  function showBoard() {
    phase = 'dialogue';
    const lines = newsLog.slice(0, 3).map(n => ({ who: 'narr', text: '📰 ' + n }));
    lines.unshift({ who: 'narr', text: '— ニュース掲示板 —' });
    UI.runDialogue(lines, () => backToField());
  }

  /* ════════════ 次の週へ ════════════ */
  function advanceWeek() {
    // 10週を終えたら最終面談へ
    if (State.turn >= 10) { finale(); return; }
    UI.curtain(`第${State.turn + 1}週`, () => {
      State.turn++;
      State.policyDone = false; State.observedThisTurn = false; State.lastPolicy = null;
      setDistance();
      fireEvent(); // 条件を満たすイベントが1つあれば仕込む（演出は curtain 後）
      State.save();
    }, () => {
      UI.show('field'); UI.renderHUD();
      if (pendingEvent) { playEvent(pendingEvent); pendingEvent = null; }
      else backToField('新しい週。各部署で施策を1つ。');
    });
  }

  let pendingEvent = null;
  function fireEvent() {
    pendingEvent = null;
    for (const ev of DATA.events) {
      if (State.doneEvents[ev.id]) continue;
      if (ev.cond()) { pendingEvent = ev; break; }
    }
  }
  function playEvent(ev) {
    State.doneEvents[ev.id] = true;
    ev.run();
    if (ev.scene) { UI.show('scene'); UI.setSceneDraw((c, tt) => Sprites.scene(c, ev.scene, tt)); UI.sceneCaption('— できごと —'); }
    phase = 'dialogue';
    SFX.play('event');
    UI.runDialogue(ev.lines, () => {
      UI.renderHUD();
      if (ev.toast) UI.toast(ev.toast);
      State.save();
      const end = State.reachedEnding();
      if (end) { goEnding(end); return; }
      backToField('新しい週。各部署で施策を1つ。');
    });
  }

  /* ════════════ 最終面談（D / E） ════════════ */
  function finale() {
    phase = 'dialogue';
    UI.show('scene'); UI.setSceneDraw((c, tt) => Sprites.ending(c, 'end_meeting', tt)); UI.sceneCaption('— 魔王城・会議室 —');
    SFX.bgm('tense');
    UI.runDialogue([
      { who: 'narr',  text: '10週が過ぎた。勇者レオンが、魔王城に到着する。' },
      { who: 'belze', text: '魔王様。勇者です。——剣ではなく、椅子を、用意しました。' },
      { who: 'maou',  text: 'よく来た、勇者レオン。座れ。' },
      { who: 'leon',  text: '……これは、どういうつもりだ。' },
      { who: 'maou',  text: 'お前は——本当に、私を倒したいのか？' },
    ], presentMeetingOptions);
  }
  function presentMeetingOptions() {
    // 条件を満たす説得選択肢 ＋ いつでも選べる「かかってこい」
    const ok = DATA.meetingOptions.filter(o => !o.bad && (o.needFlag ? State.flag(o.needFlag) : State.score(o.needScore[0]) >= o.needScore[1]));
    const choices = ok.map(o => ({ id: o.id, label: o.label, hint: o.hint }));
    if (choices.length === 0) choices.push({ id: 'none', label: '「……とにかく、話を聞いてくれ」', hint: '手札がない' });
    choices.push({ id: 'sword', label: '「とにかく、かかってこい」', hint: '魔王なのに？' });
    UI.runDialogue([{ who: 'maou', text: 'お前に、伝えたいことがある。' }], null, {
      choices,
      onChoice: (ch) => resolveMeeting(ch.id),
    });
  }
  function resolveMeeting(optId) {
    if (optId === 'sword' || optId === 'none' || !State.meetingSucceeds(optId)) {
      // 失敗：討伐続行（E）
      UI.runDialogue([
        { who: 'leon', text: optId === 'sword' ? '問答無用だ。覚悟しろ、魔王！' : '……悪いが、剣を、収めるわけにはいかない。' },
        { who: 'narr', text: '勇者が剣を抜いた。魔王の和平の腕輪が、光る。' },
      ], () => goEnding('E'));
      return;
    }
    // 成功：最終面談成功（D）
    const win = {
      father:  [{ who: 'leon', text: '……父さんは、関係ない。これは、俺が……俺が、決めることだ。' }, { who: 'leon', text: '（剣を握る手が、ゆっくりとほどけていく。）' }],
      kingdom: [{ who: 'leon', text: '王国が……知っていて、嘘を？　……確かめさせてくれ。それまで、剣は、抜かない。' }],
      witness: [{ who: 'leon', text: 'あの村人たちが、嘘をついているとは——思えない。' }],
      party:   [{ who: 'garud', text: '……レオン。俺たちはもう、戦いたくねえんだ。' }, { who: 'leon', text: '……そう、か。' }],
    }[optId] || [{ who: 'leon', text: '……一度、ちゃんと、話を聞かせてくれ。' }];
    UI.runDialogue(win, () => goEnding('D'));
  }

  /* ════════════ エンディング ════════════ */
  function goEnding(key) {
    phase = 'ending'; SFX.stopBgm();
    State.clearSave();
    UI.showEnding(key, () => { UI.show('title'); document.body.dataset.scene = 'title'; phase = 'title'; SFX.bgm('title'); if (State.hasSave()) UI.E['btn-continue'].classList.remove('hidden'); else UI.E['btn-continue'].classList.add('hidden'); });
  }

  /* ════════════ 入力 ════════════ */
  function bindInput() {
    document.addEventListener('keydown', (e) => {
      const k = e.key;
      if (UI.endingShown()) return;
      if (UI.helpOpen()) { if (k === 'Escape') UI.closeHelp(); return; }
      if (UI.policyOpen()) { if (k === 'Escape') UI.closePolicy(); return; }
      if (UI.dialogueActive()) {
        if (k === ' ' || k === 'Enter' || k === 'ArrowDown' || k === 'z' || k === 'Z') { e.preventDefault(); UI.advance(); }
        return;
      }
      if (phase === 'result') { if (k === ' ' || k === 'Enter' || k === 'z' || k === 'Z') { e.preventDefault(); if (resultTap) resultTap(); } return; }
      if (phase === 'field') {
        const map = { ArrowUp: 'up', w: 'up', W: 'up', ArrowDown: 'down', s: 'down', S: 'down', ArrowLeft: 'left', a: 'left', A: 'left', ArrowRight: 'right', d: 'right', D: 'right' };
        if (map[k]) { e.preventDefault(); Field.tryMove(map[k]); }
        else if (k === ' ' || k === 'Enter' || k === 'z' || k === 'Z') { e.preventDefault(); Field.interact(); }
      }
    });

    // 仮想Dパッド
    document.querySelectorAll('.dbtn').forEach(btn => {
      const dir = btn.dataset.dir;
      const fire = (e) => { e.preventDefault(); SFX.init(); handleDir(dir); };
      btn.addEventListener('touchstart', fire, { passive: false });
      btn.addEventListener('mousedown', fire);
    });

    // 演出シーンのタップ送り
    document.getElementById('view-scene').addEventListener('click', () => {
      if (UI.dialogueActive()) return;
      if (phase === 'result' && resultTap) resultTap();
    });

    // フィールドのタップ移動／調べる
    const fc = document.getElementById('field-canvas');
    fc.addEventListener('click', (e) => { if (phase !== 'field' || UI.anyOverlay()) return; SFX.init(); tapField(e, fc); });
  }
  function handleDir(dir) {
    if (UI.endingShown() || UI.helpOpen() || UI.policyOpen()) return;
    if (UI.dialogueActive()) { if (dir === 'act' || dir === 'down') UI.advance(); return; }
    if (phase === 'result') { if (dir === 'act' && resultTap) resultTap(); return; }
    if (phase !== 'field') return;
    if (dir === 'act') Field.interact();
    else Field.tryMove(dir);
  }
  function tapField(e, canvas) {
    const r = canvas.getBoundingClientRect();
    // object-fit: contain のスケールを計算して論理座標へ
    const scale = Math.min(r.width / 320, r.height / 240);
    const offX = (r.width - 320 * scale) / 2, offY = (r.height - 240 * scale) / 2;
    const lx = (e.clientX - r.left - offX) / scale, ly = (e.clientY - r.top - offY) / scale;
    const tx = Math.floor(lx / 16), ty = Math.floor(ly / 16);
    // タップ先まで（NPCならその隣まで）自動で歩いて、着いたら調べる
    Field.navTo(tx, ty);
  }

  /* ── 描画ループ ── */
  let loopErr = false;
  function loop(now) {
    const dt = Math.min(50, now - last); last = now; t = now;
    // 1フレームの描画エラーでループ全体が止まらないよう保護（公開物の保険）
    try {
      const v = UI.getView();
      if (v === 'title') { Sprites.title(titleCtx, t); }
      else if (v === 'field') { Field.update(dt); Field.draw(fieldCtx, t); }
      else if (v === 'scene') { const fn = UI.getSceneDraw(); if (fn) fn(sceneCtx, t); }
      if (UI.endingShown()) UI.drawEnding(t);
    } catch (e) {
      if (!loopErr) { loopErr = true; console.error('[render]', e); }
    }
    requestAnimationFrame(loop);
  }

  return { boot };
})();

window.addEventListener('DOMContentLoaded', Game.boot);
