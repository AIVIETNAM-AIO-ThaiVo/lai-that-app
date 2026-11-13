# F1 — Bộ máy tính phí sàn (engine)

**Phase:** 1 · **Spec:** [engine/formula.md](../engine/formula.md), [engine/test-cases.md](../engine/test-cases.md) · **File:** `app/engine.js` (hàm thuần, port 1–1 `tools/engine.py`)

## Done when
- [ ] 8 đơn Shopee thật trong `app/test/test_vectors.json`: tổng sàn trừ (phí + thuế + affiliate) lệch < 1% giá bán và ≤ 2đ.
- [ ] Móc khóa Shopee (16%, vốn 8.000, bán 17.000, gói 1.500): lãi 505đ, trạng thái "thin", sàn + thuế 41%.
- [ ] `priceForMargin`: hòa vốn 16.340đ, giá 20% = 22.124đ; `nicePrice(22124)` = 22.900; ở 22.900đ lãi 5.018đ.
- [ ] TikTok Shop 13% cùng đầu vào: lãi 1.015đ; hòa vốn 15.724đ.
- [ ] Áo thun (16,5%, vốn 60.000, bán 149.000, gói 3.000, hoàn 8%, mất 30.000/đơn hoàn): 41.061đ; bật Voucher Xtra: 33.521đ.
- [ ] Nồi chiên 1.200.000đ bật Voucher Xtra: dòng voucher chạm trần 50.000đ. Mẫu số ≤ 0 → `priceForMargin` trả Infinity.
- [ ] `formatVnd(17000)` = "17.000đ", `formatVnd(-1380)` = "−1.380đ"; làm tròn chỉ khi hiển thị.
