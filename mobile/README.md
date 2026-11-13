# Gói Android (Capacitor) và tải lên Google Play — Lãi Thật

Quyết định: `1-wiki/product/ADR-002-capacitor.md`. Web app ở `../app` (JS thuần) được gói vào app Android thật.
Trong app, quảng cáo là **AdMob** (`@capacitor-community/admob`) và thuê bao là **Google Play Billing**
(`@capgo/native-purchases`, tự xác nhận giao dịch). App gọi plugin qua `window.Capacitor.Plugins` (`app/native.js`) —
không có thư viện npm nào trong `app/`. Trên trình duyệt vẫn là khung "Quảng cáo thử" + thanh toán chế độ thử.

## Cần trên máy build

| Thứ | Ghi chú |
|---|---|
| Node.js 18+ | đã có |
| Android Studio (kèm JDK 17 + Android SDK) | để build AAB |
| Tài khoản Play Console + AdMob | của nhóm |

## Đã làm sẵn (13/11/2026)

- `npm install`: Capacitor 8.6.2, `@capacitor-community/admob` 8.3.0, `@capgo/native-purchases` 8.9.11.
- `npx cap add android` → `android/` (`applicationId vn.laithat.app`), 2 plugin đã được nhận.
- AdMob App ID **thử** của Google đã gắn trong `android/app/src/main/AndroidManifest.xml`
  (`com.google.android.gms.ads.APPLICATION_ID` = `ca-app-pub-3940256099942544~3347511713`).
- Biểu tượng + màn chờ là logo Lãi Thật (`npm run assets` = `python scripts/android_assets.py`, cần Pillow).

## Các bước

1. Máy mới: `npm install` trong thư mục này.
2. Mỗi lần sửa `../app`: `npm run sync` — chép web vào `www/` (bỏ `tests/`, `test/`, `e2e.mjs`) rồi `cap sync android`.
3. Bản phát hành: thay App ID trong `AndroidManifest.xml` bằng App ID thật, và đổi `app/assets/app_config.json › admob`
   sang ID đơn vị quảng cáo thật + `"test": false`. Trong lúc thử luôn giữ ID thử (bấm quảng cáo thật khi test có thể bị khoá tài khoản AdMob).
4. Chạy thử trên điện thoại: `npm run open` (Android Studio) › Run.
5. Build AAB: mở Android Studio (`npx cap open android`) › Build › Generate Signed Bundle, hoặc trong `android/`:
   `./gradlew bundleRelease` → `android/app/build/outputs/bundle/release/app-release.aab`.
   Lần đầu tạo khoá ký (`*.keystore` / `*.jks`) — **giữ kỹ, không đưa lên repo** (đã có trong `.gitignore`).
6. Play Console › tạo app `vn.laithat.app` › **Internal testing** › tải `app-release.aab`. Bật Play App Signing.
7. Sản phẩm thuê bao (Monetize › Subscriptions), khớp `app/assets/app_config.json`:
   | Subscription ID (`billing_skus`) | Base plan (`billing_plans`) | Giá | Ưu đãi |
   |---|---|---|---|
   | `pro_monthly` | `monthly` | 49.000đ / tháng, tự gia hạn | dùng thử miễn phí 3 ngày |
   | `pro_yearly` | `yearly` | 299.000đ / năm, tự gia hạn | — |
   Thêm license testers để mua thử không mất tiền.
8. Store listing: chữ ở `docs/STORE_LISTING.md`, ảnh ở `brand/store/` (`node tools/store_shots.mjs`), video ở `brand/video/`.
   Chính sách quyền riêng tư: đăng `app/privacy.html` lên web (điền tên nhóm, email, ngày phát hành trước) và dán URL.
9. Data safety, phân loại nội dung, đối tượng 18+, khai **có quảng cáo** và **có mua trong ứng dụng**.
   Tài khoản cá nhân mới: chạy closed testing 12 người × 14 ngày trước production (kiểm tra lại quy định).

## Biểu phí mới trong app

Trong app, `assets/fee_presets.json` là bản đóng gói. Để app nhận biểu phí mới không cần cập nhật app, đăng file đó lên web
và đặt `app_config.fee_presets_url` = URL đó (hoặc chuyển sang Firebase Remote Config sau).
