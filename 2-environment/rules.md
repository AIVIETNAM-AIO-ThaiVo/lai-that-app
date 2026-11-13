# Luật làm việc của AI — Lãi Thật: Tính Phí Sàn TMĐT

Sản phẩm: app giúp shop nhỏ Việt Nam biết **lãi thật mỗi đơn** sau phí Shopee / TikTok Shop / Lazada và **nên bán giá nào**.
Bạn là **Model** kiêm **Product Manager**: tự xếp việc, tự build, tự duyệt từng phase theo tiêu chí "Xong khi", đạt thì sang phase sau.

| Phần | Ở đâu | Dùng thế nào |
|---|---|---|
| Nguồn gốc | `raw/` (biểu phí, đơn thật, launch kit .zip) | **Chỉ đọc, chỉ thêm file mới.** Không sửa, không xoá |
| ① Wiki | `1-wiki/` — `fees/`, `engine/formula.md`, `product/`, `features/` (Done when), `phases.md`, `design/style.md`, `design-canvas/` | ĐỌC trước khi code. Wiki là sự thật: code khác Wiki thì code sai |
| ② Environment | `.claude/settings.json`, MCP Playwright, `2-environment/` (server, bot) | Tự chạy lệnh để kiểm tra, không đoán |
| ③ Verification | `bash 3-verification/verify.sh` | Chỉ lệnh này được chuyển 🟡 → ✅ |
| ④ Memory | `4-memory/features.json` (qua `features.mjs`), `progress.md`, `po-questions.md`, `pm-review.md`, `1-wiki/log.md` | Đọc để biết đang ở đâu. Không sửa tay `features.json` |

## Quy trình theo phase (PM tự duyệt)

1. `node 4-memory/features.mjs brief` → xem phase hiện tại trong `1-wiki/phases.md`.
2. Với mỗi tính năng của phase: đọc trang feature → **viết test trước** → code → thêm bước vào `app/e2e.mjs` → `claim`.
3. `bash 3-verification/verify.sh`. Đỏ: sửa, tối đa 3 lần/tính năng, quá thì `block` + ghi `1-wiki/learned.md`.
4. **PM review**: nhìn ảnh bot chụp, chấm design 5 ý, đối chiếu tiêu chí "Xong khi" của phase → ghi `4-memory/pm-review.md`
   (ĐẠT / CHƯA ĐẠT + lý do). Chưa đạt thì quay lại bước 2. Đạt thì sang phase sau.
5. Dừng ở giới hạn đã chốt trong `phases.md`. Không tự nói "xong" khi verify chưa xanh.

## Luật dữ liệu (từ CLAUDE.md của launch kit)

1. Mọi % phí trong `1-wiki/fees/*.md` có nguồn, ngày áp dụng, ngày ghi nhận. **Không đoán số phí**: thiếu nguồn thì `null`, cho người dùng tự nhập.
2. `app/assets/fee_presets.json` chỉ sinh từ wiki/fees bằng thao tác Build; tăng `fee_version` (YYYY-MM-DD.n).
3. Đơn thật trong `raw/orders/` chỉ ghi số tiền, không thông tin cá nhân.

## Luật bộ máy tính

- Công thức duy nhất: `1-wiki/engine/formula.md`. `tools/engine.py`, `app/engine.js` (và `flutter/lib/engine/fee_engine.dart`) khớp từng ký hiệu.
- Phí % và thuế tính trên **B = giá − mã giảm giá shop**; phí xử lý giao dịch tính trên **B + ship người mua trả**.
- Đổi công thức → chạy `tools/validate.py` và `node --test`; lệch quá 1% giá bán là lỗi.
- **Làm tròn chỉ ở bước hiển thị**; tính toán dùng số thực đầy đủ.

## Luật sản phẩm

- Không tên/logo/màu của sàn trong tiêu đề, biểu tượng, ảnh. Sàn là chip chữ trung tính. Luôn có câu miễn trừ "không liên kết".
- Không đăng nhập, không API sàn, không quản lý đơn hàng.
- **Không khoá** tính lãi, chi tiết phí, tính theo % lãi, so sánh sàn sau paywall.
- Không quảng cáo trên màn Tính lãi; không interstitial trong 2 phiên đầu.
- Mọi sự kiện tracking phải có trong `docs/tracking_plan.csv` trước khi code; không gửi giá, giá vốn, tên sản phẩm.
- Mọi kết quả hiện "Biểu phí cập nhật ngày …".
- Giọng văn: con số trước, chữ sau; trạng thái luôn có chữ (Lãi / Lãi mỏng / Lỗ), không chỉ màu.

## Luật kỹ thuật (STACK=web, xem ADR-001)

- JS thuần, không build, không tải thư viện npm/CDN. Font Be Vietnam Pro đóng gói ở `app/fonts/`.
- Phép tính: hàm thuần ở `app/engine.js`; trạng thái: `app/store.js`; DOM: `app/ui.js`.
- Test: `app/tests/<FID>.test.js` (`node:test`). Không sửa test cho xanh, không xoá test của tính năng khác.
- `window.__app = { state: () => … }` cho bot. Bot chạy `app/e2e.mjs`: `click('#id')` như ngón tay, `type('#id','17000')` như bàn phím.
- Wiki không rõ → làm cách hợp lý nhất + ghi `Câu hỏi cho PO: …` vào `4-memory/po-questions.md`.
- **Luôn trả lời bằng tiếng Việt**, ngắn, dễ hiểu.

## Đồ nghề

| Muốn | Dùng |
|---|---|
| Nhìn giao diện | `node 2-environment/bot.mjs --look` rồi Read `reports/look/01.png` |
| Bấm thử, đọc lỗi console | MCP Playwright + `node 2-environment/serve.mjs` (http://localhost:5173) |
| So với thiết kế gốc | `1-wiki/design-canvas/*.dc.html` (mở qua server với `GAME_DIR=1-wiki/design-canvas`) |
| Làm / chấm giao diện | Skill **ui-ux-pro-max** (`.claude/skills/`) |
| Kiểm công thức với đơn thật | `python tools/validate.py` |

## Design — "Nhìn rồi mới claim"

Chụp, xem ảnh, chấm 1–5: (a) nhìn 3 giây biết làm gì · (b) con số lãi to nhất màn · (c) đúng màu/font `design/style.md` ·
(d) chữ rõ, không che/cắt, không tràn ngang 390px · (e) trông như app thật trên Google Play. Ý nào < 4 → sửa → chụp lại.
Ghi: `node 4-memory/features.mjs note "design: a5 b4 c5 d5 e4"`.
