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
  let montageSkip = null;   // 部署モンタージュをタップで飛ばすためのコールバック
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
    newsLog = [{ label: '王国発表', head: '新たな勇者レオンを任命', body: '王国は「魔王軍が侵略準備を進めている」として、討伐を布告した。' }];
    UI.syncStages();
    setDistance();
    Field.setPlayer(DATA.map.start[0], DATA.map.start[1]);
    UI.show('field'); UI.renderHUD();
    SFX.bgm('castle');
    phase = 'field';
    runTutorial();
  }
  function startLoaded() {
    newsLog = [{ label: '魔王軍内部', head: '（前回のつづき）', body: '定例会議は、まだ続いている。' }];
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
          // 攻撃を選ぶと「和平の腕輪」がアップになる（なぜ殴れないかを画で見せる）
          showThroneless('bracelet', '— 和平の腕輪 —');
          SFX.play('bracelet');
          UI.runDialogue([
            { who: 'narr',  text: '——魔王の腕で、和平の腕輪が、燃えるように光った。' },
            { who: 'belze', text: '魔王様、その腕輪を、お忘れですか。' },
            { who: 'belze', text: '人間を傷つけたその時、魔族の村を守る結界が……消えます。' },
            { who: 'maou',  text: '……勇者ひとりのために、民を危険にさらすわけには、いかないか。' },
            { who: 'belze', text: 'はい。ですので今回は、殴らずに解決しましょう。' },
            { who: 'maou',  text: '魔王なのに？' },
            { who: 'belze', text: '魔王なのに、です。' },
          ], () => { backToThrone(); tutorialChoice(); }); // 玉座に戻してもう一度4択へ
        },
      }
    );
  }
  // 玉座の間の絵に戻す／別の絵に切替（チュートリアルの場面転換用）
  function backToThrone() { UI.show('scene'); UI.setSceneDraw((c, tt) => Sprites.scene(c, 'throne_meeting', tt)); UI.sceneCaption('— 魔王城・玉座の間 —'); }
  function showThroneless(scene, cap) { UI.show('scene'); UI.setSceneDraw((c, tt) => Sprites.scene(c, scene, tt)); UI.sceneCaption(cap || ''); }

  function tutorialResolve() {
    backToThrone();
    UI.runDialogue([
      { who: 'belze', text: 'では——勇者を倒すのではなく、勇者が「戦う理由」を、なくしましょう。' },
      { who: 'narr',  text: '〘 勇者を倒すのではなく、勇者が戦う理由をなくす。〙' },
      { who: 'belze', text: '攻め筋は、三つ。' },
      { who: 'belze', text: 'ひとつ、勇者本人の心を、揺らす。\nひとつ、仲間の心を、離れさせる。\nひとつ、世間の風向きを、変える。' },
      { who: 'belze', text: 'どれを深く攻めるかは、魔王様しだい。——手は、各部署が持っています。' },
    ], () => runDeptMontage(() => {
      backToThrone();
      UI.runDialogue([
        { who: 'belze', text: '1週に、施策はひとつだけ。同じ手は二度は打てません。水晶で勇者のようすを見て、私のところで週を進めてください。' },
        { who: 'maou',  text: '……わかった。会議を、始めよう。' },
        { who: 'belze', text: 'はい。勇者の到着まで——あと10週です。' },
      ], () => {
        State.tutorialDone = true; State.save();
        backToField('各部署で施策を1つ。水晶で観察し、玉座のベルゼで次の週へ。');
      });
    }));
  }

  // 各部署をパンパンとフォーカス表示するモンタージュ（タップで飛ばせる）
  function runDeptMontage(onDone) {
    phase = 'cutscene'; UI.show('scene');
    const beats = [
      { scene: 'focus_pr',      cap: '広報室 ── パズズ。\n世間の、風向きを変える。' },
      { scene: 'focus_hr',      cap: '人事室 ── リリム。\n仲間を、引き抜く。' },
      { scene: 'focus_welfare', cap: '福祉室 ── オーク看護長。\n村と、勇者の心に効く。' },
      { scene: 'focus_recon',   cap: '諜報室 ── シャドウ。\n次の一手を、仕込む。' },
    ];
    let i = 0, done = false, tmr = null;
    function finish() { if (done) return; done = true; clearTimeout(tmr); montageSkip = null; onDone(); }
    function step() {
      if (i >= beats.length) { finish(); return; }
      const b = beats[i++];
      UI.setSceneDraw((c, tt) => Sprites.scene(c, b.scene, tt));
      UI.sceneCaption(b.cap + '\n（タップでスキップ）');
      SFX.play('cursor');
      tmr = setTimeout(step, 900);
    }
    montageSkip = finish;
    step();
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
      // 施策の有無に関わらず週は進められる（詰み防止）。ただし未実施なら一言うながす。
      const prompt = State.policyDone
        ? '今週の手は、打ちました。次の週へ進みますか？'
        : 'まだ今週の手を打っていません。各部署で施策を1つ、おすすめします。——それでも、進めますか？';
      UI.runDialogue([{ who: 'belze', text: prompt }], null, {
        choices: [
          { id: 'next', label: '▶ 次の週へ進む', hint: '勇者がさらに近づく' },
          { id: 'stay', label: '× まだ城を歩く' },
        ],
        onChoice: (ch) => { if (ch.id === 'next') advanceWeek(); else unlockField(); },
      });
    });
  }

  /* 部署NPC：あいさつ（前週への反応つき）→ 施策メニュー */
  function talkDept(thing) {
    phase = 'dialogue';
    if (State.policyDone) {
      UI.runDialogue([{ who: thing.char, text: deptBusyLine(thing) }], unlockField);
      return;
    }
    const lines = [{ who: thing.char, text: deptGreet(thing) }];
    const react = deptReaction(thing);   // §6：前週の施策・現在地への反応
    if (react) lines.push({ who: thing.char, text: react });
    UI.runDialogue(lines, () => openDeptPolicies(thing));
  }
  function openDeptPolicies(thing) {
    // 実施済み施策は「実施済み」で選べない（同じ手は二度打てない）。
    let list = DATA.policies.filter(p => p.dept === thing.dept).map(p => ({
      policy: p, spent: State.isPolicyDone(p.id),
      locked: p.requires && !State.flag(p.requires),
      lockMsg: p.id === 'rebut' ? '王国の誤解報道のあとで解放される' : 'まだ解放されていない',
    }));
    if (thing.dept === '諜報室' && State.reconUnlocked) {
      DATA.reconExtra.forEach(p => { if (!State.flag(p.id)) list.push({ policy: p, spent: State.isPolicyDone(p.id), locked: false }); });
    }
    UI.openPolicy(thing.dept, list,
      (policy) => confirmPolicy(policy, thing),  // §14：実行前に確認
      () => unlockField()
    );
  }
  // §14：担当NPCの最後の一言 → 実行/やめる
  function confirmPolicy(policy, thing) {
    phase = 'dialogue';
    const confirm = (policy.confirm && policy.confirm.length) ? policy.confirm.slice()
      : [{ who: thing.char, text: '……いきますか。' }];
    UI.runDialogue(confirm, null, {
      choices: [
        { id: 'go', label: '▶ 実行する', hint: policy.title },
        { id: 'cancel', label: '× やめる（他の手を見る）' },
      ],
      onChoice: (ch) => { if (ch.id === 'go') execPolicy(policy); else openDeptPolicies(thing); },
    });
  }
  function deptGreet(thing) {
    return {
      pazuzu: 'よっ、魔王様！広報のパズズです。広報はタイミング。正しいことも、出す順番を間違えると燃えます。',
      ririmu: 'あら魔王様。人事のリリムよ。人は理念だけでは旅できないの。家賃、食費、将来不安——そこが入口。',
      ork:    'おお魔王様。福祉のオークだ。治療を求める相手に、人間も魔族もありません。ただ、旗を立てすぎると基地に見える。',
      shadow: '……シャドウだ。情報は遅い。だが、最後に刺さる。',
    }[thing.char] || '……';
  }
  // §6：前週の施策結果・現在地・フラグに応じた担当NPCの反応（無ければ null）
  function deptReaction(thing) {
    const la = State.lastAction, lr = State.lastResult, loc = State.location();
    if (thing.char === 'pazuzu') {
      if (la === 'apology' && lr === 'success') return '会見、効いています。勇者レオンが最後まで見ていたようで。「謝れる魔王」、向こうから出た見出しです。';
      if (la === 'apology' && lr === 'fail') return '見出しが最悪です。“魔王、責任転嫁”。……泣いていいですか。';
      if (State.flag('kingdomMisreported') && !State.flag('rebuttalSucceeded')) return '王国が“診療所は前線基地”と言い始めました。診療記録と村人証言があれば、反論できます。';
    }
    if (thing.char === 'ririmu') {
      if (la === 'warrior_ad' && lr === 'success') return '戦士様、求人を捨てていません。ポケットに入れました。あれはもう、半分応募よ。';
      if (la === 'warrior_ad' && lr === 'fail') return '少し早かったわね。団結している相手に求人を投げると、ただの敵対行為。';
      if (State.flag('warriorComplainedAboutPay')) return '戦士様、報酬の話をしていましたね。今、求人を出せば——ただの広告ではなく“答え”になるわ。';
      if (loc === 'forestRoad') return '旅が長引くと、本音が出ます。今なら、戦士様に待遇の話が刺さるかも。';
    }
    if (thing.char === 'ork') {
      if (la === 'clinic' && lr === 'success') return '昨夜、人間の母親が子どもを連れてきました。礼は、小さな会釈だけ。それで十分です。';
      if (la === 'clinic' && lr === 'fail') return '診療所を前線基地と呼ばれました。包帯と薬草しか、置いていないのですが。';
      if (la === 'orphan' && lr === 'success') return '僧侶様は、魔族の子どもたちと目を合わせていました。もう、以前と同じ目では見られないはず。';
      if (loc === 'startVillage') return '村人に直接届く施策なら、今が一番伝わりやすいはずです。';
      if (loc === 'churchCity') return '僧侶様には届くかもしれません。ですが、教会からは強く反発されるでしょう。';
    }
    if (thing.char === 'shadow') {
      if (State.flag('recon_father')) return '勇者は、あなたを見ていない。父親の背中を、見ている。';
      if (State.flag('recon_kingdom')) return '王国は、嘘をつく時だけ書類が丁寧だ。';
      if (State.turn >= 9) return '集めた情報は、剣より遅い。だが、剣が届く前に、心へ届くこともある。';
    }
    return null;
  }
  function deptBusyLine(thing) {
    return {
      pazuzu: '今週の発表はもう打ちましたよ！……今のところ炎上ナシ、ヨシ。水晶で反応見て、ベルゼさんへどうぞ！',
      ririmu: '今週の人事は、もう動かしたわ。あとは結果待ち。水晶で見てらっしゃい。',
      ork:    '今週の手配は済んだ。あとは、村の連中次第だ。水晶で見てみるといい。',
      shadow: '……今週は、もう動いた。次の週まで、待て。',
    }[thing.char] || '今週はもう手を打った。';
  }

  /* ════════════ 施策の実行 → 演出 → 観察（Ver.3.0：結果分岐） ════════════ */
  let stageUp = false;
  let lastOutcome = null; // 直近に実行した施策の結果（観察の核）
  function locDescLine() { return { who: 'narr', text: `水晶に、${DATA.locations[State.location()].name}の勇者一行が映る。` }; }

  function execPolicy(policy) {
    const before = ['mayoi', 'nakama', 'seken'].map(m => State.stage(m));
    State.policyDone = true; State.lastPolicy = policy;
    State.markPolicyDone(policy.id);
    // 結果判定（success / fail / mixed / setup）。evaluate が無い施策は最初の outcome を使う
    const firstKey = policy.outcomes.success ? 'success' : Object.keys(policy.outcomes)[0];
    const resKey = (policy.evaluate ? policy.evaluate() : firstKey);
    const outcome = policy.outcomes[resKey] || policy.outcomes[firstKey];
    outcome.apply();
    State.lastAction = policy.id;
    State.lastResult = policy.outcomes[resKey] ? resKey : firstKey;
    lastOutcome = outcome;
    stageUp = ['mayoi', 'nakama', 'seken'].some((m, i) => State.stage(m) > before[i]);
    if (policy.id === 'recon_past') State.reconUnlocked = true;
    if (outcome.news) newsLog.unshift(outcome.news);
    setDistance();
    // 演出シーン
    phase = 'result';
    UI.show('scene'); UI.setSceneDraw((c, tt) => Sprites.scene(c, outcome.scene, tt));
    UI.sceneCaption(outcome.cap + '\n（タップで つづく）');
    SFX.play(State.lastResult === 'fail' ? 'cancel' : 'effect');
    resultTap = () => { resultTap = null; observeAfterPolicy(outcome); };
  }
  // §7：現在地描写 → 勇者会話 → 状態変化通知 → 次の一手ヒント
  function observeAfterPolicy(outcome) {
    phase = 'observe';
    UI.show('scene'); UI.setSceneDraw((c, tt) => Crystal.drawParty(c, tt)); UI.sceneCaption('— 水晶玉、勇者パーティー —');
    let lines = [locDescLine()].concat(outcome.talk);
    if (outcome.notify) lines.push({ who: 'narr', text: '【 ' + outcome.notify + ' 】' });
    lines = lines.concat(DATA.crystalHint());
    UI.runDialogue(lines, () => {
      UI.renderHUD();
      if (stageUp) { SFX.play('good'); stageUp = false; }
      if (outcome.notify) UI.toast(outcome.notify);
      State.observedThisTurn = true;
      const end = State.reachedEnding();
      if (end) { goEnding(end); return; }
      backToField('効いているか？　次の一手を考え、玉座のベルゼで週を進めよう。');
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
    let lines = [locDescLine()];
    if (lastOutcome && !State.observedThisTurn) {
      lines = lines.concat(lastOutcome.talk);
      if (lastOutcome.notify) lines.push({ who: 'narr', text: '【 ' + lastOutcome.notify + ' 】' });
    } else {
      lines = lines.concat(Crystal.ambientLines());
    }
    lines = lines.concat(DATA.crystalHint());
    UI.runDialogue(lines, () => {
      State.observedThisTurn = true;
      const end = State.reachedEnding();
      if (end) { goEnding(end); return; }
      backToField();
    });
  }

  /* 掲示板：ニュースをカードで読む（§10：攻略情報化） */
  function showBoard() {
    phase = 'dialogue';
    UI.showNews(newsLog.slice(0, 5), () => backToField());
  }

  /* ════════════ 次の週へ ════════════ */
  function advanceWeek() {
    // 10週を終えたら最終面談へ
    if (State.turn >= 10) { finale(); return; }
    UI.curtain(`第${State.turn + 1}週`, () => {
      State.turn++;
      State.policyDone = false; State.observedThisTurn = false; State.lastPolicy = null; lastOutcome = null;
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
    // need() を満たした選択肢だけ解放（§19）。bracelet は常時、sword も常時。
    const opts = DATA.meetingOptions.filter(o => o.bad || (o.need && o.need()));
    const choices = opts.map(o => ({ id: o.id, label: o.label, hint: o.hint }));
    UI.runDialogue([{ who: 'maou', text: '剣を抜く前に。お前に、伝えたいことがある。' }], null, {
      choices,
      onChoice: (ch) => resolveMeeting(ch.id),
    });
  }
  function resolveMeeting(optId) {
    const opt = DATA.meetingOptions.find(o => o.id === optId);
    if (!opt || opt.bad) {
      UI.runDialogue([
        { who: 'leon', text: '問答無用だ。覚悟しろ、魔王！' },
        { who: 'narr', text: '勇者が剣を抜いた。魔王の和平の腕輪が、光る。' },
      ], () => goEnding('E'));
      return;
    }
    const ending = opt.resolve ? opt.resolve() : opt.ending;
    if (ending === 'E') {
      // §19-4：手札がなく、腕輪の話だけでは止められない
      UI.runDialogue((opt.win || []).concat([
        { who: 'leon', text: '……それでも、俺は進む。進まないと、俺には、何も残らない。' },
        { who: 'narr', text: '勇者が何に縛られているのか、魔王は知らなかった。——勇者は、剣を抜いた。' },
      ]), () => goEnding('E'));
      return;
    }
    UI.runDialogue(opt.win || [{ who: 'leon', text: '……一度、ちゃんと、話を聞かせてくれ。' }], () => goEnding(ending));
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
      if (UI.newsOpen()) { if (k === 'Escape' || k === ' ' || k === 'Enter') UI.closeNews(); return; }
      if (UI.policyOpen()) { if (k === 'Escape') UI.closePolicy(); return; }
      if (UI.dialogueActive()) {
        if (k === ' ' || k === 'Enter' || k === 'ArrowDown' || k === 'z' || k === 'Z') { e.preventDefault(); UI.advance(); }
        return;
      }
      if (phase === 'result') { if (k === ' ' || k === 'Enter' || k === 'z' || k === 'Z') { e.preventDefault(); if (resultTap) resultTap(); } return; }
      if (phase === 'cutscene') { if (k === ' ' || k === 'Enter' || k === 'z' || k === 'Z') { e.preventDefault(); if (montageSkip) montageSkip(); } return; }
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
      else if (phase === 'cutscene' && montageSkip) montageSkip();
    });

    // フィールドのタップ移動／調べる
    const fc = document.getElementById('field-canvas');
    fc.addEventListener('click', (e) => { if (phase !== 'field' || UI.anyOverlay()) return; SFX.init(); tapField(e, fc); });
  }
  function handleDir(dir) {
    if (UI.endingShown() || UI.helpOpen() || UI.policyOpen()) return;
    if (UI.dialogueActive()) { if (dir === 'act' || dir === 'down') UI.advance(); return; }
    if (phase === 'result') { if (dir === 'act' && resultTap) resultTap(); return; }
    if (phase === 'cutscene') { if (dir === 'act' && montageSkip) montageSkip(); return; }
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
