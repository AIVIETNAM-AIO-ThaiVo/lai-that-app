# F28 — Combo: bán theo bộ, so với bán lẻ, giảm tối đa

**Phase:** 10 (add-on 13/11/2026, `raw/addon/docs/ADDONS.md` C0–C7) · **Màn:** `#/combo`, `#/combo/chi-tiet`, `#/combo/<id>` · thiết kế `raw/addon/docs/ui/A1-Combo`, `A2-ChiTietCombo`
**Công thức:** `raw/addon/tools/addons.py` (bản tham chiếu, chép ở `tools/addons.py`) → `app/addons.js`; ca kiểm thử `app/test/addon_vectors.json` (sinh từ addons.py).

Phí % tính trên giá đã giảm của **từng món** theo ngành của món; phí **mỗi đơn** (hạ tầng, PiShip), đóng gói, ship người mua trả tính **một lần** cho cả combo; Voucher Xtra trần 50.000đ **mỗi sản phẩm** (chế độ Sản phẩm bộ: trần một lần). Phần giảm chia cho từng món theo tỷ lệ giá trị.

## Done when
- [ ] Engine `combo`, `separate`, `comboMaxDiscount`, `comboPriceForMargin` khớp mọi ca combo + giảm tối đa trong `app/test/addon_vectors.json` (CB2–CB7, CB4) tới 0,5đ; giảm 100% / giá ≤ 0 → báo lỗi nhập (CB8).
- [ ] Tab Tính có chip thứ ba **Combo** (nhãn PRO) cạnh "Từ giá bán", "Từ % lãi" → `#/combo`. Danh mục có nút `#make-combo` "Tạo combo" khi đã lưu ≥ 2 sản phẩm.
- [ ] **Miễn phí (C0):** `#/combo` hiện ví dụ mẫu 3 móc khóa giảm 10%: giá 45.900đ, lãi 6.614đ · 14,4%, dòng "Bán lẻ 3 đơn: 1.515đ · Combo +5.099đ" — chỉ xem; chạm sửa ô nào cũng mở paywall (`paywall_view {trigger: combo_tab}`).
- [ ] **Pro (C1–C3):** dựng combo 2–5 món: thêm từ danh mục (`#add-item` → sheet chọn sản phẩm đã lưu, giá vốn/ngành tự điền) hoặc nhập nhanh; số lượng `−/+` từng dòng; chế độ `#combo-mode-promo` Khuyến mãi combo / `#combo-mode-addon` Mua kèm / `#combo-mode-bundle` Sản phẩm bộ; kiểu giảm 3 tab `#disc-percent` · `#disc-amount` · `#disc-fixed`; Shopee báo khi dưới mức tối thiểu (giảm 5% hoặc 10.000đ, từ 2 sản phẩm). Đóng gói, ship người mua trả tính 1 lần.
- [ ] **Kết quả dính đáy (C4–C5):** lãi combo + % + chữ trạng thái; "Bán lẻ N đơn: X · Combo ±Y"; "Sàn + thuế lấy A% thay vì B% khi bán lẻ"; nút "Xem chi tiết".
- [ ] **Chi tiết (C6):** bảng phí có nhãn "mỗi SP" / "mỗi đơn"; giảm tối đa giữ lãi 20% / 10% / hòa vốn (làm tròn **xuống** % nguyên); dưới mức tối thiểu của sàn thì nói rõ lãi ở mức 5%; giá combo gợi ý giữ lãi 20% (làm tròn **lên** giá đẹp).
- [ ] **Lưu (C7):** `#combo-save` → Danh mục có dòng nhãn "Bộ · N món"; món lấy từ danh mục liên kết theo id: sửa giá vốn sản phẩm thì combo tính lại; xoá sản phẩm thì combo giữ bản sao và ghi "món gốc đã xoá". Báo động đổi phí và sắp xếp lãi thấp dùng chung. Hết Pro: combo đã lưu vẫn hiện (chỉ xem).
- [ ] Tracking: `combo_built`, `combo_vs_separate_viewed`, `combo_max_discount_viewed`, `combo_saved` đúng tham số trong `docs/tracking_plan.csv`; không gửi giá, tên sản phẩm. Không quảng cáo trên màn combo.
