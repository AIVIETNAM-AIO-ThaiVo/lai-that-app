# Ý tưởng game — Parking Jam (raw)

> File gốc trong `raw/`: ghi chú ý tưởng của người làm sản phẩm. **Không bao giờ sửa file này.**
> Lệnh chat `/game` đọc nó rồi viết các trang `features/`, `screens/`, `decisions/` trong wiki.

## Game là gì

Bãi đỗ xe hình lưới 6×6, nhìn từ trên xuống. Mỗi xe dài 2 hoặc 3 ô, nằm ngang hoặc dọc,
và có **một hướng chạy** (mũi tên trên xe). Người chơi chạm vào xe:

- Nếu đường từ đầu xe tới mép bãi **trống** → xe chạy thẳng ra khỏi bãi và biến mất.
- Nếu có xe khác chắn đường → xe **không đi**, chỉ rung nhẹ để báo bị chặn.

Mục tiêu: đưa hết xe ra khỏi bãi.

## Tính năng

1. **Bãi xe**: hiển thị lưới 6×6 và các xe của level hiện tại, mỗi xe có màu và mũi tên chỉ hướng.
2. **Chạm xe ra bãi**: chạm xe có đường trống thì xe rời bãi.
3. **Xe bị chặn**: chạm xe bị chặn thì xe đứng yên, có hiệu ứng rung, số xe trong bãi không đổi.
4. **Hoàn thành level**: khi bãi không còn xe, hiện màn "Hoàn thành!".
5. **Đếm lượt chạm**: góc trên hiện "Lượt: N". Mỗi lần chạm vào xe (kể cả bị chặn) tăng 1. Vào level mới thì về 0.
6. **Chơi lại**: nút "Chơi lại" đưa level hiện tại về trạng thái ban đầu, số lượt về 0.
7. **Nhiều level**: có 3 level. Ở màn "Hoàn thành!" có nút "Level tiếp" để sang level sau. Hết level 3 thì hiện "Bạn đã phá đảo!".

## Ràng buộc kỹ thuật

- Chỉ HTML + CSS + JavaScript thuần, không thư viện, không bước build.
- Luật chơi nằm trong `game/logic.js` (hàm thuần, không đụng DOM) để test được bằng `node --test`.
- Giao diện trong `game/index.html` + `game/ui.js`.
- Giao diện phải mở cho bot test qua `window.__game` (xem `CLAUDE.md`).
