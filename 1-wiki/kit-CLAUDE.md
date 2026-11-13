# Lãi Thật – luật cho AI

## Mục tiêu
App Android (Flutter) tính lãi thật và giá bán sau phí sàn Shopee, TikTok Shop, Lazada.
Người dùng: shop nhỏ Việt Nam. Ngôn ngữ UI: tiếng Việt, tiền VND, số dùng dấu chấm nghìn, "đ" sau số.

## Luật dữ liệu (bắt buộc)
1. raw/ là chỉ-đọc. Không sửa, không xóa, chỉ thêm file mới.
2. Mọi % phí trong wiki/fees/*.md phải có: nguồn (file trong raw/ hoặc URL), ngày áp dụng, ngày ghi nhận.
3. app/assets/fee_presets.json chỉ được sinh từ wiki/fees bằng thao tác Build. Không sửa tay.
4. Không đoán số phí. Thiếu nguồn thì để null và cho người dùng tự nhập.
5. Đơn thật dùng để kiểm thử nằm trong raw/orders/; chỉ ghi số tiền, không ghi tên khách, mã đơn đầy đủ hay thông tin cá nhân.

## Luật bộ máy tính
- Công thức duy nhất nằm ở wiki/engine/formula.md; tools/engine.py và app/lib/engine/fee_engine.dart phải khớp từng ký hiệu.
- Mọi phí % và thuế tính trên B = giá − mã giảm giá shop; phí xử lý giao dịch tính trên B + ship người mua trả.
- Mọi thay đổi công thức phải chạy lại tools/validate.py và flutter test; lệch quá 1% giá bán là lỗi.
- Làm tròn chỉ ở bước hiển thị; tính toán dùng số thực đầy đủ.

## Luật sản phẩm
- Không dùng tên/logo/màu của sàn trong tiêu đề, biểu tượng, ảnh chụp. Luôn có câu miễn trừ "không liên kết".
- Không thêm đăng nhập, API sàn, quản lý đơn hàng (xem wiki/product/decisions.md).
- Không khóa phần tính lõi (tính lãi, chi tiết phí, tính theo % lãi, so sánh sàn) sau paywall.
- Không đặt quảng cáo trên màn Tính lãi; không hiện quảng cáo xen kẽ trong 2 phiên đầu.
- Mọi sự kiện tracking phải có trong docs/TRACKING_PLAN.md trước khi code.
- Mọi kết quả hiện "biểu phí cập nhật ngày …".

## Thao tác
- Ingest: đưa nguồn mới vào raw/, cập nhật trang wiki liên quan, ghi log.
- Query: trả lời từ wiki/, trích trang; không trả lời từ trí nhớ.
- Lint: tìm số phí thiếu nguồn, trang mâu thuẫn, liên kết hỏng.
- Build: sinh fee_presets.json từ wiki/fees, tăng fee_version (YYYY-MM-DD.n), chạy validate + test.
- Sync: đối chiếu app/ với wiki/ (tính năng, tracking, công thức), ghi chênh lệch vào log.

## Log
Mỗi thao tác thêm một dòng vào wiki/log.md: `## [YYYY-MM-DD] op | chủ đề`.
