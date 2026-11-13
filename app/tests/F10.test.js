// F10 — Danh mục sản phẩm (1-wiki/features/F10-danh-muc.md)
import { test } from 'node:test';
import assert from 'node:assert/strict';
import presets from '../assets/fee_presets.json' with { type: 'json' };
import config from '../assets/app_config.json' with { type: 'json' };
import { catalogView } from '../calc.js';
import { defaultState, saveProduct, canSave, loadState, saveState, lossCountBucket } from '../store.js';
import { EXAMPLES } from '../examples.js';

function four() {
  let s = defaultState();
  for (const ex of EXAMPLES) s = saveProduct(s, ex.name, ex.input, presets, 1).state;
  return s;
}

test('lưu sản phẩm, còn sau khi tải lại', () => {
  const s = loadState(saveState(four()));
  assert.equal(s.products.length, 4);
  assert.ok(s.products.every((p) => p.id && p.name && p.input.price > 0));
});

test('sắp lãi thấp nhất lên đầu, giá gợi ý cho lỗ / lãi mỏng', () => {
  const v = catalogView(presets, four().products, 'all');
  assert.deepEqual(v.items.map((i) => [i.name, i.profitText, i.stateText]), [
    ['Kẹp tóc', '−1.380đ', 'Lỗ · −11,5%'],
    ['Ốp điện thoại', '−125đ', 'Lỗ · −0,5%'],
    ['Móc khóa', '505đ', 'Lãi mỏng · 3,0%'],
    ['Áo thun nữ', '41.061đ', 'Lãi · 27,6%'],
  ]);
  assert.equal(v.items[0].suggestedText, '18.900đ');
  assert.equal(v.items[1].suggestedText, '34.900đ');
  assert.equal(v.items[3].suggestedText, '');
  assert.equal(v.lossCount, 2);
  assert.equal(v.thinCount, 1);
  assert.deepEqual(catalogView(presets, four().products, 'loss').items.map((i) => i.name), ['Kẹp tóc', 'Ốp điện thoại']);
});

test('giới hạn 5 sản phẩm chỉ khi bật khoá Pro', () => {
  let s = four();
  s = saveProduct(s, 'Thứ năm', EXAMPLES[0].input, presets, 2).state;
  // Phase 8 (decisions 13/11): cờ đã bật trong app_config; khi tắt cờ thì không giới hạn.
  assert.equal(canSave(s, { ...config, pro_gates_enabled: false }), true);
  const on = { ...config, pro_gates_enabled: true };
  assert.equal(canSave(s, on), false);
  assert.equal(saveProduct(s, 'Thứ sáu', EXAMPLES[0].input, presets, 3, on).ok, false);
  assert.equal(canSave({ ...s, pro: true }, on), true);
});

test('event product_saved {catalog_size, state}; catalog_sorted_alert bucket', () => {
  const s = four();
  const ev = s.events.filter((e) => e.name === 'product_saved').map((e) => e.params);
  assert.deepEqual(ev.at(-1), { catalog_size: 4, state: 'good' });
  assert.equal(lossCountBucket(1), '1');
  assert.equal(lossCountBucket(3), '2–5');
  assert.equal(lossCountBucket(6), '>5');
});
