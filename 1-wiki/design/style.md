# Style — Lãi Thật (từ canvas "Lãi Thật: UI/UX Direction", `design-canvas/Main.dc.html`)

## 3 tính từ
**rõ ràng · thực dụng · đáng tin** — "Một máy tính lãi cho người bán trên sàn".

## Màu: ba trạng thái tiền (token trong `:root`)
| Token | Mã | Dùng cho |
|---|---|---|
| `--bg` | `#F6F7F9` | nền app |
| `--ink` | `#12161C` | chữ chính, nút chính (đen) |
| `--muted` | `#5B6472` | chữ phụ |
| `--line` | `#C9CFD8` | viền ô nhập, chip |
| `--good` | `#0A7A6B` | Lãi (≥ 10%) · nền nhạt `#E3F2EF` |
| `--thin` | `#A16207` | Lãi mỏng (< 10%) · nền nhạt `#FDF3E1` |
| `--loss` | `#C2410C` | Lỗ · nền nhạt `#FBE9E1` |
Trạng thái luôn có chữ ("Lãi", "Lãi mỏng", "Lỗ") và dấu trừ, không chỉ màu. Không dùng cam Shopee, đen-hồng TikTok, xanh Lazada.

## Logo (13/11/2026, chi tiết: `brand/logo/GUIDE.md`)
Hướng **A · Phần còn lại**: khối giá vuông bị tách một mảnh phí, phần còn lại là chữ L. L xanh `#0A7A6B`, mảnh phí xám `#C9CFD8`
(≤ 32 px: `#8C96A3`). Icon app: nền xanh, L trắng, mảnh phí `#9FD3C9`. File trong app: `app/icon.svg`, `app/icons/`, `app/assets/logo-*.svg`. Logo chỉ ở màn mở app (F20) và màn Chọn sàn — không ở Cài đặt.

## Chữ — Be Vietnam Pro (đóng gói ở `app/fonts/`, OFL), số tabular
Số lớn 44/700 · Tiêu đề 22/700 · Nội dung 16/400 · Nhãn 13/500. Số dùng `font-variant-numeric: tabular-nums`, dấu chấm nghìn, "đ" sau số, dấu trừ "−".

## Thành phần
- Bo góc 12–16px, lưới 8px, chạm ≥ 44px (bot kiểm ≥ 40px; app dùng 48px cho nút chính).
- Ô nhập tiền: cao 48–52px, viền `--line`, đơn vị "đ" bên phải, tự chèn dấu chấm nghìn; thanh phụ phím **000** khi đang gõ.
- Tab phân đoạn nền `#E8EBEF`, tab chọn nền trắng có bóng nhẹ (`aria-selected`).
- **Thẻ kết quả dính đáy màn**: nền theo trạng thái, số lãi lớn + nhãn + %, hòa vốn bên phải, dải "tiền đi đâu" (sàn + thuế / vốn + gói / lãi).
- Thanh điều hướng đáy 4 mục: Tính · So sánh · Sản phẩm · Cài đặt.
- Nút chính đen `--ink`, chữ trắng; nút phụ viền.

## Chuyển động
Số lãi đổi: nhấp nhẹ (scale 1.02) 150ms. Sheet trượt lên 200ms. Chỉ `transform`/`opacity`, tắt khi `prefers-reduced-motion`.

## Giọng văn
"Lãi mỗi đơn 505đ · Lãi mỏng 3,0%". "Sàn + thuế lấy 6.995đ, tức 41% giá bán". "Biểu phí Shopee cập nhật 12/11/2026 · ước tính độc lập, không liên kết với sàn".
