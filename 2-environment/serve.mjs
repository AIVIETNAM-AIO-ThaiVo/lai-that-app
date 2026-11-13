#!/usr/bin/env node
// Server tĩnh nhỏ để mở app trên trình duyệt (module JS không chạy được qua file://).
//   node 2-environment/serve.mjs          → http://localhost:5173
//   import { startServer } from './serve.mjs'   (bot dùng, cổng ngẫu nhiên)
import { createServer } from 'node:http';
import { readFileSync } from 'node:fs';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

// Thư mục app lấy từ APP_DIR trong harness.config. GAME_DIR=/đường/dẫn → chấm một app bất kỳ.
const BASE = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
export const APP_DIR = (() => {
  try { return readFileSync(path.join(BASE, 'harness.config'), 'utf8').match(/^APP_DIR=(\S+)/m)?.[1] ?? 'app'; } catch { return 'app'; }
})();
const ROOT = path.resolve(process.env.GAME_DIR ?? path.join(BASE, APP_DIR));
const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.mjs': 'text/javascript', '.css': 'text/css', '.json': 'application/json',
  '.svg': 'image/svg+xml', '.png': 'image/png', '.jpg': 'image/jpeg', '.webp': 'image/webp', '.glb': 'model/gltf-binary', '.mp3': 'audio/mpeg', '.wav': 'audio/wav',
  '.woff2': 'font/woff2', '.webmanifest': 'application/manifest+json', '.ico': 'image/x-icon' };

export function startServer(port = 0) {
  const server = createServer(async (req, res) => {
    const url = new URL(req.url, 'http://x');
    const rel = url.pathname === '/' ? 'index.html' : decodeURIComponent(url.pathname).replace(/^\/+/, '');
    const file = path.join(ROOT, rel);
    if (!file.startsWith(ROOT)) return res.writeHead(403).end();
    try {
      const body = await readFile(file);
      res.writeHead(200, { 'content-type': TYPES[path.extname(file)] ?? 'application/octet-stream', 'cache-control': 'no-store' });
      res.end(body);
    } catch {
      res.writeHead(404).end('not found');
    }
  });
  return new Promise((resolve) => server.listen(port, '127.0.0.1', () => resolve(server)));
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const server = await startServer(Number(process.env.PORT ?? 5173));
  console.log(`Hóa Đơn Trọ: http://localhost:${server.address().port}`);
}
