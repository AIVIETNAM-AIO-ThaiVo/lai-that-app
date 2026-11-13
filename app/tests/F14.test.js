// F14 — Chia sẻ kết quả qua Zalo (1-wiki/features/F14-chia-se-zalo.md)
import { test } from 'node:test';
import assert from 'node:assert/strict';
import presets from '../assets/fee_presets.json' with { type: 'json' };
import { shareText } from '../calc.js';
import { track, defaultState } from '../store.js';

const mk = { platform: 'shopee', categoryName: 'Sở thích & Sưu tầm', categoryRate: 0.16, price: 17000, cost: 8000, pack: 1500 };

test('nội dung chia sẻ đủ thông tin, có ngày biểu phí và tên app', () => {
  const t = shareText(presets, mk, 'Móc khóa');
  for (const s of ['Móc khóa', 'Shopee', 'Sở thích & Sưu tầm 16%', 'Giá bán 17.000đ', 'giá vốn 8.000đ', 'Lãi mỗi đơn: 505đ (Lãi mỏng 3,0%)',
    'Sàn + thuế lấy 41% giá bán', 'Giá nên bán để lãi 20%: 22.900đ', 'Biểu phí Shopee cập nhật 12/11/2026', 'Tính bằng Lãi Thật']) {
    assert.ok(t.includes(s), `thiếu "${s}"\n${t}`);
  }
});

test('event share_result chỉ có channel', () => {
  const s = track(defaultState(), 'share_result', { channel: 'other', price: 17000, text: 'x' }, 1);
  assert.deepEqual(s.events[0].params, { channel: 'other' });
});
