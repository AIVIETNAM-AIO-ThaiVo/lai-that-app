# F16 — Áp giá gợi ý 1 chạm cho nhiều sản phẩm

**Phase:** 3 (P1) · **Màn:** Danh mục

## Done when
- [ ] `applySuggested(products, ids, presets)` đổi giá các sản phẩm đã chọn sang giá gợi ý (giá đẹp giữ lãi 20%), giữ nguyên đầu vào khác (unit test).
- [ ] Trên Danh mục: `#bulk-mode` → chọn các sản phẩm đang lỗ (mặc định chọn sẵn) → `#apply-suggested` "Áp giá gợi ý cho 2 sản phẩm".
- [ ] Sau khi áp: Kẹp tóc 18.900đ, Ốp điện thoại 34.900đ; không còn sản phẩm lỗ; `#toast` báo số sản phẩm đã đổi giá; hoàn tác được trong 5 giây (`#undo-apply`).
