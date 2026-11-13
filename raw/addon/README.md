# Lãi Thật Add-on: Combo & Kiểm tra đơn (bản 1.1–1.2)

Gói này chỉ chứa phần add-on. Không nằm trong bản nộp 15/11.

| Add-on | Gói | Tóm tắt |
|---|---|---|
| Combo | **Pro toàn bộ** (miễn phí chỉ xem ví dụ mẫu 3 móc khóa) | Lãi khi bán theo bộ / mua kèm / sản phẩm bộ, so với bán lẻ, mức giảm tối đa. 3 móc khóa: bán lẻ 1.515đ → combo −10% 6.614đ |
| Kiểm tra đơn | Nhập tay 1 đơn: miễn phí · File Báo Cáo Doanh Thu nhiều đơn: Pro (bản 1.2) | So từng khoản sàn trừ với biểu phí, chỉ ra khoản lệch, lý do và nút sửa |

Thanh dưới từ bản 1.1: **Tính · So sánh · Sản phẩm · Kiểm tra · Cài đặt**.

## Nội dung

```
docs/ADDONS.md               tài liệu đầy đủ (tính năng, luồng, công thức, so khớp, tracking, kiếm tiền, ca kiểm thử, nguồn)
docs/order_check_flow.png    sơ đồ luồng Kiểm tra đơn
docs/ui/A1–A4 *.dc.html      4 màn thiết kế (cũng có trên canvas "Lãi Thật: UI/UX Direction")
docs/tracking_addon.csv      10 sự kiện mới + nguồn paywall
tools/addons.py              bản tham chiếu Python
app/lib/engine/addons.dart   bản Dart (ComboEngine, OrderChecker)
app/test/addons_test.dart    test Dart
app/test/addon_vectors.json  19 ca sinh từ tools/addons.py
```

## Cách gắn vào repo

Các file dùng phần lõi đã có trong repo chính (launch kit), không đóng gói lại ở đây:

- `tools/addons.py` cần `tools/engine.py`
- `app/lib/engine/addons.dart` cần `app/lib/engine/fee_engine.dart`
- test cần `app/assets/fee_presets.json`

Chép thư mục `tools/`, `app/` vào gốc repo rồi chạy:

```bash
python3 tools/addons.py
python3 -c "import sys; sys.path.insert(0,'tools'); import addons; addons.write_vectors('app/test/addon_vectors.json')"
cd app && flutter test test/addons_test.dart
```

Bản Dart chưa được biên dịch trong lúc viết (máy làm việc không có Flutter): chạy test trước khi dựng màn hình.
