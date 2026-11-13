# Kế hoạch build còn lại (13–15/11/2026)

> **Thực tế đã làm (13/11):** máy build không có Flutter SDK nên bản phát hành là web app (PWA) đóng gói Android bằng Capacitor (ADR-001, ADR-002), AdMob + Play Billing qua plugin gốc. Tiến độ theo phase: `1-wiki/phases.md`. Bảng dưới là kế hoạch gốc.

Bộ máy tính, biểu phí, test, thiết kế, tracking plan và tài liệu nộp bài đã có. Ba ngày còn lại dành cho màn hình và các dịch vụ Google.

| Ngày | Việc | Xong khi |
|---|---|---|
| Thứ Sáu 13/11 | `flutter create`, chép `app/lib/engine`, `app/test`, `app/assets`; chạy `flutter test` xanh. Theme (màu, Be Vietnam Pro, số tabular). Màn Chọn sàn, Tính lãi (2 chế độ, kết quả dính đáy, bàn phím số có phím 000), Chi tiết phí (nút i, công tắc). Đọc biểu phí: Remote Config → cache → bản đóng gói | Tính được móc khóa ra 505đ trên máy thật |
| Thứ Bảy 14/11 | So sánh sàn, Chi phí ẩn, Flash Sale + giá nhập tối đa, Danh mục (SQLite, sắp lãi thấp lên đầu, giá gợi ý), báo động đổi phí (so `fee_version`, tính lại, thông báo cục bộ, WorkManager mỗi ngày). Firebase Analytics theo TRACKING_PLAN | Đổi `fee_version` trên Remote Config → điện thoại nhận thông báo |
| Chủ nhật 15/11 | AdMob + UMP, Play Billing (2 gói, dùng thử), paywall đúng 4 điểm kích hoạt. Store listing, privacy policy, tải AAB lên Internal testing. Quay video demo, đẩy repo | Nộp trước 23:59 |

Nếu chậm, cắt theo thứ tự: xuất file → giá nhập tối đa → Lazada. Không cắt báo động đổi phí.
