# Màn hình & selector (hợp đồng với bot)

Điều hướng bằng hash. Thanh đáy (5 tab từ phase 10): `#tab-tinh` `#tab-so-sanh` `#tab-san-pham` `#tab-kiem-tra` `#tab-cai-dat`.

| Màn (canvas) | Hash | Selector chính |
|---|---|---|
| S1 Chọn sàn | `#/chon-san` | `#pf-shopee` `#pf-tiktok_shop` `#pf-lazada` `#pf-multi` (role=radio, aria-checked) · `#shop-standard` `#shop-mall` · `#onboard-continue` |
| Màn mở app (F20) | (lớp) | `#splash` · lớp chất lỏng `.splash-goo` (lọc `#splash-goo`), giữ tới cuối |
| Chi tiết sản phẩm (F19) | `#/san-pham/<id>` (+ `/chi-tiet`, `/chi-phi-an`) | `#product-name-edit` `#product-save` `#product-delete` `#product-to-calc` · hỏi khi rời: `#leave-save` `#leave-discard` · cùng ô nhập/kết quả như Tính nhanh |
| Sản phẩm mới (F21) | `#/san-pham/moi` | mở từ `#add-product` ở danh mục · `#product-name-edit` `#product-create` · hỏi khi rời: `#leave-save` `#leave-discard` |
| Lãi theo từng sàn (F22) | `#/san-pham/<id>`, `#/san-pham/moi` | `#channels` `.channel-item[data-platform]` → `#channel-sheet`: `#ch-category` `#ch-rate` `#ch-price` `#ch-save` · Cài đặt: `#sell-shopee` `#sell-tiktok_shop` `#sell-lazada` |
| S2/S4 Tính nhanh | `#/tinh` | `#platform-chip` · `#mode-price` `#mode-margin` (role=tab) · `#category` `#category-rate` · `#cost` `#price` `#voucher` `#voucher-unit` `#ship-buyer` · `#other-costs` → `#pack` · `#to-breakdown` `#save-product` `#fee-date` · kết quả dính đáy `#result[data-state]` `#profit` `#state-label` `#margin` `#breakeven` `#money-bar .bar-seg` |
| S4 Từ % lãi | `#/tinh` (mode margin) | `.margin-chip[data-m]` `#margin-amount-toggle` `#target-amount` · `#nice-price` `#nice-profit` `#breakeven-margin` · `#apply-price` · `#flash-sale .flash-row` · `#max-cost` |
| S3 Chi tiết phí | `#/chi-tiet` | `#take-rate` · `.fee-line[data-key]` `.fee-info` `.fee-basis` · `#rate-category` `#rate-transaction` `#fixed-per-order` · `#prog-<id>` `#tax-vat` `#tax-pit` `#registered` · `#report-fee` · `#remaining` |
| S5 So sánh | `#/so-sanh` | `.compare-card[data-platform]` `.cmp-profit` `.cmp-diff` · `#lazada-rate` · `#compare-orders` `#compare-monthly` |
| S6 Chi phí ẩn | `#/chi-phi-an` | `#hc-profit` `#hc-diff` · `#hc-return` `#return-rate` `#loss-per-return` · `#hc-voucher` `#hc-visibility` · `#hc-ads` `#roas` · `#affiliate-rate` · `#roas-breakeven` `#max-ads` |
| S7 Danh mục | `#/san-pham` | `#catalog-count` · `#add-product` · `.channel-row[data-platform]` (F22) · `#fee-alert` `#fee-alert-action` · `#filter-all` `#filter-loss` `#filter-thin` · `.product-card[data-id]` `.suggested` · `#catalog-empty` `#load-examples` · `#bulk-mode` `#apply-suggested` |
| Lưu sản phẩm | (sheet) | `#product-name` `#save-confirm` |
| Cài đặt | `#/cai-dat` | `#fee-version` `#check-fees` `#alerts-toggle` `#notif-inbox .notif` `#sale-reminders` `#next-sale` `#new-shop` · `#change-platform` |
| Thông báo trong app | (lớp) | `#toast` · `#sale-banner` · `#keybar` `#key-000` `#key-done` (thanh phím khi gõ tiền) |
| P1 trên Tính lãi | `#/tinh` | `#orders-month` `#monthly-profit` · `#share-result` · `#examples .example[data-v]` · `#mall-hint` `#mall-note` `#promo-hint` · sheet sàn `#sheet-<sàn>` `#sheet-shop-standard` `#sheet-shop-mall` `#sheet-done` · `#new-product` |
| P1 trên Danh mục | `#/san-pham` | `#bulk-mode` `#apply-on-<sàn>` (F23) `.bulk-check` `#apply-suggested` `#undo-bar` `#undo-apply` · `#load-examples` |

Hợp đồng với bot (`window.__app`): `state()`, `events()`, `presets()`, `route()`, `receivePresets(json)` (giả lập Remote Config đẩy biểu phí), `lastShare()`, `setToday(iso)` (ngày giả để kiểm nhắc sale).
| Pro / paywall (F24) | sheet | `#paywall` `#plan-monthly` `#plan-yearly` `#buy` `#restore` `#paywall-close` · Cài đặt `#pro-card` `#pro-open` · Flash Sale khoá: `#flash-pro` |
| Quảng cáo (F25) | lớp / thẻ | `#ad-consent` `#consent-yes` `#consent-no` · `.ad-banner[data-placement]` · `#interstitial` `#interstitial-close` · `#watch-ad` `#rewarded` · Cài đặt `#ad-consent-change` |
| Phát hành (F26) | `privacy.html` | Cài đặt `#privacy-link` |
| Combo (F28) | `#/combo` (+ `/chi-tiet`, `#/combo/<id>`) | chip `#mode-combo` ở Tính · `#combo-sample` (mẫu chỉ xem, miễn phí) · `#combo-mode-promo` `#combo-mode-addon` `#combo-mode-bundle` · `.combo-item[data-i]` `.qty-minus` `.qty-plus` `#add-item` → sheet `#item-sheet` `.pick-product[data-id]` `#quick-name` `#quick-cost` `#quick-price` `#quick-rate` `#quick-add` · `#disc-percent` `#disc-amount` `#disc-fixed` `#disc-value` `#combo-pack` `#combo-ship` · `#combo-min-note` · kết quả `#combo-result[data-state]` `#combo-profit` `#combo-compare` `#combo-uplift` `#combo-take` `#combo-detail` · chi tiết `.combo-line[data-key] .per` `#max-disc` `.md-mark[data-m]` `#disc-slider` `#combo-suggest` `#combo-name` `#combo-save` · Danh mục `#make-combo` `.product-card.combo-card` |
| Kiểm tra đơn (F29) | `#/kiem-tra`, `#/kiem-tra/ket-qua` | `#check-manual` `#check-file` (tab) · `#check-product` `#check-rate` · `#o-price` `#o-seller_voucher` `#o-ship_buyer` `#o-refund` `#o-fixed_fee` `#o-service_fee` `#o-transaction_fee` `#o-piship` `#o-visibility` `#o-vat` `#o-pit` `#o-affiliate` · `#check-run` · kết quả `#check-status[data-status]` `.check-line[data-key][data-status]` `.diag` `.fix-btn[data-kind]` `#order-ref` `.copy-complaint` `#check-real-profit` `#check-again` · `#check-history` `#clear-history` |
| Kiểm tra file (F30) | `#/kiem-tra/file` | `#file-input` `#file-pick` `#file-error` · `.count-tile[data-status]` `#file-top-reason` `#file-total-diff` `#fee-share .share-row` · `.order-row[data-id][data-status]` (`.locked` khi chưa Pro) · `.sku-map[data-sku]` · `#file-unlock` |

Hợp đồng add-on với bot: `__app.checkFile(bytes)` (đưa file .xlsx như người dùng chọn), `__app.lastClipboard()` (nội dung vừa sao chép).
