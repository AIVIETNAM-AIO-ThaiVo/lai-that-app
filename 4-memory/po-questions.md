# Câu hỏi cho PO

> AI ghi vào đây khi Wiki/kit chưa nói rõ. Trả lời ngay dưới mỗi dòng; AI cập nhật Wiki theo.

- Câu hỏi cho PO: Bản này là web PWA (máy build chưa có Flutter SDK, ADR-001). Khi nào chuyển sang Flutter? Engine Dart trong `flutter/` đã sẵn.
- Câu hỏi cho PO: Giới hạn Pro (danh mục 5, Flash Sale, giá nhập tối đa) đang **tắt** vì Play Billing + quảng cáo thưởng thuộc ngày 3. Bật lại khi nào?
- Câu hỏi cho PO: Biểu phí ngành của Shopee Mall chưa có nguồn chính thức → app để người dùng tự nhập. Có nguồn để Ingest không?
  - **PO trả lời (13/11):** bỏ Mall — không phải người dùng mục tiêu, chưa triển khai được. App chỉ cho shop thường (F3, F18).
- Câu hỏi cho PO: Lịch nhắc mùa sale đang dùng các ngày "trùng số" (1.1 … 12.12). Có thêm ngày lương 25 hằng tháng / Tết không?
- Câu hỏi cho PO: "Báo sai phí" bản web chỉ ghi sự kiện cục bộ. Muốn nhận báo cáo qua kênh nào (form, email)?
- Câu hỏi cho PO: Thư mục gốc vẫn tên "Hóa Đơn Trọ" — đổi tên thư mục khi phiên làm việc đóng (đang mở thì Windows khoá).
  - **Đã xong (13/11):** PO đổi tên thư mục thành "Lãi Thật".
- Câu hỏi cho PO: Làm tròn ,5 — bản Python (số thiết kế) làm tròn nửa về số chẵn (5.018đ), bản Dart `.round()` ra 5.019đ. Web theo Python. Khi port Flutter cần sửa `formatVnd` Dart cho khớp.
- Câu hỏi cho PO: So sánh sàn gợi ý nhóm ngành TikTok từ ngành Shopee (Thời trang / Sức khỏe & Làm đẹp / Bách hóa) — người dùng đổi được. Có bảng ánh xạ chính thức không?
- Câu hỏi cho PO: Khi khoá Pro đang tắt, `flash_sale_viewed` / `max_cost_viewed` ghi `unlock_method = beta_free` (ngoài 2 giá trị pro/rewarded của tracking plan). Đồng ý thêm giá trị này?

- Câu hỏi cho PO (F22, 13/11): "Áp giá gợi ý" (F16) hiện chỉ đổi giá trên **sàn chính** của sản phẩm; giá các sàn khác giữ nguyên. Có cần gợi ý giá riêng cho từng sàn không? Vốn / đóng gói / hoàn hàng / quảng cáo đang dùng chung cho mọi sàn — có cần tách theo sàn không?
  - **PO trả lời (13/11):** Áp giá gợi ý cho chọn từng sàn, có phần chọn sàn → F23. Giá vốn / đóng gói / chi phí khác **không cần** tách theo sàn — giữ dùng chung.

- Câu hỏi cho PO (F25, 13/11): AdMob chỉ chạy trong app Android gốc. Bản TWA (web) dùng **AdSense** hay chuyển sang **Flutter + AdMob** trước khi phát hành? Hiện quảng cáo là khung thử đúng vị trí/tần suất.
  - **PO trả lời (13/11):** thử Capacitor → ADR-002, F27. AdMob chạy trong app qua plugin.
- Câu hỏi cho PO (F24): Play Billing qua TWA cần xác nhận (acknowledge) giao dịch thuê bao trong 3 ngày, nên có máy chủ nhỏ gọi Play Developer API. Có làm máy chủ không, hay chuyển Flutter (in_app_purchase tự xác nhận)?
  - **Đã giải (13/11):** chuyển Capacitor + `@capgo/native-purchases` — plugin tự xác nhận giao dịch, không bắt buộc máy chủ (vẫn nên kiểm token phía máy chủ khi có).
- Câu hỏi cho PO (F26): điền tên nhóm, email, ngày phát hành trong chính sách quyền riêng tư; tên miền đăng web (GitHub Pages?) để làm TWA.

- Câu hỏi cho PO (F30, 13/11): Chưa có file **Báo Cáo Doanh Thu (.xlsx) thật** của Shopee. App tìm cột theo tên (tiếng Việt / Anh) và giả định cột "Phí dịch vụ" trang Income **gộp** PiShip + phí hiển thị, tách ra bằng trang Service Fee Details. Cho 1 file thật (xoá tên/địa chỉ người mua) để chốt tên cột và cách gộp.
- Câu hỏi cho PO (F28, 13/11): Chưa có đơn combo thật **khác ngành** để xác nhận Shopee chia phần giảm theo tỷ lệ giá trị. App theo cách này (ADDONS.md); cần 1–2 đơn combo thật.
- Câu hỏi cho PO (F28): Chế độ **Mua kèm** dùng giá mua kèm gõ tay cho món phụ, so với "món chính một mình" (CB6). Đúng ý không, hay cũng cần so với bán lẻ từng món?
