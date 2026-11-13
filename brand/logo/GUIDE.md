# Logo Lãi Thật — hướng dẫn dùng (1 trang)

Làm bằng skill **logo-design** (`.claude/skills/logo-design`), 13/11/2026. Người dùng chọn qua 4 bước:
brief (rõ ràng · đáng tin, xanh lãi, tránh đồng xu / máy tính) → hướng **A · Phần còn lại** → màu **mảnh phí xám** → bản ghép ngang + dọc.

**Ý tưởng:** từ khối giá vuông, một mảnh phí bị tách ra; phần còn lại là chữ **L** — lãi thật.

## File gốc (`brand/logo/final/`)
| File | Dùng khi |
|---|---|
| `laithat-symbol.svg` | Biểu tượng chuẩn, từ 48 px trở lên |
| `laithat-symbol-small.svg` | Dưới 48 px (favicon): mảnh phí xám đậm hơn để không chìm |
| `laithat-app-icon.svg` / `-maskable.svg` | Icon app: nền xanh, L trắng, mảnh phí xanh nhạt |
| `laithat-horizontal.svg` | Đầu trang, web, tài liệu |
| `laithat-stacked.svg` | Màn chào, ảnh Google Play, vuông |
| `*-black / -white / -mono-0a7a6b.svg` | In một màu, nền tối, khắc/in nhãn |
| `web/` | favicon.ico/svg, PNG 16–512, apple-touch, maskable, `site.webmanifest`, `head-snippet.html` |

Chữ "Lãi Thật" đã đổi thành nét vẽ từ **Be Vietnam Pro Bold** (SIL Open Font License — cho phép dùng làm logo).

## Màu
| | HEX | RGB |
|---|---|---|
| Xanh lãi (chữ L) | `#0A7A6B` | 10, 122, 107 |
| Mảnh phí (lớn) | `#C9CFD8` | 201, 207, 216 |
| Mảnh phí (≤ 32 px) | `#8C96A3` | 140, 150, 163 |
| Mảnh phí trên icon | `#9FD3C9` | 159, 211, 201 |
| Chữ | `#12161C` | 18, 22, 28 |

## Quy tắc
- **Khoảng trống quanh logo:** tối thiểu bằng cạnh mảnh phí (≈ 30% chiều cao biểu tượng).
- **Cỡ nhỏ nhất:** biểu tượng 16 px (dùng bản small); bản ghép ngang cao ≥ 24 px.
- **Nền:** trắng / `#F6F7F9` dùng bản màu; nền tối dùng bản trắng; ảnh nhiều chi tiết dùng icon app (có ô nền).
- **Không:** đổi màu L sang màu sàn (cam, hồng, xanh dương); xoay; kéo méo; thêm bóng/gradient; đổi mảnh phí sang màu đậm hơn L; ghép thêm đồng xu, mũi tên.

## Đã kiểm
`svg_audit.py`: biểu tượng 100/100, ngang 97/100, icon 99/100 · xem ở 16/32/48/192/512 px trên nền sáng và tối · đã gắn vào app (icon, favicon, màn Chọn sàn, Cài đặt), bot 111 bước xanh.
**Chưa làm:** tra cứu nhãn hiệu (cần chuyên viên/tra cơ sở dữ liệu nhãn hiệu trước khi đăng ký); bảng trình bày mockup của skill (`presentation_board.py`) — làm khi cần ảnh giới thiệu.
