// F4 — Tính lãi từ giá bán (1-wiki/features/F4-tinh-lai-tu-gia-ban.md)
import { test } from 'node:test';
import assert from 'node:assert/strict';
import presets from '../assets/fee_presets.json' with { type: 'json' };
import { calculate, priceForMargin, formatPct, parseMoney, formatMoneyInput, stateLabel } from '../engine.js';
import { moneyBar, sellerVoucherAmount, calcView } from '../calc.js';
import { defaultState, loadState, saveState, updateCalc } from '../store.js';

const mk = { platform: 'shopee', categoryRate: 0.16, price: 17000, cost: 8000, pack: 1500 };

test('móc khóa: 505đ · Lãi mỏng · 3,0% · hòa vốn 16.340đ', () => {
  const v = calcView(presets, mk);
  assert.equal(v.profitText, '505đ');
  assert.equal(v.stateText, 'Lãi mỏng');
  assert.equal(v.marginText, '3,0%');
  assert.equal(v.breakevenText, '16.340đ');
  assert.equal(stateLabel('loss'), 'Lỗ');
  assert.equal(formatPct(-0.115), '−11,5%');
});

test('dải tiền đi đâu: sàn + thuế 41% · vốn + gói 56% · lãi 3%', () => {
  const bar = moneyBar(calculate(presets, mk), mk);
  assert.deepEqual(bar.map((s) => [s.key, Math.round(s.pct)]), [['fees', 41], ['cost', 56], ['profit', 3]]);
});

test('ô tiền: dấu chấm nghìn', () => {
  assert.equal(formatMoneyInput('17000'), '17.000');
  assert.equal(formatMoneyInput('1.200.0005'), '12.000.005');
  assert.equal(parseMoney('17.000'), 17000);
  assert.equal(parseMoney(''), 0);
  assert.equal(parseMoney('abc'), 0);
});

test('mã giảm giá shop theo đ hoặc %, ship người mua trả theo công thức (đơn J)', () => {
  assert.equal(sellerVoucherAmount(450000, 18000, 'vnd'), 18000);
  assert.equal(sellerVoucherAmount(450000, 4, 'pct'), 18000);
  const j = { platform: 'shopee', categoryRate: 0.165, price: 450000, cost: 0, sellerVoucher: 18000 };
  assert.equal(Math.round(calculate(presets, j).lines.find((l) => l.key === 'category').amount), 71280);
  const ship = calculate(presets, { ...mk, shipBuyer: 21500 });
  assert.equal(Math.round(ship.lines.find((l) => l.key === 'transaction').amount), 2310);
});

test('kẹp tóc 12.000đ → Lỗ −1.380đ', () => {
  const v = calcView(presets, { platform: 'shopee', categoryRate: 0.165, price: 12000, cost: 6000, pack: 1500 });
  assert.equal(v.state, 'loss');
  assert.equal(v.profitText, '−1.380đ');
  assert.ok(priceForMargin(presets, mk, 0) > 0);
});

test('nhớ đầu vào lần trước sau khi tải lại', () => {
  let s = updateCalc(defaultState(), { categoryName: 'Sở thích & Sưu tầm', categoryRate: 0.16, cost: 8000, pack: 1500, price: 17000 });
  s = loadState(saveState(s));
  assert.equal(s.calc.cost, 8000);
  assert.equal(s.calc.pack, 1500);
  assert.equal(s.calc.categoryName, 'Sở thích & Sưu tầm');
});
