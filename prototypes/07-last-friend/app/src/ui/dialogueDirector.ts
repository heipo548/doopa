// 会話の進行役。ノードを順にたどり、
// テキスト表示 → actions 実行 → 選択肢/パレット → 次ノード を回す。
// シーン固有の演出（バトル開始・マップ移動・就寝）は onAction に委譲する。
import type { Action, DialogueNode } from "../types";
import { DialogueBook } from "../systems/dialogue";
import { G } from "../systems/wordSystem";
import { Telemetry } from "../systems/telemetry";
import { MessageWindow } from "./messageWindow";
import { PaletteUI } from "./paletteUI";
import { ChoiceUI } from "./choiceUI";
import { Cutin } from "./cutin";

export type ActionResult = "stop" | void;

export interface DirectorDeps {
  window: MessageWindow;
  palette: PaletteUI;
  choice: ChoiceUI;
  cutin: Cutin;
  /** シーン固有 action の処理。"stop" を返すと会話を打ち切る（シーン遷移など） */
  onAction: (a: Action) => Promise<ActionResult> | ActionResult;
  onEnd?: () => void;
}

export class DialogueDirector {
  active = false;

  constructor(
    private book: DialogueBook,
    private deps: DirectorDeps
  ) {}

  private async runActions(node: DialogueNode): Promise<ActionResult> {
    for (const a of node.actions ?? []) {
      if (a.type === "learnWord") {
        // 既知・前提不足なら何も起きない（演出も出さない）仕様 (§4.1)
        if (G.learnWord(a.id, a.src)) {
          Telemetry.learned(a.id, a.src);
          await this.deps.cutin.play(a.id);
        }
      } else if (a.type === "setFlag") {
        G.setFlag(a.flag);
      } else if (a.type === "kokoro") {
        G.kokoro.kind += a.kind ?? 0;
        G.kokoro.dark += a.dark ?? 0;
      } else if (a.type === "phase") {
        G.setPhase(a.phase);
      } else {
        const r = await this.deps.onAction(a);
        if (r === "stop") return "stop";
      }
    }
  }

  async run(startId: string): Promise<void> {
    if (this.active) return;
    this.active = true;
    try {
      let node = this.book.resolve(startId);
      let guard = 0;
      while (node && guard++ < 200) {
        if (node.text) {
          await this.deps.window.show({ speaker: node.speaker, text: node.text, lie: node.lie });
        }
        const stopped = await this.runActions(node);
        if (stopped === "stop") return;

        const choices = this.book.visibleChoices(node);
        if (choices.length > 0) {
          const picked = await this.deps.choice.ask(choices);
          node = this.book.resolve(picked.next);
          continue;
        }
        if (node.palette) {
          const wordId = await this.deps.palette.ask(node.palette.categories);
          const nextId =
            wordId && node.palette.accept[wordId] ? node.palette.accept[wordId] : node.palette.default;
          node = this.book.resolve(nextId);
          continue;
        }
        node = node.next ? this.book.resolve(node.next) : null;
      }
    } finally {
      this.active = false;
      this.deps.window.hide();
      this.deps.onEnd?.();
    }
  }
}
