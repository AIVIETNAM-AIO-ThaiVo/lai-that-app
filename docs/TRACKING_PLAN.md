# Tracking plan – Lãi Thật

> Bản đặc tả cho code và test. Bản đọc (tiếng Anh, giải thích từng sự kiện đo gì, vì sao quan trọng, KPI): [Tracking Plan - Lai That.docx](<Tracking Plan - Lai That.docx>).

Công cụ: Firebase Analytics (+ Crashlytics cho lỗi, AdMob liên kết Firebase cho doanh thu quảng cáo).
Quy ước: tên sự kiện snake_case; không gửi giá, giá vốn hay tên sản phẩm (chỉ gửi nhóm/bucket); không có dữ liệu cá nhân.

## Câu hỏi cần trả lời

1. Người dùng có tính xong lần đầu không? (kích hoạt)
2. Họ có phát hiện sản phẩm đang lỗ hoặc lãi mỏng không? (giá trị)
3. Họ có lưu sản phẩm và quay lại không? (giữ chân)
4. Quảng cáo có hiện đúng chỗ, không làm hỏng trải nghiệm không?
5. Ai trả tiền, và trả tiền sau khi gặp paywall nào?

## Sự kiện

| Sự kiện | Khi nào | Thuộc tính |
|---|---|---|
| `onboarding_completed` | Xong màn Chọn sàn | `primary_platform` (shopee / tiktok_shop / lazada / multi) — chỉ shop thường, đã bỏ Mall 13/11 |
| `calc_completed` | Kết quả hiện lần đầu cho một bộ đầu vào (debounce 1,5 giây sau khi ngừng gõ) | `platform`, `category_id`, `mode` (from_price / from_margin), `state` (good / thin / loss), `margin_bucket` (<0 / 0–5 / 5–10 / 10–20 / >20), `has_seller_voucher`, `has_ship_buyer`, `programs_on` (chuỗi id, vd "voucher_xtra,piship") |
| `nice_price_applied` | Bấm "Dùng giá …" ở chế độ từ % lãi | `target_margin` (10/15/20/25/30/custom) |
| `fee_breakdown_opened` | Mở Chi tiết phí | `platform` |
| `fee_info_opened` | Bấm (i) ở một dòng phí | `fee_key` (category / transaction / voucher / visibility / per_order / tax) |
| `program_toggled` | Bật/tắt Voucher Xtra, PiShip, phí hiển thị, thuế | `program`, `on` |
| `fee_override` | Người dùng sửa % hoặc số phí | `platform`, `field` |
| `fee_report_sent` | Bấm "Báo sai phí" | `platform`, `field` |
| `compare_viewed` | Mở So sánh sàn | `best_platform`, `platforms_count` |
| `hidden_costs_set` | Lưu chi phí ẩn | `has_return_rate`, `has_roas`, `has_affiliate` |
| `flash_sale_viewed` | Xem bảng Flash Sale | `unlock_method` (pro / rewarded) |
| `max_cost_viewed` | Xem giá nhập tối đa | `unlock_method` |
| `product_saved` | Lưu sản phẩm | `catalog_size`, `state` |
| `catalog_sorted_alert` | Danh mục có ≥ 1 sản phẩm lỗ khi mở | `loss_count_bucket` (1 / 2–5 / >5) |
| `fee_table_updated` | App nhận biểu phí mới | `fee_version`, `products_turned_loss` |
| `fee_alert_opened` | Mở thông báo đổi phí | `fee_version`, `is_pro` |
| `paywall_view` | Hiện paywall | `trigger` (catalog_limit / fee_alert / flash_sale / max_cost / export / settings; add-on: combo_tab / order_check_file) |
| `trial_started` | Bắt đầu dùng thử 3 ngày | `plan` |
| `purchase` | Mua Pro thành công | `plan` (monthly / yearly), `price`, `trigger` |
| `ad_impression` | Mỗi lần hiện quảng cáo | `format` (banner / interstitial / rewarded), `placement` (+ doanh thu từ AdMob) |
| `rewarded_ad_complete` | Xem hết quảng cáo thưởng | `reward` (flash_sale / max_cost / export) |
| `share_result` | Chia sẻ kết quả | `channel` (zalo / other) |
| `combo_built` | Thẻ kết quả combo hiện lần đầu trong phiên (F28) | `platform`, `mode` (promo / addon / bundle), `items_count`, `discount_type` (percent / amount / fixed / none), `margin_bucket` |
| `combo_vs_separate_viewed` | Xem dòng so với bán lẻ | `platform`, `uplift_bucket` (<0 / 0–25% / 25–100% / >100%) |
| `combo_max_discount_viewed` | Mở phần Giảm tối đa | `target_margin`, `is_pro` |
| `combo_saved` | Lưu combo vào Danh mục | `items_count`, `mode` |
| `order_check_started` | Bắt đầu kiểm tra đơn (F29/F30) | `method` (manual / file), `platform` |
| `order_check_completed` | Có kết quả kiểm tra | `method`, `orders_count`, `mismatch_count`, `top_reason` |
| `order_check_file_error` | File Báo Cáo Doanh Thu sai mẫu / không đọc được | `error_code` (missing_column / wrong_template / not_xlsx / empty), `missing_column` |
| `mismatch_reason_viewed` | Mở câu chẩn đoán lệch | `reason_code`, `fee_key` |
| `category_rate_updated_from_check` | Cập nhật ngành từ dòng lệch (công tắc chương trình ghi `program_toggled`) | `reason_code`, `platform` |
| `complaint_template_copied` | Sao chép mẫu khiếu nại | `fee_key`, `diff_bucket` (<1k / 1–5k / 5–20k / >20k) |

Add-on (F28–F30) không gửi số tiền, mã đơn, tên sản phẩm hay nội dung file báo cáo; chỉ gửi mã lý do và nhóm.

User property: `primary_platform`, `is_pro`, `catalog_size_bucket`, `fee_version_seen`, `first_calc_state`.

## Phễu và KPI

Phễu chính: cài đặt → `onboarding_completed` → `calc_completed` → `product_saved` → `paywall_view` → `purchase`.

| KPI | Cách đo | Mục tiêu ban đầu (giả định, sẽ đối chiếu tiêu chí gating) |
|---|---|---|
| Kích hoạt | % người cài có `calc_completed` trong phiên đầu | ≥ 70% |
| Giá trị phát hiện | % `calc_completed` có `state` = loss hoặc thin | Theo dõi |
| Giữ chân | Quay lại D1 / D7 | ≥ 25% / ≥ 12% |
| Vòng quay lại | % người dùng có ≥ 1 `product_saved` | ≥ 30% |
| Quảng cáo | Số `ad_impression` mỗi người dùng mỗi ngày | 2–4, không có trên màn Tính lãi |
| Chuyển đổi | `purchase` / `paywall_view` | ≥ 2% |
| Độ tin cậy | `fee_report_sent` / `calc_completed` | < 1%; tăng đột biến = biểu phí sai |

## Quy tắc quảng cáo (khớp với tracking)

- Banner thích ứng dưới màn Danh mục và màn Biểu phí; không đặt trên màn Tính lãi.
- Interstitial: sau `calc_completed` thứ 3 trong phiên, tối đa mỗi 3 phút một lần, không hiện trong 2 phiên đầu.
- Rewarded: mở 1 lần Flash Sale / giá nhập tối đa / xuất file.
- Không dùng quảng cáo khi mở app ở MVP.
