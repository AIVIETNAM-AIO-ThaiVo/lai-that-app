# F2 — Biểu phí, nguồn và miễn trừ

**Phase:** 1 · **Nguồn:** `app/assets/fee_presets.json` (sinh từ [fees/](../fees/)) · **ADR:** [ADR-001](../product/ADR-001-web-truoc.md)

Đọc biểu phí theo thứ tự: bản mới nhất từ máy chủ (`assets/fee_presets.json`, không cache) → bản đã cache → bản đóng gói.

## Done when
- [ ] `loadPresets` chọn bản có `fee_version` mới hơn giữa remote và cache; remote lỗi thì dùng cache; không có cache thì dùng bản đóng gói (unit test).
- [ ] `categoriesFor('shopee')` trả 31 ngành; ngành có `default: null` (TikTok "Khác", Lazada) bắt người dùng nhập % (unit test).
- [ ] Mọi màn kết quả có `#fee-date` "Biểu phí Shopee cập nhật 12/11/2026" và câu "không liên kết với sàn".
- [ ] Người dùng sửa được % ngành (`#category-rate`) và kết quả đổi theo ngay.
- [ ] Màn Chi tiết phí có `#report-fee` "Báo sai phí" → ghi sự kiện `fee_report_sent` và hiện cảm ơn.
- [ ] Event `fee_override {platform, field}` khi người dùng sửa phí.
