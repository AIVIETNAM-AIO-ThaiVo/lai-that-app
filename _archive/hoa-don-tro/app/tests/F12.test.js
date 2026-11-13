// F12 — Nguồn & miễn trừ, quyền riêng tư, offline (1-wiki/features/F12-nguon-mien-tru.md)
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import tariff from '../tariff-default.json' with { type: 'json' };
import { SOURCES, DISCLAIMER, PRIVACY, MODE_B_NOTE } from '../content.js';
import { tariffRows } from '../logic.js';
import { wipeState, initialRoute, defaultState } from '../store.js';

const APP = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');

test('dẫn đủ 4 văn bản', () => {
  const all = SOURCES.map((s) => s.code).join(' | ');
  for (const code of ['QĐ 2892/QĐ-BCT', 'TT 60/2025/TT-BCT', 'NĐ 133/2026', 'NQ 204/2025/QH15']) assert.ok(all.includes(code), code);
});

test('bảng giá 5 bậc lấy từ config, có phiên bản + ngày hiệu lực', () => {
  const rows = tariffRows(tariff);
  assert.equal(rows.length, 5);
  assert.deepEqual(rows.map((r) => r.range), ['0–100', '101–200', '201–400', '401–700', 'từ 701']);
  assert.deepEqual(rows.map((r) => r.price), [1901, 2289, 2894, 3456, 3844]);
  assert.ok(tariff.tariff_version && tariff.effective_from);
});

test('miễn trừ + ghi chú giá không khai báo + quyền riêng tư', () => {
  assert.match(DISCLAIMER, /không phải ứng dụng của EVN hay cơ quan nhà nước/);
  assert.match(DISCLAIMER, /mang tính tham khảo/);
  assert.match(MODE_B_NOTE, /2\.289đ/);
  assert.match(MODE_B_NOTE, /2\.894đ/);
  assert.match(PRIVACY, /chỉ lưu trên máy/);
});

test('xoá dữ liệu → về màn chọn vai', () => {
  const s = wipeState();
  assert.deepEqual(s, defaultState());
  assert.equal(initialRoute(s), '#/chon-vai');
});

test('có manifest + service worker để chạy offline', () => {
  const manifest = JSON.parse(readFileSync(path.join(APP, 'manifest.webmanifest'), 'utf8'));
  assert.match(manifest.name, /Hóa Đơn Trọ/);
  assert.ok(manifest.icons.length >= 1 && manifest.start_url && manifest.display === 'standalone');
  assert.ok(existsSync(path.join(APP, 'sw.js')));
  const sw = readFileSync(path.join(APP, 'sw.js'), 'utf8');
  assert.match(sw, /addEventListener\('fetch'/);
  assert.match(readFileSync(path.join(APP, 'index.html'), 'utf8'), /manifest\.webmanifest/);
});
