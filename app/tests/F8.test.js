// F8 — Chi phí ẩn (1-wiki/features/F8-chi-phi-an.md)
import { test } from 'node:test';
import assert from 'node:assert/strict';
import presets from '../assets/fee_presets.json' with { type: 'json' };
import { hiddenCostsView } from '../calc.js';
import { calculate } from '../engine.js';
import { hiddenCostsEvent } from '../store.js';

const ao = { platform: 'shopee', categoryName: 'Thời Trang Nữ', categoryRate: 0.165, price: 149000, cost: 60000, pack: 3000 };

test('chỉ phí sàn 47.240đ → hoàn 8% 41.061đ → + Voucher Xtra 33.521đ (22,5%), thấp hơn 13.719đ', () => {
  const v = hiddenCostsView(presets, { ...ao, returnRate: 0.08, lossPerReturn: 30000, programs: ['voucher_xtra'] });
  assert.equal(v.baseText, '47.240đ');
  assert.equal(v.profitText, '33.521đ');
  assert.equal(v.stateText, 'Lãi · 22,5%');
  assert.equal(v.diffText, 'Thấp hơn 13.719đ so với chỉ tính phí sàn.');
  assert.equal(v.returnStep, '47.240đ → 41.061đ');
  assert.equal(v.voucherStep, '41.061đ → 33.521đ');
});

test('ROAS hòa vốn 4,09 / 36.436đ; không voucher 3,34 / 44.631đ', () => {
  const a = hiddenCostsView(presets, { ...ao, returnRate: 0.08, lossPerReturn: 30000, programs: ['voucher_xtra'] });
  assert.equal(a.roasText, '4,09');
  assert.equal(a.maxAdsText, '36.436đ');
  const b = hiddenCostsView(presets, { ...ao, returnRate: 0.08, lossPerReturn: 30000 });
  assert.equal(b.roasText, '3,34');
  assert.equal(b.maxAdsText, '44.631đ');
});

test('ROAS 8 trừ thêm 149.000/8 mỗi đơn; affiliate trừ % trên giá sau mã giảm giá', () => {
  const base = calculate(presets, ao).profit;
  assert.equal(Math.round(base - calculate(presets, { ...ao, roas: 8 }).profit), Math.round(149000 / 8));
  assert.equal(Math.round(base - calculate(presets, { ...ao, affiliateRate: 0.05 }).profit), 7450);
});

test('event hidden_costs_set', () => {
  assert.deepEqual(hiddenCostsEvent({ returnRate: 0.08, roas: null, affiliateRate: 0 }), { has_return_rate: true, has_roas: false, has_affiliate: false });
});
