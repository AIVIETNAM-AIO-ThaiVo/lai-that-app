// F1 — Tính tiền theo biểu giá 5 bậc + VAT (1-wiki/features/F1-tinh-tien-5-bac.md)
import { test } from 'node:test';
import assert from 'node:assert/strict';
import tariff from '../tariff-default.json' with { type: 'json' };
import { calcBill, formatVND, vatRateFor } from '../logic.js';

const P = '2026-11';

test('5 ví dụ kiểm thử của calc-engine.md (VAT 8%)', () => {
  const cases = [
    { kwh: 300, opt: { mode: 'A', people: 4 }, pre: 708400, total: 765072 },
    { kwh: 300, opt: { mode: 'A', people: 3 }, pre: 748350, total: 808218 },
    { kwh: 150, opt: { mode: 'A', people: 2 }, pre: 354200, total: 382536 },
    { kwh: 300, opt: { mode: 'B', people: 3 }, pre: 686700, total: 741636 },
    { kwh: 500, opt: { mode: 'A', people: 4 }, pre: 1343400, total: 1450872 },
  ];
  for (const c of cases) {
    const r = calcBill(c.kwh, { ...c.opt, period: P }, tariff);
    assert.equal(r.preTax, c.pre, `${c.kwh} kWh ${JSON.stringify(c.opt)} trước thuế`);
    assert.equal(r.total, c.total, `${c.kwh} kWh ${JSON.stringify(c.opt)} sau VAT`);
  }
});

test('kết quả có từng bậc, VAT; tổng các bậc = tiền trước thuế', () => {
  const r = calcBill(300, { mode: 'A', people: 3, period: P }, tariff);
  assert.deepEqual(r.tiers.map((t) => [t.tier, t.kwh, t.price, t.amount]), [
    [1, 75, 1901, 142575],
    [2, 75, 2289, 171675],
    [3, 150, 2894, 434100],
  ]);
  assert.equal(r.tiers.reduce((s, t) => s + t.amount, 0), r.preTax);
  assert.equal(r.vatRate, 8);
  assert.equal(r.vat, 59868);
  assert.equal(r.total, r.preTax + r.vat);
  const b = calcBill(300, { mode: 'B', people: 3, period: P }, tariff);
  assert.equal(b.tiers.length, 1);
  assert.equal(b.tiers[0].price, 2289);
});

test('VAT theo kỳ: 2026-11 → 8%, 2027-01 → 10%', () => {
  assert.equal(vatRateFor('2026-11', tariff), 8);
  assert.equal(vatRateFor('2026-12', tariff), 8);
  assert.equal(vatRateFor('2027-01', tariff), 10);
  assert.equal(calcBill(300, { mode: 'A', people: 4, period: '2027-01' }, tariff).total, 779240);
});

test('đổi config thì kết quả đổi theo, không sửa code', () => {
  const t2 = structuredClone(tariff);
  t2.vat = [{ from: '2000-01', to: null, rate: 10 }];
  assert.equal(calcBill(300, { mode: 'A', people: 4, period: P }, t2).total, 779240);
  t2.undeclared_rate = 2894;
  assert.equal(calcBill(300, { mode: 'B', people: 1, period: P }, t2).preTax, 868200);
  t2.tiers[0].price = 2000;
  assert.equal(calcBill(50, { mode: 'A', people: 4, period: P }, t2).preTax, 100000);
});

test('formatVND kiểu Việt', () => {
  assert.equal(formatVND(808218), '808.218đ');
  assert.equal(formatVND(1450872), '1.450.872đ');
  assert.equal(formatVND(0), '0đ');
  assert.equal(formatVND(-391782), '-391.782đ');
});

test('kWh âm hoặc không phải số thì báo lỗi', () => {
  assert.throws(() => calcBill(-1, { mode: 'A', people: 1, period: P }, tariff));
  assert.throws(() => calcBill('abc', { mode: 'A', people: 1, period: P }, tariff));
  assert.throws(() => calcBill(NaN, { mode: 'B', people: 1, period: P }, tariff));
  assert.equal(calcBill(0, { mode: 'A', people: 1, period: P }, tariff).total, 0);
});
