# Checklist phát hành

> **Trạng thái 13/11/2026 (Phase 8):** phần làm được trên máy build đã xong (paywall + thanh toán thử, quảng cáo thử + đồng ý, chính sách trong app, ảnh store, gói Android Capacitor, video). Mục 1–3 cần tài khoản của nhóm (Firebase, AdMob, Play Console); AAB cần JDK + Android SDK — các bước ở `mobile/README.md`.
> **Cập nhật 13/11 (Phase 10):** đã thêm add-on Combo + Kiểm tra đơn; README viết lại theo đề "Team Assignment: AI-Native App Build with Apero" (pitch, vấn đề, người dùng, tính năng, kênh, doanh thu, cách chạy, quy trình AI-native, nhóm, tracking plan, video). Còn phải điền: **thành viên nhóm + vai trò**, **link video**.

Hạn nộp bài: Chủ nhật 15/11/2026, 23:59. Ô [ ] là việc cần làm; mục ghi "kiểm tra lại" là quy định của Google có thể đã đổi.

## 1. Firebase (30 phút)

- [ ] Tạo project, thêm app Android với package `vn.laithat.app` (hoặc tên nhóm chọn; không chứa tên sàn).
- [ ] Bật Analytics, Crashlytics, Remote Config.
- [ ] Nối `track()` (`app/store.js`) với Firebase Analytics trong bản Android (hiện sự kiện chỉ ghi trên máy; tên + thuộc tính đã khớp `docs/tracking_plan.csv`).
- [ ] Remote Config, tạo các khóa:

| Khóa | Kiểu | Giá trị ban đầu |
|---|---|---|
| `fee_presets` | JSON | nội dung `app/assets/fee_presets.json` |
| `fee_version` | String | `2026-11-12.1` |
| `pro_prices` | JSON | `{"monthly":49000,"yearly":299000,"trial_days":3}` |
| `free_catalog_limit` | Number | 5 |
| `interstitial_min_seconds` | Number | 180 |
| `interstitial_after_calcs` | Number | 3 |

- [ ] Đánh dấu các sự kiện `purchase`, `product_saved`, `calc_completed` là sự kiện chính (key events).

## 2. AdMob (30 phút)

- [ ] Tạo app, 3 đơn vị: banner thích ứng (Danh mục, Biểu phí), interstitial, rewarded.
- [ ] Bật bảng đồng ý UMP (GDPR + thông báo cho khu vực khác), liên kết AdMob với Firebase.
- [ ] Trong lúc test dùng ID quảng cáo thử của Google; chỉ đổi sang ID thật ở bản phát hành.

## 3. Play Console

- [ ] Tài khoản nhà phát triển. **Tài khoản cá nhân mới phải chạy thử kín (closed testing) với ít nhất 12 người thử trong 14 ngày liên tục trước khi được phát hành production** (kiểm tra lại quy định hiện hành). Nếu dùng tài khoản của Apero hoặc tài khoản tổ chức thì không bị ràng buộc này; hỏi Apero sớm.
- [ ] Tạo app, điền store listing từ `docs/STORE_LISTING.md`, URL chính sách quyền riêng tư (đăng `docs/privacy-policy.html` lên GitHub Pages).
- [ ] Data safety, phân loại nội dung, đối tượng mục tiêu 18+, khai có quảng cáo.
- [ ] Sản phẩm thuê bao: `pro_monthly` 49.000đ (dùng thử 3 ngày), `pro_yearly` 299.000đ. Thêm tài khoản test giấy phép (license testers) để mua thử không mất tiền.
- [ ] Target API: theo mức Play đang yêu cầu cho app mới (≥ API 35 tại thời điểm viết; kiểm tra lại).
- [ ] Ký app bằng Play App Signing, tải AAB lên Internal testing trước.

## 4. Trong app trước khi nộp

- [ ] `flutter test` xanh (8 đơn thật + 7 ca thiết kế). — bản web dùng `node --test` (103 test) + bot 192 bước; Flutter chưa build
- [x] Màn Tính lãi không có quảng cáo; interstitial không hiện trong 2 phiên đầu. — F25, bot kiểm (bản web: khung quảng cáo thử)
- [x] Mọi kết quả có dòng "biểu phí cập nhật 12/11/2026" và câu miễn trừ. — F2
- [x] Không có tên/logo/màu của sàn trong icon và ảnh chụp. — icon + `brand/store/` (tên sàn trên màn thay bằng "Sàn A/B/C")
- [x] Paywall ghi giá, chu kỳ, tự gia hạn, cách hủy, nút Khôi phục giao dịch; nhắc trước 1 ngày khi hết dùng thử. — F24 `#paywall`, nhắc trước 1 ngày, `#restore`
- [ ] Bật chế độ debug của Firebase (`adb shell setprop debug.firebase.analytics.app <package>`) và xem đủ sự kiện trong DebugView.
- [ ] Chạy thử trên 1 máy Android thật, mạng tắt: app vẫn tính được bằng biểu phí đóng gói sẵn. — bản web chạy offline nhờ service worker; chưa thử trên máy Android thật

## 5. Bài nộp

- [ ] Repo GitHub: cấu trúc như README (CLAUDE.md, raw/, wiki/, app/, tools/, docs/). — chưa đẩy: repo chưa có remote
- [x] README.md, Tracking Plan (`docs/Tracking Plan - Lai That.docx`, đặc tả `docs/tracking_plan.csv`), VALIDATION_REPORT.md.
- [x] Video demo 2–3 phút theo `docs/DEMO_VIDEO_SCRIPT.md`. — `brand/video/lai-that-demo-2m59.mp4` (2:59, 1920×1080, chỉ nhạc, có Combo + Kiểm tra đơn; PO đã duyệt 13/11). File 116 MB > giới hạn 100 MB của GitHub → đã đưa vào `.gitignore`.
- [x] Video trên YouTube (không công khai): https://youtu.be/CnKY1uwEHC0 — đã dán vào README.
- [x] Bảng **Team** trong README: 5 thành viên + vai trò (bản phân vai đầu, 13/11).
- [ ] Mỗi thành viên tự sửa dòng của mình trong README cho đúng việc đã làm (đề chấm "visible contributions from every member").
- [ ] Link Play (internal/closed testing) hoặc file AAB/APK. — chưa có: cần JDK/Android SDK + Play Console, xem `mobile/README.md`
- [ ] Phần launch plan (nhóm tự viết).
