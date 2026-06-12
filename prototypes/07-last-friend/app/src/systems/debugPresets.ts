// F1 デバッグメニューのイベントジャンプ用プリセット (§2)。
// G（状態）を直接組み替えるだけの純関数にしてあるので、
// バトル中など どのシーンからでも安全に呼べる。
import { G } from "./wordSystem";

export interface PresetResult {
  startSleep?: boolean; // E6 は就寝シーケンスから始める
}

const learn = (ids: string[]) => {
  for (const id of ids) G.learnWord(id, "でばっぐ");
};
const flags = (fs: string[]) => {
  for (const f of fs) G.setFlag(f);
};

const BASE = ["hana", "sora", "kaze"];
const E2W = ["konnichiwa"];
const E3W = [
  "mura", "pan", "oishii", "suki", "daijoubu", "hatake", "tsuchi", "mizu", "ki", "ie",
  "mukashi", "omoide", "arigatou",
];
const E4W = ["gomenne", "nakanaori", "issho", "donguri"];
const E5W = ["samishii", "kanashii", "tomodachi"];
const E6W = ["uta", "hoshi", "yoru", "tanoshii"];

const E3_FLAGS = [
  "e0_op_done", "e0_view_seen", "e0_done", "e1_seen", "e1_done", "q1_started",
  "greeted_kaeru", "greeted_mogura", "greeted_kotori", "greeted_obaa", "q1_done",
  "kaeru_gave_pan", "has_pan", "q2_done", "obaa_t1_done", "obaa_t2_done", "obaa_t3_done",
  "mogura_t1_done", "kotori_t1_done",
];

export function applyDebugPreset(ev: string): PresetResult {
  G.reset();
  G.setFlag("game_started");
  switch (ev) {
    case "E0":
      G.flags.delete("game_started");
      break;
    case "E1":
      learn(BASE);
      flags(["e0_op_done", "e0_view_seen", "e0_done"]);
      G.map = "hill";
      G.x = 9;
      G.y = 11;
      break;
    case "E2":
      learn([...BASE, ...E2W]);
      flags(["e0_op_done", "e0_view_seen", "e0_done", "e1_seen", "e1_done", "q1_started"]);
      G.map = "village";
      G.x = 19;
      G.y = 2;
      break;
    case "E3":
      learn([...BASE, ...E2W, ...E3W]);
      flags(E3_FLAGS);
      G.map = "village";
      G.x = 19;
      G.y = 19;
      break;
    case "E4":
      learn([...BASE, ...E2W, ...E3W, ...E4W]);
      flags([...E3_FLAGS, "e3_seen", "e3_done"]);
      G.map = "village";
      G.x = 9;
      G.y = 7;
      break;
    case "E5":
      learn([...BASE, ...E2W, ...E3W, ...E4W, ...E5W]);
      flags([...E3_FLAGS, "e3_seen", "e3_done", "e4_recon", "e4_climax", "e4_done"]);
      G.phase = "evening";
      G.map = "village";
      G.x = 28;
      G.y = 10;
      break;
    case "E6":
      learn([...BASE, ...E2W, ...E3W, ...E4W, ...E5W, ...E6W]);
      flags([...E3_FLAGS, "e3_seen", "e3_done", "e4_recon", "e4_done", "e5_done"]);
      G.phase = "night";
      G.map = "village";
      G.x = 31;
      G.y = 9;
      return { startSleep: true };
    case "E7":
      learn([...BASE, ...E2W, ...E3W, ...E4W, ...E5W, ...E6W]);
      flags([...E3_FLAGS, "e3_seen", "e3_done", "e4_recon", "e4_done", "e5_done", "e6_done"]);
      G.phase = "morning";
      G.map = "village";
      G.x = 19;
      G.y = 8;
      break;
  }
  return {};
}
