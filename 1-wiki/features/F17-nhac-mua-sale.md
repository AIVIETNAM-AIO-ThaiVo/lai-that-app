# F17 — Nhắc mùa sale

**Phase:** 3 (P1) · **Màn:** Cài đặt + băng nhắc trên Danh mục

Ngày sale lớn: các ngày "trùng số" mỗi tháng (1.1 … 12.12) [ASSUMPTION — lịch chung của các sàn, cần PO xác nhận] .

## Done when
- [ ] `nextSale(new Date('2026-11-12'))` → 12/12/2026, còn 30 ngày; `nextSale(2026-12-13)` → 01/01/2027 (unit test).
- [ ] `saleReminderDue(today, sale)` đúng khi còn ≤ 3 ngày (unit test).
- [ ] Cài đặt có `#sale-reminders` (bật/tắt) và dòng "Sale gần nhất: 12.12 · còn 30 ngày".
- [ ] Khi đến hạn nhắc: `#sale-banner` trên Danh mục "Còn 3 ngày tới 12.12 — kiểm tra giá Flash Sale" + mục trong hộp thông báo.
