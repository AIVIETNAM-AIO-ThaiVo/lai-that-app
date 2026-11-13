# Learned Wiki — bài học từ những lần sai

> AI đọc file này trước khi code để không lặp lại lỗi cũ. Harness tự ghi thêm khi một tính năng thất bại quá số lần cho phép.

- **Đừng sửa test cho xanh.** Test đỏ thì sửa code trong `app/`.
- **Phép tính phải nằm trong hàm thuần** (`app/engine.js`), không trong `ui.js`.
- **Làm tròn chỉ khi hiển thị** (luật kit). Tính bằng số thực đầy đủ, `formatVnd` mới làm tròn.
- **Ô `<select>` / input trong hàng flex phải có `min-width: 0`**, không thì trang rộng hơn 390px và cú chạm của bot lệch (bài học từ dự án trước).
- **Không dùng `canvas.toBlob`** (đôi khi không gọi lại trong Chrome headless) → `toDataURL`.
- **Chia sẻ của máy (Web Share) chỉ dùng trên thiết bị cảm ứng**; Chrome máy tính/headless có thể treo hộp chia sẻ.
- **Hai `<span>` liền nhau phải có khoảng trắng ở giữa** (`</span> <span>`): flex nhìn thì cách, nhưng chữ đọc ra (trình đọc màn hình, bot, chép) bị dính "Móc khóa17.000đ". Đã gặp 2 lần (Flash Sale, ví dụ mẫu).
- **Bàn phím mở che thanh điều hướng** — kịch bản bot bấm "Xong" trước khi chuyển tab (`h.tab()`), như người dùng.
- **Không chạy hiệu ứng "hiện dần" khi vẽ lại cùng một màn** — gây nháy, ảnh chụp mờ.
- Bot xanh nhưng ảnh vẫn có thể sai ("undefined" trong thẻ): luôn nhìn ảnh trước khi duyệt; thêm check chữ undefined/NaN cho màn mới.
- Quay video bằng getDisplayMedia + cờ tự chấp nhận có thể quay CẢ MÀN HÌNH MÁY (lộ dữ liệu người dùng). Chỉ quay bằng CDP Page.startScreencast của đúng trang app; luôn mở thử vài khung trước khi giao.
- Kiểm video trên server không hỗ trợ Range (serve.mjs) thì tua luôn về 0 — không phải lỗi file; dùng server có Range để kiểm.
