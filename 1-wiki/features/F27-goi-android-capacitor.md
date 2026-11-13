# F27 — Gói Android bằng Capacitor: AdMob + Google Play Billing gốc

**Phase:** 9 (PO chọn Capacitor 13/11/2026) · **Quyết định:** `1-wiki/product/ADR-002-capacitor.md`
**Code:** `app/native.js` (cầu nối plugin), `app/billing.js`, `mobile/` (cấu hình Capacitor)

Trong app Android, phần *vẽ* quảng cáo và *thanh toán* chạy bằng plugin gốc; **luật** vẫn là `app/ads.js` (F25) và `app/store.js` (F24).
Trên trình duyệt (không có `window.Capacitor`) mọi thứ giữ nguyên như F24/F25: khung "Quảng cáo thử", thanh toán chế độ thử.

## Done when
- [ ] `isNative(win)` chỉ đúng khi `window.Capacitor.isNativePlatform()` là true; trên web không gọi plugin nào.
- [ ] Quảng cáo trong app (`AdMob`): bảng đồng ý UMP (`requestConsentInfo` → `showConsentForm` khi `REQUIRED`) rồi `initialize`; banner thích ứng `BOTTOM_CENTER` nằm trên thanh điều hướng, **chỉ** khi vào Danh mục / Cài đặt (theo `bannerPlacement`), rời màn thì `hideBanner`; interstitial / rewarded dùng `prepare…` + `show…`; rewarded chỉ mở Flash Sale khi plugin trả phần thưởng; `npa` theo lựa chọn "Không cá nhân hoá". ID quảng cáo **thử** của Google cho tới bản phát hành (`app_config.admob`).
- [ ] Thanh toán trong app (`NativePurchases`): mua `pro_monthly` / `pro_yearly` với `productType: 'subs'` + `planIdentifier` từ `app_config`; khôi phục từ `getPurchases` (thuê bao đang chạy); lỗi / huỷ → không đổi trạng thái.
- [ ] Biểu phí mới trong app tải từ `app_config.fee_presets_url` (URL đăng web); chưa có URL thì dùng bản đóng gói như cũ.
- [ ] `mobile/`: `capacitor.config.json` (`appId: vn.laithat.app`, `webDir: www`), `package.json` ghim Capacitor 8 + `@capacitor-community/admob` + `@capgo/native-purchases`; `npm run sync` chép `../app` vào `www/` **bỏ** `tests/`, `test/`, `e2e.mjs` rồi `cap sync android`.
- [ ] `mobile/android/` đã tạo (`cap add android`): `applicationId vn.laithat.app`, AdMob App ID (ID thử) trong `AndroidManifest.xml`, 2 plugin được nhận; biểu tượng + màn chờ là logo Lãi Thật (không còn ảnh mặc định Capacitor, `scripts/android_assets.py`).
- [ ] `mobile/README.md`: cài, sync, build AAB (`bundleRelease`), Internal testing, sản phẩm thuê bao + base plan, đổi sang ID quảng cáo thật khi phát hành.
- [ ] `app/` vẫn không import thư viện npm nào (unit test đọc mã nguồn).
- [ ] Unit: cầu nối quảng cáo / thanh toán với plugin giả (đúng hàm, đúng tham số, banner chỉ ở 2 màn, rewarded cần phần thưởng).
