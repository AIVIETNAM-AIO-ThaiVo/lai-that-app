# F4 — Tính lãi từ giá bán

**Phase:** 1 · **Màn:** S2 `#/tinh` · **Canvas:** `design-canvas/S2-TinhNhanh.dc.html`

## Done when
- [ ] Chọn ngành "Sở thích & Sưu tầm" (16%), gõ `#cost` 8000, `#price` 17000, `#pack` 1500 → `#profit` = "505đ", `#state-label` "Lãi mỏng", `#margin` "3,0%", `#breakeven` chứa "16.340đ" — **không có nút "Tính"**, kết quả đổi khi gõ.
- [ ] Ô tiền tự chèn dấu chấm nghìn ("17.000"); khi đang gõ có thanh phụ với phím `000`.
- [ ] Thẻ kết quả `#result` dính đáy màn (position sticky/fixed) và có `data-state` good/thin/loss.
- [ ] Dải "tiền đi đâu" `#money-bar` có 3 đoạn: Sàn + thuế 41% · Vốn + gói 56% · Lãi 3%.
- [ ] Mã giảm giá shop `#voucher` theo đ hoặc % (`#voucher-unit`) và ship người mua trả `#ship-buyer` làm đổi kết quả đúng công thức (đơn J: giảm 18.000đ).
- [ ] Giá bán 12.000, vốn 6.000, 16,5% (Kẹp tóc) → "Lỗ", `#profit` "−1.380đ".
- [ ] Nhớ sàn, ngành, giá vốn, đóng gói của lần trước sau khi tải lại.
- [ ] Không có quảng cáo trên màn Tính lãi. Event `calc_completed` (debounce 1,5 giây) với `state`, `margin_bucket`, không có giá.
