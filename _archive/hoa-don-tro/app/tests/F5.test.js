// F5 — So sánh với số chủ trọ thu (1-wiki/features/F5-so-sanh-chu-tro.md)
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { compareLandlord, overchargeBucket, parseAmount, yearlyText } from '../logic.js';

test('4.000đ/kWh × 300 kWh so với 808.218đ → cao hơn 391.782đ, khoảng 4,7 triệu/năm', () => {
  const c = compareLandlord({ legalTotal: 808218, kwh: 300, value: 4000, unit: 'perKwh' });
  assert.equal(c.landlordTotal, 1200000);
  assert.equal(c.diff, 391782);
  assert.equal(c.status, 'over');
  assert.equal(c.bucket, '20-50%');
  assert.match(yearlyText(c.diff * 12), /4,7 triệu/);
});

test('nhập tổng tiền thay vì đơn giá cho cùng kết quả', () => {
  const c = compareLandlord({ legalTotal: 808218, kwh: 300, value: 1200000, unit: 'total' });
  assert.equal(c.diff, 391782);
  assert.equal(parseAmount('1.200.000'), 1200000);
  assert.equal(parseAmount('4.000'), 4000);
  assert.equal(parseAmount(''), null);
  assert.equal(parseAmount('abc'), null);
});

test('chủ trọ thu ≤ mức đúng → Đúng quy định', () => {
  const c = compareLandlord({ legalTotal: 808218, kwh: 300, value: 2600, unit: 'perKwh' });
  assert.equal(c.status, 'ok');
  assert.equal(c.bucket, 'none');
  assert.equal(compareLandlord({ legalTotal: 808218, kwh: 300, value: null, unit: 'perKwh' }), null);
});

test('overchargeBucket đúng ngưỡng', () => {
  assert.equal(overchargeBucket(0, 1000), 'none');
  assert.equal(overchargeBucket(-5, 1000), 'none');
  assert.equal(overchargeBucket(199, 1000), '<20%');
  assert.equal(overchargeBucket(200, 1000), '20-50%');
  assert.equal(overchargeBucket(500, 1000), '20-50%');
  assert.equal(overchargeBucket(501, 1000), '>50%');
});

test('ước tính năm dưới 1 triệu ghi bằng đồng', () => {
  assert.equal(yearlyText(600000), 'Khoảng 600.000đ mỗi năm nếu giữ mức này.');
  assert.equal(yearlyText(4701384), 'Khoảng 4,7 triệu đồng mỗi năm nếu giữ mức này.');
});

test('toàn bộ chữ trong app không có từ "lừa"', () => {
  const dir = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
  for (const f of readdirSync(dir).filter((n) => /\.(js|html|json|css)$/.test(n))) {
    assert.ok(!/lừa/i.test(readFileSync(path.join(dir, f), 'utf8')), `${f} có chữ "lừa"`);
  }
});
