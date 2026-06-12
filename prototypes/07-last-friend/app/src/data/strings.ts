// UI の定型文言・ナレーション置き場。
// ゲーム内セリフは data/dialogues/ に置き、ここには「画面の部品」の文字だけを置く。
export const STR = {
  title: "さいごのともだち",
  subtitle: "たいけんばん",
  menuNew: "はじめから",
  menuContinue: "つづきから",
  menuSecret: "？？？",
  // クリア後に？？？を選ぶと出る一行 (§4.8)。選んだらメニューに戻るだけ。
  secretLine: "（まだ ことばが たりない）",

  notebookTitle: "ことばノート",
  notebookEmpty: "（まだ なにも しらない）",
  notebookSlotUnknown: "？？？",
  notebookHelp: "←→ ページ　↑↓ えらぶ　Ｘ とじる",

  paletteHelp: "←→↑↓ えらぶ　Ｚ いう",
  paletteEmpty: "（いえる ことばが ない）",

  toastQ1: "あいさつ できた（〈greet〉／4）",
  toastQ1Done: "みんなに あいさつ できた！",

  helpLine: "Ｚ けってい　Ｘ もどる　Ｃ ことばノート",

  // E7 のしろいカード (§9 E7)
  endCard1: "きょうの ことばは ここまで",
  endCard2: "きみの ことばは まだ ███ だらけ",

  // E6 かみさまの一行たち (§9 E6)。〈n〉〈m〉は実値に置換される。
  // ここだけは一切マスクされず「全部読める」(GAME_DESIGN §5.2)。
  kamiLines: [
    "きみは ことばを 〈n〉こ おぼえた",
    "きみは ものを 〈m〉かい しらべた",
    "きみは うそを しった", // dark>=1 のときだけ挟まる
    "また みている ね",
    "――では また",
  ],
};
