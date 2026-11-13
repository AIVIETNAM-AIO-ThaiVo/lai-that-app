// F28 — Combo (1-wiki/features/F28-combo.md). Ca kiểm thử chung với tools/addons.py: app/test/addon_vectors.json
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import presets from '../assets/fee_presets.json' with { type: 'json' };
import V from '../test/addon_vectors.json' with { type: 'json' };
import {
  combo, separate, comboMaxDiscount, comboPriceForMargin, comboView, shopeeMinNote, SAMPLE_COMBO, resolveItems, combosCatalog, diffCombos,
  comboEventParams,
} from '../addons.js';
import { defaultState, saveProduct, saveCombo, removeProduct, applyFeeUpdate, EVENT_PARAMS } from '../store.js';
import { readPlan } from './tracking-plan.mjs';

const APP = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const near = (a, b, tol = 0.5) => assert.ok(Math.abs(a - b) <= tol, `${a} ≠ ${b}`);
const kw = (k) => ({ ...k, programs: k.programs ?? [] });

test('mọi ca combo khớp tools/addons.py tới 0,5đ (CB2, CB3, CB6, CB7)', () => {
  assert.ok(V.combos.length >= 9);
  for (const c of V.combos) {
    const r = combo(presets, c.items, c.discount, kw(c.kw));
    near(r.price, c.expect.price);
    near(r.profit, c.expect.profit);
    near(r.margin, c.expect.margin, 1e-6);
    near(r.vx, c.expect.vx);
    near(separate(presets, c.items, kw(c.kw)), c.expect.separate);
  }
});

test('giảm tối đa giữ lãi 20% / 10% / hòa vốn khớp (CB4); giá combo cho lãi 20% (CB5)', () => {
  for (const m of V.max_discount) near(comboMaxDiscount(presets, m.items, m.m, kw(m.kw)), m.expect, 1e-6);
  const mk = V.max_discount[0].items;
  const p = comboPriceForMargin(presets, mk, 0.2, { pack: 1500 });
  near(p.price, 50442, 1);
  assert.equal(p.nice, 50900);
});

test('giảm 100% hoặc giá ≤ 0 → báo lỗi nhập (CB8)', () => {
  const mk = V.max_discount[0].items;
  assert.throws(() => combo(presets, mk, ['percent', 1]));
  assert.throws(() => combo(presets, mk, ['fixed', 0]));
  const v = comboView(presets, { ...SAMPLE_COMBO, discount: ['amount', 60000] });
  assert.equal(v.ok, false);
  assert.match(v.error, /lớn hơn 0/);
});

test('ví dụ mẫu C0: 45.900đ, lãi 6.614đ · 14,4%, bán lẻ 1.515đ, combo +5.099đ, sàn lấy 30% thay vì 41%', () => {
  const v = comboView(presets, SAMPLE_COMBO);
  assert.equal(v.priceText, '45.900đ');
  assert.equal(v.profitText, '6.614đ');
  assert.equal(v.marginText, '14,4%');
  assert.equal(v.compareText, 'Bán lẻ 3 đơn: 1.515đ');
  assert.equal(v.upliftText, 'Combo +5.099đ');
  assert.equal(v.takeText, 'Sàn + thuế lấy 30% thay vì 41% khi bán lẻ');
  assert.deepEqual(v.maxDiscText, { m20: '1%', m10: '15%', m0: '26%' }, 'làm tròn xuống % nguyên');
  assert.equal(v.suggestText, '50.900đ');
  assert.match(v.atMin, /Giảm 5% \(mức thấp nhất Shopee cho phép\) thì lãi còn 17,7%/);
  const per = Object.fromEntries(v.lines.map((l) => [l.key, l.per]));
  assert.equal(per.cat, 'mỗi SP');
  assert.equal(per.per_order, 'mỗi đơn');
});

test('mức tối thiểu Shopee: giảm 5% hoặc 10.000đ, từ 2 sản phẩm', () => {
  const mk = V.max_discount[0].items;
  assert.equal(shopeeMinNote('shopee', mk, ['percent', 0.1]), '');
  assert.match(shopeeMinNote('shopee', mk, ['percent', 0.02]), /tối thiểu 5% hoặc 10\.000đ/);
  assert.match(shopeeMinNote('shopee', [{ ...mk[0], qty: 1 }], ['percent', 0.1]), /từ 2 sản phẩm/);
  assert.equal(shopeeMinNote('lazada', mk, ['percent', 0.02]), '');
});

test('chế độ Mua kèm: áo một mình 47.240đ, thêm móc khóa 48.344đ (CB6); Sản phẩm bộ chặn voucher một lần (CB7)', () => {
  const ao = { name: 'Áo thun', cost: 60000, price: 149000, cat: 0.165, qty: 1 };
  const mk1 = { name: 'Móc khóa', cost: 8000, price: 11900, cat: 0.16, qty: 1 };
  const v = comboView(presets, { mode: 'addon', platform: 'shopee', pack: 3000, items: [ao, mk1], discount: null });
  assert.equal(v.compareText, 'Món chính một mình: 47.240đ');
  assert.equal(v.upliftText, 'Thêm món mua kèm +1.104đ');
  const big = { name: 'Nồi', cost: 600000, price: 1200000, cat: 0.1, qty: 2 };
  const promo = comboView(presets, { mode: 'promo', platform: 'shopee', pack: 5000, programs: ['voucher_xtra'], items: [big], discount: null });
  const bundle = comboView(presets, { mode: 'bundle', platform: 'shopee', pack: 5000, programs: ['voucher_xtra'], items: [big], discount: null });
  near(promo.r.vx, 100000);
  near(bundle.r.vx, 50000);
});

test('lưu combo vào danh mục: "Bộ · N món", liên kết món theo id, xoá món gốc giữ bản sao', () => {
  let s = defaultState();
  const base = { platform: 'shopee', categoryRate: 0.16, price: 17000, cost: 8000, programs: [], vat: true, pit: true };
  let r = saveProduct(s, 'Móc khóa', base, presets, 1);
  s = r.state;
  const pid = r.id;
  const rec = { name: '3 móc khóa', mode: 'promo', platform: 'shopee', pack: 1500, discount: ['percent', 0.1], items: [{ productId: pid, name: 'Móc khóa', cost: 8000, price: 17000, cat: 0.16, qty: 3 }] };
  r = saveCombo(s, rec, 2);
  s = r.state;
  assert.equal(s.combos.length, 1);
  assert.deepEqual(s.events.at(-1), { name: 'combo_saved', params: { items_count: 3, mode: 'promo' }, at: 2 });
  let row = combosCatalog(presets, s.combos, s.products)[0];
  assert.match(row.meta, /^Bộ · 3 món/);
  assert.equal(row.profitText, '6.614đ');
  // sửa giá vốn sản phẩm → combo tính lại
  s = { ...s, products: s.products.map((p) => ({ ...p, input: { ...p.input, cost: 9000 } })) };
  row = combosCatalog(presets, s.combos, s.products)[0];
  assert.ok(row.profit < 6614 - 2900 && row.profit > 6614 - 3100, String(row.profit));
  // xoá sản phẩm → combo giữ bản sao, ghi món gốc đã xoá
  s = removeProduct(s, pid);
  const items = resolveItems(s.combos[0], s.products);
  assert.equal(items[0].orphan, true);
  assert.equal(combosCatalog(presets, s.combos, s.products)[0].orphan, true);
});

test('báo động đổi phí phủ cả combo', () => {
  let s = defaultState();
  s = saveCombo(s, { ...SAMPLE_COMBO, discount: ['percent', 0.25] }, 1).state;
  const hike = structuredClone(presets);
  hike.fee_version = '2099-01-01.1';
  hike.platforms.shopee.transaction_fee.rate = 0.09;
  assert.equal(diffCombos(s.combos, [], presets, hike).length, 1);
  const r = applyFeeUpdate({ ...s, seenFeeVersion: presets.fee_version }, presets, hike, 5);
  assert.equal(r.state.feeAlert.turnedLoss.length, 1);
  assert.equal(r.state.feeAlert.turnedLoss[0].combo, true);
});

test('tracking combo đúng tracking plan, không gửi giá/tên', () => {
  const plan = readPlan();
  for (const e of ['combo_built', 'combo_vs_separate_viewed', 'combo_max_discount_viewed', 'combo_saved']) {
    assert.ok(EVENT_PARAMS[e], e);
    assert.ok(plan.byName.has(e), e);
    for (const p of EVENT_PARAMS[e]) assert.ok(!/price|name|cost/.test(p), p);
  }
  assert.ok(plan.byName.get('paywall_view').values.includes('combo_tab'));
  const v = comboView(presets, SAMPLE_COMBO);
  assert.deepEqual(comboEventParams(SAMPLE_COMBO, v), { platform: 'shopee', mode: 'promo', items_count: 3, discount_type: 'percent', margin_bucket: '10–20' });
});
