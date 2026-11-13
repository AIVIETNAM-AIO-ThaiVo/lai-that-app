# Báo cáo đối chiếu bộ máy tính với đơn thật

Ngày: 12/11/2026 · Bộ máy tính v2 (`tools/engine.py`, `app/lib/engine/fee_engine.dart`) · Biểu phí `fee_version` 2026-11-12.1

## Cách làm

1. Lấy màn "Chi tiết doanh thu" của đơn Shopee thật mà người bán chia sẻ công khai: 2 video YouTube và 6 ảnh trong nhóm Facebook "Shopee người bán – chia sẻ kinh nghiệm bán hàng". Chỉ đọc, không tương tác; không ghi tên khách hay mã đơn.
2. Nhập đúng giá, mã giảm giá shop, ship người mua trả, ngành, chương trình của từng đơn vào bộ máy tính. Giá vốn = 0 vì sàn không biết giá vốn.
3. So "sàn trừ" = phụ phí + thuế trên màn của sàn với số app tính. Đạt khi lệch dưới 1% giá bán.

## Kết quả: 8/8 đơn Shopee đạt

| Đơn | Giá | Đặc điểm | Sàn trừ thực tế | App tính | Lệch |
|---|---|---|---|---|---|
| A keo sữa | 74.692đ | ship người mua 21.500đ, PiShip, affiliate, phí hiển thị | 34.298đ | 34.297đ | −1đ |
| B đệm topper | 325.000đ | ship người mua 34.500đ, Voucher Xtra | 99.320đ | 99.320đ | 0 |
| F đồ điện tử | 650.000đ | mã giảm giá shop 3.000đ, ngành 12% | 131.865đ | 131.865đ | 0 |
| G thức ăn mèo | 170.000đ | ship người mua 146.900đ, không GTGT | 56.014đ | 56.014đ | 0 |
| H thức ăn mèo | 180.000đ | Voucher Xtra | 51.600đ | 51.600đ | 0 |
| I mỹ phẩm | 275.000đ | ngành 17%, PiShip | 88.200đ | 88.200đ | 0 |
| J thời trang | 450.000đ | mã giảm giá shop 18.000đ, affiliate | 167.572đ | 167.572đ | 0 |
| K thời trang | 350.000đ | ship người mua 32.800đ, phí hiển thị | 111.998đ | 111.998đ | 0 |

Lệch 1đ ở đơn A là do sàn làm tròn từng dòng.

## Công thức cũ sai ở đâu (đã sửa)

| Lỗi | Bằng chứng | Ảnh hưởng nếu không sửa |
|---|---|---|
| Phí xử lý giao dịch chỉ tính trên giá | Học viện Shopee bài 2150; đơn A: (74.692 + 21.500) × 6% = 5.772đ | Đơn A lệch 12,9% giá bán |
| Chưa trừ mã giảm giá shop trước khi tính % | Đơn J: (450.000 − 18.000) × 16,5% = 71.280đ | Lệch theo cỡ voucher |
| Thiếu PiShip 2.700đ và phí hiển thị 1,08% | Đơn A, F, I, J (PiShip); A, K (phí hiển thị) | Lệch 0,5–1,4% giá bán |

## Giới hạn

- TikTok Shop: mới có 1 đơn đủ chi tiết (15/10/2026). Phí giao dịch 4,25% vì shop dùng chương trình tiết kiệm phí; phí xử lý đơn 2.550đ thay vì 3.000đ. App cho sửa từng dòng phí TikTok và ghi rõ "chưa đối chiếu đủ đơn thật".
- Lazada: chưa có đơn thật; hoa hồng do người dùng nhập.
- Thuế GTGT 1% không bị khấu trừ ở 1 đơn (G); để công tắc.

## Chạy lại

```bash
python3 tools/validate.py     # in bảng trên và ghi app/test/test_vectors.json
cd app && flutter test        # cùng 8 đơn + 7 ca thiết kế, chạy trên bản Dart
```
