// F18 — Miễn phí cố định 30 ngày cho shop mới (1-wiki/features/F18-shop-moi.md). Mall đã bỏ 13/11.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import presets from '../assets/fee_presets.json' with { type: 'json' };
import { calculate } from '../engine.js';
import * as Presets from '../presets.js';
const { categoriesFor, newShopPromoInfo } = Presets;

const mk = { platform: 'shopee', categoryRate: 0.16, price: 17000, cost: 8000, pack: 1500 };

test('không còn Mall: không có gợi ý Mall, danh sách ngành không có mục Mall', () => {
  assert.equal(Presets.mallHint, undefined);
  assert.ok(!categoriesFor(presets, 'shopee').some((c) => /Mall/.test(c.name) || c.mall));
});

test('shop mới Shopee: miễn phí cố định ngành → móc khóa lãi 3.225đ; sàn khác không áp dụng', () => {
  assert.equal(Math.round(calculate(presets, { ...mk, newShopPromo: true }).profit), 3225);
  const tk = { ...mk, platform: 'tiktok_shop', categoryRate: 0.13 };
  assert.equal(Math.round(calculate(presets, { ...tk, newShopPromo: true }).profit), Math.round(calculate(presets, tk).profit));
  const info = newShopPromoInfo(presets, 'shopee');
  assert.equal(info.maxOrders, 200);
  assert.match(info.text, /miễn phí cố định 30 ngày, tối đa 200 đơn/);
  assert.equal(newShopPromoInfo(presets, 'lazada'), null);
});
