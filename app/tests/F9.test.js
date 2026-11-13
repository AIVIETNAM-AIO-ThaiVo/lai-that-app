// F9 — Flash Sale & giá nhập tối đa (1-wiki/features/F9-flash-sale-gia-nhap.md)
import { test } from 'node:test';
import assert from 'node:assert/strict';
import presets from '../assets/fee_presets.json' with { type: 'json' };
import config from '../assets/app_config.json' with { type: 'json' };
import { flashView } from '../calc.js';
import { isLocked, defaultState } from '../store.js';

const mk = { platform: 'shopee', categoryRate: 0.16, price: 17000, cost: 8000, pack: 1500 };

test('Flash Sale từ 22.900đ: 10% / 20% / 30%', () => {
  const v = flashView(presets, mk, 22900, 0.2);
  assert.deepEqual(v.rows.map((r) => [r.label, r.profitText, r.stateText]), [
    ['Giảm 10% → 20.610đ', '3.267đ', 'Lãi 15,8%'],
    ['Giảm 20% → 18.320đ', '1.515đ', 'Mỏng 8,3%'],
    ['Giảm 30% → 16.030đ', '−237đ', 'Lỗ'],
  ]);
  assert.equal(v.title, 'Nếu chạy Flash Sale từ 22.900đ');
});

test('giá nhập tối đa 8.438đ giữ lãi 20% ở 22.900đ', () => {
  const v = flashView(presets, mk, 22900, 0.2);
  assert.equal(v.maxCostText, 'Giá nhập tối đa: 8.438đ');
  assert.match(v.maxCostNote, /Bán 22\.900đ mà vẫn giữ lãi 20%/);
});

test('khoá Pro: chỉ khoá khi bật cờ; Pro hoặc quảng cáo thưởng thì mở', () => {
  const s = defaultState();
  // Phase 8 (decisions 13/11): cờ đã bật trong app_config; khi tắt cờ thì không khoá.
  assert.equal(isLocked('flash_sale', s, { ...config, pro_gates_enabled: false }), false);
  const on = { ...config, pro_gates_enabled: true };
  assert.equal(isLocked('flash_sale', s, on), true);
  assert.equal(isLocked('flash_sale', { ...s, pro: true }, on), false);
  assert.equal(isLocked('max_cost', { ...s, rewardedUnlocks: ['max_cost'] }, on), false);
});
