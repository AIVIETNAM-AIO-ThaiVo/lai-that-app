// F3 — Nhập chỉ số công tơ (1-wiki/features/F3-nhap-chi-so.md)
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { meterDelta, parseKwh, clampPeople } from '../logic.js';

test('4221 → 4521 = 300 kWh (kể cả số 0 đứng đầu)', () => {
  assert.deepEqual(meterDelta('4221', '4521', false), { ok: true, kwh: 300 });
  assert.deepEqual(meterDelta('04221', '04521', false), { ok: true, kwh: 300 });
});

test('chỉ số mới nhỏ hơn cũ → lỗi, trừ khi công tơ vừa được thay', () => {
  const bad = meterDelta('4221', '120', false);
  assert.equal(bad.ok, false);
  assert.equal(bad.field, 'new');
  assert.match(bad.error, /nhỏ hơn tháng trước/);
  assert.deepEqual(meterDelta('4221', '120', true), { ok: true, kwh: 120 });
});

test('chỉ số rỗng, chữ, số âm, số thập phân → lỗi', () => {
  assert.equal(meterDelta('4221', '', false).ok, false);
  assert.equal(meterDelta('', '4521', false).ok, false);
  assert.equal(meterDelta('abc', '4521', false).ok, false);
  assert.equal(meterDelta('4221', '45x1', false).ok, false);
  assert.equal(meterDelta('-5', '10', false).ok, false);
  assert.equal(meterDelta('4221.5', '4521', false).ok, false);
});

test('nhập thẳng số kWh', () => {
  assert.deepEqual(parseKwh('300'), { ok: true, kwh: 300 });
  assert.equal(parseKwh('').ok, false);
  assert.equal(parseKwh('-3').ok, false);
  assert.equal(parseKwh('3,5').ok, false);
});

test('số người trong khoảng 1–20', () => {
  assert.equal(clampPeople(0), 1);
  assert.equal(clampPeople(3), 3);
  assert.equal(clampPeople(21), 20);
});
