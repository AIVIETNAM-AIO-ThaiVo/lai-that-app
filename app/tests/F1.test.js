// F1 — Bộ máy tính phí sàn (1-wiki/features/F1-bo-may-tinh.md, 1-wiki/engine/formula.md)
import { test } from 'node:test';
import assert from 'node:assert/strict';
import presets from '../assets/fee_presets.json' with { type: 'json' };
import vectors from '../test/test_vectors.json' with { type: 'json' };
import { calculate, priceForMargin, nicePrice, maxCost, flashSale, formatVnd, roundVnd } from '../engine.js';

const mk = { platform: 'shopee', categoryRate: 0.16, price: 17000, cost: 8000, pack: 1500 };

test('8 đơn Shopee thật: lệch < 1% giá bán và ≤ 2đ', () => {
  assert.equal(vectors.length, 8);
  for (const v of vectors) {
    const r = calculate(presets, {
      platform: v.platform, categoryRate: v.category_rate, price: v.price, cost: 0, sellerVoucher: v.seller_voucher,
      shipBuyer: v.ship_buyer, programs: v.programs, vat: v.vat, affiliateRate: v.affiliate_rate,
    });
    const app = r.platformFees + r.tax + r.other;
    const real = v.expected_total_deduction;
    assert.ok(Math.abs(app - real) / v.price < 0.01, `${v.id}: ${app} vs ${real}`);
    assert.ok(Math.abs(app - real) <= 2, `${v.id}: lệch ${app - real}`);
  }
});

test('Móc khóa Shopee: lãi 505đ, lãi mỏng, sàn + thuế 41%', () => {
  const r = calculate(presets, mk);
  assert.equal(Math.round(r.profit), 505);
  assert.equal(r.state, 'thin');
  assert.equal(Math.round(r.takeRate * 100), 41);
});

test('Hòa vốn 16.340đ, giá 20% = 22.124đ, giá đẹp 22.900đ lãi 5.018đ', () => {
  assert.equal(Math.ceil(priceForMargin(presets, mk, 0)), 16340);
  assert.equal(Math.ceil(priceForMargin(presets, mk, 0.2)), 22124);
  assert.equal(nicePrice(priceForMargin(presets, mk, 0.2)), 22900);
  assert.equal(roundVnd(calculate(presets, { ...mk, price: 22900 }).profit), 5018, 'làm tròn nửa về số chẵn như tools/engine.py');
  assert.equal(nicePrice(125300), 129000);
  assert.equal(nicePrice(Infinity), Infinity);
});

test('TikTok Shop 13%: lãi 1.015đ, hòa vốn 15.724đ', () => {
  const tk = { ...mk, platform: 'tiktok_shop', categoryRate: 0.13 };
  assert.equal(Math.round(calculate(presets, tk).profit), 1015);
  assert.equal(Math.ceil(priceForMargin(presets, tk, 0)), 15724);
});

test('Áo thun hoàn 8%: 41.061đ; + Voucher Xtra: 33.521đ', () => {
  const a = { platform: 'shopee', categoryRate: 0.165, price: 149000, cost: 60000, pack: 3000, returnRate: 0.08, lossPerReturn: 30000 };
  assert.equal(Math.round(calculate(presets, a).profit), 41061);
  assert.equal(Math.round(calculate(presets, { ...a, programs: ['voucher_xtra'] }).profit), 33521);
});

test('Voucher Xtra chạm trần 50.000đ; mức lãi không thể → Infinity', () => {
  const n = { platform: 'shopee', categoryRate: 0.11, price: 1200000, cost: 750000, pack: 10000, programs: ['voucher_xtra'] };
  assert.equal(calculate(presets, n).lines.find((l) => l.key === 'voucher').amount, 50000);
  assert.equal(priceForMargin(presets, mk, 0.9), Infinity);
});

test('Flash Sale 30% từ 22.900đ lỗ 237đ; giá nhập tối đa 8.438đ', () => {
  const p = { ...mk, price: 22900 };
  assert.equal(Math.round(flashSale(presets, p, 0.3).profit), -237);
  assert.equal(roundVnd(maxCost(presets, p, 0.2)), 8438);
});

test('Định dạng tiền: chỉ làm tròn khi hiển thị', () => {
  assert.equal(formatVnd(17000), '17.000đ');
  assert.equal(formatVnd(-1380), '−1.380đ');
  assert.equal(formatVnd(504.6), '505đ');
  const r = calculate(presets, { ...mk, price: 17001 });
  assert.notEqual(r.profit, Math.round(r.profit), 'engine giữ số thực, không làm tròn giữa chừng');
  assert.ok(Math.abs(r.lines.find((l) => l.key === 'category').amount - 2720.16) < 1e-9);
});
