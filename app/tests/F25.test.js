// F25 — Quảng cáo + đồng ý (1-wiki/features/F25-quang-cao-dong-y.md)
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import config from '../assets/app_config.json' with { type: 'json' };
import { defaultState, startSubscription } from '../store.js';
import { adsActive, consentNeeded, bannerPlacement, interstitialDue } from '../ads.js';

const APP = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const T0 = Date.UTC(2026, 10, 15, 3);
const free = { ...defaultState(), adConsent: 'npa' };

test('cần đồng ý trước khi có quảng cáo; Pro không quảng cáo', () => {
  assert.equal(config.ads_enabled, true);
  assert.equal(consentNeeded(defaultState(), config, T0), true);
  assert.equal(adsActive(defaultState(), config, T0), false, 'chưa đồng ý → chưa quảng cáo');
  assert.equal(adsActive(free, config, T0), true);
  const pro = startSubscription(free, 'yearly', 'settings', T0, config.pro_prices);
  assert.equal(adsActive(pro, config, T0), false);
  assert.equal(consentNeeded(pro, config, T0), false);
});

test('banner chỉ ở Danh mục và Cài đặt › Biểu phí; không bao giờ ở Tính lãi', () => {
  assert.equal(bannerPlacement('#/san-pham'), 'catalog');
  assert.equal(bannerPlacement('#/cai-dat'), 'fees');
  for (const r of ['#/tinh', '#/tinh?x', '#/chi-tiet', '#/so-sanh', '#/chon-san', '#/chi-phi-an', '#/san-pham/p1', '#/san-pham/moi', '#/san-pham/p1/chi-tiet']) {
    assert.equal(bannerPlacement(r), null, r);
  }
});

test('interstitial: phiên ≥ 3, ≥ 3 lần tính từ lần trước, cách ≥ 180 giây, không mở ra màn Tính lãi', () => {
  const ok = { sessions: 3, calcsSince: 3, lastAt: 0, now: T0, to: '#/san-pham' };
  assert.equal(interstitialDue(ok, config), true);
  assert.equal(interstitialDue({ ...ok, sessions: 2 }, config), false, 'không trong 2 phiên đầu');
  assert.equal(interstitialDue({ ...ok, calcsSince: 2 }, config), false);
  assert.equal(interstitialDue({ ...ok, lastAt: T0 - 179000 }, config), false, 'tối đa 3 phút/lần');
  assert.equal(interstitialDue({ ...ok, lastAt: T0 - 180000 }, config), true);
  assert.equal(interstitialDue({ ...ok, to: '#/tinh' }, config), false, 'không quảng cáo ở Tính lãi');
  assert.equal(interstitialDue({ ...ok, to: '#/san-pham/p1' }, config), true);
});

test('màn Tính lãi không gọi banner / interstitial', () => {
  const ui = readFileSync(path.join(APP, 'ui.js'), 'utf8');
  const calc = ui.slice(ui.indexOf('function screenCalc'), ui.indexOf('function monthlyLine'));
  assert.ok(calc.length > 200);
  assert.ok(!/adBanner|ad-banner|interstitial/.test(calc));
});
