// Dữ liệu hiển thị cho từng màn (hàm thuần, dựa trên engine.js). ui.js chỉ vẽ.
import {
  calculate, priceForMargin, nicePrice, formatVnd, formatPct, formatRate, formatNumber, stateLabel, flashSale, maxCost, roasBreakeven,
} from './engine.js';
import { feeInfo, verifiedNote, SHORT_NAME, PLATFORMS, categoriesFor } from './presets.js';

export const MARGIN_CHIPS = [
  { m: 0.1, label: '10%' }, { m: 0.15, label: '15%' }, { m: 0.2, label: '20%', recommended: true }, { m: 0.25, label: '25%' }, { m: 0.3, label: '30%' },
];

/** Mã giảm giá shop: đồng, hoặc % giá niêm yết. */
export const sellerVoucherAmount = (price, value, unit) => (unit === 'pct' ? (price * value) / 100 : value);

/** Giá niêm yết từ giá sau mã giảm giá B. */
export function listPrice(b, input) {
  if (!Number.isFinite(b)) return b;
  if (input.voucherUnit === 'pct' && input.voucherValue > 0) return b / (1 - input.voucherValue / 100);
  return b + (input.sellerVoucher ?? 0);
}

/** Đầu vào engine ở một giá niêm yết khác (giữ cách tính mã giảm giá). */
export function atPrice(input, price) {
  const sellerVoucher = input.voucherUnit === 'pct' ? (price * (input.voucherValue ?? 0)) / 100 : (input.sellerVoucher ?? 0);
  return { ...input, price, sellerVoucher };
}

/** Thẻ kết quả (S2). */
export function calcView(presets, input) {
  const r = calculate(presets, input);
  const be = listPrice(priceForMargin(presets, input, 0), input);
  return {
    result: r,
    state: r.state,
    profitText: formatVnd(r.profit),
    stateText: stateLabel(r.state),
    marginText: formatPct(r.margin),
    breakeven: be,
    breakevenText: Number.isFinite(be) ? formatVnd(Math.ceil(be)) : 'không có',
  };
}

/** Dải "tiền đi đâu": sàn + thuế / vốn + gói / lãi, % trên giá sau mã giảm giá. */
export function moneyBar(r, input) {
  if (!(r.base > 0)) return [];
  const fees = r.platformFees + r.tax + r.other;
  const cost = (input.cost ?? 0) + (input.pack ?? 0);
  const profit = Math.max(0, r.base - fees - cost);
  const total = Math.max(r.base, fees + cost);
  return [
    { key: 'fees', label: 'Sàn + thuế', amount: fees, pct: (fees / total) * 100 },
    { key: 'cost', label: 'Vốn + gói', amount: cost, pct: (cost / total) * 100 },
    { key: 'profit', label: 'Lãi', amount: profit, pct: (profit / total) * 100 },
  ];
}

/** Tính ngược (S4): theo % lãi m hoặc theo số tiền lãi amount. */
export function marginView(presets, input, { m = 0, amount = 0 } = {}) {
  const b = priceForMargin(presets, input, amount ? 0 : m, amount || 0);
  const exactPrice = listPrice(b, input);
  const breakeven = listPrice(priceForMargin(presets, input, 0), input);
  if (!Number.isFinite(exactPrice) || exactPrice <= 0) {
    return { impossible: true, niceText: 'Không thể đạt mức lãi này', niceProfitText: 'Phí + giá vốn đã vượt mức này; giảm % lãi hoặc giá vốn.', breakevenText: Number.isFinite(breakeven) ? formatVnd(Math.ceil(breakeven)) : 'không có', exactPrice: Infinity };
  }
  const nice = nicePrice(exactPrice);
  const r = calculate(presets, atPrice(input, nice));
  return {
    impossible: false,
    exactPrice,
    nicePrice: nice,
    niceText: formatVnd(nice),
    niceProfit: r.profit,
    niceProfitText: `Lãi ${formatVnd(r.profit)} · ${formatPct(r.margin)} (tối thiểu ${formatVnd(Math.ceil(exactPrice))}, đã làm tròn)`,
    niceState: r.state,
    breakeven,
    breakevenText: formatVnd(Math.ceil(breakeven)),
  };
}

const LINE_LABEL = { voucher: 'Chương trình voucher', visibility: 'Phí dịch vụ hiển thị' };

/** Chi tiết phí (S3). */
export function breakdownView(presets, input) {
  const r = calculate(presets, input);
  const p = input.platform;
  const rows = r.lines.map((l) => {
    const info = feeInfo(presets, p, l.key);
    return {
      key: l.key, label: info.label ?? LINE_LABEL[l.key], rateText: l.rate != null ? formatRate(l.rate) : '',
      amount: l.amount, amountText: formatVnd(-l.amount), basis: l.basis, source: info.source, effective: info.effective,
    };
  });
  const tInfo = feeInfo(presets, p, 'tax');
  rows.push({ key: 'tax', label: tInfo.label, rateText: formatRate(r.taxRate), amount: r.tax, amountText: formatVnd(-r.tax), basis: 'GTGT 1% + TNCN 0,5% × giá sau mã giảm giá shop (bật/tắt từng phần)', source: tInfo.source, effective: '01/07/2025' });
  if (r.other > 0) rows.push({ key: 'other', label: 'Affiliate + quảng cáo', rateText: '', amount: r.other, amountText: formatVnd(-r.other), basis: '(% affiliate + 1/ROAS) × giá sau mã giảm giá shop', source: 'Bạn nhập', effective: '' });
  if (input.pack) rows.push({ key: 'pack', label: 'Đóng gói', rateText: '', amount: input.pack, amountText: formatVnd(-input.pack), basis: 'Bạn nhập', source: '', effective: '' });
  rows.push({ key: 'cost', label: 'Giá vốn', rateText: '', amount: input.cost ?? 0, amountText: formatVnd(-(input.cost ?? 0)), basis: 'Bạn nhập', source: '', effective: '' });
  if ((input.returnRate ?? 0) > 0) {
    const loss = r.profitOk - r.profit;
    rows.push({ key: 'returns', label: `Hoàn hàng ${formatRate(input.returnRate)}`, rateText: '', amount: loss, amountText: formatVnd(-loss), basis: 'Lãi kỳ vọng = (1 − tỷ lệ hoàn) × lãi đơn thành công − tỷ lệ hoàn × tiền mất mỗi đơn hoàn', source: 'Bạn nhập', effective: '' });
  }
  const fees = r.platformFees + r.tax;
  return {
    result: r,
    title: `${formatVnd(input.price)} đi đâu?`,
    takeRateText: `Sàn + thuế lấy ${formatVnd(fees)}, tức ${Math.round(r.takeRate * 100)}% giá bán`,
    rows,
    remainingText: `Còn lại: ${stateLabel(r.state).toLowerCase()} ${formatVnd(r.profit)}`,
    verifiedNote: verifiedNote(presets, p),
  };
}

// ================================================================ Phase 2
const VOUCHER_PROGRAMS = ['voucher_xtra', 'vxp'];
const shortState = (r) => (r.state === 'loss' ? 'Lỗ' : `${r.state === 'thin' ? 'Mỏng' : 'Lãi'} ${formatPct(r.margin)}`);

/** Gợi ý nhóm ngành TikTok Shop từ tên ngành Shopee (người dùng đổi được; ghi "gợi ý"). */
export function suggestCompareCategory(shopeeName = '') {
  const n = shopeeName.toLowerCase();
  if (/thời trang|giày|túi|đồng hồ|muslim/.test(n)) return 'Thời trang';
  if (/sắc đẹp|sức khỏe/.test(n)) return 'Sức khỏe & Làm đẹp';
  return 'Bách hóa';
}

const LINE_SHORT = {
  shopee: { category: 'Phí cố định', transaction: 'Phí giao dịch', per_order: 'Phí hạ tầng', voucher: 'Voucher', visibility: 'Phí hiển thị' },
  tiktok_shop: { category: 'Hoa hồng', transaction: 'Phí giao dịch', per_order: 'Phí xử lý đơn', voucher: 'Voucher', visibility: 'Phí hiển thị' },
  lazada: { category: 'Hoa hồng', transaction: 'Phí xử lý đơn', per_order: 'Phí hạ tầng', voucher: 'Voucher', visibility: 'Phí hiển thị' },
};

/** So sánh sàn (S5). opts: { tiktok: {name, rate} | null, shopee: {name, rate} | null, lazadaRate, orders } */
export function compareView(presets, input, opts = {}) {
  const own = input.platform;
  const rateFor = (p) => {
    if (p === own) return { name: input.categoryName, rate: input.categoryRate };
    if (p === 'lazada') return { name: 'Hoa hồng bạn nhập', rate: opts.lazadaRate ?? null };
    if (p === 'tiktok_shop') {
      if (opts.tiktok) return opts.tiktok;
      const name = suggestCompareCategory(input.categoryName);
      return { name, rate: categoriesFor(presets, 'tiktok_shop').find((c) => c.name === name)?.rate ?? null, suggested: true };
    }
    if (opts.shopee) return opts.shopee;
    const same = categoriesFor(presets, 'shopee').find((c) => c.name === input.categoryName);
    return { name: same?.name ?? '', rate: same?.rate ?? null };
  };
  const cards = PLATFORMS.map((p) => {
    const cat = rateFor(p);
    if (cat.rate == null) return { platform: p, label: SHORT_NAME[p], ready: false, category: cat };
    const i = platformInput(presets, input, p, cat);
    const r = calculate(presets, i);
    const lines = r.lines.map((l) => [`${LINE_SHORT[p][l.key] ?? l.key}${l.rate != null ? ` ${formatRate(l.rate)}` : ''}`, formatVnd(-l.amount)]);
    lines.push([`Thuế ${formatRate(r.taxRate)}`, formatVnd(-r.tax)]);
    return { platform: p, label: SHORT_NAME[p], ready: true, category: cat, result: r, profit: r.profit, profitText: formatVnd(r.profit),
      state: r.state, stateText: `${stateLabel(r.state)} · ${formatPct(r.margin)}`, lines };
  });
  const ready = cards.filter((c) => c.ready).sort((a, b) => b.profit - a.profit);
  const best = ready[0]?.platform ?? null;
  for (const c of ready) c.diffText = c.platform === best ? '' : `kém ${formatVnd(ready[0].profit - c.profit)}/đơn`;
  const orders = Math.max(0, Math.round(opts.orders ?? 0));
  const ref = ready.find((c) => c.platform === own && c.platform !== best) ?? ready[1];
  const monthlyText = ref && orders > 0 ? `Bán ${formatNumber(orders)} đơn mỗi tháng, chênh nhau ${formatVnd((ready[0].profit - ref.profit) * orders)}.` : '';
  return {
    cards: [...ready, ...cards.filter((c) => !c.ready)],
    best,
    monthlyText,
    tiktokNote: 'Phí TikTok tính cho shop chưa đăng ký MST. Đã đăng ký và xác minh MST, hay có chương trình tiết kiệm phí giao dịch? Sửa trong từng dòng phí.',
  };
}

/** Chi phí ẩn (S6). */
export function hiddenCostsView(presets, input) {
  const noVoucher = (input.programs ?? []).filter((x) => !VOUCHER_PROGRAMS.includes(x));
  const base = calculate(presets, { ...input, returnRate: 0, lossPerReturn: 0, roas: null, affiliateRate: 0, programs: noVoucher }).profit;
  const withReturn = calculate(presets, { ...input, roas: null, affiliateRate: 0, programs: noVoucher }).profit;
  const withVoucher = calculate(presets, { ...input, roas: null, affiliateRate: 0 }).profit;
  const full = calculate(presets, input);
  const rb = roasBreakeven(presets, input);
  const diff = base - full.profit;
  return {
    base, baseText: formatVnd(base), result: full, state: full.state,
    profitText: formatVnd(full.profit), stateText: `${stateLabel(full.state)} · ${formatPct(full.margin)}`,
    diffText: diff > 0.5 ? `Thấp hơn ${formatVnd(diff)} so với chỉ tính phí sàn.` : 'Chưa có chi phí ẩn nào — bật các mục bên dưới.',
    returnStep: `${formatVnd(base)} → ${formatVnd(withReturn)}`,
    voucherStep: `${formatVnd(withReturn)} → ${formatVnd(withVoucher)}`,
    roas: rb.roas,
    roasText: Number.isFinite(rb.roas) ? rb.roas.toFixed(2).replace('.', ',') : 'không có',
    maxAdsText: rb.maxAds > 0 ? formatVnd(rb.maxAds) : '0đ',
  };
}

/** Flash Sale + giá nhập tối đa (S4) ở giá fromPrice, giữ lãi m. */
export function flashView(presets, input, fromPrice, m) {
  const p = atPrice(input, fromPrice);
  const b = fromPrice - p.sellerVoucher;
  const rows = [0.1, 0.2, 0.3].map((d) => {
    const r = flashSale(presets, p, d);
    return { d, label: `Giảm ${Math.round(d * 100)}% → ${formatVnd(b * (1 - d))}`, profit: r.profit, profitText: formatVnd(r.profit), state: r.state, stateText: shortState(r) };
  });
  const mc = maxCost(presets, p, m);
  return {
    title: `Nếu chạy Flash Sale từ ${formatVnd(fromPrice)}`,
    rows,
    maxCost: mc,
    maxCostText: `Giá nhập tối đa: ${formatVnd(Math.max(0, mc))}`,
    maxCostNote: `Bán ${formatVnd(fromPrice)} mà vẫn giữ lãi ${Math.round(m * 100)}% thì chỉ được nhập tối đa mức này. Dùng để trả giá với nhà cung cấp.`,
  };
}

/** Đầu vào của sản phẩm đã lưu theo biểu phí hiện hành (ngành dùng % mặc định thì theo biểu phí mới; % tự sửa thì giữ). */
export function productInput(product, presets) {
  const i = product.input;
  if (i.categoryCustom || !i.categoryName) return i;
  const cat = categoriesFor(presets, i.platform).find((c) => c.name === i.categoryName);
  return cat && cat.rate != null ? { ...i, categoryRate: cat.rate } : i;
}

/** Giá đẹp giữ lãi m (mặc định 20%). */
export const suggestedPrice = (presets, input, m = 0.2) => nicePrice(listPrice(priceForMargin(presets, input, m), input));

/** Danh mục (S7): lãi thấp nhất lên đầu. filter: all | loss | thin | [ids] */
export function catalogView(presets, products, filter = 'all', opts = {}) {
  const all = products.map((p) => {
    const input = productInput(p, presets);
    const r = calculate(presets, input);
    const sug = r.state === 'good' ? null : suggestedPrice(presets, input);
    const own = { platform: input.platform, label: SHORT_NAME[input.platform], primary: true, ready: true, input, result: r, profit: r.profit,
      margin: r.margin, state: r.state, profitText: formatVnd(r.profit), stateText: stateLabel(r.state), price: input.price, priceText: formatVnd(input.price),
      sugPrice: sug, sugText: sug && Number.isFinite(sug) ? formatVnd(sug) : '' };
    const channels = opts.platforms ? [own, ...channelsView(presets, p, opts.platforms, opts.lazadaRate).slice(1)] : [own];
    const worst = channels.filter((c) => c.ready).reduce((a, c) => (c.margin < a.margin ? c : a));
    return {
      channels, worst,
      id: p.id, name: p.name, sample: !!p.sample, platform: input.platform, input, result: r, profit: r.profit, margin: r.margin, state: r.state,
      profitText: formatVnd(r.profit), stateText: `${stateLabel(r.state)} · ${formatPct(r.margin)}`,
      suggested: sug, suggestedText: sug && Number.isFinite(sug) ? formatVnd(sug) : '',
      meta: `${SHORT_NAME[input.platform]} · bán ${formatVnd(input.price)}`,
    };
  }).sort((a, b) => a.worst.margin - b.worst.margin);
  const ws = (x) => x.worst.state;
  const items = Array.isArray(filter) ? all.filter((x) => filter.includes(x.id))
    : filter === 'loss' ? all.filter((x) => ws(x) === 'loss') : filter === 'thin' ? all.filter((x) => ws(x) === 'thin') : all;
  return { items, lossCount: all.filter((x) => ws(x) === 'loss').length, thinCount: all.filter((x) => ws(x) === 'thin').length, total: all.length };
}

/** Sản phẩm chuyển từ lãi sang lỗ khi đổi biểu phí. */
export function diffCatalog(products, oldPresets, newPresets, opts = {}) {
  const out = [];
  for (const p of products) {
    const ni = productInput(p, newPresets);
    const plats = [p.input.platform, ...PLATFORMS.filter((x) => x !== p.input.platform && (opts.platforms ?? []).includes(x))];
    for (const pl of plats) {
      const at = (ps) => (pl === p.input.platform ? productInput(p, ps) : channelInput(ps, p.input, pl, p.channels?.[pl], opts.lazadaRate));
      const bi = at(oldPresets);
      const ai = at(newPresets);
      if (!bi || !ai) continue;
      const before = calculate(oldPresets, bi).profit;
      const after = calculate(newPresets, ai).profit;
      if (before >= 0 && after < 0) { out.push({ id: p.id, name: p.name, platform: pl, before, after, suggested: suggestedPrice(newPresets, ni) }); break; }
    }
  }
  return out;
}

// ================================================================ Phase 6 — F22 lãi theo từng sàn

/** Đầu vào của cùng sản phẩm trên sàn p với ngành / % cat (dùng chung cho So sánh và Danh mục). */
export function platformInput(presets, input, p, cat, price) {
  const own = input.platform;
  const ids = new Set((presets.platforms[p].programs ?? []).map((x) => x.id));
  const i = { ...input, platform: p, categoryName: cat.name ?? input.categoryName, categoryRate: cat.rate,
    programs: (input.programs ?? []).filter((x) => ids.has(x)),
    registered: p === 'tiktok_shop' && !!input.registered,
    transactionOverride: p === own ? input.transactionOverride : null, fixedOverride: p === own ? input.fixedOverride : null };
  return price != null && price !== input.price ? atPrice(i, price) : i;
}

/** Ngành + % của sản phẩm trên sàn p: kênh đã nhập (ngành có sẵn thì theo biểu phí hiện hành) hoặc gợi ý như So sánh. */
export function channelCategory(presets, input, p, channel, lazadaRate) {
  if (p === input.platform) return { name: input.categoryName, rate: input.categoryRate };
  if (channel && channel.categoryRate != null) {
    const c = !channel.categoryCustom && channel.categoryName ? categoriesFor(presets, p).find((x) => x.name === channel.categoryName) : null;
    return c && c.rate != null ? { name: c.name, rate: c.rate } : { name: channel.categoryName ?? '', rate: channel.categoryRate };
  }
  if (p === 'lazada') return { name: 'Hoa hồng bạn nhập', rate: lazadaRate ?? null, suggested: true };
  if (p === 'tiktok_shop') {
    const name = suggestCompareCategory(input.categoryName);
    return { name, rate: categoriesFor(presets, 'tiktok_shop').find((c) => c.name === name)?.rate ?? null, suggested: true };
  }
  const same = categoriesFor(presets, 'shopee').find((c) => c.name === input.categoryName);
  return { name: same?.name ?? '', rate: same?.rate ?? null, suggested: true };
}

/** Đầu vào trên sàn phụ p; null nếu chưa có % phí. Vốn, đóng gói, chi phí khác dùng chung; giá riêng nếu kênh có. */
export function channelInput(presets, input, p, channel, lazadaRate) {
  const cat = channelCategory(presets, input, p, channel, lazadaRate);
  if (cat.rate == null) return null;
  const price = p !== input.platform && channel?.price > 0 ? channel.price : input.price;
  return platformInput(presets, input, p, cat, price);
}

/** Lãi của một sản phẩm trên sàn chính + các sàn đang bán (sàn chính đứng đầu). */
export function channelsView(presets, product, platforms = [], lazadaRate = null) {
  const own = product.input.platform;
  const list = [own, ...PLATFORMS.filter((p) => p !== own && platforms.includes(p))];
  return list.map((p) => {
    const ch = product.channels?.[p];
    const category = channelCategory(presets, product.input, p, ch, lazadaRate);
    const input = p === own ? productInput(product, presets) : channelInput(presets, product.input, p, ch, lazadaRate);
    const base = { platform: p, label: SHORT_NAME[p], primary: p === own, category, suggested: !!category.suggested };
    if (!input) {
      const price = ch?.price > 0 ? ch.price : product.input.price;
      return { ...base, ready: false, state: null, price, priceText: formatVnd(price), profitText: 'cần % phí', stateText: '' };
    }
    const r = calculate(presets, input);
    const sug = r.state === 'good' ? null : suggestedPrice(presets, input);
    return { ...base, ready: true, input, result: r, profit: r.profit, margin: r.margin, state: r.state, price: input.price, priceText: formatVnd(input.price),
      profitText: formatVnd(r.profit), stateText: stateLabel(r.state), sugPrice: sug, sugText: sug && Number.isFinite(sug) ? formatVnd(sug) : '' };
  });
}

// ================================================================ Phase 3 (P1)

/** F13 — lãi tháng theo số đơn. */
export function monthlyProfit(profit, orders) {
  const n = Math.round(Number(orders) || 0);
  return n > 0 ? profit * n : 0;
}
export function monthlyText(profit, orders) {
  const m = monthlyProfit(profit, orders);
  if (!m) return '';
  return `${m < 0 ? 'Lỗ' : 'Lãi'} tháng ≈ ${formatVnd(m)}`;
}

/** F14 — nội dung chia sẻ (Zalo…). Không gửi lên đâu; người dùng tự chọn nơi gửi. */
export function shareText(presets, input, name = '') {
  const r = calculate(presets, input);
  const sug = suggestedPrice(presets, input);
  const cat = input.categoryName ? ` · ${input.categoryName} ${formatRate(input.categoryRate ?? 0)}` : ` · phí ngành ${formatRate(input.categoryRate ?? 0)}`;
  return [
    `${name ? `${name} — ` : ''}${SHORT_NAME[input.platform]}${cat}`,
    `Giá bán ${formatVnd(input.price)} · giá vốn ${formatVnd(input.cost ?? 0)}${input.pack ? ` · đóng gói ${formatVnd(input.pack)}` : ''}`,
    `Lãi mỗi đơn: ${formatVnd(r.profit)} (${stateLabel(r.state)} ${formatPct(r.margin)})`,
    `Sàn + thuế lấy ${Math.round(r.takeRate * 100)}% giá bán`,
    Number.isFinite(sug) ? `Giá nên bán để lãi 20%: ${formatVnd(sug)}` : 'Chưa đạt được lãi 20% với chi phí này',
    `Biểu phí ${SHORT_NAME[input.platform]} cập nhật ${presets.as_of.split('-').reverse().join('/')} · Tính bằng Lãi Thật`,
  ].join('\n');
}

/** Sàn có biểu phí thay đổi giữa hai phiên bản. */
export const changedPlatforms = (a, b) => PLATFORMS.filter((p) => JSON.stringify(a.platforms[p]) !== JSON.stringify(b.platforms[p]));
