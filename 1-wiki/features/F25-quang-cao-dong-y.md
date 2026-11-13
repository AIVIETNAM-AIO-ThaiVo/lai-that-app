# F25 — Quảng cáo + đồng ý (luật hiển thị; khung thử trên web)

**Phase:** 8 (ngày 3) · **Màn:** Danh mục, Cài đặt (Biểu phí), lớp `#interstitial`, `#rewarded`

Luật (`docs/TRACKING_PLAN.md`, `decisions.md`): banner thích ứng ở **Danh mục** và **Biểu phí**; interstitial sau `calc_completed`
thứ 3 trong phiên, tối đa 3 phút/lần, **không** trong 2 phiên đầu; rewarded mở 1 lần Flash Sale / giá nhập tối đa.
**Không quảng cáo trên màn Tính lãi.** Pro không có quảng cáo.

Bản web (trình duyệt) không gắn được SDK AdMob (SDK gốc Android). `app/ads.js` giữ luật hiển thị (hàm thuần) và vẽ **khung quảng cáo thử**
ghi rõ "Quảng cáo thử" — đúng vị trí, kích thước, tần suất; khi đóng gói Android thì thay khung bằng đơn vị AdMob thật
(ID thử của Google trong lúc test). PO chọn Capacitor (ADR-002): trong app, khung thử được thay bằng AdMob thật — F27.

## Done when
- [ ] Đồng ý quảng cáo (vai trò UMP): lần đầu sắp có quảng cáo, thẻ `#ad-consent` hỏi "Quảng cáo cá nhân hoá?" — `#consent-yes` / `#consent-no` (không chặn màn hình); đổi lại được ở Cài đặt `#ad-consent-change`. Chưa trả lời thì chưa hiện quảng cáo.
- [ ] Banner `.ad-banner[data-placement]` chỉ ở Danh mục (`catalog`) và Cài đặt › Biểu phí (`fees`); không bao giờ ở `#/tinh`, Chi tiết phí, So sánh, Chọn sàn, màn sản phẩm. Ghi `ad_impression {format: banner, placement}` 1 lần mỗi lượt vào màn.
- [ ] Interstitial `#interstitial`: chỉ khi chuyển sang màn khác Tính lãi, sau ≥ 3 lần `calc_completed` từ lần trước, cách lần trước ≥ 180 giây, phiên thứ 3 trở đi; có nút `#interstitial-close` (đóng được sau vài giây); `ad_impression {format: interstitial}`.
- [ ] Rewarded: thẻ Flash Sale đang khoá có `#watch-ad` "Xem quảng cáo để mở"; xem hết (`#rewarded`) → mở Flash Sale + giá nhập tối đa trong phiên này, ghi `rewarded_ad_complete {reward: flash_sale}` và `flash_sale_viewed {unlock_method: rewarded}`.
- [ ] Pro: không banner, không interstitial, không cần rewarded.
- [ ] Unit: `interstitialDue`, `bannerAllowed`, `adsActive`.
