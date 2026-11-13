// Trạng thái app (hàm thuần) + tracking theo docs/TRACKING_PLAN.md. ui.js gọi rồi tự lưu localStorage.

import { calculate } from './engine.js';
import { newerVersion, SHORT_NAME, PLATFORMS } from './presets.js';
import { diffCatalog, changedPlatforms, suggestedPrice, productInput, channelInput } from './calc.js';
import { EXAMPLES } from './examples.js';
import { diffCombos, checkOrder, productCheckArgs, checkSummary, FREE_FILE_DETAILS } from './addons.js';

export const STORAGE_KEY = 'laithat:v1';

/** Sự kiện + thuộc tính cho phép, đúng docs/TRACKING_PLAN.md. Không giá, giá vốn, tên sản phẩm. */
export const EVENT_PARAMS = {
  onboarding_completed: ['primary_platform'],
  calc_completed: ['platform', 'category_id', 'mode', 'state', 'margin_bucket', 'has_seller_voucher', 'has_ship_buyer', 'programs_on'],
  nice_price_applied: ['target_margin'],
  fee_breakdown_opened: ['platform'],
  fee_info_opened: ['fee_key'],
  program_toggled: ['program', 'on'],
  fee_override: ['platform', 'field'],
  fee_report_sent: ['platform', 'field'],
  compare_viewed: ['best_platform', 'platforms_count'],
  hidden_costs_set: ['has_return_rate', 'has_roas', 'has_affiliate'],
  flash_sale_viewed: ['unlock_method'],
  max_cost_viewed: ['unlock_method'],
  product_saved: ['catalog_size', 'state'],
  catalog_sorted_alert: ['loss_count_bucket'],
  fee_table_updated: ['fee_version', 'products_turned_loss'],
  fee_alert_opened: ['fee_version', 'is_pro'],
  paywall_view: ['trigger'],
  trial_started: ['plan'],
  purchase: ['plan', 'price', 'trigger'],
  ad_impression: ['format', 'placement'],
  rewarded_ad_complete: ['reward'],
  share_result: ['channel'],
  // add-on 13/11/2026 (F28–F30)
  combo_built: ['platform', 'mode', 'items_count', 'discount_type', 'margin_bucket'],
  combo_vs_separate_viewed: ['platform', 'uplift_bucket'],
  combo_max_discount_viewed: ['target_margin', 'is_pro'],
  combo_saved: ['items_count', 'mode'],
  order_check_started: ['method', 'platform'],
  order_check_completed: ['method', 'orders_count', 'mismatch_count', 'top_reason'],
  order_check_file_error: ['error_code', 'missing_column'],
  mismatch_reason_viewed: ['reason_code', 'fee_key'],
  category_rate_updated_from_check: ['reason_code', 'platform'],
  complaint_template_copied: ['fee_key', 'diff_bucket'],
};
export const EVENTS = Object.keys(EVENT_PARAMS);

export function defaultCalc() {
  return {
    platform: 'shopee', categoryName: '', categoryRate: null, price: 0, cost: 0, pack: 0,
    voucherValue: 0, voucherUnit: 'vnd', sellerVoucher: 0, shipBuyer: 0,
    programs: [], vat: true, pit: true, registered: false, affiliateRate: 0, roas: null, returnRate: 0, lossPerReturn: 0,
    transactionOverride: null, fixedOverride: null, newShopPromo: false,
    mode: 'price', targetM: 0.2, targetAmount: 0, ordersPerMonth: 0, returnOn: false, adsOn: false,
  };
}

export function defaultState() {
  return {
    platform: null,            // sàn chính đã chọn ở onboarding (shopee / tiktok_shop / lazada / multi)
    shopType: 'standard',
    calc: defaultCalc(),
    products: [],
    lazadaRate: null,
    compareOrders: 300,
    seenFeeVersion: null,
    feeAlert: null,            // { fee_version, platform, turnedLoss: [id], at }
    notifications: [],         // hộp thông báo trong app
    alertsOn: false,
    saleReminders: true,
    examplesDismissed: false,
    compare: { tiktok: null, shopee: null },
    pro: false,
    rewardedUnlocks: [],
    sub: null,                 // thuê bao Pro (F24)
    adConsent: null,           // 'personalized' | 'npa' (F25)
    lastInterstitialAt: 0,
    sessions: 0,
    combos: [],                // F28 combo đã lưu (món liên kết sản phẩm theo id)
    skuMap: {},                // F30 SKU trong file → id sản phẩm
    checkHistory: [],          // F29/F30 kết quả kiểm tra (không lưu nội dung file)
    events: [],
  };
}

export function loadState(json) {
  if (!json) return defaultState();
  try {
    const raw = JSON.parse(json);
    const base = defaultState();
    // Máy cũ lỡ lưu Mall (đã bỏ 13/11) → shop thường; ngành "Tự nhập (Mall)" thành chưa chọn.
    const calc = { ...base.calc, ...raw.calc };
    if (raw.shopType === 'mall' && /Mall/.test(calc.categoryName ?? '')) Object.assign(calc, { categoryName: '', categoryCustom: true });
    return { ...base, ...raw, shopType: 'standard', calc };
  } catch {
    return defaultState();
  }
}
export const saveState = (s) => JSON.stringify(s);

export const initialRoute = (s) => (s.platform ? '#/tinh' : '#/chon-san');

/** Ghi sự kiện cục bộ (giả lập Firebase Analytics): tên phải có trong plan; chỉ giữ thuộc tính của plan. */
export function track(state, name, params = {}, now = Date.now()) {
  const allowed = EVENT_PARAMS[name];
  if (!allowed) return state;
  const clean = Object.fromEntries(Object.entries(params).filter(([k]) => allowed.includes(k)));
  return { ...state, events: [...state.events, { name, params: clean, at: now }].slice(-300) };
}

/** Chọn sàn chính. Chỉ shop thường (bỏ Mall 13/11, F3/F18). */
export function completeOnboarding(state, platform, now = Date.now()) {
  if (!['shopee', 'tiktok_shop', 'lazada', 'multi'].includes(platform)) throw new Error('Sàn không hợp lệ');
  const calcPlatform = platform === 'multi' ? 'shopee' : platform;
  const sameCalc = state.calc.platform === calcPlatform;
  const calc = sameCalc ? state.calc : { ...state.calc, platform: calcPlatform, categoryName: '', categoryRate: null, programs: [] };
  const s = { ...state, platform, shopType: 'standard', calc, sellPlatforms: undefined };
  return track(s, 'onboarding_completed', { primary_platform: platform }, now);
}

export const updateCalc = (state, patch) => ({ ...state, calc: { ...state.calc, ...patch } });

// ================================================================ Phase 2

/** Khoá Pro: chỉ khoá khi bật cờ trong app_config và chưa Pro / chưa mở bằng quảng cáo thưởng. */
export const isLocked = (feature, state, config, now = Date.now()) => !!config.pro_gates_enabled && !isPro(state, now) && !(state.rewardedUnlocks ?? []).includes(feature);

export const canSave = (state, config, now = Date.now()) => !config.pro_gates_enabled || isPro(state, now) || state.products.length < (config.free_catalog_limit ?? 5);

const PRODUCT_KEYS = ['platform', 'categoryName', 'categoryRate', 'categoryCustom', 'price', 'cost', 'pack', 'voucherValue', 'voucherUnit', 'sellerVoucher',
  'shipBuyer', 'programs', 'vat', 'pit', 'registered', 'affiliateRate', 'roas', 'returnRate', 'lossPerReturn', 'transactionOverride', 'fixedOverride', 'newShopPromo', 'ordersPerMonth'];

/** Lưu (hoặc cập nhật nếu input.productId có sẵn) một sản phẩm. Trả { ok, state, id }. */
export function saveProduct(state, name, input, presets, now = Date.now(), config = { pro_gates_enabled: false }, extra = {}) {
  const clean = Object.fromEntries(PRODUCT_KEYS.filter((k) => input[k] !== undefined).map((k) => [k, input[k]]));
  const existing = input.productId && state.products.find((p) => p.id === input.productId);
  if (!existing && !canSave(state, config)) return { ok: false, reason: 'limit', state };
  const id = existing ? existing.id : `p${now}${state.products.length}`;
  const product = { id, name: String(name).trim() || 'Sản phẩm', input: clean, savedAt: now, ...extra };
  const products = existing ? state.products.map((p) => (p.id === id ? product : p)) : [...state.products, product];
  const r = calculate(presets, { ...clean, categoryRate: clean.categoryRate ?? 0, sellerVoucher: clean.sellerVoucher ?? 0 });
  let s = { ...state, products };
  s = track(s, 'product_saved', { catalog_size: products.length, state: r.state }, now);
  return { ok: true, state: s, id };
}

export const removeProduct = (state, id) => ({ ...state, products: state.products.filter((p) => p.id !== id) });

export function lossCountBucket(n) {
  if (n <= 1) return '1';
  if (n <= 5) return '2–5';
  return '>5';
}

export const hiddenCostsEvent = (i) => ({ has_return_rate: (i.returnRate ?? 0) > 0, has_roas: (i.roas ?? 0) > 0, has_affiliate: (i.affiliateRate ?? 0) > 0 });

/** Nhận biểu phí mới: tính lại danh mục, báo sản phẩm chuyển sang lỗ. Trả { changed, state }. */
export function applyFeeUpdate(state, oldPresets, newPresets, now = Date.now()) {
  const seen = state.seenFeeVersion ?? oldPresets.fee_version;
  if (!newerVersion(newPresets.fee_version, seen)) return { changed: false, state };
  const turned = [...diffCatalog(state.products, oldPresets, newPresets, { platforms: sellPlatforms(state), lazadaRate: state.lazadaRate }),
    ...diffCombos(state.combos ?? [], state.products, oldPresets, newPresets)];
  const names = changedPlatforms(oldPresets, newPresets).map((p) => SHORT_NAME[p]);
  const who = names.length ? names.join(', ') : 'sàn';
  const text = turned.length
    ? `Biểu phí ${who} mới đã áp dụng · ${turned.length} sản phẩm chuyển sang lỗ. Kiểm tra lại giá trước khi chạy khuyến mãi.`
    : `Biểu phí ${who} mới đã áp dụng · chưa sản phẩm nào chuyển sang lỗ.`;
  let s = {
    ...state,
    seenFeeVersion: newPresets.fee_version,
    feeAlert: { fee_version: newPresets.fee_version, text, turnedLoss: turned.map((t) => ({ id: t.id, name: t.name, suggested: t.suggested, ...(t.combo ? { combo: true } : {}) })), at: now },
    notifications: [{ text, at: now, kind: 'fee' }, ...state.notifications].slice(0, 30),
  };
  s = track(s, 'fee_table_updated', { fee_version: newPresets.fee_version, products_turned_loss: turned.length }, now);
  return { changed: true, state: s, turned };
}

/** calc_completed: ghi 1 lần cho một bộ đầu vào, sau khi ngừng gõ `delay` ms. */
export function calcTracker(delay = 1500) {
  let pending = null;
  let at = 0;
  let last = null;
  return {
    input(key, now) { pending = key; at = now; },
    due(now) {
      if (pending == null || now - at < delay) return null;
      const k = pending;
      pending = null;
      if (k === last) return null;
      last = k;
      return k;
    },
  };
}

// ================================================================ Phase 3 (P1)

/** F15 — thêm 4 sản phẩm mẫu (đánh dấu "mẫu", không ghi product_saved để phễu sạch). */
export function loadExamples(state, presets, now = Date.now()) {
  const samples = EXAMPLES.map((e, i) => ({ id: `sample-${e.id}-${now}`, name: e.name, input: { ...e.input }, savedAt: now + i, sample: true }));
  return { ...state, products: [...state.products, ...samples] };
}

/** F16 — áp giá gợi ý (giữ lãi 20%, giá đẹp) cho các sản phẩm đã chọn. Trả { state, changed, undo }. */
export function applySuggested(state, ids, presets, now = Date.now(), opts) {
  if (opts?.platforms) return applySuggestedOn(state, ids, presets, now, opts);
  let changed = 0;
  const products = state.products.map((p) => {
    if (!ids.includes(p.id)) return p;
    const sug = suggestedPrice(presets, productInput(p, presets));
    if (!Number.isFinite(sug) || sug === p.input.price) return p;
    changed += 1;
    return { ...p, input: { ...p.input, price: sug }, savedAt: now };
  });
  return { state: { ...state, products }, changed, undo: state.products };
}

// ================================================================ Phase 4 — F19 tách Tính nhanh / Sản phẩm

/** Bản nháp để sửa một sản phẩm (cùng hình dạng với Tính nhanh, không đụng state.calc). */
export function productToCalc(product) {
  const i = product.input;
  return {
    ...defaultCalc(), ...i, mode: 'price',
    returnOn: (i.returnRate ?? 0) > 0, adsOn: (i.roas ?? 0) > 0, ordersPerMonth: i.ordersPerMonth ?? 0,
  };
}

/** Ghi thay đổi của một sản phẩm đã lưu (đổi tên + đầu vào). Không ghi product_saved, không đụng Tính nhanh. */
export function updateProduct(state, id, name, input, now = Date.now(), channels) {
  const p = state.products.find((x) => x.id === id);
  if (!p) return state;
  const clean = Object.fromEntries(PRODUCT_KEYS.filter((k) => input[k] !== undefined).map((k) => [k, input[k]]));
  const next = { ...p, name: String(name).trim() || p.name, input: clean, savedAt: now, ...(channels ? { channels } : {}) };
  return { ...state, products: state.products.map((x) => (x.id === id ? next : x)) };
}

/** margin_bucket theo tracking plan. */
export function marginBucket(margin) {
  const p = margin * 100;
  if (p < 0) return '<0';
  if (p < 5) return '0–5';
  if (p < 10) return '5–10';
  if (p <= 20) return '10–20';
  return '>20';
}

/** F21 — Bản nháp cho "Sản phẩm mới": trống giá / vốn / ngành, giữ sàn và thiết lập shop của Tính nhanh. */
export function newProductCalc(state) {
  const c = state.calc ?? defaultCalc();
  const d = defaultCalc();
  return {
    ...d, platform: c.platform ?? d.platform,
    vat: c.vat ?? d.vat, pit: c.pit ?? d.pit, registered: c.registered ?? d.registered,
    programs: [...(c.programs ?? [])], newShopPromo: c.newShopPromo ?? false,
    transactionOverride: c.transactionOverride ?? null, fixedOverride: c.fixedOverride ?? null,
  };
}

/** F21 — Đủ để thêm vào danh mục: có tên và giá bán. */
export const createReady = (name, calc) => !!String(name ?? '').trim() && calc.price > 0;

// ================================================================ Phase 6 — F22 lãi theo từng sàn

/** Các sàn shop đang bán: tự chọn ở Cài đặt, mặc định theo onboarding ("Nhiều sàn" → cả 3). */
export function sellPlatforms(state) {
  if (Array.isArray(state.sellPlatforms) && state.sellPlatforms.length) return PLATFORMS.filter((p) => state.sellPlatforms.includes(p));
  if (state.platform === 'multi') return [...PLATFORMS];
  return [PLATFORMS.includes(state.platform) ? state.platform : 'shopee'];
}

/** Bật / tắt một sàn đang bán; luôn còn ít nhất 1 sàn. */
export function setSellPlatform(state, platform, on) {
  const cur = sellPlatforms(state);
  const next = on ? PLATFORMS.filter((p) => cur.includes(p) || p === platform) : cur.filter((p) => p !== platform);
  return next.length ? { ...state, sellPlatforms: next } : state;
}

// ================================================================ Phase 7 — F23 áp giá gợi ý theo từng sàn

/** Áp giá gợi ý trên các sàn đã chọn: sàn chính đổi giá sản phẩm, sàn phụ đổi giá riêng của kênh.
 *  Sàn đang lãi tốt hoặc chưa có % phí thì giữ nguyên. Vốn / chi phí khác dùng chung (PO 13/11). */
function applySuggestedOn(state, ids, presets, now, { platforms, lazadaRate = null }) {
  let changed = 0;
  const products = state.products.map((p) => {
    if (!ids.includes(p.id)) return p;
    let input = p.input;
    let channels = p.channels ?? {};
    let touched = false;
    for (const pl of platforms) {
      const own = pl === p.input.platform;
      const i = own ? productInput(p, presets) : channelInput(presets, p.input, pl, channels[pl], lazadaRate);
      if (!i || calculate(presets, i).state === 'good') continue;
      const sug = suggestedPrice(presets, i);
      if (!Number.isFinite(sug) || sug === i.price) continue;
      if (own) input = { ...input, price: sug };
      else channels = { ...channels, [pl]: { ...(channels[pl] ?? {}), price: sug } };
      touched = true;
    }
    if (!touched) return p;
    changed += 1;
    return { ...p, input, channels, savedAt: now };
  });
  return { state: { ...state, products }, changed, undo: state.products };
}

// ================================================================ Phase 8 — F24 Lãi Thật Pro (thuê bao)
const DAY = 86400000;

/** Pro: cờ cũ `pro`, hoặc thuê bao đang chạy / đang dùng thử còn hạn. */
export function isPro(state, now = Date.now()) {
  if (state.pro) return true;
  const s = state.sub;
  if (!s) return false;
  if (s.status === 'trial') return now < s.trialEndsAt;
  if (s.status === 'active') return !s.cancelled || now < s.renewsAt;
  return false;
}

/** Bắt đầu gói: tháng → dùng thử (trial_started); năm → mua ngay (purchase). */
export function startSubscription(state, plan, trigger, now, prices) {
  if (plan === 'monthly') {
    const trialEndsAt = now + prices.trial_days * DAY;
    const s = { ...state, sub: { plan, status: 'trial', startedAt: now, trialEndsAt, renewsAt: trialEndsAt, trigger, cancelled: false, reminded: false } };
    return track(s, 'trial_started', { plan }, now);
  }
  const s = { ...state, sub: { plan, status: 'active', startedAt: now, renewsAt: now + 365 * DAY, trigger, cancelled: false } };
  return track(s, 'purchase', { plan, price: prices.yearly, trigger }, now);
}

/** Cập nhật trạng thái theo thời gian: hết dùng thử → thuê bao (hoặc hết hạn nếu đã huỷ). */
export function settleSubscription(state, now, prices) {
  const s = state.sub;
  if (!s) return state;
  if (s.status === 'trial' && now >= s.trialEndsAt) {
    if (s.cancelled) return { ...state, sub: { ...s, status: 'expired' } };
    const next = { ...state, sub: { ...s, status: 'active', renewsAt: s.trialEndsAt + 30 * DAY } };
    return track(next, 'purchase', { plan: s.plan, price: prices[s.plan], trigger: s.trigger }, now);
  }
  if (s.status === 'active' && s.cancelled && now >= s.renewsAt) return { ...state, sub: { ...s, status: 'expired' } };
  return state;
}

/** Huỷ: vẫn Pro tới hết dùng thử / hết kỳ đã trả. (Bản thật huỷ trong Google Play.) */
export const cancelSubscription = (state) => (state.sub ? { ...state, sub: { ...state.sub, cancelled: true } } : state);

/** Nhắc 1 lần khi còn ≤ 1 ngày dùng thử. Trả { state, text } (text null nếu chưa tới lúc / đã nhắc). */
export function trialReminder(state, now, prices) {
  const s = state.sub;
  if (!s || s.status !== 'trial' || s.cancelled || s.reminded || now >= s.trialEndsAt || s.trialEndsAt - now > DAY) return { state, text: null };
  const text = `Ngày mai hết dùng thử Lãi Thật Pro · Sau đó gói tự gia hạn ${prices.monthly.toLocaleString('vi-VN').replace(/,/g, '.')}đ/tháng. Không muốn tiếp tục thì huỷ trong Google Play › Thanh toán và gói đăng ký.`;
  return { state: { ...state, sub: { ...s, reminded: true }, notifications: [{ text, at: now, kind: 'trial' }, ...state.notifications].slice(0, 30) }, text };
}

/** Khôi phục từ bản ghi giao dịch (Play Billing hoặc chế độ thử). */
export function restoreSubscription(state, record, now) {
  if (!record) return state;
  return settleSubscription({ ...state, sub: { cancelled: false, reminded: true, ...record } }, now, { monthly: 0, yearly: 0 });
}

// ================================================================ Phase 10 — add-on: Combo (F28), Kiểm tra đơn (F29, F30)

/** Lưu (hoặc cập nhật theo rec.id) một combo. Món giữ productId để tính lại theo danh mục. */
export function saveCombo(state, rec, now = Date.now()) {
  const combos = state.combos ?? [];
  const existing = rec.id && combos.find((c) => c.id === rec.id);
  const id = existing ? existing.id : `c${now}${combos.length}`;
  const clean = {
    id, name: String(rec.name ?? '').trim() || 'Combo', mode: rec.mode ?? 'promo', platform: rec.platform ?? 'shopee',
    pack: rec.pack ?? 0, ship: rec.ship ?? 0, programs: [...(rec.programs ?? [])], vat: rec.vat ?? true, pit: rec.pit ?? true,
    discount: rec.discount ? [...rec.discount] : null, bundleCat: rec.bundleCat ?? null,
    items: rec.items.map((i) => ({ productId: i.productId ?? null, name: i.name, cost: i.cost, price: i.price, cat: i.cat, qty: i.qty, ...(i.dealPrice != null ? { dealPrice: i.dealPrice } : {}) })),
    savedAt: now,
  };
  const next = existing ? combos.map((c) => (c.id === id ? clean : c)) : [...combos, clean];
  const s = track({ ...state, combos: next }, 'combo_saved', { items_count: clean.items.reduce((a, i) => a + i.qty, 0), mode: clean.mode }, now);
  return { ok: true, state: s, id };
}
export const removeCombo = (state, id) => ({ ...state, combos: (state.combos ?? []).filter((c) => c.id !== id) });

/** Nút sửa tại dòng lệch (K3): chỉ áp khi người dùng bấm. Ngành → category_rate_updated_from_check; công tắc → program_toggled. */
export function applyCheckFix(state, productId, action, platform = 'shopee', now = Date.now()) {
  const p = state.products.find((x) => x.id === productId);
  if (!p || !action) return state;
  const products = state.products.map((x) => (x.id === productId ? { ...x, input: { ...x.input, ...action.patch }, savedAt: now } : x));
  let s = { ...state, products };
  if (action.kind === 'category') s = track(s, 'category_rate_updated_from_check', { reason_code: 'category_rate', platform }, now);
  else {
    const on = action.kind === 'vat' ? action.patch.vat : (action.patch.programs ?? []).includes(action.kind);
    s = track(s, 'program_toggled', { program: action.kind, on }, now);
  }
  return s;
}

/** Gán SKU trong file với sản phẩm (nhớ cho lần sau). */
export const mapSku = (state, sku, productId) => ({ ...state, skuMap: { ...(state.skuMap ?? {}), [sku]: productId } });

const normName = (s) => String(s ?? '').trim().toLowerCase();
/** Sản phẩm của một SKU: đã gán, hoặc trùng tên. */
export function productForSku(state, sku) {
  const id = state.skuMap?.[sku];
  return state.products.find((p) => p.id === id) ?? state.products.find((p) => normName(p.name) === normName(sku)) ?? null;
}

/** Lưu tóm tắt một lần kiểm tra (không lưu mã đơn, số tiền từng đơn, nội dung file). */
function remember(state, method, results, now) {
  const sum = checkSummary(results);
  const rec = { id: `k${now}`, at: now, method, total: sum.total, count: sum.count, topReason: sum.topReason };
  return { ...state, checkHistory: [rec, ...(state.checkHistory ?? [])].slice(0, 20) };
}
export const clearCheckHistory = (state, id) => ({ ...state, checkHistory: id ? (state.checkHistory ?? []).filter((h) => h.id !== id) : [] });

/** Một đơn nhập tay (F29). Trả { state, r }. */
export function runManualCheck(state, presets, order, args, now = Date.now()) {
  const r = checkOrder(presets, order, args.catRate ?? 0, args.programs ?? [], args);
  let s = track(state, 'order_check_completed', { method: 'manual', orders_count: 1, mismatch_count: r.mismatches, top_reason: r.top_reason }, now);
  s = remember(s, 'manual', [{ r, order }], now);
  return { state: s, r };
}

/** Cả file (F30): kiểm mọi đơn; chưa Pro thì khoá chi tiết từ đơn thứ 4. Trả { state, results, unmapped }. */
export function runFileCheck(state, presets, parsed, now = Date.now(), { pro = false } = {}) {
  const results = [];
  let unmapped = 0;
  parsed.orders.forEach((order, i) => {
    const locked = !pro && i >= FREE_FILE_DETAILS;
    const product = productForSku(state, order.sku);
    if (!product) { unmapped += 1; results.push({ id: order.id, sku: order.sku, order, r: null, product: null, locked }); return; }
    const a = productCheckArgs(product);
    const r = checkOrder(presets, order, a.catRate, a.programs, { ...a, items: order.items ?? 1, lumped: !!parsed.lumped });
    results.push({ id: order.id, sku: order.sku, order, r, product: { id: product.id, name: product.name }, locked });
  });
  const sum = checkSummary(results);
  let s = track(state, 'order_check_completed', { method: 'file', orders_count: results.length, mismatch_count: sum.count.lech, top_reason: sum.topReason }, now);
  s = remember(s, 'file', results, now);
  return { state: s, results, unmapped };
}
