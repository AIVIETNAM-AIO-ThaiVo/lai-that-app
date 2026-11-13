// Kịch bản bot tự dùng Hóa Đơn Trọ như người thật (2-environment/bot.mjs gọi hàm play).
// Mỗi check(...) ứng với một dòng "Done when" trong 1-wiki/features/F*.md.
//   evaluate(js) · click(selector) chạm như ngón tay · type(selector, chữ) gõ như bàn phím · shot(nhãn) · check(tên, đúng?, chi tiết) · sleep(ms)
import { crc16 } from './vietqr.js';

export async function play({ evaluate, click, type, shot, check, sleep }) {
  const q = (js) => evaluate(js);
  const S = (s) => JSON.stringify(s);
  const text = (s) => q(`document.querySelector(${S(s)})?.textContent.replace(/\\s+/g, ' ').trim() ?? null`);
  const has = (s) => q(`!!document.querySelector(${S(s)})`);
  const count = (s) => q(`document.querySelectorAll(${S(s)}).length`);
  const attr = (s, a) => q(`document.querySelector(${S(s)})?.getAttribute(${S(a)}) ?? null`);
  const disabled = (s) => q(`!!document.querySelector(${S(s)})?.disabled`);
  const route = () => q('location.hash');
  const events = () => q('window.__app.events()');
  const bodyText = () => q('document.body.innerText');
  const until = async (fn, ms = 4000) => { for (let t = 0; t < ms; t += 100) { if (await fn()) return true; await sleep(100); } return false; };
  const select = (s, v) => q(`(() => { const el = document.querySelector(${S(s)}); el.value = ${S(v)}; el.dispatchEvent(new Event('change', { bubbles: true })); })()`);
  const back = async () => { await click('.topbar [aria-label="Quay lại"]'); await sleep(250); };
  const noAccusation = async (where) => check(`F5: không có chữ "lừa" (${where})`, !/lừa/i.test(await bodyText()));

  // ---------------------------------------------------------------- F2 · chọn vai
  check('F2: mở lần đầu thấy vai người thuê và chủ trọ', (await has('#role-tenant')) && (await has('#role-landlord')));
  check('F2: chưa chọn vai thì "Tiếp tục" bị vô hiệu', await disabled('#onboard-continue'));
  check('F2: ô đồng ý thống kê mặc định không tích', await q(`document.querySelector('#consent-analytics').checked === false`));
  check('F2: màn chọn vai có dòng "không phải ứng dụng của EVN"', /không phải ứng dụng của EVN/.test(await bodyText()));
  await click('#role-tenant');
  check('F2: chạm người thuê → aria-pressed true, chủ trọ false',
    (await attr('#role-tenant', 'aria-pressed')) === 'true' && (await attr('#role-landlord', 'aria-pressed')) === 'false');
  await click('#consent-analytics');
  await shot('Chọn vai: người thuê');
  await click('#onboard-continue');
  await sleep(300);
  check('F2: người thuê → màn nhập #/nhap', (await route()) === '#/nhap');
  check('F2: event onboarding_completed {role: tenant} sau khi đồng ý', (await events()).some((e) => e.name === 'onboarding_completed' && e.params.role === 'tenant'));
  await q(`location.hash = ''; location.reload()`);
  await sleep(1200);
  await until(() => has('#new-reading'));
  check('F2: tải lại trang vẫn nhớ vai, vào thẳng màn nhập', (await route()) === '#/nhap');

  // ---------------------------------------------------------------- F3 · nhập chỉ số
  await select('#period', '2026-11');
  await sleep(200);
  check('F3: chưa nhập chỉ số thì "Tính tiền" bị vô hiệu', await disabled('#calc'));
  await type('#new-reading', '4521');
  await type('#old-reading', '4221');
  check('F3: 4221 → 4521 hiện "= 300 kWh"', (await text('#kwh-preview')) === '= 300 kWh', await text('#kwh-preview'));
  await type('#new-reading', '120');
  check('F3: chỉ số mới nhỏ hơn cũ → báo lỗi ngay dưới ô', await has('#new-reading-error'));
  check('F3: đang lỗi thì "Tính tiền" bị vô hiệu', await disabled('#calc'));
  await shot('Lỗi nhập: chỉ số mới nhỏ hơn tháng trước');
  await click('#meter-replaced');
  check('F3: tích "Công tơ vừa được thay" → hết lỗi, kWh = chỉ số mới',
    !(await has('#new-reading-error')) && (await text('#kwh-preview')) === '= 120 kWh' && !(await disabled('#calc')), await text('#kwh-preview'));
  await click('#meter-replaced');
  await type('#new-reading', '4521');
  check('F3: sửa lại 4521 → "= 300 kWh"', (await text('#kwh-preview')) === '= 300 kWh');
  await click('#input-kwh');
  check('F3: chạm "Số kWh" → có ô nhập thẳng #kwh-direct', await has('#kwh-direct'));
  await type('#kwh-direct', '300');
  check('F3: nhập thẳng 300 kWh thì "Tính tiền" bấm được', !(await disabled('#calc')));
  await click('#input-meter');
  check('F3: quay lại chỉ số công tơ vẫn giữ số đã nhập', (await text('#kwh-preview')) === '= 300 kWh');
  await click('#people-plus');
  const p4 = await text('#people-count');
  for (let i = 0; i < 4; i++) await click('#people-minus');
  const p1 = await text('#people-count');
  await click('#people-plus');
  await click('#people-plus');
  check('F3: nút +/− đổi số người, không xuống dưới 1', p4 === '4 người' && p1 === '1 người' && (await text('#people-count')) === '3 người', `${p4} · ${p1}`);
  await click('#declared-no');
  const noPressed = (await attr('#declared-no', 'aria-pressed')) === 'true' && (await attr('#declared-yes', 'aria-pressed')) === 'false';
  await click('#declared-yes');
  check('F3: chip khai báo có aria-pressed đúng lựa chọn', noPressed && (await attr('#declared-yes', 'aria-pressed')) === 'true');
  await type('#landlord-value', '4000');
  await shot('Nhập: 4221 → 4521, 3 người có khai báo, chủ trọ thu 4.000đ/kWh');

  // ---------------------------------------------------------------- F4 + F5 · kết quả, so sánh
  await click('#calc');
  await sleep(350);
  check('F4: tính xong mở màn kết quả', (await route()) === '#/ket-qua');
  check('F4: tổng tiền "808.218đ"', (await text('#total')) === '808.218đ', await text('#total'));
  check('F4: cỡ chữ tổng tiền ≥ 40px', await q(`parseFloat(getComputedStyle(document.querySelector('#total')).fontSize) >= 40`));
  const segs = await q(`[...document.querySelectorAll('#tier-bar .tier-seg')].map((s) => ({ t: s.textContent.trim(), w: s.getBoundingClientRect().width }))`);
  check('F4: thanh bậc giá có 3 đoạn B1, B2, B3', segs.map((s) => s.t).join(',') === 'B1,B2,B3');
  const ratio = segs.length === 3 ? [segs[0].w / segs[2].w, segs[1].w / segs[2].w] : [0, 0];
  check('F4: độ rộng các đoạn theo tỉ lệ 75 : 75 : 150', Math.abs(ratio[0] - 0.5) < 0.05 && Math.abs(ratio[1] - 0.5) < 0.05, ratio.map((r) => r.toFixed(2)).join(' : '));
  check('F4: có 3 dòng bậc và dòng VAT 59.868đ', (await count('.tier-line')) === 3 && /59\.868đ/.test(await text('#vat-line')));
  check('F4: không có quảng cáo trên màn kết quả', !(await has('#ad-banner')) && !(await has('#interstitial')));
  const calcEv = (await events()).filter((e) => e.name === 'bill_calculated').at(-1);
  check('F4: event bill_calculated {mode, kwh_bucket, people_count}, không có số tiền',
    !!calcEv && JSON.stringify(calcEv.params) === JSON.stringify({ mode: 'A', kwh_bucket: '201-400', people_count: 3 }), JSON.stringify(calcEv?.params));
  check('F5: chủ trọ thu 4.000đ/kWh → data-status="over"', (await attr('#compare', 'data-status')) === 'over');
  check('F5: ghi "Cao hơn mức tối đa theo quy định"', /Cao hơn mức tối đa theo quy định/.test(await text('#compare')));
  check('F5: chênh lệch mỗi tháng 391.782đ', (await text('#compare-diff')) === '391.782đ', await text('#compare-diff'));
  check('F5: ước tính năm "4,7 triệu"', /4,7 triệu/.test(await text('#compare-year')), await text('#compare-year'));
  check('F5: event landlord_compare_done {overcharge_bucket: 20-50%}', (await events()).some((e) => e.name === 'landlord_compare_done' && e.params.overcharge_bucket === '20-50%'));
  check('F4: hàng "Căn cứ" cao ≥ 48px', await q(`document.querySelector('#sources-link').getBoundingClientRect().height >= 48`));
  await noAccusation('màn kết quả');
  await shot('Kết quả: 808.218đ — cao hơn quy định 391.782đ');

  // ---------------------------------------------------------------- F12 · nguồn & miễn trừ
  await click('#sources-link');
  await sleep(300);
  check('F4: "Căn cứ" mở màn Nguồn & miễn trừ', (await route()) === '#/nguon');
  const src = await bodyText();
  check('F12: dẫn QĐ 2892/QĐ-BCT, TT 60/2025/TT-BCT, NĐ 133/2026, NQ 204/2025/QH15',
    ['QĐ 2892/QĐ-BCT', 'TT 60/2025/TT-BCT', 'NĐ 133/2026', 'NQ 204/2025/QH15'].every((c) => src.includes(c)));
  check('F12: bảng giá có 5 bậc kèm phiên bản', (await count('#tariff-table tbody tr')) === 5 && (await has('#tariff-version')));
  check('F12: miễn trừ "không phải ứng dụng của EVN hay cơ quan nhà nước" + "mang tính tham khảo"',
    /không phải ứng dụng của EVN hay cơ quan nhà nước/.test(await text('#disclaimer')) && /mang tính tham khảo/.test(await text('#disclaimer')));
  check('F12: ghi chú giá không khai báo 2.289đ / 2.894đ', /2\.289đ/.test(src) && /2\.894đ/.test(src));
  check('F12: quyền riêng tư "chỉ lưu trên máy" và có nút xoá dữ liệu', /chỉ lưu trên máy/.test(await text('#privacy')) && (await has('#wipe-data')));
  await shot('Nguồn & miễn trừ');
  await back();
  check('F12: quay lại về đúng màn kết quả', (await route()) === '#/ket-qua');

  // ---------------------------------------------------------------- F5 · tổng tiền, đúng quy định, không nhập
  await back();
  await click('#landlord-unit-total');
  await type('#landlord-value', '1200000');
  await click('#calc');
  await sleep(300);
  check('F5: nhập tổng 1.200.000đ cũng ra chênh lệch 391.782đ', (await text('#compare-diff')) === '391.782đ', await text('#compare-diff'));
  await back();
  await click('#landlord-unit-kwh');
  await type('#landlord-value', '2600');
  await click('#calc');
  await sleep(300);
  check('F5: chủ trọ thu 2.600đ/kWh → "Đúng quy định" kèm biểu tượng tích',
    (await attr('#compare', 'data-status')) === 'ok' && /Đúng quy định/.test(await text('#compare')) && (await has('#compare svg')));
  await shot('So sánh: chủ trọ thu đúng quy định');
  await back();
  await type('#landlord-value', '');
  await click('#calc');
  await sleep(300);
  check('F5: không nhập số chủ trọ thu thì không có khối so sánh', !(await has('#compare')));

  // ---------------------------------------------------------------- F4 · không khai báo
  await back();
  await click('#declared-no');
  await click('#calc');
  await sleep(300);
  check('F4: không khai báo → tổng 741.636đ', (await text('#total')) === '741.636đ', await text('#total'));
  check('F4: không khai báo → một dòng "300 kWh × 2.289đ" và ghi nguồn giá',
    (await count('.tier-line')) === 1 && /300 kWh × 2\.289đ/.test(await text('.tier-line')) && /TT 60\/2025/.test(await bodyText()));
  await shot('Kết quả khi chưa khai báo: 741.636đ');
  await back();
  await click('#declared-yes');
  await type('#landlord-value', '4000');
  await click('#calc');
  await sleep(300);

  // ---------------------------------------------------------------- F6 · chia tiền
  await click('#to-split');
  await sleep(300);
  check('F6: mở màn chia tiền có 3 người', (await route()) === '#/chia' && (await count('.person')) === 3);
  await click('#split-days');
  check('F6: chip "Theo số ngày ở" có aria-pressed', (await attr('#split-days', 'aria-pressed')) === 'true' && (await attr('#split-equal', 'aria-pressed')) === 'false');
  const names = ['Linh', 'Minh', 'Tú'];
  for (let i = 0; i < 3; i++) await type(`#people-list .person:nth-child(${i + 1}) .person-name`, names[i]);
  await type('#people-list .person:nth-child(3) .person-days', '20');
  const amounts = await q(`[...document.querySelectorAll('.person-amount')].map((e) => e.textContent.trim())`);
  check('F6: ngày ở 30/30/20 → 303.082đ · 303.082đ · 202.054đ', amounts.join(' · ') === '303.082đ · 303.082đ · 202.054đ', amounts.join(' · '));
  check('F6: cộng lại khớp tổng 808.218đ', (await text('#split-sum')) === '808.218đ');
  await shot('Chia theo ngày ở: Linh, Minh, Tú');
  await click('#add-extra');
  await type('#extras .extra:nth-child(1) .extra-label', 'Wifi');
  await type('#extras .extra:nth-child(1) .extra-amount', '150000');
  const withWifi = await q(`[...document.querySelectorAll('.person-amount')].map((e) => e.textContent.trim())`);
  check('F6: thêm wifi 150.000đ chia cùng cách, tổng = 958.218đ',
    (await text('#split-sum')) === '958.218đ' && withWifi.join(' · ') === '359.332đ · 359.332đ · 239.554đ', `${await text('#split-sum')} | ${withWifi.join(' · ')}`);
  await shot('Chia tiền + khoản wifi');
  await click('#to-invoice');
  await sleep(400);
  const splitEv = (await events()).filter((e) => e.name === 'bill_split').at(-1);
  check('F6: event bill_split {split_type: days, people_count: 3}', JSON.stringify(splitEv?.params) === JSON.stringify({ split_type: 'days', people_count: 3 }));

  // ---------------------------------------------------------------- F7 + F8 · ảnh hóa đơn, VietQR
  check('F8: mở màn ảnh hóa đơn', (await route()) === '#/hoa-don');
  const inv = await text('#invoice');
  check('F8: hóa đơn có phòng, kỳ, chỉ số, kWh, tổng và từng người',
    /Phòng P203 · Tháng 11\/2026/.test(inv) && /Chỉ số 4221 → 4521/.test(inv) && /300 kWh/.test(inv) && /808\.218đ/.test(inv)
    && /Linh · 30 ngày/.test(inv) && /Tú · 20 ngày/.test(inv) && /239\.554đ/.test(inv), inv.slice(0, 160));
  check('F8: chưa nhập ngân hàng thì chưa có mã QR', !(await has('#qr')));
  await select('#payee-bank', '970436');
  await type('#payee-account', '0123456789');
  await type('#payee-name', 'Linh');
  check('F7/F8: có ngân hàng + số tài khoản → có mã #qr "Quét để chuyển cho Linh"', (await has('#qr svg')) && /Quét để chuyển cho Linh/.test(await text('#invoice')));
  const payload = await q('window.__app.qrPayload()');
  check('F7: chuỗi VietQR đúng cấu trúc EMVCo và CRC hợp lệ',
    !!payload && payload.startsWith('000201010211') && payload.includes('0010A000000727') && payload.includes('0006970436') && payload.includes('01100123456789')
    && payload.includes('5802VN') && payload.includes('P203 T11 TIEN DIEN') && payload.slice(-4) === crc16(payload.slice(0, -4)), payload);
  check('F8: gói miễn phí có dòng "Tính bằng Hóa Đơn Trọ"', /Tính bằng Hóa Đơn Trọ/.test(await text('#invoice')));
  const minFont = await q(`Math.min(...[...document.querySelectorAll('#invoice *')].filter((e) => [...e.childNodes].some((n) => n.nodeType === 3 && n.textContent.trim())).map((e) => parseFloat(getComputedStyle(e).fontSize)))`);
  check('F8: mọi chữ trong hóa đơn ≥ 12px', minFont >= 12, `${minFont}px`);
  await shot('Ảnh hóa đơn + VietQR');
  await click('#save-invoice');
  const t1 = await until(() => q(`/Đã lưu ảnh/.test(document.querySelector('#toast')?.textContent ?? '')`));
  check('F11: lần xuất ảnh đầu tiên trong ngày không có quảng cáo xen kẽ', !(await has('#interstitial')));
  check('F8: "Lưu vào máy" tạo ảnh PNG và báo "Đã lưu ảnh"', t1 && (await q('window.__app.lastExport()?.size ?? 0')) > 5000, JSON.stringify(await q('window.__app.lastExport()')));
  const shareEv = (await events()).filter((e) => e.name === 'bill_image_shared').at(-1);
  check('F8: event bill_image_shared {role, has_vietqr, channel}, không có số tài khoản',
    JSON.stringify(shareEv?.params) === JSON.stringify({ role: 'tenant', has_vietqr: true, channel: 'download' }), JSON.stringify(shareEv?.params));
  await shot('Đã lưu ảnh vào máy');
  await q(`document.querySelector('#toast')?.remove()`);
  await click('#share-invoice');
  const ad = await until(() => has('#interstitial'), 3000);
  check('F11: lần xuất ảnh thứ 2 trong ngày có quảng cáo xen kẽ', ad);
  if (ad) { await sleep(350); await shot('Quảng cáo xen kẽ (thử)'); await click('#interstitial-close'); }
  const exportsBefore = 1;
  const t2 = await until(() => q(`/Đã lưu ảnh/.test(document.querySelector('#toast')?.textContent ?? '')`), 6000);
  check('F8: "Gửi cho cả phòng" — máy không chia sẻ được thì lưu ảnh và báo', t2,
    JSON.stringify(await q(`({ toast: document.querySelector('#toast')?.textContent, ad: !!document.querySelector('#interstitial'), stage: window.__app.exportStage(), exp: window.__app.lastExport(), n: window.__app.state().ads.exportsCount, before: ${exportsBefore} })`)));

  // ---------------------------------------------------------------- F9 · lịch sử
  await back(); await back(); await back();
  await click('#nav-history');
  await sleep(300);
  check('F9: có hóa đơn trong lịch sử, mới nhất trước', (await count('.history-item')) >= 1 && /Tháng 11\/2026/.test(await text('.history-item')) && /808\.218đ/.test(await text('.history-item')), await text('.history-item'));
  check('F9: gói miễn phí có banner quảng cáo ở lịch sử', await has('#ad-banner'));
  await shot('Lịch sử hóa đơn');
  await q('location.reload()');
  await sleep(1200);
  await until(() => has('.history-item'), 6000);
  check('F9: lịch sử còn sau khi tải lại trang', (await count('.history-item')) >= 1,
    JSON.stringify(await q(`({ hash: location.hash, saved: (JSON.parse(localStorage.getItem('hdt:v1') || '{}').history || []).length, app: document.querySelector('#app')?.textContent.trim().slice(0, 80) })`)));
  await click('.history-item');
  await sleep(300);
  check('F9: chạm hóa đơn cũ mở lại kết quả', (await route()).startsWith('#/ket-qua') && (await text('#total')) === '808.218đ');

  // ---------------------------------------------------------------- đổi vai → chủ trọ
  await back();
  await click('#nav-menu');
  await click('#menu-switch-role');
  await sleep(250);
  await click('#role-landlord');
  await click('#onboard-continue');
  await sleep(300);

  // ---------------------------------------------------------------- F10 · chủ trọ
  check('F10: chủ trọ lần đầu thấy trạng thái trống + "Thêm phòng đầu tiên"', (await route()) === '#/nha-tro' && (await has('#empty-rooms')) && (await has('#add-first-room')));
  await shot('Chủ trọ: chưa có phòng');
  const rooms = [['P101', 3, '245', '605.669đ'], ['P102', 2, '180', '444.982đ'], ['P103', 1, '96', '237.324đ']];
  for (const [i, [name, people, reading, money]] of rooms.entries()) {
    await click(i === 0 ? '#add-first-room' : '#add-room');
    await sleep(250);
    await type('#room-name-input', name);
    for (let k = 1; k < people; k++) await click('#room-people-plus');
    await type('#room-old', '0');
    await type('#room-new', reading);
    check(`F10: ${name} (${people} người, ${reading} kWh) xem trước ${money}`, (await text('#room-amount')) === money, await text('#room-amount'));
    if (i === 0) await shot('Thêm phòng P101');
    await click('#room-save');
    await sleep(300);
  }
  const cards = await q(`[...document.querySelectorAll('.room-card')].map((c) => c.dataset.room + ' ' + c.querySelector('.money').textContent.trim())`);
  check('F10: 3 phòng chế độ B → 605.669đ · 444.982đ · 237.324đ', cards.join(' | ') === 'P101 605.669đ | P102 444.982đ | P103 237.324đ', cards.join(' | '));
  check('F10: tổng nhà trọ 1.287.975đ', /1\.287\.975đ/.test(await text('.summary')));
  const roomEv = (await events()).filter((e) => e.name === 'room_added').map((e) => e.params.room_count);
  check('F10: event room_added có room_count 1, 2, 3', roomEv.join(',') === '1,2,3', roomEv.join(','));
  await click('[data-room="P101"]');
  await sleep(250);
  await click('#room-mark-paid');
  await sleep(300);
  check('F10: đánh dấu P101 → "Đã thu 1/3 phòng"', (await text('#collected')) === 'Đã thu 1/3 phòng', await text('#collected'));
  check('F10: số đã thu 605.669đ', /605\.669đ/.test(await text('#collected-amount')));
  check('F10: nút gửi ghi "Gửi hóa đơn 2 phòng chưa thu"', (await text('#send-unpaid')) === 'Gửi hóa đơn 2 phòng chưa thu', await text('#send-unpaid'));
  check('F11: gói miễn phí có banner quảng cáo ở danh sách phòng', await has('#ad-banner'));
  await shot('Nhà trọ: 3 phòng, đã thu 1/3');

  // ---------------------------------------------------------------- F10/F11 · giới hạn 3 phòng → paywall
  await click('#add-room');
  await sleep(300);
  check('F10: phòng thứ 4 ở gói miễn phí → mở paywall', (await route()) === '#/pro' && (await has('#paywall')));
  check('F10: không tự thêm phòng thứ 4', (await q('window.__app.state().house.rooms.length')) === 3);
  check('F11: event paywall_viewed {trigger: room_limit}', (await events()).some((e) => e.name === 'paywall_viewed' && e.params.trigger === 'room_limit'));
  const pw = await text('#paywall');
  check('F11: paywall có 399.000đ/năm (tiết kiệm 32%) và 49.000đ/tháng', /399\.000đ/.test(pw) && /49\.000đ/.test(pw) && /Tiết kiệm 32%/.test(pw));
  check('F11: ghi rõ tự gia hạn, cách hủy và có "Khôi phục giao dịch"', /Tự gia hạn/.test(pw) && /hủy/.test(pw) && (await has('#restore')));
  await click('#plan-monthly');
  const monthly = (await attr('#plan-monthly', 'aria-pressed')) === 'true' && (await attr('#plan-yearly', 'aria-pressed')) === 'false';
  await click('#plan-yearly');
  check('F11: gói đang chọn có aria-pressed', monthly && (await attr('#plan-yearly', 'aria-pressed')) === 'true');
  await noAccusation('paywall');
  await shot('Paywall Chủ Trọ Pro');
  await click('#paywall-close');
  await sleep(250);

  // ---------------------------------------------------------------- F10 · gửi hàng loạt
  await click('#send-unpaid');
  await sleep(300);
  check('F10: màn gửi hàng loạt có đúng 2 phòng chưa thu', (await route()) === '#/gui-hang-loat' && (await count('.batch-item')) === 2);
  check('F10: event batch_bills_created {room_count: 2}', (await events()).some((e) => e.name === 'batch_bills_created' && e.params.room_count === 2));
  await shot('Gửi hóa đơn 2 phòng chưa thu');
  await click('.batch-item .batch-share');
  const t3 = await until(() => q(`/Đã lưu ảnh/.test(document.querySelector('#toast')?.textContent ?? '')`));
  check('F11: quảng cáo xen kẽ tối đa 1 lần mỗi 3 phút (lần xuất thứ 3 không có)', t3 && !(await has('#interstitial')));
  await back();

  // ---------------------------------------------------------------- F10 · chế độ C
  await click('#house-settings');
  await sleep(250);
  await click('#mode-c');
  await type('#evn-total', '1000000');
  await shot('Cài đặt nhà trọ: chế độ C');
  await click('#house-save');
  await sleep(300);
  check('F10: chế độ C — tổng các phòng đúng bằng hóa đơn 1.000.000đ', /\/ 1\.000\.000đ/.test(await text('.summary')) && /Chế độ C/.test(await text('#house-mode')), await text('.summary'));
  await click('#house-settings');
  await sleep(250);
  await click('#mode-b');
  await click('#house-save');
  await sleep(300);

  // ---------------------------------------------------------------- F11 · quảng cáo có thưởng, mua Pro
  await click('#add-room');
  await sleep(300);
  await click('#rewarded-room');
  check('F11: xem quảng cáo có thưởng (người dùng tự chọn)', await until(() => has('#interstitial'), 2000));
  await click('#interstitial-close');
  await sleep(300);
  check('F11: xem xong mở thêm 1 phòng tạm → vào màn thêm phòng', (await route()) === '#/phong/moi');
  await type('#room-name-input', 'P104');
  await click('#room-save');
  await sleep(300);
  check('F11: có 4 phòng sau phần thưởng', (await count('.room-card')) === 4);
  await click('#add-room');
  await sleep(300);
  check('F11: phòng thứ 5 lại cần Pro', (await route()) === '#/pro');
  await click('#buy-pro');
  await sleep(400);
  check('F11: mua Pro (bản thử) → thêm được phòng tiếp theo', (await route()) === '#/phong/moi' && (await q('window.__app.state().plan.pro')) === true);
  check('F11: event purchase_completed {plan, period}', (await events()).some((e) => e.name === 'purchase_completed' && e.params.plan === 'landlord_pro' && e.params.period === 'year'));
  await type('#room-name-input', 'P105');
  await click('#room-save');
  await sleep(300);
  check('F11: Pro có 5 phòng và không còn banner quảng cáo', (await count('.room-card')) === 5 && !(await has('#ad-banner')));
  await click('[data-room="P101"]');
  await sleep(250);
  await click('#room-invoice');
  await sleep(300);
  check('F8: gói Pro không còn dòng "Tính bằng Hóa Đơn Trọ"', (await has('#invoice')) && !/Tính bằng Hóa Đơn Trọ/.test(await text('#invoice')));
  check('F7: hóa đơn chủ trọ có VietQR kèm số tiền phòng (54 = 605669)', ((await q('window.__app.qrPayload()')) ?? '').includes('5406605669'));
  await shot('Hóa đơn phòng P101 (Pro, VietQR có số tiền)');

  // ---------------------------------------------------------------- F12 · xoá dữ liệu
  await back();
  await back();
  await click('#nav-menu');
  await click('#menu-sources');
  await sleep(250);
  await click('#wipe-data');
  await click('#wipe-data');
  await sleep(400);
  check('F12: xoá toàn bộ dữ liệu → về màn chọn vai, không còn phòng', (await route()) === '#/chon-vai' && (await q('window.__app.state().house.rooms.length')) === 0 && (await q('window.__app.state().role')) === null);
  await shot('Sau khi xoá dữ liệu');
}
