// F16 — Áp giá gợi ý 1 chạm (1-wiki/features/F16-ap-gia-hang-loat.md)
import { test } from 'node:test';
import assert from 'node:assert/strict';
import presets from '../assets/fee_presets.json' with { type: 'json' };
import { catalogView } from '../calc.js';
import { defaultState, loadExamples, applySuggested } from '../store.js';

test('áp giá gợi ý cho 2 sản phẩm lỗ: 18.900đ, 34.900đ; giữ nguyên đầu vào khác; hết lỗ', () => {
  const s0 = loadExamples(defaultState(), presets, 1);
  const loss = catalogView(presets, s0.products, 'loss').items.map((i) => i.id);
  assert.equal(loss.length, 2);
  const r = applySuggested(s0, loss, presets, 2);
  assert.equal(r.changed, 2);
  const byName = Object.fromEntries(r.state.products.map((p) => [p.name, p.input]));
  assert.equal(byName['Kẹp tóc'].price, 18900);
  assert.equal(byName['Ốp điện thoại'].price, 34900);
  assert.equal(byName['Kẹp tóc'].cost, 6000);
  assert.equal(catalogView(presets, r.state.products, 'all').lossCount, 0);
  assert.ok(catalogView(presets, r.state.products, 'all').items.every((i) => i.margin >= 0.2 || i.state === 'good' || i.name === 'Móc khóa'));
  assert.deepEqual(r.undo, s0.products, 'giữ bản cũ để hoàn tác');
});
