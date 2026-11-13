// Giao diện — chỉ vẽ trạng thái và nhận thao tác. Phép tính ở logic.js, trạng thái ở store.js.
// Màn hình + selector: 1-wiki/screens/man-hinh.md
import tariff from './tariff-default.json' with { type: 'json' };
import * as L from './logic.js';
import * as St from './store.js';
import { icon } from './icons.js';
import { BANKS } from './banks.js';
import { encodeQR, qrToSvg } from './qr.js';
import { SOURCES, DISCLAIMER, DISCLAIMER_SHORT, PRIVACY, MODE_B_NOTE, MODE_LABEL } from './content.js';
import { renderInvoicePNG } from './invoice-canvas.js';

const $ = (s, root = document) => root.querySelector(s);
const $$ = (s, root = document) => [...root.querySelectorAll(s)];
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
const vnd = L.formatVND;
const app = $('#app');
const overlay = $('#overlay');

// ---------------------------------------------------------------- trạng thái
function readStorage() { try { return localStorage.getItem(St.STORAGE_KEY); } catch { return null; } }
let state = St.loadState(readStorage());
const ui = { pendingRole: null, consent: false, paywallTrigger: 'room_limit', paywallFrom: null, plan: null, roomDraft: null, houseDraft: null, wipeArmed: false, lastExport: null, lastModel: null };

function persist() { try { localStorage.setItem(St.STORAGE_KEY, St.saveState(state)); } catch { /* chế độ riêng tư */ } }
function set(next) { state = next; persist(); }
function track(name, params) { set(St.track(state, name, params)); }
function go(hash) { if (location.hash === hash) render(); else location.hash = hash; }

if (!state.draft.newReading && !state.draft.kwh) state.draft.period = St.currentPeriod();
if (!state.house.rooms.length) state.house.period = St.currentPeriod();
track('tariff_config_loaded', { tariff_version: tariff.tariff_version, source: 'default' });

// ---------------------------------------------------------------- tính toán từ draft
function draftKwh(d = state.draft) {
  return d.inputType === 'kwh' ? L.parseKwh(d.kwh) : L.meterDelta(d.oldReading, d.newReading, d.meterReplaced);
}
function draftResult(d = state.draft) {
  const k = draftKwh(d);
  if (!k.ok) return null;
  return L.calcBill(k.kwh, { mode: d.declared ? 'A' : 'B', people: d.people, period: d.period }, tariff);
}
function draftCompare(r, d = state.draft) {
  return r ? L.compareLandlord({ legalTotal: r.total, kwh: r.kwh, value: L.parseAmount(d.landlordValue), unit: d.landlordUnit }) : null;
}
function ensureSplit() {
  const d = state.draft;
  const sp = state.split;
  if (sp.people.length !== d.people || sp.period !== d.period) {
    const days = L.daysInPeriod(d.period);
    const people = Array.from({ length: d.people }, (_, i) => ({ name: sp.people[i]?.name ?? `Người ${i + 1}`, days: sp.period === d.period && sp.people[i] ? sp.people[i].days : days }));
    set({ ...state, split: { ...sp, people, period: d.period } });
  }
}
const splitRows = (r) => L.splitBill({ total: r.total, type: state.split.type, people: state.split.people, extras: state.split.extras });

// ---------------------------------------------------------------- mảnh giao diện dùng chung
const topbar = ({ back, eyebrow, title, right = '', id = 'screen-title', hist = false }) => `
  <header class="topbar">
    ${back ? `<button class="icon-btn" data-act="${hist ? 'back' : 'nav'}" data-to="${back}" aria-label="Quay lại">${icon('back')}</button>` : ''}
    <div class="titles">${eyebrow ? `<p class="eyebrow">${eyebrow}</p>` : ''}<h1 id="${id}">${title}</h1></div>
    ${right}
  </header>`;
const chip = (id, act, v, label, pressed, cls = 'chip') =>
  `<button id="${id}" class="${cls}" data-act="${act}" data-v="${v}" aria-pressed="${pressed}">${pressed ? icon('check') : ''}${label}</button>`;
const bar = (inner, cls = '') => `<div class="bottombar ${cls}"><div class="inner">${inner}</div></div>`;
const adBanner = () => (state.plan.pro ? '' : '<div id="ad-banner" class="ad-banner" role="note">Quảng cáo (thử) · vị trí banner của gói miễn phí</div>');
const monthWord = (p) => `tháng ${Number(p.split('-')[1])}`;
const menuBtn = `<button id="nav-menu" class="icon-btn ghost" data-act="menu" aria-label="Mở menu">${icon('menu')}</button>`;

// ---------------------------------------------------------------- màn: chọn vai
function screenOnboarding() {
  ui.pendingRole = ui.pendingRole ?? state.role;
  const card = (role, ic, title, desc, yellow) => `
    <button id="role-${role}" class="role-card" data-act="pick-role" data-v="${role}" aria-pressed="${ui.pendingRole === role}">
      <span class="tile ${yellow ? 'yellow' : ''}">${icon(ic)}</span>
      <span class="t"><strong>${title}</strong><span class="d">${desc}</span></span>
      <span class="tick">${icon('checkCircle')}</span>
    </button>`;
  return `
  <section class="screen">
    <div class="logo-tile">${icon('receipt')}</div>
    <h1 class="hero" id="screen-title">Tính đúng tiền điện trọ, theo giá bậc thang mới.</h1>
    <p class="lead">Không cần tài khoản. Dữ liệu chỉ lưu trên máy bạn.</p>
    <p class="caps">Bạn là</p>
    ${card('tenant', 'users', 'Người thuê trọ', 'Kiểm tra tiền điện và chia tiền với bạn cùng phòng')}
    ${card('landlord', 'home', 'Chủ nhà trọ', 'Lập hóa đơn từng phòng, gửi Zalo, theo dõi đã thu', true)}
    <label class="check-row section"><input type="checkbox" id="consent-analytics" data-ch="consent" ${ui.consent ? 'checked' : ''}>
      <span>Cho phép ghi thống kê sử dụng ẩn danh để cải thiện app (không gồm số tiền, tên, số tài khoản).</span></label>
  </section>
  ${bar(`<button id="onboard-continue" class="btn btn-primary" data-act="onboard" ${ui.pendingRole ? '' : 'disabled'}>Tiếp tục</button>
         <p class="fine">${DISCLAIMER_SHORT}</p>`)}`;
}

// ---------------------------------------------------------------- màn: nhập chỉ số
function periodOptions(sel) {
  const opts = [];
  let p = St.currentPeriod();
  const [y, m] = p.split('-').map(Number);
  let start = `${m > 6 ? y : y - 1}-${String(((m + 5) % 12) + 1).padStart(2, '0')}`;
  for (let i = 0; i < 8; i++) { opts.push(start); start = L.nextPeriod(start); }
  const first = tariff.effective_from.slice(0, 7);
  for (const p of [first, sel]) if (!opts.includes(p)) opts.push(p);
  opts.sort();
  return opts.map((o) => `<option value="${o}" ${o === sel ? 'selected' : ''}>${L.periodLabel(o)}</option>`).join('');
}

function screenInput() {
  const d = state.draft;
  const meter = d.inputType === 'meter';
  return `
  <section class="screen">
    ${topbar({ eyebrow: `Phòng ${esc(d.room)}`, title: `Tiền điện ${monthWord(d.period)}`,
      right: `<button id="nav-history" class="icon-btn ghost" data-act="nav" data-to="#/lich-su" aria-label="Lịch sử hóa đơn">${icon('history')}</button>${menuBtn}` })}
    <div class="meter">
      <div class="segment" role="group" aria-label="Cách nhập">
        ${chip('input-meter', 'input-type', 'meter', 'Chỉ số công tơ', meter)}${chip('input-kwh', 'input-type', 'kwh', 'Số kWh', !meter)}
      </div>
      ${meter ? `
        <label class="label" for="new-reading">Chỉ số mới (đọc trên công tơ)</label>
        <input id="new-reading" class="meter-input" inputmode="numeric" autocomplete="off" placeholder="00000" value="${esc(d.newReading)}" data-in="draft" data-k="newReading" aria-describedby="new-reading-msg">
        <div id="new-reading-msg"></div>
        <div class="meter-row">
          <label for="old-reading">Tháng trước</label>
          <input id="old-reading" class="meter-input" inputmode="numeric" autocomplete="off" placeholder="00000" value="${esc(d.oldReading)}" data-in="draft" data-k="oldReading">
          <span id="kwh-preview" class="kwh-preview">= — kWh</span>
        </div>
        <div id="old-reading-msg"></div>
        <div id="replaced-slot"></div>` : `
        <label class="label" for="kwh-direct">Số kWh tháng này</label>
        <input id="kwh-direct" class="meter-input" inputmode="numeric" autocomplete="off" placeholder="0" value="${esc(d.kwh)}" data-in="draft" data-k="kwh">
        <p class="helper" style="color:#C9CDD3">Lấy từ giấy báo tiền điện hoặc tin nhắn của chủ trọ.</p>`}
    </div>

    <div class="section">
      <span class="label" id="people-label">Số người ở trong phòng</span>
      <div class="stepper" role="group" aria-labelledby="people-label">
        <button id="people-minus" class="icon-btn" data-act="people" data-v="-1" aria-label="Bớt một người">${icon('minus')}</button>
        <output id="people-count" aria-live="polite">${d.people} người</output>
        <button id="people-plus" class="icon-btn" data-act="people" data-v="1" aria-label="Thêm một người">${icon('plus')}</button>
      </div>
    </div>

    <div class="section">
      <span class="label">Chủ trọ đã khai báo tạm trú cho cả phòng?</span>
      <div class="chips fill" role="group" aria-label="Khai báo tạm trú">
        ${chip('declared-yes', 'declared', '1', 'Có khai báo', d.declared)}${chip('declared-no', 'declared', '0', 'Không / Không rõ', !d.declared)}
      </div>
      <p class="helper" id="declared-help"></p>
    </div>

    <div class="section">
      <label class="label" for="landlord-value">Chủ trọ đang thu bao nhiêu? <span class="opt">(tùy chọn)</span></label>
      <div class="field"><input id="landlord-value" inputmode="numeric" autocomplete="off" placeholder="${d.landlordUnit === 'total' ? 'Ví dụ 1.200.000' : 'Ví dụ 4.000'}" value="${esc(d.landlordValue)}" data-in="draft" data-k="landlordValue"><span class="suffix" id="landlord-suffix">${d.landlordUnit === 'total' ? 'đ tổng' : 'đ/kWh'}</span></div>
      <div class="chips" style="margin-top:8px" role="group" aria-label="Đơn vị">
        ${chip('landlord-unit-kwh', 'landlord-unit', 'perKwh', 'Theo đ/kWh', d.landlordUnit === 'perKwh')}${chip('landlord-unit-total', 'landlord-unit', 'total', 'Tổng tiền', d.landlordUnit === 'total')}
      </div>
      <p class="helper">Ghi theo giấy báo hoặc tin nhắn của chủ trọ. Có thể nhập tổng tiền thay vì đơn giá.</p>
    </div>

    <div class="section">
      <div class="row-btns">
        <div style="flex:1"><label class="label" for="room-name">Phòng</label><div class="field"><input id="room-name" autocomplete="off" value="${esc(d.room)}" data-in="draft" data-k="room" maxlength="12"></div></div>
        <div style="flex:1.4"><label class="label" for="period">Kỳ hóa đơn</label><div class="field"><select id="period" data-ch="period">${periodOptions(d.period)}</select><span class="chev">${icon('next')}</span></div></div>
      </div>
    </div>
  </section>
  ${bar('<button id="calc" class="btn btn-primary" data-act="calc">Tính tiền</button>')}`;
}

/** Cập nhật phần phụ thuộc khi gõ (không vẽ lại cả màn để giữ bàn phím). */
function refreshInput() {
  const d = state.draft;
  const k = draftKwh(d);
  const calc = $('#calc');
  if (calc) calc.disabled = !k.ok;
  $('#declared-help') && ($('#declared-help').textContent = d.declared
    ? `Có khai báo: tính bậc thang theo định mức ${d.people}/4 hộ. Không rõ: chọn "Không" để xem mức tối đa chủ trọ được thu.`
    : 'Không khai báo: toàn bộ số điện tính một giá chung. Đây cũng là mức tối đa chủ trọ được thu khi chưa khai báo.');
  if (d.inputType !== 'meter') return;
  $('#kwh-preview').textContent = k.ok ? `= ${L.formatNumber(k.kwh)} kWh` : '= — kWh';
  const showErr = !k.ok && d.newReading.trim() !== '' && (k.field === 'new' ? (d.oldReading.trim() !== '' || /\D/.test(d.newReading)) : d.oldReading.trim() !== '');
  const err = (id) => `<p id="${id}" class="error" role="alert">${icon('alert')}<span>${esc(k.error)}</span></p>`;
  $('#new-reading-msg').innerHTML = showErr && k.field === 'new' ? err('new-reading-error') : '';
  $('#old-reading-msg').innerHTML = showErr && k.field === 'old' ? err('old-reading-error') : '';
  $('#new-reading').classList.toggle('invalid', showErr && k.field === 'new');
  const smaller = !L.meterDelta(d.oldReading, d.newReading, false).ok && /nhỏ hơn/.test(L.meterDelta(d.oldReading, d.newReading, false).error);
  const slot = $('#replaced-slot');
  const wantRow = smaller || d.meterReplaced;
  if (wantRow && !$('#meter-replaced')) {
    slot.innerHTML = `<label class="check-row"><input type="checkbox" id="meter-replaced" data-ch="replaced" ${d.meterReplaced ? 'checked' : ''}><span>Công tơ vừa được thay (đếm lại từ 0)</span></label>`;
  } else if (!wantRow) slot.innerHTML = '';
}

// ---------------------------------------------------------------- màn: kết quả
function currentBill() {
  const id = new URLSearchParams(location.hash.split('?')[1] ?? '').get('h');
  if (id) {
    const h = state.history.find((x) => x.id === id);
    if (!h) return null;
    if (h.mode === 'C') return { fromHistory: h, r: { kwh: h.kwh, mode: 'C', people: h.people, period: h.period, vatRate: L.vatRateFor(h.period, tariff), tiers: [], preTax: h.total, vat: 0, total: h.total, source: 'Chia theo hóa đơn tổng của nhà trọ' }, d: h };
    return { fromHistory: h, r: L.calcBill(h.kwh, { mode: h.mode, people: h.people, period: h.period }, tariff), d: h };
  }
  const r = draftResult();
  return r ? { r, d: state.draft } : null;
}

function screenResult() {
  const bill = currentBill();
  if (!bill) { location.replace('#/nhap'); return ''; }
  const { r, d, fromHistory } = bill;
  const cmp = fromHistory ? null : draftCompare(r);
  const segs = L.tierBar(r);
  const tierLines = r.mode === 'B'
    ? `<li class="tier-line"><span>${L.formatNumber(r.kwh)} kWh × ${vnd(r.tiers[0].price)}</span><span class="v">${vnd(r.preTax)}</span></li>`
    : r.tiers.map((t) => `<li class="tier-line"><span>Bậc ${t.tier} · ${L.formatNumber(t.kwh)} kWh × ${vnd(t.price)}</span><span class="v">${vnd(t.amount)}</span></li>`).join('');
  const back = fromHistory ? '#/lich-su' : '#/nhap';
  const landlordEntry = fromHistory && fromHistory.role === 'landlord';
  return `
  <section class="screen">
    ${topbar({ back, eyebrow: fromHistory ? `Phòng ${esc(d.room)} · đã lưu` : `Phòng ${esc(d.room)}`, title: `Kết quả ${monthWord(r.period)}` })}
    <div class="card total-card">
      <p class="eyebrow">${r.mode === 'C' ? 'Phần hóa đơn tổng của phòng' : 'Tiền điện đúng quy định của phòng'}</p>
      <p id="total" class="total">${vnd(r.total)}</p>
      <p id="total-meta" class="meta">${r.mode === 'C' ? `${L.formatNumber(r.kwh)} kWh · chia theo hóa đơn tổng` : L.resultMeta(r)}</p>
      ${segs.length ? `<div id="tier-bar" class="tier-bar" role="img" aria-label="Thanh bậc giá: ${segs.map((s) => `${s.label} ${s.kwh} kWh`).join(', ')}">
        ${segs.map((s) => `<span class="tier-seg" data-tier="${s.tier}" style="flex:${s.kwh} 1 0">${s.label}</span>`).join('')}</div>` : ''}
      ${r.tiers.length ? `<ul class="lines">${tierLines}<li id="vat-line" class="muted"><span>VAT ${r.vatRate}%</span><span class="v">${vnd(r.vat)}</span></li></ul>` : ''}
      ${r.mode === 'B' ? `<p class="helper">Giá chung ${vnd(r.tiers[0].price)}/kWh khi chưa khai báo đủ người — nguồn: ${esc(r.source)}.</p>` : ''}
    </div>
    ${cmp ? compareBlock(cmp, r) : ''}
    <button id="sources-link" class="link-row" data-act="nav" data-to="#/nguon">${icon('file')}<span class="t">Căn cứ: QĐ 2892/QĐ-BCT, TT 60/2025/TT-BCT, NĐ 133/2026</span>${icon('next')}</button>
    ${fromHistory ? '' : `<p style="text-align:center;margin:8px 0 0"><button id="report-error" class="btn-link" data-act="report-error">Báo kết quả chưa đúng</button></p>`}
  </section>
  ${fromHistory
    ? bar(`<button class="btn btn-secondary" data-act="nav" data-to="${landlordEntry ? '#/nha-tro' : '#/lich-su'}">${landlordEntry ? 'Về danh sách phòng' : 'Về lịch sử'}</button>`)
    : bar(`<div class="row-btns"><button id="to-invoice" class="btn btn-secondary" data-act="nav" data-to="#/hoa-don">Lưu ảnh</button>
        <button id="to-split" class="btn btn-primary" data-act="nav" data-to="#/chia">${r.people > 1 ? `Chia cho ${r.people} người` : 'Chia tiền'}</button></div>`)}`;
}

function compareBlock(c, r) {
  const what = c.unit === 'total' ? 'Chủ trọ thu (tổng)' : `Chủ trọ thu (${vnd(c.value)} × ${L.formatNumber(r.kwh)} kWh)`;
  if (c.status === 'over') {
    return `<div id="compare" class="status" data-status="over">
      <div class="head">${icon('alert')}<span>Cao hơn mức tối đa theo quy định</span></div>
      <ul class="lines"><li><span>${what}</span><span class="v">${vnd(c.landlordTotal)}</span></li>
      <li><span>Chênh lệch mỗi tháng</span><span id="compare-diff" class="v strong">${vnd(c.diff)}</span></li></ul>
      <p id="compare-year" class="note">${L.yearlyText(c.yearly)}</p></div>`;
  }
  return `<div id="compare" class="status" data-status="ok">
    <div class="head">${icon('checkCircle')}<span>Đúng quy định</span></div>
    <ul class="lines"><li><span>${what}</span><span class="v">${vnd(c.landlordTotal)}</span></li>
    <li><span>Thấp hơn hoặc bằng mức tối đa</span><span id="compare-diff" class="v">${vnd(Math.abs(c.diff))}</span></li></ul>
    <p class="note">Số chủ trọ thu không vượt mức tính theo quy định.</p></div>`;
}

// ---------------------------------------------------------------- màn: chia tiền
function screenSplit() {
  const r = draftResult();
  if (!r) { location.replace('#/nhap'); return ''; }
  ensureSplit();
  const sp = state.split;
  const days = sp.type === 'days';
  const rows = splitRows(r);
  return `
  <section class="screen">
    ${topbar({ back: '#/ket-qua', eyebrow: `Tổng ${vnd(r.total)}`, title: 'Chia tiền điện' })}
    <div class="segment" role="group" aria-label="Cách chia">
      ${chip('split-equal', 'split-type', 'equal', 'Chia đều', !days)}${chip('split-days', 'split-type', 'days', 'Theo số ngày ở', days)}
    </div>
    <div class="card section" id="people-list">
      ${sp.people.map((p, i) => `
      <div class="person">
        <span class="avatar c${i % 3}" aria-hidden="true">${esc((p.name.trim()[0] ?? '?').toUpperCase())}</span>
        <div class="who">
          <input class="person-name" value="${esc(p.name)}" data-in="person-name" data-i="${i}" aria-label="Tên người ${i + 1}" maxlength="24">
          ${days ? `<div class="days"><input class="person-days" inputmode="numeric" value="${esc(p.days)}" data-in="person-days" data-i="${i}" aria-label="Số ngày ở của người ${i + 1}"><span>ngày</span></div>` : ''}
        </div>
        <span class="person-amount" data-i="${i}">${vnd(rows.people[i].total)}</span>
      </div>`).join('')}
    </div>
    <div id="extras">
      ${sp.extras.map((e, i) => `
      <div class="extra">
        <input class="extra-label" value="${esc(e.label)}" placeholder="Tên khoản" data-in="extra-label" data-i="${i}" aria-label="Tên khoản ${i + 1}">
        <input class="extra-amount" inputmode="numeric" value="${e.amount ? L.formatNumber(e.amount) : ''}" placeholder="Số tiền" data-in="extra-amount" data-i="${i}" aria-label="Số tiền khoản ${i + 1}">
        <button class="icon-btn" data-act="extra-remove" data-i="${i}" aria-label="Xoá khoản ${i + 1}">${icon('x')}</button>
      </div>`).join('')}
    </div>
    <button id="add-extra" class="dashed-btn" data-act="extra-add">${icon('plus')}Thêm khoản: tiền phòng, nước, wifi</button>
    <div class="match"><span>${icon('checkCircle')} Cộng lại khớp tổng</span><span id="split-sum" class="money">${vnd(rows.people.reduce((s, p) => s + p.total, 0))}</span></div>
    <p class="helper">${days ? 'Tiền chia theo tỷ lệ ngày ở.' : 'Tiền chia đều cho mọi người.'} Phần lẻ do làm tròn được cộng vào người cuối để tổng luôn khớp.</p>
  </section>
  ${bar('<button id="to-invoice" class="btn btn-primary" data-act="split-done">Tạo ảnh hóa đơn</button>')}`;
}

function refreshSplit() {
  const r = draftResult();
  if (!r) return;
  const rows = splitRows(r);
  $$('.person-amount').forEach((el) => { el.textContent = vnd(rows.people[Number(el.dataset.i)].total); });
  $('#split-sum').textContent = vnd(rows.people.reduce((s, p) => s + p.total, 0));
  $$('.person').forEach((el, i) => { el.querySelector('.avatar').textContent = (state.split.people[i].name.trim()[0] ?? '?').toUpperCase(); });
}

// ---------------------------------------------------------------- màn: ảnh hóa đơn
function invoiceContext() {
  const q = new URLSearchParams(location.hash.split('?')[1] ?? '');
  const roomId = q.get('phong');
  if (roomId) {
    const sum = L.houseSummary(state.house, tariff);
    const rs = sum.rooms.find((x) => x.id === roomId);
    const room = state.house.rooms.find((x) => x.id === roomId);
    if (!rs) return null;
    return {
      role: 'landlord', back: `#/phong/${roomId}`, roomId,
      model: St.invoiceModel({ role: 'landlord', room: room.name, period: state.house.period, oldReading: room.oldReading, newReading: room.newReading, kwh: rs.kwh,
        total: rs.total, vatRate: L.vatRateFor(state.house.period, tariff), people: [], payee: state.payee, pro: state.plan.pro, houseName: state.house.name }),
      bill: { role: 'landlord', room: room.name, period: state.house.period, kwh: rs.kwh, total: rs.total, mode: state.house.mode === 'A' && room.declared ? 'A' : state.house.mode === 'C' ? 'C' : 'B', people: room.people },
    };
  }
  const r = draftResult();
  if (!r) return null;
  const d = state.draft;
  const useSplit = state.split.people.length === d.people && state.split.period === d.period && state.split.visited;
  const rows = useSplit ? splitRows(r) : null;
  return {
    role: 'tenant', back: useSplit ? '#/chia' : '#/ket-qua',
    model: St.invoiceModel({ role: 'tenant', room: d.room, period: d.period, oldReading: d.inputType === 'meter' ? d.oldReading : null, newReading: d.newReading, kwh: r.kwh,
      total: r.total, vatRate: r.vatRate, splitLabel: useSplit ? (state.split.type === 'days' ? 'chia theo ngày ở' : 'chia đều') : '',
      people: useSplit ? state.split.people.map((p, i) => ({ name: p.name, days: state.split.type === 'days' ? p.days : null, total: rows.people[i].total })) : [],
      extras: useSplit ? state.split.extras : [],
      payee: state.payee, pro: state.plan.pro }),
    bill: { role: 'tenant', room: d.room, period: d.period, kwh: r.kwh, total: r.total, mode: r.mode, people: d.people },
  };
}

function invoiceCard(m) {
  const qr = m.qr ? qrToSvg(encodeQR(m.qr.payload), { label: m.qr.caption }) : '';
  return `
    <div class="inv-top"><div><p class="caps">${m.title}</p>${m.houseName ? `<p class="inv-house">${esc(m.houseName)}</p>` : ''}<p class="inv-heading">${esc(m.heading)}</p></div><span class="bolt">${icon('zap')}</span></div>
    <ul class="lines" style="margin-top:8px">
      <li class="muted"><span>${esc(m.readingLine)}</span><span class="v">${m.kwhLine}</span></li>
      <li class="muted"><span>${m.priceLabel}</span><span class="v">${vnd(m.total)}</span></li>
      ${m.extras.map((x) => `<li class="muted"><span>${esc(x.label)}</span><span class="v">${vnd(x.amount)}</span></li>`).join('')}
    </ul>
    <hr class="dash">
    ${m.lines.length
      ? `<ul class="lines">${m.lines.map((l) => `<li><span>${esc(l.label)}</span><span class="v">${vnd(l.amount)}</span></li>`).join('')}</ul>`
      : `<div class="big"><span class="muted">Tổng cần thu</span><span class="money">${vnd(m.total)}</span></div>`}
    <hr class="dash">
    ${m.qr
      ? `<div class="qr-block"><div id="qr" class="qr-box">${qr}</div><div class="qr-text"><strong>${esc(m.qr.caption)}</strong>${esc(m.qr.bankLine)}<br>Nội dung: ${esc(m.qr.note)}</div></div>`
      : '<p class="qr-text" style="margin:0">Thêm ngân hàng và số tài khoản bên dưới để in mã VietQR lên hóa đơn.</p>'}
    ${m.branding ? `<p class="brand-line">${m.branding}</p>` : ''}`;
}

function screenInvoice() {
  const ctx = invoiceContext();
  if (!ctx) { location.replace(state.role === 'landlord' ? '#/nha-tro' : '#/nhap'); return ''; }
  ui.lastModel = ctx.model;
  const p = state.payee;
  return `
  <section class="screen green">
    ${topbar({ back: ctx.back, title: 'Ảnh hóa đơn' })}
    <div id="invoice" class="invoice">${invoiceCard(ctx.model)}</div>
    <div class="card payee">
      <h2>${icon('qr')}Mã VietQR để nhận tiền</h2>
      <div class="grid">
        <div><label class="label" for="payee-bank">Ngân hàng</label>
          <div class="field"><select id="payee-bank" data-ch="payee" data-k="bin"><option value="">Chọn ngân hàng</option>${BANKS.map((b) => `<option value="${b.bin}" ${p.bin === b.bin ? 'selected' : ''}>${b.name}</option>`).join('')}</select><span class="chev">${icon('next')}</span></div></div>
        <div><label class="label" for="payee-account">Số tài khoản</label>
          <div class="field"><input id="payee-account" inputmode="numeric" autocomplete="off" value="${esc(p.account)}" data-in="payee" data-k="account" maxlength="19"></div></div>
        <div><label class="label" for="payee-name">Tên người nhận <span class="opt">(tùy chọn)</span></label>
          <div class="field"><input id="payee-name" autocomplete="off" value="${esc(p.name)}" placeholder="${ctx.role === 'landlord' ? 'Ví dụ: Cô Hạnh' : 'Ví dụ: Linh'}" data-in="payee" data-k="name" maxlength="24"></div></div>
      </div>
      <p class="helper">Số tài khoản chỉ lưu trên máy này. Hãy quét thử mã bằng app ngân hàng trước khi gửi.</p>
      ${state.plan.pro ? '' : '<button class="btn-link" data-act="paywall" data-v="remove_branding">Bỏ dòng chữ ứng dụng trên hóa đơn</button>'}
    </div>
  </section>
  ${bar(`<button id="share-invoice" class="btn btn-accent" data-act="export" data-v="share">${icon('share')}${ctx.role === 'landlord' ? `Gửi cho ${esc(ctx.bill.room)}` : 'Gửi cho cả phòng'}</button>
    <button id="save-invoice" class="btn btn-on-dark" data-act="export" data-v="download">${icon('download')}Lưu vào máy</button>`, 'green')}`;
}

// ---------------------------------------------------------------- màn: lịch sử
function screenHistory() {
  const h = state.history;
  const back = St.initialRoute(state);
  return `
  <section class="screen">
    ${topbar({ back, title: 'Lịch sử hóa đơn', eyebrow: 'Lưu trên máy này' })}
    ${h.length ? h.map((b) => `
      <button class="history-item" data-act="open-history" data-v="${b.id}">
        <span><strong>Phòng ${esc(b.room)} · ${L.periodLabel(b.period)}</strong><span class="m">${L.formatNumber(b.kwh)} kWh · ${b.people} người${b.role === 'landlord' ? ' · chủ trọ' : ''}</span></span>
        <span class="money">${vnd(b.total)}</span>
      </button>`).join('') : `
      <div id="history-empty" class="empty">
        <div class="tile">${icon('history')}</div><h2>Chưa có hóa đơn nào</h2>
        <p>Mỗi lần tính tiền, hóa đơn được lưu ở đây để bạn xem lại tháng sau.</p>
      </div>`}
    ${adBanner()}
  </section>
  ${bar(`<button class="btn btn-primary" data-act="nav" data-to="${back}">${state.role === 'landlord' ? 'Về danh sách phòng' : 'Tính tiền tháng mới'}</button>`)}`;
}

// ---------------------------------------------------------------- màn: nguồn & miễn trừ
function screenSources() {
  const rows = L.tariffRows(tariff);
  return `
  <section class="screen no-bar">
    ${topbar({ back: state.role ? St.initialRoute(state) : '#/chon-vai', title: 'Nguồn & miễn trừ', hist: true })}
    <div id="disclaimer" class="notice">${DISCLAIMER}</div>
    <div class="card section">
      <h2>Biểu giá đang dùng</h2>
      <table id="tariff-table" class="tariff"><thead><tr><th>Bậc</th><th>kWh/tháng</th><th>Đơn giá</th></tr></thead>
        <tbody>${rows.map((r) => `<tr><td>Bậc ${r.tier}</td><td>${r.range}</td><td>${vnd(r.price)}</td></tr>`).join('')}</tbody></table>
      <p class="helper">Chưa gồm VAT. Phiên bản <span id="tariff-version">${tariff.tariff_version}</span> · hiệu lực từ ${tariff.effective_from.split('-').reverse().join('/')} · ${esc(tariff.source)}.</p>
      <ul class="lines" style="margin-top:8px">${tariff.vat.map((v) => `<li><span>VAT ${v.to ? `đến kỳ ${L.periodLabel(v.to).toLowerCase()}` : `từ kỳ ${L.periodLabel(v.from).toLowerCase()}`}<br><span class="helper" style="margin:0">${esc(v.source)}</span></span><span class="v">${v.rate}%</span></li>`).join('')}</ul>
    </div>
    <div class="card"><h2>Khi chưa khai báo đủ người</h2><p class="helper" id="mode-b-note" style="margin:0">${MODE_B_NOTE}</p></div>
    <div class="card"><h2>Văn bản căn cứ</h2><ul class="src-list">${SOURCES.map((s) => `<li><strong>${s.code}</strong><span>${s.text}</span></li>`).join('')}</ul></div>
    <div class="card" id="privacy">
      <h2>${icon('shield')} Quyền riêng tư</h2>
      <p class="helper" style="margin-top:0">${PRIVACY}</p>
      <label class="check-row"><input type="checkbox" id="consent-toggle" data-ch="consent-toggle" ${state.consent.analytics ? 'checked' : ''}><span>Cho phép ghi thống kê ẩn danh</span></label>
      <button id="wipe-data" class="btn btn-danger" data-act="wipe">${icon('trash')}${ui.wipeArmed ? 'Bấm lần nữa để xoá hết' : 'Xoá toàn bộ dữ liệu trên máy'}</button>
    </div>
  </section>`;
}

// ---------------------------------------------------------------- màn: nhà trọ (chủ trọ)
function modeText(mode) {
  if (mode === 'A') return 'Chế độ A · bậc thang theo số người';
  if (mode === 'C') return 'Chế độ C · chia hóa đơn tổng';
  return `Chế độ B · ${vnd(tariff.undeclared_rate)}/kWh + VAT`;
}

function screenHouse() {
  const h = state.house;
  const sum = L.houseSummary(h, tariff);
  const right = `<button id="house-settings" class="icon-btn ghost" data-act="nav" data-to="#/cai-dat-nha" aria-label="Cài đặt nhà trọ">${icon('sliders')}</button>${menuBtn}`;
  const head = topbar({ eyebrow: `${esc(h.name || 'Nhà trọ của tôi')} · ${L.periodLabel(h.period)}`, title: `<span id="house-count">${sum.count} phòng</span>`, right });
  if (!sum.count) {
    return `
    <section class="screen">${head}
      <div id="empty-rooms" class="empty">
        <div class="tile">${icon('home')}</div><h2>Chưa có phòng nào</h2>
        <p>Thêm phòng đầu tiên để lập hóa đơn tháng này. Gói miễn phí dùng được ${St.FREE_ROOMS} phòng.</p>
      </div>
    </section>
    ${bar('<button id="add-first-room" class="btn btn-primary" data-act="add-room">Thêm phòng đầu tiên</button>')}`;
  }
  const unpaid = sum.rooms.filter((r) => !r.paid).length;
  const atLimit = !St.canAddRoom(state);
  return `
  <section class="screen">${head}
    <div class="summary">
      <div class="top"><span id="collected">Đã thu ${sum.paidCount}/${sum.count} phòng</span><span id="house-mode">${modeText(h.mode)}</span></div>
      <p class="big"><span id="collected-amount">${vnd(sum.collected)}</span> <small>/ ${vnd(sum.total)}</small></p>
      <div class="progress" role="progressbar" aria-label="Đã thu" aria-valuemin="0" aria-valuemax="${sum.total}" aria-valuenow="${sum.collected}"><i style="transform:scaleX(${sum.total ? sum.collected / sum.total : 0})"></i></div>
    </div>
    ${sum.rooms.map((r) => `
      <button class="room-card" data-room="${esc(r.name)}" data-act="nav" data-to="#/phong/${r.id}">
        <span><strong>${esc(r.name)}</strong><span class="m">${r.people} người · ${r.hasReading ? `${L.formatNumber(r.kwh)} kWh` : 'chưa nhập chỉ số'}</span></span>
        <span class="r"><span class="money">${r.hasReading ? vnd(r.total) : '—'}</span>
          ${r.paid ? `<span class="badge paid">${icon('check')}Đã thu</span>` : `<span class="badge unpaid">${icon('alert')}Chưa thu</span>`}</span>
      </button>`).join('')}
    <button id="add-room" class="dashed-btn add-room" data-act="add-room">
      <span class="t"><strong>+ Thêm phòng</strong>${atLimit ? `<span>Từ phòng thứ ${St.roomLimit(state) + 1} dùng Chủ Trọ Pro</span>` : ''}</span>${atLimit ? '<span class="badge pro">PRO</span>' : ''}
    </button>
    ${adBanner()}
  </section>
  ${bar(`<button id="send-unpaid" class="btn btn-primary" data-act="send-unpaid" ${unpaid ? '' : 'disabled'}>${unpaid ? `Gửi hóa đơn ${unpaid} phòng chưa thu` : 'Đã thu đủ các phòng'}</button>`)}`;
}

// ---------------------------------------------------------------- màn: phòng
function screenRoom(id) {
  const isNew = id === 'moi';
  if (!ui.roomDraft || ui.roomDraft._for !== id) {
    const src = isNew ? { name: `P${101 + state.house.rooms.length}`, people: 1, declared: false, oldReading: '', newReading: '', replaced: false, paid: false }
      : state.house.rooms.find((r) => r.id === id);
    if (!src) { location.replace('#/nha-tro'); return ''; }
    ui.roomDraft = { ...src, _for: id };
  }
  const r = ui.roomDraft;
  return `
  <section class="screen">
    ${topbar({ back: '#/nha-tro', eyebrow: L.periodLabel(state.house.period), title: isNew ? 'Thêm phòng' : `Phòng ${esc(r.name)}` })}
    <label class="label" for="room-name-input">Tên phòng</label>
    <div class="field"><input id="room-name-input" autocomplete="off" value="${esc(r.name)}" data-in="room" data-k="name" maxlength="12"></div>
    <div class="section">
      <span class="label" id="room-people-label">Số người ở</span>
      <div class="stepper" role="group" aria-labelledby="room-people-label">
        <button id="room-people-minus" class="icon-btn" data-act="room-people" data-v="-1" aria-label="Bớt một người">${icon('minus')}</button>
        <output id="room-people-count">${r.people} người</output>
        <button id="room-people-plus" class="icon-btn" data-act="room-people" data-v="1" aria-label="Thêm một người">${icon('plus')}</button>
      </div>
    </div>
    <div class="section">
      <span class="label">Đã khai báo tạm trú cho cả phòng?</span>
      <div class="chips fill">${chip('room-declared-yes', 'room-declared', '1', 'Có khai báo', r.declared)}${chip('room-declared-no', 'room-declared', '0', 'Chưa', !r.declared)}</div>
      <p class="helper">Chỉ dùng khi nhà trọ tính theo chế độ A (bậc thang theo số người).</p>
    </div>
    <div class="meter section">
      <label class="label" for="room-new">Chỉ số mới (đọc trên công tơ)</label>
      <input id="room-new" class="meter-input" inputmode="numeric" autocomplete="off" placeholder="00000" value="${esc(r.newReading)}" data-in="room" data-k="newReading">
      <div id="room-new-msg"></div>
      <div class="meter-row"><label for="room-old">Tháng trước</label>
        <input id="room-old" class="meter-input" inputmode="numeric" autocomplete="off" placeholder="00000" value="${esc(r.oldReading)}" data-in="room" data-k="oldReading">
        <span id="room-kwh" class="kwh-preview">= — kWh</span></div>
    </div>
    <div class="match"><span>Tiền điện tháng này</span><span id="room-amount" class="money">—</span></div>
    ${isNew ? '' : `
      <button id="room-invoice" class="link-row" data-act="nav" data-to="#/hoa-don?phong=${id}">${icon('receipt')}<span class="t">Ảnh hóa đơn phòng này</span>${icon('next')}</button>
      <button id="room-delete" class="btn btn-danger section" data-act="room-delete">${icon('trash')}Xoá phòng</button>`}
  </section>
  ${bar(isNew ? '<button id="room-save" class="btn btn-primary" data-act="room-save">Lưu phòng</button>'
    : `<div class="row-btns"><button id="room-save" class="btn btn-secondary" data-act="room-save">Lưu</button>
       <button id="room-mark-paid" class="btn btn-primary" data-act="room-paid">${r.paid ? 'Bỏ đánh dấu đã thu' : 'Đánh dấu đã thu'}</button></div>`)}`;
}

function refreshRoom() {
  const r = ui.roomDraft;
  if (!r) return;
  const d = L.meterDelta(r.oldReading, r.newReading, false);
  const typed = r.newReading.trim() !== '' && r.oldReading.trim() !== '';
  $('#room-kwh').textContent = d.ok ? `= ${L.formatNumber(d.kwh)} kWh` : '= — kWh';
  $('#room-new-msg').innerHTML = !d.ok && typed ? `<p id="room-new-error" class="error" role="alert">${icon('alert')}<span>${esc(d.error)}</span></p>` : '';
  let amount = '—';
  if (d.ok) {
    const others = state.house.rooms.filter((x) => x.id !== r.id);
    const tmp = { ...state.house, rooms: [...others, { ...r, id: r.id ?? '_new' }] };
    const row = L.houseSummary(tmp, tariff).rooms.at(-1);
    amount = vnd(row.total);
  }
  $('#room-amount').textContent = amount;
  $('#room-save').disabled = (!d.ok && typed) || !r.name.trim();
  const pc = $('#room-people-count');
  if (pc) pc.textContent = `${r.people} người`;
}

// ---------------------------------------------------------------- màn: cài đặt nhà
function screenHouseSettings() {
  if (!ui.houseDraft) ui.houseDraft = { mode: state.house.mode, evnTotal: state.house.evnTotal, name: state.house.name };
  const h = ui.houseDraft;
  const opt = (m, title, desc) => `
    <button id="mode-${m.toLowerCase()}" class="option-card" data-act="house-mode" data-v="${m}" aria-pressed="${h.mode === m}">
      <span class="t"><strong>${title}</strong><span class="d">${desc}</span></span><span class="tick">${icon('checkCircle')}</span></button>`;
  return `
  <section class="screen">
    ${topbar({ back: '#/nha-tro', title: 'Cài đặt nhà trọ', eyebrow: L.periodLabel(state.house.period) })}
    <span class="label">Cách tính tiền điện cho các phòng</span>
    ${opt('A', 'A · Có khai báo tạm trú', 'Bậc thang theo số người từng phòng (4 người = 1 hộ).')}
    ${opt('B', 'B · Chưa khai báo đủ', `Một giá chung ${vnd(tariff.undeclared_rate)}/kWh + VAT.`)}
    ${opt('C', 'C · Chia hóa đơn tổng', 'Chia đúng số tiền trên hóa đơn điện theo kWh từng phòng.')}
    ${h.mode === 'C' ? `<div class="section"><label class="label" for="evn-total">Tổng tiền trên hóa đơn điện của công tơ tổng</label>
      <div class="field"><input id="evn-total" inputmode="numeric" value="${h.evnTotal ? L.formatNumber(h.evnTotal) : ''}" placeholder="Ví dụ 1.000.000" data-in="house" data-k="evnTotal"><span class="suffix">đ</span></div>
      <p class="helper">Tổng thu các phòng luôn bằng đúng số này — không thu vượt hóa đơn.</p></div>` : ''}
    <div class="section">
      <label class="label" for="house-name">Tên nhà trọ trên hóa đơn ${state.plan.pro ? '' : '<span class="badge pro">PRO</span>'}</label>
      <div class="field"><input id="house-name" autocomplete="off" value="${esc(h.name)}" placeholder="Ví dụ: Nhà trọ Cô Hạnh" data-in="house" data-k="name" ${state.plan.pro ? '' : 'disabled'} maxlength="40"></div>
      ${state.plan.pro ? '' : '<button class="btn-link" data-act="paywall" data-v="remove_branding">Mở khóa với Chủ Trọ Pro</button>'}
    </div>
    <div class="section">
      <span class="label">Sang tháng mới</span>
      <button id="next-month" class="dashed-btn" data-act="next-month" style="margin-top:0">${icon('swap')}Chốt ${monthWord(state.house.period)}, sang ${monthWord(L.nextPeriod(state.house.period))}</button>
      <p class="helper">Chỉ số mới thành chỉ số tháng trước, trạng thái "đã thu" được xoá. Hóa đơn tháng này vẫn ở Lịch sử.</p>
    </div>
  </section>
  ${bar('<button id="house-save" class="btn btn-primary" data-act="house-save">Lưu</button>')}`;
}

// ---------------------------------------------------------------- màn: gửi hàng loạt
function screenBatch() {
  const sum = L.houseSummary(state.house, tariff);
  const unpaid = sum.rooms.filter((r) => !r.paid);
  return `
  <section class="screen">
    ${topbar({ back: '#/nha-tro', eyebrow: L.periodLabel(state.house.period), title: `Gửi hóa đơn ${unpaid.length} phòng` })}
    ${state.payee.bin && state.payee.account ? '' : `<div class="notice">Chưa có tài khoản nhận tiền. Mở "Ảnh hóa đơn" của một phòng để thêm ngân hàng — mã VietQR có sẵn số tiền từng phòng.</div>`}
    <div class="card section">
      ${unpaid.map((r, i) => `
        <div class="batch-item" ${i ? 'style="margin-top:14px"' : ''}>
          <span class="t"><strong>${esc(r.name)}</strong><span class="m">${r.people} người · ${L.formatNumber(r.kwh)} kWh · ${vnd(r.total)}</span></span>
          <button class="btn btn-secondary batch-share" data-act="batch-share" data-v="${r.id}" aria-label="Gửi hóa đơn ${esc(r.name)}">${icon('share')}Gửi</button>
        </div>`).join('') || '<p class="helper" style="margin:0">Các phòng đều đã thu.</p>'}
    </div>
  </section>
  ${bar(`<button id="batch-save-all" class="btn btn-primary" data-act="batch-all" ${unpaid.length ? '' : 'disabled'}>${icon('download')}Lưu tất cả ảnh (${unpaid.length})</button>`)}`;
}

// ---------------------------------------------------------------- màn: Pro / Premium
function screenPaywall() {
  const landlord = state.role !== 'tenant';
  const plans = landlord ? [St.PLANS.year, St.PLANS.month] : [St.PREMIUM.lifetime, St.PREMIUM.month];
  ui.plan = plans.some((p) => p.id === ui.plan) ? ui.plan : plans[0].id;
  const feats = landlord
    ? ['Không giới hạn số phòng', 'Hóa đơn mang tên nhà trọ của bạn, bỏ dòng chữ ứng dụng', 'Nhắc thu tiền phòng chưa trả (sắp có)', 'Tổng doanh thu cả năm, sẵn sàng cho khai báo 31/1 (sắp có)', 'Không quảng cáo']
    : ['Không quảng cáo', 'Bỏ dòng chữ ứng dụng trên ảnh hóa đơn', 'Dự báo hóa đơn giữa tháng (sắp có)', 'Sao lưu Google Drive (sắp có)'];
  const ids = ['plan-yearly', 'plan-monthly'];
  return `
  <section class="screen" id="paywall">
    <header class="topbar"><div class="titles"></div><button id="paywall-close" class="icon-btn" data-act="paywall-close" aria-label="Đóng">${icon('x')}</button></header>
    <span class="pro-badge">${landlord ? 'CHỦ TRỌ PRO' : 'PREMIUM'}</span>
    <h1 class="hero" id="screen-title" style="margin-top:12px">${landlord ? 'Thu đúng, đủ, đúng hạn cho cả dãy trọ.' : 'Dùng Hóa Đơn Trọ không quảng cáo.'}</h1>
    <ul class="feature-list">${feats.map((f) => `<li>${icon('check')}<span>${f}</span></li>`).join('')}</ul>
    ${plans.map((p, i) => `
      <button id="${ids[i]}" class="option-card" data-act="plan" data-v="${p.id}" aria-pressed="${ui.plan === p.id}">
        <span class="tick">${icon('checkCircle')}</span>
        <span class="t"><strong>${p.label}</strong>${p.savePct ? `<span class="d">Tiết kiệm ${p.savePct}% so với theo tháng</span>` : p.note ? `<span class="d">${p.note}</span>` : ''}</span>
        <span class="price">${vnd(p.price)}</span>
      </button>`).join('')}
    ${landlord && ui.paywallTrigger === 'room_limit' && !state.plan.pro ? `<button id="rewarded-room" class="dashed-btn" data-act="rewarded">${icon('play')}Xem quảng cáo để mở thêm 1 phòng tạm thời</button>` : ''}
    <p class="helper">${landlord ? St.PLANS.renewNote : St.PREMIUM.renewNote}</p>
    <p style="text-align:center;margin:4px 0 0"><button id="restore" class="btn-link" data-act="restore">Khôi phục giao dịch đã mua</button></p>
  </section>
  ${bar(`<button id="buy-pro" class="btn btn-primary" data-act="buy">${state.plan.pro ? 'Bạn đang dùng bản trả phí' : landlord ? 'Nâng cấp Chủ Trọ Pro' : 'Nâng cấp Premium'}</button>
    <p class="fine">Bản thử nghiệm: không trừ tiền thật.</p>`)}`;
}

// ---------------------------------------------------------------- lớp phủ
function openMenu() {
  const landlord = state.role === 'landlord';
  overlay.innerHTML = `
  <div class="scrim" data-act="menu-close-bg">
    <div class="sheet" role="dialog" aria-modal="true" aria-label="Menu">
      <div class="grab"></div>
      <button id="menu-history" class="menu-row" data-act="menu-go" data-v="#/lich-su">${icon('history')}Lịch sử hóa đơn</button>
      <button id="menu-sources" class="menu-row" data-act="menu-go" data-v="#/nguon">${icon('file')}Nguồn & miễn trừ</button>
      <button id="menu-pro" class="menu-row" data-act="menu-pro">${icon('crown')}${landlord ? 'Chủ Trọ Pro' : 'Tắt quảng cáo'}</button>
      <button id="menu-switch-role" class="menu-row" data-act="menu-go" data-v="#/chon-vai">${icon('swap')}Đổi vai (đang là ${landlord ? 'chủ trọ' : 'người thuê'})</button>
      <button id="menu-close" class="menu-row" data-act="menu-close">${icon('x')}Đóng</button>
    </div>
  </div>`;
  $('#menu-history').focus();
}
let adResolve = null;
const closeOverlay = () => { overlay.innerHTML = ''; if (adResolve) { const r = adResolve; adResolve = null; r(); } };

function showAd({ title, rewarded }) {
  track('ad_impression', { placement: rewarded ? 'rewarded_room' : 'interstitial_export' });
  return new Promise((resolve) => {
    overlay.innerHTML = `
    <div class="scrim" style="align-items:center" id="interstitial" role="dialog" aria-modal="true" aria-label="Quảng cáo">
      <div class="ad-card"><p class="caps" style="margin:0">Quảng cáo (thử)</p>
        <div class="ad-box">${title}</div>
        <button id="interstitial-close" class="btn btn-primary">${rewarded ? 'Xem xong, nhận thưởng' : 'Đóng quảng cáo'}</button></div>
    </div>`;
    adResolve = resolve;
    $('#interstitial-close').addEventListener('click', closeOverlay, { once: true });
  });
}

let toastTimer;
function toast(msg) {
  $('#toast')?.remove();
  const t = document.createElement('div');
  t.id = 'toast';
  t.className = 'toast';
  t.setAttribute('role', 'status');
  t.innerHTML = `${icon('checkCircle')}<span>${esc(msg)}</span>`;
  document.body.appendChild(t);
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => t.remove(), 3200);
}

// ---------------------------------------------------------------- xuất ảnh
function downloadBlob(blob, name) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = name;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 4000);
}

async function exportInvoice(model, bill, channel, opts = {}) {
  try { await doExport(model, bill, channel, opts); } catch (e) {
    ui.exportStage = `lỗi: ${e?.message}`;
    toast('Chưa tạo được ảnh, thử lại nhé');
  }
}

async function doExport(model, bill, channel, { silentToast = false } = {}) {
  const now = Date.now();
  ui.exportStage = 'bắt đầu';
  if (St.shouldShowInterstitial(state.ads, now, state.plan.pro)) {
    await showAd({ title: 'Quảng cáo xen kẽ trước khi xuất ảnh (gói miễn phí)' });
    set({ ...state, ads: St.markInterstitial(state.ads, Date.now()) });
  }
  ui.exportStage = 'vẽ ảnh';
  const blob = await renderInvoicePNG(model);
  ui.exportStage = 'lưu/chia sẻ';
  const name = `hoa-don-${L.periodShort(bill.period)}-${bill.room}.png`.replace(/[^\w.-]+/g, '-');
  let used = 'download';
  const file = typeof File === 'function' ? new File([blob], name, { type: 'image/png' }) : null;
  // Chia sẻ của máy chỉ dùng trên điện thoại/máy cảm ứng (mở Zalo…); máy tính thì lưu ảnh để kéo vào Zalo PC.
  const touch = matchMedia('(pointer: coarse)').matches || navigator.maxTouchPoints > 0;
  if (channel === 'share' && touch && file && navigator.canShare?.({ files: [file] })) {
    try {
      await navigator.share({ files: [file], title: model.heading, text: `Tiền điện ${model.heading}: ${vnd(model.total)}` });
      used = 'share';
    } catch (e) {
      if (e?.name === 'AbortError') return;
      downloadBlob(blob, name);
    }
  } else {
    downloadBlob(blob, name);
  }
  ui.lastExport = { name, size: blob.size, channel: used, at: Date.now() };
  const prev = state.history.find((b) => b.role === bill.role && b.room === bill.room && b.period === bill.period);
  set({ ...state, ads: St.recordExport(state.ads, Date.now()), history: St.upsertHistory(state.history, { ...prev, ...bill, id: prev?.id }) });
  track('bill_image_shared', St.sharedEvent({ role: bill.role, hasQr: !!model.qr, channel: used }));
  ui.exportStage = 'xong';
  if (!silentToast) toast(used === 'share' ? 'Đã mở chia sẻ ảnh hóa đơn' : 'Đã lưu ảnh vào máy');
}

function landlordRoomExport(roomId) {
  const sum = L.houseSummary(state.house, tariff);
  const rs = sum.rooms.find((x) => x.id === roomId);
  const room = state.house.rooms.find((x) => x.id === roomId);
  const model = St.invoiceModel({ role: 'landlord', room: room.name, period: state.house.period, oldReading: room.oldReading, newReading: room.newReading, kwh: rs.kwh,
    total: rs.total, vatRate: L.vatRateFor(state.house.period, tariff), people: [], payee: state.payee, pro: state.plan.pro, houseName: state.house.name });
  const bill = { role: 'landlord', room: room.name, period: state.house.period, kwh: rs.kwh, total: rs.total, mode: state.house.mode, people: room.people };
  return { model, bill };
}

function openPaywall(trigger) {
  ui.paywallTrigger = trigger;
  ui.paywallFrom = location.hash;
  track('paywall_viewed', { trigger });
  go('#/pro');
}

// ---------------------------------------------------------------- thao tác (bấm)
const ACT = {
  nav: (el) => go(el.dataset.to),
  back: (el) => { if (ui.navCount > 1) history.back(); else go(el.dataset.to); },
  'pick-role': (el) => {
    ui.pendingRole = el.dataset.v;
    $$('.role-card').forEach((c) => c.setAttribute('aria-pressed', String(c.dataset.v === ui.pendingRole)));
    $('#onboard-continue').disabled = false;
  },
  onboard: () => {
    const switching = state.role && state.role !== ui.pendingRole;
    set(St.completeOnboarding(state, ui.pendingRole, ui.consent || state.consent.analytics));
    if (switching) ui.roomDraft = null;
    ui.pendingRole = null;
    go(St.initialRoute(state));
  },
  menu: openMenu,
  'menu-close': closeOverlay,
  'menu-close-bg': (el, e) => { if (e.target === el) closeOverlay(); },
  'menu-go': (el) => { closeOverlay(); if (el.dataset.v === '#/chon-vai') ui.pendingRole = state.role; go(el.dataset.v); },
  'menu-pro': () => { closeOverlay(); openPaywall(state.role === 'landlord' ? 'room_limit' : 'remove_ads'); },
  'input-type': (el) => { set({ ...state, draft: { ...state.draft, inputType: el.dataset.v } }); render(); },
  people: (el) => {
    const people = L.clampPeople(state.draft.people + Number(el.dataset.v));
    set({ ...state, draft: { ...state.draft, people } });
    $('#people-count').textContent = `${people} người`;
    refreshInput();
  },
  declared: (el) => { set({ ...state, draft: { ...state.draft, declared: el.dataset.v === '1' } }); render(); },
  'landlord-unit': (el) => { set({ ...state, draft: { ...state.draft, landlordUnit: el.dataset.v } }); render(); },
  calc: () => {
    const r = draftResult();
    if (!r) return;
    const d = state.draft;
    track('reading_entered', { role: 'tenant', input_type: d.inputType });
    track('bill_calculated', St.calculatedEvent(r));
    const cmp = draftCompare(r);
    if (cmp) track('landlord_compare_done', { overcharge_bucket: cmp.bucket });
    set({ ...state, history: St.upsertHistory(state.history, {
      role: 'tenant', room: d.room, period: d.period, kwh: r.kwh, total: r.total, mode: r.mode, people: d.people, declared: d.declared,
      inputType: d.inputType, oldReading: d.oldReading, newReading: d.newReading, landlordValue: d.landlordValue, landlordUnit: d.landlordUnit,
    }) });
    go('#/ket-qua');
  },
  'report-error': () => { track('calc_error_reported', { mode: state.draft.declared ? 'A' : 'B' }); toast('Cảm ơn bạn, đã ghi nhận để kiểm tra lại'); },
  'split-type': (el) => { set({ ...state, split: { ...state.split, type: el.dataset.v } }); render(); },
  'extra-add': () => { set({ ...state, split: { ...state.split, extras: [...state.split.extras, { label: '', amount: 0 }] } }); render(); $$('.extra-label').at(-1)?.focus(); },
  'extra-remove': (el) => { set({ ...state, split: { ...state.split, extras: state.split.extras.filter((_, i) => i !== Number(el.dataset.i)) } }); render(); },
  'split-done': () => {
    set({ ...state, split: { ...state.split, visited: true } });
    track('bill_split', St.splitEvent(state.split));
    go('#/hoa-don');
  },
  export: async (el) => {
    const ctx = invoiceContext();
    if (!ctx) return;
    el.disabled = true;
    try { await exportInvoice(ctx.model, ctx.bill, el.dataset.v); } finally { el.disabled = false; }
  },
  paywall: (el) => openPaywall(el.dataset.v),
  'open-history': (el) => {
    const h = state.history.find((x) => x.id === el.dataset.v);
    if (!h) return;
    if (h.role === 'tenant' && h.inputType) {
      set({ ...state, draft: { ...state.draft, room: h.room, period: h.period, inputType: h.inputType, oldReading: h.oldReading ?? '', newReading: h.newReading ?? '',
        kwh: h.inputType === 'kwh' ? String(h.kwh) : state.draft.kwh, people: h.people, declared: h.declared, landlordValue: h.landlordValue ?? '', landlordUnit: h.landlordUnit ?? 'perKwh', meterReplaced: false } });
      go('#/ket-qua');
    } else go(`#/ket-qua?h=${h.id}`);
  },
  wipe: () => {
    if (!ui.wipeArmed) { ui.wipeArmed = true; render(); return; }
    ui.wipeArmed = false;
    try { localStorage.removeItem(St.STORAGE_KEY); } catch { /* bỏ qua */ }
    state = St.wipeState();
    ui.pendingRole = null;
    toast('Đã xoá toàn bộ dữ liệu trên máy');
    go('#/chon-vai');
  },
  'add-room': () => {
    if (!St.canAddRoom(state)) { openPaywall('room_limit'); return; }
    ui.roomDraft = null;
    go('#/phong/moi');
  },
  'room-people': (el) => { ui.roomDraft.people = L.clampPeople(ui.roomDraft.people + Number(el.dataset.v)); refreshRoom(); },
  'room-declared': (el) => { ui.roomDraft.declared = el.dataset.v === '1'; render(); },
  'room-save': () => saveRoom(false),
  'room-paid': () => saveRoom(true),
  'room-delete': () => {
    const r = ui.roomDraft;
    set(St.removeRoom(state, r.id));
    ui.roomDraft = null;
    toast(`Đã xoá phòng ${r.name}`);
    go('#/nha-tro');
  },
  'house-mode': (el) => { ui.houseDraft.mode = el.dataset.v; render(); },
  'house-save': () => {
    const h = ui.houseDraft;
    set({ ...state, house: { ...state.house, mode: h.mode, evnTotal: L.parseAmount(h.evnTotal) ?? '', name: state.plan.pro ? h.name.trim() : state.house.name } });
    ui.houseDraft = null;
    toast('Đã lưu cài đặt');
    go('#/nha-tro');
  },
  'next-month': () => {
    const label = monthWord(L.nextPeriod(state.house.period));
    set({ ...state, house: L.rollMonth(state.house) });
    ui.houseDraft = null;
    toast(`Đã sang ${label}`);
    go('#/nha-tro');
  },
  'send-unpaid': () => {
    const n = St.unpaidRooms(state).length;
    track('batch_bills_created', { room_count: n });
    go('#/gui-hang-loat');
  },
  'batch-share': async (el) => {
    const { model, bill } = landlordRoomExport(el.dataset.v);
    el.disabled = true;
    try { await exportInvoice(model, bill, 'share'); } finally { el.disabled = false; }
  },
  'batch-all': async (el) => {
    el.disabled = true;
    const ids = St.unpaidRooms(state).map((r) => r.id);
    try {
      for (const id of ids) { const { model, bill } = landlordRoomExport(id); await exportInvoice(model, bill, 'download', { silentToast: true }); }
      toast(`Đã lưu ${ids.length} ảnh hóa đơn vào máy`);
    } finally { el.disabled = false; }
  },
  plan: (el) => { ui.plan = el.dataset.v; render(); },
  buy: () => {
    if (state.plan.pro) return;
    set(St.purchasePro(state, ui.plan));
    toast('Đã nâng cấp (bản thử, không trừ tiền)');
    if (ui.paywallTrigger === 'room_limit' && state.role === 'landlord') { ui.roomDraft = null; go('#/phong/moi'); } else go(ui.paywallFrom || St.initialRoute(state));
  },
  restore: () => toast('Chưa tìm thấy giao dịch nào trên tài khoản Google Play này (bản thử)'),
  rewarded: async () => {
    await showAd({ title: 'Quảng cáo có thưởng: xem xong mở thêm 1 phòng', rewarded: true });
    set(St.grantRewardedRoom(state));
    toast('Đã mở thêm 1 phòng');
    ui.roomDraft = null;
    go('#/phong/moi');
  },
  'paywall-close': () => go(ui.paywallFrom && ui.paywallFrom !== '#/pro' ? ui.paywallFrom : St.initialRoute(state)),
};

function saveRoom(togglePaid) {
  const r = ui.roomDraft;
  const isNew = r._for === 'moi';
  const clean = { name: r.name.trim(), people: r.people, declared: r.declared, oldReading: r.oldReading.trim(), newReading: r.newReading.trim() };
  if (isNew) {
    const res = St.addRoom(state, clean);
    if (!res.ok) { openPaywall('room_limit'); return; }
    set(res.state);
    toast(`Đã thêm phòng ${clean.name}`);
  } else {
    let s = St.updateRoom(state, r.id, clean);
    if (togglePaid) s = St.setRoomPaid(s, r.id, !r.paid);
    set(s);
    toast(togglePaid ? (!r.paid ? `Đã đánh dấu ${clean.name} đã thu` : `Đã bỏ đánh dấu ${clean.name}`) : `Đã lưu ${clean.name}`);
  }
  ui.roomDraft = null;
  go('#/nha-tro');
}

// ---------------------------------------------------------------- thao tác (gõ / chọn)
const IN = {
  draft: (el) => { set({ ...state, draft: { ...state.draft, [el.dataset.k]: el.value } }); refreshInput(); if (el.dataset.k === 'room') $('.eyebrow').textContent = `Phòng ${el.value}`; },
  'person-name': (el) => { const people = state.split.people.map((p, i) => (i === Number(el.dataset.i) ? { ...p, name: el.value } : p)); set({ ...state, split: { ...state.split, people } }); refreshSplit(); },
  'person-days': (el) => {
    const v = Math.max(0, Math.min(31, Number(el.value.replace(/\D/g, '')) || 0));
    const people = state.split.people.map((p, i) => (i === Number(el.dataset.i) ? { ...p, days: v } : p));
    set({ ...state, split: { ...state.split, people } });
    refreshSplit();
  },
  'extra-label': (el) => { const extras = state.split.extras.map((x, i) => (i === Number(el.dataset.i) ? { ...x, label: el.value } : x)); set({ ...state, split: { ...state.split, extras } }); },
  'extra-amount': (el) => { const extras = state.split.extras.map((x, i) => (i === Number(el.dataset.i) ? { ...x, amount: L.parseAmount(el.value) ?? 0 } : x)); set({ ...state, split: { ...state.split, extras } }); refreshSplit(); },
  payee: (el) => { set({ ...state, payee: { ...state.payee, [el.dataset.k]: el.dataset.k === 'account' ? el.value.replace(/\s/g, '') : el.value } }); refreshInvoice(); },
  room: (el) => { ui.roomDraft[el.dataset.k] = el.value; refreshRoom(); },
  house: (el) => { ui.houseDraft[el.dataset.k] = el.value; },
};
const CH = {
  consent: (el) => { ui.consent = el.checked; },
  'consent-toggle': (el) => { set({ ...state, consent: { analytics: el.checked } }); },
  replaced: (el) => { set({ ...state, draft: { ...state.draft, meterReplaced: el.checked } }); refreshInput(); },
  period: (el) => { set({ ...state, draft: { ...state.draft, period: el.value } }); render(); },
  payee: (el) => { set({ ...state, payee: { ...state.payee, [el.dataset.k]: el.value } }); refreshInvoice(); },
};

function refreshInvoice() {
  const ctx = invoiceContext();
  if (!ctx || !$('#invoice')) return;
  ui.lastModel = ctx.model;
  $('#invoice').innerHTML = invoiceCard(ctx.model);
}

document.addEventListener('click', (e) => {
  const el = e.target.closest('[data-act]');
  if (!el || el.disabled || !ACT[el.dataset.act]) return;
  ACT[el.dataset.act](el, e);
});
document.addEventListener('input', (e) => { const el = e.target.closest('[data-in]'); if (el && IN[el.dataset.in]) IN[el.dataset.in](el, e); });
document.addEventListener('change', (e) => { const el = e.target.closest('[data-ch]'); if (el && CH[el.dataset.ch]) CH[el.dataset.ch](el, e); });
document.addEventListener('focusout', (e) => {
  const n = L.parseAmount(e.target.value);
  if (n == null) return;
  if (e.target.id === 'landlord-value') { e.target.value = L.formatNumber(n); set({ ...state, draft: { ...state.draft, landlordValue: e.target.value } }); }
  if (e.target.id === 'evn-total' || e.target.classList?.contains('extra-amount')) e.target.value = L.formatNumber(n);
});
document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && overlay.innerHTML && !$('#interstitial')) closeOverlay(); });

// ---------------------------------------------------------------- điều hướng
function render() {
  const [path] = location.hash.slice(1).split('?');
  const seg = path.split('/').filter(Boolean);
  const open = ['chon-vai', 'nguon'];
  if (!state.role && !open.includes(seg[0])) { location.replace('#/chon-vai'); return; }
  if (!['phong'].includes(seg[0])) ui.roomDraft = null;
  if (seg[0] !== 'cai-dat-nha') ui.houseDraft = null;
  if (seg[0] !== 'nguon') ui.wipeArmed = false;
  closeOverlay();
  const screens = {
    'chon-vai': screenOnboarding, nhap: screenInput, 'ket-qua': screenResult, chia: screenSplit, 'hoa-don': screenInvoice,
    'lich-su': screenHistory, nguon: screenSources, 'nha-tro': screenHouse, phong: () => screenRoom(seg[1] ?? 'moi'),
    'cai-dat-nha': screenHouseSettings, 'gui-hang-loat': screenBatch, pro: screenPaywall,
  };
  const fn = screens[seg[0]];
  if (!fn) { location.replace(St.initialRoute(state)); return; }
  const html = fn();
  if (!html) return;
  app.innerHTML = html;
  const routeKey = location.hash.split('?')[0];
  if (routeKey !== ui.lastRoute) app.querySelector('.screen')?.classList.add('enter');
  ui.lastRoute = routeKey;
  document.body.classList.toggle('on-green', seg[0] === 'hoa-don');
  window.scrollTo(0, 0);
  if (seg[0] === 'nhap') refreshInput();
  if (seg[0] === 'phong') refreshRoom();
}

ui.navCount = 0;
window.addEventListener('hashchange', () => { ui.navCount += 1; render(); });
if (!location.hash || location.hash === '#' || location.hash === '#/') location.replace(St.initialRoute(state));
render();

if ('serviceWorker' in navigator && location.protocol.startsWith('http')) {
  navigator.serviceWorker.register('sw.js').catch(() => { /* vẫn chạy online */ });
}

// Hợp đồng với bot (2-environment/bot.mjs): đọc trạng thái, không điều khiển.
window.__app = {
  state: () => state,
  route: () => location.hash,
  result: () => draftResult(),
  invoice: () => ui.lastModel,
  qrPayload: () => ui.lastModel?.qr?.payload ?? null,
  lastExport: () => ui.lastExport,
  exportStage: () => ui.exportStage,
  events: () => state.events,
};
