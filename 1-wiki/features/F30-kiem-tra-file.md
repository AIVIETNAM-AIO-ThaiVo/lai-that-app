# F30 — Kiểm tra cả file Báo Cáo Doanh Thu (Shopee .xlsx)

**Phase:** 10 (add-on, `raw/addon/docs/ADDONS.md` K4–K6, bản 1.2) · **Màn:** `#/kiem-tra/file`
**Gói:** Pro (miễn phí xem tóm tắt và chi tiết 3 đơn đầu). File đọc trên máy, không tải đi đâu.

Đọc .xlsx không cần thư viện: giải nén bằng `DecompressionStream('deflate-raw')` của trình duyệt, đọc XML trang **Income** (dòng cấp Đơn hàng). Tìm cột theo **tên** tiếng Việt / tiếng Anh, không theo vị trí.

## Done when
- [ ] `readXlsx(bytes)` đọc được file .xlsx (zip stored/deflate, sharedStrings, nhiều trang); `parseIncome(sheets)` tìm trang Income, dòng tiêu đề và các cột bắt buộc theo tên (Mã đơn hàng, Giá sản phẩm, Phí cố định, Phí dịch vụ, Phí xử lý giao dịch, Thuế…); thiếu cột bắt buộc → lỗi "File không đúng mẫu Báo Cáo Doanh Thu" + `order_check_file_error {error_code, missing_column}`, không treo app.
- [ ] Kiểm tra mọi đơn trong file bằng `checkOrder` (F29); file chứa 8 đơn thật đã đối chiếu (A–K, `raw/orders`) → 8 Khớp khi gán đúng sản phẩm.
- [ ] Tóm tắt: 4 ô đếm Khớp · Lệch nhỏ · Lệch · Có điều chỉnh (bấm để lọc), lý do lệch nhiều nhất, tổng tiền lệch, phí nào chiếm bao nhiêu % doanh thu, lãi thật theo giá vốn đã lưu; danh sách đơn (4 ký tự cuối mã đơn · trạng thái · lệch) mở vào màn kết quả 1 đơn.
- [ ] Gán SKU/tên sản phẩm trong file với sản phẩm trong Danh mục; nhớ cho lần sau (`state.skuMap`).
- [ ] Chưa Pro: thấy tóm tắt + chi tiết 3 đơn đầu; đơn thứ 4 trở đi và gán SKU mở paywall (`paywall_view {trigger: order_check_file}`).
- [ ] Không lưu nội dung file; chỉ lưu kết quả kiểm tra trên máy, xoá được. Chính sách quyền riêng tư thêm câu "Tệp báo cáo bạn chọn được đọc trên thiết bị và không được gửi đi."
- [ ] Unit: đọc file .xlsx mẫu sinh trong test (8 đơn thật + 1 đơn lệch), file sai mẫu.
