// F19 — Tách Tính nhanh và Sản phẩm (1-wiki/features/F19-tach-tinh-nhanh-san-pham.md)
import { test } from 'node:test';
import assert from 'node:assert/strict';
import presets from '../assets/fee_presets.json' with { type: 'json' };
import { defaultState, defaultCalc, saveProduct, updateProduct, productToCalc } from '../store.js';
import { EXAMPLES } from '../examples.js';

const mk = EXAMPLES.find((e) => e.id === 'moc-khoa').input;

test('Lưu từ Tính nhanh luôn tạo sản phẩm mới', () => {
  let s = defaultState();
  s = saveProduct(s, 'Móc khóa', mk, presets, 1).state;
  s = saveProduct(s, 'Móc khóa', mk, presets, 2).state;
  assert.equal(s.products.length, 2);
  assert.notEqual(s.products[0].id, s.products[1].id);
});

test('productToCalc: bản nháp đủ trường để sửa, bật lại hoàn hàng / quảng cáo nếu có', () => {
  const ao = EXAMPLES.find((e) => e.id === 'ao-thun');
  const d = productToCalc({ id: 'x', name: 'Áo thun nữ', input: ao.input });
  for (const k of Object.keys(defaultCalc())) assert.ok(k in d, k);
  assert.equal(d.price, 149000);
  assert.equal(d.returnOn, true);
  assert.equal(d.adsOn, false);
  assert.equal(d.mode, 'price');
});

test('updateProduct đổi tên + đầu vào, giữ id, không ghi product_saved; Tính nhanh không đổi', () => {
  let s = saveProduct(defaultState(), 'Móc khóa', mk, presets, 1).state;
  s = { ...s, calc: { ...s.calc, price: 99000 } };
  const id = s.products[0].id;
  const before = s.events.length;
  s = updateProduct(s, id, 'Móc khóa gỗ', { ...mk, price: 22900 }, 5);
  assert.equal(s.products.length, 1);
  assert.equal(s.products[0].id, id);
  assert.equal(s.products[0].name, 'Móc khóa gỗ');
  assert.equal(s.products[0].input.price, 22900);
  assert.equal(s.events.length, before);
  assert.equal(s.calc.price, 99000);
  assert.equal(updateProduct(s, 'khong-co', 'x', mk, 6), s);
});
