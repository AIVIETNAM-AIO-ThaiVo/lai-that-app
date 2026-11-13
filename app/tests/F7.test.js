// F7 — So sánh sàn (1-wiki/features/F7-so-sanh-san.md)
import { test } from 'node:test';
import assert from 'node:assert/strict';
import presets from '../assets/fee_presets.json' with { type: 'json' };
import { compareView, suggestCompareCategory } from '../calc.js';

const mk = { platform: 'shopee', categoryName: 'Sở thích & Sưu tầm', categoryRate: 0.16, price: 17000, cost: 8000, pack: 1500 };

test('móc khóa: TikTok 1.015đ (6,0%) đứng đầu, Shopee 505đ (3,0%) kém 510đ/đơn', () => {
  const v = compareView(presets, mk, { tiktok: { name: 'Bách hóa', rate: 0.13 }, lazadaRate: null, orders: 300 });
  const ready = v.cards.filter((c) => c.ready);
  assert.deepEqual(ready.map((c) => c.platform), ['tiktok_shop', 'shopee']);
  assert.equal(ready[0].profitText, '1.015đ');
  assert.equal(ready[0].stateText, 'Lãi mỏng · 6,0%');
  assert.equal(ready[1].profitText, '505đ');
  assert.equal(ready[1].stateText, 'Lãi mỏng · 3,0%');
  assert.equal(ready[1].diffText, 'kém 510đ/đơn');
  assert.equal(ready[0].diffText, '');
  assert.equal(v.best, 'tiktok_shop');
  assert.equal(v.monthlyText, 'Bán 300 đơn mỗi tháng, chênh nhau 153.000đ.');
});

test('Lazada chưa có % hoa hồng → chưa tính, cần nhập; nhập rồi thì tính', () => {
  const a = compareView(presets, mk, { tiktok: { name: 'Bách hóa', rate: 0.13 }, lazadaRate: null, orders: 300 });
  assert.equal(a.cards.find((c) => c.platform === 'lazada').ready, false);
  const b = compareView(presets, mk, { tiktok: { name: 'Bách hóa', rate: 0.13 }, lazadaRate: 0.1, orders: 300 });
  const lz = b.cards.find((c) => c.platform === 'lazada');
  assert.equal(lz.ready, true);
  assert.equal(Math.round(lz.profit), Math.round(17000 - 1700 - 1020 - 3000 - 255 - 9500));
});

test('ghi chú TikTok MST; ngành TikTok gợi ý có nhãn để người dùng kiểm tra', () => {
  const v = compareView(presets, mk, { tiktok: null, lazadaRate: null, orders: 300 });
  assert.match(v.tiktokNote, /chưa đăng ký MST/);
  assert.match(v.tiktokNote, /Sửa trong từng dòng phí/);
  assert.deepEqual(suggestCompareCategory('Thời Trang Nữ'), 'Thời trang');
  assert.deepEqual(suggestCompareCategory('Sắc Đẹp'), 'Sức khỏe & Làm đẹp');
  assert.deepEqual(suggestCompareCategory('Sở thích & Sưu tầm'), 'Bách hóa');
});
