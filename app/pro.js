// F24 — Lãi Thật Pro: gói, 4 điểm paywall, lời paywall (1-wiki/features/F24-lai-that-pro.md). Hàm thuần.
import { formatVnd } from './engine.js';

/** Đúng 4 điểm kích hoạt (decisions 13/11). */
export const PAYWALL_TRIGGERS = ['catalog_limit', 'fee_alert', 'flash_sale', 'settings'];

/** Nguồn paywall của add-on phase 10 (F28 combo, F30 kiểm tra cả file) — ngoài 4 điểm lõi. */
export const ADDON_TRIGGERS = ['combo_tab', 'order_check_file'];

export const PLANS = [{ id: 'monthly' }, { id: 'yearly' }];

export const BENEFITS = [
  'Danh mục không giới hạn sản phẩm',
  'Báo động đổi phí chỉ rõ từng sản phẩm chuyển lỗ + giá đề xuất',
  'Flash Sale 10/20/30% và giá nhập tối đa',
  'Không quảng cáo',
];

const HEAD = {
  catalog_limit: ['Lưu hơn 5 sản phẩm', 'Gói miễn phí lưu 5 sản phẩm. Pro lưu không giới hạn và theo dõi lãi khi sàn đổi phí.'],
  fee_alert: ['Xem sản phẩm nào chuyển sang lỗ', 'Gói miễn phí thấy số lượng. Pro chỉ rõ từng sản phẩm và giá nên bán.'],
  flash_sale: ['Flash Sale & giá nhập tối đa', 'Biết giảm bao nhiêu thì lỗ, và nhập hàng tối đa giá nào để vẫn giữ lãi.'],
  combo_tab: ['Dựng combo của riêng bạn', 'Gộp 2–5 món, so với bán lẻ, biết giảm tối đa bao nhiêu và lưu combo vào danh mục.'],
  order_check_file: ['Kiểm tra cả file Báo Cáo Doanh Thu', 'Gói miễn phí xem tóm tắt và 3 đơn đầu. Pro xem mọi đơn lệch, gán SKU với sản phẩm và nhớ cho lần sau.'],
  settings: ['Lãi Thật Pro','Cho shop có nhiều sản phẩm: theo dõi lãi cả danh mục khi sàn đổi phí.'],
};

/** Lời paywall theo điểm kích hoạt. prices = app_config.pro_prices. */
export function paywallCopy(trigger, prices) {
  const [title, lead] = HEAD[trigger] ?? HEAD.settings;
  const m = formatVnd(prices.monthly);
  const y = formatVnd(prices.yearly);
  const perMonth = formatVnd(Math.round(prices.yearly / 12 / 100) * 100);
  return {
    title, lead, benefits: BENEFITS,
    plans: [
      { id: 'monthly', label: 'Gói tháng', priceText: `${m}/tháng`, note: `Dùng thử ${prices.trial_days} ngày miễn phí`, cta: `Dùng thử ${prices.trial_days} ngày miễn phí` },
      { id: 'yearly', label: 'Gói năm', priceText: `${y}/năm`, note: `≈ ${perMonth}/tháng`, cta: `Mua gói năm ${y}` },
    ],
    terms: `Gói tự gia hạn. Gói tháng: dùng thử ${prices.trial_days} ngày, sau đó trừ ${m}/tháng nếu bạn không huỷ; app nhắc bạn 1 ngày trước khi hết dùng thử. `
      + `Huỷ bất cứ lúc nào trong Google Play › Thanh toán và gói đăng ký; vẫn dùng Pro tới hết kỳ đã trả.`,
    restore: 'Khôi phục giao dịch',
    disclaimer: 'Lãi Thật là công cụ độc lập, không liên kết với sàn nào.',
  };
}
