// Chép web app (../app) vào mobile/www cho Capacitor, bỏ phần chỉ dùng để kiểm thử (không đưa vào APK/AAB).
// Chạy tự động trong `npm run sync`.
import { cp, rm } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const SRC = path.resolve(HERE, '..', '..', 'app');
const OUT = path.resolve(HERE, '..', 'www');
const SKIP = new Set(['tests', 'test', 'e2e.mjs']);

await rm(OUT, { recursive: true, force: true });
await cp(SRC, OUT, {
  recursive: true,
  filter: (src) => {
    const rel = path.relative(SRC, src);
    return !rel || !SKIP.has(rel.split(path.sep)[0]);
  },
});
console.log(`Đã chép ${SRC} → ${OUT} (bỏ ${[...SKIP].join(', ')})`);
