# F10 — Danh mục sản phẩm

**Phase:** 2 · **Màn:** S7 `#/san-pham` · **Canvas:** `design-canvas/S7-DanhMuc.dc.html` · **Gói:** 5 miễn phí / Pro không giới hạn (khoá bật từ Phase 8, F24)

## Done when
- [ ] Tính nhanh `#save-product` → nhập tên `#product-name` → `#save-confirm` lưu thành sản phẩm mới (đầu vào đầy đủ) vào máy; còn sau khi tải lại.
- [ ] Danh mục sắp **lãi thấp nhất lên đầu**: Kẹp tóc −1.380đ (Lỗ −11,5%) · Ốp điện thoại −125đ (Lỗ −0,5%) · Móc khóa 505đ (Lãi mỏng 3,0%) · Áo thun 41.061đ.
- [ ] Sản phẩm lỗ / lãi mỏng có `.suggested` "gợi ý 18.900đ" (giá đẹp giữ lãi 20%).
- [ ] Bộ lọc `#filter-all` / `#filter-loss` "Đang lỗ · 2" / `#filter-thin` "Lãi mỏng · 1".
- [ ] `#catalog-count` "4/5 miễn phí"; `canSave` chặn sản phẩm thứ 6 khi `pro_gates_enabled` bật (unit test).
- [ ] Chạm một sản phẩm mở màn chi tiết sản phẩm (F19) với đúng đầu vào; event `product_saved {catalog_size, state}`, `catalog_sorted_alert {loss_count_bucket}`.
