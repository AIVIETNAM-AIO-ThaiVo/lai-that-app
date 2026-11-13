# F12 — Tracking theo TRACKING_PLAN

**Phase:** 2 · **Spec:** `docs/TRACKING_PLAN.md` · **Bản web:** log cục bộ (ADR-001), cùng tên và thuộc tính để nối Firebase sau

## Done when
- [ ] `EVENTS` trong code đúng bằng danh sách sự kiện của `docs/TRACKING_PLAN.md`; `track` từ chối tên lạ (unit test đọc file plan).
- [ ] `track` loại thuộc tính không có trong plan cho sự kiện đó và không bao giờ ghi giá, giá vốn, tên sản phẩm (unit test).
- [ ] `marginBucket`: <0 / 0–5 / 5–10 / 10–20 / >20 đúng ngưỡng.
- [ ] `calc_completed` chỉ ghi 1 lần cho một bộ đầu vào, sau khi ngừng gõ 1,5 giây (unit test với đồng hồ giả).
- [ ] Trên bot: một lượt dùng đi qua phễu `onboarding_completed → calc_completed → product_saved`.
