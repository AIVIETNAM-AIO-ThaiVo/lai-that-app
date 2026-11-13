# F11 — Báo động khi sàn đổi phí

**Phase:** 2 · **Màn:** S7 + Cài đặt + thông báo · **Không cắt** (BUILD_PLAN)

App kiểm tra biểu phí khi mở và mỗi 24 giờ. Khi `fee_version` mới hơn bản đã thấy: tính lại mọi sản phẩm, so lãi trước/sau, báo sản phẩm chuyển sang lỗ.

## Done when
- [ ] `diffCatalog(products, oldPresets, newPresets)` trả danh sách sản phẩm chuyển từ lãi sang lỗ kèm giá gợi ý mới (unit test).
- [ ] Nhận biểu phí mới (`window.__app.receivePresets(json)`, cùng đường với tải từ máy chủ) có `fee_version` mới → `#fee-alert` trên Danh mục: "Biểu phí Shopee mới đã áp dụng · 1 sản phẩm chuyển sang lỗ".
- [ ] Có thông báo: bản ghi trong `#notif-inbox` (Cài đặt) và Web Notification nếu đã bật `#alerts-toggle` và được cấp quyền.
- [ ] `#fee-alert-action` "Xem giá đề xuất" lọc ra sản phẩm vừa chuyển lỗ với giá gợi ý mới.
- [ ] Cùng `fee_version` thì không báo lại; `#fee-version` ở Cài đặt hiện phiên bản đang dùng.
- [ ] Event `fee_table_updated {fee_version, products_turned_loss}` và `fee_alert_opened {fee_version, is_pro}`.
