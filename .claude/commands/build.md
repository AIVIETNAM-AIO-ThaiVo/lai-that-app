---
description: Bạn (Model kiêm PM) build Lãi Thật theo từng phase tới khi Verification xanh và PM duyệt ĐẠT — chế độ model_led
---

Đọc `2-environment/rules.md` (mục **Quy trình theo phase**). Trả lời tiếng Việt, ngắn.

1. `node 4-memory/features.mjs brief` + `1-wiki/phases.md` + `4-memory/pm-review.md` → biết đang ở phase nào. Báo một dòng.
2. Với từng tính năng của phase: đọc trang feature + spec (`1-wiki/engine/formula.md`, `fees/`, `screens.md`, `design/style.md`)
   → viết test trước (đỏ) → code (xanh) → thêm bước vào `app/e2e.mjs` (gọi `shot()`) → `claim F<số>` → `note "…"`.
3. Trước khi claim tính năng có giao diện: **nhìn** (`node 2-environment/bot.mjs --look` hoặc Playwright), so với `1-wiki/design-canvas/`.
4. `bash 3-verification/verify.sh`. Đỏ: sửa, tối đa 3 lần/tính năng; quá thì `block` + ghi `1-wiki/learned.md`.
5. **PM review**: Read ảnh `reports/latest/*.png`, chấm design 5 ý, đối chiếu "Xong khi" của phase → ghi `4-memory/pm-review.md`.
   ĐẠT → sang phase sau (quay lại bước 1). CHƯA ĐẠT → sửa và verify lại.
6. Dừng ở giới hạn trong `phases.md`. Cuối cùng: `node 4-memory/features.mjs list`, tóm tắt `po-questions.md`, gợi ý gõ **/play**.
