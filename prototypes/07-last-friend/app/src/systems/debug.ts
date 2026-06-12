// F1 デバッグメニュー (§2)。URL に ?debug=1 があるときだけ有効。
// 通常プレイの UI からは絶対に到達できないよう、DOM オーバーレイで実装する
// （ゲーム内 UI と完全に分離しておくため）。
import { WORDS } from "../data/words";
import { G } from "./wordSystem";
import { Save } from "./save";
import { Telemetry } from "./telemetry";

export interface DebugHooks {
  jumpTo?: (ev: "E0" | "E1" | "E2" | "E3" | "E4" | "E5" | "E6" | "E7") => void;
  learnOne?: (id: string) => void;
}

class DebugClass {
  enabled = new URLSearchParams(location.search).get("debug") === "1";
  hooks: DebugHooks = {};
  private panel: HTMLDivElement | null = null;

  init() {
    if (!this.enabled) return;
    window.addEventListener("keydown", (e) => {
      if (e.key === "F1") {
        e.preventDefault();
        this.toggle();
      }
    });
  }

  private toggle() {
    if (this.panel) {
      this.panel.remove();
      this.panel = null;
      return;
    }
    const p = document.createElement("div");
    this.panel = p;
    p.style.cssText =
      "position:fixed;top:8px;right:8px;z-index:9999;background:rgba(20,18,31,.95);" +
      "color:#FFF6F9;font:12px monospace;padding:10px;border:1px solid #B388FF;" +
      "max-height:90vh;overflow:auto;min-width:230px";
    const add = (label: string, fn: () => void) => {
      const b = document.createElement("button");
      b.textContent = label;
      b.style.cssText =
        "display:block;width:100%;margin:2px 0;background:#4A4357;color:#FFF6F9;" +
        "border:none;padding:4px;cursor:pointer;font:12px monospace;text-align:left";
      b.onclick = fn;
      p.appendChild(b);
    };
    const title = document.createElement("div");
    title.textContent = "== DEBUG (F1) ==";
    p.appendChild(title);

    add("全語習得", () => {
      // prereq があるので2周して確実に埋める
      for (let i = 0; i < 2; i++)
        for (const id of Object.keys(WORDS)) G.learnWord(id, "でばっぐ");
      this.log(`learned=${G.learned.size}`);
    });

    const sel = document.createElement("select");
    sel.style.cssText = "width:100%;margin:2px 0;font:12px monospace";
    for (const w of Object.values(WORDS)) {
      const o = document.createElement("option");
      o.value = w.id;
      o.textContent = `${w.id} (${w.text})`;
      sel.appendChild(o);
    }
    p.appendChild(sel);
    add("↑の語を習得", () => {
      if (this.hooks.learnOne) this.hooks.learnOne(sel.value);
      else G.learnWord(sel.value, "でばっぐ");
    });

    for (const ev of ["E0", "E1", "E2", "E3", "E4", "E5", "E6", "E7"] as const) {
      add(`ジャンプ: ${ev}`, () => this.hooks.jumpTo?.(ev));
    }

    add("テレメトリ表示", () => {
      this.log(JSON.stringify(Telemetry.data, null, 1));
    });
    add("セーブ削除（リロード）", () => {
      Save.wipe();
      Telemetry.wipe();
      location.reload();
    });

    const out = document.createElement("pre");
    out.id = "dbg-out";
    out.style.cssText = "white-space:pre-wrap;max-width:300px;font-size:10px";
    p.appendChild(out);
    document.body.appendChild(p);
  }

  private log(s: string) {
    const el = document.getElementById("dbg-out");
    if (el) el.textContent = s;
  }
}

export const Debug = new DebugClass();
