// F22 — Lãi của mỗi sản phẩm trên mọi sàn bạn bán (1-wiki/features/F22-lai-theo-tung-san.md)
import { test } from 'node:test';
import assert from 'node:assert/strict';
import presets from '../assets/fee_presets.json' with { type: 'json' };
import { calculate } from '../engine.js';
import { channelInput, channelsView, catalogView, compareView, diffCatalog } from '../calc.js';
import { defaultState, completeOnboarding, sellPlatforms, setSellPlatform, saveProduct, updateProduct } from '../store.js';
import { EXAMPLES } from '../examples.js';

const ALL = ['shopee', 'tiktok_shop', 'lazada'];
const mk = { ...EXAMPLES.find((e) => e.id === 'moc-khoa').input, platform: 'shopee' };
const prod = (id, input, channels) => ({ id, name: id, input, channels, savedAt: 1 });

test('sellPlatforms: "Nhiều sàn" → cả 3; 1 sàn → sàn đó; bật/tắt giữ ít nhất 1', () => {
  assert.deepEqual(sellPlatforms(completeOnboarding(defaultState(), 'multi')), ALL);
  let s = completeOnboarding(defaultState(), 'tiktok_shop');
  assert.deepEqual(sellPlatforms(s), ['tiktok_shop']);
  s = setSellPlatform(s, 'shopee', true);
  assert.deepEqual(sellPlatforms(s), ['shopee', 'tiktok_shop']);
  s = setSellPlatform(s, 'shopee', false);
  s = setSellPlatform(s, 'tiktok_shop', false);
  assert.deepEqual(sellPlatforms(s), ['tiktok_shop'], 'không tắt được sàn cuối cùng');
});

test('channelInput: tự gợi ý như màn So sánh; khớp số So sánh', () => {
  const tk = channelInput(presets, mk, 'tiktok_shop', undefined, null);
  assert.equal(tk.platform, 'tiktok_shop');
  assert.equal(tk.categoryName, 'Bách hóa');
  assert.equal(tk.categoryRate, 0.13);
  assert.equal(tk.price, 17000);
  const cmp = compareView(presets, mk, { lazadaRate: 0.1 });
  const card = (p) => cmp.cards.find((c) => c.platform === p);
  assert.equal(calculate(presets, tk).profit, card('tiktok_shop').profit);
  const lz = channelInput(presets, mk, 'lazada', undefined, 0.1);
  assert.equal(calculate(presets, lz).profit, card('lazada').profit);
  assert.equal(channelInput(presets, mk, 'lazada', undefined, null), null, 'Lazada chưa có % → chưa tính');
});

test('channelInput: kênh riêng (ngành, %, giá) được dùng', () => {
  const i = channelInput(presets, mk, 'tiktok_shop', { categoryName: 'Thời trang', categoryRate: 0.135, price: 19000 }, null);
  assert.equal(i.categoryRate, 0.135);
  assert.equal(i.price, 19000);
  assert.equal(i.cost, 8000, 'vốn dùng chung');
});

test('channelsView: một dòng cho mỗi sàn đang bán, sàn chính luôn có', () => {
  const rows = channelsView(presets, prod('a', mk), ALL, null);
  assert.deepEqual(rows.map((r) => r.platform), ALL);
  assert.equal(rows[0].primary, true);
  assert.equal(rows[2].ready, false);
  assert.match(rows[2].profitText, /cần % phí/);
  assert.match(rows[1].stateText, /Lãi|Lỗ/);
  const only = channelsView(presets, prod('b', mk), ['tiktok_shop'], null);
  assert.deepEqual(only.map((r) => r.platform), ['shopee', 'tiktok_shop']);
});

test('catalogView: sắp và lọc theo sàn tệ nhất; 1 sàn thì như cũ', () => {
  // Shopee lãi tốt nhưng TikTok giá thấp → lỗ
  const good = prod('good', { ...mk, price: 30000 }, { tiktok_shop: { categoryName: 'Bách hóa', categoryRate: 0.13, price: 9000 } });
  const single = catalogView(presets, [good], 'loss');
  assert.equal(single.items.length, 0, 'chỉ Shopee → không lỗ');
  const multi = catalogView(presets, [good], 'loss', { platforms: ALL, lazadaRate: null });
  assert.equal(multi.items.length, 1, 'lỗ ở TikTok → vào nhóm Đang lỗ');
  assert.equal(multi.lossCount, 1);
  const it = multi.items[0];
  assert.equal(it.channels.length, 3);
  assert.equal(it.worst.platform, 'tiktok_shop');
  assert.equal(it.state, 'good', 'trạng thái sàn chính giữ nguyên');
});

test('diffCatalog: báo sản phẩm chuyển lỗ ở sàn phụ (ngành theo biểu phí mới)', () => {
  const p = prod('x', mk); // TikTok chưa nhập → theo gợi ý "Bách hóa" của biểu phí hiện hành
  const bump = structuredClone(presets);
  bump.platforms.tiktok_shop.categories.find((c) => c.name === 'Bách hóa').default = 0.3;
  const before = calculate(presets, channelInput(presets, mk, 'tiktok_shop', undefined, null)).profit;
  const after = calculate(bump, channelInput(bump, mk, 'tiktok_shop', undefined, null)).profit;
  assert.ok(before >= 0 && after < 0, `${before} → ${after}`);
  assert.equal(diffCatalog([p], presets, bump).length, 0, 'chỉ sàn chính (Shopee không đổi) → không báo');
  const out = diffCatalog([p], presets, bump, { platforms: ALL });
  assert.equal(out.length, 1);
  assert.equal(out[0].platform, 'tiktok_shop');
});

test('lưu / sửa sản phẩm giữ các kênh', () => {
  const ch = { tiktok_shop: { categoryName: 'Thời trang', categoryRate: 0.135, price: 19000 } };
  let s = saveProduct(defaultState(), 'Móc khóa', mk, presets, 1, undefined, { channels: ch }).state;
  assert.deepEqual(s.products[0].channels, ch);
  const ch2 = { ...ch, lazada: { categoryName: 'Tự nhập % hoa hồng', categoryRate: 0.1, price: 18000 } };
  s = updateProduct(s, s.products[0].id, 'Móc khóa', mk, 2, ch2);
  assert.deepEqual(s.products[0].channels, ch2);
  s = updateProduct(s, s.products[0].id, 'Móc khóa 2', mk, 3);
  assert.deepEqual(s.products[0].channels, ch2, 'không truyền kênh → giữ kênh cũ');
});
