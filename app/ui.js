// Giao diện Lãi Thật — chỉ vẽ trạng thái và nhận thao tác. Phép tính: engine.js / calc.js. Trạng thái: store.js.
// Màn + selector: 1-wiki/screens.md
import bundledPresets from './assets/fee_presets.json' with { type: 'json' };
import config from './assets/app_config.json' with { type: 'json' };
import * as E from './engine.js';
import * as C from './calc.js';
import * as P from './presets.js';
import * as St from './store.js';
import { icon } from './icons.js';
import { QUICK_EXAMPLES, EXAMPLES } from './examples.js';
import * as Sale from './sales.js';
import { showSplash } from './splash.js';
import * as Pro from './pro.js';
import * as Ads from './ads.js';
import { getBilling } from './billing.js';
import { isNative, plugin, createNativeAds } from './native.js';
import { createAddons } from './ui-addons.js';

const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
const vnd = E.formatVnd;
const app = $('#app');
const overlay = $('#overlay');

// ---------------------------------------------------------------- trạng thái + biểu phí
const read = (k) => { try { return localStorage.getItem(k); } catch { return null; } };
const write = (k, v) => { try { localStorage.setItem(k, v); } catch { /* chế độ riêng tư */ } };
let state = St.loadState(read(St.STORAGE_KEY));
let presets = P.pickPresets({ remote: null, cache: safeJson(read('laithat:presets')), bundled: bundledPresets });
// Bot đặt cấu hình thử (tắt / bật khoá Pro, quảng cáo) qua window.__app.setConfig; giữ qua các lần tải lại trong phiên.
try { Object.assign(config, JSON.parse(sessionStorage.getItem('laithat:test-config') ?? '{}')); } catch { /* không có sessionStorage */ }
const ui = { view: null, otherOpen: false, openInfo: new Set(), amountMode: false, lastRoute: null, navCount: 0 };

function safeJson(s) { try { return s ? JSON.parse(s) : null; } catch { return null; } }
function persist() { write(St.STORAGE_KEY, St.saveState(state)); }
function set(next) { state = next; persist(); }
function track(name, params) { set(St.track(state, name, params)); }
/** Giờ hiện tại (bot tua nhanh được để kiểm hết dùng thử). */
const now = () => Date.now() + (ui.clockOffset ?? 0);
const pro = () => St.isPro(state, now());
let billingP = null;
const billing = () => (billingP ??= getBilling(window, config));
// F27 — trong app Android (Capacitor): quảng cáo AdMob thật thay khung thử; trên web nAds = null.
const nAdMob = plugin(window, 'AdMob');
const nAds = nAdMob ? createNativeAds(nAdMob, config.admob) : null;
const npa = () => state.adConsent !== 'personalized';
function syncNativeBanner() {
  if (!nAds) return;
  nAds.route(Ads.bannerPlacement(location.hash), { active: Ads.adsActive(state, config, now()), npa: npa() })
    .then((on) => document.body.classList.toggle('native-banner', on));
}
function go(hash) { if (location.hash === hash) render(); else location.hash = hash; }
/** Khoá chỉ thuộc giao diện (không phải dữ liệu sản phẩm): đổi không tính là "chưa lưu". */
const UI_ONLY = ['mode', 'targetM', 'targetAmount'];
const calcPatch = (patch) => {
  if (ws() && ui.draft && ui.draftFor === ws()) {
    ui.draft = { ...ui.draft, ...patch };
    if (Object.keys(patch).some((k) => !UI_ONLY.includes(k))) ui.dirty = true;
    return;
  }
  set(St.updateCalc(state, patch));
};

/** Đầu vào cho engine từ cur(). */
/** Đường dẫn hiện tại tách thành đoạn. */
const routeSeg = () => location.hash.slice(1).split('?')[0].split('/').filter(Boolean);
/** id sản phẩm đang mở (màn #/san-pham/<id>…), hoặc null khi ở Tính nhanh. */
const ws = () => { const seg = routeSeg(); return seg[0] === 'san-pham' && seg[1] ? seg[1] : null; };
/** Thứ đang sửa: bản nháp của sản phẩm đang mở, hoặc Tính nhanh. */
const cur = () => (ws() && ui.draft && ui.draftFor === ws() ? ui.draft : state.calc);
/** Đường dẫn màn con (chi-tiet / chi-phi-an) theo phạm vi; và màn gốc của phạm vi. */
const NEW_ID = 'moi';
const isNew = () => ws() === NEW_ID;
const createOk = () => St.createReady(ui.draftName, cur()) && !rateMissing();
const catOpts = () => ({ platforms: St.sellPlatforms(state), lazadaRate: state.lazadaRate });
// F23 — áp giá gợi ý theo sàn đã chọn (bán ≥ 2 sàn)
const multiSell = () => St.sellPlatforms(state).length > 1;
const applyOn = () => ui.applyOn ?? new Set(St.sellPlatforms(state));
const hasSug = (c) => c.ready && c.sugPrice != null && Number.isFinite(c.sugPrice) && c.sugPrice !== c.price;
const bulkEligible = (i) => (multiSell() ? i.channels.some((c) => applyOn().has(c.platform) && hasSug(c)) : !!i.suggested);
const bulkPreselect = (i) => (multiSell() ? i.channels.some((c) => applyOn().has(c.platform) && c.state === 'loss' && hasSug(c)) : i.state === 'loss' && !!i.suggested);
const subRoute = (name) => (ws() ? `#/san-pham/${ws()}/${name}` : `#/${name}`);
const homeRoute = () => (ws() ? `#/san-pham/${ws()}` : '#/tinh');

function engineInput(c = cur()) {
  const sellerVoucher = C.sellerVoucherAmount(c.price, c.voucherValue, c.voucherUnit);
  return {
    ...c, categoryRate: c.categoryRate ?? 0, sellerVoucher,
    returnRate: c.returnOn ? (c.returnRate ?? 0) : 0, lossPerReturn: c.returnOn ? (c.lossPerReturn ?? 0) : 0,
    roas: c.adsOn && c.roas > 0 ? c.roas : null,
  };
}
const rateMissing = (c = cur()) => c.categoryRate == null;
const shortName = (p) => P.SHORT_NAME[p] ?? p;

// ---------------------------------------------------------------- khung chung
function moneyInput(id, key, label, { unit = 'đ', extra = '' } = {}) {
  const v = cur()[key];
  return `<label class="field"><span class="lbl">${label}</span>
    <span class="input"><input id="${id}" class="money" inputmode="numeric" autocomplete="off" data-money="${key}" value="${v ? E.formatMoneyInput(String(Math.round(v))) : ''}" placeholder="0">${extra || `<span class="unit">${unit}</span>`}</span></label>`;
}
const top = ({ title, sub = '', back = '', right = '' }) => `
  <header class="top">${back ? `<button class="back" data-act="nav" data-to="${back}" aria-label="Quay lại">${icon('back')}</button>` : ''}
    <div class="titles"><h1 id="screen-title">${title}</h1>${sub ? `<p class="sub">${sub}</p>` : ''}</div>${right}</header>`;

// ---------------------------------------------------------------- S1 · Chọn sàn
function screenOnboarding() {
  ui.pick = ui.pick ?? state.platform;
  return `
  <section class="screen">
    <img id="brand-logo" class="brand-logo" src="assets/logo-horizontal.svg" alt="Lãi Thật" width="160" height="40">
    <h1 id="screen-title" style="font-size:28px;margin-top:20px">Bạn bán chủ yếu ở đâu?</h1>
    <p class="lead" style="margin-top:8px">Lãi Thật nạp sẵn biểu phí mới nhất của sàn đó. Đổi lúc nào cũng được.</p>
    <div role="radiogroup" aria-label="Sàn chính">
      ${P.platformOptions(presets).map((o) => `
        <button id="pf-${o.id}" class="option" role="radio" aria-checked="${ui.pick === o.id}" data-act="pick-platform" data-v="${o.id}">
          <span class="dot" aria-hidden="true"></span><span><strong>${o.label}</strong><span class="n">${o.note}</span></span></button>`).join('')}
    </div>
  </section>
  <div class="cta"><button id="onboard-continue" class="btn btn-primary" data-act="onboard" ${ui.pick ? '' : 'disabled'}>Tiếp tục</button>
    <p class="fine" style="text-align:center">Dùng ngay, không cần đăng nhập, dữ liệu lưu trên máy bạn. ${P.DISCLAIMER}</p></div>`;
}

// ---------------------------------------------------------------- S2 / S4 · Tính lãi
function categoryField() {
  const c = cur();
  const cats = P.categoriesFor(presets, c.platform);
  return `
  <div class="row">
    <label class="field"><span class="lbl">${c.platform === 'shopee' ? 'Ngành hàng' : 'Ngành hàng / hoa hồng'}</span>
      <span class="input"><select id="category" data-ch="category"><option value="">Chọn ngành</option>
        ${cats.map((x) => `<option value="${esc(x.name)}" ${x.name === c.categoryName ? 'selected' : ''}>${esc(x.name)}</option>`).join('')}</select>
        <span class="unit">${icon('down')}</span></span></label>
    <label class="field" style="flex:none"><span class="lbl">% phí ngành</span>
      <span class="input rate"><input id="category-rate" inputmode="decimal" autocomplete="off" data-ch="category-rate" data-in="category-rate" value="${c.categoryRate != null ? String(Math.round(c.categoryRate * 10000) / 100).replace('.', ',') : ''}" placeholder="nhập"><span class="unit">%</span></span></label>
  </div>
  ${rateMissing() && c.categoryName ? '<p class="warn" id="rate-needed">Biểu phí chưa có % cho ngành này — nhập % phí/hoa hồng của bạn.</p>' : ''}
  ${c.newShopPromo && P.newShopPromoInfo(presets, c.platform) ? `<p class="hint" id="promo-hint">${esc(P.newShopPromoInfo(presets, c.platform).text)} Phí cố định ngành đang tính 0đ.</p>` : ''}`;
}

function otherCostsBlock() {
  const c = cur();
  const summary = `Chi phí khác: đóng gói ${vnd(c.pack || 0)}`;
  return `
  <button id="other-costs" class="dashed section" data-act="toggle-other" aria-expanded="${ui.otherOpen}"><span>${summary}</span> <span>${ui.otherOpen ? 'Thu gọn' : '+ Hoàn hàng, ads'}</span></button>
  ${ui.otherOpen ? `<div class="card" style="margin-top:10px">${moneyInput('pack', 'pack', 'Đóng gói mỗi đơn')}
     <button id="to-hidden" class="btn btn-secondary section" data-act="nav" data-to="${subRoute('chi-phi-an')}" ${c.price > 0 && !rateMissing() ? '' : 'disabled'}>Chi phí ẩn: hoàn hàng, voucher, quảng cáo</button>
     ${hiddenSummary() ? `<p class="hint" style="margin-top:8px">Đang tính: ${hiddenSummary()}</p>` : ''}</div>` : ''}`;
}

function hiddenSummary(c = cur()) {
  const parts = [];
  if (c.returnOn && c.returnRate > 0) parts.push(`hoàn ${E.formatRate(c.returnRate)}`);
  if (c.programs.some((p) => p === 'voucher_xtra' || p === 'vxp')) parts.push('voucher');
  if (c.adsOn && c.roas > 0) parts.push(`ads ROAS ${String(c.roas).replace('.', ',')}`);
  if (c.affiliateRate > 0) parts.push(`affiliate ${E.formatRate(c.affiliateRate)}`);
  return parts.join(', ');
}

function resultCard() {
  const c = cur();
  if (rateMissing()) return `<div id="result" class="result" data-state="none"><div class="r-top"><span>Lãi mỗi đơn</span></div><p class="hint" style="margin:6px 0">${c.categoryName ? 'Nhập % phí ngành để tính lãi.' : 'Chọn ngành hàng, nhập giá vốn và giá bán — kết quả hiện ngay khi gõ.'}</p></div>`;
  if (!(c.price > 0)) return `<div id="result" class="result" data-state="none"><div class="r-top"><span>Lãi mỗi đơn</span></div><p class="hint" style="margin:6px 0">Nhập giá vốn và giá bán — kết quả hiện ngay khi gõ.</p></div>`;
  const v = C.calcView(presets, engineInput());
  const bar = C.moneyBar(v.result, engineInput());
  const cls = `state-${v.state}`;
  return `
  <div id="result" class="result" data-state="${v.state}" aria-live="polite">
    <div class="r-top"><span>Lãi mỗi đơn</span><span id="breakeven">Hòa vốn ở <b>${v.breakevenText}</b></span></div>
    <div class="r-main"><span id="profit" class="profit ${cls}">${v.profitText}</span>
      <span class="state-txt ${cls}"><span id="state-label">${v.stateText}</span> · <span id="margin">${v.marginText}</span></span></div>
    <div id="money-bar" class="money-bar" role="img" aria-label="${bar.map((s) => `${s.label} ${Math.round(s.pct)}%`).join(', ')}">
      ${bar.map((s) => `<span class="bar-seg" data-key="${s.key}" style="width:${s.pct}%"></span>`).join('')}</div>
    <div class="bar-legend">${bar.map((s) => `<span>${s.label} ${Math.round(s.pct)}%</span>`).join('')}</div>
    <div class="r-actions">${c.newShopPromo ? '<span id="promo-note" class="hint" style="flex:1;align-self:center">Đang miễn phí cố định (shop mới)</span>' : ''}<button id="share-result" class="link" data-act="share">${icon('share')} Chia sẻ kết quả</button></div>
  </div>`;
}

function marginView() {
  const c = cur();
  return rateMissing() ? null : C.marginView(presets, engineInput(), ui.amountMode ? { amount: c.targetAmount || 0 } : { m: c.targetM });
}
function marginHead() {
  const c = cur();
  return `
    <div class="top" style="min-height:auto;margin:14px 0 8px"><h2 style="margin:0">Muốn lãi bao nhiêu${ui.amountMode ? ' mỗi đơn' : ' % giá bán'}?</h2>
      <button id="margin-amount-toggle" class="link" data-act="amount-mode">${ui.amountMode ? 'Chọn %' : 'Nhập số tiền'}</button></div>
    ${ui.amountMode ? `<div class="stack">${moneyInput('target-amount', 'targetAmount', 'Lãi mong muốn mỗi đơn')}</div>` : `
      <div class="mchips" role="group" aria-label="% lãi muốn có">${C.MARGIN_CHIPS.map((x) => `<button class="mchip margin-chip" data-m="${x.m}" data-act="pick-margin" aria-pressed="${Math.abs(c.targetM - x.m) < 1e-9}">${x.label}</button>`).join('')}</div>
      <p class="hint" style="margin-top:6px">20% là mức nhiều shop chọn làm chuẩn</p>`}`;
}
function marginResults() {
  const v = marginView();
  if (!v) return '<p class="warn">Nhập % phí ngành để tính giá nên bán.</p>';
  return `
    <div class="price-cards">
      <div class="pcard main"><span class="lbl">Giá nên bán</span><div id="nice-price" class="big">${v.niceText}</div><p id="nice-profit">${v.niceProfitText.replace(' (', '<br><small>(').replace(/\)$/, ')</small>')}</p></div>
      <div class="pcard"><span class="lbl">Hòa vốn</span><div id="breakeven-margin" class="big sm">${v.breakevenText}</div><p>Bán dưới mức này là lỗ</p></div>
    </div>${v.impossible ? '' : flashBlock(v.nicePrice)}`;
}

function flashBlock(fromPrice) {
  const c = cur();
  const m = ui.amountMode ? 0.2 : c.targetM;
  const f = C.flashView(presets, engineInput(), fromPrice, m);
  const locked = St.isLocked('flash_sale', state, config, now());
  if (locked) return `<div class="card section" id="flash-sale"><div class="top" style="min-height:auto;margin:0"><h2 style="margin:0">Flash Sale & giá nhập tối đa</h2><span class="badge">PRO</span></div><p class="hint">Xem lãi khi giảm 10/20/30% và giá nhập tối đa để vẫn giữ lãi.</p>
    <div class="btn-row"><button id="watch-ad" class="btn btn-secondary" data-act="watch-ad" ${config.ads_enabled ? '' : 'hidden'}>Xem quảng cáo để mở</button><button id="flash-pro" class="btn btn-primary" data-act="paywall" data-v="flash_sale">Dùng Pro</button></div></div>`;
  return `
    <div class="card section" id="flash-sale">
      <div class="top" style="min-height:auto;margin:0 0 4px"><h2 style="margin:0">${f.title}</h2><span class="badge">PRO</span></div>
      ${f.rows.map((r) => `<div class="flash-row"><span>${r.label}</span> <strong class="state-${r.state}">${r.profitText} · ${r.stateText}</strong></div>`).join('')}
    </div>
    <div class="card" id="max-cost-card"><strong id="max-cost">${f.maxCostText}</strong><p class="hint" style="margin-top:4px">${f.maxCostNote}</p></div>`;
}

function screenCalc() {
  const c = cur();
  const margin = c.mode === 'margin';
  const pid = ws();
  const fresh = isNew();
  const sub = fresh ? `Thêm vào danh mục để theo dõi lãi · ${shortName(c.platform)}` : pid ? `Sản phẩm đã lưu · ${shortName(c.platform)}${c.categoryRate != null ? ` ${E.formatRate(c.categoryRate)}` : ''}${ui.dirty ? ' · <b>chưa lưu thay đổi</b>' : ''}` : 'Nháp để thử số — không tự lưu';
  const voucherToggle = `<button id="voucher-unit" class="unit-toggle" data-act="voucher-unit" aria-label="Đổi đơn vị mã giảm giá">${c.voucherUnit === 'pct' ? '%' : 'đ'} | ${c.voucherUnit === 'pct' ? 'đ' : '%'}</button>`;
  const voucherField = `<label class="field"><span class="lbl">Mã giảm giá shop</span>
    <span class="input"><input id="voucher" inputmode="numeric" autocomplete="off" data-money="voucherValue" class="money" value="${c.voucherValue ? E.formatMoneyInput(String(c.voucherValue)) : ''}" placeholder="0">${voucherToggle}</span></label>`;
  return `
  <section class="screen">
    ${top({ title: fresh ? 'Sản phẩm mới' : pid ? esc(ui.draftName) : 'Tính nhanh', sub, back: pid ? '#/san-pham' : '', right: pid ? '' : `<button id="platform-chip" class="chip-btn" data-act="platform-sheet">${shortName(c.platform)} ${icon('down')}</button>` })}
    ${pid ? `<label class="field" style="margin-bottom:12px"><span class="lbl">Tên sản phẩm</span><span class="input"><input id="product-name-edit" autocomplete="off" maxlength="40" data-in="draft-name" value="${esc(ui.draftName)}"${fresh ? ' placeholder="Ví dụ: Kẹp tóc ngọc trai"' : ''}></span></label>
      <div style="margin:-2px 0 12px"><button id="platform-chip" class="chip-btn" data-act="platform-sheet">${shortName(c.platform)} ${icon('down')}</button></div>` : ''}
    ${pid ? `<div class="tabs" role="tablist" aria-label="Cách tính">
      <button id="mode-price" role="tab" aria-selected="${!margin}" data-act="mode" data-v="price">Từ giá bán</button>
      <button id="mode-margin" role="tab" aria-selected="${margin}" data-act="mode" data-v="margin">Từ % lãi muốn có</button>
    </div>` : Ad.modeTabs(margin ? 'margin' : 'price')}
    ${pid ? '' : examplesBlock()}
    <div class="stack">
      ${categoryField()}
      <div class="grid2">${moneyInput('cost', 'cost', 'Giá vốn')}${margin ? moneyInput('ship-buyer', 'shipBuyer', 'Ship người mua trả') : moneyInput('price', 'price', 'Giá bán')}</div>
      ${margin ? '' : `<div class="grid2">${voucherField}${moneyInput('ship-buyer', 'shipBuyer', 'Ship người mua trả')}</div>`}
    </div>
    ${otherCostsBlock()}
    ${pid ? channelsCard() : ''}
    ${margin ? `${marginHead()}<div id="margin-zone">${marginResults()}</div>` : `
      <div class="btn-row section"><button id="to-breakdown" class="btn btn-secondary" data-act="nav" data-to="${subRoute('chi-tiet')}" ${c.price > 0 && !rateMissing() ? '' : 'disabled'}>Xem từng khoản phí</button>
        ${fresh ? `<button id="product-create" class="btn btn-primary" data-act="product-create" ${createOk() ? '' : 'disabled'}>Thêm vào danh mục</button>`
          : pid ? `<button id="product-save" class="btn btn-primary" data-act="product-save" ${ui.dirty && c.price > 0 && !rateMissing() ? '' : 'disabled'}>Lưu thay đổi</button>`
          : `<button id="save-product" class="btn btn-primary" data-act="save-sheet" ${c.price > 0 && !rateMissing() ? '' : 'disabled'}>Lưu thành sản phẩm</button>`}</div>
      <div class="row section"><label class="field"><span class="lbl">Mô phỏng: số đơn mỗi tháng</span><span class="input"><input id="orders-month" inputmode="numeric" autocomplete="off" data-in="orders-month" value="${c.ordersPerMonth || ''}" placeholder="ví dụ 300"><span class="unit">đơn</span></span></label></div>
      <p id="monthly-profit" class="state-txt">${monthlyLine()}</p>
      ${pid && !fresh ? `<div class="btn-row section"><button id="product-to-calc" class="btn btn-secondary" data-act="product-to-calc">Thử trong Tính nhanh</button>
        <button id="product-delete" class="btn btn-secondary" style="color:var(--loss)" data-act="product-delete">${ui.deleteArmed ? 'Bấm lần nữa để xoá' : 'Xoá sản phẩm'}</button></div>` : ''}`}
    <p id="fee-date" class="fine">${P.feeDateLabel(presets, c.platform)} · ước tính độc lập, không liên kết với sàn.</p>
  </section>
  ${margin ? `<div class="cta">${applyButton()}</div>` : resultCard()}`;
}

/** F22 — lãi của sản phẩm đang sửa trên mọi sàn đang bán. */
function channelsCard() {
  const plats = St.sellPlatforms(state);
  const own = cur().platform;
  if (!plats.some((p) => p !== own) && !Object.keys(ui.draftChannels ?? {}).length) return '<div id="channels" hidden></div>';
  if (!calcReady()) return '<div id="channels" class="card section"><h2>Lãi trên các sàn bạn bán</h2><p class="hint" style="margin:0">Nhập giá bán và ngành hàng để xem lãi trên từng sàn.</p></div>';
  const rows = C.channelsView(presets, { input: engineInput(), channels: ui.draftChannels ?? {} }, plats, state.lazadaRate);
  const row = (r) => {
    const inner = `<span class="ci-l"><b>${r.label}</b> <small>${r.primary ? 'sàn chính · ' : ''}${esc(r.category.name || 'chưa chọn ngành')}${r.category.rate != null ? ` ${E.formatRate(r.category.rate)}` : ''}${r.suggested ? ' · gợi ý' : ''} · bán ${r.priceText}</small></span>
      <span class="ci-r"> ${r.ready ? `<span class="amt state-${r.state}">${r.profitText}</span> <span class="st state-${r.state}">${r.stateText}</span>` : '<span class="na">cần % phí</span>'}</span>`;
    return r.primary ? `<div class="channel-item" data-platform="${r.platform}">${inner}</div>`
      : `<button class="channel-item" data-platform="${r.platform}" data-act="channel-sheet" data-v="${r.platform}" aria-label="Sửa ngành, % phí, giá trên ${r.label}">${inner}${icon('down')}</button>`;
  };
  return `<div id="channels" class="card section"><h2>Lãi trên các sàn bạn bán</h2>${rows.map(row).join('')}
    <p class="hint" style="margin:8px 0 0">Vốn, đóng gói, chi phí khác dùng chung. Chạm một sàn để sửa ngành, % phí, giá bán trên sàn đó.</p></div>`;
}

function openChannelSheet(p) {
  const input = engineInput();
  const cat = C.channelCategory(presets, input, p, ui.draftChannels?.[p], state.lazadaRate);
  const ch = ui.draftChannels?.[p];
  const price = ch?.price > 0 ? ch.price : input.price;
  const cats = P.categoriesFor(presets, p);
  const pct = (r) => (r != null ? String(Math.round(r * 10000) / 100).replace('.', ',') : '');
  overlay.innerHTML = `
  <div class="scrim" data-act="sheet-bg"><div class="sheet" id="channel-sheet" role="dialog" aria-modal="true" aria-label="Lãi trên ${shortName(p)}">
    <div class="grab"></div><h2>${esc(ui.draftName || 'Sản phẩm')} trên ${shortName(p)}</h2>
    <div class="stack">
      <label class="field"><span class="lbl">Ngành hàng</span><span class="input"><select id="ch-category" data-ch="ch-category">
        ${cats.map((c) => `<option value="${esc(c.name)}" data-rate="${c.rate ?? ''}" ${c.name === cat.name ? 'selected' : ''}>${esc(c.name)}</option>`).join('')}</select></span></label>
      <div class="grid2"><label class="field"><span class="lbl">% phí ngành</span><span class="input rate"><input id="ch-rate" inputmode="decimal" autocomplete="off" value="${pct(cat.rate)}" placeholder="nhập"><span class="unit">%</span></span></label>
      <label class="field"><span class="lbl">Giá bán trên ${shortName(p)}</span><span class="input"><input id="ch-price" inputmode="numeric" autocomplete="off" class="money" data-ch="ch-price" value="${E.formatMoneyInput(String(price))}"><span class="unit">đ</span></span></label></div>
    </div>
    <p class="hint" style="margin:8px 0 14px">${cat.suggested ? 'Đang dùng ngành gợi ý — đổi nếu khác. ' : ''}Vốn, đóng gói, chi phí khác giống sàn chính.</p>
    <button id="ch-save" class="btn btn-primary" data-act="ch-save" data-v="${p}">Lưu cho ${shortName(p)}</button>
  </div></div>`;
}

function monthlyLine() {
  const c = cur();
  if (!calcReady() || !(c.ordersPerMonth > 0)) return '';
  const r = E.calculate(presets, engineInput());
  return `<span class="state-${r.state}">${C.monthlyText(r.profit, c.ordersPerMonth)}</span>`;
}

function examplesBlock() {
  const c = cur();
  if (c.price > 0 || state.examplesDismissed) return '';
  return `<div id="examples" class="card" style="margin-bottom:14px"><h2>Thử nhanh với ví dụ</h2><p class="hint" style="margin:-4px 0 10px">Chạm để điền sẵn, rồi sửa theo hàng của bạn.</p>
    <div class="stack">${QUICK_EXAMPLES.map((e) => `<button class="btn btn-secondary example" data-act="example" data-v="${e.id}" style="justify-content:space-between"><span>${esc(e.name)}</span> <span>${vnd(e.input.price)}</span></button>`).join('')}</div></div>`;
}

function applyButton() {
  const c = cur();
  const v = marginView();
  const ok = v && !v.impossible;
  return `<button id="apply-price" class="btn btn-primary" data-act="apply-price" ${ok ? '' : 'disabled'}>${ok ? `Dùng giá ${v.niceText}` : 'Dùng giá này'}</button>`;
}

/** Cập nhật phần phụ thuộc khi gõ, không vẽ lại cả màn (giữ bàn phím). */
function refreshCalc() {
  const c = cur();
  if (c.mode === 'margin') {
    const mb = $('#margin-zone');
    if (mb) mb.innerHTML = marginResults();
    const cta = $('.cta');
    if (cta) cta.innerHTML = applyButton();
  } else {
    const old = $('#result');
    if (old) {
      const prev = $('#profit')?.textContent;
      old.outerHTML = resultCard();
      const p = $('#profit');
      if (p && prev && prev !== p.textContent) { p.classList.add('bump'); }
    }
    const tb = $('#to-breakdown');
    if (tb) tb.disabled = !(c.price > 0) || rateMissing();
    const sp = $('#save-product');
    if (sp) sp.disabled = !(c.price > 0) || rateMissing();
    const pc = $('#product-create');
    if (pc) pc.disabled = !createOk();
    const ps = $('#product-save');
    if (ps) ps.disabled = !ui.dirty || !(c.price > 0) || rateMissing();
    const mp = $('#monthly-profit');
    if (mp) mp.innerHTML = monthlyLine();
    const chs = $('#channels');
    if (chs) chs.outerHTML = channelsCard();
  }
  noteCalcInput();
  const oc = $('#other-costs span');
  if (oc) oc.textContent = `Chi phí khác: đóng gói ${vnd(c.pack || 0)}`;
}

// ---------------------------------------------------------------- S3 · Chi tiết phí
function screenBreakdown() {
  const c = cur();
  if (!(c.price > 0) || rateMissing()) { location.replace(homeRoute()); return ''; }
  const input = engineInput();
  const v = C.breakdownView(presets, input);
  const cat = c.categoryName ? ` · ${esc(c.categoryName)}` : '';
  const progs = P.programsFor(presets, c.platform);
  const max = c.price;
  const row = (r) => `
    <div class="fee-line" data-key="${r.key}">
      <div class="fl-top"><span class="fl-name">${esc(r.label)}${r.rateText ? `<span class="rate">${r.rateText}</span>` : ''}
        ${r.source || r.basis ? `<button class="fee-info" data-act="fee-info" data-v="${r.key}" aria-expanded="${ui.openInfo.has(r.key)}" aria-label="Cách tính ${esc(r.label)}">${icon('info')}</button>` : ''}</span>
        <span class="fl-amt">${r.amountText}</span></div>
      ${ui.openInfo.has(r.key) ? `<p class="fee-basis">${esc(r.basis)}.${r.source ? ` Nguồn: ${esc(r.source)}` : ''}${r.effective ? `, áp dụng từ ${r.effective}` : ''}.</p>` : ''}
      <div class="fl-bar" style="width:${Math.min(100, (r.amount / max) * 100)}%"></div>
    </div>`;
  return `
  <section class="screen">
    ${top({ title: v.title, back: homeRoute() })}
    <p class="lead">${ws() ? `${esc(ui.draftName)} · ` : ''}${shortName(c.platform)}${cat}. <b id="take-rate">${v.takeRateText}</b>. Chạm (i) để xem cách tính.</p>
    ${v.verifiedNote ? `<p class="banner">${v.verifiedNote}</p>` : ''}
    <div class="card" id="fee-lines">
      <div class="fee-line head"><div class="fl-top"><strong>Giá bán</strong><strong>${vnd(c.price)}</strong></div><div class="fl-bar" style="width:100%"></div></div>
      ${v.rows.map(row).join('')}
      <div class="fee-line total"><div class="fl-top"><span id="remaining">${v.remainingText}</span></div></div>
    </div>
    <div class="card"><h2>Chương trình và thuế</h2>
      ${progs.map((p) => `<label class="toggle-row"><span class="t">${esc(p.name)}<small>${p.rate != null ? `${E.formatRate(p.rate)}${p.cap ? `, tối đa ${vnd(p.cap)}` : ''}` : `${vnd(p.amount)}/đơn`}</small></span>
        <input type="checkbox" id="prog-${p.id}" data-ch="program" data-v="${p.id}" ${c.programs.includes(p.id) ? 'checked' : ''}></label>`).join('')}
      <label class="toggle-row"><span class="t">Sàn khấu trừ thuế GTGT 1%<small>NĐ 117/2025</small></span><input type="checkbox" id="tax-vat" data-ch="tax" data-v="vat" ${c.vat ? 'checked' : ''}></label>
      <label class="toggle-row"><span class="t">Sàn khấu trừ thuế TNCN 0,5%<small>NĐ 117/2025</small></span><input type="checkbox" id="tax-pit" data-ch="tax" data-v="pit" ${c.pit ? 'checked' : ''}></label>
      ${c.platform === 'tiktok_shop' ? `<label class="toggle-row"><span class="t">Shop đã đăng ký và xác minh MST<small>Phí chia 1,1 (chỉ trả phần chưa thuế)</small></span><input type="checkbox" id="registered" data-ch="registered" ${c.registered ? 'checked' : ''}></label>` : ''}
    </div>
    <div class="card"><h2>Sửa phí nếu đơn của bạn khác</h2>
      <div class="grid2">
        <label class="field"><span class="lbl">% phí ngành</span><span class="input"><input id="rate-category" inputmode="decimal" data-ch="override" data-v="category" value="${String(Math.round((c.categoryRate ?? 0) * 10000) / 100).replace('.', ',')}"><span class="unit">%</span></span></label>
        <label class="field"><span class="lbl">% xử lý giao dịch</span><span class="input"><input id="rate-transaction" inputmode="decimal" data-ch="override" data-v="transaction" value="${String(Math.round((c.transactionOverride ?? presets.platforms[c.platform].transaction_fee.rate) * 10000) / 100).replace('.', ',')}"><span class="unit">%</span></span></label>
      </div>
      <label class="field" style="margin-top:10px"><span class="lbl">Phí cố định mỗi đơn</span><span class="input"><input id="fixed-per-order" class="money" inputmode="numeric" data-ch="override" data-v="fixed" value="${E.formatMoneyInput(String(Math.round(c.fixedOverride ?? E.fixedPerOrder(presets.platforms[c.platform]))))}"><span class="unit">đ</span></span></label>
      <div class="btn-row section"><button id="report-fee" class="btn btn-secondary" data-act="report-fee">Báo sai phí</button><button class="btn btn-secondary" data-act="reset-fees">Về biểu phí gốc</button></div>
    </div>
    <p class="fine">${P.feeDateLabel(presets, c.platform)}. ${P.DISCLAIMER}</p>
  </section>`;
}

// ---------------------------------------------------------------- S5 · So sánh sàn
const calcReady = () => cur().price > 0 && !rateMissing();
const productLine = (c = cur()) => `${ws() ? `${esc(ui.draftName)} · ` : ''}giá bán ${vnd(c.price)} · giá vốn ${vnd(c.cost)}${c.pack ? ` · gói ${vnd(c.pack)}` : ''}`;
const needCalc = (title) => `<section class="screen">${top({ title })}<div class="empty"><p>Nhập giá vốn và giá bán ở màn <b>Tính lãi</b> trước.</p>
  <button class="btn btn-primary" data-act="nav" data-to="#/tinh">Mở Tính lãi</button></div></section>`;

function compareData() {
  return C.compareView(presets, engineInput(), { tiktok: state.compare.tiktok, shopee: state.compare.shopee, lazadaRate: state.lazadaRate, orders: state.compareOrders });
}
function screenCompare() {
  if (!calcReady()) return needCalc('Bán ở sàn nào lãi hơn?');
  const v = compareData();
  const card = (c) => {
    if (!c.ready) {
      return `<div class="card compare-card dashed-card" data-platform="${c.platform}"><h2>${c.label}</h2>
        <div class="row"><p class="hint" style="flex:1">Nhập % hoa hồng ngành của bạn</p>
        <span class="input rate"><input id="${c.platform === 'lazada' ? 'lazada-rate' : `rate-${c.platform}`}" inputmode="decimal" data-ch="cmp-rate" data-v="${c.platform}" placeholder="0"><span class="unit">%</span></span></div></div>`;
    }
    const tiktokPick = c.platform === 'tiktok_shop' && cur().platform !== 'tiktok_shop'
      ? `<label class="field" style="margin-top:8px"><span class="lbl">Nhóm ngành TikTok ${c.category.suggested ? '(gợi ý — đổi nếu khác)' : ''}</span><span class="input"><select id="cmp-tiktok-category" data-ch="cmp-tiktok">
          ${P.categoriesFor(presets, 'tiktok_shop').filter((x) => x.rate != null).map((x) => `<option value="${esc(x.name)}" ${x.name === c.category.name ? 'selected' : ''}>${esc(x.name)} · ${E.formatRate(x.rate)}</option>`).join('')}</select><span class="unit">${icon('down')}</span></span></label>` : '';
    const lz = c.platform === 'lazada' ? `<p class="hint">Hoa hồng ${E.formatRate(c.category.rate)} do bạn nhập · <button class="link" data-act="cmp-lazada-reset">Sửa</button></p>` : '';
    return `<div class="card compare-card" data-platform="${c.platform}">
      <div class="cmp-head"><h2 style="margin:0">${c.label}</h2><span class="hint cmp-diff">${c.diffText}</span></div>
      <div class="cmp-profit"><span class="state-${c.state}">${c.profitText}</span> <span class="state-txt state-${c.state}">${c.stateText}</span></div>
      <div class="cmp-lines">${c.lines.map(([l, a]) => `<span>${l}</span><span>${a}</span>`).join('')}</div>${tiktokPick}${lz}</div>`;
  };
  return `
  <section class="screen">
    ${top({ title: 'Bán ở sàn nào lãi hơn?', sub: productLine() })}
    ${v.cards.map(card).join('')}
    <div class="row section"><label class="field"><span class="lbl">Số đơn mỗi tháng</span><span class="input"><input id="compare-orders" inputmode="numeric" data-in="compare-orders" value="${state.compareOrders || ''}"><span class="unit">đơn</span></span></label></div>
    <p id="compare-monthly" style="font-weight:700;margin:10px 0 0">${v.monthlyText}</p>
    <p class="fine">${v.tiktokNote}</p>
    <p class="fine">${P.feeDateLabel(presets, cur().platform)} · ${P.DISCLAIMER}</p>
  </section>`;
}

// ---------------------------------------------------------------- S6 · Chi phí ẩn
function screenHidden() {
  if (!calcReady()) return needCalc('Chi phí ẩn');
  const c = cur();
  const v = C.hiddenCostsView(presets, engineInput());
  const vprog = P.programsFor(presets, c.platform).find((p) => p.id === 'voucher_xtra' || p.id === 'vxp');
  const vis = P.programsFor(presets, c.platform).find((p) => p.id === 'visibility');
  return `
  <section class="screen">
    ${top({ title: 'Chi phí ẩn', back: homeRoute(), sub: `${productLine()} · ${shortName(c.platform)} ${E.formatRate(c.categoryRate)}` })}
    <div class="big-card" data-state="${v.state}" aria-live="polite">
      <span class="lbl">Lãi thật mỗi đơn</span>
      <div><span id="hc-profit" class="profit state-${v.state}">${v.profitText}</span> <span id="hc-state" class="state-txt state-${v.state}">${v.stateText}</span></div>
      <p id="hc-diff" style="margin:6px 0 0">${v.diffText}</p>
      <p class="hint" id="hc-base">Chỉ tính phí sàn: ${v.baseText}</p>
    </div>
    <div class="card section">
      <label class="toggle-row"><span class="t"><b>Hoàn hàng</b><small>Tỉ lệ đơn hoàn và tiền mất mỗi đơn hoàn</small></span><input type="checkbox" id="hc-return" data-ch="hc" data-v="returnOn" ${c.returnOn ? 'checked' : ''}></label>
      ${c.returnOn ? `<div class="grid2" style="padding-bottom:10px">
        <label class="field"><span class="lbl">Tỉ lệ hoàn</span><span class="input"><input id="return-rate" inputmode="decimal" data-ch="hc-rate" data-v="returnRate" value="${c.returnRate ? String(Math.round(c.returnRate * 1000) / 10).replace('.', ',') : ''}" placeholder="0"><span class="unit">%</span></span></label>
        ${moneyInput('loss-per-return', 'lossPerReturn', 'Mất mỗi đơn hoàn')}</div><p class="hint" id="hc-return-step" style="padding-bottom:8px">${v.returnStep}</p>` : ''}
      ${vprog ? `<label class="toggle-row"><span class="t"><b>${esc(vprog.name)}</b><small>${E.formatRate(vprog.rate)}, tối đa ${vnd(vprog.cap)} mỗi sản phẩm</small></span><input type="checkbox" id="hc-voucher" data-ch="program" data-v="${vprog.id}" ${c.programs.includes(vprog.id) ? 'checked' : ''}></label>
        ${c.programs.includes(vprog.id) ? `<p class="hint" id="hc-voucher-step" style="padding-bottom:8px">${v.voucherStep}</p>` : ''}` : ''}
      ${vis ? `<label class="toggle-row"><span class="t"><b>Phí dịch vụ hiển thị</b><small>${E.formatRate(vis.rate)} doanh thu đơn, có shop bị trừ</small></span><input type="checkbox" id="hc-visibility" data-ch="program" data-v="visibility" ${c.programs.includes('visibility') ? 'checked' : ''}></label>` : ''}
      <label class="toggle-row"><span class="t"><b>Quảng cáo</b><small>Nhập ROAS để trừ chi phí ads</small></span><input type="checkbox" id="hc-ads" data-ch="hc" data-v="adsOn" ${c.adsOn ? 'checked' : ''}></label>
      ${c.adsOn ? `<label class="field" style="padding-bottom:10px"><span class="lbl">ROAS (doanh thu ÷ tiền ads)</span><span class="input"><input id="roas" inputmode="decimal" data-ch="hc-num" data-v="roas" value="${c.roas ? String(c.roas).replace('.', ',') : ''}" placeholder="ví dụ 8"></span></label>` : ''}
      <label class="field" style="padding:10px 0 4px"><span class="lbl">Hoa hồng affiliate (KOC)</span><span class="input"><input id="affiliate-rate" inputmode="decimal" data-ch="hc-rate" data-v="affiliateRate" value="${c.affiliateRate ? String(Math.round(c.affiliateRate * 1000) / 10).replace('.', ',') : ''}" placeholder="0"><span class="unit">%</span></span></label>
    </div>
    <div class="card" style="display:flex;gap:12px;align-items:flex-start">${icon('target')}<div>
      <strong>ROAS hòa vốn: <span id="roas-breakeven">${v.roasText}</span> · tối đa <span id="max-ads">${v.maxAdsText}/đơn</span> ads</strong>
      <p class="hint" style="margin-top:4px">Chạy quảng cáo mà doanh thu dưới ${v.roasText} lần tiền ads là lỗ.</p></div></div>
  </section>
  <div class="cta"><button id="hc-apply" class="btn btn-primary" data-act="hc-apply">Áp dụng vào Tính lãi</button></div>`;
}

// ---------------------------------------------------------------- S7 · Danh mục
function screenCatalog() {
  const filter = ui.catalogFilter ?? 'all';
  const v = C.catalogView(presets, state.products, filter, catOpts());
  const all = C.catalogView(presets, state.products, 'all', catOpts());
  const limit = config.free_catalog_limit;
  const alert = state.feeAlert && !state.feeAlert.dismissed ? state.feeAlert : null;
  const bulk = !!ui.bulk;
  const inner = (i) => `
      <span><strong>${esc(i.name)}${i.sample ? ' <span class="badge">mẫu</span>' : ''}</strong> <span class="m">${i.meta}${i.suggestedText ? ` → gợi ý <b class="suggested">${i.suggestedText}</b>` : ''}</span></span>
      <span class="r"><span class="amt state-${i.state}">${i.profitText}</span> <span class="st state-${i.state}">${i.stateText}</span></span>`;
  const chRow = (c) => `<span class="channel-row" data-platform="${c.platform}"><span class="cn">${c.label}</span> ${c.ready
    ? `<span class="amt state-${c.state}">${c.profitText}</span> <span class="st state-${c.state}">${c.stateText}</span>`
    : '<span class="na">cần % phí</span><span></span>'}</span>`;
  const multiInner = (i) => `
      <span class="pc-head"><strong>${esc(i.name)}${i.sample ? ' <span class="badge">mẫu</span>' : ''}</strong> <span class="m">bán ${vnd(i.input.price)}${i.suggestedText ? ` → gợi ý <b class="suggested">${i.suggestedText}</b>` : ''}</span></span>
      <span class="channels">${i.channels.map(chRow).join('')}</span>`;
  const bulkRow = (c) => `<span class="channel-row bulk-row" data-platform="${c.platform}"><span class="cn">${c.label}</span> <span class="pr">${c.ready ? c.priceText : ''}</span> ${hasSug(c)
    ? `<b class="suggested">→ ${c.sugText}</b>` : `<span class="na">${c.ready ? 'giữ giá' : 'cần % phí'}</span>`}</span>`;
  const bulkMulti = (i) => `<label class="product-card multi" data-id="${i.id}"><span class="pc-head pc-check"><input type="checkbox" class="bulk-check" data-ch="bulk-check" data-v="${i.id}" ${ui.bulk.has(i.id) ? 'checked' : ''} ${bulkEligible(i) ? '' : 'disabled'} aria-label="Chọn ${esc(i.name)}">
      <span><strong>${esc(i.name)}${i.sample ? ' <span class="badge">mẫu</span>' : ''}</strong></span></span>
      <span class="channels">${i.channels.filter((c) => applyOn().has(c.platform)).map(bulkRow).join('')}</span></label>`;
  const card = (i) => (bulk && multiSell() ? bulkMulti(i) : !bulk && i.channels.length > 1
    ? `<button class="product-card multi" data-id="${i.id}" data-act="open-product" data-v="${i.id}">${multiInner(i)}</button>`
    : bulk
    ? `<label class="product-card" data-id="${i.id}"><input type="checkbox" class="bulk-check" data-ch="bulk-check" data-v="${i.id}" ${ui.bulk.has(i.id) ? 'checked' : ''} ${i.suggested ? '' : 'disabled'} aria-label="Chọn ${esc(i.name)}">${inner(i)}</label>`
    : `<button class="product-card" data-id="${i.id}" data-act="open-product" data-v="${i.id}">${inner(i)}</button>`);
  const sale = Sale.nextSale(today());
  const saleDue = state.saleReminders && Sale.saleReminderDue(sale);
  return `
  <section class="screen">
    ${top({ title: 'Sản phẩm của bạn', right: `<span id="catalog-count" class="hint">${pro() ? `${state.products.length} · Pro` : config.pro_gates_enabled ? `${state.products.length}/${limit} miễn phí` : `${state.products.length}/${limit} miễn phí`}</span>` })}
    ${saleDue ? `<div id="sale-banner" class="banner" role="status">${icon('bell')} ${Sale.saleBannerText(sale)}</div>` : ''}
    ${alert ? `<div id="fee-alert" class="alert" role="status">${icon('alert')}<strong>${esc(alert.text.split(' · ')[0])}</strong><p>${esc(alert.text.split(' · ').slice(1).join(' · '))}</p>
      ${alert.turnedLoss.length ? `<button id="fee-alert-action" class="btn btn-primary" data-act="fee-alert-open">${!config.pro_gates_enabled || pro() ? `Xem giá đề xuất cho ${alert.turnedLoss.length} sản phẩm` : `Xem ${alert.turnedLoss.length} sản phẩm chuyển lỗ · Pro`}</button>` : ''}
      <button class="link" data-act="fee-alert-dismiss">Đã xem</button></div>` : ''}
    ${state.products.length ? `
      ${bulk ? '' : `<div class="btn-row add-row"><button id="add-product" class="btn btn-secondary add-product" data-act="nav" data-to="#/san-pham/moi">${icon('plus')} Thêm sản phẩm</button>${state.products.length >= 2 ? `<button id="make-combo" class="btn btn-secondary" data-act="make-combo">${icon('layers')} Tạo combo</button>` : '<span></span>'}</div>`}
      <div class="pills" role="group" aria-label="Lọc">
        <button id="filter-all" class="pill" data-act="filter" data-v="all" aria-pressed="${filter === 'all'}">Tất cả</button>
        <button id="filter-loss" class="pill" data-act="filter" data-v="loss" aria-pressed="${filter === 'loss'}">Đang lỗ · ${all.lossCount}</button>
        <button id="filter-thin" class="pill" data-act="filter" data-v="thin" aria-pressed="${filter === 'thin'}">Lãi mỏng · ${all.thinCount}</button>
        ${Array.isArray(filter) ? '<button id="filter-alert" class="pill" aria-pressed="true" data-act="filter" data-v="all">Vừa chuyển lỗ ✕</button>' : ''}
        <button id="bulk-mode" class="pill" data-act="bulk-mode" aria-pressed="${bulk}">${bulk ? 'Huỷ chọn' : 'Áp giá gợi ý'}</button>
      </div>
      ${bulk ? '<p class="hint">Chọn sản phẩm để đổi sang giá gợi ý (giữ lãi 20%, giá đẹp). Sản phẩm đang lỗ được chọn sẵn.</p>' : ''}
      ${bulk && multiSell() ? `<div id="apply-on" class="pills" role="group" aria-label="Áp cho sàn"><span class="pills-lbl">Áp cho sàn:</span>${St.sellPlatforms(state).map((p) => `<button id="apply-on-${p}" class="pill" data-act="apply-on" data-v="${p}" aria-pressed="${applyOn().has(p)}">${shortName(p)}</button>`).join('')}</div>` : ''}
      <div id="product-list">${v.items.map(card).join('') || '<p class="hint">Không có sản phẩm nào ở nhóm này.</p>'}</div>
      ${bulk ? '' : Ad.catalogCombos(filter)}
      ${ui.undo && ui.undo.until > Date.now() ? `<div id="undo-bar" class="banner" style="display:flex;justify-content:space-between;align-items:center;margin-top:12px"><span>Đã đổi giá ${ui.undo.count} sản phẩm</span><button id="undo-apply" class="link" data-act="undo-apply">Hoàn tác</button></div>` : ''}
      ${adSlot('catalog')}
      <p class="fine">Sắp theo lãi thấp nhất lên đầu. Giá gợi ý giữ lãi 20%, làm tròn giá đẹp. Khi sàn đổi biểu phí, app tính lại mọi sản phẩm và gửi một thông báo.</p>` : `
      <div id="catalog-empty" class="empty"><h2>Chưa có sản phẩm nào</h2><p>Thêm sản phẩm để biết lãi từng món và được báo khi sàn đổi phí.</p>
        <div class="stack"><button id="add-product" class="btn btn-primary" data-act="nav" data-to="#/san-pham/moi">${icon('plus')} Thêm sản phẩm đầu tiên</button>
        <button id="load-examples" class="btn btn-secondary" data-act="load-examples">Thêm ${EXAMPLES.length} sản phẩm mẫu</button></div></div>`}
    ${config.pro_gates_enabled ? '' : `<p class="fine">Bản thử nghiệm: giới hạn ${limit} sản phẩm của gói miễn phí chưa áp dụng.</p>`}
  </section>
  ${bulk ? `<div class="cta"><button id="apply-suggested" class="btn btn-primary" data-act="apply-suggested" ${ui.bulk.size ? '' : 'disabled'}>Áp giá gợi ý cho ${ui.bulk.size} sản phẩm</button></div>` : ''}`;
}

// ---------------------------------------------------------------- Cài đặt
function screenSettings() {
  const notifs = state.notifications;
  return `
  <section class="screen">
    ${top({ title: 'Cài đặt' })}
    ${proCard()}
    <div class="card">
      <div class="settings-row"><span><b>Sàn chính</b><br><span class="hint">${state.platform === 'multi' ? 'Nhiều sàn' : shortName(state.platform)}</span></span>
        <button id="change-platform" class="btn btn-secondary" style="width:auto" data-act="nav" data-to="#/chon-san">Đổi</button></div>
    </div>
    <div class="card" id="sell-card"><h2>Sàn bạn bán</h2>
      <p class="hint" style="margin:-4px 0 10px">Danh mục hiện lãi của mỗi sản phẩm trên các sàn này.</p>
      <div class="pills" role="group" aria-label="Sàn bạn bán">${P.PLATFORMS.map((p) => `<button id="sell-${p}" class="pill" data-act="sell-toggle" data-v="${p}" aria-pressed="${St.sellPlatforms(state).includes(p)}">${shortName(p)}</button>`).join('')}</div>
    </div>
    <div class="card"><h2>Biểu phí</h2>
      <p id="fee-version" style="margin:0">Phiên bản ${presets.fee_version} · cập nhật ${P.vnDate(presets.as_of)}</p>
      <p class="hint">App kiểm tra biểu phí mới khi mở và mỗi ${config.fee_check_interval_hours} giờ; chạy được khi mất mạng bằng bản đã lưu.</p>
      <button id="check-fees" class="btn btn-secondary section" data-act="check-fees">Kiểm tra biểu phí mới</button>
    </div>
    ${adSlot('fees')}
    <div class="card"><h2>Thông báo</h2>
      <label class="toggle-row"><span class="t">Báo động khi sàn đổi phí<small>Báo sản phẩm nào chuyển sang lỗ</small></span><input type="checkbox" id="alerts-toggle" data-ch="alerts" ${state.alertsOn ? 'checked' : ''}></label>
      <div id="notif-inbox">${notifs.length ? notifs.map((n) => `<div class="notif">${esc(n.text)}<time>${new Date(n.at).toLocaleString('vi-VN')}</time></div>`).join('') : '<p class="hint">Chưa có thông báo.</p>'}</div>
    </div>
    <div class="card"><h2>Mùa sale</h2>
      <label class="toggle-row"><span class="t">Nhắc trước ngày sale lớn<small id="next-sale">${Sale.saleLine(Sale.nextSale(today()))}</small></span><input type="checkbox" id="sale-reminders" data-ch="sale-reminders" ${state.saleReminders ? 'checked' : ''}></label>
      <p class="hint">Nhắc khi còn 3 ngày để kiểm tra giá Flash Sale. Lịch: các ngày trùng số 1.1 … 12.12.</p>
    </div>
    ${P.newShopPromoInfo(presets, state.calc.platform) ? `<div class="card"><h2>Shop mới</h2>
      <label class="toggle-row"><span class="t">Đang được miễn phí cố định<small>${esc(P.newShopPromoInfo(presets, state.calc.platform).text)}</small></span><input type="checkbox" id="new-shop" data-ch="new-shop" ${state.calc.newShopPromo ? 'checked' : ''}></label></div>` : ''}
    <div class="card"><h2>Quyền riêng tư</h2>
      ${config.ads_enabled && !pro() ? `<div class="settings-row"><span><b>Quảng cáo</b><br><span class="hint">${state.adConsent === 'personalized' ? 'Cá nhân hoá' : state.adConsent === 'npa' ? 'Không cá nhân hoá' : 'Chưa chọn'}</span></span><button id="ad-consent-change" class="btn btn-secondary" style="width:auto" data-act="ad-consent-change">Đổi</button></div>` : ''}
      <a id="privacy-link" class="link" href="privacy.html" style="display:inline-flex;align-items:center">Chính sách quyền riêng tư</a>
    </div>
    <p class="fine">${P.DISCLAIMER} Dữ liệu chỉ lưu trên máy bạn; không đăng nhập, không kết nối tài khoản sàn.</p>
  </section>`;
}

// ---------------------------------------------------------------- F24 Lãi Thật Pro
function proCard() {
  const sub = state.sub;
  const d = (t) => new Date(t).toLocaleDateString('vi-VN');
  if (pro()) {
    const status = sub?.status === 'trial'
      ? `Đang dùng thử · hết hạn ${d(sub.trialEndsAt)}${sub.cancelled ? ' · đã huỷ, không gia hạn' : ` · sau đó ${vnd(config.pro_prices.monthly)}/tháng`}`
      : sub ? `${sub.plan === 'yearly' ? 'Gói năm' : 'Gói tháng'} · ${sub.cancelled ? `đã huỷ, dùng tới ${d(sub.renewsAt)}` : `tự gia hạn ${d(sub.renewsAt)}`}` : 'Đang dùng Pro';
    return `<div class="card pro-card" id="pro-card"><div class="top" style="min-height:auto;margin:0 0 4px"><h2 style="margin:0">Lãi Thật Pro</h2><span class="badge badge-good">PRO</span></div>
      <p id="pro-status" style="margin:0">${status}</p>
      <p class="hint">Quản lý hoặc huỷ trong Google Play › Thanh toán và gói đăng ký.</p>
      ${sub && !sub.cancelled ? '<button id="pro-cancel" class="btn btn-secondary" data-act="pro-cancel">Huỷ gói (chế độ thử)</button>' : ''}</div>`;
  }
  return `<div class="card pro-card" id="pro-card"><div class="top" style="min-height:auto;margin:0 0 4px"><h2 style="margin:0">Lãi Thật Pro</h2><span class="badge">PRO</span></div>
    <p class="hint" style="margin:0 0 12px">Danh mục không giới hạn, báo động từng sản phẩm, Flash Sale, giá nhập tối đa, không quảng cáo. Dùng thử ${config.pro_prices.trial_days} ngày.</p>
    <button id="pro-open" class="btn btn-good" data-act="paywall" data-v="settings">Xem gói Pro</button></div>`;
}

function openPaywall(trigger) {
  ui.paywallTrigger = trigger;
  ui.plan = 'monthly';
  track('paywall_view', { trigger });
  drawPaywall();
  billing().then((b) => { ui.billingMode = b.mode; const t = $('#pw-test'); if (t) t.hidden = b.mode === 'play'; });
}
function drawPaywall() {
  const c = Pro.paywallCopy(ui.paywallTrigger, config.pro_prices);
  const plan = c.plans.find((p) => p.id === ui.plan);
  overlay.innerHTML = `
  <div class="scrim" data-act="sheet-bg"><div class="sheet paywall" id="paywall" role="dialog" aria-modal="true" aria-label="${esc(c.title)}">
    <div class="pw-head"><span class="badge badge-good">LÃI THẬT PRO</span><button id="paywall-close" class="icon-btn" data-act="paywall-close" aria-label="Đóng">${icon('x')}</button></div>
    <h2 id="paywall-title">${esc(c.title)}</h2><p class="hint">${esc(c.lead)}</p>
    <ul class="pw-benefits">${c.benefits.map((b) => `<li>${icon('check')} <span>${esc(b)}</span></li>`).join('')}</ul>
    <div class="pw-plans" role="radiogroup" aria-label="Chọn gói">${c.plans.map((p) => `<button id="plan-${p.id}" class="pw-plan" role="radio" aria-checked="${ui.plan === p.id}" data-act="plan" data-v="${p.id}"><span class="pl"><b>${p.label}</b> <small>${p.note}</small></span> <strong>${p.priceText}</strong></button>`).join('')}</div>
    <button id="buy" class="btn btn-good" data-act="buy">${plan.cta}</button>
    <p class="fine" id="pw-terms">${esc(c.terms)}</p>
    <p class="fine pw-test" id="pw-test" ${ui.billingMode === 'play' ? 'hidden' : ''}>Chế độ thử: không trừ tiền thật. Bản trên Google Play thanh toán qua Google Play.</p>
    <div class="pw-foot"><button id="restore" class="link" data-act="restore">${c.restore}</button></div>
    <p class="fine">${esc(c.disclaimer)}</p>
  </div></div>`;
}
function checkSubscription() {
  const t = now();
  const settled = St.settleSubscription(state, t, config.pro_prices);
  const r = St.trialReminder(settled, t, config.pro_prices);
  if (settled !== state || r.text) set(r.state);
  if (r.text && 'Notification' in window && Notification.permission === 'granted') {
    try { new Notification('Lãi Thật', { body: r.text, icon: 'icon.svg' }); } catch { /* không hỗ trợ */ }
  }
}

// ---------------------------------------------------------------- F25 quảng cáo
/** Khe quảng cáo ở Danh mục / Biểu phí: hỏi đồng ý (lần đầu) hoặc banner thử. Không dùng ở màn Tính lãi. */
function adSlot(placement) {
  if (Ads.consentNeeded(state, config, now())) {
    return `<div class="card ad-consent" id="ad-consent"><h2>Quảng cáo giúp Lãi Thật miễn phí</h2>
      <p class="hint" style="margin:-4px 0 12px">Cho phép quảng cáo cá nhân hoá theo sở thích? Không đồng ý thì vẫn có quảng cáo nhưng không cá nhân hoá. Đổi lại ở Cài đặt › Quyền riêng tư.</p>
      <div class="btn-row"><button id="consent-no" class="btn btn-secondary" data-act="consent" data-v="npa">Không cá nhân hoá</button><button id="consent-yes" class="btn btn-primary" data-act="consent" data-v="personalized">Đồng ý</button></div></div>`;
  }
  if (nAds || !Ads.adsActive(state, config, now()) || Ads.bannerPlacement(location.hash) !== placement) return '';
  return `<aside class="ad-banner" data-placement="${placement}" aria-label="Quảng cáo"><span class="ad-tag">Quảng cáo thử</span><span class="ad-body">Banner thích ứng · ${placement === 'catalog' ? 'Danh mục' : 'Biểu phí'}</span></aside>`;
}
function adLayer() {
  let el = $('#ad-layer');
  if (!el) { el = document.createElement('div'); el.id = 'ad-layer'; document.body.appendChild(el); }
  return el;
}
function closeAdLayer() { const el = $('#ad-layer'); if (el) el.innerHTML = ''; }
function maybeInterstitial() {
  if (!Ads.adsActive(state, config, now())) return;
  const t = Date.now();
  const since = Math.max(state.lastInterstitialAt || 0, ui.sessionStart ?? 0);
  const calcsSince = state.events.filter((e) => e.name === 'calc_completed' && e.at > since).length;
  if (!Ads.interstitialDue({ sessions: state.sessions ?? 0, calcsSince, lastAt: state.lastInterstitialAt, now: t, to: location.hash }, config)) return;
  set({ ...state, lastInterstitialAt: t });
  track('ad_impression', { format: 'interstitial', placement: 'tab_switch' });
  if (nAds) { nAds.interstitial({ npa: npa() }); return; }
  const secs = config.interstitial_close_seconds ?? 3;
  adLayer().innerHTML = `<div class="ad-full" id="interstitial" role="dialog" aria-modal="true" aria-label="Quảng cáo"><span class="ad-tag">Quảng cáo thử</span>
    <div class="ad-full-body"><b>Quảng cáo toàn màn hình</b><p>Bản Android hiện quảng cáo AdMob ở đây.</p></div>
    <button id="interstitial-close" class="btn btn-secondary" data-act="interstitial-close" disabled>Đóng sau ${secs} giây</button></div>`;
  countdown('#interstitial-close', secs, (b) => { b.disabled = false; b.textContent = 'Đóng'; });
}
function countdown(sel, secs, done) {
  let left = secs;
  const tick = () => {
    const b = $(sel);
    if (!b) return;
    if (left <= 0) { done(b); return; }
    b.textContent = b.textContent.replace(/\d+(?:,\d+)? giây/, `${String(left).replace('.', ',')} giây`);
    left = Math.round((left - Math.min(1, left)) * 10) / 10;
    setTimeout(tick, Math.min(1, secs) * 1000);
  };
  tick();
}

function openSaveSheet() {
  const c = cur();
  overlay.innerHTML = `
  <div class="scrim" data-act="sheet-bg"><div class="sheet" role="dialog" aria-modal="true" aria-label="Lưu sản phẩm">
    <div class="grab"></div><h2>Lưu thành sản phẩm mới</h2>
    <label class="field"><span class="lbl">Tên sản phẩm</span><span class="input"><input id="product-name" autocomplete="off" maxlength="40" value="" placeholder="Ví dụ: Móc khóa"></span></label>
    <p class="hint" style="margin:8px 0 14px">Lưu đủ giá, ngành và chi phí để tính lại khi sàn đổi phí.</p>
    <button id="save-confirm" class="btn btn-primary" data-act="save-confirm">Lưu</button>
  </div></div>`;
  setTimeout(() => $('#product-name')?.focus(), 50);
}

// ---------------------------------------------------------------- sheet chọn sàn
function openPlatformSheet() {
  const c = cur();
  overlay.innerHTML = `
  <div class="scrim" data-act="sheet-bg"><div class="sheet" role="dialog" aria-modal="true" aria-label="Chọn sàn">
    <div class="grab"></div><h2>Tính cho sàn nào?</h2>
    <div role="radiogroup">${P.PLATFORMS.map((p) => `<button id="sheet-${p}" class="option" role="radio" aria-checked="${c.platform === p}" data-act="sheet-platform" data-v="${p}"><span class="dot"></span><span><strong>${shortName(p)}</strong><span class="n">${P.feeDateLabel(presets, p)}</span></span></button>`).join('')}</div>
    <button id="sheet-done" class="btn btn-primary" data-act="sheet-close">Xong</button>
  </div></div>`;
}
const closeOverlay = () => { overlay.innerHTML = ''; };

let toastTimer;
function toast(msg) {
  $('#toast')?.remove();
  const t = document.createElement('div');
  t.id = 'toast'; t.className = 'toast'; t.setAttribute('role', 'status'); t.textContent = msg;
  document.body.appendChild(t);
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => t.remove(), 2800);
}

// ---------------------------------------------------------------- thanh phím 000
let keybar;
function showKeybar(input) {
  if (!keybar) {
    keybar = document.createElement('div');
    keybar.className = 'keybar';
    keybar.id = 'keybar';
    keybar.innerHTML = '<button type="button" id="key-000" data-key="000">000</button><button type="button" id="key-done" data-key="done">Xong</button>';
    keybar.addEventListener('pointerdown', (e) => e.preventDefault());
    keybar.addEventListener('click', (e) => {
      const b = e.target.closest('button');
      const el = document.activeElement;
      if (!b || !el?.classList.contains('money')) return;
      if (b.dataset.key === 'done') { el.blur(); return; }
      el.value = E.formatMoneyInput(el.value + '000');
      el.dispatchEvent(new Event('input', { bubbles: true }));
    });
  }
  const vv = window.visualViewport;
  const bottom = vv ? Math.max(0, window.innerHeight - vv.height - vv.offsetTop) : 0;
  keybar.style.bottom = `${bottom}px`;
  if (!keybar.isConnected) document.body.appendChild(keybar);
  document.body.classList.add('kb-open');
  keybar.dataset.for = input.id;
}
function hideKeybar() { keybar?.remove(); document.body.classList.remove('kb-open'); }

// ---------------------------------------------------------------- thao tác
function refreshHidden() {
  if (!$('#hc-profit') || !calcReady()) return;
  const v = C.hiddenCostsView(presets, engineInput());
  const setT = (s, t) => { const e = $(s); if (e) e.textContent = t; };
  $('.big-card').dataset.state = v.state;
  $('#hc-profit').className = `profit state-${v.state}`;
  $('#hc-state').className = `state-txt state-${v.state}`;
  setT('#hc-profit', v.profitText); setT('#hc-state', v.stateText); setT('#hc-diff', v.diffText); setT('#hc-base', `Chỉ tính phí sàn: ${v.baseText}`);
  setT('#hc-return-step', v.returnStep); setT('#hc-voucher-step', v.voucherStep); setT('#roas-breakeven', v.roasText); setT('#max-ads', `${v.maxAdsText}/đơn`);
}


/** Hôm nay (giờ VN); bot đặt được ngày giả qua window.__app.setToday để kiểm nhắc sale. */
const today = () => ui.today ?? Sale.todayVN();

/** Nhắc sale: 1 thông báo cho mỗi đợt sale khi đến hạn. */
function checkSaleReminder() {
  if (!state.saleReminders) return;
  const sale = Sale.nextSale(today());
  if (!Sale.saleReminderDue(sale) || state.saleNotified === sale.iso) return;
  const text = Sale.saleBannerText(sale);
  set({ ...state, saleNotified: sale.iso, notifications: [{ text, at: Date.now(), kind: 'sale' }, ...state.notifications].slice(0, 30) });
  if (state.alertsOn && 'Notification' in window && Notification.permission === 'granted') {
    try { new Notification('Lãi Thật', { body: text, icon: 'icon.svg' }); } catch { /* không hỗ trợ */ }
  }
}

async function copyText(text) {
  try { await navigator.clipboard.writeText(text); return true; } catch { /* thử cách cũ */ }
  const ta = document.createElement('textarea');
  ta.value = text; ta.setAttribute('readonly', ''); ta.style.position = 'fixed'; ta.style.opacity = '0';
  document.body.appendChild(ta); ta.select();
  let ok = false;
  try { ok = document.execCommand('copy'); } catch { ok = false; }
  ta.remove();
  return ok;
}

/** Đi tới hash; nếu đang rời một sản phẩm có thay đổi chưa lưu thì hỏi trước. */
function guardedGo(hash, after) {
  const id = ws();
  if (id && ui.dirty && !hash.startsWith(`#/san-pham/${id}`)) {
    ui.pendingHash = hash; ui.afterLeave = after;
    if (id === NEW_ID) {
      const ok = createOk();
      overlay.innerHTML = `<div class="scrim" data-act="sheet-bg"><div class="sheet" role="dialog" aria-modal="true" aria-label="Chưa thêm sản phẩm">
      <div class="grab"></div><h2>${ok ? `Thêm “${esc(ui.draftName.trim())}” vào danh mục?` : 'Bỏ sản phẩm đang nhập?'}</h2>
      <p class="hint" style="margin:-4px 0 14px">${ok ? 'Bạn đã nhập nhưng chưa bấm Thêm vào danh mục.' : 'Cần tên và giá bán để thêm vào danh mục.'}</p>
      <div class="btn-row"><button id="leave-discard" class="btn btn-secondary" data-act="leave-discard">Bỏ</button>
      <button id="leave-save" class="btn btn-primary" data-act="leave-save" ${ok ? '' : 'disabled'}>Thêm</button></div></div></div>`;
      return;
    }
    overlay.innerHTML = `<div class="scrim" data-act="sheet-bg"><div class="sheet" role="dialog" aria-modal="true" aria-label="Chưa lưu thay đổi">
      <div class="grab"></div><h2>Lưu thay đổi của “${esc(ui.draftName)}”?</h2>
      <p class="hint" style="margin:-4px 0 14px">Bạn đã sửa sản phẩm này nhưng chưa lưu.</p>
      <div class="btn-row"><button id="leave-discard" class="btn btn-secondary" data-act="leave-discard">Bỏ thay đổi</button>
      <button id="leave-save" class="btn btn-primary" data-act="leave-save">Lưu</button></div></div></div>`;
    return;
  }
  go(hash);
  after?.();
}
function finishLeave(hash) { const a = ui.afterLeave; ui.afterLeave = null; if (hash) go(hash); a?.(); }

const Ad = createAddons({
  state: () => state, set, track, render, go, presets: () => presets, config, pro, overlay, closeOverlay, toast, copyText, top, now, shortName,
  openPaywall: (trigger, after) => { ui.afterPro = after ?? null; openPaywall(trigger); },
  setCalcMode: (m) => calcPatch({ mode: m }),
});

const ACT = {
  nav: (el) => guardedGo(el.dataset.to),
  share: async () => {
    const text = C.shareText(presets, engineInput(), ws() ? ui.draftName : '');
    ui.lastShare = text;
    const touch = matchMedia('(pointer: coarse)').matches || navigator.maxTouchPoints > 0;
    if (touch && navigator.share) {
      try { await navigator.share({ title: 'Lãi Thật', text }); track('share_result', { channel: 'other' }); return; } catch (e) { if (e?.name === 'AbortError') return; }
    }
    await copyText(text);
    track('share_result', { channel: 'other' });
    toast('Đã chép kết quả, dán vào Zalo');
  },
  example: (el) => {
    const e = EXAMPLES.find((x) => x.id === el.dataset.v);
    set({ ...St.updateCalc(state, { ...St.defaultCalc(), ...e.input, mode: 'price',
      returnOn: (e.input.returnRate ?? 0) > 0, adsOn: false }), examplesDismissed: true });
    ui.otherOpen = true;
    render();
  },
  'load-examples': () => { set(St.loadExamples(state, presets, Date.now())); render(); toast(`Đã thêm ${EXAMPLES.length} sản phẩm mẫu`); },
  'bulk-mode': () => {
    if (ui.bulk) { ui.bulk = null; render(); return; }
    ui.applyOn = new Set(St.sellPlatforms(state));
    ui.bulk = new Set(C.catalogView(presets, state.products, 'all', catOpts()).items.filter(bulkPreselect).map((i) => i.id));
    render();
  },
  'apply-suggested': () => {
    const on = multiSell() ? St.sellPlatforms(state).filter((p) => applyOn().has(p)) : null;
    const r = St.applySuggested(state, [...ui.bulk], presets, Date.now(), on ? { platforms: on, lazadaRate: state.lazadaRate } : undefined);
    set(r.state);
    ui.bulk = null;
    ui.undo = { products: r.undo, count: r.changed, until: Date.now() + 5000 };
    setTimeout(() => { if (ui.undo && ui.undo.until <= Date.now()) { ui.undo = null; if (location.hash === '#/san-pham') render(); } }, 5100);
    render();
    toast(`Đã áp giá gợi ý cho ${r.changed} sản phẩm${on ? ` trên ${on.map(shortName).join(', ')}` : ''}`);
  },
  'apply-on': (el) => {
    const next = new Set(applyOn());
    if (next.has(el.dataset.v)) next.delete(el.dataset.v); else next.add(el.dataset.v);
    if (!next.size) { toast('Chọn ít nhất 1 sàn'); return; }
    ui.applyOn = next;
    const items = C.catalogView(presets, state.products, 'all', catOpts()).items;
    ui.bulk = new Set([...ui.bulk].filter((id) => { const i = items.find((x) => x.id === id); return i && bulkEligible(i); }));
    render();
  },
  'undo-apply': () => { if (!ui.undo) return; set({ ...state, products: ui.undo.products }); ui.undo = null; render(); toast('Đã hoàn tác'); },
  'save-sheet': openSaveSheet,
  'save-confirm': (el, e, given) => {
    const name = given ?? ($('#product-name').value.trim() || 'Sản phẩm');
    const r = St.saveProduct(state, name, engineInput(state.calc), presets, Date.now(), { ...config, pro_gates_enabled: config.pro_gates_enabled && !pro() });
    if (!r.ok) { closeOverlay(); ui.afterPro = () => ACT['save-confirm'](null, null, name); openPaywall('catalog_limit'); return; }
    set(r.state);
    closeOverlay();
    render();
    toast(`Đã lưu “${name}” vào Sản phẩm`);
  },
  'open-product': (el) => go(`#/san-pham/${el.dataset.v}`),
  'product-create': (el, opts = {}) => {
    if (!isNew() || !createOk()) return;
    const name = ui.draftName.trim();
    const r = St.saveProduct(state, name, engineInput(ui.draft), presets, Date.now(), { ...config, pro_gates_enabled: config.pro_gates_enabled && !pro() }, { channels: { ...(ui.draftChannels ?? {}) } });
    if (!r.ok) { ui.afterPro = () => ACT['product-create'](null, opts); openPaywall('catalog_limit'); return; }
    set(r.state);
    ui.draft = null; ui.draftFor = null; ui.dirty = false;
    if (!opts.stay) go('#/san-pham');
    toast(`Đã thêm “${name}” vào danh mục`);
  },
  'product-save': () => {
    const id = ws();
    if (!id || !ui.dirty) return;
    set(St.updateProduct(state, id, ui.draftName, engineInput(ui.draft), Date.now(), { ...(ui.draftChannels ?? {}) }));
    ui.dirty = false;
    render();
    toast(`Đã lưu thay đổi “${ui.draftName}”`);
  },
  'product-delete': () => {
    if (!ui.deleteArmed) { ui.deleteArmed = true; render(); return; }
    const name = ui.draftName;
    set(St.removeProduct(state, ws()));
    ui.draft = null; ui.draftFor = null; ui.dirty = false; ui.deleteArmed = false;
    go('#/san-pham');
    toast(`Đã xoá “${name}”`);
  },
  'product-to-calc': () => {
    const copy = { ...ui.draft };
    set(St.updateCalc(state, copy));
    guardedGo('#/tinh', () => toast('Đã chép sang Tính nhanh — thử thoải mái, sản phẩm không đổi'));
  },
  'leave-save': () => { if (isNew()) ACT['product-create'](null, { stay: true }); else ACT['product-save'](); closeOverlay(); const h = ui.pendingHash; ui.pendingHash = null; finishLeave(h); },
  'leave-discard': () => { ui.dirty = false; ui.draft = null; ui.draftFor = null; closeOverlay(); const h = ui.pendingHash; ui.pendingHash = null; finishLeave(h); },
  filter: (el) => { ui.catalogFilter = el.dataset.v; render(); },
  'fee-alert-open': () => {
    const a = state.feeAlert;
    track('fee_alert_opened', { fee_version: a.fee_version, is_pro: pro() });
    if (config.pro_gates_enabled && !pro()) { ui.afterPro = () => ACT['fee-alert-open'](); openPaywall('fee_alert'); return; }
    ui.catalogFilter = a.turnedLoss.map((t) => t.id);
    render();
  },
  'fee-alert-dismiss': () => { set({ ...state, feeAlert: { ...state.feeAlert, dismissed: true } }); ui.catalogFilter = 'all'; render(); },
  'check-fees': async () => {
    const changed = await refreshPresets();
    toast(changed ? `Đã nhận biểu phí ${presets.fee_version}` : `Đang dùng biểu phí mới nhất (${presets.fee_version})`);
  },
  'hc-apply': () => { track('hidden_costs_set', St.hiddenCostsEvent(engineInput())); go(homeRoute()); },
  'cmp-lazada-reset': () => { set({ ...state, lazadaRate: null }); render(); },
  'pick-platform': (el) => { ui.pick = el.dataset.v; $$('[data-act="pick-platform"]').forEach((b) => b.setAttribute('aria-checked', String(b.dataset.v === ui.pick))); $('#onboard-continue').disabled = false; },
  onboard: () => { set(St.completeOnboarding(state, ui.pick)); go('#/tinh'); },
  mode: (el) => { calcPatch({ mode: el.dataset.v }); render(); },
  'pick-margin': (el) => { calcPatch({ targetM: Number(el.dataset.m) }); $$('.margin-chip').forEach((b) => b.setAttribute('aria-pressed', String(b === el))); refreshCalc(); },
  'amount-mode': () => { ui.amountMode = !ui.amountMode; render(); },
  'apply-price': () => {
    const c = cur();
    const v = C.marginView(presets, engineInput(), ui.amountMode ? { amount: c.targetAmount || 0 } : { m: c.targetM });
    if (v.impossible) return;
    const preset = ui.amountMode ? 'custom' : (C.MARGIN_CHIPS.find((x) => Math.abs(x.m - c.targetM) < 1e-9) ? String(Math.round(c.targetM * 100)) : 'custom');
    track('nice_price_applied', { target_margin: preset });
    calcPatch({ price: v.nicePrice, mode: 'price' });
    render();
    toast(`Đã dùng giá ${v.niceText}`);
  },
  'voucher-unit': () => { calcPatch({ voucherUnit: cur().voucherUnit === 'pct' ? 'vnd' : 'pct' }); render(); },
  'toggle-other': () => { ui.otherOpen = !ui.otherOpen; render(); },
  'fee-info': (el) => {
    const k = el.dataset.v;
    if (ui.openInfo.has(k)) ui.openInfo.delete(k); else { ui.openInfo.add(k); track('fee_info_opened', { fee_key: k }); }
    render();
  },
  'report-fee': () => { track('fee_report_sent', { platform: cur().platform, field: 'breakdown' }); toast('Cảm ơn bạn! Đã ghi nhận để kiểm tra lại biểu phí.'); },
  'reset-fees': () => { calcPatch({ transactionOverride: null, fixedOverride: null }); render(); toast('Đã về biểu phí gốc'); },
  'platform-sheet': openPlatformSheet,
  'sheet-bg': (el, e) => { if (e.target === el) closeOverlay(); },
  paywall: (el) => openPaywall(el.dataset.v),
  'paywall-close': () => { ui.afterPro = null; closeOverlay(); },
  plan: (el) => { ui.plan = el.dataset.v; drawPaywall(); },
  buy: async () => {
    const b = await billing();
    const btn = $('#buy');
    if (btn) btn.disabled = true;
    try { await b.purchase(ui.plan); } catch { if (btn) btn.disabled = false; toast('Chưa mua được — thử lại sau'); return; }
    set(St.startSubscription(state, ui.plan, ui.paywallTrigger, now(), config.pro_prices));
    b.remember?.(state.sub);
    closeOverlay();
    const after = ui.afterPro; ui.afterPro = null;
    render();
    toast(state.sub.status === 'trial' ? `Đã bắt đầu dùng thử ${config.pro_prices.trial_days} ngày Lãi Thật Pro` : 'Đã mua Lãi Thật Pro gói năm');
    after?.();
  },
  restore: async () => {
    const rec = await (await billing()).restore();
    if (!rec) { toast('Không tìm thấy giao dịch nào để khôi phục'); return; }
    set(St.restoreSubscription(state, rec, now()));
    closeOverlay();
    render();
    toast(pro() ? 'Đã khôi phục Lãi Thật Pro' : 'Gói đã hết hạn — không có gì để khôi phục');
  },
  'pro-cancel': () => { set(St.cancelSubscription(state)); render(); toast('Đã huỷ — vẫn dùng Pro tới hết kỳ'); },
  consent: (el) => { set({ ...state, adConsent: el.dataset.v }); render(); },
  'ad-consent-change': () => { set({ ...state, adConsent: null }); render(); toast('Chọn lại ở thẻ quảng cáo trong Danh mục hoặc Cài đặt'); },
  'interstitial-close': () => closeAdLayer(),
  'watch-ad': () => {
    if (nAds) {
      nAds.rewarded({ npa: npa() }).then((ok) => {
        if (!ok) { toast('Chưa xem hết quảng cáo — chưa mở được'); return; }
        set({ ...state, rewardedUnlocks: [...new Set([...(state.rewardedUnlocks ?? []), 'flash_sale', 'max_cost'])] });
        track('ad_impression', { format: 'rewarded', placement: 'flash_sale' });
        track('rewarded_ad_complete', { reward: 'flash_sale' });
        track('flash_sale_viewed', { unlock_method: 'rewarded' });
        track('max_cost_viewed', { unlock_method: 'rewarded' });
        render();
      });
      return;
    }
    const secs = config.rewarded_seconds ?? 5;
    adLayer().innerHTML = `<div class="ad-full" id="rewarded" role="dialog" aria-modal="true" aria-label="Quảng cáo thưởng"><span class="ad-tag">Quảng cáo thử</span>
      <div class="ad-full-body"><b>Quảng cáo thưởng</b><p>Xem hết để mở Flash Sale và giá nhập tối đa trong phiên này.</p></div>
      <button id="rewarded-close" class="btn btn-secondary" data-act="rewarded-close" disabled>Còn ${secs} giây</button></div>`;
    countdown('#rewarded-close', secs, (b) => {
      set({ ...state, rewardedUnlocks: [...new Set([...(state.rewardedUnlocks ?? []), 'flash_sale', 'max_cost'])] });
      track('ad_impression', { format: 'rewarded', placement: 'flash_sale' });
      track('rewarded_ad_complete', { reward: 'flash_sale' });
      track('flash_sale_viewed', { unlock_method: 'rewarded' });
      track('max_cost_viewed', { unlock_method: 'rewarded' });
      b.disabled = false; b.textContent = 'Xong — đã mở';
      render();
    });
  },
  'rewarded-close': () => closeAdLayer(),
  'channel-sheet': (el) => openChannelSheet(el.dataset.v),
  'ch-save': (el) => {
    const p = el.dataset.v;
    const name = $('#ch-category')?.value ?? '';
    const rate = E.parseRate($('#ch-rate')?.value);
    const price = E.parseMoney($('#ch-price')?.value);
    const preset = P.categoriesFor(presets, p).find((c) => c.name === name)?.rate ?? null;
    ui.draftChannels = { ...(ui.draftChannels ?? {}), [p]: { categoryName: name, categoryRate: rate, categoryCustom: rate != null && rate !== preset, price: price > 0 ? price : null } };
    ui.dirty = true;
    closeOverlay();
    render();
    toast(`Đã cập nhật ${shortName(p)} — bấm lưu để giữ`);
  },
  'sell-toggle': (el) => {
    const p = el.dataset.v;
    const on = St.sellPlatforms(state).includes(p);
    const next = St.setSellPlatform(state, p, !on);
    if (next === state) { toast('Cần ít nhất 1 sàn'); return; }
    set(next);
    render();
  },
  'sheet-close': () => { closeOverlay(); render(); },
  'sheet-platform': (el) => {
    const p = el.dataset.v;
    if (p !== cur().platform) calcPatch({ platform: p, categoryName: '', categoryRate: null, programs: [], registered: false, transactionOverride: null, fixedOverride: null });
    $$('[data-act="sheet-platform"]').forEach((b) => b.setAttribute('aria-checked', String(b.dataset.v === p)));
  },
};

Object.assign(ACT, Ad.ACT);

const CH = {
  'ch-category': (el) => {
    const r = el.selectedOptions[0]?.dataset.rate;
    const inp = $('#ch-rate');
    if (inp) inp.value = r ? String(Math.round(Number(r) * 10000) / 100).replace('.', ',') : '';
  },
  'ch-price': (el) => { el.value = E.formatMoneyInput(el.value); },
  'bulk-check': (el) => {
    if (el.checked) ui.bulk.add(el.dataset.v); else ui.bulk.delete(el.dataset.v);
    const b = $('#apply-suggested');
    if (b) { b.textContent = `Áp giá gợi ý cho ${ui.bulk.size} sản phẩm`; b.disabled = !ui.bulk.size; }
  },
  'sale-reminders': (el) => { set({ ...state, saleReminders: el.checked }); checkSaleReminder(); render(); },
  'new-shop': (el) => { calcPatch({ newShopPromo: el.checked }); render(); toast(el.checked ? 'Đang tính miễn phí cố định cho shop mới' : 'Đã tắt ưu đãi shop mới'); },
  'cmp-rate': (el) => { set({ ...state, lazadaRate: E.parseRate(el.value) }); track('fee_override', { platform: el.dataset.v, field: 'category' }); render(); },
  'cmp-tiktok': (el) => {
    const cat = P.categoriesFor(presets, 'tiktok_shop').find((x) => x.name === el.value);
    set({ ...state, compare: { ...state.compare, tiktok: { name: cat.name, rate: cat.rate } } });
    render();
  },
  hc: (el) => { calcPatch({ [el.dataset.v]: el.checked }); render(); },
  'hc-rate': (el) => { calcPatch({ [el.dataset.v]: E.parseRate(el.value) ?? 0 }); render(); },
  'hc-num': (el) => { const n = Number(String(el.value).replace(',', '.')); calcPatch({ [el.dataset.v]: n > 0 ? n : null }); render(); },
  alerts: async (el) => {
    set({ ...state, alertsOn: el.checked });
    if (el.checked && 'Notification' in window && Notification.permission === 'default') {
      try { await Notification.requestPermission(); } catch { /* trình duyệt chặn */ }
    }
    toast(el.checked ? 'Đã bật báo động đổi phí' : 'Đã tắt báo động đổi phí');
  },
  category: (el) => {
    const cat = P.categoriesFor(presets, cur().platform).find((x) => x.name === el.value);
    calcPatch({ categoryName: el.value, categoryRate: cat ? cat.rate : null, categoryCustom: false });
    render();
  },
  'category-rate': (el) => {
    const r = E.parseRate(el.value);
    calcPatch({ categoryRate: r, categoryCustom: true });
    track('fee_override', { platform: cur().platform, field: 'category' });
    render();
  },
  program: (el) => {
    const on = el.checked;
    const id = el.dataset.v;
    const programs = on ? [...new Set([...cur().programs, id])] : cur().programs.filter((x) => x !== id);
    calcPatch({ programs });
    track('program_toggled', { program: id, on });
    render();
  },
  tax: (el) => { calcPatch({ [el.dataset.v]: el.checked }); track('program_toggled', { program: `tax_${el.dataset.v}`, on: el.checked }); render(); },
  registered: (el) => { calcPatch({ registered: el.checked }); render(); },
  override: (el) => {
    const k = el.dataset.v;
    if (k === 'category') calcPatch({ categoryRate: E.parseRate(el.value), categoryCustom: true });
    if (k === 'transaction') calcPatch({ transactionOverride: E.parseRate(el.value) });
    if (k === 'fixed') calcPatch({ fixedOverride: E.parseMoney(el.value) });
    track('fee_override', { platform: cur().platform, field: k });
    render();
  },
};

Object.assign(CH, Ad.CH);

const IN = {
  addon: (el) => Ad.IN(el),
  money: (el) => {
    const caretAtEnd = el.selectionStart === el.value.length;
    const f = E.formatMoneyInput(el.value);
    if (el.value !== f) { el.value = f; if (caretAtEnd) el.setSelectionRange(f.length, f.length); }
    const key = el.dataset.money;
    calcPatch({ [key]: E.parseMoney(f) });
    refreshCalc();
    refreshHidden();
  },
  'category-rate': (el) => {
    const r = E.parseRate(el.value);
    if (r != null) { calcPatch({ categoryRate: r, categoryCustom: true }); refreshCalc(); }
  },
  'orders-month': (el) => {
    el.value = el.value.replace(/\D/g, '');
    calcPatch({ ordersPerMonth: Number(el.value) || 0 });
    const m = $('#monthly-profit');
    if (m) m.innerHTML = monthlyLine();
  },
  'draft-name': (el) => {
    ui.draftName = el.value; ui.dirty = true;
    const pc = $('#product-create');
    if (pc) pc.disabled = !createOk();
    const ps = $('#product-save');
    if (ps) ps.disabled = !(cur().price > 0) || rateMissing();
  },
  'compare-orders': (el) => {
    el.value = el.value.replace(/\D/g, '');
    set({ ...state, compareOrders: Number(el.value) || 0 });
    const m = $('#compare-monthly');
    if (m) m.textContent = compareData().monthlyText;
  },
};

document.addEventListener('click', (e) => {
  const el = e.target.closest('[data-act]');
  if (!el || el.disabled || !ACT[el.dataset.act]) return;
  ACT[el.dataset.act](el, e);
});
document.addEventListener('input', (e) => {
  const el = e.target;
  if (el.dataset?.money) IN.money(el);
  else if (el.dataset?.in && IN[el.dataset.in]) IN[el.dataset.in](el);
});
document.addEventListener('change', (e) => { const el = e.target.closest('[data-ch]'); if (el && CH[el.dataset.ch]) CH[el.dataset.ch](el, e); });
document.addEventListener('focusin', (e) => { if (e.target.classList?.contains('money')) showKeybar(e.target); });
document.addEventListener('focusout', (e) => { if (e.target.classList?.contains('money')) setTimeout(() => { if (!document.activeElement?.classList?.contains('money')) hideKeybar(); }, 0); });
document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && overlay.innerHTML) closeOverlay(); });

// ---------------------------------------------------------------- điều hướng
const SCREENS = {
  'chon-san': screenOnboarding, tinh: screenCalc, 'chi-tiet': screenBreakdown,
  'so-sanh': screenCompare, 'chi-phi-an': screenHidden, 'san-pham': screenProducts, 'cai-dat': screenSettings,
  combo: (seg) => Ad.screenCombo(seg), 'kiem-tra': (seg) => Ad.screenCheck(seg),
};
/** Danh mục, hoặc màn của một sản phẩm (dùng chung khung Tính nhanh / Chi tiết phí / Chi phí ẩn với bản nháp riêng). */
function screenProducts(seg) {
  if (!seg[1]) return screenCatalog();
  if (seg[1] === NEW_ID) {
    if (ui.draftFor !== NEW_ID || !ui.draft) { ui.draft = St.newProductCalc(state); ui.draftName = ''; ui.draftFor = NEW_ID; ui.dirty = false; ui.draftChannels = {}; }
    if (seg[2] === 'chi-tiet') return screenBreakdown();
    if (seg[2] === 'chi-phi-an') return screenHidden();
    return screenCalc();
  }
  const p = state.products.find((x) => x.id === seg[1]);
  if (!p) { location.replace('#/san-pham'); return ''; }
  if (ui.draftFor !== p.id || !ui.draft) {
    ui.draft = St.productToCalc(p); ui.draftName = p.name; ui.draftFor = p.id; ui.dirty = false; ui.deleteArmed = false; ui.draftChannels = { ...(p.channels ?? {}) };
  }
  if (seg[2] === 'chi-tiet') return screenBreakdown();
  if (seg[2] === 'chi-phi-an') return screenHidden();
  return screenCalc();
}
/** Tên màn để chọn bố cục và ghi sự kiện: 'tinh' cho cả màn sản phẩm (cùng khung). */
function screenKey(seg) {
  if (seg[0] === 'san-pham' && seg[1]) return seg[2] ?? 'tinh';
  if (seg[0] === 'combo' || seg[0] === 'kiem-tra') return seg[1] ? `${seg[0]}-${seg[1]}` : seg[0];
  return seg[0];
}

const TABS = [
  { id: 'tinh', label: 'Tính', icon: 'calc' }, { id: 'so-sanh', label: 'So sánh', icon: 'chart' },
  { id: 'san-pham', label: 'Sản phẩm', icon: 'box' }, { id: 'kiem-tra', label: 'Kiểm tra', icon: 'scan' }, { id: 'cai-dat', label: 'Cài đặt', icon: 'gear' },
];

/** Sự kiện khi vào màn (1 lần mỗi lượt vào). */
function onEnter(screen) {
  if (screen === 'chi-tiet') track('fee_breakdown_opened', { platform: cur().platform });
  if (screen === 'so-sanh' && calcReady()) {
    const v = compareData();
    track('compare_viewed', { best_platform: v.best, platforms_count: v.cards.filter((c) => c.ready).length });
  }
  if (screen === 'san-pham') {
    const v = C.catalogView(presets, state.products, 'all', catOpts());
    if (v.lossCount > 0) track('catalog_sorted_alert', { loss_count_bucket: St.lossCountBucket(v.lossCount) });
  }
  const placement = Ads.bannerPlacement(location.hash);
  if (placement && Ads.adsActive(state, config, now())) track('ad_impression', { format: 'banner', placement });
  if (screen === 'tinh' && cur().mode === 'margin' && calcReady() && !St.isLocked('flash_sale', state, config, now())) {
    const method = config.pro_gates_enabled ? (pro() ? 'pro' : 'rewarded') : 'beta_free';
    track('flash_sale_viewed', { unlock_method: method });
    track('max_cost_viewed', { unlock_method: method });
  }
}

// calc_completed: ghi khi kết quả hiện lần đầu cho một bộ đầu vào (debounce theo app_config).
const calcTrack = St.calcTracker(config.calc_event_debounce_ms);
function noteCalcInput() {
  if (!calcReady() || !location.hash.startsWith('#/tinh')) return;
  const c = state.calc;
  calcTrack.input(JSON.stringify([c.platform, c.categoryRate, c.price, c.cost, c.pack, c.voucherValue, c.shipBuyer, c.programs, c.mode, c.targetM]), Date.now());
}
setInterval(() => {
  if (!calcTrack.due(Date.now()) || !calcReady()) return;
  const c = state.calc;
  const r = E.calculate(presets, engineInput());
  track('calc_completed', {
    platform: c.platform, category_id: c.categoryName || 'custom', mode: c.mode === 'margin' ? 'from_margin' : 'from_price',
    state: r.state, margin_bucket: St.marginBucket(r.margin), has_seller_voucher: c.voucherValue > 0, has_ship_buyer: c.shipBuyer > 0,
    programs_on: c.programs.join(','),
  });
}, 300);

function render() {
  const [path] = location.hash.slice(1).split('?');
  const seg = path.split('/').filter(Boolean);
  if (!state.platform && seg[0] !== 'chon-san') { location.replace('#/chon-san'); return; }
  const fn = SCREENS[seg[0]];
  if (!fn) { location.replace(St.initialRoute(state)); return; }
  closeOverlay();
  hideKeybar();
  const html = fn(seg);
  if (!html) return;
  const showNav = TABS.length > 1 && seg[0] !== 'chon-san';
  document.body.classList.toggle('no-nav', !showNav);
  document.body.classList.toggle('has-nav', showNav);
  const sk = screenKey(seg);
  document.body.classList.toggle('has-result', (sk === 'tinh' && cur().mode !== 'margin') || sk === 'combo');
  document.body.classList.toggle('has-cta', (sk === 'tinh' && cur().mode === 'margin') || ['chon-san', 'chi-phi-an', 'kiem-tra'].includes(sk));
  app.innerHTML = html + (showNav ? navHtml(seg[0] === 'combo' ? 'tinh' : seg[0]) : '');
  const key = location.hash.split('?')[0];
  const entered = key !== ui.lastRoute || (sk === 'tinh' && ui.lastMode !== cur().mode);
  if (key !== ui.lastRoute) { app.querySelector('.screen')?.classList.add('enter'); window.scrollTo(0, 0); }
  ui.lastRoute = key;
  ui.lastMode = cur().mode;
  if (seg[0] !== 'san-pham' && Array.isArray(ui.catalogFilter)) ui.catalogFilter = 'all';
  if (entered) { onEnter(sk); Ad.onEnter(seg); }
  if (!ws() && !ui.dirty) { ui.draft = null; ui.draftFor = null; }
  if (seg[0] === 'tinh') noteCalcInput();
  syncNativeBanner();
}

function navHtml(cur) {
  return `<nav class="nav" aria-label="Điều hướng"><div class="in" style="--n:${TABS.length}">${TABS.map((t) => `<button id="tab-${t.id}" data-act="nav" data-to="#/${t.id}" ${t.id === cur ? 'aria-current="page"' : ''}>${icon(t.icon)}${t.label}</button>`).join('')}</div></nav>`;
}

window.addEventListener('hashchange', () => { ui.navCount += 1; maybeInterstitial(); render(); });
if (!location.hash || location.hash === '#' || location.hash === '#/') location.replace(St.initialRoute(state));
set({ ...state, sessions: (state.sessions ?? 0) + 1, seenFeeVersion: state.seenFeeVersion ?? presets.fee_version, rewardedUnlocks: [] });
ui.sessionStart = Date.now();
checkSubscription();
setInterval(checkSubscription, 3600 * 1000);
render();
showSplash();

// Biểu phí mới nhất từ máy chủ (vai trò Remote Config). Lỗi mạng → giữ bản đang dùng.
async function refreshPresets() {
  ui.lastFeeCheck = Date.now();
  try {
    const res = await fetch(config.fee_presets_url || 'assets/fee_presets.json', { cache: 'no-store' });
    if (!res.ok) return false;
    return receivePresets(await res.json());
  } catch { return false; /* offline */ }
}
/** Nhận biểu phí (từ máy chủ, hoặc bot giả lập Remote Config đẩy xuống): mới hơn thì áp dụng + báo động. */
function receivePresets(remote) {
  const next = P.pickPresets({ remote, cache: presets, bundled: bundledPresets });
  if (next === presets) return false;
  const old = presets;
  presets = next;
  write('laithat:presets', JSON.stringify(presets));
  const r = St.applyFeeUpdate(state, old, next, Date.now());
  set(r.state);
  if (r.changed) {
    if (state.alertsOn && 'Notification' in window && Notification.permission === 'granted') {
      try { new Notification('Lãi Thật', { body: state.feeAlert.text, icon: 'icon.svg' }); } catch { /* không hỗ trợ */ }
    }
    toast(state.feeAlert.text.split('. ')[0]);
  }
  render();
  return true;
}
refreshPresets();
setInterval(refreshPresets, config.fee_check_interval_hours * 3600 * 1000);
document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'visible' && Date.now() - (ui.lastFeeCheck ?? 0) > config.fee_check_interval_hours * 3600 * 1000) refreshPresets();
});

if ('serviceWorker' in navigator && location.protocol.startsWith('http')) navigator.serviceWorker.register('sw.js').catch(() => {});

window.__app = {
  state: () => state,
  presets: () => ({ fee_version: presets.fee_version, as_of: presets.as_of }),
  route: () => location.hash,
  receivePresets,
  config: () => config,
  events: () => state.events,
  lastShare: () => ui.lastShare ?? null,
  /** Ngày giả để bot kiểm nhắc sale (F17). */
  setToday: (iso) => { ui.today = iso; checkSaleReminder(); render(); },
  /** Cấu hình thử (bật/tắt khoá Pro, quảng cáo, thời gian quảng cáo); giữ qua các lần tải lại trong phiên. */
  setConfig: (patch) => {
    Object.assign(config, patch);
    try { const cur0 = JSON.parse(sessionStorage.getItem('laithat:test-config') ?? '{}'); sessionStorage.setItem('laithat:test-config', JSON.stringify({ ...cur0, ...patch })); } catch { /* riêng tư */ }
    render();
  },
  /** Tua đồng hồ (ms) để kiểm nhắc / hết dùng thử (F24). */
  advanceClock: (ms) => { ui.clockOffset = (ui.clockOffset ?? 0) + ms; checkSubscription(); render(); },
  clearSub: () => { set({ ...state, sub: null }); render(); },
  billingMode: () => ui.billingMode ?? null,
  native: () => ({ native: isNative(window), ads: !!nAds }),
  /** F30: đưa file .xlsx như người dùng chọn (bot không mở được hộp chọn file). */
  checkFile: (bytes) => Ad.handleFile(new Uint8Array(bytes)),
  lastClipboard: () => Ad.lastClipboard(),
};
checkSaleReminder();
