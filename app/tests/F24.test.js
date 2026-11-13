// F24 — Lãi Thật Pro: paywall 4 điểm, 2 gói, dùng thử 3 ngày (1-wiki/features/F24-lai-that-pro.md)
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import config from '../assets/app_config.json' with { type: 'json' };
import presets from '../assets/fee_presets.json' with { type: 'json' };
import {
  defaultState, isPro, isLocked, canSave, saveProduct, startSubscription, settleSubscription, cancelSubscription,
  trialReminder, restoreSubscription,
} from '../store.js';
import { PAYWALL_TRIGGERS, paywallCopy, PLANS } from '../pro.js';
import { EXAMPLES } from '../examples.js';

const APP = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const DAY = 86400000;
const T0 = Date.UTC(2026, 10, 15, 3);
const P = config.pro_prices;
const ev = (s, name) => s.events.filter((e) => e.name === name);

test('bật khoá Pro; 4 điểm paywall nằm trong tracking plan', () => {
  assert.equal(config.pro_gates_enabled, true);
  assert.deepEqual(PAYWALL_TRIGGERS, ['catalog_limit', 'fee_alert', 'flash_sale', 'settings']);
  const plan = readFileSync(path.join(APP, '..', 'docs', 'TRACKING_PLAN.md'), 'utf8');
  const line = plan.split('\n').find((l) => l.includes('`paywall_view`'));
  for (const t of PAYWALL_TRIGGERS) assert.ok(line.includes(t), t);
});

test('paywall ghi giá, chu kỳ, tự gia hạn, cách huỷ, khôi phục, nhắc dùng thử', () => {
  for (const t of PAYWALL_TRIGGERS) {
    const c = paywallCopy(t, P);
    assert.ok(c.title.length > 3, t);
    const all = [c.title, c.lead, ...c.plans.map((p) => `${p.label} ${p.priceText} ${p.note}`), c.terms, c.restore].join(' ');
    assert.match(all, /49\.000đ\/tháng/);
    assert.match(all, /299\.000đ\/năm/);
    assert.match(all, /3 ngày/);
    assert.match(all, /tự gia hạn/i);
    assert.match(all, /Google Play/);
    assert.match(all, /huỷ/i);
    assert.match(all, /1 ngày/);
    assert.match(c.restore, /Khôi phục giao dịch/);
  }
  assert.deepEqual(PLANS.map((p) => p.id), ['monthly', 'yearly']);
});

test('gói tháng: dùng thử 3 ngày → Pro ngay; hết dùng thử thành thuê bao + purchase', () => {
  let s = startSubscription(defaultState(), 'monthly', 'catalog_limit', T0, P);
  assert.equal(s.sub.status, 'trial');
  assert.equal(s.sub.trialEndsAt, T0 + 3 * DAY);
  assert.ok(isPro(s, T0 + DAY));
  assert.deepEqual(ev(s, 'trial_started').map((e) => e.params), [{ plan: 'monthly' }]);
  assert.equal(ev(s, 'purchase').length, 0);
  s = settleSubscription(s, T0 + 3 * DAY + 1, P);
  assert.equal(s.sub.status, 'active');
  assert.ok(isPro(s, T0 + 4 * DAY));
  assert.deepEqual(ev(s, 'purchase').map((e) => e.params), [{ plan: 'monthly', price: 49000, trigger: 'catalog_limit' }]);
  s = settleSubscription(s, T0 + 3 * DAY + 2, P);
  assert.equal(ev(s, 'purchase').length, 1, 'không ghi trùng');
});

test('huỷ trong dùng thử → hết Pro khi hết dùng thử, không trừ tiền', () => {
  let s = startSubscription(defaultState(), 'monthly', 'settings', T0, P);
  s = cancelSubscription(s);
  assert.ok(isPro(s, T0 + DAY), 'vẫn Pro tới hết dùng thử');
  s = settleSubscription(s, T0 + 3 * DAY + 1, P);
  assert.equal(s.sub.status, 'expired');
  assert.equal(isPro(s, T0 + 4 * DAY), false);
  assert.equal(ev(s, 'purchase').length, 0);
});

test('gói năm: purchase ngay với giá năm', () => {
  const s = startSubscription(defaultState(), 'yearly', 'flash_sale', T0, P);
  assert.equal(s.sub.status, 'active');
  assert.deepEqual(ev(s, 'purchase').map((e) => e.params), [{ plan: 'yearly', price: 299000, trigger: 'flash_sale' }]);
  assert.equal(ev(s, 'trial_started').length, 0);
});

test('nhắc trước 1 ngày khi hết dùng thử, chỉ 1 lần', () => {
  let s = startSubscription(defaultState(), 'monthly', 'settings', T0, P);
  assert.equal(trialReminder(s, T0 + DAY, P).text, null, 'còn 2 ngày: chưa nhắc');
  const r = trialReminder(s, T0 + 2 * DAY + 60000, P);
  assert.match(r.text, /Ngày mai hết dùng thử/);
  assert.match(r.text, /49\.000đ/);
  assert.match(r.text, /Google Play/);
  s = r.state;
  assert.equal(s.notifications[0].text, r.text);
  assert.equal(trialReminder(s, T0 + 2 * DAY + 120000, P).text, null, 'không nhắc lần 2');
});

test('khoá: Flash Sale / lưu sản phẩm thứ 6; Pro mở hết', () => {
  let s = defaultState();
  for (let i = 0; i < 5; i++) s = saveProduct(s, `SP${i}`, EXAMPLES[0].input, presets, T0 + i, config).state;
  assert.equal(canSave(s, config), false);
  assert.equal(saveProduct(s, 'SP6', EXAMPLES[0].input, presets, T0, config).reason, 'limit');
  assert.equal(isLocked('flash_sale', s, config), true);
  const pro = startSubscription(s, 'yearly', 'catalog_limit', Date.now(), P);
  assert.equal(canSave(pro, config), true);
  assert.equal(isLocked('flash_sale', pro, config), false);
});

test('khôi phục giao dịch từ bản ghi', () => {
  const rec = { plan: 'yearly', status: 'active', startedAt: T0, renewsAt: T0 + 365 * DAY };
  const s = restoreSubscription(defaultState(), rec, T0 + DAY);
  assert.ok(isPro(s, T0 + DAY));
  assert.equal(restoreSubscription(defaultState(), null, T0).sub ?? null, null);
});
