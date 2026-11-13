# F24 — Lãi Thật Pro: paywall 4 điểm, 2 gói, dùng thử 3 ngày

**Phase:** 8 (ngày 3 của `docs/BUILD_PLAN.md`) · **Màn:** sheet `#paywall` · Cài đặt `#pro-card`

Theo `1-wiki/product/decisions.md`: Pro bán danh mục không giới hạn, báo động từng sản phẩm, Flash Sale + giá nhập tối đa, không quảng cáo.
**Không khoá** tính lãi, chi tiết phí, tính theo % lãi, so sánh sàn. Bật `pro_gates_enabled: true` trong `app/assets/app_config.json`.

**4 điểm kích hoạt paywall** (`paywall_view.trigger`):
1. `catalog_limit` — lưu sản phẩm thứ 6 (gói miễn phí 5 sản phẩm).
2. `fee_alert` — báo động đổi phí: miễn phí chỉ thấy **số lượng** sản phẩm chuyển lỗ; bấm xem chi tiết → paywall.
3. `flash_sale` — thẻ Flash Sale & giá nhập tối đa đang khoá → "Dùng Pro" (hoặc xem quảng cáo thưởng, F25).
4. `settings` — thẻ "Lãi Thật Pro" ở Cài đặt.

Add-on phase 10 thêm 2 nguồn riêng (ngoài 4 điểm lõi, `ADDON_TRIGGERS` trong `app/pro.js`): `combo_tab` (F28, sửa ví dụ combo mẫu) và `order_check_file` (F30, xem đơn thứ 4 trở đi của file / gán SKU).

**Thanh toán (`app/billing.js`):** trong app Android (Capacitor, ADR-002) dùng Google Play Billing qua plugin `NativePurchases`
(tự xác nhận giao dịch, F27). Không có plugin (trình duyệt, bot) → **chế độ thử**: ghi rõ "Chế độ thử — không trừ tiền",
lưu giao dịch thử trên máy để Khôi phục được.

## Done when
- [ ] Paywall ghi: giá + chu kỳ của 2 gói (`#plan-monthly` 49.000đ/tháng, dùng thử 3 ngày; `#plan-yearly` 299.000đ/năm), **tự gia hạn**, **cách huỷ** (Google Play › Thanh toán và gói đăng ký), nhắc trước 1 ngày khi hết dùng thử, nút `#restore` "Khôi phục giao dịch", nút đóng `#paywall-close`. Có câu miễn trừ "không liên kết".
- [ ] Đúng 4 điểm kích hoạt ở trên; mỗi lần hiện ghi `paywall_view {trigger}`. Màn Tính lãi không tự bật paywall.
- [ ] Gói tháng → dùng thử 3 ngày (`trial_started {plan}`), Pro mở ngay; hết dùng thử mà không huỷ → thành thuê bao (`purchase {plan, price, trigger}`). Gói năm → `purchase` ngay.
- [ ] Còn ≤ 1 ngày dùng thử → 1 thông báo (hộp thông báo + Web Notification nếu đã cho phép): "Ngày mai hết dùng thử…" kèm giá và cách huỷ; chỉ nhắc 1 lần.
- [ ] Pro: lưu > 5 sản phẩm, xem chi tiết báo động, Flash Sale mở, không quảng cáo; Cài đặt hiện gói, trạng thái, ngày hết dùng thử / gia hạn, cách huỷ.
- [ ] `#restore` khôi phục giao dịch đã mua (chế độ thử: từ bản ghi trên máy).
- [ ] Unit: `isPro`, `startSubscription`, `settleSubscription`, `trialReminderDue`, `restoreSubscription`, `paywallCopy`.
