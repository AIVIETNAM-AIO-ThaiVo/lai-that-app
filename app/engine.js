// Bộ máy tính Lãi Thật (v2) — port 1–1 từ tools/engine.py và flutter/lib/engine/fee_engine.dart.
// Công thức và ký hiệu: 1-wiki/engine/formula.md. Hàm thuần. Làm tròn CHỈ ở bước hiển thị.
//
// Đầu vào (tiền: đồng; tỷ lệ: số thập phân, 0.16 = 16%):
//   { platform, categoryRate, price, cost, sellerVoucher, shipBuyer, pack, programs: [id], vat, pit, registered,
//     affiliateRate, roas, returnRate, lossPerReturn, transactionOverride, fixedOverride, newShopPromo }

const num = (x, d = 0) => (typeof x === 'number' && Number.isFinite(x) ? x : d);

/** Phí cố định mỗi đơn của sàn (tổng các khoản có số tiền xác định). */
export function fixedPerOrder(pf) {
  return (pf.per_order_fixed ?? []).filter((x) => x.amount != null).reduce((s, x) => s + x.amount, 0);
}

/** Các tỷ lệ dùng trong công thức (c, t, v, cap, vis, aff, ads, tax, fixed). */
export function ratesFor(presets, i) {
  const pf = presets.platforms[i.platform];
  if (!pf) throw new Error(`Không có biểu phí cho sàn ${i.platform}`);
  const div = i.registered ? (pf.tax_registered_seller?.fee_divisor ?? 1) : 1;
  const t = num(i.transactionOverride, pf.transaction_fee.rate) / div;
  let fixed = num(i.fixedOverride, fixedPerOrder(pf)) / div;
  let v = 0;
  let vis = 0;
  let cap = null;
  const on = new Set(i.programs ?? []);
  for (const p of pf.programs ?? []) {
    if (!on.has(p.id)) continue;
    if (p.id === 'visibility') vis += p.rate ?? 0;
    else if (p.rate != null) { v += p.rate; cap = p.cap_per_item ?? null; }
    else fixed += p.amount_per_order ?? 0;
  }
  const promo = i.newShopPromo && pf.new_seller_promo ? 0 : 1;
  const c = (num(i.categoryRate) * promo) / div;
  const tax = (i.vat === false ? 0 : 0.01) + (i.pit === false ? 0 : 0.005);
  const ads = i.roas > 0 ? 1 / i.roas : 0;
  const aff = num(i.affiliateRate);
  return { c, t, v, cap, vis, aff, ads, tax, fixed, k: c + t + vis + aff + ads + tax };
}

const pctText = (x) => {
  const p = x * 100;
  return `${Number.isInteger(Math.round(p * 100) / 100) ? Math.round(p) : (Math.round(p * 100) / 100).toString().replace('.', ',')}%`;
};

/** Lãi một đơn. */
export function calculate(presets, i) {
  const q = ratesFor(presets, i);
  const b = num(i.price) - num(i.sellerVoucher);
  const ship = num(i.shipBuyer);
  const vAmt = q.cap != null ? Math.min(q.v * b, q.cap) : q.v * b;
  const lines = [
    { key: 'category', rate: q.c, amount: q.c * b, basis: `${pctText(q.c)} × giá sau mã giảm giá shop` },
    { key: 'transaction', rate: q.t, amount: q.t * (b + ship), basis: `${pctText(q.t)} × (giá sau mã giảm giá shop + ship người mua trả)` },
  ];
  if (vAmt > 0) lines.push({ key: 'voucher', rate: q.v, amount: vAmt, basis: `${pctText(q.v)} × giá sau mã giảm giá shop, tối đa ${formatNumber(q.cap ?? 0)}đ` });
  if (q.vis > 0) lines.push({ key: 'visibility', rate: q.vis, amount: q.vis * b, basis: `${pctText(q.vis)} × giá sau mã giảm giá shop` });
  lines.push({ key: 'per_order', rate: null, amount: q.fixed, basis: 'phí cố định mỗi đơn thành công (+ PiShip / dịch vụ nếu bật)' });
  const platformFees = lines.reduce((s, l) => s + l.amount, 0);
  const tax = q.tax * b;
  const other = (q.aff + q.ads) * b;
  const payout = b - platformFees - tax - other;
  const profitOk = payout - num(i.cost) - num(i.pack);
  const r = num(i.returnRate);
  const profit = (1 - r) * profitOk - r * num(i.lossPerReturn);
  const margin = b === 0 ? 0 : profit / b;
  return {
    base: b, lines, platformFees, tax, taxRate: q.tax, other, payout, profitOk, profit, margin,
    takeRate: b === 0 ? 0 : (platformFees + tax) / b,
    state: stateOf(profit, margin),
  };
}

export const stateOf = (profit, margin) => (profit < 0 ? 'loss' : margin < 0.1 ? 'thin' : 'good');
export const stateLabel = (s) => ({ good: 'Lãi', thin: 'Lãi mỏng', loss: 'Lỗ' })[s];

/**
 * Giá SAU mã giảm giá shop (B) để lãi kỳ vọng = m × B + amount. m = 0, amount = 0 → hòa vốn. Không thể → Infinity.
 */
export function priceForMargin(presets, i, m, amount = 0) {
  const q = ratesFor(presets, i);
  const r = num(i.returnRate);
  const R = num(i.lossPerReturn);
  const x = q.fixed + q.t * num(i.shipBuyer) + num(i.cost) + num(i.pack);
  let den = (1 - r) * (1 - q.k - q.v) - m;
  if (den <= 0) return Infinity;
  let b = ((1 - r) * x + r * R + amount) / den;
  if (q.cap != null && q.v * b > q.cap) {
    den = (1 - r) * (1 - q.k) - m;
    b = den > 0 ? ((1 - r) * (x + q.cap) + r * R + amount) / den : Infinity;
  }
  return b;
}

/** Giá nhập tối đa để vẫn giữ % lãi m ở giá bán hiện tại. */
export function maxCost(presets, i, m) {
  const res = calculate(presets, { ...i, cost: 0 });
  const r = num(i.returnRate);
  return ((1 - r) * (res.payout - num(i.pack)) - r * num(i.lossPerReturn) - m * res.base) / (1 - r);
}

/** Lãi khi chạy Flash Sale giảm d (0.2 = 20%) trên giá sau mã giảm giá hiện tại. */
export function flashSale(presets, i, d) {
  const b = num(i.price) - num(i.sellerVoucher);
  return calculate(presets, { ...i, sellerVoucher: num(i.sellerVoucher) + b * d });
}

/** ROAS hòa vốn và tiền quảng cáo tối đa mỗi đơn (chưa tính quảng cáo đang chạy). */
export function roasBreakeven(presets, i) {
  const r = num(i.returnRate);
  const b = calculate(presets, { ...i, roas: null, returnRate: 0, lossPerReturn: 0 });
  const room = b.profit - (r < 1 ? (r * num(i.lossPerReturn)) / (1 - r) : 0);
  return { roas: room > 0 ? b.base / room : Infinity, maxAds: room };
}

/** Làm tròn lên giá đẹp: dưới 100.000đ → x.900đ; từ 100.000đ → x9.000đ. */
export function nicePrice(p) {
  if (!Number.isFinite(p)) return p;
  if (p < 100000) return Math.ceil((p + 100) / 1000) * 1000 - 100;
  return Math.ceil((p + 1000) / 10000) * 10000 - 1000;
}

// ---------------------------------------------------------------- hiển thị
/**
 * Làm tròn hiển thị đến đồng, nửa về số chẵn — khớp round() của tools/engine.py, nơi sinh các con số thiết kế
 * (5.018đ ở giá 22.900đ, giá nhập tối đa 8.438đ). Sai số số thực < 1e-6 coi như đúng ,5.
 */
export function roundVnd(v) {
  const f = Math.floor(v);
  if (Math.abs(v - f - 0.5) < 1e-6) return f % 2 === 0 ? f : f + 1;
  return Math.round(v);
}

export function formatNumber(v) {
  const n = roundVnd(v);
  return Math.abs(n).toString().replace(/\B(?=(\d{3})+(?!\d))/g, '.');
}
/** 17000 → "17.000đ"; -1380 → "−1.380đ" */
export const formatVnd = (v) => `${roundVnd(v) < 0 ? '−' : ''}${formatNumber(v)}đ`;
/** 0.0297 → "3,0%"; -0.115 → "−11,5%" */
export function formatPct(x, digits = 1) {
  const v = Math.round(x * 100 * 10 ** digits) / 10 ** digits;
  return `${x < 0 ? '−' : ''}${Math.abs(v).toFixed(digits).replace('.', ',')}%`;
}
/** Tỷ lệ phí: 0.16 → "16%", 0.165 → "16,5%", 0.0108 → "1,08%" */
export const formatRate = (x) => pctText(x);
/** Ô nhập tiền: chỉ giữ chữ số, chèn dấu chấm nghìn. */
export function formatMoneyInput(s) {
  const d = String(s ?? '').replace(/\D/g, '').replace(/^0+(?=\d)/, '');
  return d.replace(/\B(?=(\d{3})+(?!\d))/g, '.');
}
export function parseMoney(s) {
  const d = String(s ?? '').replace(/\D/g, '');
  return d ? Number(d) : 0;
}
/** "16,5" / "16.5" → 0.165 ; rỗng → null */
export function parseRate(s) {
  const t = String(s ?? '').trim().replace(',', '.').replace('%', '');
  if (t === '' || Number.isNaN(Number(t))) return null;
  return Number(t) / 100;
}
