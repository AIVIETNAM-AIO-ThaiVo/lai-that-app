# F5 — Tính từ % lãi muốn có (giá nên bán)

**Phase:** 1 · **Màn:** S4 `#/tinh` (tab `#mode-margin`) · **Canvas:** `design-canvas/S4-TinhNguoc.dc.html`

## Done when
- [ ] Chạm `#mode-margin` (role=tab, aria-selected): có chip 10/15/20/25/30%, chip 20% chọn sẵn, ghi "20% là mức nhiều shop chọn làm chuẩn".
- [ ] Móc khóa ở 20%: `#nice-price` "22.900đ", `#nice-profit` chứa "Lãi 5.018đ" và "21,9%" và "tối thiểu 22.124đ"; `#breakeven-margin` "16.340đ".
- [ ] Nhập số tiền lãi mong muốn thay cho % (`#margin-amount-toggle` → `#target-amount` 5000) ra giá nên bán tương ứng.
- [ ] Mức lãi không thể đạt (mẫu số ≤ 0) hiện "Không thể đạt mức lãi này".
- [ ] `#apply-price` "Dùng giá 22.900đ" → về tab Từ giá bán với `#price` = 22.900 và lãi 5.018đ; event `nice_price_applied {target_margin}`.
