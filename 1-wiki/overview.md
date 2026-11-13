# Overview — Lãi Thật: Tính Phí Sàn TMĐT

App cho **shop nhỏ bán trên Shopee, TikTok Shop, Lazada**: nhập giá vốn và giá bán → thấy ngay **mỗi đơn còn lãi bao nhiêu sau phí sàn và thuế**,
hoặc nhập % lãi muốn có → ra **giá nên bán** (đã làm tròn giá đẹp). Không đăng nhập, không API sàn, chạy offline, dữ liệu trên máy.

- **Nguồn:** `raw/laithat-launch-kit.zip`, `raw/fees/SOURCES.md`, `raw/orders/real_orders.csv`; README/CLAUDE gốc của kit ở `1-wiki/kit-README.md`, `1-wiki/kit-CLAUDE.md`.
- **Bộ máy tính:** [engine/formula.md](engine/formula.md) — khớp **8/8 đơn Shopee thật** (lệch 0–1đ), xem `docs/VALIDATION_REPORT.md`.
- **Biểu phí:** [fees/shopee.md](fees/shopee.md) · [fees/tiktok_shop.md](fees/tiktok_shop.md) · [fees/lazada.md](fees/lazada.md) → `app/assets/fee_presets.json` (`fee_version` 2026-11-12.1).
- **Sản phẩm:** [product/features.md](product/features.md) (P0/P1/P2) · [product/decisions.md](product/decisions.md) · [product/competitors.md](product/competitors.md)
- **Tracking:** `docs/TRACKING_PLAN.md` · **Phát hành:** `docs/LAUNCH_CHECKLIST.md`, `docs/STORE_LISTING.md`
- **Phase build:** [phases.md](phases.md) — lần build này dừng ở **P1** và **ngày 2** của `docs/BUILD_PLAN.md`.

## Cho ai
Chủ shop nhỏ (1–3 người), bán vài chục đến vài trăm mã hàng, lãi ròng chỉ 7–10% trong khi phí sàn đã lên 23–25% (05/2026).
Họ đang tự xin file Excel tính phí. Cần: một con số lãi rõ ràng, biết phí nào ăn vào lãi, biết nên bán giá nào và sàn nào lãi hơn.

## Vòng dùng chính
Chọn sàn (1 lần) → **Tính lãi** (gõ giá vốn, giá bán; kết quả dính đáy màn, cập nhật khi gõ) → xem **từng khoản phí** →
đổi sang **từ % lãi** để ra giá nên bán → **so sánh sàn** / **chi phí ẩn** → **lưu sản phẩm** → khi sàn đổi phí, app **báo sản phẩm nào chuyển sang lỗ**.

## Nguyên tắc (canvas "Lãi Thật: UI/UX Direction")
1. **Con số trước, chữ sau** — tiền lãi là chữ lớn nhất màn.
2. **Một màn, một quyết định** — bán giá này có lãi không, nên bán giá nào, bán sàn nào.
3. **Không màu của sàn** — sàn là chip chữ trung tính.
