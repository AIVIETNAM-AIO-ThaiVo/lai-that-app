# F22 — Lãi của mỗi sản phẩm trên mọi sàn bạn bán

**Phase:** 6 (phản hồi người dùng 13/11/2026, lần 3) · **Màn:** `#/san-pham`, `#/san-pham/<id>`, `#/san-pham/moi`, `#/cai-dat`

Vấn đề: mỗi sản phẩm trong danh mục chỉ có lãi trên **một** sàn. Chủ shop bán cùng một món trên Shopee, TikTok Shop, Lazada
muốn thấy lãi ở **tất cả** sàn mình bán, ngay trong danh mục.

Quyết định:
- **Sàn bạn bán** (`state.sellPlatforms`): mặc định lấy từ onboarding — chọn "Nhiều sàn" → cả 3 sàn; chọn 1 sàn → chỉ sàn đó.
  Sửa ở Cài đặt (bật/tắt từng sàn, luôn còn ít nhất 1).
- Sản phẩm giữ **sàn chính** như cũ (`product.input`). Mỗi sàn khác có **kênh** riêng `product.channels[sàn] = { categoryName, categoryRate, price }`.
  Chưa nhập thì tự gợi ý giống màn So sánh: TikTok Shop theo nhóm ngành gợi ý, Shopee theo cùng tên ngành, Lazada theo % hoa hồng
  đã nhập ở So sánh (chưa có → "cần % phí"). Giá bán mặc định = giá trên sàn chính. Vốn, đóng gói, chi phí khác dùng chung.
- Chỉ có 1 sàn → danh mục và màn sản phẩm y như trước.

## Done when
- [ ] Cài đặt có "Sàn bạn bán": `#sell-shopee` `#sell-tiktok_shop` `#sell-lazada` (bật/tắt, không tắt được sàn cuối cùng). Onboarding "Nhiều sàn" → cả 3 bật.
- [ ] Danh mục: mỗi thẻ sản phẩm có một dòng cho **từng sàn đang bán** (`.channel-row[data-platform]`): tên sàn, lãi mỗi đơn, chữ trạng thái (Lãi / Lãi mỏng / Lỗ); sàn chưa đủ % phí ghi "cần % phí".
- [ ] Sắp xếp và bộ lọc "Đang lỗ" / "Lãi mỏng" tính theo sàn **tệ nhất** của sản phẩm (lỗ ở một sàn là vào nhóm "Đang lỗ").
- [ ] Màn sản phẩm (và Sản phẩm mới) có thẻ `#channels` "Lãi trên các sàn bạn bán"; chạm một sàn phụ → `#channel-sheet` sửa ngành hàng, % phí, giá bán trên sàn đó; lưu sản phẩm thì giữ các kênh.
- [ ] Lãi từng sàn khớp màn So sánh với cùng ngành / % phí (cùng một hàm dựng đầu vào theo sàn).
- [ ] Báo động đổi phí (F11) xét mọi sàn đang bán: sản phẩm chuyển sang lỗ ở bất kỳ sàn nào đều được báo.
- [ ] Unit: `sellPlatforms`, `channelInput`, `catalogView(…, platforms)` (kênh, sàn tệ nhất, lọc), `diffCatalog(…, platforms)`, `updateProduct` giữ kênh.
