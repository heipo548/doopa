import { defineConfig } from 'vite';

// base: './' にしておくと、GitHub Pages のサブフォルダ
// (prototypes/08-mana/) に置いてもアセットのパスが壊れない。
// ※ ゲーム本体（src/）には一切手を入れない。これは配信用のビルド設定のみ。
export default defineConfig({
  base: './',
  build: {
    outDir: 'dist',
    target: 'es2020',
    assetsInlineLimit: 0,
    rollupOptions: {
      output: {
        // ハッシュ付きにしない: 再ビルドで古いファイルがリポジトリに残らないよう上書きで済ませる
        entryFileNames: 'assets/game.js',
        chunkFileNames: 'assets/[name].js',
        assetFileNames: 'assets/[name][extname]',
      },
    },
  },
  server: { host: '127.0.0.1' },
});
