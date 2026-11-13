# Quyết định sản phẩm

| Ngày | Quyết định | Lý do |
|---|---|---|
| 2026-11-12 | Không đăng nhập, không API sàn, không quản lý đơn hàng | App là công cụ tính giá trước khi đăng bán; BigSeller (miễn phí < 1.500 đơn/tháng), Sapo, Nhanh đã làm phần sau bán |
| 2026-11-12 | Không khóa tính lãi, chi tiết phí, tính theo % lãi, so sánh sàn | Đối thủ trực tiếp Shopee Calc miễn phí; người dùng phải thấy giá trị trước paywall |
| 2026-11-12 | Pro bán: báo động từng sản phẩm, danh mục không giới hạn, Flash Sale, giá nhập tối đa, lãi tháng, xuất file, không quảng cáo | Đây là thứ tiết kiệm thời gian cho shop có nhiều sản phẩm |
| 2026-11-12 | Gộp tính xuôi và tính ngược vào một màn | Markup Margin (4,8★, 10N+ lượt cài) dùng mẫu "nhập 2 ô bất kỳ" |
| 2026-11-12 | Phí % tính trên giá sau mã giảm giá shop; phí giao dịch cộng ship người mua trả | 8/8 đơn Shopee thật |
| 2026-11-12 | PiShip, phí hiển thị, GTGT là công tắc | Chỉ một phần đơn thật có các khoản này |
| 2026-11-12 | TikTok/Lazada: cho sửa từng dòng, ghi "chưa đối chiếu đủ" | Mới có 1 đơn TikTok, 0 đơn Lazada |
| 2026-11-12 | Không dùng màu/logo sàn; sàn là chip chữ trung tính | Chính sách mạo danh của Google Play |
| 2026-11-12 | Không quảng cáo trên màn Tính lãi, không interstitial trong 2 phiên đầu | Đánh giá 1★ của app margin calculator vì quảng cáo chen ngang |
| 2026-11-12 | Báo trước 1 ngày khi hết dùng thử, hủy dễ | Đánh giá 1★ của TrueProfit/BeProfit vì trừ tiền bất ngờ |
| 2026-11-12 | Bản này là web PWA, Flutter sau ([ADR-001](ADR-001-web-truoc.md)) | Máy build chưa có Flutter SDK; giữ engine 1–1 |
| 2026-11-12 | Giới hạn Pro (danh mục 5, Flash Sale, giá nhập tối đa) có trong code nhưng **tắt** bằng `app/assets/app_config.json` → `pro_gates_enabled: false` cho tới khi có Play Billing + quảng cáo thưởng (ngày 3) | Không để người dùng gặp paywall không mua được; logic khoá đã có test |
| 2026-11-13 | 4 điểm paywall: `catalog_limit`, `fee_alert`, `flash_sale` (gồm giá nhập tối đa), `settings`. Lãi tháng (F13) vẫn miễn phí | BUILD_PLAN "đúng 4 điểm kích hoạt"; xuất file chưa có (P2) |
| 2026-11-13 | Bật `pro_gates_enabled`. Trên web: thanh toán chế độ thử, quảng cáo là khung thử đúng vị trí/tần suất. Trong app Android (Capacitor, ADR-002): Play Billing + AdMob thật | Luật hiển thị đã có test; chỉ đổi phần vẽ |
| 2026-11-13 | Đóng gói Android bằng **Capacitor** thay TWA (ADR-002) | PO: "Thử đi" — TWA không chạy được AdMob |
| 2026-11-13 | Gắn add-on Combo + Kiểm tra đơn vào bản hiện tại (phase 10, F28–F30); thanh dưới 5 tab Tính · So sánh · Sản phẩm · Kiểm tra · Cài đặt | PO: "Thêm các phần add-on update mọi thứ" (`raw/addon/`) |
| 2026-11-13 | Combo là **Pro** (miễn phí xem ví dụ 3 móc khóa, sửa → paywall `combo_tab`); kiểm tra đơn nhập tay **miễn phí**; kiểm tra cả file **Pro** (miễn phí tóm tắt + 3 đơn đầu, `order_check_file`). 4 điểm paywall lõi giữ nguyên | ADDONS.md mục Kiếm tiền |
| 2026-11-13 | Combo lưu riêng `state.combos` (không trộn vào `products`), hiện trong Danh mục dạng thẻ "Bộ · N món", dùng chung báo động đổi phí | Không phá F10–F23; món liên kết sản phẩm theo id |
| 2026-11-13 | Đọc .xlsx bằng `DecompressionStream` + đọc XML tối giản (`app/xlsx.js`), không thư viện | Luật kỹ thuật: không npm/CDN trong `app/` |
| 2026-11-13 | Kiểm tra đơn chỉ Shopee ở bản này; TikTok Shop / Lazada ghi "sắp có" | Chưa đủ đơn thật / mẫu file để đối chiếu |
| 2026-11-13 | **Bỏ Mall** (Shopee Mall / TikTok Mall): không hỏi loại shop, không gợi ý % Mall; chỉ shop thường. `onboarding_completed` bỏ thuộc tính `shop_type` | PO: Mall không phải người dùng mục tiêu, biểu phí Mall chưa có nguồn → chưa triển khai được |
