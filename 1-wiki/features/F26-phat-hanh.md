# F26 — Phát hành: chính sách quyền riêng tư, bộ ảnh store, gói Android, video demo

**Phase:** 8 (ngày 3) · **Nguồn:** `docs/STORE_LISTING.md`, `docs/LAUNCH_CHECKLIST.md`, `docs/DEMO_VIDEO_SCRIPT.md`

Làm được trên máy này: trang chính sách trong app, bộ ảnh store, cấu hình đóng gói Android (Capacitor, F27), video demo quay tự động.
Cần tài khoản / công cụ của nhóm (ghi rõ, không tự làm): Play Console, khoá ký app, tên miền đăng web (GitHub Pages),
JDK 17 + Android SDK (Android Studio) để build AAB, tải AAB lên Internal testing, AdMob app ID, đẩy repo lên GitHub.

## Done when
- [ ] `app/privacy.html` (từ `docs/privacy-policy.html`, cập nhật mục quảng cáo + mua trong ứng dụng), mở từ Cài đặt `#privacy-link`; chạy offline (có trong service worker).
- [ ] `brand/store/`: icon 512×512, ảnh đồ hoạ 1024×500 (nền #12161C, chữ trắng "Lãi Thật" + "505đ · Lãi mỏng 3,0%" màu #A16207, không logo sàn), 6–8 ảnh chụp điện thoại 1080×1920 có chú thích, sinh lại được bằng một lệnh.
- [ ] Gói Android: `mobile/` (Capacitor, ADR-002) + `mobile/README.md` các bước ra AAB và tải lên Internal testing (chi tiết ở F27).
- [ ] Video demo theo `docs/DEMO_VIDEO_SCRIPT.md` (quay tự động màn hình app 390px, chữ chú thích trên màn), lưu ở `brand/video/`.
- [ ] `docs/LAUNCH_CHECKLIST.md` đánh dấu việc đã xong / việc còn cần nhóm làm.
