# ① WIKI — nguồn sự thật của Lãi Thật (mẫu LLM Wiki)

```
raw/                 ← (thư mục gốc) nguồn: biểu phí, đơn thật, launch kit. Chỉ đọc, chỉ thêm.
1-wiki/
├── overview.md      ← sản phẩm trong 1 trang
├── phases.md        ← phase build + "Xong khi" để PM duyệt
├── fees/            ← biểu phí từng sàn, mỗi % có nguồn + ngày
├── engine/          ← công thức duy nhất + ca kiểm thử
├── product/         ← tính năng P0/P1/P2, quyết định, đối thủ, ADR
├── features/        ← mỗi tính năng một trang có "Done when"
├── screens.md       ← màn hình + selector cho bot
├── design/style.md  ← màu, chữ, thành phần ; design-canvas/ = thiết kế gốc
├── learned.md       ← bài học từ lần sai
├── index.md · log.md
```

Thao tác (từ CLAUDE.md của kit): **Ingest** nguồn mới vào `raw/` → cập nhật wiki → log · **Build** sinh `app/assets/fee_presets.json`, tăng `fee_version`, chạy validate + test · **Lint** tìm phí thiếu nguồn · **Sync** đối chiếu app với wiki.
