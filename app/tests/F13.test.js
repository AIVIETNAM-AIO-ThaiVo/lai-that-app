// F13 — Mô phỏng lãi tháng (1-wiki/features/F13-lai-thang.md)
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { monthlyProfit, monthlyText } from '../calc.js';
import { defaultState, saveProduct } from '../store.js';
import presets from '../assets/fee_presets.json' with { type: 'json' };

test('lãi tháng = lãi mỗi đơn × số đơn; rỗng/âm → 0', () => {
  assert.equal(monthlyProfit(505, 300), 151500);
  assert.equal(monthlyProfit(505, ''), 0);
  assert.equal(monthlyProfit(505, -5), 0);
  assert.equal(monthlyText(505, 300), 'Lãi tháng ≈ 151.500đ');
  assert.equal(monthlyText(-1380, 100), 'Lỗ tháng ≈ −138.000đ');
  assert.equal(monthlyText(505, 0), '');
});

test('số đơn/tháng lưu theo sản phẩm', () => {
  const r = saveProduct(defaultState(), 'Móc khóa', { platform: 'shopee', categoryRate: 0.16, price: 17000, cost: 8000, pack: 1500, ordersPerMonth: 300 }, presets, 1);
  assert.equal(r.state.products[0].input.ordersPerMonth, 300);
});
