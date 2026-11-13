# Ca kiểm thử

Nguồn sự thật: `app/test/test_vectors.json` (8 đơn thật, sinh bởi `tools/validate.py`) và `app/test/fee_engine_test.dart`.

| Ca | Đầu vào | Kỳ vọng |
|---|---|---|
| Móc khóa Shopee | Sở thích & Sưu tầm 16%, vốn 8.000, bán 17.000, gói 1.500 | lãi 505đ (3,0%, lãi mỏng), sàn + thuế 41%, hòa vốn 16.340đ, giá 20% = 22.124đ → giá đẹp 22.900đ lãi 5.018đ |
| Flash Sale | như trên, giá 22.900đ | giảm 10%: 3.267đ; 20%: 1.515đ; 30%: −237đ; giá nhập tối đa giữ 20%: 8.438đ |
| Móc khóa TikTok | 13% | lãi 1.015đ, hòa vốn 15.724đ |
| Áo thun | 16,5%, vốn 60.000, bán 149.000, gói 3.000, hoàn 8%, mất 30.000/đơn hoàn | 41.061đ; + Voucher Xtra 33.521đ; ROAS hòa vốn 3,34 → 4,09; ads tối đa 44.631 → 36.436đ/đơn |
| Kẹp tóc | 16,5%, vốn 6.000, bán 12.000, gói 1.500 | −1.380đ (lỗ); giá gợi ý 20%: 18.900đ |
| Ốp điện thoại | 15%, vốn 15.000, bán 25.000, gói 1.500 | −125đ; giá gợi ý 20%: 34.900đ |
| Nồi chiên | 11%, vốn 750.000, bán 1.200.000, Voucher Xtra | phí voucher chạm trần 50.000đ |
| 8 đơn thật A–K | xem raw/orders/real_orders.csv | lệch < 1% giá bán (thực tế 0–1đ) |
