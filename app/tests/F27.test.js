// F27 — Gói Android bằng Capacitor: AdMob + Play Billing gốc (1-wiki/features/F27-goi-android-capacitor.md)
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import config from '../assets/app_config.json' with { type: 'json' };
import { isNative, plugin, createNativeAds, createNativeBilling } from '../native.js';
import { getBilling } from '../billing.js';

const APP = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const ROOT = path.join(APP, '..');

/** Plugin giả: ghi lại lệnh gọi. */
function fake(handlers = {}) {
  const calls = [];
  const p = new Proxy({}, { get: (_, name) => async (arg) => { calls.push([name, arg]); return handlers[name] ? handlers[name](arg) : {}; } });
  return { p, calls, names: () => calls.map((c) => c[0]) };
}
const cap = (plugins, native = true) => ({ Capacitor: { isNativePlatform: () => native, Plugins: plugins } });

test('chỉ coi là app khi Capacitor.isNativePlatform() đúng', () => {
  assert.equal(isNative({}), false);
  assert.equal(isNative(cap({}, false)), false);
  assert.equal(isNative(cap({})), true);
  assert.equal(plugin(cap({ AdMob: 1 }, false), 'AdMob'), null, 'trên web không lấy plugin');
  assert.equal(plugin(cap({ AdMob: 1 }), 'AdMob'), 1);
});

test('quảng cáo: đồng ý UMP rồi mới khởi tạo; ID thử của Google', async () => {
  const a = fake({ requestConsentInfo: () => ({ status: 'REQUIRED', isConsentFormAvailable: true }), showConsentForm: () => ({ status: 'OBTAINED', canRequestAds: true }) });
  const ads = createNativeAds(a.p, config.admob);
  assert.equal(await ads.start(), true);
  assert.deepEqual(a.names(), ['requestConsentInfo', 'showConsentForm', 'initialize']);
  assert.equal(config.admob.test, true);
  assert.match(config.admob.banner, /^ca-app-pub-3940256099942544\//, 'ID banner thử của Google');
  const b = fake({ requestConsentInfo: () => ({ status: 'REQUIRED', isConsentFormAvailable: true }), showConsentForm: () => ({ canRequestAds: false }) });
  assert.equal(await createNativeAds(b.p, config.admob).start(), false);
  assert.ok(!b.names().includes('initialize'), 'chưa đồng ý → không khởi tạo');
});

test('banner: chỉ ở Danh mục / Cài đặt, ẩn khi rời màn, nằm trên thanh điều hướng', async () => {
  const a = fake({ requestConsentInfo: () => ({ status: 'NOT_REQUIRED', canRequestAds: true }) });
  const ads = createNativeAds(a.p, config.admob);
  await ads.start();
  await ads.route('catalog', { active: true, npa: true });
  const show = a.calls.find((c) => c[0] === 'showBanner')[1];
  assert.equal(show.adId, config.admob.banner);
  assert.equal(show.position, 'BOTTOM_CENTER');
  assert.equal(show.adSize, 'ADAPTIVE_BANNER');
  assert.equal(show.margin, config.admob.banner_margin);
  assert.equal(show.isTesting, true);
  assert.equal(show.npa, true);
  await ads.route('catalog', { active: true, npa: true });
  assert.equal(a.names().filter((n) => n === 'showBanner').length, 1, 'không tạo lại banner');
  await ads.route(null, { active: true });
  assert.equal(a.names().at(-1), 'hideBanner');
  await ads.route('fees', { active: true });
  assert.equal(a.names().at(-1), 'resumeBanner');
  await ads.route('fees', { active: false });
  assert.equal(a.names().at(-1), 'hideBanner', 'Pro / chưa đồng ý → ẩn');
});

test('interstitial + rewarded: chuẩn bị rồi hiện; chỉ thưởng khi plugin trả phần thưởng', async () => {
  const a = fake({ requestConsentInfo: () => ({ canRequestAds: true }), showRewardVideoAd: () => ({ type: 'reward', amount: 1 }) });
  const ads = createNativeAds(a.p, config.admob);
  await ads.start();
  assert.equal(await ads.interstitial({ npa: false }), true);
  assert.deepEqual(a.names().slice(-2), ['prepareInterstitial', 'showInterstitial']);
  assert.equal(a.calls.find((c) => c[0] === 'prepareInterstitial')[1].adId, config.admob.interstitial);
  assert.equal(await ads.rewarded({ npa: false }), true);
  assert.equal(a.calls.find((c) => c[0] === 'prepareRewardVideoAd')[1].adId, config.admob.rewarded);
  const none = fake({ requestConsentInfo: () => ({ canRequestAds: true }), showRewardVideoAd: () => { throw new Error('closed'); } });
  const ads2 = createNativeAds(none.p, config.admob);
  await ads2.start();
  assert.equal(await ads2.rewarded({}), false, 'đóng giữa chừng → không thưởng');
});

test('thanh toán: mua thuê bao đúng SKU + base plan; khôi phục từ getPurchases', async () => {
  const n = fake({
    purchaseProduct: () => ({ transactionId: 'GPA.1', purchaseToken: 'tok' }),
    getPurchases: () => ({ purchases: [
      { productIdentifier: 'khac', isActive: true },
      { productIdentifier: 'pro_yearly', isActive: true, purchaseDate: '2026-11-15T03:00:00Z', expirationDate: '2027-11-15T03:00:00Z', isTrialPeriod: false },
    ] }),
  });
  const bill = createNativeBilling(n.p, { skus: config.billing_skus, plans: config.billing_plans });
  assert.equal(bill.mode, 'play');
  const r = await bill.purchase('monthly');
  assert.deepEqual(n.calls[0], ['purchaseProduct', { productIdentifier: 'pro_monthly', planIdentifier: config.billing_plans.monthly, productType: 'subs', quantity: 1 }]);
  assert.equal(r.token, 'tok');
  const rec = await bill.restore();
  assert.equal(rec.plan, 'yearly');
  assert.equal(rec.status, 'active');
  assert.equal(rec.renewsAt, Date.parse('2027-11-15T03:00:00Z'));
  const empty = createNativeBilling(fake({ getPurchases: () => ({ purchases: [] }) }).p, { skus: config.billing_skus, plans: config.billing_plans });
  assert.equal(await empty.restore(), null);
});

test('getBilling: trong app dùng Play Billing, trên web chế độ thử', async () => {
  const n = fake();
  assert.equal((await getBilling(cap({ NativePurchases: n.p }), config)).mode, 'play');
  assert.equal((await getBilling({ localStorage: { getItem: () => null, setItem() {} } }, config)).mode, 'test');
});

test('app/ không import thư viện npm; mobile/ có Capacitor + 2 plugin', () => {
  for (const f of readdirSync(APP).filter((x) => x.endsWith('.js'))) {
    const src = readFileSync(path.join(APP, f), 'utf8');
    for (const m of src.matchAll(/(?:^|\n)\s*import[^'"]*['"]([^'"]+)['"]/g)) assert.ok(m[1].startsWith('./'), `${f} import ${m[1]}`);
  }
  const pkg = JSON.parse(readFileSync(path.join(ROOT, 'mobile', 'package.json'), 'utf8'));
  const deps = { ...pkg.dependencies, ...pkg.devDependencies };
  for (const d of ['@capacitor/core', '@capacitor/android', '@capacitor/cli', '@capacitor-community/admob', '@capgo/native-purchases']) assert.ok(deps[d], d);
  const capCfg = JSON.parse(readFileSync(path.join(ROOT, 'mobile', 'capacitor.config.json'), 'utf8'));
  assert.equal(capCfg.appId, 'vn.laithat.app');
  assert.equal(capCfg.webDir, 'www');
  const readme = readFileSync(path.join(ROOT, 'mobile', 'README.md'), 'utf8');
  for (const w of ['npm run sync', 'APPLICATION_ID', 'bundleRelease', 'Internal testing', 'pro_monthly']) assert.ok(readme.includes(w), w);
  const prep = readFileSync(path.join(ROOT, 'mobile', 'scripts', 'prepare-web.mjs'), 'utf8');
  for (const x of ['tests', 'test', 'e2e.mjs']) assert.ok(prep.includes(`'${x}'`), `bỏ ${x} khỏi APK`);
});

test('dự án Android: package, AdMob App ID, 2 plugin, biểu tượng Lãi Thật', () => {
  const AND = path.join(ROOT, 'mobile', 'android', 'app');
  assert.match(readFileSync(path.join(AND, 'build.gradle'), 'utf8'), /applicationId "vn.laithat.app"/);
  const man = readFileSync(path.join(AND, 'src', 'main', 'AndroidManifest.xml'), 'utf8');
  assert.ok(man.includes(`android:value="${config.admob.app_id_android}"`), 'AdMob App ID khớp app_config');
  assert.match(man, /com.google.android.gms.ads.APPLICATION_ID/);
  const plugins = JSON.parse(readFileSync(path.join(AND, 'src', 'main', 'assets', 'capacitor.plugins.json'), 'utf8')).map((p) => p.pkg);
  assert.deepEqual(plugins.sort(), ['@capacitor-community/admob', '@capgo/native-purchases']);
  assert.match(readFileSync(path.join(AND, 'src', 'main', 'res', 'values', 'ic_launcher_background.xml'), 'utf8'), /#0A7A6B/);
});
