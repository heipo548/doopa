// EffectRegistry — glyph → 効果（SPEC.md §7-4 / §8-4）
// 新規 effect の追加はこの表への登録のみで完結すること。
// ハンドラが false を返したら「居場所ちがい」（ソフト失敗・字は覚えたまま）。

export interface WorldApi {
  sayKey(key: string, replace?: Record<string, string>, onDone?: () => void): void;
  toast(text: string): void;
  gainGem(): void;
  setFlag(flag: string): void;
  hasFlag(flag: string): boolean;
  playSe(name: string): void;
  // 個別効果（§8-4 の glyph → 効果ハンドラ表）
  lightHearth(): void; // 火: 点火・暖光(半径120)・p0_done・コトノ婆会話トリガ
  applyLightOrb(): void; // 明: 追従光球(半径220)・暗の間マスク無効化
  buildBridge(): void; // 木: 流木→橋板化・p2_bridge
  buildBench(benchId: string): void; // 休: 台座にベンチ生成
  transformShadowToDog(): void; // 犬: Dog生成・追従AI・掘り跡解禁
  calmStorm(): void; // 凪: 嵐パーティクル消滅・通行可・p4_done
  birdRise(): void; // 鳥: ばさばさSE・玉+1・井戸位置マーカー
  statueGem(): void; // 玉: gems+1
  fillWell(): void; // 水: 井戸満水・玉+1・村人B彩色
  showBook(): void; // 本: 図鑑風テキスト「むらの言い」
  bossFireNamed(): void; // 火(ボス): P1正解
  bossLanternResolve(): void; // 灯: ボス解決シーケンス（§10 Phase3）
}

type Handler = (targetId: string, w: WorldApi) => boolean;

export class EffectRegistry {
  private handlers: Record<string, Handler> = {
    火: (t, w) => {
      if (t === 'kamado') {
        w.lightHearth();
        return true;
      }
      if (t === 'boss_fire') {
        w.bossFireNamed();
        return true;
      }
      return false;
    },
    明: (_t, w) => {
      // 明はプレイヤー自身に宿る光。どこで結んでも有効（§8-4）
      w.applyLightOrb();
      return true;
    },
    木: (t, w) => {
      if (t !== 'driftwood') return false;
      w.buildBridge();
      return true;
    },
    休: (t, w) => {
      if (t !== 'bench1' && t !== 'bench2') return false;
      w.buildBench(t);
      return true;
    },
    犬: (t, w) => {
      if (t === 'bigshadow') {
        w.transformShadowToDog();
        return true;
      }
      if (t === 'kamado') {
        // 命名ギャグ（§15 M4）: 竈に犬→吠えて戻る
        w.playSe('bark');
        w.sayKey('naming_gag_dog');
        return true;
      }
      return false;
    },
    凪: (t, w) => {
      if (t !== 'stormwall') return false;
      w.calmStorm();
      return true;
    },
    灯: (t, w) => {
      if (t !== 'boss_fire') return false;
      w.bossLanternResolve();
      return true;
    },
    鳥: (t, w) => {
      if (t !== 'crow') return false;
      w.birdRise();
      return true;
    },
    玉: (t, w) => {
      if (t !== 'king_statue') return false;
      w.statueGem();
      return true;
    },
    水: (t, w) => {
      if (t !== 'well') return false;
      w.fillWell();
      return true;
    },
    本: (t, w) => {
      if (t !== 'old_tree') return false;
      w.showBook();
      return true;
    },
  };

  register(glyph: string, handler: Handler): void {
    this.handlers[glyph] = handler;
  }

  /** @returns true = 効果発火（またはギャグ処理済み） / false = 居場所ちがい */
  apply(glyph: string, targetId: string, world: WorldApi): boolean {
    const h = this.handlers[glyph];
    if (!h) return false;
    return h(targetId, world);
  }

  has(glyph: string): boolean {
    return glyph in this.handlers;
  }
}
