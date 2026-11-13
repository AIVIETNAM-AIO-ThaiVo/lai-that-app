# F6 — Chi tiết phí ("17.000đ đi đâu?")

**Phase:** 1 · **Màn:** S3 `#/chi-tiet` · **Canvas:** `design-canvas/S3-ChiTietPhi.dc.html`

## Done when
- [ ] `#to-breakdown` mở màn có tiêu đề "17.000đ đi đâu?" và `#take-rate` "Sàn + thuế lấy 6.995đ, tức 41% giá bán".
- [ ] Các `.fee-line`: Phí cố định ngành 16% −2.720đ · Phí xử lý giao dịch 6% −1.020đ · Phí hạ tầng −3.000đ · Thuế 1,5% −255đ · Đóng gói −1.500đ · Giá vốn −8.000đ; `#remaining` "Còn lại: lãi mỏng 505đ".
- [ ] Nút `.fee-info` (i) mở `.fee-basis` ghi cách tính + nguồn + ngày áp dụng; event `fee_info_opened {fee_key}`.
- [ ] Công tắc `#prog-voucher_xtra`, `#prog-piship`, `#prog-visibility`, `#tax-vat`, `#tax-pit` đổi kết quả ngay (bật PiShip → lãi giảm 2.700đ); event `program_toggled`.
- [ ] Sửa % giao dịch `#rate-transaction` và phí mỗi đơn `#fixed-per-order` được (TikTok/Lazada ghi "chưa đối chiếu đủ đơn thật"); TikTok có `#registered` (đã đăng ký MST: chia 1,1).
- [ ] Event `fee_breakdown_opened {platform}`.
