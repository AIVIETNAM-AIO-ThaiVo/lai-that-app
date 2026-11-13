# F29 — Kiểm tra đơn: nhập tay 1 đơn, so từng khoản, chẩn đoán, sửa ngay

**Phase:** 10 (add-on 13/11/2026, `raw/addon/docs/ADDONS.md` K1–K3) · **Màn:** tab mới **Kiểm tra** `#/kiem-tra`, kết quả `#/kiem-tra/ket-qua` · thiết kế `raw/addon/docs/ui/A3-KiemTraDon`, `A4-KetQuaKiemTra`
**Quy tắc so khớp:** `check_order` trong `raw/addon/tools/addons.py` → `checkOrder` trong `app/addons.js`. Miễn phí.

Thanh dưới thành 5 tab: **Tính · So sánh · Sản phẩm · Kiểm tra · Cài đặt**. Bản này chỉ Shopee; TikTok Shop / Lazada ghi "sắp có" (chưa đủ đơn thật).

## Done when
- [ ] `checkOrder` khớp mọi ca KD1–KD6 trong `app/test/addon_vectors.json` (trạng thái, số khoản lệch, tổng lệch, trạng thái + lý do từng dòng). Ngưỡng: Khớp nếu |lệch| ≤ 1đ × số sản phẩm + 1đ; Lệch nhỏ nếu ≤ 100đ và ≤ 1%; còn lại Lệch; đơn có hoàn tiền/điều chỉnh là "Có điều chỉnh".
- [ ] `#/kiem-tra`: chọn sản phẩm đã lưu (`#check-product`, để biết ngành + chương trình) hoặc gõ % ngành; form đúng thứ tự màn Doanh thu đơn hàng của Shopee: NGƯỜI MUA TRẢ (giá sản phẩm, mã giảm giá shop, ship khách trả, hoàn tiền) · SÀN TRỪ (phí cố định, phí dịch vụ, phí giao dịch, PiShip, phí hiển thị, thuế GTGT, thuế TNCN, hoa hồng tiếp thị liên kết); ô trống là 0; `#check-run` "Kiểm tra" luôn bấm được khi có giá.
- [ ] `#/kiem-tra/ket-qua`: dải trạng thái trên cùng (Khớp / Lệch nhỏ / "Lệch N khoản · sàn trừ nhiều hơn X" / Có điều chỉnh) + câu trung tính "So với biểu phí bạn đang dùng…"; bảng **Khoản · Sàn trừ · Biểu phí · Lệch**; dòng lệch có câu chẩn đoán ngay dưới và nút hành động: Cập nhật ngành X% · Bật Voucher Xtra · Bật phí hiển thị · Bật PiShip · Tắt/Bật GTGT.
- [ ] Bấm nút hành động mới đổi cài đặt của sản phẩm đã lưu (không tự sửa); kiểm tra lại ngay → dòng đó Khớp; danh mục và báo động tính lại.
- [ ] `#copy-complaint` "Sao chép nội dung khiếu nại": mã đơn (người dùng gõ), khoản phí, số đã trừ, số theo biểu phí kèm ngày áp dụng, chênh lệch; giọng trung tính, người bán tự gửi.
- [ ] Cuối màn: lãi thật của đơn theo giá vốn đã lưu so với lãi dự tính.
- [ ] Tracking: `order_check_started`, `order_check_completed`, `mismatch_reason_viewed`, `category_rate_updated_from_check`, `complaint_template_copied` đúng tham số; không gửi số tiền, mã đơn, tên sản phẩm. Không quảng cáo trên màn nhập đơn.
