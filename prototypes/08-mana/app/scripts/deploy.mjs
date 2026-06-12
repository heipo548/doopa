// ビルド成果物 (app/dist/) をプロトタイプ直下にコピーする。
// GitHub Pages は prototypes/08-mana/index.html を直接配信するため、
// 「▶ あそぶ」リンクが他のプロトタイプと同じ形式で動くようになる。
// 削除はせず上書きコピーのみ（ファイル名を固定しているので古いゴミは出ない）。
import { cpSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const here = dirname(fileURLToPath(import.meta.url));
const dist = join(here, '..', 'dist');
const dest = join(here, '..', '..');

if (!existsSync(dist)) {
  console.error('dist/ がありません。先に npm run build を実行してください。');
  process.exit(1);
}
cpSync(dist, dest, { recursive: true });
console.log('deploy 完了: dist/ → prototypes/08-mana/');
