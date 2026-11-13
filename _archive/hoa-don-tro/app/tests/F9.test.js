// F9 — Lịch sử hóa đơn trên máy (1-wiki/features/F9-lich-su.md)
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { upsertHistory, loadState, saveState, defaultState } from '../store.js';

const bill = (room, period, total) => ({ room, period, kwh: 300, total, mode: 'A', people: 3, role: 'tenant' });

test('lưu mới nhất trước; cùng phòng + kỳ thì thay bản cũ', () => {
  let h = [];
  h = upsertHistory(h, bill('P203', '2026-10', 700000), 1);
  h = upsertHistory(h, bill('P203', '2026-11', 808218), 2);
  assert.deepEqual(h.map((x) => x.period), ['2026-11', '2026-10']);
  h = upsertHistory(h, bill('P203', '2026-10', 650000), 3);
  assert.equal(h.length, 2);
  assert.equal(h[0].period, '2026-10');
  assert.equal(h[0].total, 650000);
  assert.ok(h.every((x) => x.id && x.savedAt));
});

test('giữ tối đa 50 bản', () => {
  let h = [];
  for (let i = 0; i < 60; i++) h = upsertHistory(h, bill(`P${i}`, '2026-11', i), i);
  assert.equal(h.length, 50);
  assert.equal(h[0].room, 'P59');
});

test('lưu và đọc lại (localStorage) giữ nguyên lịch sử; dữ liệu hỏng → trạng thái đầu', () => {
  const s = { ...defaultState(), role: 'tenant', history: upsertHistory([], bill('P203', '2026-11', 808218), 1) };
  const back = loadState(saveState(s));
  assert.equal(back.history.length, 1);
  assert.equal(back.history[0].total, 808218);
  assert.deepEqual(loadState('{hỏng'), defaultState());
  assert.deepEqual(loadState(null), defaultState());
});
