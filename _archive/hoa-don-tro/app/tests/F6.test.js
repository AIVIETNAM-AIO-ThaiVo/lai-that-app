// F6 — Chia tiền theo người hoặc số ngày ở (1-wiki/features/F6-chia-tien.md)
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { splitAmount, splitBill, daysInPeriod } from '../logic.js';
import { splitEvent } from '../store.js';

test('808.218đ theo ngày 30/30/20 → 303.082 · 303.082 · 202.054', () => {
  const r = splitAmount(808218, [30, 30, 20]);
  assert.deepEqual(r, [303082, 303082, 202054]);
  assert.equal(r.reduce((a, b) => a + b, 0), 808218);
});

test('chia đều 100.000đ cho 3 người: người cuối nhận phần lẻ', () => {
  assert.deepEqual(splitAmount(100000, [1, 1, 1]), [33333, 33333, 33334]);
});

test('khoản cố định chia cùng cách; tổng = điện + các khoản', () => {
  const r = splitBill({
    total: 808218,
    type: 'days',
    people: [{ days: 30 }, { days: 30 }, { days: 20 }],
    extras: [{ label: 'Wifi', amount: 150000 }],
  });
  assert.deepEqual(r.people.map((p) => p.electric), [303082, 303082, 202054]);
  assert.deepEqual(r.people.map((p) => p.extras), [56250, 56250, 37500]);
  assert.equal(r.sum, 958218);
  assert.equal(r.people.reduce((s, p) => s + p.total, 0), 958218);
  const eq = splitBill({ total: 808218, type: 'equal', people: [{ days: 30 }, { days: 30 }, { days: 20 }], extras: [] });
  assert.deepEqual(eq.people.map((p) => p.total), [269406, 269406, 269406]);
});

test('ngày ở mặc định theo số ngày của tháng', () => {
  assert.equal(daysInPeriod('2026-11'), 30);
  assert.equal(daysInPeriod('2027-02'), 28);
  assert.equal(daysInPeriod('2028-02'), 29);
});

test('tổng ngày = 0 thì chia đều, không chia cho 0', () => {
  assert.deepEqual(splitAmount(10, [0, 0]), [5, 5]);
});

test('event bill_split', () => {
  assert.deepEqual(splitEvent({ type: 'days', people: [1, 2, 3] }), { split_type: 'days', people_count: 3 });
});
