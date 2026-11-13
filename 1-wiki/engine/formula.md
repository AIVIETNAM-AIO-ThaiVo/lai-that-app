# Công thức bộ máy tính (v2, 12/11/2026)

Nguồn kiểm chứng: 8 đơn Shopee thật trong raw/orders/real_orders.csv, Học viện Shopee bài 2150 (phí xử lý giao dịch), bài 2139 (phí cố định).

## Ký hiệu

| Ký hiệu | Nghĩa | Mặc định |
|---|---|---|
| P | Giá niêm yết | người dùng nhập |
| V_s | Mã giảm giá của shop (đồng; nếu nhập % thì V_s = % × P) | 0 |
| B | P − V_s, cơ sở của mọi phí % và thuế | |
| S | Phí ship người mua trả | 0 |
| c | % phí cố định (Shopee) / hoa hồng (TikTok) theo ngành | theo fee_presets |
| t | % phí xử lý giao dịch | 6% |
| v, cap | % chương trình voucher (Voucher Xtra 5,5% / VXP 4%), trần mỗi sản phẩm | tắt; cap 50.000đ |
| vis | Phí dịch vụ hiển thị (Shopee, trừ từ doanh thu đơn) | tắt; 1,08% |
| F_s | Phí cố định mỗi đơn: hạ tầng/xử lý đơn 3.000đ + PiShip 2.700đ nếu bật | 3.000đ |
| tax | GTGT 1% + TNCN 0,5% sàn khấu trừ (NĐ 117/2025), mỗi phần bật/tắt được | 1,5% |
| a | % hoa hồng affiliate | 0 |
| ROAS | Doanh thu / tiền quảng cáo → ads = B / ROAS | không có |
| C, K | Giá vốn, đóng gói mỗi đơn | người dùng nhập |
| r, R | Tỷ lệ đơn hoàn, tiền mất mỗi đơn hoàn | 0 |

TikTok, shop đã đăng ký và xác minh MST: c, t, F_s chia cho 1,1.

## Công thức

```
V_amt     = min(v·B, cap)
Phí sàn   = c·B + t·(B + S) + V_amt + vis·B + F_s
Thuế      = tax·B
Khác      = (a + 1/ROAS)·B
Tiền về   = B − Phí sàn − Thuế − Khác
Lãi đơn thành công = Tiền về − C − K
Lãi kỳ vọng        = (1 − r)·Lãi đơn thành công − r·R
% lãi              = Lãi kỳ vọng / B
Sàn + thuế lấy     = (Phí sàn + Thuế) / B
```

Trạng thái hiển thị: Lỗ nếu lãi < 0; Lãi mỏng nếu % lãi < 10%; còn lại là Lãi.

## Tính ngược

Với k = c + t + vis + a + tax + 1/ROAS và X = F_s + t·S + C + K:

```
B(m) = ((1 − r)·X + r·R) / ((1 − r)·(1 − k − v) − m)
Nếu v·B(m) > cap:  B(m) = ((1 − r)·(X + cap) + r·R) / ((1 − r)·(1 − k) − m)
Mẫu số ≤ 0 → không đạt được mức lãi này (hiện "không thể").
Hòa vốn = B(0). Giá niêm yết = B(m) + V_s.
```

Giá đẹp: dưới 100.000đ làm tròn lên x.900đ (22.124 → 22.900); từ 100.000đ làm tròn lên x9.000đ. Luôn hiện lại lãi ở giá đã làm tròn.

## Công cụ thêm

- Flash Sale giảm d: tính lại với V_s mới = V_s + d·B.
- Giá nhập tối đa giữ lãi m: C_max = ((1 − r)·(Tiền về − K) − r·R − m·B) / (1 − r).
- ROAS hòa vốn: tiền ads tối đa mỗi đơn = Lãi đơn thành công (chưa ads) − r·R/(1 − r); ROAS = B / số đó.
- Lãi tháng = Lãi kỳ vọng × số đơn/tháng.

## Làm tròn hiển thị (ghi nhận khi build bản web, 12/11/2026)

Số thiết kế (5.018đ ở giá 22.900đ, giá nhập tối đa 8.438đ) sinh từ `round()` của Python = **làm tròn nửa về số chẵn**
(giá trị thật 5.018,5 và 8.438,5). Bản web dùng đúng quy tắc này (`roundVnd` trong `app/engine.js`).
Bản Dart dùng `.round()` (nửa ra xa số 0) sẽ ra 5.019 / 8.439 — xem `4-memory/po-questions.md`.

## Điều chưa chắc

- Đơn G (thức ăn mèo) chỉ bị khấu trừ TNCN 0,5%, không có GTGT 1%; đơn H cùng loại hàng thì có. Để công tắc GTGT cho người dùng.
- Phí hiển thị 1,08% chỉ thấy ở 2/8 đơn. Mặc định tắt.
- TikTok: đơn thật 15/10/2026 có phí giao dịch 4,25% (chương trình tiết kiệm phí) và phí xử lý đơn 2.550đ. Cho sửa từng dòng.
