/* =========================================================================
   state.js — ゲーム状態の一元管理。data.js の施策/イベントから呼ばれる。
   可視メーター（mayoi/nakama/seken, 0-100）は3つだけ表に出す。
   hidden（数値の風味パラメータ）と flags（ブール）は会話・演出・分岐に使う。
   ========================================================================= */
const State = {
  turn: 1,
  distance: 10,
  meters: { mayoi: 8, nakama: 10, seken: 22 }, // 初期：討伐一直線 / 団結 / 警戒
  hidden: {},   // { village_support: n, church_backlash: n, ... }
  flags: {},    // { recon_father: true, ... }
  doneEvents: {},
  policyDone: false,   // このターン、施策を実行済みか（1ターン1施策）
  observedThisTurn: false, // 水晶で観察したか
  lastPolicy: null,    // 直近に実行した施策（観察の核になる）
  reconUnlocked: false,// 過去調査後、諜報の追加施策が出る
  tutorialDone: false,

  /* 最初から／コンティニュー後の初期化 */
  reset() {
    this.turn = 1;
    this.distance = 10;
    this.meters = { mayoi: 8, nakama: 10, seken: 22 };
    this.hidden = {};
    this.flags = {};
    this.doneEvents = {};
    this.policyDone = false;
    this.observedThisTurn = false;
    this.lastPolicy = null;
    this.reconUnlocked = false;
    this.tutorialDone = false;
    this.donePolicies = {}; // 実施済み施策（同じ手は二度打てない）
    this.lastAction = null; // 直前ターンに選んだ施策ID
    this.lastResult = null; // 直前ターンの結果（success/mixed/fail/setup）
  },

  /* 実施済み施策（1回限り） */
  markPolicyDone(id) { this.donePolicies[id] = true; },
  isPolicyDone(id) { return !!this.donePolicies[id]; },

  /* 勇者の現在地（週で進行）。村→街道→教会→ダンジョン→城前 */
  location() { return DATA.locationOrder[Math.min(4, Math.floor((this.turn - 1) / 2))]; },
  /* 王国の警戒（0-4。hidden.kingdomAlert をクランプ） */
  alert() { return Math.max(0, Math.min(4, this.get('kingdomAlert'))); },
  /* 何かしら積み上げがあるか（最終面談 bracelet が D に届くかの判定に使う） */
  engaged() {
    if (this.stage('mayoi') >= 2 || this.stage('nakama') >= 2 || this.stage('seken') >= 3) return true;
    return ['heroSawApology', 'clinicBuilt', 'recon_father', 'recon_kingdom', 'rebuttalSucceeded',
      'priestDoubtsChurch', 'warriorKeptFlyer', 'mageReceivedResearch'].some(f => this.flag(f));
  },

  /* 可視メーターを動かす（0-100でクランプ） */
  add(meter, delta) {
    if (!(meter in this.meters)) return;
    this.meters[meter] = Math.max(0, Math.min(100, this.meters[meter] + delta));
  },
  score(meter) { return this.meters[meter]; },
  stage(meter) { return DATA.stageOf(this.meters[meter]); }, // 0..4

  /* hidden の数値パラメータ */
  get(key) { return this.hidden[key] || 0; },
  bump(key, delta) { this.hidden[key] = (this.hidden[key] || 0) + delta; },

  /* flags */
  setFlag(name, val) { this.flags[name] = val; },
  flag(name) { return !!this.flags[name]; },

  /* いずれかのメーターが最大（段階5）になったら、その軸のエンディングを返す */
  reachedEnding() {
    if (this.stage('mayoi') >= 4)  return 'A';
    if (this.stage('nakama') >= 4) return 'B';
    if (this.stage('seken') >= 4)  return 'C';
    return null;
  },

  /* 最終面談（D/E）の判定：選んだ選択肢が“刺さる”条件を満たすか */
  meetingSucceeds(optId) {
    const opt = DATA.meetingOptions.find(o => o.id === optId);
    if (!opt || opt.bad) return false;
    if (opt.needFlag) return this.flag(opt.needFlag);
    if (opt.needScore) return this.score(opt.needScore[0]) >= opt.needScore[1];
    return false;
  },

  /* ── セーブ／ロード（localStorage） ── */
  KEY: 'doopa09_save_v1',
  save() {
    try {
      const data = {
        turn: this.turn, distance: this.distance, meters: this.meters,
        hidden: this.hidden, flags: this.flags, doneEvents: this.doneEvents,
        reconUnlocked: this.reconUnlocked, tutorialDone: this.tutorialDone,
        donePolicies: this.donePolicies, lastAction: this.lastAction, lastResult: this.lastResult,
      };
      localStorage.setItem(this.KEY, JSON.stringify(data));
    } catch (e) { /* プライベートモード等は黙って無視 */ }
  },
  hasSave() {
    try { return !!localStorage.getItem(this.KEY); } catch (e) { return false; }
  },
  load() {
    try {
      const d = JSON.parse(localStorage.getItem(this.KEY));
      if (!d) return false;
      this.reset();
      Object.assign(this, {
        turn: d.turn, distance: d.distance, meters: d.meters,
        hidden: d.hidden || {}, flags: d.flags || {}, doneEvents: d.doneEvents || {},
        reconUnlocked: !!d.reconUnlocked, tutorialDone: !!d.tutorialDone,
        donePolicies: d.donePolicies || {}, lastAction: d.lastAction || null, lastResult: d.lastResult || null,
      });
      // ターン途中の保存はしない方針なので、施策フラグはリセット
      this.policyDone = false; this.observedThisTurn = false; this.lastPolicy = null;
      return true;
    } catch (e) { return false; }
  },
  clearSave() { try { localStorage.removeItem(this.KEY); } catch (e) {} },
};
