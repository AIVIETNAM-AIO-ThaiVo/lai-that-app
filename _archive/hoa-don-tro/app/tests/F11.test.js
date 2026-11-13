// F11 — Chủ Trọ Pro, quảng cáo, analytics (1-wiki/features/F11-pro-quang-cao-analytics.md)
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  PLANS, EVENTS, defaultState, completeOnboarding, addRoom, canAddRoom, purchasePro, grantRewardedRoom,
  shouldShowInterstitial, recordExport, markInterstitial, track,
} from '../store.js';

const room = (name) => ({ name, people: 1, declared: false, oldReading: '0', newReading: '10' });
const T0 = Date.UTC(2026, 10, 12, 3, 0, 0); // 10:00 giờ VN

test('gói Pro: năm 399.000đ (tiết kiệm 32%), tháng 49.000đ', () => {
  assert.equal(PLANS.year.price, 399000);
  assert.equal(PLANS.month.price, 49000);
  assert.equal(PLANS.year.savePct, 32);
  assert.match(PLANS.renewNote, /Tự gia hạn/);
  assert.match(PLANS.renewNote, /hủy/);
});

test('mua Pro (chế độ thử) → thêm được phòng thứ 4, không quảng cáo', () => {
  let s = completeOnboarding(defaultState(), 'landlord', true, 1);
  for (const n of ['P101', 'P102', 'P103']) s = addRoom(s, room(n), 2).state;
  assert.equal(canAddRoom(s), false);
  s = purchasePro(s, 'year', 3);
  assert.equal(s.plan.pro, true);
  assert.equal(canAddRoom(s), true);
  assert.equal(addRoom(s, room('P104'), 4).ok, true);
  assert.deepEqual(s.events.at(-1), { name: 'purchase_completed', params: { plan: 'landlord_pro', period: 'year' }, at: 3 });
});

test('xem quảng cáo tự chọn mở thêm 1 phòng tạm', () => {
  let s = completeOnboarding(defaultState(), 'landlord', false, 1);
  for (const n of ['P101', 'P102', 'P103']) s = addRoom(s, room(n), 2).state;
  s = grantRewardedRoom(s, 5);
  assert.equal(canAddRoom(s), true);
  s = addRoom(s, room('P104'), 6).state;
  assert.equal(canAddRoom(s), false);
});

test('quảng cáo xen kẽ: không ở lần xuất ảnh đầu trong ngày, tối đa 1 lần / 3 phút, không cho Pro', () => {
  let ads = defaultState().ads;
  assert.equal(shouldShowInterstitial(ads, T0, false), false, 'lần 1 trong ngày');
  ads = recordExport(ads, T0);
  assert.equal(shouldShowInterstitial(ads, T0 + 1000, false), true, 'lần 2 trong ngày');
  assert.equal(shouldShowInterstitial(ads, T0 + 1000, true), false, 'Pro');
  ads = markInterstitial(recordExport(ads, T0 + 1000), T0 + 1000);
  assert.equal(shouldShowInterstitial(ads, T0 + 60_000, false), false, 'chưa đủ 3 phút');
  assert.equal(shouldShowInterstitial(ads, T0 + 181_000, false), true, 'đủ 3 phút');
  assert.equal(shouldShowInterstitial(ads, T0 + 24 * 3600_000, false), false, 'ngày mới, lần đầu');
});

test('track: chỉ khi đồng ý, bỏ khoá cấm, từ chối event lạ', () => {
  const s = { ...defaultState(), consent: { analytics: true } };
  const a = track(s, 'bill_image_shared', { role: 'tenant', account: '0123', name: 'Linh', amount: 5, total: 9, has_vietqr: true }, 1);
  assert.deepEqual(a.events[0].params, { role: 'tenant', has_vietqr: true });
  assert.equal(track(s, 'su_kien_la', { x: 1 }, 1).events.length, 0);
  assert.equal(track(defaultState(), 'bill_split', { split_type: 'equal' }, 1).events.length, 0);
  for (const name of ['onboarding_completed', 'reading_entered', 'bill_calculated', 'landlord_compare_done', 'bill_split',
    'bill_image_shared', 'room_added', 'batch_bills_created', 'paywall_viewed', 'purchase_completed',
    'ad_rewarded_completed', 'ad_impression', 'calc_error_reported', 'tariff_config_loaded']) assert.ok(EVENTS.includes(name), name);
});
