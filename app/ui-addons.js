// Giao diện add-on phase 10: Combo (F28), Kiểm tra đơn (F29), Kiểm tra cả file (F30).
// Chỉ vẽ + nhận thao tác; phép tính ở addons.js, trạng thái ở store.js, đọc file ở xlsx.js. Selector: 1-wiki/screens.md
import * as A from './addons.js';
import * as St from './store.js';
import * as E from './engine.js';
import * as P from './presets.js';
import { readIncomeFile, fileErrorText } from './xlsx.js';
import { icon } from './icons.js';

const $ = (s, r = document) => r.querySelector(s);
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
const vnd = E.formatVnd;
const pctIn = (r) => (r != null ? String(Math.round(r * 10000) / 100).replace('.', ',') : '');
const pctShow = (r) => `${String(Math.round(r * 1000) / 10).replace('.', ',')}%`;
const money = (v) => (v ? E.formatMoneyInput(String(Math.round(v))) : '');

/** ctx: { state, set, track, render, go, presets, config, pro, openPaywall, afterPro, overlay, closeOverlay, toast, copyText, top, now, shortName } */
export function createAddons(ctx) {
  const gated = () => !!ctx.config.pro_gates_enabled && !ctx.pro();
  const S = () => ctx.state();
  const PR = () => ctx.presets();
  const ui = { combo: null, comboSession: false, chk: null, file: null, fileFilter: 'all', fileError: null };

  // ============================================================== F28 Combo
  const sampleDraft = () => ({ ...structuredClone(A.SAMPLE_COMBO), id: null, name: '', sample: true });
  function emptyDraft() {
    const c = S().calc ?? {};
    return { id: null, name: '', mode: 'promo', platform: c.platform && c.platform !== 'multi' ? c.platform : 'shopee', pack: c.pack || 0, ship: 0,
      programs: [...(c.programs ?? [])], vat: c.vat ?? true, pit: c.pit ?? true, discount: ['percent', 0.1], bundleCat: null, items: [] };
  }
  /** Bản đang xem: chưa Pro → luôn ví dụ mẫu chỉ xem. */
  function draft() {
    if (gated()) { if (!ui.combo?.sample) ui.combo = sampleDraft(); return ui.combo; }
    if (!ui.combo || ui.combo.sample) ui.combo = { ...(ui.combo ?? sampleDraft()), sample: false, name: '3 móc khóa' };
    return ui.combo;
  }
  const readOnly = () => gated();
  const lockAct = (act) => (readOnly() ? 'data-act="combo-locked"' : `data-act="${act}"`);
  const view = () => {
    const c = draft();
    return A.comboView(PR(), { ...c, items: A.resolveItems(c, S().products) });
  };

  function itemRow(i, idx, c) {
    const deal = c.mode === 'addon' && idx > 0;
    return `<div class="combo-item" data-i="${idx}">
      <div class="ci-main"><b>${esc(i.name)}${i.orphan ? ' <span class="badge">món gốc đã xoá</span>' : ''}${deal ? ' <span class="badge">mua kèm</span>' : ''}</b>
        <small>${vnd(i.price)} · vốn ${vnd(i.cost)} · ngành ${pctShow(i.cat)}</small>
        ${deal ? `<label class="field deal"><span class="lbl">Giá mua kèm</span><span class="input"><input class="money" inputmode="numeric" autocomplete="off" data-in="addon" data-k="deal" data-i="${idx}" value="${money(i.price)}" ${readOnly() ? 'readonly data-act="combo-locked"' : ''}><span class="unit">đ</span></span></label>` : ''}</div>
      <div class="qty"><button class="qty-minus icon-btn" ${lockAct('combo-qty')} data-i="${idx}" data-d="-1" aria-label="Bớt ${esc(i.name)}">${icon('minus')}</button>
        <span class="qn" aria-label="Số lượng">${i.qty}</span>
        <button class="qty-plus icon-btn" ${lockAct('combo-qty')} data-i="${idx}" data-d="1" aria-label="Thêm ${esc(i.name)}">${icon('plus')}</button></div>
    </div>`;
  }

  function discountBlock(c) {
    if (c.mode === 'addon') return '<p class="hint section">Mua kèm: món chính giữ giá, món mua kèm bán giá đặc biệt (gõ ở từng món). Phí mỗi đơn, đóng gói tính 1 lần.</p>';
    const d = c.discount ?? ['percent', 0];
    const val = d[0] === 'percent' ? pctIn(d[1]) : money(d[1]);
    return `<div class="tabs three section" role="tablist" aria-label="Kiểu giảm">${A.DISCOUNTS.map((x) => `<button id="disc-${x.id}" role="tab" aria-selected="${d[0] === x.id}" ${lockAct('combo-disc')} data-v="${x.id}">${x.label}</button>`).join('')}</div>
      <label class="field"><span class="lbl">${d[0] === 'percent' ? 'Giảm' : d[0] === 'amount' ? 'Giảm số tiền' : 'Giá combo'}</span><span class="input"><input id="disc-value" class="${d[0] === 'percent' ? '' : 'money'}" inputmode="${d[0] === 'percent' ? 'decimal' : 'numeric'}" autocomplete="off" data-in="addon" data-k="disc" value="${val}" placeholder="0" ${readOnly() ? 'readonly data-act="combo-locked"' : ''}><span class="unit">${d[0] === 'percent' ? '%' : 'đ'}</span></span></label>`;
  }

  function priceLine(v) {
    if (!v.ok) return `<p id="combo-price-line" class="hint">${esc(v.error)}</p>`;
    return `<p id="combo-price-line" class="price-line">Cộng giá lẻ <s>${v.grossText}</s> → combo <b>${v.priceText}</b>${v.discountText ? ` <span class="hint">(${v.discountText})</span>` : ''}</p>`;
  }
  const minNote = (v) => `<p id="combo-min-note" class="warn" ${v.ok && v.minNote ? '' : 'hidden'}>${v.ok ? esc(v.minNote) : ''}</p>`;

  function comboResult(v) {
    if (!v.ok) return `<div id="combo-result" class="result" data-state="none"><div class="r-top"><span>Lãi combo</span></div><p class="hint" style="margin:6px 0">${esc(v.error)}</p></div>`;
    return `<div id="combo-result" class="result" data-state="${v.state}" aria-live="polite">
      <div class="r-top"><span>Lãi combo · giá <b id="combo-price">${v.priceText}</b></span>${draft().sample ? '<span class="badge">Ví dụ mẫu</span>' : ''}</div>
      <div class="r-main"><span id="combo-profit" class="profit state-${v.state}">${v.profitText}</span>
        <span class="state-txt state-${v.state}"><span id="combo-state">${v.stateText}</span> · <span id="combo-margin">${v.marginText}</span></span></div>
      <div id="combo-compare" class="cmp-line"><span>${v.compareText}</span><b id="combo-uplift" class="state-${v.upliftState}">${v.upliftText}</b></div>
      <p id="combo-take" class="hint">${v.takeText}</p>
      <div class="r-actions"><button id="combo-detail" class="link" data-act="nav" data-to="#/combo/chi-tiet">Xem chi tiết</button></div>
    </div>`;
  }

  function noteComboShown(v) {
    if (!v.ok || ui.comboSession) return;
    ui.comboSession = true;
    const c = draft();
    ctx.track('combo_built', A.comboEventParams(c, v));
    ctx.track('combo_vs_separate_viewed', { platform: c.platform, uplift_bucket: A.upliftBucket(v.sep, v.r.profit) });
  }

  function screenCombo(seg) {
    if (seg[1] === 'chi-tiet') return screenComboDetail();
    const c = draft();
    const v = view();
    const items = A.resolveItems(c, S().products);
    const progs = P.programsFor(PR(), c.platform);
    noteComboShown(v);
    return `
    <section class="screen" id="combo-screen">
      ${ctx.top({ title: c.id ? esc(c.name) : 'Combo', sub: `${ctx.shortName(c.platform)} · ${A.MODES.find((m) => m.id === c.mode).label}`, back: '#/tinh', right: '<span class="badge badge-good">PRO</span>' })}
      ${modeTabs('combo')}
      ${readOnly() ? `<div id="combo-sample" class="banner">${icon('lock')} <span><b>Ví dụ mẫu · chỉ xem.</b> Bán lẻ 3 đơn lãi 1.515đ, gộp thành combo giảm 10% lãi 6.614đ. Dựng combo của bạn với Pro.</span></div>` : ''}
      <div class="tabs three modes" role="radiogroup" aria-label="Cách bán theo bộ">${A.MODES.map((m) => `<button id="combo-mode-${m.id}" role="radio" aria-checked="${c.mode === m.id}" aria-pressed="${c.mode === m.id}" ${lockAct('combo-mode')} data-v="${m.id}">${m.label}</button>`).join('')}</div>
      <div class="card section" id="combo-items"><h2>Món trong combo</h2>
        ${items.length ? items.map((i, k) => itemRow(i, k, c)).join('') : '<p class="hint">Chưa có món. Thêm từ danh mục hoặc nhập nhanh.</p>'}
        <button id="add-item" class="btn btn-secondary section" ${lockAct('combo-add-item')} ${items.length >= 5 ? 'disabled' : ''}>${icon('plus')} Thêm món</button>
        ${c.mode === 'bundle' ? `<label class="field section"><span class="lbl">% phí ngành của bộ (sàn coi là 1 sản phẩm)</span><span class="input rate"><input id="bundle-rate" inputmode="decimal" autocomplete="off" data-in="addon" data-k="bundle-rate" value="${pctIn(c.bundleCat ?? items[0]?.cat)}" ${readOnly() ? 'readonly data-act="combo-locked"' : ''}><span class="unit">%</span></span></label>` : ''}
      </div>
      ${discountBlock(c)}
      ${priceLine(v)}
      ${minNote(v)}
      <div class="grid2 section">
        <label class="field"><span class="lbl">Đóng gói (1 lần)</span><span class="input"><input id="combo-pack" class="money" inputmode="numeric" autocomplete="off" data-in="addon" data-k="pack" value="${money(c.pack)}" placeholder="0" ${readOnly() ? 'readonly data-act="combo-locked"' : ''}><span class="unit">đ</span></span></label>
        <label class="field"><span class="lbl">Ship người mua trả</span><span class="input"><input id="combo-ship" class="money" inputmode="numeric" autocomplete="off" data-in="addon" data-k="ship" value="${money(c.ship)}" placeholder="0" ${readOnly() ? 'readonly data-act="combo-locked"' : ''}><span class="unit">đ</span></span></label>
      </div>
      ${progs.length ? `<div class="pills" role="group" aria-label="Chương trình">${progs.map((p) => `<button id="combo-prog-${p.id}" class="pill" aria-pressed="${c.programs.includes(p.id)}" ${lockAct('combo-prog')} data-v="${p.id}">${esc(p.name.replace(/\s*\(.*\)$/, ''))}</button>`).join('')}</div>` : ''}
      <p class="fine">Phí % tính trên giá đã giảm của từng món theo ngành của món; phí mỗi đơn, đóng gói, ship tính 1 lần cho cả combo. ${P.feeDateLabel(PR(), c.platform)} · ước tính độc lập, không liên kết với sàn.</p>
    </section>
    ${comboResult(v)}`;
  }

  /** Chip chế độ ở đầu Tính nhanh / Combo. */
  function modeTabs(active) {
    return `<div class="tabs three" role="tablist" aria-label="Cách tính">
      <button id="mode-price" role="tab" aria-selected="${active === 'price'}" data-act="${active === 'combo' ? 'combo-to-calc' : 'mode'}" data-v="price">Từ giá bán</button>
      <button id="mode-margin" role="tab" aria-selected="${active === 'margin'}" data-act="${active === 'combo' ? 'combo-to-calc' : 'mode'}" data-v="margin">Từ % lãi</button>
      <button id="mode-combo" role="tab" aria-selected="${active === 'combo'}" data-act="nav" data-to="#/combo">Combo <span class="badge badge-good">PRO</span></button>
    </div>`;
  }

  function screenComboDetail() {
    const c = draft();
    const v = view();
    if (!v.ok) { location.replace('#/combo'); return ''; }
    const pctNow = c.mode !== 'addon' && c.discount?.[0] === 'percent' ? c.discount[1] : null;
    const max = 0.4;
    const pos = (d) => `${Math.min(100, (d / max) * 100)}%`;
    const mark = (key, d, label) => (d == null ? '' : `<span class="md-mark" data-m="${key}" style="left:${pos(d)}"><i></i><small>${label}</small></span>`);
    return `
    <section class="screen" id="combo-detail-screen">
      ${ctx.top({ title: 'Chi tiết combo', sub: `${c.name ? `${esc(c.name)} · ` : ''}${v.n} món · ${ctx.shortName(c.platform)}`, back: '#/combo' })}
      <p class="lead"><b>${v.takeText}</b>. Phí mỗi đơn chỉ tính một lần cho cả combo.</p>
      <div class="card" id="combo-lines">
        <div class="fee-line head"><div class="fl-top"><strong>Giá combo</strong><strong>${v.priceText}</strong></div></div>
        ${v.lines.map((l) => `<div class="fee-line combo-line" data-key="${l.key}"><div class="fl-top"><span class="fl-name">${l.label} <span class="per">${l.per}</span></span><span class="fl-amt">${l.text}</span></div></div>`).join('')}
        <div class="fee-line total"><div class="fl-top"><span>Còn lại · <b class="state-${v.state}">${v.stateText}</b></span><strong class="state-${v.state}">${v.profitText}</strong></div></div>
      </div>
      ${c.mode === 'addon' ? '' : `<div class="card" id="max-disc"><h2>Giảm tối đa</h2>
        <p class="md-text">Giữ lãi 20%: <b id="md-20">${v.maxDiscText.m20}</b> · giữ lãi 10%: <b id="md-10">${v.maxDiscText.m10}</b> · hòa vốn: <b id="md-0">${v.maxDiscText.m0}</b></p>
        ${pctNow != null ? `<div class="md-track">${mark('20', v.maxDisc.m20, 'lãi 20%')}${mark('10', v.maxDisc.m10, 'lãi 10%')}${mark('0', v.maxDisc.m0, 'hòa vốn')}
          <input id="disc-slider" type="range" min="0" max="40" step="1" value="${Math.round(pctNow * 100)}" data-in="addon" data-k="slider" aria-label="Mức giảm combo" ${readOnly() ? 'disabled' : ''}></div>
          <p id="slider-read" class="hint">Đang giảm <b>${Math.round(pctNow * 100)}%</b> → lãi <b class="state-${v.state}">${v.profitText}</b> (${v.marginText})</p>` : '<p class="hint">Chọn kiểu "Giảm %" để kéo thanh mức giảm.</p>'}
        ${v.atMin ? `<p class="warn" id="md-min">${v.atMin}</p>` : ''}
        <p class="hint">Mức giảm làm tròn xuống % nguyên để không vượt mức an toàn.</p>
      </div>`}
      <div class="card" id="combo-suggest-card"><div class="settings-row"><span><b>Giá combo giữ lãi 20%</b><br><span class="hint">làm tròn lên giá đẹp</span></span><strong id="combo-suggest">${v.suggestText}</strong></div>
        ${c.mode === 'addon' ? '' : `<button id="combo-use-suggest" class="btn btn-secondary section" ${lockAct('combo-use-suggest')}>Dùng giá ${v.suggestText}</button>`}</div>
      <div class="card"><h2>Lưu vào Danh mục</h2>
        <label class="field"><span class="lbl">Tên combo</span><span class="input"><input id="combo-name" autocomplete="off" maxlength="40" data-in="addon" data-k="name" value="${esc(c.name)}" placeholder="Ví dụ: Bộ 3 móc khóa" ${readOnly() ? 'readonly data-act="combo-locked"' : ''}></span></label>
        <button id="combo-save" class="btn btn-primary section" ${lockAct('combo-save')}>${c.id ? 'Lưu thay đổi' : 'Lưu combo vào Danh mục'}</button>
        <p class="hint" style="margin-top:8px">Sửa giá vốn sản phẩm thì combo tự tính lại; sàn đổi phí thì combo có trong báo động.</p></div>
      <p class="fine">${P.feeDateLabel(PR(), c.platform)} · ${P.DISCLAIMER}</p>
    </section>`;
  }

  function refreshCombo() {
    const v = view();
    const r = $('#combo-result');
    if (r) r.outerHTML = comboResult(v);
    const pl = $('#combo-price-line');
    if (pl) pl.outerHTML = priceLine(v);
    const mn = $('#combo-min-note');
    if (mn) mn.outerHTML = minNote(v);
    noteComboShown(v);
  }

  function openItemSheet() {
    const c = draft();
    const used = new Set(c.items.map((i) => i.productId).filter(Boolean));
    const prods = S().products.filter((p) => !used.has(p.id));
    ctx.overlay.innerHTML = `
    <div class="scrim" data-act="sheet-bg"><div class="sheet" id="item-sheet" role="dialog" aria-modal="true" aria-label="Thêm món">
      <div class="grab"></div><h2>Thêm món vào combo</h2>
      ${prods.length ? `<p class="lbl">Từ danh mục (giá vốn, ngành tự điền)</p><div class="pick-list">${prods.map((p) => `<button class="pick-product option" data-act="combo-pick" data-id="${p.id}"><span><strong>${esc(p.name)}</strong><span class="n">${vnd(p.input.price)} · vốn ${vnd(p.input.cost ?? 0)} · ngành ${p.input.categoryRate != null ? pctShow(p.input.categoryRate) : '?'}</span></span></button>`).join('')}</div>` : '<p class="hint">Danh mục chưa có sản phẩm (hoặc đã thêm hết). Nhập nhanh bên dưới.</p>'}
      <p class="lbl section">Nhập nhanh</p>
      <div class="stack">
        <label class="field"><span class="lbl">Tên món</span><span class="input"><input id="quick-name" autocomplete="off" maxlength="40" placeholder="Ví dụ: Móc khóa"></span></label>
        <div class="grid2"><label class="field"><span class="lbl">Giá vốn</span><span class="input"><input id="quick-cost" class="money" inputmode="numeric" autocomplete="off" data-in="addon" data-k="fmt"><span class="unit">đ</span></span></label>
        <label class="field"><span class="lbl">Giá lẻ</span><span class="input"><input id="quick-price" class="money" inputmode="numeric" autocomplete="off" data-in="addon" data-k="fmt"><span class="unit">đ</span></span></label></div>
        <label class="field"><span class="lbl">% phí ngành</span><span class="input rate"><input id="quick-rate" inputmode="decimal" autocomplete="off" value="${pctIn(S().calc?.categoryRate ?? 0.16)}"><span class="unit">%</span></span></label>
      </div>
      <button id="quick-add" class="btn btn-primary section" data-act="combo-quick-add">Thêm món</button>
    </div></div>`;
  }

  // ============================================================== F29 Kiểm tra đơn
  const chk = () => (ui.chk ??= { productId: null, rate: null, programs: [], vat: true, pit: true, order: {}, ref: '', fromFile: false });
  const shopeeProducts = () => S().products.filter((p) => (p.input.platform ?? 'shopee') === 'shopee');
  const chkProduct = () => S().products.find((p) => p.id === chk().productId) ?? null;
  function chkArgs() {
    const p = chkProduct();
    if (p) return { ...A.productCheckArgs(p), items: chk().order.items ?? 1, lumped: !!chk().lumped };
    const k = chk();
    return { catRate: k.rate ?? 0, programs: k.programs, vat: k.vat, pit: k.pit, items: k.order.items ?? 1, lumped: !!k.lumped };
  }
  const canRun = () => (chk().order.price ?? 0) > 0 && (chkProduct() || chk().rate != null);

  function checkTabs(active) {
    return `<div class="pills" role="group" aria-label="Sàn"><button class="pill" aria-pressed="true">Shopee</button><button class="pill" disabled>TikTok Shop · sắp có</button><button class="pill" disabled>Lazada · sắp có</button></div>
    <div class="tabs" role="tablist" aria-label="Cách nhập">
      <button id="check-manual" role="tab" aria-selected="${active === 'manual'}" data-act="nav" data-to="#/kiem-tra">Nhập 1 đơn</button>
      <button id="check-file" role="tab" aria-selected="${active === 'file'}" data-act="nav" data-to="#/kiem-tra/file">Chọn file báo cáo · Pro</button>
    </div>`;
  }

  function orderField(f) {
    const v = chk().order[f.key];
    return `<label class="field"><span class="lbl">${f.label}</span><span class="input"><input id="o-${f.key}" class="money" inputmode="numeric" autocomplete="off" data-in="addon" data-k="order" data-f="${f.key}" value="${money(v)}" placeholder="0"><span class="unit">đ</span></span></label>`;
  }

  function screenCheck(seg) {
    if (seg[1] === 'ket-qua') return screenCheckResult();
    if (seg[1] === 'file') return screenCheckFile();
    const k = chk();
    const p = chkProduct();
    const prods = shopeeProducts();
    const hist = S().checkHistory ?? [];
    const progLabel = (ids) => ids.map((id) => ({ voucher_xtra: 'Voucher Xtra', piship: 'PiShip', visibility: 'phí hiển thị' })[id] ?? id).join(', ');
    return `
    <section class="screen" id="check-screen">
      ${ctx.top({ title: 'Kiểm tra đơn', sub: 'Sàn trừ đúng chưa? So từng khoản với biểu phí' })}
      ${checkTabs('manual')}
      <div class="card"><h2>Sản phẩm của đơn</h2>
        <label class="field"><span class="lbl">Để biết ngành và chương trình</span><span class="input"><select id="check-product" data-ch="addon-product">
          <option value="">— Không chọn, gõ % ngành —</option>${prods.map((x) => `<option value="${x.id}" ${x.id === k.productId ? 'selected' : ''}>${esc(x.name)}</option>`).join('')}</select></span></label>
        ${p ? `<p id="check-product-note" class="hint" style="margin-top:8px">Ngành ${pctShow(p.input.categoryRate ?? 0)}${(p.input.programs ?? []).length ? ` · ${progLabel(p.input.programs)}` : ' · chưa bật chương trình'}${p.input.vat === false ? ' · không khấu trừ GTGT' : ''}</p>`
          : `<label class="field" style="margin-top:10px"><span class="lbl">% phí ngành</span><span class="input rate"><input id="check-rate" inputmode="decimal" autocomplete="off" data-in="addon" data-k="check-rate" value="${pctIn(k.rate)}" placeholder="vd 16"><span class="unit">%</span></span></label>`}
      </div>
      <div class="card"><h2>Người mua trả</h2><div class="grid2">${A.ORDER_FIELDS.buyer.map(orderField).join('')}</div></div>
      <div class="card"><h2>Sàn trừ</h2><div class="grid2">${A.ORDER_FIELDS.platform.map(orderField).join('')}</div>
        <p class="hint" style="margin-top:8px">Gõ theo màn Kênh Người Bán › Đơn hàng › Chi tiết › Doanh thu đơn hàng, từ trên xuống. Ô trống là 0.</p></div>
      <button id="check-sample" class="link" data-act="check-sample">Thử với đơn mẫu (đơn thật A, kẹo sữa)</button>
      ${hist.length ? `<div class="card" id="check-history"><h2>Kết quả đã lưu trên máy</h2>
        ${hist.slice(0, 5).map((h) => `<div class="hist-row"><span>${new Date(h.at).toLocaleDateString('vi-VN')} · ${h.method === 'file' ? 'File' : '1 đơn'} · ${h.total} đơn</span><span><b class="state-good">${h.count.khop} khớp</b> · <b class="${h.count.lech ? 'state-loss' : ''}">${h.count.lech} lệch</b></span></div>`).join('')}
        <button id="clear-history" class="link" data-act="clear-history">Xoá kết quả đã lưu</button></div>` : ''}
      <p class="fine">Chỉ so phí, không gửi số liệu đi đâu. ${P.feeDateLabel(PR(), 'shopee')} · ${P.DISCLAIMER}</p>
    </section>
    <div class="cta"><button id="check-run" class="btn btn-primary" data-act="check-run" ${canRun() ? '' : 'disabled'}>Kiểm tra</button></div>`;
  }

  function currentResult() {
    const k = chk();
    if (!(k.order.price > 0)) return null;
    const a = chkArgs();
    return A.checkOrder(PR(), k.order, a.catRate, a.programs, a);
  }

  function screenCheckResult() {
    const k = chk();
    const r = currentResult();
    if (!r) { location.replace('#/kiem-tra'); return ''; }
    const p = chkProduct();
    const feeDate = P.vnDate(PR().as_of);
    const stCls = { khop: 'good', lech_nho: 'thin', lech: 'loss', dieu_chinh: 'thin' }[r.status];
    const row = (l) => {
      const fix = A.fixAction(l, r, p ?? { input: { categoryRate: k.rate, programs: k.programs, vat: k.vat } });
      return `<div class="check-line" data-key="${l.key}" data-status="${l.status}">
        <div class="cl-top"><span class="cl-name">${l.label}</span><span>${vnd(l.real)}</span><span>${vnd(l.app)}</span><b class="${l.status === 'khop' ? 'state-good' : l.status === 'lech_nho' ? 'state-thin' : 'state-loss'}">${l.status === 'khop' ? '✓' : `${l.diff > 0 ? '+' : '−'}${vnd(Math.abs(l.diff))}`}</b></div>
        ${l.status !== 'khop' ? `<p class="diag">${esc(l.diag)}</p>` : ''}
        ${l.status === 'lech' ? `<div class="cl-actions">${fix ? `<button class="fix-btn btn btn-secondary" data-act="check-fix" data-key="${l.key}" data-kind="${fix.kind}">${fix.label}</button>` : ''}
          <button class="copy-complaint link" data-act="copy-complaint" data-key="${l.key}">${icon('copy')} Sao chép nội dung khiếu nại</button></div>` : ''}
      </div>`;
    };
    const rp = A.realProfit(k.order, p?.input.cost ?? 0, p?.input.pack ?? 0);
    let profitBlock = `<p class="hint">Tiền về theo số sàn trừ: <b>${vnd(rp.payout)}</b>. Chọn sản phẩm đã lưu để xem lãi thật theo giá vốn.</p>`;
    if (p) {
      const B = r.base;
      const exp = E.calculate(PR(), { ...p.input, categoryRate: p.input.categoryRate ?? 0, price: k.order.price, sellerVoucher: k.order.seller_voucher ?? 0, shipBuyer: k.order.ship_buyer ?? 0,
        returnRate: 0, lossPerReturn: 0, roas: null, affiliateRate: B > 0 ? (k.order.affiliate ?? 0) / B : 0 });
      const st = E.stateOf(rp.profit, rp.profit / (B || 1));
      profitBlock = `<div class="settings-row"><span><b>Lãi thật đơn này</b><br><span class="hint">giá vốn đã lưu ${vnd(p.input.cost ?? 0)}${p.input.pack ? ` · đóng gói ${vnd(p.input.pack)}` : ''}</span></span><strong id="check-real-profit" class="state-${st}">${vnd(rp.profit)}</strong></div>
        <p class="hint" id="check-expected">Lãi dự tính theo biểu phí: ${vnd(exp.profit)} · tiền về ${vnd(rp.payout)}</p>`;
    }
    return `
    <section class="screen" id="check-result-screen">
      ${ctx.top({ title: 'Kết quả kiểm tra', sub: `${p ? `${esc(p.name)} · ` : ''}Shopee${k.ref ? ` · đơn …${esc(k.ref.slice(-4))}` : ''}`, back: k.fromFile ? '#/kiem-tra/file' : '#/kiem-tra' })}
      <div id="check-status" class="status-strip" data-status="${r.status}" data-tone="${stCls}"><b>${esc(A.statusHeadline(r).split(' · ')[0])}</b><span>${esc(A.statusHeadline(r).split(' · ').slice(1).join(' · '))}</span></div>
      <p class="hint" style="margin:8px 0 12px">So với biểu phí bạn đang dùng (Shopee cập nhật ${feeDate}) và cài đặt của sản phẩm. Lệch không có nghĩa sàn sai: thường do ngành hoặc chương trình khác bạn nghĩ.</p>
      <div class="card" id="check-table"><div class="cl-head"><span>Khoản</span><span>Sàn trừ</span><span>Biểu phí</span><span>Lệch</span></div>${r.lines.map(row).join('')}
        ${r.affiliate ? `<p class="hint" style="margin-top:8px">Hoa hồng tiếp thị liên kết ${vnd(r.affiliate)}: chi phí đúng của đơn affiliate, không phải lệch.</p>` : ''}
        ${Object.keys(r.adjusted).length ? `<p class="hint" style="margin-top:8px">Điều chỉnh: ${Object.entries(r.adjusted).map(([key, v]) => `${{ refund: 'hoàn tiền', adjustment: 'điều chỉnh', compensation: 'đền bù', ship_discrepancy: 'chênh lệch phí ship' }[key]} ${vnd(v)}`).join(', ')} — liệt kê riêng, phí tính trên giá sau hoàn.</p>` : ''}
      </div>
      ${r.mismatches ? `<label class="field section"><span class="lbl">Mã đơn (để chép vào nội dung khiếu nại)</span><span class="input"><input id="order-ref" autocomplete="off" data-in="addon" data-k="ref" value="${esc(k.ref)}" placeholder="Ví dụ: 2611...8A2F"></span></label>` : ''}
      <div class="card section" id="check-profit">${profitBlock}</div>
      <div class="btn-row section"><button id="check-again" class="btn btn-secondary" data-act="check-again">Kiểm tra đơn khác</button>
        ${p ? `<button class="btn btn-secondary" data-act="nav" data-to="#/san-pham/${p.id}">Mở sản phẩm</button>` : '<span></span>'}</div>
      <p class="fine">Người bán tự gửi khiếu nại qua Kênh Người Bán. ${P.DISCLAIMER}</p>
    </section>`;
  }

  // ============================================================== F30 file
  function screenCheckFile() {
    const f = ui.file;
    const err = ui.fileError;
    const head = `
      ${ctx.top({ title: 'Kiểm tra đơn', sub: 'Cả file Báo Cáo Doanh Thu của Shopee' })}
      ${checkTabs('file')}
      <div class="card"><h2>Lấy file trong Kênh Người Bán</h2>
        <ol class="steps"><li>Tài chính › Doanh thu</li><li>Chọn khoảng thời gian › <b>Tải báo cáo</b></li><li>Mở file .xlsx tải về ở đây</li></ol>
        <input id="file-input" type="file" accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" data-ch="addon-file" hidden>
        <button id="file-pick" class="btn btn-primary" data-act="file-pick">${icon('file')} Chọn file .xlsx</button>
        ${err ? `<p id="file-error" class="warn" role="alert">${esc(err)}</p>` : ''}
        <p class="hint" style="margin-top:8px">Tệp báo cáo bạn chọn được đọc trên thiết bị và không được gửi đi. ${gated() ? 'Gói miễn phí: tóm tắt + chi tiết 3 đơn đầu.' : ''}</p></div>`;
    if (!f) return `<section class="screen" id="check-file-screen">${head}</section>`;
    const done = f.results.filter((x) => x.r);
    const sum = A.checkSummary(done);
    const filter = ui.fileFilter;
    const list = f.results.filter((x) => filter === 'all' || x.r?.status === filter);
    const tile = (st, label) => `<button class="count-tile" data-status="${st}" data-act="file-filter" data-v="${st}" aria-pressed="${filter === st}"><b>${sum.count[st]}</b><span>${label}</span></button>`;
    const unmapped = [...new Set(f.results.filter((x) => !x.r).map((x) => x.sku))];
    const skus = [...new Set(f.results.map((x) => x.sku).filter(Boolean))];
    const prods = shopeeProducts();
    const orderRow = (x) => {
      const st = x.r?.status;
      const diff = x.r && x.r.status !== 'khop' ? `${x.r.total_diff > 0 ? '+' : '−'}${vnd(Math.abs(x.r.total_diff))}` : '';
      return `<button class="order-row${x.locked ? ' locked' : ''}" data-id="${esc(x.id)}" data-status="${st ?? 'unmapped'}" data-act="file-open" data-v="${esc(x.id)}">
        <span class="or-id">…${esc(x.id.slice(-4))}</span><span class="or-sku">${esc(x.product?.name ?? x.sku ?? '')}</span>
        ${x.locked ? `<span class="badge">${icon('lock')} Pro</span>` : x.r ? `<span class="st ${st === 'khop' ? 'state-good' : st === 'lech' ? 'state-loss' : 'state-thin'}">${A.STATUS_LABEL[st]}</span><b class="or-diff">${diff}</b>` : '<span class="na">chưa gán sản phẩm</span>'}
      </button>`;
    };
    const topLine = sum.topReason ? `Lý do lệch nhiều nhất: <b>${A.REASON_LABEL[sum.topReason]}</b> (${sum.topCount} khoản)` : 'Không có khoản lệch đáng kể.';
    return `
    <section class="screen" id="check-file-screen">${head}
      <div class="count-tiles" id="count-tiles" role="group" aria-label="Lọc theo trạng thái">${tile('khop', 'Khớp')}${tile('lech_nho', 'Lệch nhỏ')}${tile('lech', 'Lệch')}${tile('dieu_chinh', 'Có điều chỉnh')}</div>
      <div class="card section"><p id="file-top-reason" style="margin:0">${topLine}</p>
        <p id="file-total-diff" class="hint" style="margin-top:6px">${done.length}/${f.results.length} đơn đã kiểm · tổng lệch ${vnd(Math.abs(sum.totalDiff))}${sum.totalDiff > 0 ? ' sàn trừ nhiều hơn' : ''}${filter !== 'all' ? ` · <button class="link" data-act="file-filter" data-v="all">Bỏ lọc</button>` : ''}</p></div>
      <div class="card" id="fee-share"><h2>Phí nào ăn nhiều nhất</h2>${sum.share.slice(0, 5).map((s) => `<div class="share-row" data-key="${s.key}"><span>${s.label}</span><span class="sb"><i style="width:${Math.min(100, s.pct * 400)}%"></i></span><b>${pctShow(s.pct)}</b></div>`).join('')}
        <p class="hint">% trên doanh thu (giá sau mã giảm giá shop) của ${done.length} đơn.</p></div>
      ${skus.length ? `<div class="card" id="sku-card"><h2>Gán SKU với sản phẩm</h2>${unmapped.length ? `<p class="hint" style="margin:-4px 0 8px">${unmapped.length} SKU chưa gán: chọn sản phẩm để kiểm.</p>` : ''}
        ${skus.map((s) => { const cur = St.productForSku(S(), s); return `<label class="sku-map" data-sku="${esc(s)}"><span>${esc(s)}</span><span class="input"><select data-ch="addon-sku" data-sku="${esc(s)}"><option value="">— chưa gán —</option>${prods.map((p) => `<option value="${p.id}" ${cur?.id === p.id ? 'selected' : ''}>${esc(p.name)}</option>`).join('')}</select></span></label>`; }).join('')}
        <p class="hint">App nhớ cho lần sau.</p></div>` : ''}
      <div class="card" id="order-list"><h2>Đơn trong file</h2>${list.map(orderRow).join('') || '<p class="hint">Không có đơn ở nhóm này.</p>'}</div>
      ${gated() && f.results.some((x) => x.locked) ? `<button id="file-unlock" class="btn btn-good section" data-act="file-unlock">Xem tất cả ${f.results.length} đơn · Pro</button>` : ''}
    </section>`;
  }

  async function handleFile(bytes) {
    ctx.track('order_check_started', { method: 'file', platform: 'shopee' });
    const parsed = await readIncomeFile(bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes));
    if (parsed.error) {
      ui.file = null;
      ui.fileError = fileErrorText(parsed.error);
      ctx.track('order_check_file_error', { error_code: parsed.error.code, missing_column: parsed.error.missing || '' });
    } else {
      ui.fileError = null;
      ui.parsed = parsed;
      runFile();
    }
    if (location.hash !== '#/kiem-tra/file') ctx.go('#/kiem-tra/file'); else ctx.render();
    return parsed.error ? { error: parsed.error } : { orders: parsed.orders.length };
  }
  function runFile() {
    const r = St.runFileCheck(S(), PR(), ui.parsed, ctx.now(), { pro: !gated() });
    ctx.set(r.state);
    ui.file = { results: r.results, unmapped: r.unmapped };
  }

  // ============================================================== thao tác
  const updDraft = (patch) => { ui.combo = { ...draft(), ...patch }; };
  const ACT = {
    'combo-locked': () => ctx.openPaywall('combo_tab', () => { ui.combo = null; ctx.render(); }),
    'combo-to-calc': (el) => { ctx.setCalcMode(el.dataset.v); ctx.go('#/tinh'); },
    'combo-mode': (el) => { updDraft({ mode: el.dataset.v }); ctx.render(); },
    'combo-disc': (el) => {
      const c = draft();
      const t = el.dataset.v;
      const gross = A.resolveItems(c, S().products).reduce((s, i) => s + i.price * i.qty, 0);
      const cur = c.discount ?? ['percent', 0];
      const B = cur[0] === 'percent' ? gross * (1 - cur[1]) : cur[0] === 'amount' ? gross - cur[1] : cur[1];
      const next = t === 'percent' ? ['percent', gross > 0 ? Math.max(0, Math.round((1 - B / gross) * 100) / 100) : 0.1] : t === 'amount' ? ['amount', Math.max(0, Math.round(gross - B))] : ['fixed', Math.round(B)];
      updDraft({ discount: next });
      ctx.render();
    },
    'combo-qty': (el) => {
      const i = Number(el.dataset.i);
      const items = draft().items.map((x, k) => (k === i ? { ...x, qty: x.qty + Number(el.dataset.d) } : x)).filter((x) => x.qty > 0);
      updDraft({ items });
      ctx.render();
    },
    'combo-prog': (el) => {
      const id = el.dataset.v;
      const pr = draft().programs;
      updDraft({ programs: pr.includes(id) ? pr.filter((x) => x !== id) : [...pr, id] });
      ctx.render();
    },
    'combo-add-item': () => openItemSheet(),
    'combo-pick': (el) => {
      const p = S().products.find((x) => x.id === el.dataset.id);
      if (!p) return;
      const it = { productId: p.id, name: p.name, cost: p.input.cost ?? 0, price: p.input.price ?? 0, cat: p.input.categoryRate ?? 0, qty: 1 };
      const c = draft();
      updDraft({ items: [...c.items, it], platform: c.items.length ? c.platform : (p.input.platform ?? c.platform) });
      ctx.closeOverlay();
      ctx.render();
    },
    'combo-quick-add': () => {
      const name = $('#quick-name')?.value.trim();
      const cost = E.parseMoney($('#quick-cost')?.value ?? '');
      const price = E.parseMoney($('#quick-price')?.value ?? '');
      const cat = E.parseRate($('#quick-rate')?.value ?? '');
      if (!name || !(price > 0) || cat == null) { ctx.toast('Nhập tên, giá lẻ và % ngành'); return; }
      updDraft({ items: [...draft().items, { productId: null, name, cost, price, cat, qty: 1 }] });
      ctx.closeOverlay();
      ctx.render();
    },
    'combo-use-suggest': () => {
      const v = view();
      if (!v.ok) return;
      updDraft({ discount: ['fixed', v.suggest.nice], mode: draft().mode === 'addon' ? 'promo' : draft().mode });
      ctx.toast(`Giá combo ${v.suggestText}`);
      ctx.render();
    },
    'combo-save': () => {
      const c = draft();
      if (!c.items.length) { ctx.toast('Thêm món trước khi lưu'); return; }
      const v = view();
      if (!v.ok) { ctx.toast(v.error); return; }
      const name = c.name?.trim() || c.items.map((i) => `${i.qty} ${i.name}`).join(' + ').slice(0, 40);
      const r = St.saveCombo(S(), { ...c, name }, ctx.now());
      ctx.set(r.state);
      ui.combo = { ...c, id: r.id, name };
      ctx.toast(`Đã lưu "${name}" vào Danh mục`);
      ctx.go('#/san-pham');
    },
    'make-combo': () => {
      if (gated()) { ctx.openPaywall('combo_tab', () => { ui.combo = emptyDraft(); ctx.go('#/combo'); setTimeout(openItemSheet, 200); }); return; }
      ui.combo = emptyDraft();
      ctx.go('#/combo');
      setTimeout(openItemSheet, 200);
    },
    'open-combo': (el) => {
      const rec = (S().combos ?? []).find((c) => c.id === el.dataset.v);
      if (!rec) return;
      if (gated()) { ctx.toast('Combo đã lưu: chỉ xem. Sửa combo cần Pro.'); ctx.openPaywall('combo_tab', () => { ui.combo = structuredClone(rec); ctx.go('#/combo'); }); return; }
      ui.combo = structuredClone(rec);
      ctx.go('#/combo');
    },
    // ---- kiểm tra đơn
    'check-sample': () => {
      const k = chk();
      k.order = { price: 74692, ship_buyer: 21500, fixed_fee: 11951, service_fee: 7108, transaction_fee: 5772, piship: 2700, visibility: 807, vat: 747, pit: 373, affiliate: 4840 };
      if (!k.productId) k.rate = k.rate ?? 0.15;
      ctx.render();
    },
    'check-run': () => {
      const k = chk();
      ctx.track('order_check_started', { method: 'manual', platform: 'shopee' });
      const r = St.runManualCheck(S(), PR(), k.order, chkArgs(), ctx.now());
      ctx.set(r.state);
      k.fromFile = false;
      k.viewed = null;
      ctx.go('#/kiem-tra/ket-qua');
    },
    'check-fix': (el) => {
      const r = currentResult();
      const line = r?.lines.find((l) => l.key === el.dataset.key);
      const p = chkProduct();
      const k = chk();
      const fix = line && A.fixAction(line, r, p ?? { input: { categoryRate: k.rate, programs: k.programs, vat: k.vat } });
      if (!fix) return;
      if (p) ctx.set(St.applyCheckFix(S(), p.id, fix, 'shopee', ctx.now()));
      else {
        if (fix.patch.categoryRate != null) { k.rate = fix.patch.categoryRate; ctx.track('category_rate_updated_from_check', { reason_code: 'category_rate', platform: 'shopee' }); }
        if (fix.patch.programs) { k.programs = fix.patch.programs; ctx.track('program_toggled', { program: fix.kind, on: fix.patch.programs.includes(fix.kind) }); }
        if (fix.patch.vat != null) { k.vat = fix.patch.vat; ctx.track('program_toggled', { program: 'vat', on: fix.patch.vat }); }
      }
      const again = currentResult();
      const nowLine = again.lines.find((l) => l.key === line.key);
      ctx.render();
      ctx.toast(`${fix.label}${p ? ` cho ${p.name}` : ''} · kiểm lại: ${A.STATUS_LABEL[nowLine.status]}`);
    },
    'copy-complaint': async (el) => {
      const r = currentResult();
      const line = r?.lines.find((l) => l.key === el.dataset.key);
      if (!line) return;
      const text = A.complaintTemplate(chk().ref, line, P.vnDate(PR().as_of));
      ui.lastClipboard = text;
      await ctx.copyText(text);
      ctx.track('complaint_template_copied', { fee_key: line.key, diff_bucket: A.diffBucket(line.diff) });
      ctx.toast('Đã chép nội dung khiếu nại · dán vào Kênh Người Bán › Hỗ trợ');
    },
    'check-again': () => { const k = chk(); ui.chk = { ...k, order: {}, ref: '', fromFile: false }; ctx.go(k.fromFile ? '#/kiem-tra/file' : '#/kiem-tra'); },
    'clear-history': () => { ctx.set(St.clearCheckHistory(S())); ctx.toast('Đã xoá kết quả kiểm tra trên máy'); ctx.render(); },
    'file-pick': () => $('#file-input')?.click(),
    'file-filter': (el) => { ui.fileFilter = el.dataset.v === ui.fileFilter ? 'all' : el.dataset.v; ctx.render(); },
    'file-unlock': () => ctx.openPaywall('order_check_file', () => { runFile(); ctx.render(); }),
    'file-open': (el) => {
      const x = ui.file?.results.find((y) => y.id === el.dataset.v);
      if (!x) return;
      if (x.locked) { ctx.openPaywall('order_check_file', () => { runFile(); ctx.render(); }); return; }
      if (!x.r) { ctx.toast('Gán SKU này với một sản phẩm ở thẻ "Gán SKU" để kiểm'); return; }
      ui.chk = { productId: x.product.id, rate: null, programs: [], vat: true, pit: true, order: { ...x.order }, ref: x.id, fromFile: true, lumped: !!ui.parsed?.lumped };
      ctx.go('#/kiem-tra/ket-qua');
    },
  };

  const IN = (el) => {
    const k = el.dataset.k;
    if (el.classList.contains('money')) {
      const f = E.formatMoneyInput(el.value);
      if (el.value !== f) el.value = f;
    }
    if (k === 'fmt') return;
    if (k === 'order') {
      chk().order = { ...chk().order, [el.dataset.f]: E.parseMoney(el.value) };
      const b = $('#check-run'); if (b) b.disabled = !canRun();
      return;
    }
    if (k === 'check-rate') { chk().rate = E.parseRate(el.value); const b = $('#check-run'); if (b) b.disabled = !canRun(); return; }
    if (k === 'ref') { chk().ref = el.value.trim(); return; }
    if (readOnly()) return;
    if (k === 'name') { updDraft({ name: el.value }); return; }
    if (k === 'pack' || k === 'ship') { updDraft({ [k]: E.parseMoney(el.value) }); refreshCombo(); return; }
    if (k === 'bundle-rate') { const r = E.parseRate(el.value); if (r != null) { updDraft({ bundleCat: r }); refreshCombo(); } return; }
    if (k === 'deal') {
      const i = Number(el.dataset.i);
      const v = E.parseMoney(el.value);
      updDraft({ items: draft().items.map((x, j) => (j === i ? { ...x, price: v, dealPrice: v } : x)) });
      refreshCombo();
      return;
    }
    if (k === 'disc') {
      const d = draft().discount ?? ['percent', 0];
      const val = d[0] === 'percent' ? (E.parseRate(el.value) ?? 0) : E.parseMoney(el.value);
      updDraft({ discount: [d[0], val] });
      refreshCombo();
      return;
    }
    if (k === 'slider') {
      updDraft({ discount: ['percent', Number(el.value) / 100] });
      const v = view();
      const rd = $('#slider-read');
      if (rd && v.ok) rd.innerHTML = `Đang giảm <b>${el.value}%</b> → lãi <b class="state-${v.state}">${v.profitText}</b> (${v.marginText})`;
    }
  };
  const CH = {
    'addon-product': (el) => { chk().productId = el.value || null; ctx.render(); },
    'addon-file': async (el) => { const f = el.files?.[0]; if (!f) return; await handleFile(new Uint8Array(await f.arrayBuffer())); },
    'addon-sku': (el) => {
      if (gated()) { el.value = ''; ctx.openPaywall('order_check_file', () => ctx.render()); return; }
      ctx.set(St.mapSku(S(), el.dataset.sku, el.value || null));
      runFile();
      ctx.render();
    },
    'addon-slider-end': () => ctx.render(),
  };

  /** Sự kiện khi vào màn. */
  function onEnter(seg) {
    if (seg[0] === 'combo' && seg[1] === 'chi-tiet') ctx.track('combo_max_discount_viewed', { target_margin: 20, is_pro: ctx.pro() });
    if (seg[0] === 'kiem-tra' && seg[1] === 'ket-qua') {
      const r = currentResult();
      for (const l of r?.lines ?? []) if (l.status === 'lech') ctx.track('mismatch_reason_viewed', { reason_code: l.reason, fee_key: l.key });
    }
  }

  /** Danh mục: thẻ combo đã lưu ("Bộ · N món"). filter = mảng id khi xem báo động. */
  function catalogCombos(filter) {
    const rows = A.combosCatalog(PR(), S().combos ?? [], S().products).filter((x) => !Array.isArray(filter) || filter.includes(x.id));
    if (!rows.length) return '';
    return `<h2 class="group-h section" id="combo-group">Combo</h2><div id="combo-list">${rows.map((x) => `<button class="product-card combo-card" data-id="${x.id}" data-act="open-combo" data-v="${x.id}">
      <span><strong>${esc(x.name)} <span class="badge">Bộ · ${x.n} món</span></strong> <span class="m">${esc(x.meta.replace(/^Bộ · \d+ món · /, ''))}${x.orphan ? ' · món gốc đã xoá' : ''}</span></span>
      <span class="r"><span class="amt state-${x.state}">${x.profitText}</span> <span class="st state-${x.state}">${x.stateText}</span></span></button>`).join('')}</div>`;
  }

  return { screenCombo, screenCheck, modeTabs, ACT, IN, CH, onEnter, catalogCombos, handleFile, refreshCombo, lastClipboard: () => ui.lastClipboard ?? null, resetSession: () => { ui.comboSession = false; } };
}
