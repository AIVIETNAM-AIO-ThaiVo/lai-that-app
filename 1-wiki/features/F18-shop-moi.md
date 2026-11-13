# F18 — Miễn phí cố định 30 ngày cho shop mới

**Phase:** 3 (P1) · **Nguồn:** [fees/shopee.md](../fees/shopee.md) (miễn phí cố định 30 ngày, tối đa 200 đơn)

13/11: **bỏ phần Shopee Mall / TikTok Mall** (PO: không phải người dùng mục tiêu, chưa triển khai được — biểu phí Mall chưa có nguồn chính thức). App chỉ tính cho shop thường; không có chip, sheet hay gợi ý Mall.

## Done when
- [ ] Không còn lựa chọn Mall ở màn Chọn sàn, sheet chọn sàn, chip sàn ("Shopee", không kèm "Shop thường"); không có `#mall-hint` / `#mall-note`.
- [ ] Cài đặt có `#new-shop` "Shop mới (miễn phí cố định 30 ngày, tối đa 200 đơn)" — chỉ Shopee; bật thì phí cố định ngành = 0: móc khóa lãi 3.225đ.
- [ ] `ratesFor` bỏ phí ngành khi `newShopPromo` bật và sàn có `new_seller_promo` (unit test).
