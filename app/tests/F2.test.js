// F2 — Biểu phí, nguồn và miễn trừ (1-wiki/features/F2-bieu-phi-nguon.md)
import { test } from 'node:test';
import assert from 'node:assert/strict';
import presets from '../assets/fee_presets.json' with { type: 'json' };
import { pickPresets, newerVersion, categoriesFor, feeDateLabel, DISCLAIMER } from '../presets.js';
import { calculate } from '../engine.js';
import { defaultState, track } from '../store.js';

const v = (fee_version) => ({ ...presets, fee_version });

test('chọn bản mới nhất giữa máy chủ, cache, bản đóng gói', () => {
  assert.equal(pickPresets({ remote: v('2026-11-13.1'), cache: v('2026-11-12.1'), bundled: presets }).fee_version, '2026-11-13.1');
  assert.equal(pickPresets({ remote: null, cache: v('2026-11-13.2'), bundled: presets }).fee_version, '2026-11-13.2');
  assert.equal(pickPresets({ remote: null, cache: null, bundled: presets }).fee_version, '2026-11-12.1');
  assert.equal(pickPresets({ remote: { broken: true }, cache: null, bundled: presets }).fee_version, '2026-11-12.1');
  assert.ok(newerVersion('2026-11-12.10', '2026-11-12.9'));
  assert.ok(!newerVersion('2026-11-12.1', '2026-11-12.1'));
});

test('31 ngành Shopee; ngành chưa có % bắt người dùng nhập', () => {
  assert.equal(categoriesFor(presets, 'shopee').length, 31);
  assert.equal(categoriesFor(presets, 'shopee').find((c) => c.name === 'Sở thích & Sưu tầm').rate, 0.16);
  assert.equal(categoriesFor(presets, 'lazada')[0].rate, null);
  assert.equal(categoriesFor(presets, 'tiktok_shop').at(-1).rate, null);
});

test('dòng "Biểu phí … cập nhật …" và miễn trừ không liên kết', () => {
  assert.equal(feeDateLabel(presets, 'shopee'), 'Biểu phí Shopee cập nhật 12/11/2026');
  assert.match(DISCLAIMER, /không liên kết với Shopee, TikTok hay Lazada/);
});

test('sửa % ngành, % giao dịch, phí mỗi đơn đổi kết quả', () => {
  const base = { platform: 'shopee', categoryRate: 0.16, price: 17000, cost: 8000, pack: 1500 };
  const a = calculate(presets, base).profit;
  assert.ok(calculate(presets, { ...base, categoryRate: 0.17 }).profit < a);
  assert.equal(Math.round(calculate(presets, { ...base, transactionOverride: 0.05 }).profit - a), 170);
  assert.equal(Math.round(calculate(presets, { ...base, fixedOverride: 2550 }).profit - a), 450);
});

test('event fee_override và fee_report_sent có trong tracking', () => {
  const s = track(defaultState(), 'fee_override', { platform: 'shopee', field: 'category' }, 1);
  const t = track(s, 'fee_report_sent', { platform: 'shopee', field: 'transaction' }, 2);
  assert.deepEqual(t.events.map((e) => e.name), ['fee_override', 'fee_report_sent']);
});
