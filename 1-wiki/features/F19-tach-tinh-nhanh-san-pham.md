# F19 — Tách Tính nhanh và Sản phẩm

**Phase:** 4 (phản hồi người dùng 13/11/2026) · **Màn:** `#/tinh` (Tính nhanh) · `#/san-pham/<id>` (chi tiết sản phẩm)

Vấn đề: màn Tính vừa là máy tính nháp vừa là nơi sửa sản phẩm đã lưu ("Cập nhật sản phẩm", "+ Sản phẩm mới") → nhập nhằng.
Quyết định: **Tính nhanh** là nháp, không gắn sản phẩm nào. **Sản phẩm** là danh mục theo dõi; mỗi sản phẩm có màn riêng,
sửa trên bản nháp riêng và chỉ ghi khi bấm "Lưu thay đổi".

## Done when
- [ ] Tab Tính có tiêu đề "Tính nhanh", không có tên sản phẩm, không có nút "+ Sản phẩm mới"; `#save-product` "Lưu thành sản phẩm" luôn tạo sản phẩm **mới** (lưu 2 lần → 2 sản phẩm).
- [ ] Chạm một sản phẩm trong danh mục → `#/san-pham/<id>`: tiêu đề là tên sản phẩm, có nút quay lại danh mục, tab "Sản phẩm" đang sáng.
- [ ] Sửa giá ở màn sản phẩm không đổi số trong Tính nhanh, và ngược lại.
- [ ] `#product-save` "Lưu thay đổi" chỉ bấm được khi có thay đổi; lưu xong danh mục hiện lãi mới.
- [ ] Rời màn sản phẩm khi chưa lưu → hỏi: `#leave-save` "Lưu" / `#leave-discard` "Bỏ thay đổi".
- [ ] `#product-delete` (bấm 2 lần) xoá sản phẩm và về danh mục; `#product-to-calc` "Thử trong Tính nhanh" chép số sang Tính nhanh (không gắn).
- [ ] Chi tiết phí / Chi phí ẩn mở từ màn sản phẩm (`#/san-pham/<id>/chi-tiet`, `/chi-phi-an`) sửa đúng sản phẩm đó và quay lại đúng màn.
- [ ] Unit: `productToCalc`, `updateProduct` (đổi tên + đầu vào, giữ id, không ghi `product_saved`).
