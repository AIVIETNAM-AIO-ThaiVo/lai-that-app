# F14 — Chia sẻ kết quả qua Zalo

**Phase:** 3 (P1) · **Màn:** Tính lãi (thẻ kết quả)

## Done when
- [ ] `shareText(...)` gồm: sàn + ngành, giá bán, giá vốn, lãi mỗi đơn + trạng thái + %, sàn + thuế %, giá nên bán 20%, "Biểu phí cập nhật 12/11/2026", "Tính bằng Lãi Thật" (unit test).
- [ ] `#share-result` trên điện thoại mở bảng chia sẻ của máy (chọn Zalo); máy không chia sẻ được thì chép vào bộ nhớ tạm và `#toast` "Đã chép kết quả, dán vào Zalo".
- [ ] Event `share_result {channel}` (zalo / other — chép vào bộ nhớ tạm tính là other), không có giá trong thuộc tính.
