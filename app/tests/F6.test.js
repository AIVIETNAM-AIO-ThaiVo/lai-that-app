// F6 — Chi tiết phí (1-wiki/features/F6-chi-tiet-phi.md)
import { test } from 'node:test';
import assert from 'node:assert/strict';
import presets from '../assets/fee_presets.json' with { type: 'json' };
import { calculate } from '../engine.js';
import { breakdownView } from '../calc.js';

const mk = { platform: 'shopee', categoryRate: 0.16, price: 17000, cost: 8000, pack: 1500 };

test('"17.000đ đi đâu?" — sàn + thuế 6.995đ, 41%', () => {
  const v = breakdownView(presets, mk);
  assert.equal(v.title, '17.000đ đi đâu?');
  assert.equal(v.takeRateText, 'Sàn + thuế lấy 6.995đ, tức 41% giá bán');
});

test('các dòng phí và "còn lại"', () => {
  const v = breakdownView(presets, mk);
  assert.deepEqual(v.rows.map((r) => [r.key, r.amountText]), [
    ['category', '−2.720đ'], ['transaction', '−1.020đ'], ['per_order', '−3.000đ'], ['tax', '−255đ'], ['pack', '−1.500đ'], ['cost', '−8.000đ'],
  ]);
  assert.equal(v.remainingText, 'Còn lại: lãi mỏng 505đ');
  const tx = v.rows.find((r) => r.key === 'transaction');
  assert.match(tx.basis, /6% × \(giá sau mã giảm giá shop \+ ship người mua trả\)/);
  assert.match(tx.source, /Học viện Shopee/);
  assert.match(tx.effective, /01\/05\/2026/);
});

test('công tắc chương trình và thuế đổi kết quả', () => {
  const a = calculate(presets, mk).profit;
  assert.equal(Math.round(a - calculate(presets, { ...mk, programs: ['piship'] }).profit), 2700);
  assert.equal(Math.round(calculate(presets, { ...mk, vat: false }).profit - a), 170);
  assert.equal(Math.round(calculate(presets, { ...mk, pit: false }).profit - a), 85);
  assert.ok(calculate(presets, { ...mk, programs: ['visibility'] }).lines.some((l) => l.key === 'visibility'));
});

test('TikTok đã đăng ký MST: phí chia 1,1; ghi "chưa đối chiếu đủ đơn thật"', () => {
  const tk = { ...mk, platform: 'tiktok_shop', categoryRate: 0.13 };
  const a = calculate(presets, tk);
  const b = calculate(presets, { ...tk, registered: true });
  assert.ok(Math.abs(b.platformFees - a.platformFees / 1.1) < 0.01);
  assert.match(breakdownView(presets, tk).verifiedNote, /chưa đối chiếu đủ đơn thật/);
  assert.equal(breakdownView(presets, mk).verifiedNote, '');
});
