# F21 — Thêm sản phẩm ngay trong danh mục

**Phase:** 5 (phản hồi người dùng 13/11/2026, lần 2) · **Màn:** `#/san-pham` → `#/san-pham/moi`

Vấn đề: sau F19, muốn thêm sản phẩm phải sang Tính nhanh rồi "Lưu thành sản phẩm" — tab Sản phẩm không có chỗ thêm.
Quyết định: danh mục có nút **Thêm sản phẩm** mở màn "Sản phẩm mới" (cùng ô nhập và kết quả như Tính nhanh, nhưng bắt đầu trống
và có ô tên). Bấm "Thêm vào danh mục" mới ghi; Tính nhanh không bị đụng.

## Done when
- [ ] Danh mục có `#add-product` "Thêm sản phẩm" — cả khi đã có sản phẩm lẫn khi danh mục trống — mở `#/san-pham/moi`.
- [ ] Màn `#/san-pham/moi`: tiêu đề "Sản phẩm mới", nút quay lại danh mục, tab "Sản phẩm" đang sáng; ô tên `#product-name-edit` trống; giá bán / giá vốn trống (không chép số từ Tính nhanh); sàn = sàn đang dùng ở Tính nhanh, giữ thiết lập shop (thuế, chương trình).
- [ ] Nhập giá → kết quả lãi hiện ngay như Tính nhanh.
- [ ] `#product-create` "Thêm vào danh mục" chỉ bấm được khi có tên **và** giá bán (và đã có % phí ngành hàng); bấm → về `#/san-pham`, sản phẩm mới có trong danh sách với lãi đúng; Tính nhanh giữ nguyên số cũ.
- [ ] Rời màn khi đã nhập mà chưa thêm → hỏi `#leave-discard` "Bỏ" / `#leave-save` "Thêm" (chỉ bấm được khi đủ tên + giá).
- [ ] Unit: `newProductCalc(state)` (trống giá/vốn/ngành, giữ sàn + thiết lập shop), `createReady(name, calc)`.
