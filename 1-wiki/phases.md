# Phase build — PM tự duyệt từng phase

Giới hạn lần build này (người dùng chốt 12/11/2026): **tính năng tới P1**, **lịch tới ngày 2** của `docs/BUILD_PLAN.md`.
Ngày 3 làm ở Phase 8 (người dùng yêu cầu 13/11). Phần cần tài khoản của nhóm (Play Console, AdMob, khoá ký, tên miền, đẩy repo) ghi ở F26.

Mỗi phase: build → `verify.sh` xanh → **PM review** (`4-memory/pm-review.md`): đối chiếu "Xong khi" + chấm design → ĐẠT thì sang phase sau.

| Phase | Tương ứng | Tính năng | Xong khi (PM kiểm) |
|---|---|---|---|
| **1** | Ngày 1 (Thứ Sáu 13/11) | F1 Bộ máy tính · F2 Biểu phí & nguồn · F3 Chọn sàn · F4 Tính lãi từ giá bán · F5 Tính từ % lãi · F6 Chi tiết phí | Tính được **móc khóa ra 505đ** trên màn hình điện thoại (390px): lãi mỏng 3,0%, hòa vốn 16.340đ, 20% → giá đẹp 22.900đ lãi 5.018đ, sàn + thuế 41%; 8/8 đơn thật lệch < 1% |
| **2** | Ngày 2 (Thứ Bảy 14/11) | F7 So sánh sàn · F8 Chi phí ẩn · F9 Flash Sale & giá nhập tối đa · F10 Danh mục · F11 Báo động đổi phí · F12 Tracking | **Đổi `fee_version` → máy nhận thông báo** và danh mục chỉ ra sản phẩm chuyển sang lỗ; số liệu khớp `engine/test-cases.md` |
| **3** | P1 (sau nộp bài) | F13 Lãi tháng · F14 Chia sẻ Zalo · F15 Ví dụ mẫu · F16 Áp giá mới 1 chạm · F17 Nhắc mùa sale · F18 Miễn phí 30 ngày shop mới (Mall bỏ 13/11) | Mỗi tính năng P1 dùng được từ đầu đến cuối trên bot; không phá P0 |
| **4** | Phản hồi người dùng 13/11 | F19 Tách Tính nhanh / Sản phẩm · F20 Màn mở app có logo động | Hết nhập nhằng giữa nháp và danh mục; mở app thấy logo kể ý "phần còn lại" ≤ 1,5 giây |
| **5** | Phản hồi người dùng 13/11 (lần 2) | F21 Thêm sản phẩm trong danh mục · F20 (sửa) tách kiểu chất lỏng | Thêm được sản phẩm ngay ở tab Sản phẩm, Tính nhanh không bị đụng; mở app thấy mảnh phí tách ra có cầu nối chất lỏng, mượt, ≤ 1,5 giây |
| **6** | Phản hồi người dùng 13/11 (lần 3) | F22 Lãi theo từng sàn trong danh mục · F20 (sửa) giữ góc bo tới cuối | Mỗi sản phẩm thấy lãi trên mọi sàn mình bán; lọc lỗ theo sàn tệ nhất; hiệu ứng mở app không còn đổi góc đột ngột |
| **7** | Trả lời PO 13/11 | F23 Áp giá gợi ý theo từng sàn (chọn sàn) | Chọn sàn rồi áp giá gợi ý; chỉ sàn đã chọn đổi giá, hoàn tác được; bán 1 sàn vẫn như F16 |
| **8** | Ngày 3 (Chủ nhật 15/11) | F24 Lãi Thật Pro (paywall 4 điểm, 2 gói, dùng thử) · F25 Quảng cáo + đồng ý · F26 Phát hành (chính sách, ảnh store, gói Android, video) | Mua thử được Pro từ đủ 4 điểm, nhắc hết dùng thử; quảng cáo đúng vị trí/tần suất, không có ở Tính lãi; có đủ bộ file nộp store + video; phần cần tài khoản nhóm ghi rõ |
| **9** | PO chọn Capacitor 13/11 | F27 Gói Android bằng Capacitor: AdMob + Play Billing gốc | Trong app: quảng cáo AdMob thật (ID thử) theo đúng luật F25, mua thuê bao qua Google Play tự xác nhận; trên web vẫn như cũ; bot + test xanh |
| **10** | Add-on 13/11 (`raw/addon/`, bản 1.1–1.2) | F28 Combo · F29 Kiểm tra đơn nhập tay · F30 Kiểm tra cả file Báo Cáo Doanh Thu | 3 móc khóa: bán lẻ 1.515đ → combo −10% 6.614đ (+5.099đ) trên bot; đơn thật A kiểm ra Khớp, sửa ngành 15% → Lệch 3 khoản 5.662đ, bấm sửa → Khớp; file 8 đơn thật → 8 Khớp; thanh dưới 5 tab; video demo có cảnh Combo + Kiểm tra |

Thứ tự cắt nếu chậm (BUILD_PLAN): xuất file → giá nhập tối đa → Lazada. **Không cắt báo động đổi phí.**
