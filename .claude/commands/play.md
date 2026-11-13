---
description: Mở app Hóa Đơn Trọ để dùng thử và cho bot tự chạy hết luồng, xuất báo cáo có ảnh (Harness Automation Test)
---

Trả lời tiếng Việt, ngắn.

1. Chạy `bash test.sh` (bot đi hết luồng người thuê + chủ trọ trong Chrome, mở báo cáo có ảnh). Báo 🟢/🔴 và các bước bot đã kiểm.
2. Chạy server ở chế độ nền: `node 2-environment/serve.mjs` (chạy nền, không chờ), rồi mở http://localhost:5173
   (`start` trên Windows, `open` trên macOS, `xdg-open` trên Linux). Gợi ý mở bằng điện thoại cùng mạng hoặc DevTools chế độ điện thoại.
3. Gợi ý: "Muốn thêm/sửa tính năng? Cứ nói." Nếu họ nói: viết trang feature mới trong `1-wiki/features/`
   (dòng đầu `# F<số> — Tên`, mục `## Done when` đo được), `node 4-memory/features.mjs sync`, trình bày, rồi bảo gõ /build.
