# Chuyển động logo — tách kiểu chất lỏng (F20)

Làm theo skill **wiggle** (`.claude/skills/wiggle`).

**Triết lý:** rõ ràng · đáng tin → yên tâm → khối giá tự tách như chất lỏng: mảnh phí bị kéo giãn, cầu nối thắt rồi đứt,
giọt co về hình vuông, lắc nhẹ rồi đứng yên. **Tách xong mới đổi màu**: mảnh phí đổi sang màu phí cùng lúc chữ "Lãi Thật" hiện.

| Mốc (ms) | Việc |
|---|---|
| 0–220 | khối giá trắng hiện ra |
| 160–860 | mảnh phí tách: kéo giãn (giữ thể tích) → cầu nối đứt ~450 → lò xo vượt ≈ 6% → đứng yên |
| 640–1000 | mảnh phí đổi màu + chữ "Lãi Thật" hiện (cùng đường cong 0.25/0.75) |
| 1000–1240 | logo đứng yên, giữ nguyên góc bo của lớp chất lỏng |
| 1240–1480 | mờ đi, gỡ |

| File | Là gì |
|---|---|
| `build_splash.py` | hàm chuyển động duy nhất → sinh 3 file dưới + keyframes trong `app/styles.css` |
| `splash-liquid.json` | Lottie 512×512, 60 fps (biểu tượng; Lottie không có bộ lọc goo nên cầu nối là một hình elip co lại) |
| `splash-liquid-lottie.gif` | xem trước, vẽ lại từ chính file Lottie |
| `splash-liquid-app.gif` | xem trước, chụp từng khung hiệu ứng thật trong app (có bộ lọc chất lỏng) |

Trong app: bộ lọc SVG tĩnh `#splash-goo` (làm mờ + ngưỡng alpha) dính hai khối khi gần nhau; chỉ `transform` / `opacity` được animate.
Sửa chuyển động: đổi thông số trong `build_splash.py` rồi chạy `python brand/logo/motion/build_splash.py`.
`render_lottie.py` của wiggle cần Cairo (chưa cài trên máy này) nên GIF được vẽ bằng Pillow.
