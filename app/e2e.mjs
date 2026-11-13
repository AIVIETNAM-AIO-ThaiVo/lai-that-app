// Kịch bản bot tự dùng Lãi Thật như chủ shop (2-environment/bot.mjs gọi hàm play).
// Mỗi check(...) ứng với một dòng "Done when" trong 1-wiki/features/F*.md. Chia theo phase (1-wiki/phases.md).
export async function play(t0) {
  const t = { ...t0, shot: async (label) => { await t0.sleep(260); await t0.shot(label); } };
  const h = helpers(t);
  await h.noSplash();
  // Phase 1–7 kiểm tính năng khi chưa bật khoá Pro / quảng cáo (như lúc build); Phase 8 bật cấu hình phát hành.
  await h.q('window.__app.setConfig({ pro_gates_enabled: false, ads_enabled: false })');
  await h.until(() => h.q("(() => { const i = document.querySelector('#brand-logo'); return !i || (i.complete && i.naturalWidth > 0); })()"));
  await phase1(t, h);
  await phase2(t, h);
  await phase3(t, h);
  await phase4(t, h);
  await phase5(t, h);
  await phase6(t, h);
  await phase7(t, h);
  await phase8(t, h);
  await phase10(t, h);
}

// ---------------------------------------------------------------- Phase 10 · add-on Combo + Kiểm tra đơn
async function phase10(t, h) {
  const { click, type, shot, check, sleep } = t;
  const ev = async (name) => (await h.events()).filter((e) => e.name === name);
  const clear = (sel) => h.q(`(() => { const e = document.querySelector(${JSON.stringify(sel)}); e.value = ''; e.dispatchEvent(new Event('input', { bubbles: true })); })()`);
  // Như máy mới cài (biểu phí gốc — các phase trước đã đẩy biểu phí thử 9%), gói miễn phí, khoá Pro + quảng cáo vẫn bật.
  // Tắt interstitial để bot không bị che khi chuyển tab.
  await h.q('window.__app.setConfig({ interstitial_min_seconds: 999999 })');
  await h.q('localStorage.clear(); location.hash = ""; location.reload()');
  await sleep(600);
  await h.noSplash();
  await click('#pf-shopee');
  await click('#onboard-continue');
  await sleep(300);
  await h.tab('san-pham');
  await click('#load-examples');
  await sleep(250);
  if (await h.has('#consent-no')) { await click('#consent-no'); await sleep(150); }

  // F29 — thanh dưới 5 tab
  check('F29: thanh dưới 5 tab Tính · So sánh · Sản phẩm · Kiểm tra · Cài đặt',
    (await h.q("[...document.querySelectorAll('.nav button')].map((b) => b.textContent.trim()).join('·')")) === 'Tính·So sánh·Sản phẩm·Kiểm tra·Cài đặt');

  // F28 — chip Combo, ví dụ mẫu chỉ xem (C0)
  await h.tab('tinh');
  check('F28: Tính có chip thứ ba Combo (PRO)', /Combo/.test(await h.text('#mode-combo')) && /PRO/.test(await h.text('#mode-combo')) && (await h.has('#mode-price')) && (await h.has('#mode-margin')));
  await click('#mode-combo');
  await sleep(300);
  check('F28: chưa Pro → ví dụ mẫu 3 móc khóa, chỉ xem', (await h.route()) === '#/combo' && (await h.has('#combo-sample')));
  check('F28: mẫu giá 45.900đ, lãi 6.614đ · 14,4%', (await h.text('#combo-price')) === '45.900đ' && (await h.text('#combo-profit')) === '6.614đ' && (await h.text('#combo-margin')) === '14,4%');
  check('F28: "Bán lẻ 3 đơn: 1.515đ · Combo +5.099đ"; sàn lấy 30% thay vì 41%', /Bán lẻ 3 đơn: 1\.515đ/.test(await h.text('#combo-compare'))
    && (await h.text('#combo-uplift')) === 'Combo +5.099đ' && /30% thay vì 41%/.test(await h.text('#combo-take')));
  check('F28: combo_built + combo_vs_separate_viewed (không giá/tên)', (await ev('combo_built')).some((e) => e.params.mode === 'promo' && e.params.items_count === 3 && !('price' in e.params))
    && (await ev('combo_vs_separate_viewed')).length > 0);
  check('F28: không quảng cáo trên màn combo', !(await h.has('.ad-banner')) && !(await h.has('#ad-consent')));
  await shot('Combo — ví dụ mẫu (miễn phí)');
  await click('#disc-value');
  await sleep(250);
  check('F28: chạm sửa ô ở ví dụ mẫu → paywall combo_tab', (await h.has('#paywall')) && (await ev('paywall_view')).some((e) => e.params.trigger === 'combo_tab'));
  await click('#paywall-close');
  await sleep(150);

  // F29 — kiểm tra đơn nhập tay (miễn phí)
  await h.tab('kiem-tra');
  check('F29: #/kiem-tra: form theo thứ tự Doanh thu đơn hàng, nút Kiểm tra chờ có giá', (await h.route()) === '#/kiem-tra' && (await h.disabled('#check-run'))
    && (await h.q("[...document.querySelectorAll('[id^=\"o-\"]')].map((e) => e.id).join(',')")) === 'o-price,o-seller_voucher,o-ship_buyer,o-refund,o-fixed_fee,o-service_fee,o-transaction_fee,o-piship,o-visibility,o-vat,o-pit,o-affiliate');
  check('F29: TikTok Shop / Lazada ghi "sắp có"; không quảng cáo trên màn nhập đơn', /TikTok Shop · sắp có/.test(await h.body()) && !(await h.has('.ad-banner')));
  await h.select('#check-product', '');
  await type('#check-rate', '15');
  for (const [id, v] of [['o-price', 74692], ['o-ship_buyer', 21500], ['o-fixed_fee', 11951], ['o-service_fee', 7108], ['o-transaction_fee', 5772], ['o-piship', 2700], ['o-visibility', 807], ['o-vat', 747], ['o-pit', 373]]) {
    await h.typeMoney('#' + id, v);
  }
  check('F29: có giá → Kiểm tra bấm được', !(await h.disabled('#check-run')));
  await shot('Kiểm tra đơn — nhập tay');
  await click('#check-run');
  await sleep(300);
  check('F29: đơn A, ngành 15%, chưa bật chương trình → Lệch 4 khoản · sàn trừ nhiều hơn 8.362đ', (await h.route()) === '#/kiem-tra/ket-qua'
    && (await h.attr('#check-status', 'data-status')) === 'lech' && /Lệch 4 khoản/.test(await h.text('#check-status')) && /nhiều hơn 8\.362đ/.test(await h.text('#check-status')));
  check('F29: bảng Khoản · Sàn trừ · Biểu phí · Lệch; phí cố định "Sàn đang tính 16,00% thay vì 15,00%"', /Khoản.*Sàn trừ.*Biểu phí.*Lệch/.test(await h.text('.cl-head'))
    && /Sàn đang tính 16,00% thay vì 15,00%/.test(await h.text('.check-line[data-key="fixed_fee"] .diag')));
  check('F29: nút sửa tại dòng lệch', (await h.q("[...document.querySelectorAll('.fix-btn')].map((b) => b.textContent).join('|')")) === 'Cập nhật ngành 16%|Bật Voucher Xtra|Bật PiShip|Bật phí hiển thị');
  check('F29: order_check_completed + mismatch_reason_viewed (không số tiền)', (await ev('order_check_completed')).some((e) => e.params.method === 'manual' && e.params.mismatch_count === 4)
    && (await ev('mismatch_reason_viewed')).some((e) => e.params.reason_code === 'category_rate' && e.params.fee_key === 'fixed_fee'));
  await shot('Kiểm tra đơn — Lệch 4 khoản');
  await type('#order-ref', '2610160A1KEOA');
  await click('.check-line[data-key="fixed_fee"] .copy-complaint');
  await sleep(200);
  const clip = await h.q('window.__app.lastClipboard()');
  check('F29: sao chép khiếu nại: mã đơn, khoản, đã trừ, theo biểu phí + ngày, chênh lệch', /Đơn hàng 2610160A1KEOA/.test(clip) && /"Phí cố định" đã trừ 11\.951đ/.test(clip)
    && /dự kiến 11\.204đ/.test(clip) && /chênh lệch 747đ/.test(clip) && (await ev('complaint_template_copied')).some((e) => e.params.fee_key === 'fixed_fee' && e.params.diff_bucket === '<1k'));
  for (let i = 0; i < 4; i += 1) { if (!(await h.has('.fix-btn'))) break; await click('.fix-btn'); await sleep(250); }
  check('F29: bấm sửa từng dòng → kiểm lại Khớp', (await h.attr('#check-status', 'data-status')) === 'khop' && /Khớp/.test(await h.text('#check-status')));
  check('F29: ghi category_rate_updated_from_check', (await ev('category_rate_updated_from_check')).some((e) => e.params.reason_code === 'category_rate' && e.params.platform === 'shopee'));
  await shot('Kiểm tra đơn — đã sửa, Khớp');

  // F30 — cả file (chưa Pro: tóm tắt + 3 đơn đầu)
  await click('#check-again');
  await sleep(250);
  await click('#check-file');
  await sleep(250);
  check('F30: màn file: hướng dẫn 3 bước, đọc trên máy', (await h.route()) === '#/kiem-tra/file' && (await h.count('.steps li')) === 3 && /đọc trên thiết bị và không được gửi đi/.test(await h.body()));
  await h.q("fetch('test/bao-cao-mau.xlsx').then((r) => r.arrayBuffer()).then((b) => window.__app.checkFile([...new Uint8Array(b)]))");
  await h.until(() => h.has('.order-row'));
  check('F30: đọc 9 đơn trong file; SKU chưa gán được liệt kê để gán', (await h.count('.order-row')) === 9 && (await h.count('.sku-map')) === 8);
  check('F30: chưa Pro → 6 đơn khoá (xem 3 đơn đầu) + nút mở Pro', (await h.count('.order-row.locked')) === 6 && (await h.has('#file-unlock')));
  check('F30: order_check_started/completed method=file', (await ev('order_check_started')).some((e) => e.params.method === 'file') && (await ev('order_check_completed')).some((e) => e.params.method === 'file' && e.params.orders_count === 9));
  await click('.order-row.locked');
  await sleep(250);
  check('F30: chạm đơn bị khoá → paywall order_check_file', (await h.has('#paywall')) && (await ev('paywall_view')).some((e) => e.params.trigger === 'order_check_file'));
  await click('#buy');
  await sleep(500);
  check('F30: Pro → hết khoá', (await h.count('.order-row.locked')) === 0);
  const pid = await h.q("document.querySelector('.sku-map select option[value]:not([value=\"\"])')?.value");
  await h.select('.sku-map[data-sku="Kẹo sữa"] select', pid);
  await sleep(300);
  check('F30: gán SKU → kiểm được 2 đơn kẹo sữa, nhớ cho lần sau', (await h.count('.order-row[data-status="unmapped"]')) === 7 && !!(await h.q('window.__app.state().skuMap["Kẹo sữa"]')));
  check('F30: 4 ô đếm + lý do lệch nhiều nhất + phí nào ăn nhiều nhất', (await h.count('.count-tile')) === 4 && (await h.has('#file-top-reason')) && (await h.count('#fee-share .share-row')) > 0);
  await shot('Kiểm tra cả file — tóm tắt');
  const bad = await h.q("window.__app.checkFile([...new TextEncoder().encode('không phải excel')])");
  await sleep(200);
  check('F30: file sai → báo lỗi, không treo + order_check_file_error', bad?.error?.code === 'not_xlsx' && (await h.has('#file-error')) && (await ev('order_check_file_error')).length > 0);

  // F28 — Pro: dựng combo, chi tiết, lưu vào Danh mục
  await click('#tab-tinh');
  await sleep(250);
  await click('#mode-combo');
  await sleep(300);
  check('F28: Pro → sửa được (không còn ví dụ chỉ xem)', !(await h.has('#combo-sample')) && (await h.count('.combo-item')) >= 1);
  await click('#combo-mode-promo');
  await click('#disc-percent');
  await sleep(150);
  await clear('#disc-value');
  await type('#disc-value', '5');
  await sleep(150);
  check('F28: giảm 5% → 8.564đ · 17,7%', (await h.text('#combo-profit')) === '8.564đ' && (await h.text('#combo-margin')) === '17,7%');
  await clear('#disc-value');
  await type('#disc-value', '2');
  await sleep(150);
  check('F28: dưới mức tối thiểu Shopee → cảnh báo 5% / 10.000đ', /tối thiểu 5% hoặc 10\.000đ/.test((await h.text('#combo-min-note')) ?? '') && !(await h.attr('#combo-min-note', 'hidden')));
  await clear('#disc-value');
  await type('#disc-value', '10');
  await sleep(150);
  await click('#combo-detail');
  await sleep(300);
  check('F28: chi tiết có nhãn mỗi SP / mỗi đơn', (await h.text('.combo-line[data-key="cat"] .per')) === 'mỗi SP' && (await h.text('.combo-line[data-key="per_order"] .per')) === 'mỗi đơn');
  check('F28: giảm tối đa 1% / 15% / 26% (làm tròn xuống) + 3 mốc', (await h.text('#md-20')) === '1%' && (await h.text('#md-10')) === '15%' && (await h.text('#md-0')) === '26%' && (await h.count('.md-mark')) === 3);
  check('F28: nói rõ lãi ở mức 5% tối thiểu; giá gợi ý 50.900đ', /Giảm 5% \(mức thấp nhất Shopee cho phép\) thì lãi còn 17,7%/.test(await h.text('#md-min')) && (await h.text('#combo-suggest')) === '50.900đ');
  check('F28: combo_max_discount_viewed {target_margin, is_pro}', (await ev('combo_max_discount_viewed')).some((e) => e.params.target_margin === 20 && e.params.is_pro === true));
  await shot('Combo — chi tiết, giảm tối đa');
  await type('#combo-name', 'Bộ 3 móc khóa');
  await click('#combo-save');
  await sleep(400);
  check('F28: lưu → Danh mục có dòng "Bộ · 3 món" + combo_saved', (await h.route()) === '#/san-pham' && /Bộ · 3 món/.test((await h.text('.combo-card')) ?? '')
    && /6\.614đ/.test(await h.text('.combo-card')) && (await ev('combo_saved')).some((e) => e.params.items_count === 3 && e.params.mode === 'promo'));
  check('F28: Danh mục có nút Tạo combo khi ≥ 2 sản phẩm', (await h.has('#make-combo')) === ((await h.q('window.__app.state().products.length')) >= 2));
  await click('#make-combo');
  await sleep(300);
  check('F28: Tạo combo → bảng chọn sản phẩm đã lưu (giá vốn, ngành tự điền)', (await h.has('#item-sheet')) && (await h.count('.pick-product')) >= 2);
  await click('.pick-product');
  await sleep(200);
  await click('#add-item');
  await sleep(200);
  await click('.pick-product');
  await sleep(200);
  await click('.qty-plus');
  await sleep(150);
  check('F28: 2 món từ danh mục, số lượng +/−, kết quả tính ngay', (await h.count('.combo-item')) === 2 && (await h.text('.combo-item .qn')) === '2' && /Bán lẻ 3 đơn/.test(await h.text('#combo-compare')));
  await shot('Combo — dựng từ danh mục');
  await h.tab('san-pham');
}

// ---------------------------------------------------------------- Phase 3 · P1
async function phase3(t, h) {
  const { click, type, shot, check, sleep } = t;
  // Sàn đổi phí trở lại 6% (biểu phí mới hơn) để số liệu về đúng ca thiết kế.
  await h.q(`(async () => { const p = await (await fetch('assets/fee_presets.json', { cache: 'no-store' })).json();
    p.fee_version = '2026-11-14.2'; return window.__app.receivePresets(p); })()`);
  await h.tab('san-pham');
  const mkId = await h.q("[...document.querySelectorAll('.product-card')].find((c) => c.querySelector('strong').textContent.trim() === 'Móc khóa')?.dataset.id");
  await click(`.product-card[data-id="${mkId}"]`);
  await sleep(300);
  await click('#product-to-calc');
  await sleep(300);
  check('F19: "Thử trong Tính nhanh" chép Móc khóa sang Tính nhanh', (await h.route()) === '#/tinh' && (await h.text('#screen-title')) === 'Tính nhanh' && (await h.value('#price')) === '17.000');
  check('P1: móc khóa về 505đ với biểu phí 2026-11-14.2', (await h.text('#profit')) === '505đ', await h.text('#profit'));

  // F13 — lãi tháng
  await type('#orders-month', '300');
  await sleep(100);
  check('F13: 300 đơn/tháng → "Lãi tháng ≈ 151.500đ"', (await h.text('#monthly-profit')) === 'Lãi tháng ≈ 151.500đ', await h.text('#monthly-profit'));
  await shot('Lãi tháng: 300 đơn → 151.500đ');

  // F14 — chia sẻ
  await click('#share-result');
  await sleep(250);
  check('F14: máy tính không có bảng chia sẻ → chép vào bộ nhớ tạm, báo "Đã chép kết quả, dán vào Zalo"', /Đã chép kết quả, dán vào Zalo/.test(await h.text('#toast') ?? ''));
  const share = await h.q('window.__app.lastShare()');
  check('F14: nội dung chia sẻ có lãi 505đ, giá nên bán 22.900đ, ngày biểu phí, "Tính bằng Lãi Thật"',
    /Lãi mỗi đơn: 505đ \(Lãi mỏng 3,0%\)/.test(share) && /22\.900đ/.test(share) && /cập nhật 12\/11\/2026/.test(share) && /Tính bằng Lãi Thật/.test(share), share);
  check('F14: event share_result {channel}', (await h.events()).some((e) => e.name === 'share_result' && e.params.channel === 'other' && Object.keys(e.params).length === 1));

  // F18 — shop mới
  await h.tab('cai-dat');
  await click('#new-shop');
  await h.tab('tinh');
  check('F18: shop mới (miễn phí cố định 30 ngày) → móc khóa lãi 3.225đ', (await h.text('#profit')) === '3.225đ' && /tối đa 200 đơn/.test(await h.text('#promo-hint')), await h.text('#profit'));
  await shot('Shop mới: miễn phí cố định 30 ngày');
  await h.tab('cai-dat');
  await click('#new-shop');

  // F17 — nhắc mùa sale
  await h.q(`window.__app.setToday('2026-11-12')`);
  await sleep(150);
  check('F17: Cài đặt "Sale gần nhất: 12.12 · còn 30 ngày"', (await h.text('#next-sale')) === 'Sale gần nhất: 12.12 · còn 30 ngày', await h.text('#next-sale'));
  check('F17: có công tắc nhắc sale', await h.has('#sale-reminders'));
  await h.q(`window.__app.setToday('2026-12-09')`);
  await sleep(150);
  check('F17: còn 3 ngày → thông báo nhắc trong hộp thông báo', /Còn 3 ngày tới 12\.12/.test(await h.text('#notif-inbox')));
  await h.tab('san-pham');
  check('F17: băng nhắc trên Danh mục "Còn 3 ngày tới 12.12 — kiểm tra giá Flash Sale"', /Còn 3 ngày tới 12\.12 — kiểm tra giá Flash Sale/.test(await h.text('#sale-banner') ?? ''));

  // F16 — áp giá gợi ý hàng loạt
  await click('#bulk-mode');
  await sleep(150);
  check('F16: chế độ chọn — 2 sản phẩm lỗ được chọn sẵn', (await h.count('.bulk-check:checked')) === 2 && (await h.text('#apply-suggested')) === 'Áp giá gợi ý cho 2 sản phẩm');
  await shot('Danh mục: chọn sản phẩm để áp giá gợi ý');
  await click('#apply-suggested');
  await sleep(250);
  const after = await h.q(`[...document.querySelectorAll('.product-card')].map((c) => c.querySelector('strong').textContent.trim() + ' ' + c.querySelector('.m').textContent.trim())`);
  check('F16: Kẹp tóc 18.900đ, Ốp điện thoại 34.900đ; hết sản phẩm lỗ',
    after.some((x) => /^Kẹp tóc .*bán 18\.900đ/.test(x)) && after.some((x) => /^Ốp điện thoại .*bán 34\.900đ/.test(x)) && (await h.text('#filter-loss')) === 'Đang lỗ · 0', after.join(' | '));
  check('F16: có nút hoàn tác', await h.has('#undo-apply'));
  await shot('Danh mục: đã áp giá gợi ý');
  await click('#undo-apply');
  await sleep(200);
  check('F16: hoàn tác → lại 2 sản phẩm lỗ', (await h.text('#filter-loss')) === 'Đang lỗ · 2');

  // F18 — không còn Mall (bỏ 13/11)
  await h.tab('tinh');
  await click('#platform-chip');
  await sleep(150);
  check('F18: sheet chọn sàn không còn Mall; chip chỉ ghi tên sàn', !(await h.has('#sheet-shop-mall')) && !/Mall|Shop thường/.test(await h.text('#platform-chip')));
  await click('#sheet-done');
  await sleep(200);

  // F15 — ví dụ mẫu (máy mới: xoá dữ liệu)
  await h.q('localStorage.clear(); location.hash = ""; location.reload()');
  await sleep(1300);
  await h.until(() => h.has('#pf-shopee'));
  await h.noSplash();
  await click('#pf-shopee');
  await click('#onboard-continue');
  await sleep(300);
  const ex = await h.q(`[...document.querySelectorAll('#examples .example')].map((b) => b.textContent.replace(/\\s+/g, ' ').trim())`);
  check('F15: lần đầu có 3 ví dụ: Móc khóa 17.000đ · Áo thun nữ 149.000đ · Kẹp tóc 12.000đ', ex.join(' | ') === 'Móc khóa 17.000đ | Áo thun nữ 149.000đ | Kẹp tóc 12.000đ', ex.join(' | '));
  await shot('Lần đầu: ví dụ nhanh');
  await click('#examples .example[data-v="moc-khoa"]');
  await sleep(200);
  check('F15: chạm Móc khóa → điền đủ, lãi 505đ, khối ví dụ ẩn', (await h.text('#profit')) === '505đ' && !(await h.has('#examples')) && (await h.value('#pack')) === '1.500');
  await h.tab('san-pham');
  check('F15: danh mục trống có "Thêm 4 sản phẩm mẫu"', (await h.has('#catalog-empty')) && (await h.has('#load-examples')));
  await click('#load-examples');
  await sleep(200);
  check('F15: thêm 4 sản phẩm mẫu, có nhãn "mẫu"', (await h.count('.product-card')) === 4 && (await h.count('.product-card .badge')) === 4);
  await shot('Danh mục mẫu');
}

// ---------------------------------------------------------------- Phase 2 · ngày 2
async function setProduct({ click }, h, { category, cost, price, pack }) {
  await h.select('#category', category);
  await h.typeMoney('#cost', cost);
  await h.typeMoney('#price', price);
  if (pack != null) {
    if (!(await h.has('#pack'))) await click('#other-costs');
    await h.typeMoney('#pack', pack);
  }
}
async function saveAs({ click, type, sleep }, h, name) {
  await click('#save-product');
  await sleep(150);
  await type('#product-name', name);
  await click('#save-confirm');
  await sleep(250);
}

async function phase2(t, h) {
  const { click, type, shot, check, sleep } = t;
  check('Phase 2: có thanh điều hướng Tính · So sánh · Sản phẩm · Cài đặt',
    (await h.has('#tab-tinh')) && (await h.has('#tab-so-sanh')) && (await h.has('#tab-san-pham')) && (await h.has('#tab-cai-dat')));

  // F7 — so sánh sàn (móc khóa đang mở ở màn Tính lãi)
  await h.tab('so-sanh');
  const cards = await h.q(`[...document.querySelectorAll('.compare-card[data-platform]')].map((c) => c.dataset.platform)`);
  check('F7: TikTok Shop lãi hơn đứng đầu, rồi Shopee, Lazada cuối', cards.join(',') === 'tiktok_shop,shopee,lazada', cards.join(','));
  check('F7: TikTok 1.015đ "Lãi mỏng · 6,0%"', /1\.015đ Lãi mỏng · 6,0%/.test(await h.text('.compare-card[data-platform="tiktok_shop"] .cmp-profit')), await h.text('.compare-card[data-platform="tiktok_shop"] .cmp-profit'));
  check('F7: Shopee 505đ "Lãi mỏng · 3,0%", kém 510đ/đơn',
    /505đ Lãi mỏng · 3,0%/.test(await h.text('.compare-card[data-platform="shopee"] .cmp-profit')) && (await h.text('.compare-card[data-platform="shopee"] .cmp-diff')) === 'kém 510đ/đơn');
  check('F7: Lazada chưa có % → có ô #lazada-rate', await h.has('#lazada-rate'));
  await type('#compare-orders', '300');
  check('F7: 300 đơn/tháng → chênh nhau 153.000đ', /chênh nhau 153\.000đ/.test(await h.text('#compare-monthly')), await h.text('#compare-monthly'));
  check('F7: ghi chú TikTok MST', /chưa đăng ký MST/.test(await h.body()) && /Sửa trong từng dòng phí/.test(await h.body()));
  await shot('So sánh sàn: móc khóa');
  await type('#lazada-rate', '10');
  await h.q(`document.querySelector('#lazada-rate').dispatchEvent(new Event('change', { bubbles: true }))`);
  await sleep(200);
  check('F7: nhập 10% hoa hồng Lazada → hiện lãi Lazada', /đ/.test(await h.text('.compare-card[data-platform="lazada"] .cmp-profit') ?? ''));
  check('F7: event compare_viewed {best_platform: tiktok_shop, platforms_count: 2}',
    (await h.events()).some((e) => e.name === 'compare_viewed' && e.params.best_platform === 'tiktok_shop' && e.params.platforms_count === 2));

  // F10 — lưu 4 sản phẩm qua giao diện
  await h.tab('tinh');
  await saveAs(t, h, 'Móc khóa');
  check('F19: lưu từ Tính nhanh → báo đã lưu, Tính nhanh vẫn là nháp ("Lưu thành sản phẩm")', /Đã lưu/.test(await h.text('#toast') ?? '') && (await h.text('#save-product')) === 'Lưu thành sản phẩm' && (await h.text('#screen-title')) === 'Tính nhanh');
  await setProduct(t, h, { category: 'Phụ Kiện Thời Trang', cost: 6000, price: 12000 });
  await saveAs(t, h, 'Kẹp tóc');
  await setProduct(t, h, { category: 'Điện Thoại & Phụ Kiện', cost: 15000, price: 25000 });
  await saveAs(t, h, 'Ốp điện thoại');
  await setProduct(t, h, { category: 'Thời Trang Nữ', cost: 60000, price: 149000, pack: 3000 });

  // F8 — chi phí ẩn cho áo thun
  await click('#to-hidden');
  await sleep(300);
  check('F8: mở Chi phí ẩn — chỉ phí sàn 47.240đ', (await h.route()) === '#/chi-phi-an' && /47\.240đ/.test(await h.text('#hc-base')), await h.text('#hc-base'));
  await click('#hc-return');
  await type('#return-rate', '8');
  await h.q(`document.querySelector('#return-rate').dispatchEvent(new Event('change', { bubbles: true }))`);
  await sleep(150);
  await h.typeMoney('#loss-per-return', 30000);
  await sleep(100);
  check('F8: hoàn 8%, mất 30.000đ/đơn → 41.061đ', (await h.text('#hc-profit')) === '41.061đ' && (await h.text('#hc-return-step')) === '47.240đ → 41.061đ', await h.text('#hc-profit'));
  await click('#hc-voucher');
  await sleep(150);
  check('F8: + Voucher Xtra → 33.521đ · Lãi · 22,5%', (await h.text('#hc-profit')) === '33.521đ' && (await h.text('#hc-state')) === 'Lãi · 22,5%');
  check('F8: "Thấp hơn 13.719đ so với chỉ tính phí sàn"', (await h.text('#hc-diff')) === 'Thấp hơn 13.719đ so với chỉ tính phí sàn.');
  check('F8: ROAS hòa vốn 4,09 · tối đa 36.436đ/đơn', (await h.text('#roas-breakeven')) === '4,09' && (await h.text('#max-ads')) === '36.436đ/đơn', `${await h.text('#roas-breakeven')} ${await h.text('#max-ads')}`);
  await shot('Chi phí ẩn: áo thun hoàn 8% + Voucher Xtra');
  await click('#hc-voucher');
  await sleep(150);
  check('F8: tắt voucher → ROAS 3,34 · 44.631đ/đơn', (await h.text('#roas-breakeven')) === '3,34' && (await h.text('#max-ads')) === '44.631đ/đơn');
  await click('#hc-ads');
  await type('#roas', '8');
  await h.q(`document.querySelector('#roas').dispatchEvent(new Event('change', { bubbles: true }))`);
  await sleep(150);
  check('F8: ROAS 8 trừ thêm quảng cáo mỗi đơn', (await h.text('#hc-profit')) !== '41.061đ', await h.text('#hc-profit'));
  await click('#hc-ads');
  await sleep(150);
  await click('#hc-apply');
  await sleep(300);
  check('F8: áp dụng → Tính lãi 41.061đ; event hidden_costs_set',
    (await h.text('#profit')) === '41.061đ' && (await h.events()).some((e) => e.name === 'hidden_costs_set' && e.params.has_return_rate === true), await h.text('#profit'));
  await saveAs(t, h, 'Áo thun nữ');

  // F10 — danh mục
  await h.tab('san-pham');
  const list = await h.q(`[...document.querySelectorAll('.product-card')].map((c) => c.querySelector('strong').textContent.trim() + ' ' + c.querySelector('.amt').textContent.trim() + ' ' + c.querySelector('.st').textContent.trim())`);
  check('F10: lãi thấp nhất lên đầu', list.join(' | ') === 'Kẹp tóc −1.380đ Lỗ · −11,5% | Ốp điện thoại −125đ Lỗ · −0,5% | Móc khóa 505đ Lãi mỏng · 3,0% | Áo thun nữ 41.061đ Lãi · 27,6%', list.join(' | '));
  const sug = await h.q(`[...document.querySelectorAll('.product-card .suggested')].map((s) => s.textContent.trim())`);
  check('F10: giá gợi ý 18.900đ, 34.900đ (và móc khóa 22.900đ)', sug.join(',') === '18.900đ,34.900đ,22.900đ', sug.join(','));
  check('F10: bộ lọc "Đang lỗ · 2" và "Lãi mỏng · 1"', (await h.text('#filter-loss')) === 'Đang lỗ · 2' && (await h.text('#filter-thin')) === 'Lãi mỏng · 1');
  check('F10: "4/5 miễn phí"', (await h.text('#catalog-count')) === '4/5 miễn phí');
  await shot('Danh mục: lãi thấp nhất lên đầu');
  await click('#filter-loss');
  check('F10: lọc "Đang lỗ" còn 2 sản phẩm', (await h.count('.product-card')) === 2);
  await click('#filter-all');
  const saved = (await h.events()).filter((e) => e.name === 'product_saved');
  check('F10: event product_saved ×4, catalog_sorted_alert {loss_count_bucket: 2–5}',
    saved.length === 4 && saved.at(-1).params.catalog_size === 4 && (await h.events()).some((e) => e.name === 'catalog_sorted_alert' && e.params.loss_count_bucket === '2–5'));
  await h.q('location.reload()');
  await sleep(1200);
  await h.until(() => h.has('.product-card'));
  await h.noSplash();
  check('F10: danh mục còn sau khi tải lại', (await h.count('.product-card')) === 4);
  await click('.product-card[data-act="open-product"]:nth-of-type(3)');
  await sleep(300);
  check('F10/F19: chạm "Móc khóa" mở màn sản phẩm đúng đầu vào', (await h.route()).startsWith('#/san-pham/') && (await h.text('#screen-title')) === 'Móc khóa' && (await h.text('#profit')) === '505đ' && (await h.value('#price')) === '17.000', `${await h.route()} ${await h.text('#profit')}`);

  // F9 — Flash Sale & giá nhập tối đa
  await click('#mode-margin');
  await sleep(250);
  const rows = await h.q(`[...document.querySelectorAll('#flash-sale .flash-row')].map((r) => r.textContent.replace(/\\s+/g, ' ').trim())`);
  check('F9: Flash Sale 10/20/30% từ 22.900đ', rows.join(' | ') === 'Giảm 10% → 20.610đ 3.267đ · Lãi 15,8% | Giảm 20% → 18.320đ 1.515đ · Mỏng 8,3% | Giảm 30% → 16.030đ −237đ · Lỗ', rows.join(' | '));
  check('F9: giá nhập tối đa 8.438đ', (await h.text('#max-cost')) === 'Giá nhập tối đa: 8.438đ', await h.text('#max-cost'));
  check('F9: event flash_sale_viewed + max_cost_viewed', (await h.events()).some((e) => e.name === 'flash_sale_viewed') && (await h.events()).some((e) => e.name === 'max_cost_viewed'));
  await shot('Từ % lãi: Flash Sale + giá nhập tối đa');
  await click('#mode-price');
  await sleep(200);

  // F11 — báo động đổi phí
  await h.tab('cai-dat');
  check('F11: Cài đặt hiện phiên bản biểu phí 2026-11-12.1', /2026-11-12\.1/.test(await h.text('#fee-version')));
  await click('#alerts-toggle');
  await sleep(300);
  const pushed = await h.q(`(async () => { const p = await (await fetch('assets/fee_presets.json', { cache: 'no-store' })).json();
    p.fee_version = '2026-11-14.1'; p.platforms.shopee.transaction_fee.rate = 0.09; return window.__app.receivePresets(p); })()`);
  await sleep(300);
  check('F11: nhận biểu phí mới 2026-11-14.1 (Remote Config giả lập)', pushed === true && /2026-11-14\.1/.test(await h.text('#fee-version')));
  check('F11: có thông báo trong hộp thông báo', (await h.count('#notif-inbox .notif')) === 1 && /1 sản phẩm chuyển sang lỗ/.test(await h.text('#notif-inbox')));
  await shot('Cài đặt: thông báo đổi phí');
  await h.tab('san-pham');
  check('F11: Danh mục có cảnh báo "Biểu phí Shopee mới đã áp dụng · 1 sản phẩm chuyển sang lỗ"',
    /Biểu phí Shopee mới đã áp dụng/.test(await h.text('#fee-alert')) && /1 sản phẩm chuyển sang lỗ/.test(await h.text('#fee-alert')), await h.text('#fee-alert'));
  await shot('Danh mục: báo động đổi phí');
  await click('#fee-alert-action');
  await sleep(200);
  const alertList = await h.q(`[...document.querySelectorAll('.product-card')].map((c) => c.querySelector('strong').textContent.trim() + ' ' + (c.querySelector('.suggested')?.textContent ?? ''))`);
  check('F11: "Xem giá đề xuất" → chỉ còn Móc khóa (lỗ) kèm giá gợi ý mới', alertList.length === 1 && /^Móc khóa \d/.test(alertList[0]) && !/22\.900đ/.test(alertList[0]), alertList.join(' | '));
  const ev = await h.events();
  check('F11: event fee_table_updated {products_turned_loss: 1} + fee_alert_opened',
    ev.some((e) => e.name === 'fee_table_updated' && e.params.products_turned_loss === 1 && e.params.fee_version === '2026-11-14.1') && ev.some((e) => e.name === 'fee_alert_opened'));
  const again = await h.q(`(async () => { const p = await (await fetch('assets/fee_presets.json', { cache: 'no-store' })).json();
    p.fee_version = '2026-11-14.1'; p.platforms.shopee.transaction_fee.rate = 0.09; return window.__app.receivePresets(p); })()`);
  check('F11: cùng fee_version thì không báo lại', again === false && (await h.q('window.__app.state().notifications.length')) === 1);

  // F12 — phễu tracking
  const names = (await h.events()).map((e) => e.name);
  const iO = names.indexOf('onboarding_completed');
  const iC = names.indexOf('calc_completed');
  const iP = names.indexOf('product_saved');
  check('F12: phễu onboarding_completed → calc_completed → product_saved', iO >= 0 && iC > iO && iP > iC, `${iO} ${iC} ${iP}`);
  const cc = (await h.events()).find((e) => e.name === 'calc_completed');
  check('F12: calc_completed có state, margin_bucket, không có giá', !!cc && 'state' in cc.params && 'margin_bucket' in cc.params && !('price' in cc.params) && !('cost' in cc.params), JSON.stringify(cc?.params));
}

export function helpers({ evaluate, click, type, sleep }) {
  // shot() chụp sau khi hiệu ứng 140–200ms chạy xong để ảnh không bị bắt giữa chừng.
  const S = (s) => JSON.stringify(s);
  const q = (js) => evaluate(js);
  return {
    q,
    text: (s) => q(`document.querySelector(${S(s)})?.textContent.replace(/\\s+/g, ' ').trim() ?? null`),
    has: (s) => q(`!!document.querySelector(${S(s)})`),
    count: (s) => q(`document.querySelectorAll(${S(s)}).length`),
    attr: (s, a) => q(`document.querySelector(${S(s)})?.getAttribute(${S(a)}) ?? null`),
    disabled: (s) => q(`!!document.querySelector(${S(s)})?.disabled`),
    value: (s) => q(`document.querySelector(${S(s)})?.value ?? null`),
    route: () => q('location.hash'),
    events: () => q('window.__app.events ? window.__app.events() : window.__app.state().events'),
    body: () => q('document.body.innerText'),
    select: (s, v) => q(`(() => { const el = document.querySelector(${S(s)}); el.value = ${S(v)}; el.dispatchEvent(new Event('change', { bubbles: true })); })()`),
    until: async (fn, ms = 4000) => { for (let i = 0; i < ms; i += 100) { if (await fn().catch(() => false)) return true; await sleep(100); } return false; },
    // Màn mở app (F20) che màn hình ~1,2 giây sau mỗi lần mở/tải lại: chờ nó ẩn.
    noSplash: async () => { for (let i = 0; i < 60; i++) { if (await q('document.readyState === "complete" && !!window.__app && !document.querySelector("#splash")').catch(() => false)) return; await sleep(100); } },
    back: async () => { await click('.top [aria-label="Quay lại"]'); await sleep(250); },
    typeMoney: async (sel, v) => { await type(sel, String(v)); await sleep(60); },
    // Bàn phím đang mở (thanh 000) che thanh điều hướng: bấm Xong trước, như người dùng.
    tab: async (id) => { if (await q('!!document.querySelector("#key-done")')) { await click('#key-done'); await sleep(120); } await click('#tab-' + id); await sleep(300); },
  };
}

// ---------------------------------------------------------------- Phase 1 · ngày 1
async function phase1({ click, type, shot, check, sleep }, h) {
  // F3 — chọn sàn
  check('F3: mở lần đầu thấy 4 lựa chọn sàn, không hỏi loại shop / Mall',
    (await h.count('[role="radio"][id^="pf-"]')) === 4 && !(await h.has('#shop-mall')) && !/Mall/.test(await h.body()));
  check('F3: chưa chọn sàn thì "Tiếp tục" bị vô hiệu', await h.disabled('#onboard-continue'));
  check('F3: ghi ngày biểu phí "Biểu phí từ 23/05/2026 · 31 ngành"', /Biểu phí từ 23\/05\/2026 · 31 ngành/.test(await h.text('#pf-shopee')));
  check('Logo: màn Chọn sàn có logo Lãi Thật mới, tải được', await h.q("(() => { const i = document.querySelector('#brand-logo'); return !!i && i.complete && i.naturalWidth > 0 && i.alt === 'Lãi Thật'; })()"));
  check('F3: có câu không liên kết với sàn', /không liên kết với Shopee, TikTok hay Lazada/.test(await h.body()));
  await click('#pf-shopee');
  check('F3: chọn Shopee → aria-checked', (await h.attr('#pf-shopee', 'aria-checked')) === 'true' && (await h.attr('#pf-lazada', 'aria-checked')) === 'false');
  await shot('Chọn sàn chính');
  await click('#onboard-continue');
  await sleep(300);
  check('F3: Tiếp tục → màn Tính lãi', (await h.route()) === '#/tinh');
  check('F3: event onboarding_completed {primary_platform: shopee} (không gửi shop_type)',
    (await h.events()).some((e) => e.name === 'onboarding_completed' && e.params.primary_platform === 'shopee' && !('shop_type' in e.params)));

  // F4 — móc khóa
  await h.select('#category', 'Sở thích & Sưu tầm');
  await sleep(150);
  check('F2/F4: chọn ngành điền sẵn 16%', (await h.value('#category-rate')) === '16');
  check('F4: không có nút "Tính" trong màn (kết quả hiện khi gõ; "Tính" ở thanh đáy là tên tab)',
    !(await h.q(`[...document.querySelectorAll('.screen button, .result button')].some((b) => /^Tính( tiền| lãi)?$/.test(b.textContent.trim()))`)));
  await h.typeMoney('#cost', 8000);
  await h.typeMoney('#price', 17000);
  check('F4: ô tiền tự chèn dấu chấm "17.000"', (await h.value('#price')) === '17.000', await h.value('#price'));
  check('F4: đang gõ có thanh phụ phím 000', await h.has('#key-000'));
  await click('#other-costs');
  await h.typeMoney('#pack', 1500);
  await sleep(150);
  check('F4: móc khóa → lãi 505đ', (await h.text('#profit')) === '505đ', await h.text('#profit'));
  check('F4: nhãn "Lãi mỏng" · 3,0%', (await h.text('#state-label')) === 'Lãi mỏng' && (await h.text('#margin')) === '3,0%');
  check('F4: hòa vốn 16.340đ', /16\.340đ/.test(await h.text('#breakeven')));
  check('F4: thẻ kết quả dính đáy (fixed) và có data-state="thin"',
    (await h.attr('#result', 'data-state')) === 'thin' && (await h.q(`getComputedStyle(document.querySelector('#result')).position`)) === 'fixed');
  const bar = await h.q(`[...document.querySelectorAll('#money-bar .bar-seg')].map((s) => s.dataset.key + ':' + Math.round(parseFloat(s.style.width)))`);
  check('F4: dải tiền đi đâu 41% · 56% · 3%', bar.join(',') === 'fees:41,cost:56,profit:3', bar.join(','));
  check('F2: có "Biểu phí Shopee cập nhật 12/11/2026"', /Biểu phí Shopee cập nhật 12\/11\/2026/.test(await h.text('#fee-date')));
  check('F4: không có quảng cáo trên màn Tính lãi', !(await h.q(`!!document.querySelector('[id*="ad-"], .ad-banner')`)));
  await shot('Tính lãi: móc khóa 17.000đ → lãi 505đ');

  // F4 — sửa %, mã giảm giá, lỗ
  await h.typeMoney('#voucher', 1000);
  const withVoucher = await h.text('#profit');
  await h.typeMoney('#voucher', '');
  check('F4: mã giảm giá shop 1.000đ làm giảm lãi', withVoucher !== '505đ' && (await h.text('#profit')) === '505đ', withVoucher);
  await type('#category-rate', '16,5');
  await h.typeMoney('#cost', 6000);
  await h.typeMoney('#price', 12000);
  await sleep(150);
  check('F4: kẹp tóc 12.000đ, vốn 6.000đ, 16,5% → Lỗ −1.380đ', (await h.text('#profit')) === '−1.380đ' && (await h.text('#state-label')) === 'Lỗ', await h.text('#profit'));
  await shot('Kẹp tóc: Lỗ −1.380đ');
  await type('#category-rate', '16');
  await h.typeMoney('#cost', 8000);
  await h.typeMoney('#price', 17000);
  await sleep(150);

  // F4 — nhớ lần trước
  await h.q('location.reload()');
  await sleep(1200);
  await h.until(() => h.has('#profit'));
  await h.noSplash();
  check('F4: tải lại vẫn nhớ ngành, giá vốn, đóng gói', (await h.value('#cost')) === '8.000' && (await h.text('#profit')) === '505đ');

  // F6 — chi tiết phí
  await click('#to-breakdown');
  await sleep(300);
  check('F6: mở "17.000đ đi đâu?"', (await h.route()) === '#/chi-tiet' && (await h.text('#screen-title')) === '17.000đ đi đâu?');
  check('F6: "Sàn + thuế lấy 6.995đ, tức 41% giá bán"', (await h.text('#take-rate')) === 'Sàn + thuế lấy 6.995đ, tức 41% giá bán', await h.text('#take-rate'));
  const lines = await h.q(`[...document.querySelectorAll('.fee-line[data-key]')].map((l) => l.dataset.key + ' ' + l.querySelector('.fl-amt').textContent.trim())`);
  check('F6: các dòng phí đúng', lines.join(' | ') === 'category −2.720đ | transaction −1.020đ | per_order −3.000đ | tax −255đ | pack −1.500đ | cost −8.000đ', lines.join(' | '));
  check('F6: "Còn lại: lãi mỏng 505đ"', (await h.text('#remaining')) === 'Còn lại: lãi mỏng 505đ');
  await click('.fee-line[data-key="transaction"] .fee-info');
  const basis = await h.text('.fee-line[data-key="transaction"] .fee-basis');
  check('F6: (i) ghi cách tính + nguồn + ngày', /6% × \(giá sau mã giảm giá shop \+ ship người mua trả\)/.test(basis) && /Học viện Shopee/.test(basis) && /01\/05\/2026/.test(basis), basis);
  await shot('Chi tiết phí: 17.000đ đi đâu?');
  await click('#prog-piship');
  check('F6: bật PiShip → còn lại giảm 2.700đ', /−2\.195đ/.test(await h.text('#remaining')), await h.text('#remaining'));
  await click('#prog-piship');
  await click('#tax-vat');
  check('F6: tắt GTGT → lãi tăng 170đ', /675đ/.test(await h.text('#remaining')), await h.text('#remaining'));
  await click('#tax-vat');
  await type('#rate-transaction', '5');
  await h.q(`document.querySelector('#rate-transaction').dispatchEvent(new Event('change', { bubbles: true }))`);
  await sleep(150);
  check('F2/F6: sửa % giao dịch 5% → lãi tăng 170đ', /675đ/.test(await h.text('#remaining')), await h.text('#remaining'));
  await click('[data-act="reset-fees"]');
  await click('#report-fee');
  check('F2: "Báo sai phí" → cảm ơn + event fee_report_sent', /Cảm ơn/.test(await h.text('#toast') ?? '') && (await h.events()).some((e) => e.name === 'fee_report_sent'));
  const ev = (await h.events()).map((e) => e.name);
  check('F6: event fee_breakdown_opened, fee_info_opened, program_toggled, fee_override',
    ['fee_breakdown_opened', 'fee_info_opened', 'program_toggled', 'fee_override'].every((n) => ev.includes(n)));
  await h.back();

  // F5 — từ % lãi
  await click('#mode-margin');
  await sleep(200);
  check('F5: tab "Từ % lãi muốn có" được chọn', (await h.attr('#mode-margin', 'aria-selected')) === 'true');
  check('F5: 5 chip, 20% chọn sẵn', (await h.count('.margin-chip')) === 5 && (await h.attr('.margin-chip[data-m="0.2"]', 'aria-pressed')) === 'true'
    && /20% là mức nhiều shop chọn làm chuẩn/.test(await h.body()));
  check('F5: giá nên bán 22.900đ', (await h.text('#nice-price')) === '22.900đ', await h.text('#nice-price'));
  const np = await h.text('#nice-profit');
  check('F5: lãi 5.018đ · 21,9%, tối thiểu 22.124đ', /Lãi 5\.018đ · 21,9%/.test(np) && /tối thiểu 22\.124đ/.test(np), np);
  check('F5: hòa vốn 16.340đ', (await h.text('#breakeven-margin')) === '16.340đ');
  await shot('Từ % lãi: 20% → giá nên bán 22.900đ');
  await click('.margin-chip[data-m="0.3"]');
  const p30 = await h.text('#nice-price');
  await click('#margin-amount-toggle');
  await h.typeMoney('#target-amount', 5000);
  await sleep(150);
  const pAmt = await h.text('#nice-price');
  check('F5: nhập số tiền lãi 5.000đ ra giá nên bán', /đ$/.test(pAmt) && pAmt !== p30, `${p30} / ${pAmt}`);
  await click('#margin-amount-toggle');
  await click('.margin-chip[data-m="0.2"]');
  check('F5: nút "Dùng giá 22.900đ"', (await h.text('#apply-price')) === 'Dùng giá 22.900đ');
  await click('#apply-price');
  await sleep(250);
  check('F5: dùng giá → về Từ giá bán, giá 22.900, lãi 5.018đ',
    (await h.attr('#mode-price', 'aria-selected')) === 'true' && (await h.value('#price')) === '22.900' && (await h.text('#profit')) === '5.018đ', await h.text('#profit'));
  check('F5: event nice_price_applied {target_margin: 20}', (await h.events()).some((e) => e.name === 'nice_price_applied' && e.params.target_margin === '20'));
  await h.typeMoney('#price', 17000);
  await sleep(100);
}

// ---------------------------------------------------------------- Phase 4 · phản hồi người dùng (F19, F20)
async function phase4(t, h) {
  const { click, type, shot, check, sleep } = t;
  const openProduct = async (name) => {
    await h.tab('san-pham');
    await h.q(`[...document.querySelectorAll('.product-card')].find((c) => c.querySelector('strong').textContent.trim().startsWith(${JSON.stringify(name)}))?.scrollIntoView({ block: 'center' })`);
    const id = await h.q(`[...document.querySelectorAll('.product-card')].find((c) => c.querySelector('strong').textContent.trim().startsWith(${JSON.stringify(name)}))?.dataset.id`);
    await click(`.product-card[data-id="${id}"]`);
    await sleep(300);
    return id;
  };

  // F19 — Tính nhanh là nháp; lưu 2 lần → 2 sản phẩm
  await h.tab('tinh');
  check('F19: tab Tính có tiêu đề "Tính nhanh", không có "+ Sản phẩm mới"', (await h.text('#screen-title')) === 'Tính nhanh' && !(await h.has('#new-product')));
  await h.select('#category', 'Sở thích & Sưu tầm');
  await h.typeMoney('#cost', 8000);
  await h.typeMoney('#price', 17000);
  const before = await h.q('window.__app.state().products.length');
  await saveAs(t, h, 'Móc khóa gỗ');
  await saveAs(t, h, 'Móc khóa gỗ');
  check('F19: lưu 2 lần từ Tính nhanh → thêm 2 sản phẩm', (await h.q('window.__app.state().products.length')) === before + 2);

  // F19 — màn sản phẩm riêng
  const id = await openProduct('Móc khóa gỗ');
  check('F19: chạm sản phẩm → #/san-pham/<id>, tiêu đề là tên sản phẩm, tab Sản phẩm sáng, có nút quay lại',
    (await h.route()) === `#/san-pham/${id}` && (await h.text('#screen-title')) === 'Móc khóa gỗ'
    && (await h.attr('#tab-san-pham', 'aria-current')) === 'page' && (await h.has('.top [aria-label="Quay lại"]')));
  check('F19: "Lưu thay đổi" chưa bấm được khi chưa sửa', await h.disabled('#product-save'));
  await shot('Màn sản phẩm: Móc khóa gỗ');
  await h.typeMoney('#price', 19000);
  await sleep(100);
  check('F19: sửa giá → "Lưu thay đổi" bấm được', !(await h.disabled('#product-save')));
  await h.tab('tinh');
  check('F19: rời màn sản phẩm khi chưa lưu → hỏi Lưu / Bỏ thay đổi', (await h.has('#leave-save')) && (await h.has('#leave-discard')));
  await shot('Hỏi khi rời sản phẩm chưa lưu');
  await click('#leave-discard');
  await sleep(300);
  check('F19: bỏ thay đổi → sang Tính nhanh, số Tính nhanh không bị đổi (17.000)', (await h.route()) === '#/tinh' && (await h.value('#price')) === '17.000');
  await h.typeMoney('#price', 21000);
  await sleep(100);
  await openProduct('Móc khóa gỗ');
  check('F19: Tính nhanh đổi giá không đụng sản phẩm (vẫn 17.000)', (await h.value('#price')) === '17.000');
  await h.typeMoney('#price', 22900);
  await type('#product-name-edit', 'Móc khóa gỗ 22.9k');
  await click('#product-save');
  await sleep(250);
  check('F19: "Lưu thay đổi" → báo đã lưu, nút tắt lại', /Đã lưu thay đổi/.test(await h.text('#toast') ?? '') && (await h.disabled('#product-save')));
  await click('#to-breakdown');
  await sleep(300);
  check('F19: Chi tiết phí mở từ màn sản phẩm đúng sản phẩm', (await h.route()) === `#/san-pham/${id}/chi-tiet` && (await h.text('#screen-title')) === '22.900đ đi đâu?');
  await h.back();
  check('F19: quay lại đúng màn sản phẩm', (await h.route()) === `#/san-pham/${id}`);
  await h.tab('san-pham');
  const row = await h.q(`(() => { const c = document.querySelector('.product-card[data-id="${id}"]'); return c ? c.textContent.replace(/\\s+/g, ' ').trim() : ''; })()`);
  check('F19: danh mục hiện tên + lãi mới (5.018đ)', /Móc khóa gỗ 22\.9k/.test(row) && /5\.018đ/.test(row), row);
  await openProduct('Móc khóa gỗ 22.9k');
  const n = await h.q('window.__app.state().products.length');
  await click('#product-delete');
  check('F19: xoá cần bấm 2 lần', (await h.text('#product-delete')) === 'Bấm lần nữa để xoá');
  await click('#product-delete');
  await sleep(300);
  check('F19: xoá → về danh mục, bớt 1 sản phẩm', (await h.route()) === '#/san-pham' && (await h.q('window.__app.state().products.length')) === n - 1);

  // F20 — logo chỉ ở màn mở app + Chọn sàn
  await h.tab('cai-dat');
  check('F20: màn Cài đặt không có logo', !(await h.has('#settings-brand')) && !(await h.has('.brand-logo')));
  await h.q('location.reload()');
  let seen = false;
  const t0 = Date.now();
  for (let i = 0; i < 40 && !seen; i++) { seen = await h.q('!!document.querySelector("#splash")').catch(() => false); if (!seen) await sleep(50); }
  check('F20: mở app thấy màn mở app #splash có logo', seen && (await h.q('!!document.querySelector("#splash svg") && !!document.querySelector("#splash .splash-word")').catch(() => false)));
  if (seen) await shot('Màn mở app (logo động)');
  let goneAt = 0;
  for (let i = 0; i < 40; i++) { if (!(await h.q('!!document.querySelector("#splash")').catch(() => true))) { goneAt = Date.now() - t0; break; } await sleep(100); }
  check('F20: màn mở app tự ẩn sau ≤ 1,5 giây (tính cả lúc tải trang)', goneAt > 0 && goneAt <= 2200, `${goneAt} ms`);
  check('F20: màn mở app không có nút', (await h.q('document.querySelectorAll("#splash button").length').catch(() => 0)) === 0);
  await h.q('location.reload()');
  for (let i = 0; i < 40; i++) { if (await h.q('!!document.querySelector("#splash")').catch(() => false)) break; await sleep(50); }
  const t1 = Date.now();
  await click('#splash');
  let tapGone = 0;
  for (let i = 0; i < 20; i++) { if (!(await h.q('!!document.querySelector("#splash")').catch(() => true))) { tapGone = Date.now() - t1; break; } await sleep(50); }
  check('F20: chạm vào màn mở app thì ẩn ngay', tapGone > 0 && tapGone < 600, `${tapGone} ms`);
  await h.noSplash();
}

// ---------------------------------------------------------------- Phase 5 · phản hồi người dùng (lần 2)
async function phase5(t, h) {
  const { click, type, shot, check, sleep } = t;
  const pickCategory = () => h.q(`(() => { const el = document.querySelector('#category'); if (!el) return false;
    const o = [...el.options].find((x) => x.value === 'Sở thích & Sưu tầm') ?? [...el.options].find((x) => x.value);
    el.value = o.value; el.dispatchEvent(new Event('change', { bubbles: true })); return o.value; })()`);
  const fill = async (name, price) => {
    if (name) await type('#product-name-edit', name);
    await pickCategory();
    await sleep(120);
    await h.typeMoney('#cost', 8000);
    if (price) await h.typeMoney('#price', price);
  };
  const cardProfit = (name) => h.q(`[...document.querySelectorAll('.product-card')].find((c) => c.querySelector('strong').textContent.trim().startsWith(${JSON.stringify(name)}))?.querySelector('.amt')?.textContent.trim() ?? null`);

  // F21 — Thêm sản phẩm ngay trong danh mục
  await h.tab('tinh');
  const quick = await h.value('#price');
  await h.tab('san-pham');
  check('F21: danh mục có nút "Thêm sản phẩm"', (await h.has('#add-product')) && /Thêm sản phẩm/.test(await h.text('#add-product')));
  const before = await h.q('window.__app.state().products.length');
  await click('#add-product');
  await sleep(300);
  check('F21: mở #/san-pham/moi, tiêu đề "Sản phẩm mới", tab Sản phẩm sáng',
    (await h.route()) === '#/san-pham/moi' && (await h.text('#screen-title')) === 'Sản phẩm mới' && (await h.attr('#tab-san-pham', 'aria-current')) === 'page');
  check('F21: tên, giá bán, giá vốn trống (không chép từ Tính nhanh)',
    (await h.value('#product-name-edit')) === '' && !(await h.value('#price')) && !(await h.value('#cost')));
  check('F21: chưa có tên + giá thì không bấm được "Thêm vào danh mục"', await h.disabled('#product-create'));
  await fill('Kẹp tóc ngọc trai', 17000);
  await sleep(150);
  const profit = (await h.text('#profit')) ?? '';
  check('F21: nhập giá → kết quả lãi hiện ngay', /đ/.test(profit), profit);
  check('F21: đủ tên + giá → bấm được "Thêm vào danh mục"', !(await h.disabled('#product-create')));
  await shot('Sản phẩm mới (thêm từ danh mục)');
  if (await h.has('#key-done')) { await click('#key-done'); await sleep(120); }
  await click('#product-create');
  await sleep(350);
  const row = await cardProfit('Kẹp tóc ngọc trai');
  check('F21: bấm Thêm → về danh mục, có sản phẩm mới, lãi đúng như màn nhập',
    (await h.route()) === '#/san-pham' && (await h.q('window.__app.state().products.length')) === before + 1 && row === profit, `${row} vs ${profit}`);
  await shot('Danh mục sau khi thêm');

  // rời khi chưa đủ → chỉ Bỏ
  await click('#add-product');
  await sleep(300);
  await type('#product-name-edit', 'Nháp dở');
  await sleep(100);
  await h.back();
  check('F21: rời khi đã nhập → hỏi; chưa đủ giá thì "Thêm" bị khoá', (await h.has('#leave-discard')) && (await h.disabled('#leave-save')));
  await click('#leave-discard');
  await sleep(300);
  check('F21: "Bỏ" → về danh mục, không thêm gì', (await h.route()) === '#/san-pham' && (await h.q('window.__app.state().products.length')) === before + 1);

  // rời khi đủ → "Thêm" lưu luôn
  await click('#add-product');
  await sleep(300);
  check('F21: mở lại Sản phẩm mới là bản trống', (await h.value('#product-name-edit')) === '');
  await fill('Ốp lưng trong', 25000);
  await sleep(120);
  await h.back();
  check('F21: rời khi đủ tên + giá → "Thêm" bấm được', (await h.has('#leave-save')) && !(await h.disabled('#leave-save')));
  await click('#leave-save');
  await sleep(350);
  check('F21: "Thêm" khi rời → sản phẩm vào danh mục', (await h.route()) === '#/san-pham' && (await cardProfit('Ốp lưng trong')) !== null);
  await h.tab('tinh');
  check('F21: Tính nhanh giữ nguyên số cũ', (await h.value('#price')) === quick, `${await h.value('#price')} vs ${quick}`);

  // F20 — tách kiểu chất lỏng: lớp goo + lớp sắc nét
  await h.q('location.reload()');
  let seen = false;
  for (let i = 0; i < 40 && !seen; i++) { seen = await h.q('!!document.querySelector("#splash .splash-goo")').catch(() => false); if (!seen) await sleep(40); }
  check('F20: màn mở app có lớp chất lỏng (lọc #splash-goo) giữ tới cuối, không đổi sang lớp góc nhọn', seen && (await h.q('!!document.querySelector("#splash-goo feGaussianBlur") && !document.querySelector("#splash .splash-crisp")').catch(() => false)));
  await h.noSplash();
}

// ---------------------------------------------------------------- Phase 6 · lãi theo từng sàn (phản hồi lần 3)
async function phase6(t, h) {
  const { click, type, shot, check, sleep } = t;
  const cardSel = (name) => `[...document.querySelectorAll('.product-card')].find((c) => c.querySelector('strong').textContent.trim().startsWith(${JSON.stringify(name)}))`;
  const rowText = (name, p) => h.q(`${cardSel(name)}?.querySelector('.channel-row[data-platform="${p}"]')?.textContent.replace(/\s+/g, ' ').trim() ?? null`);

  // F22 — Cài đặt: sàn bạn bán
  await h.tab('cai-dat');
  check('F22: Cài đặt có "Sàn bạn bán", mặc định theo onboarding (chỉ Shopee)',
    (await h.has('#sell-card')) && (await h.attr('#sell-shopee', 'aria-pressed')) === 'true' && (await h.attr('#sell-tiktok_shop', 'aria-pressed')) === 'false');
  await h.tab('san-pham');
  check('F22: bán 1 sàn → thẻ sản phẩm như cũ (không có dòng từng sàn)', (await h.count('.channel-row')) === 0);
  await h.tab('cai-dat');
  await click('#sell-tiktok_shop');
  await sleep(150);
  await click('#sell-lazada');
  await sleep(150);
  check('F22: bật TikTok Shop + Lazada', (await h.attr('#sell-tiktok_shop', 'aria-pressed')) === 'true' && (await h.attr('#sell-lazada', 'aria-pressed')) === 'true');
  await shot('Cài đặt — Sàn bạn bán');

  // Danh mục: mỗi thẻ có 1 dòng / sàn
  await h.tab('san-pham');
  const rowsOk = await h.q(`[...document.querySelectorAll('.product-card')].every((c) => ['shopee', 'tiktok_shop', 'lazada'].every((p) => c.querySelector('.channel-row[data-platform="' + p + '"]')))`);
  check('F22: mỗi thẻ sản phẩm có dòng Shopee, TikTok Shop, Lazada', rowsOk && (await h.count('.product-card')) > 0);
  const mkShopee = await rowText('Móc khóa', 'shopee');
  const mkTiktok = await rowText('Móc khóa', 'tiktok_shop');
  check('F22: Móc khóa: Shopee 505đ Lãi mỏng; TikTok có lãi + chữ trạng thái', /505đ/.test(mkShopee) && /Lãi mỏng/.test(mkShopee) && /đ/.test(mkTiktok) && /(Lãi|Lỗ)/.test(mkTiktok), `${mkShopee} | ${mkTiktok}`);
  const lz = await rowText('Móc khóa', 'lazada');
  check('F22: Lazada chưa có % → "cần % phí" (hoặc có lãi nếu đã nhập % ở So sánh)', /cần % phí|đ/.test(lz ?? ''), lz);
  const lossPill = Number(((await h.text('#filter-loss')) ?? '').match(/\d+$/)?.[0] ?? -1);
  const lossCards = await h.q(`[...document.querySelectorAll('.product-card')].filter((c) => c.querySelector('.channel-row .amt.state-loss')).length`);
  check('F22: "Đang lỗ" đếm theo sàn tệ nhất (lỗ ở 1 sàn là tính)', lossPill === lossCards, `${lossPill} vs ${lossCards}`);
  await shot('Danh mục — lãi trên từng sàn');

  // Màn sản phẩm: thẻ lãi theo sàn + sửa giá riêng trên TikTok
  await h.q(`${cardSel('Móc khóa')}?.scrollIntoView({ block: 'center' })`);
  const id = await h.q(`${cardSel('Móc khóa')}?.dataset.id`);
  await click(`.product-card[data-id="${id}"]`);
  await sleep(300);
  check('F22: màn sản phẩm có thẻ "Lãi trên các sàn bạn bán" với 3 sàn', (await h.has('#channels')) && (await h.count('#channels .channel-item')) === 3);
  await h.q(`document.querySelector('#channels').scrollIntoView({ block: 'center' })`);
  await click('.channel-item[data-platform="tiktok_shop"]');
  await sleep(200);
  check('F22: chạm TikTok Shop → sheet sửa ngành, % phí, giá', (await h.has('#channel-sheet')) && (await h.has('#ch-category')) && (await h.has('#ch-rate')) && (await h.has('#ch-price')));
  await shot('Sửa ngành / giá trên TikTok Shop');
  await type('#ch-price', '25000');
  await click('#ch-save');
  await sleep(250);
  const tkItem = await h.q(`document.querySelector('.channel-item[data-platform="tiktok_shop"]')?.textContent.replace(/\s+/g, ' ').trim()`);
  check('F22: giá riêng TikTok hiện trong thẻ, nút "Lưu thay đổi" bật', /bán 25\.000đ/.test(tkItem) && !(await h.disabled('#product-save')), tkItem);
  const tkProfit = await h.q(`document.querySelector('.channel-item[data-platform="tiktok_shop"] .amt')?.textContent.trim()`);
  await shot('Màn sản phẩm — lãi trên các sàn');
  if (await h.has('#key-done')) { await click('#key-done'); await sleep(120); }
  await h.q(`document.querySelector('#product-save').scrollIntoView({ block: 'center' })`);
  await click('#product-save');
  await sleep(250);
  await h.back();
  await sleep(200);
  const after = await rowText('Móc khóa', 'tiktok_shop');
  check('F22: lưu xong, danh mục hiện lãi TikTok theo giá mới, Shopee giữ 505đ', (await h.route()) === '#/san-pham' && after?.includes(tkProfit) && /505đ/.test(await rowText('Móc khóa', 'shopee')), `${after} | ${tkProfit}`);
}

// ---------------------------------------------------------------- Phase 7 · áp giá gợi ý theo từng sàn (trả lời PO)
async function phase7(t, h) {
  const { click, shot, check, sleep } = t;
  const kep = () => h.q(`(() => { const p = window.__app.state().products.find((x) => x.name === 'Kẹp tóc'); return p ? { id: p.id, price: p.input.price, tk: p.channels?.tiktok_shop?.price ?? null } : null; })()`);
  await h.tab('san-pham');
  await click('#bulk-mode');
  await sleep(250);
  const pressed = async (p) => (await h.attr(`#apply-on-${p}`, 'aria-pressed')) === 'true';
  check('F23: bán 3 sàn → có hàng "Áp cho sàn", mặc định chọn hết', (await h.has('#apply-on')) && (await pressed('shopee')) && (await pressed('tiktok_shop')) && (await pressed('lazada')));
  const k0 = await kep();
  const card = `.product-card[data-id="${k0.id}"]`;
  check('F23: Kẹp tóc (lỗ ở Shopee + TikTok) được chọn sẵn, có giá gợi ý từng sàn',
    (await h.q(`!!document.querySelector('${card} .bulk-check')?.checked`)) && (await h.count(`${card} .channel-row .suggested`)) >= 2);
  check('F23: thẻ hiện giá hiện tại → giá gợi ý, không có chữ "undefined"', !/undefined|NaN/.test((await h.text('#product-list')) ?? '') && /12.000đ/.test((await h.text(`${card} .channel-row[data-platform="shopee"]`)) ?? ''), await h.text(`${card} .channel-row[data-platform="shopee"]`));
  await shot('Áp giá gợi ý — chọn sàn');
  await click('#apply-on-shopee');
  await sleep(150);
  await click('#apply-on-lazada');
  await sleep(150);
  check('F23: bỏ chọn Shopee, Lazada → chỉ còn dòng TikTok trên thẻ', !(await pressed('shopee')) && (await pressed('tiktok_shop')) && (await h.q(`[...document.querySelectorAll('${card} .channel-row')].map((r) => r.dataset.platform).join(',')`)) === 'tiktok_shop');
  await click('#apply-on-tiktok_shop');
  await sleep(150);
  check('F23: không bỏ được sàn cuối cùng', await pressed('tiktok_shop'));
  const sugText = await h.text(`${card} .channel-row[data-platform="tiktok_shop"] .suggested`);
  const sug = Number((sugText ?? '').replace(/\D/g, ''));
  await shot('Áp giá gợi ý — chỉ TikTok Shop');
  await click('#apply-suggested');
  await sleep(350);
  const k1 = await kep();
  check('F23: áp chỉ TikTok → giá TikTok đổi sang gợi ý, giá Shopee giữ nguyên', k1.price === k0.price && k1.tk === sug && sug > k0.price, `${JSON.stringify(k1)} sug ${sug}`);
  check('F23: toast ghi tên sàn đã áp', /TikTok Shop/.test((await h.text('#toast')) ?? ''), await h.text('#toast'));
  check('F23: hoàn tác được', await h.has('#undo-apply'));
  await click('#undo-apply');
  await sleep(250);
  const k2 = await kep();
  check('F23: hoàn tác → giá TikTok về như cũ', k2.tk === k0.tk && k2.price === k0.price, JSON.stringify(k2));
}

// ---------------------------------------------------------------- Phase 8 · ngày 3: Pro, quảng cáo, phát hành
async function phase8(t, h) {
  const { click, type, shot, check, sleep } = t;
  const ev = async (name) => (await h.events()).filter((e) => e.name === name);
  const pw = async () => ((await h.has('#paywall')) ? (await h.text('#paywall')) : '');
  // Bật cấu hình phát hành (khoá Pro + quảng cáo), quảng cáo thử ngắn để bot đỡ chờ. Tải lại = phiên mới.
  await h.q('window.__app.setConfig({ pro_gates_enabled: true, ads_enabled: true, rewarded_seconds: 1, interstitial_close_seconds: 1 })');
  await h.q('location.reload()');
  await sleep(500);
  await h.noSplash();

  // F25 — đồng ý quảng cáo, banner đúng chỗ
  await h.tab('san-pham');
  check('F25: lần đầu sắp có quảng cáo → thẻ hỏi đồng ý, chưa có banner', (await h.has('#ad-consent')) && !(await h.has('.ad-banner')));
  await shot('Hỏi đồng ý quảng cáo');
  await click('#consent-no');
  await sleep(200);
  check('F25: chọn → banner Danh mục hiện, lưu lựa chọn', (await h.has('.ad-banner[data-placement="catalog"]')) && (await h.q('window.__app.state().adConsent')) === 'npa');
  await h.tab('cai-dat');
  check('F25: Cài đặt › Biểu phí có banner + ad_impression banner', (await h.has('.ad-banner[data-placement="fees"]'))
    && (await ev('ad_impression')).some((e) => e.params.format === 'banner' && e.params.placement === 'fees'));
  check('F26: Cài đặt có link Chính sách quyền riêng tư', (await h.attr('#privacy-link', 'href')) === 'privacy.html');
  await h.tab('tinh');
  check('F25: màn Tính lãi không có quảng cáo', !(await h.has('.ad-banner')) && !(await h.has('#ad-consent')));

  // F25 — interstitial: 3 lần tính → chuyển màn
  for (const p of ['18000', '19000', '20000']) { await type('#price', p); await sleep(2100); }
  const calcs = (await ev('calc_completed')).length;
  await h.tab('so-sanh');
  await sleep(200);
  check('F25: sau 3 lần tính, chuyển màn → interstitial', await h.has('#interstitial'), `calc_completed=${calcs}`);
  await shot('Interstitial (quảng cáo thử)');
  await sleep(1300);
  await click('#interstitial-close');
  await sleep(200);
  check('F25: đóng được interstitial', !(await h.has('#interstitial')));
  await h.tab('san-pham');
  check('F25: chưa đủ 3 phút → không hiện lại', !(await h.has('#interstitial')));
  await h.tab('tinh');
  await type('#price', '17000');
  await sleep(300);

  // F24 — điểm 1: lưu sản phẩm thứ 6
  check('F24: danh mục > 5 sản phẩm, gói miễn phí', (await h.q('window.__app.state().products.length')) > 5);
  if (await h.has('#key-done')) { await click('#key-done'); await sleep(120); }
  await click('#save-product');
  await sleep(150);
  await type('#product-name', 'Móc khóa thứ 6');
  await click('#save-confirm');
  await sleep(250);
  const p1 = await pw();
  check('F24: lưu sản phẩm thứ 6 → paywall catalog_limit', /Lưu hơn 5 sản phẩm/.test(p1) && (await ev('paywall_view')).some((e) => e.params.trigger === 'catalog_limit'));
  check('F24: paywall ghi giá, chu kỳ, dùng thử, tự gia hạn, cách huỷ, khôi phục',
    /49\.000đ\/tháng/.test(p1) && /299\.000đ\/năm/.test(p1) && /3 ngày/.test(p1) && /tự gia hạn/i.test(p1) && /Google Play/.test(p1) && /huỷ/i.test(p1)
    && (await h.has('#restore')) && /Khôi phục giao dịch/.test(await h.text('#restore')));
  check('F24: chế độ thử ghi rõ không trừ tiền', /không trừ tiền/.test(p1));
  await shot('Paywall — lưu sản phẩm thứ 6');
  await click('#paywall-close');
  await sleep(150);

  // F24/F25 — điểm 3: Flash Sale khoá → Pro / quảng cáo thưởng
  await click('#mode-margin');
  await sleep(250);
  check('F24: Flash Sale khoá có "Dùng Pro" + "Xem quảng cáo để mở"', (await h.has('#flash-pro')) && (await h.has('#watch-ad')) && !(await h.has('#max-cost')));
  await h.q("document.querySelector('#flash-sale').scrollIntoView({ block: 'center' })");
  await click('#flash-pro');
  await sleep(200);
  check('F24: "Dùng Pro" → paywall flash_sale', /Flash Sale/.test(await pw()) && (await ev('paywall_view')).some((e) => e.params.trigger === 'flash_sale'));
  await click('#paywall-close');
  await sleep(150);
  await h.q("document.querySelector('#flash-sale').scrollIntoView({ block: 'center' })");
  await click('#watch-ad');
  await sleep(200);
  check('F25: quảng cáo thưởng hiện', await h.has('#rewarded'));
  await sleep(1500);
  await click('#rewarded-close');
  await sleep(250);
  check('F25: xem hết → mở Flash Sale + giá nhập tối đa trong phiên', (await h.has('#max-cost'))
    && (await ev('rewarded_ad_complete')).some((e) => e.params.reward === 'flash_sale')
    && (await ev('flash_sale_viewed')).some((e) => e.params.unlock_method === 'rewarded'));
  await click('#mode-price');
  await sleep(200);

  // F24 — điểm 2: báo động đổi phí, miễn phí chỉ thấy số lượng
  await h.q(`(async () => { const p = await (await fetch('assets/fee_presets.json', { cache: 'no-store' })).json();
    p.fee_version = '2026-11-15.1'; p.platforms.shopee.transaction_fee.rate = 0.09; return window.__app.receivePresets(p); })()`);
  await sleep(300);
  await h.tab('san-pham');
  check('F24: báo động miễn phí chỉ ghi số lượng + "Pro"', (await h.has('#fee-alert-action')) && /chuyển lỗ · Pro/.test(await h.text('#fee-alert-action')));
  await click('#fee-alert-action');
  await sleep(200);
  check('F24: xem chi tiết báo động → paywall fee_alert', /chuyển sang lỗ/.test(await pw()) && (await ev('paywall_view')).some((e) => e.params.trigger === 'fee_alert'));
  await click('#paywall-close');
  await sleep(150);

  // F24 — điểm 4: Cài đặt → mua thử gói tháng (dùng thử 3 ngày)
  await h.tab('cai-dat');
  await click('#pro-open');
  await sleep(200);
  check('F24: Cài đặt → paywall settings, mặc định gói tháng', (await ev('paywall_view')).some((e) => e.params.trigger === 'settings') && (await h.attr('#plan-monthly', 'aria-checked')) === 'true');
  const trig = new Set((await ev('paywall_view')).map((e) => e.params.trigger));
  check('F24: đủ 4 điểm kích hoạt', ['catalog_limit', 'fee_alert', 'flash_sale', 'settings'].every((x) => trig.has(x)), [...trig].join(','));
  await click('#buy');
  await sleep(400);
  check('F24: gói tháng → dùng thử, Pro mở ngay, trial_started', (await h.q('window.__app.state().sub?.status')) === 'trial'
    && (await ev('trial_started')).some((e) => e.params.plan === 'monthly') && /Đang dùng thử/.test(await h.text('#pro-status')));
  check('F24/F25: Pro → hết quảng cáo', !(await h.has('.ad-banner')) && !(await h.has('#ad-consent')));
  await shot('Cài đặt — đang dùng thử Pro');
  await h.tab('san-pham');
  check('F24: Pro → báo động chỉ rõ sản phẩm, danh mục không giới hạn', /Xem giá đề xuất/.test((await h.text('#fee-alert-action')) ?? '') && /Pro/.test(await h.text('#catalog-count')));

  // F24 — nhắc trước 1 ngày, hết dùng thử thành thuê bao
  await h.q('window.__app.advanceClock(2 * 86400000 + 3600000)');
  await h.tab('cai-dat');
  const inbox = await h.text('#notif-inbox');
  check('F24: còn < 1 ngày → nhắc "Ngày mai hết dùng thử" + giá + cách huỷ', /Ngày mai hết dùng thử/.test(inbox) && /49\.000đ/.test(inbox) && /Google Play/.test(inbox));
  await h.q('window.__app.advanceClock(3600000)');
  check('F24: chỉ nhắc 1 lần', (await h.q("window.__app.state().notifications.filter((n) => n.kind === 'trial').length")) === 1);
  await h.q('window.__app.advanceClock(86400000)');
  check('F24: hết dùng thử → thuê bao, purchase {monthly, 49000, settings}', (await h.q('window.__app.state().sub.status')) === 'active'
    && (await ev('purchase')).some((e) => e.params.plan === 'monthly' && e.params.price === 49000 && e.params.trigger === 'settings'));

  // F24 — khôi phục giao dịch
  await h.q('window.__app.clearSub()');
  await h.tab('cai-dat');
  await click('#pro-open');
  await sleep(200);
  await click('#restore');
  await sleep(300);
  check('F24: Khôi phục giao dịch → Pro trở lại', (await h.q('window.__app.state().sub?.plan')) === 'monthly' && (await h.has('#pro-status')));
  await h.tab('san-pham');
  await shot('Danh mục — Pro');
}
