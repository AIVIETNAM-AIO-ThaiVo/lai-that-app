# F20 — Màn mở app có logo động (tách kiểu chất lỏng)

**Phase:** 4 (phản hồi 13/11/2026) · sửa ở Phase 5 (phản hồi lần 2: "phần tách ra mượt kiểu liquid")
**Logo:** `brand/logo/GUIDE.md` · **Chuyển động:** `brand/logo/motion/` (làm theo skill wiggle)

Kể lại ý tưởng logo trong ~1,2 giây: khối giá vuông → **mảnh phí tách ra như giọt chất lỏng** → còn lại chữ L (lãi) → chữ "Lãi Thật" hiện.

## Triết lý chuyển động (wiggle, bước 1)
- **Tính cách:** rõ ràng · đáng tin. **Cảm xúc:** yên tâm — "phần phí được tách bạch, phần lãi còn lại vững".
- **Ẩn dụ:** một khối chất lỏng tự tách: mảnh phí kéo giãn thành cầu nối, cầu nối thắt lại rồi đứt, giọt co về hình vuông và lắc nhẹ rồi đứng yên.
- **Thông số:** chuyển động hữu cơ — 60 khung/giây, ~30 khung khoá cho mảnh phí (lò xo tắt dần, vượt ≈ 6%), co giãn giữ thể tích theo hướng chuyển động; chữ L chỉ giật nhẹ khi cầu nối đứt; không nảy kiểu đồ chơi.

## Done when
- [ ] Mở app thấy `#splash` (nền xanh lãi) có logo; lúc đầu là **một khối liền**, mảnh phí tách ra với **cầu nối chất lỏng** (bộ lọc SVG `#splash-goo`: làm mờ + ngưỡng alpha) rồi đứt; chữ "Lãi Thật" hiện dần; tự ẩn, gỡ hẳn sau ≤ 1,5 giây.
- [ ] Bộ lọc là tĩnh; chỉ `transform` / `opacity` được animate (unit test đọc CSS). Mảnh phí có ≥ 20 khung khoá (chuyển động hữu cơ).
- [ ] Góc bo giữ nguyên từ đầu tới cuối (phản hồi 13/11: "cạnh đang bo tròn nhọn đột ngột"): không đổi sang lớp góc nhọn ở cuối — không có `.splash-crisp`; góc trong của chữ L giữ bo tròn của lớp chất lỏng. Giảm chuyển động cũng hiện đúng hình bo tròn đó (đứng yên).
- [ ] Chạm vào màn mở app thì ẩn ngay; không có nút; không chặn app tải phía sau.
- [ ] Bật giảm chuyển động (`prefers-reduced-motion`): không chuyển động, hiện logo ở trạng thái cuối, ẩn sau ≤ 0,5 giây (`splashTiming`).
- [ ] Có bản Lottie `brand/logo/motion/splash-liquid.json` qua `validate_lottie.py` của skill wiggle + ảnh GIF xem trước; keyframes CSS sinh từ cùng một hàm chuyển động (`brand/logo/motion/build_splash.py`).
- [ ] Logo chỉ xuất hiện ở màn mở app và màn Chọn sàn; màn Cài đặt **không** có logo.
