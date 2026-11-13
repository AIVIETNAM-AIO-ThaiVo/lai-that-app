// F5 — Tính từ % lãi muốn có (1-wiki/features/F5-tinh-tu-phan-tram-lai.md)
import { test } from 'node:test';
import assert from 'node:assert/strict';
import presets from '../assets/fee_presets.json' with { type: 'json' };
import { calculate } from '../engine.js';
import { marginView, MARGIN_CHIPS } from '../calc.js';

const mk = { platform: 'shopee', categoryRate: 0.16, price: 17000, cost: 8000, pack: 1500 };

test('chip 10/15/20/25/30, 20% là gợi ý', () => {
  assert.deepEqual(MARGIN_CHIPS.map((c) => c.m), [0.1, 0.15, 0.2, 0.25, 0.3]);
  assert.equal(MARGIN_CHIPS.find((c) => c.recommended).m, 0.2);
});

test('20%: giá nên bán 22.900đ, lãi 5.018đ · 21,9%, tối thiểu 22.124đ, hòa vốn 16.340đ', () => {
  const v = marginView(presets, mk, { m: 0.2 });
  assert.equal(v.niceText, '22.900đ');
  assert.equal(v.nicePrice, 22900);
  assert.match(v.niceProfitText, /Lãi 5\.018đ · 21,9%/);
  assert.match(v.niceProfitText, /tối thiểu 22\.124đ/);
  assert.equal(v.breakevenText, '16.340đ');
});

test('nhập số tiền lãi mong muốn → giá cho lãi ≥ số đó', () => {
  const v = marginView(presets, mk, { amount: 5000 });
  assert.ok(Number.isFinite(v.exactPrice));
  assert.equal(Math.round(calculate(presets, { ...mk, price: v.exactPrice }).profit), 5000);
  assert.ok(calculate(presets, { ...mk, price: v.nicePrice }).profit >= 5000);
});

test('mức lãi không thể đạt', () => {
  const v = marginView(presets, mk, { m: 0.9 });
  assert.equal(v.impossible, true);
  assert.equal(v.niceText, 'Không thể đạt mức lãi này');
});

test('mã giảm giá shop: giá niêm yết = giá sau giảm + mã', () => {
  const v = marginView(presets, { ...mk, sellerVoucher: 2000 }, { m: 0 });
  assert.equal(Math.ceil(v.exactPrice), 16340 + 2000);
});
