// Add-on 13/11/2026: Combo (F28) và Kiểm tra đơn (F29, F30). Hàm thuần, port 1–1 từ tools/addons.py.
// Spec: raw/addon/docs/ADDONS.md · Wiki: 1-wiki/features/F28-combo.md, F29-kiem-tra-don.md. Làm tròn CHỈ khi hiển thị.
import { nicePrice, formatVnd, formatPct, stateOf, stateLabel, fixedPerOrder, roundVnd } from './engine.js';

// ================================================================ Combo

export const MODES = [
  { id: 'promo', label: 'Khuyến mãi combo' },
  { id: 'addon', label: 'Mua kèm' },
  { id: 'bundle', label: 'Sản phẩm bộ' },
];
export const DISCOUNTS = [
  { id: 'percent', label: 'Giảm %' },
  { id: 'amount', label: 'Giảm tiền' },
  { id: 'fixed', label: 'Giá combo' },
];

/** Ví dụ mẫu C0: 3 móc khóa giảm 10%, đóng gói 1.500đ. */
export const SAMPLE_COMBO = Object.freeze({
  name: '3 móc khóa', mode: 'promo', platform: 'shopee', pack: 1500, ship: 0, programs: [],
  discount: ['percent', 0.1],
  items: [{ name: 'Móc khóa mini', cost: 8000, price: 17000, cat: 0.16, qty: 3 }],
});

const qtyOf = (items) => items.reduce((s, i) => s + i.qty, 0);
const grossOf = (items) => items.reduce((s, i) => s + i.price * i.qty, 0);

/**
 * Lãi một combo. items: [{cost, price (giá lẻ), cat, qty}]; discount: ['percent', d] | ['amount', D] | ['fixed', B] | null.
 * opts: { platform, ship, pack, programs, vat, pit, aff, roas, registered, r, R }. Ném lỗi nếu giá combo ≤ 0.
 */
export function combo(presets, items, discount = null, opts = {}) {
  const { platform = 'shopee', ship = 0, pack = 0, programs = [], vat = true, pit = true, aff = 0, roas = null, registered = false, r = 0, R = 0 } = opts;
  const pf = presets.platforms[platform];
  const div = registered ? (pf.tax_registered_seller?.fee_divisor ?? 1) : 1;
  const t = pf.transaction_fee.rate / div;
  const progs = (pf.programs ?? []).filter((p) => programs.includes(p.id));
  const vx = progs.find((p) => p.rate != null && p.id !== 'visibility');
  const vis = progs.filter((p) => p.id === 'visibility').reduce((s, p) => s + p.rate, 0);
  const perOrder = fixedPerOrder(pf) / div + progs.reduce((s, p) => s + (p.amount_per_order ?? 0), 0);
  const gross = grossOf(items);
  let B;
  if (!discount) B = gross;
  else if (discount[0] === 'percent') B = gross * (1 - discount[1]);
  else if (discount[0] === 'amount') B = gross - discount[1];
  else B = discount[1];
  if (!(B > 0) || !(gross > 0)) throw new Error('Giá combo phải lớn hơn 0');
  const share = B / gross;
  let catFee = 0;
  let vxFee = 0;
  for (const i of items) {
    const b = i.price * share;
    catFee += (i.cat / div) * b * i.qty;
    if (vx) {
      let v = vx.rate * b;
      if (vx.cap_per_item) v = Math.min(v, vx.cap_per_item);
      vxFee += v * i.qty;
    }
  }
  const tx = t * (B + ship);
  const tax = ((vat ? 0.01 : 0) + (pit ? 0.005 : 0)) * B;
  const visFee = vis * B;
  const other = (aff + (roas ? 1 / roas : 0)) * B;
  const fees = catFee + tx + vxFee + visFee + perOrder;
  const cost = items.reduce((s, i) => s + i.cost * i.qty, 0);
  const ok = B - fees - tax - other - cost - pack;
  const profit = (1 - r) * ok - r * R;
  return { gross, price: B, discount: gross - B, cat_fee: catFee, tx, vx: vxFee, vis: visFee, per_order: perOrder, tax, other, cost, pack,
    profit, margin: profit / B, take: (fees + tax) / B };
}

/** Bán lẻ: mỗi đơn vị là một đơn riêng (mỗi đơn chịu phí mỗi đơn và đóng gói, không có ship người mua trả). */
export function separate(presets, items, opts = {}) {
  const o = { ...opts, ship: 0 };
  return items.reduce((s, i) => s + combo(presets, [{ ...i, qty: 1 }], null, o).profit * i.qty, 0);
}

/** Tỷ lệ sàn + thuế khi bán lẻ (gộp tất cả đơn lẻ). */
export function separateTake(presets, items, opts = {}) {
  const o = { ...opts, ship: 0 };
  let take = 0;
  let rev = 0;
  for (const i of items) {
    const c = combo(presets, [{ ...i, qty: 1 }], null, o);
    take += c.take * c.price * i.qty;
    rev += c.price * i.qty;
  }
  return rev > 0 ? take / rev : 0;
}

/** Mức giảm % lớn nhất để lãi combo ≥ m × giá combo (tìm nhị phân trên [0; 95%]). null nếu không giảm cũng không đạt. */
export function comboMaxDiscount(presets, items, m, opts = {}) {
  if (combo(presets, items, ['percent', 0], opts).margin < m) return null;
  let lo = 0;
  let hi = 0.95;
  for (let k = 0; k < 60; k += 1) {
    const mid = (lo + hi) / 2;
    if (combo(presets, items, ['percent', mid], opts).margin >= m) lo = mid; else hi = mid;
  }
  return lo;
}

/** Giá combo thấp nhất để đạt lãi m; { price, nice } (giá đẹp làm tròn lên). */
export function comboPriceForMargin(presets, items, m, opts = {}) {
  let lo = 0;
  let hi = grossOf(items) * 3;
  for (let k = 0; k < 80; k += 1) {
    const mid = (lo + hi) / 2;
    if (mid > 0 && combo(presets, items, ['fixed', mid], opts).margin >= m) hi = mid; else lo = mid;
  }
  return { price: hi, nice: nicePrice(hi) };
}

/** Chế độ Sản phẩm bộ: một món giá B, vốn ΣCq, ngành chọn, trần voucher một lần. */
export const bundleItems = (items, cat) => [{ name: 'Bộ', cost: items.reduce((s, i) => s + i.cost * i.qty, 0), price: grossOf(items), cat, qty: 1 }];

/** Mức tối thiểu của Combo Khuyến Mãi Shopee: giảm 5% hoặc 10.000đ, từ 2 sản phẩm. Trả câu cảnh báo hoặc ''. */
export function shopeeMinNote(platform, items, discount) {
  if (platform !== 'shopee' || !discount) return '';
  const gross = grossOf(items);
  const off = discount[0] === 'percent' ? gross * discount[1] : discount[0] === 'amount' ? discount[1] : gross - discount[1];
  const parts = [];
  if (qtyOf(items) < 2) parts.push('cần từ 2 sản phẩm');
  if (off < Math.min(gross * 0.05, 10000) - 0.5) parts.push('giảm tối thiểu 5% hoặc 10.000đ');
  return parts.length ? `Shopee: ${parts.join(', ')}` : '';
}

const floorPct = (d) => `${Math.floor(d * 100 + 1e-9)}%`;
const signed = (v) => `${v >= 0 ? '+' : '−'}${formatVnd(Math.abs(v))}`;

/** Đầu vào engine của một combo đã dựng/lưu. c: { mode, platform, items, discount, pack, ship, programs, bundleCat, vat, pit } */
export function comboArgs(c) {
  const opts = { platform: c.platform ?? 'shopee', pack: c.pack ?? 0, ship: c.ship ?? 0, programs: c.programs ?? [], vat: c.vat ?? true, pit: c.pit ?? true };
  if (c.mode === 'bundle') {
    const cat = c.bundleCat ?? c.items[0]?.cat ?? 0;
    return { items: bundleItems(c.items, cat), discount: c.discount, opts };
  }
  if (c.mode === 'addon') return { items: c.items, discount: null, opts };
  return { items: c.items, discount: c.discount, opts };
}

/**
 * Mô hình hiển thị cho màn Dựng combo + Chi tiết (C4–C6).
 * Trả { ok, error } hoặc { ok:true, r, priceText, grossText, profitText, state, stateText, compareText, upliftText, takeText, lines, maxDisc, suggest, minNote }.
 */
export function comboView(presets, c) {
  if (!c.items.length || grossOf(c.items) <= 0) return { ok: false, error: 'Thêm món và giá lẻ để tính combo' };
  const { items, discount, opts } = comboArgs(c);
  let r;
  try { r = combo(presets, items, discount, opts); } catch (e) { return { ok: false, error: e.message }; }
  const st = stateOf(r.profit, r.margin);
  const n = qtyOf(c.items);
  const sep = separate(presets, c.items, opts);
  const sepTake = separateTake(presets, c.items, opts);
  let compareText;
  let upliftText;
  let uplift;
  if (c.mode === 'addon' && c.items.length > 1) {
    const main = combo(presets, [c.items[0]], null, opts).profit;
    uplift = roundVnd(r.profit) - roundVnd(main); // hiệu của hai số đang hiện
    compareText = `Món chính một mình: ${formatVnd(main)}`;
    upliftText = `Thêm món mua kèm ${signed(uplift)}`;
  } else {
    uplift = roundVnd(r.profit) - roundVnd(sep);
    compareText = `Bán lẻ ${n} đơn: ${formatVnd(sep)}`;
    upliftText = `Combo ${signed(uplift)}`;
  }
  const lineList = [
    { key: 'cat', label: 'Phí cố định (ngành)', amount: r.cat_fee, per: 'mỗi SP' },
    { key: 'tx', label: 'Phí xử lý giao dịch', amount: r.tx, per: 'mỗi đơn' },
    { key: 'vx', label: 'Voucher Xtra', amount: r.vx, per: c.mode === 'bundle' ? 'cả bộ' : 'mỗi SP', hide: !r.vx },
    { key: 'vis', label: 'Phí hiển thị', amount: r.vis, per: 'mỗi đơn', hide: !r.vis },
    { key: 'per_order', label: 'Phí mỗi đơn (hạ tầng, PiShip)', amount: r.per_order, per: 'mỗi đơn' },
    { key: 'tax', label: 'Thuế (GTGT + TNCN)', amount: r.tax, per: 'mỗi đơn' },
    { key: 'cost', label: 'Giá vốn', amount: r.cost, per: 'mỗi SP' },
    { key: 'pack', label: 'Đóng gói', amount: r.pack, per: 'mỗi đơn', hide: !r.pack },
  ].filter((l) => !l.hide).map((l) => ({ ...l, text: `−${formatVnd(l.amount)}` }));
  const engineItems = items;
  const maxOf = (m) => (c.mode === 'addon' ? null : comboMaxDiscount(presets, engineItems, m, opts));
  const md = { m20: maxOf(0.2), m10: maxOf(0.1), m0: maxOf(0) };
  const mdText = (d) => (d == null ? 'không đạt' : floorPct(d));
  const sug = comboPriceForMargin(presets, engineItems, 0.2, opts);
  const minNote = c.mode === 'promo' ? shopeeMinNote(opts.platform, c.items, discount) : '';
  let atMin = '';
  if (c.mode === 'promo' && opts.platform === 'shopee' && md.m20 != null && md.m20 < 0.05) {
    const at5 = combo(presets, engineItems, ['percent', 0.05], opts);
    atMin = `Giảm 5% (mức thấp nhất Shopee cho phép) thì lãi còn ${formatPct(at5.margin)}`;
  }
  return {
    ok: true, r, n, sep, uplift,
    priceText: formatVnd(r.price), grossText: formatVnd(r.gross), discountText: r.discount > 0.5 ? `−${formatVnd(r.discount)}` : '',
    profitText: formatVnd(r.profit), marginText: formatPct(r.margin), state: st, stateText: stateLabel(st),
    compareText, upliftText, upliftState: uplift >= 0 ? 'good' : 'loss',
    takeText: `Sàn + thuế lấy ${Math.round(r.take * 100)}% thay vì ${Math.round(sepTake * 100)}% khi bán lẻ`,
    lines: lineList,
    maxDisc: md,
    maxDiscText: { m20: mdText(md.m20), m10: mdText(md.m10), m0: mdText(md.m0) },
    suggest: sug, suggestText: formatVnd(sug.nice),
    minNote, atMin,
  };
}

/** Món của combo đã lưu, cập nhật theo sản phẩm trong danh mục (liên kết theo id). Món gốc đã xoá → giữ bản sao, gắn `orphan`. */
export function resolveItems(comboRec, products) {
  return comboRec.items.map((i) => {
    if (!i.productId) return i;
    const p = products.find((x) => x.id === i.productId);
    if (!p) return { ...i, orphan: true };
    return { ...i, name: p.name, cost: p.input.cost ?? i.cost, cat: p.input.categoryRate ?? i.cat, price: comboRec.mode === 'addon' && i.dealPrice != null ? i.dealPrice : (p.input.price ?? i.price) };
  });
}

/** Danh mục: dòng combo đã lưu (nhãn "Bộ · N món"), lãi thấp nhất lên đầu. */
export function combosCatalog(presets, combos = [], products = []) {
  return combos.map((c) => {
    const items = resolveItems(c, products);
    const v = comboView(presets, { ...c, items });
    const n = qtyOf(items);
    return {
      id: c.id, name: c.name, combo: true, n, orphan: items.some((i) => i.orphan), ok: v.ok,
      profit: v.ok ? v.r.profit : 0, margin: v.ok ? v.r.margin : -Infinity, state: v.ok ? v.state : 'loss',
      profitText: v.ok ? v.profitText : '—', stateText: v.ok ? `${v.stateText} · ${v.marginText}` : v.error,
      meta: `Bộ · ${n} món · ${v.ok ? `giá ${v.priceText}` : ''}`, view: v,
    };
  }).sort((a, b) => a.margin - b.margin);
}

/** Combo chuyển từ lãi sang lỗ khi đổi biểu phí. */
export function diffCombos(combos = [], products = [], oldPresets, newPresets) {
  const out = [];
  for (const c of combos) {
    const items = resolveItems(c, products);
    const a = comboView(oldPresets, { ...c, items });
    const b = comboView(newPresets, { ...c, items });
    if (a.ok && b.ok && a.r.profit >= 0 && b.r.profit < 0) out.push({ id: c.id, name: c.name, combo: true, before: a.r.profit, after: b.r.profit, suggested: b.suggest.nice });
  }
  return out;
}

/** combo_built: tham số theo tracking plan (không giá, không tên). */
export function comboEventParams(c, v) {
  const m = v.ok ? v.r.margin * 100 : -1;
  const bucket = m < 0 ? '<0' : m < 5 ? '0–5' : m < 10 ? '5–10' : m <= 20 ? '10–20' : '>20';
  return { platform: c.platform ?? 'shopee', mode: c.mode, items_count: qtyOf(c.items), discount_type: c.mode === 'addon' ? 'none' : c.discount?.[0] ?? 'none', margin_bucket: bucket };
}
export function upliftBucket(sep, comboProfit) {
  const d = comboProfit - sep;
  if (d < 0) return '<0';
  if (sep <= 0) return '>100%';
  const p = (d / Math.abs(sep)) * 100;
  return p < 25 ? '0–25%' : p < 100 ? '25–100%' : '>100%';
}

// ================================================================ Kiểm tra đơn

/** Chưa Pro: xem chi tiết 3 đơn đầu của file (K4). */
export const FREE_FILE_DETAILS = 3;

export const STATUS_LABEL = { khop: 'Khớp', lech_nho: 'Lệch nhỏ', lech: 'Lệch', dieu_chinh: 'Có điều chỉnh' };
const RANK = { khop: 0, lech_nho: 1, lech: 2 };

/** Khớp: |lệch| ≤ 1đ × số sản phẩm + 1đ. Lệch nhỏ: ≤ 100đ và ≤ 1% khoản đó. Còn lại: Lệch. */
export function statusOf(diff, expect, real, items = 1) {
  const a = Math.abs(diff);
  if (a <= items + 1) return 'khop';
  if (a <= 100 && a <= 0.01 * Math.max(Math.abs(expect), Math.abs(real))) return 'lech_nho';
  return 'lech';
}

export function categoriesForRate(presets, rate, platform = 'shopee', tol = 0.0005) {
  return (presets.platforms[platform].categories ?? []).filter((c) => c.min - tol <= rate && rate <= c.max + tol).map((c) => c.name);
}

const pct2 = (x) => `${(x * 100).toFixed(2).replace('.', ',')}%`;
const pct1 = (x) => `${(x * 100).toFixed(1).replace('.', ',')}%`;
const pyRound = (v) => { const f = Math.floor(v); const n = Math.abs(v - f - 0.5) < 1e-9 ? (f % 2 === 0 ? f : f + 1) : Math.round(v); return n + 0; };

/**
 * Kiểm tra một đơn Shopee (K1–K2). o: số tiền đọc từ Doanh thu đơn hàng / dòng Đơn hàng của Báo Cáo Doanh Thu.
 * keys: price, seller_voucher, refund, ship_buyer, fixed_fee, service_fee, transaction_fee, piship, visibility, affiliate, vat, pit,
 *       adjustment, compensation, ship_discrepancy.  opts: { vat, pit, items, newShop, lumped (file không tách phí dịch vụ) }
 */
export function checkOrder(presets, o, catRate, programs = [], opts = {}) {
  const { vat = true, pit = true, items = 1, newShop = false, lumped = false } = opts;
  const g = (k) => Number(o[k] ?? 0) || 0;
  const B = g('price') - g('seller_voucher') - g('refund');
  const S = g('ship_buyer');
  const lines = [];
  const add = (key, label, real, expect, diagFn) => {
    const d = real - expect;
    let st = statusOf(d, expect, real, items);
    let reason = '';
    let diag = '';
    if (st !== 'khop') {
      [reason, diag] = diagFn ? diagFn(real) : ['unknown', ''];
      if (st === 'lech_nho') { reason = 'rounding'; diag = 'Lệch nhỏ, có thể do làm tròn hoặc mã giảm giá được chia lẻ'; }
    }
    lines.push({ key, label, real, app: pyRound(expect), diff: pyRound(d), status: st, reason, diag });
  };
  const fixedDiag = (real) => {
    if (real === 0) return ['new_shop_waiver', newShop ? 'Ưu đãi miễn phí cố định cho shop mới (30 ngày)' : 'Sàn không thu phí cố định: kiểm tra ưu đãi shop mới hoặc chương trình riêng'];
    const r = real / B;
    const names = categoriesForRate(presets, r);
    return ['category_rate', `Sàn đang tính ${pct2(r)} thay vì ${pct2(catRate)}${names.length ? ` (ngành có mức này: ${names.slice(0, 3).join(', ')})` : ''}`];
  };
  add('fixed_fee', 'Phí cố định', g('fixed_fee'), newShop ? 0 : catRate * B, fixedDiag);
  add('transaction_fee', 'Phí xử lý giao dịch', g('transaction_fee'), 0.06 * (B + S),
    (real) => ['transaction_base', `Tương đương ${pct2(real / (B + S))} trên (giá + ship người mua trả ${formatVnd(S)}); kiểm tra ship hoặc chương trình thanh toán`]);
  const vxOn = programs.includes('voucher_xtra');
  const piOn = programs.includes('piship');
  const visOn = programs.includes('visibility');
  const vxExp = vxOn ? Math.min(0.055 * B, 50000) : 0;
  const lumpExtra = lumped ? (piOn ? 2700 : 0) + (visOn ? 0.0108 * B : 0) : 0;
  const svcDiag = (real) => {
    const extra = real - 3000 - lumpExtra;
    if (!vxOn && extra > 0.04 * B) {
      if (Math.abs(extra - 50000) <= 2) return ['voucher_program', 'Có phí Voucher Xtra, đã chạm trần 50.000đ, dù bạn ghi là không tham gia'];
      return ['voucher_program', `Có phí gói chương trình ≈ ${pct1(extra / B)} (Voucher Xtra 5,5%) dù bạn ghi là không tham gia`];
    }
    if (vxOn && extra < 1000) return ['voucher_program', 'Không thấy phí Voucher Xtra dù bạn ghi là có tham gia'];
    return ['unknown', 'Phí dịch vụ khác dự kiến: xem trang Service Fee Details trong Báo Cáo Doanh Thu'];
  };
  add('service_fee', 'Phí dịch vụ (hạ tầng + gói chương trình)', g('service_fee'), 3000 + vxExp + lumpExtra, svcDiag);
  if (!lumped) {
    add('piship', 'PiShip', g('piship'), piOn ? 2700 : 0,
      (real) => ['piship', real ? 'Đơn bị trừ PiShip 2.700đ: bật PiShip cho sản phẩm' : 'Không thấy PiShip dù bạn ghi là có']);
    add('visibility', 'Phí dịch vụ hiển thị', g('visibility'), visOn ? 0.0108 * B : 0,
      (real) => ['visibility', real ? `Phí hiển thị ≈ ${pct2(real / B)} doanh thu đơn: bật phí hiển thị` : 'Không thấy phí hiển thị dù bạn ghi là có']);
  }
  add('vat', 'Thuế GTGT', g('vat'), vat ? 0.01 * B : 0,
    (real) => ['vat_not_withheld', real === 0 ? 'Sàn không khấu trừ GTGT cho đơn này: tắt công tắc GTGT' : `Sàn khấu trừ GTGT ${pct2(real / B)}: bật công tắc GTGT`]);
  add('pit', 'Thuế TNCN', g('pit'), pit ? 0.005 * B : 0, (real) => ['vat_not_withheld', `Thuế TNCN ${pct2(real / B)} doanh thu`]);
  const adjusted = Object.fromEntries(['refund', 'adjustment', 'compensation', 'ship_discrepancy'].filter((k) => g(k)).map((k) => [k, g(k)]));
  const worst = lines.reduce((w, x) => (RANK[x.status] > RANK[w] ? x.status : w), 'khop');
  const status = Object.keys(adjusted).length && worst !== 'lech' ? 'dieu_chinh' : worst;
  const mism = lines.filter((x) => x.status === 'lech');
  return {
    base: B, ship: S, lines, status, mismatches: mism.length, top_reason: mism[0]?.reason ?? '', adjusted,
    total_diff: pyRound(lines.filter((x) => x.status !== 'khop').reduce((s, x) => s + x.diff, 0)),
    affiliate: g('affiliate'),
  };
}

/** Nút sửa tại dòng lệch (K3): { kind, label, patch } — chỉ áp khi người dùng bấm. */
export function fixAction(line, r, product) {
  if (line.status !== 'lech') return null;
  const inp = product?.input ?? {};
  const progs = inp.programs ?? [];
  if (line.reason === 'category_rate' && r.base > 0) {
    const rate = Math.round((line.real / r.base) * 10000) / 10000;
    return { kind: 'category', label: `Cập nhật ngành ${pctShort(rate)}`, patch: { categoryRate: rate, categoryCustom: true } };
  }
  if (line.reason === 'voucher_program') {
    const on = !progs.includes('voucher_xtra');
    return { kind: 'voucher_xtra', label: on ? 'Bật Voucher Xtra' : 'Tắt Voucher Xtra', patch: { programs: on ? [...progs, 'voucher_xtra'] : progs.filter((p) => p !== 'voucher_xtra') } };
  }
  if (line.reason === 'visibility') {
    const on = line.real > 0;
    return { kind: 'visibility', label: on ? 'Bật phí hiển thị' : 'Tắt phí hiển thị', patch: { programs: on ? [...new Set([...progs, 'visibility'])] : progs.filter((p) => p !== 'visibility') } };
  }
  if (line.reason === 'piship') {
    const on = line.real > 0;
    return { kind: 'piship', label: on ? 'Bật PiShip' : 'Tắt PiShip', patch: { programs: on ? [...new Set([...progs, 'piship'])] : progs.filter((p) => p !== 'piship') } };
  }
  if (line.reason === 'vat_not_withheld' && line.key === 'vat') {
    const on = line.real > 0;
    return { kind: 'vat', label: on ? 'Bật GTGT' : 'Tắt GTGT', patch: { vat: on } };
  }
  return null;
}
function pctShort(x) {
  const v = Math.round(x * 1000) / 10;
  return `${String(v).replace('.', ',')}%`;
}

/** Câu trên dải trạng thái kết quả 1 đơn. */
export function statusHeadline(r) {
  if (r.status === 'lech') return `Lệch ${r.mismatches} khoản · sàn trừ ${r.total_diff >= 0 ? 'nhiều' : 'ít'} hơn ${formatVnd(Math.abs(r.total_diff))}`;
  if (r.status === 'lech_nho') return `Lệch nhỏ · ${formatVnd(Math.abs(r.total_diff))}, có thể do làm tròn`;
  if (r.status === 'dieu_chinh') return 'Có điều chỉnh · đơn có hoàn tiền / điều chỉnh, phí tính trên giá sau hoàn';
  return 'Khớp · sàn trừ đúng biểu phí';
}

/** Mẫu khiếu nại (người bán tự gửi qua Kênh Người Bán). Giọng trung tính. */
export function complaintTemplate(orderRef, line, feeDate) {
  return `Kính gửi Shopee,\nĐơn hàng ${orderRef || '(mã đơn)'}: khoản "${line.label}" đã trừ ${formatVnd(line.real)}. `
    + `Theo biểu phí áp dụng từ ${feeDate}, khoản này dự kiến ${formatVnd(line.app)} `
    + `(chênh lệch ${formatVnd(line.diff)}). Nhờ Shopee kiểm tra giúp ngành hàng/chương trình áp cho sản phẩm `
    + 'và hoàn phần chênh lệch nếu có sai sót. Cảm ơn.';
}

/** Tiền thật về của đơn (theo số sàn trừ) và lãi thật theo giá vốn đã lưu. */
export function realProfit(o, cost = 0, pack = 0) {
  const g = (k) => Number(o[k] ?? 0) || 0;
  const deducted = ['fixed_fee', 'service_fee', 'transaction_fee', 'piship', 'visibility', 'affiliate', 'vat', 'pit'].reduce((s, k) => s + g(k), 0);
  // Ship người mua trả đi thẳng cho đơn vị vận chuyển: không vào tiền về (đúng màn Doanh thu đơn hàng).
  const payout = g('price') - g('seller_voucher') - g('refund') - deducted + g('compensation') + g('adjustment');
  return { deducted, payout, profit: payout - cost - pack };
}

/** Thông số kiểm tra từ sản phẩm đã lưu. */
export function productCheckArgs(product) {
  const i = product?.input ?? {};
  return { catRate: i.categoryRate ?? 0, programs: i.programs ?? [], vat: i.vat ?? true, pit: i.pit ?? true, newShop: !!i.newShopPromo };
}

/** K5 — tóm tắt nhiều đơn. results: [{ id, r, order }] */
export function checkSummary(results) {
  const count = { khop: 0, lech_nho: 0, lech: 0, dieu_chinh: 0 };
  const reasons = {};
  let diff = 0;
  let revenue = 0;
  const feeTot = { fixed_fee: 0, service_fee: 0, transaction_fee: 0, piship: 0, visibility: 0, affiliate: 0, vat: 0, pit: 0 };
  for (const { r, order } of results.filter((x) => x.r)) {
    count[r.status] += 1;
    if (r.status !== 'khop') diff += r.total_diff;
    for (const l of r.lines) if (l.status === 'lech') reasons[l.reason] = (reasons[l.reason] ?? 0) + 1;
    revenue += r.base;
    for (const k of Object.keys(feeTot)) feeTot[k] += Number(order[k] ?? 0) || 0;
  }
  const top = Object.entries(reasons).sort((a, b) => b[1] - a[1])[0];
  const share = Object.entries(feeTot).filter(([, v]) => v > 0).map(([k, v]) => ({ key: k, label: FEE_LABEL[k], amount: v, pct: revenue > 0 ? v / revenue : 0 }))
    .sort((a, b) => b.amount - a.amount);
  return { count, total: results.filter((x) => x.r).length, topReason: top?.[0] ?? '', topCount: top?.[1] ?? 0, totalDiff: diff, revenue, share };
}
export const FEE_LABEL = {
  fixed_fee: 'Phí cố định', service_fee: 'Phí dịch vụ', transaction_fee: 'Phí xử lý giao dịch', piship: 'PiShip', visibility: 'Phí hiển thị',
  affiliate: 'Hoa hồng tiếp thị liên kết', vat: 'Thuế GTGT', pit: 'Thuế TNCN',
};
export const REASON_LABEL = {
  category_rate: 'ngành hàng tính khác', voucher_program: 'Voucher Xtra / gói chương trình', visibility: 'phí hiển thị', piship: 'PiShip',
  vat_not_withheld: 'thuế GTGT', transaction_base: 'phí giao dịch', new_shop_waiver: 'ưu đãi shop mới', rounding: 'làm tròn', unknown: 'khác',
};
export function diffBucket(d) {
  const a = Math.abs(d);
  return a < 1000 ? '<1k' : a < 5000 ? '1–5k' : a < 20000 ? '5–20k' : '>20k';
}

/** Các ô của form nhập tay, đúng thứ tự màn Doanh thu đơn hàng của Shopee. */
export const ORDER_FIELDS = {
  buyer: [
    { key: 'price', label: 'Giá sản phẩm' }, { key: 'seller_voucher', label: 'Mã giảm giá của shop' },
    { key: 'ship_buyer', label: 'Phí vận chuyển người mua trả' }, { key: 'refund', label: 'Số tiền hoàn lại' },
  ],
  platform: [
    { key: 'fixed_fee', label: 'Phí cố định' }, { key: 'service_fee', label: 'Phí dịch vụ' }, { key: 'transaction_fee', label: 'Phí xử lý giao dịch' },
    { key: 'piship', label: 'PiShip' }, { key: 'visibility', label: 'Phí dịch vụ hiển thị' }, { key: 'vat', label: 'Thuế GTGT' },
    { key: 'pit', label: 'Thuế TNCN' }, { key: 'affiliate', label: 'Hoa hồng tiếp thị liên kết' },
  ],
};
