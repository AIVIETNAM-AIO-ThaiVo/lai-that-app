// F26 — Phát hành (1-wiki/features/F26-phat-hanh.md)
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync, readdirSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const APP = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const ROOT = path.join(APP, '..');
const pngSize = (f) => { const b = readFileSync(f); assert.equal(b.toString('ascii', 1, 4), 'PNG', f); return [b.readUInt32BE(16), b.readUInt32BE(20)]; };

test('chính sách quyền riêng tư trong app, có quảng cáo + mua trong ứng dụng, chạy offline', () => {
  const f = path.join(APP, 'privacy.html');
  assert.ok(existsSync(f));
  const html = readFileSync(f, 'utf8');
  assert.match(html, /quảng cáo/i);
  assert.match(html, /Google Play/);
  assert.match(html, /49\.000đ/);
  assert.match(readFileSync(path.join(APP, 'sw.js'), 'utf8'), /'privacy\.html'/);
  assert.match(readFileSync(path.join(APP, 'ui.js'), 'utf8'), /id="privacy-link"[^>]*href="privacy\.html"/);
});

test('bộ ảnh store đúng kích thước', () => {
  const dir = path.join(ROOT, 'brand', 'store');
  assert.deepEqual(pngSize(path.join(dir, 'icon-512.png')), [512, 512]);
  assert.deepEqual(pngSize(path.join(dir, 'feature-graphic.png')), [1024, 500]);
  const shots = readdirSync(dir).filter((f) => /^screenshot-\d+\.png$/.test(f));
  assert.ok(shots.length >= 6 && shots.length <= 8, `${shots.length} ảnh`);
  for (const s of shots) assert.deepEqual(pngSize(path.join(dir, s)), [1080, 1920], s);
});

test('gói Android: cấu hình Capacitor + hướng dẫn AAB (ADR-002)', () => {
  const capCfg = JSON.parse(readFileSync(path.join(ROOT, 'mobile', 'capacitor.config.json'), 'utf8'));
  assert.equal(capCfg.appId, 'vn.laithat.app');
  assert.ok(!/shopee|tiktok|lazada/i.test(JSON.stringify(capCfg)), 'không tên sàn');
  assert.match(readFileSync(path.join(ROOT, 'mobile', 'README.md'), 'utf8'), /Internal testing/);
});

test('có video demo', () => {
  const dir = path.join(ROOT, 'brand', 'video');
  assert.ok(existsSync(dir) && readdirSync(dir).some((f) => /\.(webm|mp4)$/.test(f)));
});
