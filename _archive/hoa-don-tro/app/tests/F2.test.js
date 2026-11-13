// F2 — Onboarding chọn vai (1-wiki/features/F2-chon-vai.md)
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { defaultState, initialRoute, completeOnboarding, track } from '../store.js';
import { DISCLAIMER_SHORT } from '../content.js';

test('trạng thái đầu: chưa có vai, chưa đồng ý analytics → màn chọn vai', () => {
  const s = defaultState();
  assert.equal(s.role, null);
  assert.equal(s.consent.analytics, false);
  assert.equal(initialRoute(s), '#/chon-vai');
});

test('chọn vai → màn chính đúng vai, nhớ được sau khi tải lại', () => {
  const t = completeOnboarding(defaultState(), 'tenant', false, 1);
  assert.equal(t.role, 'tenant');
  assert.equal(initialRoute(t), '#/nhap');
  const reloaded = JSON.parse(JSON.stringify(t));
  assert.equal(initialRoute(reloaded), '#/nhap');
  const l = completeOnboarding(defaultState(), 'landlord', false, 1);
  assert.equal(initialRoute(l), '#/nha-tro');
  assert.throws(() => completeOnboarding(defaultState(), 'admin', false, 1));
});

test('onboarding_completed chỉ ghi khi đã đồng ý analytics', () => {
  const no = completeOnboarding(defaultState(), 'tenant', false, 1);
  assert.equal(no.events.length, 0);
  const yes = completeOnboarding(defaultState(), 'landlord', true, 1);
  assert.deepEqual(yes.events.map((e) => [e.name, e.params.role]), [['onboarding_completed', 'landlord']]);
  assert.equal(track(defaultState(), 'onboarding_completed', { role: 'tenant' }, 1).events.length, 0);
});

test('màn onboarding có dòng miễn trừ "không phải ứng dụng của EVN"', () => {
  assert.match(DISCLAIMER_SHORT, /không phải ứng dụng của EVN/);
});
