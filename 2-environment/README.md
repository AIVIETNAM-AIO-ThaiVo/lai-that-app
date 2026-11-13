# ② ENVIRONMENT — tay và mắt của AI

| File | Là gì |
|---|---|
| `../.claude/settings.json` | **Tool Calling**: AI được tự chạy lệnh nào, và **không** được sửa file nào (`features.json`, `3-verification/`, `1-wiki/raw/`). |
| `rules.md` | Luật làm việc của AI cho Hóa Đơn Trọ. `CLAUDE.md` ở thư mục gốc kéo file này vào. |
| `../.mcp.json` | **MCP**: Playwright (trình duyệt điện thoại 390×844 để bấm thử, chụp ảnh), context7 (tra tài liệu thư viện). |
| `../.claude/skills/ui-ux-pro-max/` | Skill UI/UX Pro Max: bảng ưu tiên 1→10 + Pre-Delivery Checklist khi làm/chấm giao diện. |
| `bot.mjs` | "Mắt" của harness: điều khiển Chrome/Edge, dùng app như người (chạm, gõ), chụp ảnh, kiểm design (font, tràn ngang ở mọi màn, vùng chạm). `--look` = chụp 1 ảnh. |
| `serve.mjs` | Server nhỏ mở app (`APP_DIR` trong `harness.config`): `node 2-environment/serve.mjs` |
| `get-asset.sh` | Tải icon/hình có giấy phép (nguồn đã duyệt). |
| `monitor.mjs`, `monitor-hook.mjs`, `doctor.mjs` | Theo dõi harness làm việc trực tiếp; kiểm tra máy khi mở phiên. |
