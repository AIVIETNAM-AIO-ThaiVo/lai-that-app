// F25 — Luật quảng cáo (hàm thuần). 1-wiki/features/F25-quang-cao-dong-y.md
// Bản web vẽ khung "Quảng cáo thử" đúng vị trí/tần suất; bản Android thay bằng đơn vị AdMob (ID thử của Google khi test).
import { isPro } from './store.js';

/** Còn cần hỏi đồng ý (vai trò UMP): quảng cáo đang bật, chưa Pro, chưa trả lời. */
export const consentNeeded = (state, config, now = Date.now()) => !!config.ads_enabled && !isPro(state, now) && state.adConsent == null;

/** Được hiện quảng cáo: bật quảng cáo, chưa Pro, đã trả lời bảng đồng ý. */
export const adsActive = (state, config, now = Date.now()) => !!config.ads_enabled && !isPro(state, now) && state.adConsent != null;

/** Vị trí banner theo route: chỉ Danh mục và Cài đặt (Biểu phí). Không bao giờ ở Tính lãi / màn sản phẩm. */
export function bannerPlacement(hash) {
  const key = String(hash).split('?')[0];
  if (key === '#/san-pham') return 'catalog';
  if (key === '#/cai-dat') return 'fees';
  return null;
}

/** Interstitial khi chuyển màn: phiên thứ 3 trở đi, ≥ N lần calc_completed từ lần trước, cách ≥ min giây, không mở ra Tính lãi. */
export function interstitialDue({ sessions, calcsSince, lastAt, now, to }, config) {
  const key = String(to).split('?')[0];
  if (key === '#/tinh' || key === '#/chon-san' || key === '') return false;
  // add-on: không quảng cáo trên màn dựng combo, nhập đơn kiểm tra (F28, F29)
  if (key.startsWith('#/combo') || key === '#/kiem-tra') return false;
  if (sessions < 3) return false;
  if (calcsSince < (config.interstitial_after_calcs ?? 3)) return false;
  return now - (lastAt || 0) >= (config.interstitial_min_seconds ?? 180) * 1000;
}
