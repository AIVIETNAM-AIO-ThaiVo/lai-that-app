# ADR-002 — Đóng gói Android bằng Capacitor (thay TWA)

- **Ngày:** 13/11/2026 · **Người quyết:** PO ("Thử đi" sau khi so TWA / Capacitor / Flutter)
- **Bối cảnh:** TWA chỉ là Chrome mở trang web → không gắn được AdMob (SDK gốc Android); thanh toán qua Digital Goods API còn chỗ chưa chắc về xác nhận thuê bao.
- **Quyết định:** gói `app/` bằng **Capacitor** (WebView trong app Android thật). App vẫn JS thuần, không bundler, không thư viện npm trong `app/`:
  plugin gốc được gọi qua `window.Capacitor.Plugins.<Tên>` (cầu nối Capacitor tự gắn khi chạy trong app).
  | Việc | Plugin | Ghi chú |
  |---|---|---|
  | Quảng cáo + bảng đồng ý UMP | `@capacitor-community/admob` | banner thích ứng nổi trên WebView, interstitial, rewarded; `requestConsentInfo` / `showConsentForm` |
  | Thuê bao Google Play | `@capgo/native-purchases` (Play Billing 7) | `purchaseProduct({ productType: 'subs', planIdentifier })`; **tự xác nhận (acknowledge) giao dịch** → không bắt buộc máy chủ |
- **Luật hiển thị giữ nguyên:** `app/ads.js` (vị trí, tần suất, không quảng cáo ở Tính lãi). Chỉ phần *vẽ* đổi: web → khung "Quảng cáo thử"; app → gọi plugin (`app/native.js`).
- **Thư mục:** `mobile/` (package.json + `capacitor.config.json`, `webDir: www` — `npm run sync` chép `../app` bỏ phần kiểm thử). Thư viện npm chỉ nằm ở `mobile/node_modules`, không vào `app/`.
- **Hệ quả:** build AAB cần JDK 17 + Android SDK (Android Studio) trên máy nhóm. Biểu phí mới cần URL đăng web (`app_config.fee_presets_url`), vì trong app file `assets/` là bản đóng gói.
- **Bỏ:** cấu hình TWA (`twa/`, `.well-known/assetlinks.json`) và nhánh Digital Goods API.
