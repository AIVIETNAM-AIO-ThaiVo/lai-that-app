// F11 — Báo động khi sàn đổi phí (1-wiki/features/F11-bao-dong-doi-phi.md)
import { test } from 'node:test';
import assert from 'node:assert/strict';
import presets from '../assets/fee_presets.json' with { type: 'json' };
import { diffCatalog, changedPlatforms } from '../calc.js';
import { defaultState, saveProduct, applyFeeUpdate } from '../store.js';
import { EXAMPLES } from '../examples.js';

const next = (mut) => { const p = structuredClone(presets); mut(p); return p; };
const raised = next((p) => { p.fee_version = '2026-11-14.1'; p.platforms.shopee.transaction_fee.rate = 0.09; });

function catalog() {
  let s = defaultState();
  for (const ex of EXAMPLES) s = saveProduct(s, ex.name, ex.input, presets, 1).state;
  return s;
}

test('phí giao dịch Shopee 6% → 9%: móc khóa chuyển sang lỗ, kèm giá gợi ý mới', () => {
  const d = diffCatalog(catalog().products, presets, raised);
  assert.deepEqual(d.map((x) => x.name), ['Móc khóa']);
  assert.equal(Math.round(d[0].before), 505);
  assert.ok(d[0].after < 0);
  assert.ok(d[0].suggested > 22900);
  assert.deepEqual(changedPlatforms(presets, raised), ['shopee']);
});

test('ngành dùng % mặc định thì theo biểu phí mới; % tự sửa thì giữ', () => {
  const cat = next((p) => { p.fee_version = '2026-11-14.2'; p.platforms.shopee.categories.find((c) => c.name === 'Sở thích & Sưu tầm').default = 0.2; });
  assert.deepEqual(diffCatalog(catalog().products, presets, cat).map((x) => x.name), ['Móc khóa']);
  let s = defaultState();
  s = saveProduct(s, 'Móc khóa tự sửa', { ...EXAMPLES[2].input, categoryCustom: true }, presets, 1).state;
  assert.deepEqual(diffCatalog(s.products, presets, cat), []);
});

test('nhận biểu phí mới: ghi cảnh báo + thông báo + event; cùng phiên bản thì không báo lại', () => {
  let s = { ...catalog(), seenFeeVersion: presets.fee_version };
  const r = applyFeeUpdate(s, presets, raised, 5);
  assert.equal(r.changed, true);
  s = r.state;
  assert.equal(s.seenFeeVersion, '2026-11-14.1');
  assert.equal(s.feeAlert.turnedLoss.length, 1);
  assert.match(s.feeAlert.text, /Biểu phí Shopee mới đã áp dụng · 1 sản phẩm chuyển sang lỗ/);
  assert.equal(s.notifications.length, 1);
  assert.deepEqual(s.events.at(-1), { name: 'fee_table_updated', params: { fee_version: '2026-11-14.1', products_turned_loss: 1 }, at: 5 });
  const again = applyFeeUpdate(s, raised, raised, 6);
  assert.equal(again.changed, false);
  assert.equal(again.state.notifications.length, 1);
});
