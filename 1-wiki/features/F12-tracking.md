# F12 — Tracking theo docs/tracking_plan.csv

**Phase:** 2 · **Spec:** `docs/tracking_plan.csv` · **Bản web:** log cục bộ (ADR-001), cùng tên và thuộc tính để nối Firebase sau

## Done when
- [ ] `EVENTS` trong code đúng bằng danh sách sự kiện của `docs/tracking_plan.csv`; `track` từ chối tên lạ (unit test đọc file CSV).
- [ ] `track` loại thuộc tính không có trong plan cho sự kiện đó và không bao giờ ghi giá, giá vốn, tên sản phẩm (unit test).
- [ ] `marginBucket`: <0 / 0–5 / 5–10 / 10–20 / >20 đúng ngưỡng.
- [ ] `calc_completed` chỉ ghi 1 lần cho một bộ đầu vào, sau khi ngừng gõ 1,5 giây (unit test với đồng hồ giả).
- [ ] Trên bot: một lượt dùng đi qua phễu `onboarding_completed → calc_completed → product_saved`.
