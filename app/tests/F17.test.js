// F17 — Nhắc mùa sale (1-wiki/features/F17-nhac-mua-sale.md)
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { nextSale, saleReminderDue, saleLine } from '../sales.js';

test('sale gần nhất là ngày "trùng số" kế tiếp', () => {
  const a = nextSale('2026-11-12');
  assert.equal(a.iso, '2026-12-12');
  assert.equal(a.label, '12.12');
  assert.equal(a.days, 30);
  const b = nextSale('2026-12-13');
  assert.equal(b.iso, '2027-01-01');
  assert.equal(b.label, '1.1');
  assert.equal(nextSale('2026-11-11').days, 0);
  assert.equal(nextSale('2026-11-11').label, '11.11');
});

test('đến hạn nhắc khi còn ≤ 3 ngày', () => {
  assert.equal(saleReminderDue(nextSale('2026-12-09')), true);
  assert.equal(saleReminderDue(nextSale('2026-12-08')), false);
  assert.equal(saleReminderDue(nextSale('2026-12-12')), true);
  assert.equal(saleLine(nextSale('2026-11-12')), 'Sale gần nhất: 12.12 · còn 30 ngày');
  assert.equal(saleLine(nextSale('2026-12-12')), 'Sale gần nhất: 12.12 · hôm nay');
});
