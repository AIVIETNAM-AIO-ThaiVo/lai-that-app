// F4 — Màn kết quả (1-wiki/features/F4-man-ket-qua.md)
import { test } from 'node:test';
import assert from 'node:assert/strict';
import tariff from '../tariff-default.json' with { type: 'json' };
import { calcBill, tierBar, kwhBucket, resultMeta } from '../logic.js';
import { calculatedEvent } from '../store.js';

test('thanh bậc giá: 3 đoạn tỉ lệ 75:75:150', () => {
  const r = calcBill(300, { mode: 'A', people: 3, period: '2026-11' }, tariff);
  const bar = tierBar(r);
  assert.deepEqual(bar.map((s) => s.label), ['B1', 'B2', 'B3']);
  assert.deepEqual(bar.map((s) => s.pct), [25, 25, 50]);
});

test('chế độ không khai báo: một dòng giá + nguồn', () => {
  const r = calcBill(300, { mode: 'B', people: 3, period: '2026-11' }, tariff);
  assert.equal(r.total, 741636);
  assert.equal(r.tiers.length, 1);
  assert.match(r.source, /TT 60\/2025/);
  assert.match(resultMeta(r), /không khai báo/);
  assert.match(resultMeta(calcBill(300, { mode: 'A', people: 3, period: '2026-11' }, tariff)), /3 người có khai báo · đã gồm VAT 8%/);
});

test('kwh_bucket', () => {
  assert.equal(kwhBucket(50), '0-100');
  assert.equal(kwhBucket(150), '101-200');
  assert.equal(kwhBucket(300), '201-400');
  assert.equal(kwhBucket(500), '401-700');
  assert.equal(kwhBucket(800), '700+');
});

test('event bill_calculated không chứa số tiền', () => {
  const r = calcBill(300, { mode: 'A', people: 3, period: '2026-11' }, tariff);
  const ev = calculatedEvent(r);
  assert.deepEqual(ev, { mode: 'A', kwh_bucket: '201-400', people_count: 3 });
  assert.ok(!Object.values(ev).includes(808218));
});
