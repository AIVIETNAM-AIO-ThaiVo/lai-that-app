# F8 — Chi phí ẩn: hoàn hàng, voucher, quảng cáo

**Phase:** 2 · **Màn:** S6 `#/chi-phi-an` · **Canvas:** `design-canvas/S6-ChiPhiAn.dc.html`

## Done when
- [ ] Áo thun nữ (Thời Trang Nữ 16,5%, vốn 60.000, bán 149.000, gói 3.000): chỉ phí sàn 47.240đ; bật `#hc-return` 8%, mất 30.000đ/đơn hoàn → 41.061đ.
- [ ] Bật thêm `#hc-voucher` (Voucher Xtra) → `#hc-profit` "33.521đ" "Lãi · 22,5%", `#hc-diff` "Thấp hơn 13.719đ so với chỉ tính phí sàn".
- [ ] `#roas-breakeven` "4,09" và `#max-ads` "36.436đ/đơn"; khi tắt voucher là 3,34 và 44.631đ.
- [ ] Bật `#hc-ads` với `#roas` 8 thì lãi trừ thêm 149.000/8 mỗi đơn; `#affiliate-rate` % trừ trên giá sau mã giảm giá.
- [ ] Chi phí ẩn lưu theo sản phẩm đang tính và áp vào màn Tính lãi; event `hidden_costs_set {has_return_rate, has_roas, has_affiliate}`.
