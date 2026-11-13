// F23 — Áp giá gợi ý theo từng sàn (1-wiki/features/F23-ap-gia-goi-y-theo-san.md)
import { test } from 'node:test';
import assert from 'node:assert/strict';
import presets from '../assets/fee_presets.json' with { type: 'json' };
import { calculate } from '../engine.js';
import { channelsView, channelInput, suggestedPrice, catalogView } from '../calc.js';
import { defaultState, loadExamples, applySuggested } from '../store.js';
import { EXAMPLES } from '../examples.js';

const ALL = ['shopee', 'tiktok_shop', 'lazada'];
const kep = (s) => s.products.find((p) => p.name === 'Kẹp tóc');

test('channelsView có giá gợi ý (sugPrice) cho sàn chưa lãi tốt', () => {
  const s = loadExamples(defaultState(), presets, 1);
  const rows = channelsView(presets, kep(s), ALL, null);
  const tk = rows.find((r) => r.platform === 'tiktok_shop');
  assert.equal(tk.state, 'loss');
  assert.equal(tk.sugPrice, suggestedPrice(presets, tk.input));
  assert.ok(tk.sugPrice > 12000);
  assert.equal(rows.find((r) => r.platform === 'lazada').sugPrice ?? null, null, 'chưa có % phí → không gợi ý');
});

test('chỉ chọn TikTok: đổi giá riêng TikTok, giá Shopee giữ nguyên', () => {
  const s0 = loadExamples(defaultState(), presets, 1);
  const p0 = kep(s0);
  const sugTk = suggestedPrice(presets, channelInput(presets, p0.input, 'tiktok_shop', undefined, null));
  const r = applySuggested(s0, [p0.id], presets, 2, { platforms: ['tiktok_shop'], lazadaRate: null });
  const p = kep(r.state);
  assert.equal(r.changed, 1);
  assert.equal(p.input.price, 12000);
  assert.equal(p.channels.tiktok_shop.price, sugTk);
  const after = calculate(presets, channelInput(presets, p.input, 'tiktok_shop', p.channels.tiktok_shop, null));
  assert.notEqual(after.state, 'loss');
  assert.deepEqual(r.undo, s0.products);
});

test('chọn Shopee + TikTok: đổi cả hai; Shopee 18.900đ như F16', () => {
  const s0 = loadExamples(defaultState(), presets, 1);
  const r = applySuggested(s0, [kep(s0).id], presets, 2, { platforms: ['shopee', 'tiktok_shop'], lazadaRate: null });
  const p = kep(r.state);
  assert.equal(p.input.price, 18900);
  assert.ok(p.channels.tiktok_shop.price > 12000);
  const v = catalogView(presets, r.state.products.filter((x) => x.id === p.id), 'all', { platforms: ALL, lazadaRate: null });
  assert.ok(v.items[0].channels.filter((c) => c.ready).every((c) => c.state !== 'loss'));
});

test('sàn đang lãi tốt giữ giá; giữ ngành đã nhập của kênh', () => {
  const mk = { ...EXAMPLES.find((e) => e.id === 'moc-khoa').input, platform: 'shopee', price: 30000 };
  const ch = { tiktok_shop: { categoryName: 'Thời trang', categoryRate: 0.135, price: 9000 } };
  const s0 = { ...defaultState(), products: [{ id: 'x', name: 'x', input: mk, channels: ch, savedAt: 1 }] };
  const r = applySuggested(s0, ['x'], presets, 2, { platforms: ALL, lazadaRate: null });
  const p = r.state.products[0];
  assert.equal(p.input.price, 30000, 'Shopee đang lãi tốt → giữ giá');
  assert.equal(p.channels.tiktok_shop.categoryName, 'Thời trang');
  assert.ok(p.channels.tiktok_shop.price > 9000);
});
