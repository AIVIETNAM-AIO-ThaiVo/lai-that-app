# PM review — duyệt từng phase

> Sau mỗi lần `verify.sh` xanh, PM (AI) đối chiếu tiêu chí "Xong khi" trong `1-wiki/phases.md`, xem ảnh bot chụp, chấm design.
> Ghi ĐẠT / CHƯA ĐẠT + lý do. Chỉ ĐẠT mới sang phase sau.

## Phase 1 · Ngày 1 (F1–F6) — ĐẠT · 2026-11-12

- **Xong khi:** "Tính được móc khóa ra 505đ trên máy" → bot trên màn 390px: 505đ · Lãi mỏng · 3,0% · hòa vốn 16.340đ; 20% → 22.900đ lãi 5.018đ (21,9%); sàn + thuế 6.995đ = 41%. ✔
- **Đơn thật:** 8/8 đơn Shopee lệch ≤ 2đ (< 1% giá bán), cả `tools/validate.py` lẫn `app/engine.js`. ✔
- **Verify:** 31 unit test + 51 bước bot xanh (1 lần đỏ do lỗi cú pháp của chính mình, đã sửa).
- **Design (chấm sau khi sửa):** a5 b5 c5 d4 e4. Đã sửa: thanh phím 000 che thẻ kết quả, nút "Xem từng khoản phí" nửa màn, link "Nhập số tiền" gãy dòng, chữ thẻ "Giá nên bán" chật.
- **Còn lại / ghi nhận:** làm tròn ,5 theo bản Python (đã ghi PO); Mall mới là ô tự nhập (đầy đủ ở F18).
- **Quyết định PM:** sang Phase 2.

## Phase 2 · Ngày 2 (F7–F12) — ĐẠT · 2026-11-12

- **Xong khi:** "Đổi `fee_version` → máy nhận thông báo" → bot đẩy biểu phí 2026-11-14.1 (phí giao dịch Shopee 9%): hộp thông báo + toast + cảnh báo Danh mục "1 sản phẩm chuyển sang lỗ" (Móc khóa) kèm giá gợi ý mới; cùng phiên bản không báo lại. Thông báo hệ thống (Web Notification) kiểm riêng bằng Playwright có cấp quyền: được gọi đúng. ✔
- **Số liệu khớp `engine/test-cases.md`:** so sánh TikTok 1.015đ / Shopee 505đ (kém 510đ, 300 đơn → 153.000đ); áo thun 47.240 → 41.061 → 33.521đ, ROAS 3,34 → 4,09, ads 44.631 → 36.436đ; Flash Sale 3.267 / 1.515 / −237đ; giá nhập tối đa 8.438đ; danh mục Kẹp tóc → Ốp → Móc khóa → Áo thun. ✔
- **Verify:** 52 unit test + 89 bước bot xanh. Sửa trong lúc làm: bàn phím mở che thanh điều hướng (bot bấm "Xong" như người dùng), thiếu khoảng trắng trong dòng Flash Sale, "Lỗ · 0,0%" thiếu dấu trừ.
- **Design:** a5 b5 c5 d4 e4. Ghi nhận nhỏ: dòng meta sản phẩm xuống 2 dòng khi có giá gợi ý (đọc được, chấp nhận).
- **Ghi nhận PO:** khoá Pro tắt (cờ `pro_gates_enabled`), `flash_sale_viewed.unlock_method = beta_free` khi khoá tắt; nhóm ngành TikTok khi so sánh là **gợi ý** cho người dùng đổi.
- **Quyết định PM:** sang Phase 3 (P1).

## Phase 3 · P1 (F13–F18) — ĐẠT · 2026-11-13

- **Xong khi:** mỗi tính năng P1 dùng được từ đầu đến cuối trên bot, không phá P0 → 110 bước bot xanh (P0 vẫn xanh), 64 unit test. ✔
  - F13 lãi tháng 300 đơn → 151.500đ · F14 chia sẻ (máy tính: chép, điện thoại: bảng chia sẻ) · F15 ví dụ nhanh + 4 sản phẩm mẫu
  - F16 áp giá gợi ý 1 chạm (Kẹp tóc 18.900đ, Ốp 34.900đ) + hoàn tác · F17 nhắc 12.12 khi còn 3 ngày · F18 Mall tự nhập %, shop mới 3.225đ
- **Design:** a5 b5 c5 d4 e4. Đã sửa: ví dụ mẫu bị thẻ kết quả che (đưa lên đầu), thẻ kết quả cao hơn che nút (tăng khoảng trống), chữ dính giữa 2 `<span>` (3 chỗ), cảnh báo "% ngành" hiện khi chưa chọn ngành.
- **Lỗi bắt được ở bước duyệt:** service worker chưa lưu `examples.js`, `sales.js` → offline hỏng; đã sửa (`laithat-v2`).
- **Giới hạn đã chốt:** dừng ở P1 + ngày 2. Chưa làm (ngày 3): AdMob/UMP, Play Billing + paywall mua thật, bật khoá Pro, store listing/AAB, video.
- **Quyết định PM:** sản phẩm ĐẠT trong phạm vi lần build này. Dừng.

## Phase 4 · Phản hồi người dùng (F19, F20, F10 chấm lại) — ĐẠT · 2026-11-13

- **Xong khi:** hết nhập nhằng giữa nháp và danh mục → tab "Tính nhanh" là nháp, lưu luôn tạo sản phẩm mới; mỗi sản phẩm có màn riêng `#/san-pham/<id>`
  (bản nháp riêng, "Lưu thay đổi", hỏi khi rời chưa lưu, xoá 2 lần, chép sang Tính nhanh, chi tiết phí / chi phí ẩn theo đúng sản phẩm). ✔
- **Màn mở app:** khối giá → mảnh phí tách ra → chữ L → "Lãi Thật"; tự ẩn 1,33 giây (kể cả tải trang), chạm ẩn 0,29 giây; giảm chuyển động ≤ 0,45 giây; chỉ transform/opacity. Logo bỏ khỏi Cài đặt. ✔
- **Verify:** 70 unit test + 131 bước bot xanh.
- **Sửa khi duyệt:** tiêu đề tên sản phẩm bị nút chọn sàn ép 3 dòng (chuyển nút xuống dưới ô tên); chữ dính trong thẻ sản phẩm (lần thứ 3 — bài học đã có); đổi tab "Từ % lãi" không còn bị tính là "chưa lưu"; biểu tượng màn mở app to hơn.
- **Quyết định PM:** ĐẠT.


## Phase 5 — Phản hồi người dùng 13/11 (lần 2) · ĐẠT

**Verify:** 🟢 76 unit test + bot 145 check, 0 lỗi (F20, F21 ✅).

| Xong khi (phases.md) | Bằng chứng | Kết quả |
|---|---|---|
| Thêm được sản phẩm ngay ở tab Sản phẩm | `#add-product` → `#/san-pham/moi` (ảnh 23), thêm xong về danh mục, lãi trong danh mục = lãi trên màn nhập (2.005đ, ảnh 24) | ✅ |
| Tính nhanh không bị đụng | Giá Tính nhanh trước/sau: 21.000 = 21.000 | ✅ |
| Rời khi đang nhập có hỏi | Chưa đủ giá → chỉ "Bỏ"; đủ → "Thêm" lưu luôn | ✅ |
| Mảnh phí tách ra có cầu nối chất lỏng, mượt, ≤ 1,5 giây | Chụp 63 khung từ app (20 ms/khung): khối liền → cầu nối thắt rồi đứt (~420 ms) → giọt lắc nhẹ, đứng yên; tự ẩn 1.556 ms tính cả tải trang (timer 1.240 + mờ 240 ms) | ✅ |
| Phản hồi thêm: "tách ra rồi mới chuyển màu cùng lúc với hiện chữ" | Mảnh phí giữ màu trắng khi tách; đổi sang màu phí 640–1.000 ms, cùng thời điểm + cùng đường cong với chữ "Lãi Thật" | ✅ |

**Design (F21):** a5 · b5 (lãi 2.005đ to nhất màn) · c5 · d5 · e4 — nút "Thêm sản phẩm" rõ, đúng vị trí đầu danh mục.
**Chuyển động (wiggle):** triết lý rõ ràng · đáng tin → khối chất lỏng tự tách; 31 khung khoá, 60 fps, lò xo vượt ≈ 6%; Lottie qua `validate_lottie.py`.
`validate_loop.py` báo đầu ≠ cuối — đúng ý vì đây là hiệu ứng mở màn chạy một lần, không phải vòng lặp.

## Phase 6 — Phản hồi người dùng 13/11 (lần 3) · ĐẠT

**Verify:** 🟢 83 unit test + bot 156 check, 0 lỗi (F20, F22 ✅).

| Xong khi (phases.md) | Bằng chứng | Kết quả |
|---|---|---|
| Mỗi sản phẩm thấy lãi trên mọi sàn mình bán | Cài đặt "Sàn bạn bán" (ảnh 25); danh mục: mỗi thẻ 1 dòng / sàn — Móc khóa: Shopee 505đ Lãi mỏng · TikTok Shop 1.015đ Lãi mỏng · Lazada "cần % phí" (ảnh 26) | ✅ |
| Lọc lỗ theo sàn tệ nhất | Pill "Đang lỗ · 2" = số thẻ có ít nhất 1 sàn lỗ (2 = 2) | ✅ |
| Sửa riêng từng sàn | Sheet TikTok (ảnh 27) → giá 25.000đ → lãi 7.375đ; lưu → danh mục cập nhật, Shopee giữ 505đ (ảnh 28) | ✅ |
| Khớp màn So sánh | Unit: cùng hàm `platformInput` cho So sánh và danh mục; lãi TikTok / Lazada bằng nhau | ✅ |
| Báo động đổi phí xét mọi sàn | Unit: đổi % "Bách hóa" TikTok → sản phẩm Shopee báo chuyển lỗ ở TikTok | ✅ |
| Hiệu ứng không còn đổi góc đột ngột | Bỏ lớp góc nhọn; chụp khung 1.000 / 1.100 / 1.240 ms giống hệt nhau, góc trong chữ L giữ bo tròn | ✅ |

**Design (F22):** a5 · b4 (lãi từng sàn rõ, nhưng thẻ dài hơn khi bán 3 sàn) · c5 · d5 · e4.
Câu hỏi cho PO đã ghi: "Áp giá gợi ý" chỉ đổi giá sàn chính; chi phí khác đang dùng chung mọi sàn.

## Phase 7 — Trả lời PO 13/11 · ĐẠT

**Verify:** 🟢 87 unit test + bot 165 check, 0 lỗi (F23 ✅).

| Xong khi (phases.md) | Bằng chứng | Kết quả |
|---|---|---|
| Chọn sàn rồi áp giá gợi ý | "Áp cho sàn: Shopee · TikTok Shop · Lazada" (mặc định chọn hết, không bỏ được sàn cuối); mỗi thẻ: giá hiện tại → giá gợi ý từng sàn (ảnh 29, 30) | ✅ |
| Chỉ sàn đã chọn đổi giá | Chỉ chọn TikTok: Kẹp tóc TikTok 12.000 → 17.900đ, Shopee giữ 12.000đ; toast "… trên TikTok Shop" | ✅ |
| Hoàn tác được | `#undo-apply` → TikTok về như cũ | ✅ |
| Bán 1 sàn vẫn như F16 | Bot phase 3 (F16) vẫn xanh: Kẹp tóc 18.900đ, Ốp 34.900đ | ✅ |

PO 13/11: vốn / đóng gói / chi phí khác **không** tách theo sàn — giữ dùng chung.
Lỗi bắt được khi nhìn ảnh (bot chưa bắt): dòng Shopee hiện "undefined" và ô chọn rơi xuống dòng riêng → đã sửa, thêm check "không có undefined".
**Design (F23):** a5 · b4 · c5 · d5 · e4.

## Phase 8 — Ngày 3 (BUILD_PLAN Chủ nhật 15/11) · ĐẠT (phần làm được trên máy build)

**Verify:** 🟢 103 unit test + bot 192 check, 0 lỗi (F24, F25, F26 ✅).

| Xong khi (phases.md) | Bằng chứng | Kết quả |
|---|---|---|
| Mua thử Pro từ đủ 4 điểm | Bot mở paywall ở `catalog_limit` (lưu SP thứ 6), `flash_sale`, `fee_alert`, `settings`; mua gói tháng → dùng thử, `trial_started` (ảnh 33, 34) | ✅ |
| Paywall đúng luật store | Giá + chu kỳ 2 gói, dùng thử 3 ngày, tự gia hạn, huỷ trong Google Play, nhắc trước 1 ngày, Khôi phục giao dịch, miễn trừ | ✅ |
| Nhắc hết dùng thử, thành thuê bao | Tua đồng hồ: còn < 1 ngày → 1 thông báo; hết hạn → `purchase {monthly, 49000, settings}`; khôi phục được | ✅ |
| Quảng cáo đúng vị trí / tần suất | Hỏi đồng ý trước (ảnh 31); banner chỉ Danh mục + Biểu phí; không ở Tính lãi; interstitial sau 3 lần tính, cách 3 phút (ảnh 32); rewarded mở Flash Sale; Pro hết quảng cáo | ✅ |
| Đủ bộ file nộp store | `app/privacy.html` (link ở Cài đặt), `brand/store/` 7 ảnh 1080×1920 + ảnh đồ hoạ 1024×500 + icon 512 (`node tools/store_shots.mjs`), `twa/` cấu hình + hướng dẫn AAB | ✅ |
| Video demo | `brand/video/lai-that-demo.webm` 1:50, 780×1688, có chữ chú thích, tua được (`node tools/demo_video.mjs`) | ✅ | · 13/11: thay bằng `brand/video/lai-that-demo-2m59.mp4` (YouTube https://youtu.be/CnKY1uwEHC0), bản 1:50 đã xoá
| Phần cần tài khoản nhóm ghi rõ | `twa/README.md`, `docs/LAUNCH_CHECKLIST.md` (trạng thái), `4-memory/po-questions.md` | ✅ |

**Chưa làm được trên máy này (không tự nhận là xong):** file AAB (thiếu JDK / Android SDK), tải lên Internal testing, Firebase / AdMob thật, khoá ký, tên miền, đẩy repo (chưa có remote), lồng tiếng video.
**Cảnh báo phát hành:** Play Billing qua TWA cần máy chủ xác nhận thuê bao; AdMob không chạy trong TWA — đã hỏi PO.
**Sự cố đã xử lý:** cách quay video đầu tiên (getDisplayMedia) quay nhầm **cả màn hình máy** → đã xoá ngay file đó; đổi sang screencast của riêng trang app + WebCodecs.

## Phase 9 — PO chọn Capacitor (13/11) · ĐẠT phần code; chưa chạy trên máy Android thật

**Verify:** 🟢 110 unit test + bot 192 check, 0 lỗi (F26, F27 ✅).

| Xong khi (phases.md) | Bằng chứng | Kết quả |
|---|---|---|
| AdMob thật trong app theo đúng luật F25 | `app/native.js`: UMP → initialize; banner `BOTTOM_CENTER` trên thanh điều hướng chỉ ở Danh mục / Cài đặt, rời màn thì ẩn; interstitial / rewarded qua plugin; ID thử của Google — unit test với plugin giả | ✅ (mức code) |
| Thuê bao qua Google Play, tự xác nhận | `createNativeBilling`: `purchaseProduct({ productType: 'subs', planIdentifier })`, khôi phục từ `getPurchases` — unit test | ✅ (mức code) |
| Web vẫn như cũ | Bot 192 bước xanh (khung quảng cáo thử, thanh toán chế độ thử) | ✅ |
| `app/` không có thư viện npm | Unit test đọc mọi `import` trong `app/` | ✅ |
| Hướng dẫn ra AAB | `mobile/README.md`: cài, `cap add android`, AdMob App ID, `bundleRelease`, Internal testing, SKU + base plan | ✅ |

**Chưa kiểm được:** chưa cài gói npm / chưa tạo `mobile/android/` (cần tải ~vài chục MB từ npm — chờ PO cho phép), chưa build AAB (máy không có JDK / Android SDK), chưa thử quảng cáo / mua thật trên điện thoại.
- **Cập nhật 13/11 (PO "Cho tải"):** đã `npm install` (Capacitor 8.6.2, admob 8.3.0, native-purchases 8.9.11) và `cap add android`: `mobile/android/` có `vn.laithat.app`, AdMob App ID thử, 2 plugin được nhận, biểu tượng + màn chờ Lãi Thật, APK không chứa file kiểm thử. Đã đối chiếu tên plugin / hàm / giá trị enum trong `node_modules` với `app/native.js`. Verify xanh 111 test + bot; 1 lần đo màn mở app 2.573 ms do máy bận, chạy lại 1.568 ms. **Chưa build AAB / chưa chạy trên điện thoại** (cần Android Studio).

## Phase 10 — Add-on Combo + Kiểm tra đơn (13/11) · ĐẠT phần app; video demo đang sửa

**Verify:** 🟢 134 unit test + bot 230 check, 0 lỗi (F28, F29, F30 ✅). Bot phase 10 chạy như máy mới cài (biểu phí gốc).

| Xong khi (phases.md) | Bằng chứng | Kết quả |
|---|---|---|
| 3 móc khóa: bán lẻ 1.515đ → combo −10% 6.614đ (+5.099đ) | Ảnh 36 (mẫu miễn phí, chỉ xem); 19 ca `app/test/addon_vectors.json` khớp `tools/addons.py` tới 0,5đ | ✅ |
| Giảm tối đa 1% / 15% / 26%, giá gợi ý 50.900đ, cảnh báo mức 5% | Ảnh 41; bot đọc `#md-20/10/0`, `#md-min`, `#combo-suggest` | ✅ |
| Lưu combo → Danh mục "Bộ · 3 món", tính lại theo giá vốn, báo động đổi phí | Bot + unit F28 (sửa vốn → tính lại; xoá món gốc → giữ bản sao; tăng phí → `turnedLoss` có combo) | ✅ |
| Đơn thật A: ngành 15% → Lệch, bấm sửa → Khớp | Ảnh 38–39 (bot không chọn sản phẩm nên Lệch 4 khoản 8.362đ gồm cả PiShip); unit KD2 với sản phẩm 15% + PiShip → đúng **Lệch 3 khoản 5.662đ** | ✅ |
| File 8 đơn thật → 8 Khớp | Unit F30: file .xlsx dựng trong test (deflate + stored) → 8 Khớp + 1 Lệch; bot: đọc 9 đơn, chưa Pro khoá 6, gán SKU, file hỏng báo lỗi | ✅ |
| Thanh dưới 5 tab | Bot: `Tính·So sánh·Sản phẩm·Kiểm tra·Cài đặt` | ✅ |
| Video demo có cảnh Combo + Kiểm tra | `brand/video/lai-that-demo-2m59.mp4` 179 giây: cảnh 13 Combo (1.515đ → 6.614đ), 14 Kiểm tra đơn (Lệch 3 khoản 5.662đ → Khớp); 14 cảnh qua kiểm tra, mối nối sạch; ảnh store 8 tấm chụp lại (thanh 5 tab) | ✅ (chờ PO duyệt) |

**Design (ảnh 36–42):** a5 b5 c5 d4 e4. (d) nhãn "Khuyến mãi combo" xuống 2 dòng trong ô chia 3 — vẫn đọc rõ, không tràn 390px. (e) màn kết quả kiểm tra dài khi lệch nhiều khoản (nút sửa + sao chép trên từng dòng).
**Ghi chú:** combo hiện ở nhóm riêng "Combo" dưới danh sách sản phẩm (cùng sắp lãi thấp lên đầu, cùng báo động), chưa trộn chung một danh sách với sản phẩm lẻ. Kiểm tra đơn chỉ Shopee; TikTok/Lazada "sắp có". Tên cột file Báo Cáo Doanh Thu là giả định — đã hỏi PO 1 file thật.
