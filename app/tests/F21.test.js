// F21 — Thêm sản phẩm ngay trong danh mục (1-wiki/features/F21-them-san-pham.md)
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import presets from '../assets/fee_presets.json' with { type: 'json' };
import { calculate } from '../engine.js';
import { defaultState, updateCalc, newProductCalc, createReady, saveProduct } from '../store.js';
import { EXAMPLES } from '../examples.js';

const APP = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const mk = EXAMPLES.find((e) => e.id === 'moc-khoa').input;

test('newProductCalc: trống giá / vốn / ngành, giữ sàn và thiết lập shop của Tính nhanh', () => {
  let s = defaultState();
  s = updateCalc(s, { ...mk, platform: 'tiktok_shop', vat: false, programs: ['xtra'], registered: true });
  const d = newProductCalc(s);
  assert.equal(d.platform, 'tiktok_shop');
  assert.equal(d.price, 0);
  assert.equal(d.cost, 0);
  assert.equal(d.pack, 0);
  assert.equal(d.categoryRate, null);
  assert.equal(d.categoryName, '');
  assert.equal(d.vat, false);
  assert.equal(d.registered, true);
  assert.deepEqual(d.programs, ['xtra']);
  assert.equal(d.mode, 'price');
  assert.notEqual(d.programs, s.calc.programs, 'bản sao, không dùng chung mảng');
});

test('createReady: cần tên và giá bán', () => {
  assert.equal(createReady('', { price: 17000 }), false);
  assert.equal(createReady('   ', { price: 17000 }), false);
  assert.equal(createReady('Móc khóa', { price: 0 }), false);
  assert.equal(createReady('Móc khóa', { price: 17000 }), true);
});

test('Thêm từ màn Sản phẩm mới: tạo sản phẩm mới, Tính nhanh giữ nguyên', () => {
  let s = updateCalc(defaultState(), { price: 99000, cost: 50000 });
  const d = { ...newProductCalc(s), ...mk };
  const r = saveProduct(s, 'Móc khóa', d, presets, 5);
  assert.ok(r.ok);
  s = r.state;
  assert.equal(s.products.length, 1);
  assert.equal(s.products[0].name, 'Móc khóa');
  assert.equal(s.calc.price, 99000);
  const res = calculate(presets, { ...s.products[0].input, sellerVoucher: 0 });
  assert.equal(Math.round(res.profit), 505);
});

test('Danh mục có nút Thêm sản phẩm ở cả hai trạng thái (có / trống)', () => {
  const ui = readFileSync(path.join(APP, 'ui.js'), 'utf8');
  const cat = ui.slice(ui.indexOf('function screenCatalog'), ui.indexOf('function screenSettings'));
  const hits = cat.match(/id="add-product"[^>]*data-to="#\/san-pham\/moi"/g) ?? [];
  assert.equal(hits.length, 2, 'một nút khi có sản phẩm, một nút khi trống');
});
