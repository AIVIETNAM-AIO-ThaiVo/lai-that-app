# F3 — Chọn sàn chính (onboarding)

**Phase:** 1 · **Màn:** S1 `#/chon-san` · **Canvas:** `design-canvas/S1-ChonSan.dc.html`
Chỉ shop thường (13/11: bỏ Mall — không phải người dùng mục tiêu, chưa có biểu phí Mall có nguồn). Không hỏi loại shop.

## Done when
- [ ] Mở lần đầu thấy 4 lựa chọn `#pf-shopee` `#pf-tiktok_shop` `#pf-lazada` `#pf-multi` (role=radio); không có lựa chọn loại shop / Mall.
- [ ] Chưa chọn sàn thì `#onboard-continue` bị vô hiệu; chọn rồi thì có `aria-checked="true"`.
- [ ] Mỗi lựa chọn ghi ngày biểu phí lấy từ biểu phí (ví dụ "Biểu phí từ 23/05/2026 · 31 ngành").
- [ ] Có câu "Ứng dụng độc lập, không liên kết với Shopee, TikTok hay Lazada".
- [ ] Tiếp tục → `#/tinh` với sàn đã chọn; tải lại trang vào thẳng `#/tinh` (nhớ lựa chọn). Máy cũ lỡ lưu Mall thì tự về shop thường.
- [ ] Event `onboarding_completed {primary_platform}`.
