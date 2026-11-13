# ADR-001 — Web (PWA) trước, Flutter sau

- **Bối cảnh:** Kit chọn Flutter/Android. Máy build không có Flutter/Android SDK; harness chấm bằng `node --test` + bot Chrome.
- **Quyết định:** làm web app JS thuần, giao diện điện thoại 390px, offline (service worker), cài được lên màn hình chính.
  Bộ máy tính `app/engine.js` port 1–1 từ `tools/engine.py` / `flutter/lib/engine/fee_engine.dart`, test bằng cùng `app/test/test_vectors.json`.
- **Thay thế tạm cho dịch vụ Google (ghi rõ trong app):**
  | Kit | Bản web |
  |---|---|
  | Firebase Remote Config `fee_presets` | tải `assets/fee_presets.json` mới nhất khi mở app + mỗi ngày → cache → bản đóng gói |
  | SQLite danh mục | localStorage |
  | Thông báo cục bộ + WorkManager | Web Notification (xin quyền khi bật báo động) + hộp thông báo trong app; kiểm tra khi mở app và mỗi 24 giờ |
  | Firebase Analytics | log sự kiện cục bộ đúng tên/thuộc tính trong `docs/tracking_plan.csv` |
- **Hệ quả:** `flutter/` giữ nguyên làm bản tham chiếu để port sau.
