# Lãi Thật: Tính Phí Sàn TMĐT

App Android giúp shop nhỏ ở Việt Nam biết **lãi thật mỗi đơn** sau phí Shopee, TikTok Shop, Lazada và **nên bán giá nào**, trước khi đăng sản phẩm. App không dùng AI; toàn bộ app được build bằng AI (Claude) theo mẫu LLM Wiki.

> Ứng dụng độc lập, không liên kết với Shopee, TikTok hay Lazada. Biểu phí dùng để tham khảo, ghi rõ ngày áp dụng; người dùng sửa được mọi con số.

## Vấn đề

- Phí sàn chiếm khoảng 23–25% doanh thu trong khi lãi ròng của shop nhỏ chỉ 7–10%, và cả ba sàn cùng tăng phí trong tháng 5/2026.
- Người bán đang tự đi xin file Excel tính phí: một video TikTok "Tặng file tính giá Shopee 2026" có 1.857 lượt thích và 330 bình luận xin file.
- Đối thủ trực tiếp trên Google Play (Shopee Calc) mới có hơn 500 lượt cài và chỉ cho chọn vài ngành; người bán vẫn quay về file Excel.

## Tính năng (MVP)

| Màn | Làm gì | Gói |
|---|---|---|
| Chọn sàn | Sàn chính, Shop thường/Mall. Không cần đăng nhập, dữ liệu lưu trên máy | Miễn phí |
| Tính lãi | Hai chế độ: **từ giá bán** (ra lãi, % lãi, hòa vốn) hoặc **từ % lãi muốn có** (ra giá nên bán, đã làm tròn giá đẹp). Có ô mã giảm giá shop (đ hoặc %) và ship người mua trả. Kết quả dính đáy màn, cập nhật khi gõ | Miễn phí |
| Chi tiết phí | Từng khoản phí, nút (i) giải thích cách tính và nguồn, công tắc Voucher Xtra / PiShip / phí hiển thị / thuế, dòng "Sàn + thuế lấy X%" | Miễn phí |
| So sánh sàn | Cùng sản phẩm, lãi trên Shopee / TikTok Shop / Lazada | Miễn phí |
| Chi phí ẩn | Hoàn hàng, voucher, quảng cáo: ROAS hòa vốn và số tiền ads tối đa mỗi đơn | Miễn phí |
| Flash Sale & giá nhập | Lãi khi giảm 10/20/30%, giá nhập tối đa để giữ % lãi | Pro (hoặc xem 1 quảng cáo thưởng) |
| Danh mục + báo động | Lưu sản phẩm, sắp lãi thấp nhất lên đầu, giá gợi ý; khi sàn đổi phí, báo sản phẩm nào chuyển sang lỗ | 5 sản phẩm miễn phí / Pro không giới hạn và báo động từng sản phẩm |
| Pro | 49.000đ/tháng hoặc 299.000đ/năm, dùng thử 3 ngày, không quảng cáo | |

Thiết kế giao diện: canvas "Lãi Thật: UI/UX Direction" (8 màn 390×844, nền #F6F7F9, lãi #0A7A6B, lãi mỏng #A16207, lỗ #C2410C, font Be Vietnam Pro).

## Bộ máy tính đã được kiểm chứng

Công thức (chi tiết ở [`wiki/engine/formula.md`](wiki/engine/formula.md)):

```
B   = giá − mã giảm giá shop                      (cơ sở của mọi phí % và thuế)
Phí = c·B + 6%·(B + ship người mua trả) + voucher(B, trần 50.000đ) + hiển thị·B + phí/đơn
Thuế = (1% GTGT + 0,5% TNCN)·B
Lãi kỳ vọng = (1 − r)·(B − Phí − Thuế − affiliate − ads − giá vốn − đóng gói) − r·R
```

Đối chiếu với **8 đơn Shopee thật** (sau đợt đổi phí 05/2026, lấy từ màn Chi tiết doanh thu mà người bán chia sẻ công khai): **8/8 đơn lệch 0–1đ**, yêu cầu là dưới 1% giá bán. Xem [`docs/VALIDATION_REPORT.md`](docs/VALIDATION_REPORT.md). Phí TikTok Shop mới đối chiếu được 1 đơn nên mọi dòng phí TikTok cho người dùng sửa.

```bash
python3 tools/validate.py          # đối chiếu 8 đơn thật, xuất app/test/test_vectors.json
python3 tools/engine.py            # ca mẫu: móc khóa 17.000đ → lãi 505đ (3,0%)
cd app && flutter test             # unit test bản Dart (test/fee_engine_test.dart)
```

## Cấu trúc repo (mẫu LLM Wiki của Karpathy)

```
CLAUDE.md                 luật cho AI: dữ liệu, công thức, sản phẩm, thao tác
raw/                      nguồn gốc, chỉ thêm, không sửa (biểu phí, đơn thật)
wiki/                     tri thức do AI duy trì: fees/, engine/, product/, log.md
app/                      mã Flutter
  assets/fee_presets.json biểu phí v2 (cũng đưa lên Firebase Remote Config)
  lib/engine/fee_engine.dart
  test/fee_engine_test.dart, test/test_vectors.json
tools/                    engine.py (bản tham chiếu), validate.py
docs/                     tracking plan, store listing, privacy policy, checklist phát hành, kịch bản demo
```

## Kỹ thuật

Flutter (Android trước), Material 3 · SQLite cho danh mục · Firebase Remote Config (`fee_presets`, `fee_version`, `pro_prices`) · Firebase Analytics + Crashlytics · Google Mobile Ads + UMP · Google Play Billing (`in_app_purchase`) · thông báo cục bộ + WorkManager kiểm tra biểu phí mỗi ngày. Quyền: `INTERNET`, `POST_NOTIFICATIONS` (chỉ xin khi bật báo động).

## Tracking

14+ sự kiện Firebase, phễu chính `onboarding_completed → calc_completed → product_saved → paywall_view → purchase`. Xem [`docs/TRACKING_PLAN.md`](docs/TRACKING_PLAN.md).

## Cách AI build app này

Mọi số phí trong app truy ngược được về một nguồn trong `raw/` kèm ngày áp dụng. Khi sàn đổi phí: Ingest nguồn mới → cập nhật `wiki/fees` → Build sinh `fee_presets.json`, tăng `fee_version`, chạy test → đẩy Remote Config → app tự báo người dùng sản phẩm nào chuyển sang lỗ.

## Nguồn chính

- Học viện Shopee: [Phí xử lý giao dịch](https://banhang.shopee.vn/edu/article/2150), [Phí cố định non-Mall](https://banhang.shopee.vn/edu/article/2139), [Một số phí bán hàng](https://banhang.shopee.vn/edu/article/251)
- Nghị định 117/2025/NĐ-CP về khấu trừ thuế trên sàn TMĐT
- Danh sách đầy đủ: [`raw/fees/SOURCES.md`](raw/fees/SOURCES.md)
