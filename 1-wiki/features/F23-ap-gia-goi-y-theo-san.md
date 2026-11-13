# F23 — Áp giá gợi ý theo từng sàn (chọn sàn)

**Phase:** 7 (trả lời PO 13/11/2026) · **Màn:** `#/san-pham` (chế độ "Áp giá gợi ý") · mở rộng F16 + F22

PO trả lời (13/11): "Áp giá gợi ý nên có cho chọn từng sàn, có phần chọn luôn. Giá vốn các thứ thì không cần."
→ Khi bán từ 2 sàn, chế độ Áp giá gợi ý có hàng chọn sàn; giá gợi ý tính riêng cho từng sàn. Vốn, đóng gói, chi phí khác vẫn dùng chung mọi sàn.

## Done when
- [ ] Bán ≥ 2 sàn: bấm `#bulk-mode` thấy hàng "Áp cho sàn" `#apply-on-shopee` `#apply-on-tiktok_shop` `#apply-on-lazada` (chỉ các sàn đang bán; mặc định chọn hết; bỏ chọn được nhưng luôn còn ít nhất 1). Bán 1 sàn: như F16, không có hàng này.
- [ ] Mỗi thẻ hiện từng sàn đã chọn: giá hiện tại → giá gợi ý (`.channel-row .suggested`); sàn đang Lãi (tốt) giữ giá; sàn chưa có % phí bỏ qua.
- [ ] Chọn sẵn sản phẩm đang lỗ ở sàn đã chọn; ô chọn bị khoá nếu không sàn đã chọn nào có giá gợi ý. Đổi lựa chọn sàn thì bỏ chọn sản phẩm không còn gì để áp.
- [ ] `#apply-suggested` "Áp giá gợi ý cho N sản phẩm" chỉ đổi giá trên sàn đã chọn: sàn chính đổi giá sản phẩm, sàn phụ đổi giá riêng của sàn đó; sàn không chọn giữ nguyên. Toast ghi tên sàn; hoàn tác được (`#undo-apply`).
- [ ] Unit: `applySuggested(state, ids, presets, now, { platforms, lazadaRate })`; `channelsView` có `sugPrice` cho sàn chưa lãi tốt.
