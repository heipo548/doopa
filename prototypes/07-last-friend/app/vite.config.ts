import { defineConfig } from "vite";

// base: './' にしておくと、GitHub Pages のサブフォルダ
// (prototypes/07-last-friend/) に置いてもパスが壊れない
export default defineConfig({
  base: "./",
  build: {
    outDir: "dist",
    target: "es2020",
    assetsInlineLimit: 0,
    rollupOptions: {
      output: {
        // ハッシュ付きファイル名にしない理由:
        // 再ビルドのたびに古いファイルがリポジトリに残るのを防ぐ（上書きだけで済む）
        entryFileNames: "assets/game.js",
        chunkFileNames: "assets/[name].js",
        assetFileNames: "assets/[name][extname]"
      }
    }
  },
  server: { host: "127.0.0.1" }
});
