// Biểu phí: chọn phiên bản, ngành, nguồn và ngày áp dụng từng khoản. Hàm thuần.
// Nguồn số liệu: app/assets/fee_presets.json (sinh từ 1-wiki/fees/ bằng thao tác Build — không sửa tay).

export const DISCLAIMER = 'Ứng dụng độc lập, không liên kết với Shopee, TikTok hay Lazada. Biểu phí để tham khảo, ghi rõ ngày áp dụng; bạn sửa được mọi con số.';
export const SHORT_NAME = { shopee: 'Shopee', tiktok_shop: 'TikTok Shop', lazada: 'Lazada' };
export const PLATFORMS = ['shopee', 'tiktok_shop', 'lazada'];

/** "2026-05-01" → "01/05/2026"; "2026-05" → "05/2026" */
export function vnDate(iso) {
  if (!iso) return '';
  const [y, m, d] = String(iso).split('-');
  return d ? `${d}/${m}/${y}` : `${m}/${y}`;
}

/** So phiên bản "YYYY-MM-DD.n": a mới hơn b? */
export function newerVersion(a, b) {
  if (!a) return false;
  if (!b) return true;
  const [da, na] = a.split('.');
  const [db, nb] = b.split('.');
  return da !== db ? da > db : Number(na) > Number(nb);
}

const valid = (p) => !!(p && p.fee_version && p.platforms && p.platforms.shopee);

/** Chọn biểu phí: bản hợp lệ mới nhất trong (máy chủ, cache); không có thì bản đóng gói. */
export function pickPresets({ remote, cache, bundled }) {
  let best = bundled;
  for (const p of [cache, remote]) if (valid(p) && newerVersion(p.fee_version, best.fee_version)) best = p;
  return best;
}

/** Ngành của một sàn: [{ name, rate (null = người dùng nhập), min, max }]. */
export function categoriesFor(presets, platform) {
  const pf = presets.platforms[platform];
  return (pf.categories ?? []).map((c) => ({ name: c.name, rate: c.default ?? null, min: c.min ?? null, max: c.max ?? null }));
}

export const feeDateLabel = (presets, platform) => `Biểu phí ${SHORT_NAME[platform]} cập nhật ${vnDate(presets.as_of)}`;

/** Lựa chọn ở màn Chọn sàn, ghi ngày biểu phí lấy từ chính biểu phí. */
export function platformOptions(presets) {
  const s = presets.platforms.shopee;
  const t = presets.platforms.tiktok_shop;
  return [
    { id: 'shopee', label: 'Shopee', note: `Biểu phí từ ${vnDate(s.fixed_fee_effective)} · ${s.categories.length} ngành` },
    { id: 'tiktok_shop', label: 'TikTok Shop', note: `Biểu phí từ ${vnDate(t.transaction_fee.effective)}` },
    { id: 'lazada', label: 'Lazada', note: 'Bạn tự nhập % hoa hồng' },
    { id: 'multi', label: 'Nhiều sàn', note: 'Mở sẵn màn so sánh' },
  ];
}

/** Tên, nguồn, ngày áp dụng của từng dòng phí — cho nút (i). */
export function feeInfo(presets, platform, key) {
  const pf = presets.platforms[platform];
  const prog = (id) => (pf.programs ?? []).find((p) => p.id === id);
  switch (key) {
    case 'category':
      return platform === 'shopee'
        ? { label: 'Phí cố định ngành', source: pf.fixed_fee_source, effective: vnDate(pf.fixed_fee_effective) }
        : { label: 'Hoa hồng', source: pf.commission_source ?? pf.status ?? 'Bạn tự nhập', effective: '' };
    case 'transaction':
      return { label: platform === 'lazada' ? 'Phí xử lý đơn' : 'Phí xử lý giao dịch', source: pf.transaction_fee.source ? `Học viện Shopee — ${pf.transaction_fee.source}` : (pf.transaction_fee.note ?? ''), effective: vnDate(pf.transaction_fee.effective) };
    case 'per_order': {
      const f = (pf.per_order_fixed ?? []).find((x) => x.amount != null) ?? {};
      return { label: platform === 'shopee' ? 'Phí hạ tầng mỗi đơn' : (f.name ?? 'Phí mỗi đơn'), source: f.source ?? f.note ?? '', effective: vnDate(f.effective) };
    }
    case 'voucher': {
      const p = prog('voucher_xtra') ?? prog('vxp') ?? {};
      return { label: p.name ?? 'Chương trình voucher', source: 'Học viện Shopee / VCCI', effective: vnDate(p.effective) };
    }
    case 'visibility': {
      const p = prog('visibility') ?? {};
      return { label: 'Phí dịch vụ hiển thị', source: p.evidence ?? '', effective: '' };
    }
    case 'tax':
      return { label: 'Thuế sàn khấu trừ', source: presets.tax_withholding.source, effective: '' };
    default:
      return { label: key, source: '', effective: '' };
  }
}

/** Ghi chú độ tin cậy biểu phí của sàn. */
export function verifiedNote(presets, platform) {
  if (platform === 'tiktok_shop') return 'Phí TikTok Shop chưa đối chiếu đủ đơn thật: sửa từng dòng nếu đơn của bạn khác.';
  if (platform === 'lazada') return 'Lazada chưa có đơn thật để đối chiếu: nhập % hoa hồng và kiểm tra từng dòng phí.';
  return '';
}


/** F18 — chương trình miễn phí cố định cho shop mới (nếu sàn có). */
export function newShopPromoInfo(presets, platform) {
  const p = presets.platforms[platform]?.new_seller_promo;
  if (!p) return null;
  return { maxOrders: p.max_orders, from: vnDate(p.applies_from), source: p.source,
    text: `Shop mới: miễn phí cố định 30 ngày, tối đa ${p.max_orders} đơn (shop đăng sản phẩm đầu tiên từ ${vnDate(p.applies_from)}).` };
}

/** Chương trình có thể bật/tắt của sàn. */
export const programsFor = (presets, platform) => (presets.platforms[platform].programs ?? []).map((p) => ({
  id: p.id, name: p.name, rate: p.rate ?? null, amount: p.amount_per_order ?? null, cap: p.cap_per_item ?? null,
}));
