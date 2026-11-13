// F3 — Chọn sàn chính (1-wiki/features/F3-chon-san.md)
import { test } from 'node:test';
import assert from 'node:assert/strict';
import presets from '../assets/fee_presets.json' with { type: 'json' };
import { platformOptions } from '../presets.js';
import { defaultState, completeOnboarding, initialRoute, loadState, saveState } from '../store.js';

test('4 lựa chọn, mỗi lựa chọn có ngày biểu phí', () => {
  const o = platformOptions(presets);
  assert.deepEqual(o.map((x) => x.id), ['shopee', 'tiktok_shop', 'lazada', 'multi']);
  assert.equal(o[0].note, 'Biểu phí từ 23/05/2026 · 31 ngành');
  assert.equal(o[1].note, 'Biểu phí từ 09/05/2026');
  assert.equal(o[2].note, 'Bạn tự nhập % hoa hồng');
  assert.equal(o[3].note, 'Mở sẵn màn so sánh');
});

test('chưa chọn → màn chọn sàn; chọn rồi → Tính lãi, nhớ sau khi tải lại', () => {
  assert.equal(initialRoute(defaultState()), '#/chon-san');
  const s = completeOnboarding(defaultState(), 'tiktok_shop', 1);
  assert.equal(s.platform, 'tiktok_shop');
  assert.equal(initialRoute(loadState(saveState(s))), '#/tinh');
  assert.equal(completeOnboarding(defaultState(), 'multi', 1).calc.platform, 'shopee');
  assert.throws(() => completeOnboarding(defaultState(), 'amazon', 1));
});

test('event onboarding_completed {primary_platform}; chỉ shop thường (bỏ Mall)', () => {
  const s = completeOnboarding(defaultState(), 'multi', 1);
  assert.deepEqual(s.events[0], { name: 'onboarding_completed', params: { primary_platform: 'multi' }, at: 1 });
  assert.equal(s.shopType, 'standard');
  assert.equal(loadState(JSON.stringify({ ...defaultState(), platform: 'shopee', shopType: 'mall' })).shopType, 'standard');
});
