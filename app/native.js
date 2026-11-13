// F27 — Cầu nối plugin gốc khi app chạy trong Capacitor (ADR-002). Không import thư viện npm:
// Capacitor tự gắn window.Capacitor.Plugins.<Tên> khi chạy trong app Android; trên web không có gì ở đây chạy.
// Luật hiển thị quảng cáo vẫn là app/ads.js; file này chỉ "vẽ" bằng AdMob và mua bằng Google Play Billing.

/** Đang chạy trong app Android (Capacitor) chứ không phải trình duyệt. */
export const isNative = (win) => !!win?.Capacitor?.isNativePlatform?.();

/** Plugin gốc theo tên (AdMob, NativePurchases); trên web trả null. */
export const plugin = (win, name) => (isNative(win) ? win.Capacitor.Plugins?.[name] ?? null : null);

/** Quảng cáo AdMob (@capacitor-community/admob). cfg = app_config.admob (ID thử của Google khi test = true). */
export function createNativeAds(AdMob, cfg) {
  let ready = null;
  let banner = 'none'; // none | shown | hidden
  const opts = (adId, npa) => ({ adId, isTesting: !!cfg.test, npa: !!npa });
  return {
    /** Bảng đồng ý UMP (bắt buộc ở EEA/UK) rồi khởi tạo. Trả true nếu được phép xin quảng cáo. */
    start() {
      ready ??= (async () => {
        let info = await AdMob.requestConsentInfo();
        if (info?.isConsentFormAvailable && info?.status === 'REQUIRED') info = await AdMob.showConsentForm();
        if (info?.canRequestAds === false) return false;
        await AdMob.initialize({ initializeForTesting: !!cfg.test });
        return true;
      })().catch(() => false);
      return ready;
    },
    /** Đồng bộ banner theo màn: placement = 'catalog' | 'fees' | null (Ads.bannerPlacement). */
    async route(placement, { active, npa } = {}) {
      const want = !!placement && !!active && (await this.start());
      try {
        if (want && banner === 'none') {
          await AdMob.showBanner({ ...opts(cfg.banner, npa), adSize: 'ADAPTIVE_BANNER', position: 'BOTTOM_CENTER', margin: cfg.banner_margin ?? 0 });
          banner = 'shown';
        } else if (want && banner === 'hidden') { await AdMob.resumeBanner(); banner = 'shown'; } else if (!want && banner === 'shown') { await AdMob.hideBanner(); banner = 'hidden'; }
      } catch { /* không tải được quảng cáo: bỏ qua, app vẫn dùng bình thường */ }
      return banner === 'shown';
    },
    async interstitial({ npa } = {}) {
      if (!(await this.start())) return false;
      try { await AdMob.prepareInterstitial(opts(cfg.interstitial, npa)); await AdMob.showInterstitial(); return true; } catch { return false; }
    },
    /** Quảng cáo thưởng: true chỉ khi plugin trả phần thưởng (xem hết). */
    async rewarded({ npa } = {}) {
      if (!(await this.start())) return false;
      try {
        await AdMob.prepareRewardVideoAd(opts(cfg.rewarded, npa));
        const item = await AdMob.showRewardVideoAd();
        return !!item && (item.amount ?? 1) > 0;
      } catch { return false; }
    },
  };
}

/** Thuê bao Google Play (@capgo/native-purchases, Play Billing 7 — tự xác nhận giao dịch). */
export function createNativeBilling(NativePurchases, { skus, plans }) {
  const planOf = (id) => Object.keys(skus).find((k) => skus[k] === id);
  return {
    mode: 'play',
    async purchase(plan) {
      const r = await NativePurchases.purchaseProduct({ productIdentifier: skus[plan], planIdentifier: plans[plan], productType: 'subs', quantity: 1 });
      return { plan, token: r?.purchaseToken ?? r?.transactionId ?? null };
    },
    async restore() {
      const { purchases = [] } = (await NativePurchases.getPurchases({ productType: 'subs' })) ?? {};
      const p = purchases.find((x) => planOf(x.productIdentifier) && x.isActive !== false);
      if (!p) return null;
      const exp = Date.parse(p.expirationDate) || Date.now() + 30 * 86400000;
      const start = Date.parse(p.purchaseDate) || Date.now();
      return p.isTrialPeriod
        ? { plan: planOf(p.productIdentifier), status: 'trial', startedAt: start, trialEndsAt: exp, renewsAt: exp }
        : { plan: planOf(p.productIdentifier), status: 'active', startedAt: start, renewsAt: exp };
    },
  };
}
