# Hướng dẫn nhanh — làm việc với Claude trên Lãi Thật

Bạn **không cần biết code** và **không cần gõ lệnh**. Cứ nói bằng tiếng Việt. Claude đóng vai **PM + người build**:
làm theo phase trong `1-wiki/phases.md`, tự kiểm, tự duyệt (`4-memory/pm-review.md`), đạt mới sang phase sau.

| Bạn muốn | Nói với Claude |
|---|---|
| Xem app | "mở app" hoặc gõ **/play** |
| Chuẩn bị nộp bài | điền bảng Team + link video trong `README.md`, xem `docs/LAUNCH_CHECKLIST.md` |
| Thêm / sửa tính năng | "thêm xuất file Excel cho danh mục" |
| Sàn đổi phí | bỏ nguồn mới vào `raw/fees/`, nói "đọc nguồn mới" → Claude cập nhật `1-wiki/fees/`, sinh lại biểu phí, chạy kiểm |
| Trả lời câu hỏi của AI | mở `4-memory/po-questions.md`, ghi câu trả lời dưới câu hỏi rồi nói "đã trả lời" |

## Khi nào là "xong"?

Chỉ khi `bash 3-verification/verify.sh` báo **🟢 XANH** và PM review ghi **ĐẠT**. Xem ảnh bot chụp ở `reports/latest/report.html`.

## Mẹo

- Đổi giá Pro, giới hạn danh mục, bật khoá Pro: `app/assets/app_config.json`.
- `_archive/` là dự án cũ, xoá hẳn được. Ba file trong `1-wiki/raw/` (pdf, docx, game-idea.md) cũng là của dự án cũ.
