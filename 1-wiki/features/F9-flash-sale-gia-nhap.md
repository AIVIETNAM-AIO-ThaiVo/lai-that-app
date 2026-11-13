# F9 — Flash Sale & giá nhập tối đa

**Phase:** 2 · **Màn:** S4 (tab Từ % lãi) · **Gói:** Pro / quảng cáo thưởng — khoá **bật** từ Phase 8 (`pro_gates_enabled: true`, F24/F25)

## Done when
- [ ] Móc khóa ở giá 22.900đ: `#flash-sale` có 3 `.flash-row`: giảm 10% → 20.610đ lãi 3.267đ (15,8%) · 20% → 18.320đ 1.515đ "Mỏng 8,3%" · 30% → 16.030đ −237đ "Lỗ".
- [ ] `#max-cost` "Giá nhập tối đa: 8.438đ" để vẫn giữ lãi 20% ở giá 22.900đ.
- [ ] `isLocked('flash_sale', state, config)`: khoá khi `pro_gates_enabled` bật và chưa Pro/chưa xem quảng cáo thưởng; mở khi tắt cờ (unit test).
- [ ] Event `flash_sale_viewed {unlock_method}` và `max_cost_viewed {unlock_method}`.
