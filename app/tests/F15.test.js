// F15 — Ví dụ mẫu lần đầu (1-wiki/features/F15-vi-du-mau.md)
import { test } from 'node:test';
import assert from 'node:assert/strict';
import presets from '../assets/fee_presets.json' with { type: 'json' };
import { calculate } from '../engine.js';
import { EXAMPLES, QUICK_EXAMPLES } from '../examples.js';
import { defaultState, loadExamples } from '../store.js';

test('ví dụ khớp ca kiểm thử: kẹp tóc −1.380, ốp −125, móc khóa 505, áo thun 41.061', () => {
  const r = Object.fromEntries(EXAMPLES.map((e) => [e.name, Math.round(calculate(presets, e.input).profit)]));
  assert.deepEqual(r, { 'Kẹp tóc': -1380, 'Ốp điện thoại': -125, 'Móc khóa': 505, 'Áo thun nữ': 41061 });
});

test('3 ví dụ nhanh: Móc khóa 17.000đ, Áo thun 149.000đ, Kẹp tóc 12.000đ', () => {
  assert.deepEqual(QUICK_EXAMPLES.map((e) => [e.name, e.input.price]), [['Móc khóa', 17000], ['Áo thun nữ', 149000], ['Kẹp tóc', 12000]]);
});

test('thêm 4 sản phẩm mẫu, đánh dấu "mẫu"', () => {
  const s = loadExamples(defaultState(), presets, 1);
  assert.equal(s.products.length, 4);
  assert.ok(s.products.every((p) => p.sample === true));
  assert.deepEqual(s.products.map((p) => p.name), ['Kẹp tóc', 'Ốp điện thoại', 'Móc khóa', 'Áo thun nữ']);
});
