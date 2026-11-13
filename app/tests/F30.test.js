// F30 — Kiểm tra cả file Báo Cáo Doanh Thu (1-wiki/features/F30-kiem-tra-file.md)
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import presets from '../assets/fee_presets.json' with { type: 'json' };
import { readXlsx, parseIncome, readIncomeFile, fileErrorText } from '../xlsx.js';
import { checkOrder, checkSummary, productCheckArgs, FREE_FILE_DETAILS } from '../addons.js';
import { defaultState, saveProduct, mapSku, runFileCheck, isPro, EVENT_PARAMS } from '../store.js';
import { buildXlsx, incomeWorkbook, REAL_ORDERS, SKU_PRODUCTS } from './xlsx-fixture.mjs';
import { readPlan } from './tracking-plan.mjs';

const APP = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');

function catalog() {
  let s = defaultState();
  for (const [name, p] of Object.entries(SKU_PRODUCTS)) {
    s = saveProduct(s, name, { platform: 'shopee', price: 100000, vat: true, pit: true, ...p }, presets, s.products.length + 1).state;
  }
  return s;
}

test('đọc .xlsx (deflate và stored, sharedStrings, inlineStr, nhiều trang)', async () => {
  for (const deflate of [true, false]) {
    const sheets = await readXlsx(buildXlsx(incomeWorkbook(), { deflate }));
    assert.deepEqual(sheets.map((s) => s.name), ['Summary', 'Income', 'Service Fee Details']);
    assert.equal(sheets[0].rows[0][0], 'Tổng quan');
    assert.equal(sheets[1].rows[3][0], 'Mã đơn hàng');
    assert.equal(sheets[1].rows[4][3], 74692);
  }
});

test('trang Income: tìm cột theo tên, dòng Đơn hàng, SKU từ dòng Sản phẩm, tách PiShip/hiển thị từ Service Fee Details', async () => {
  const r = parseIncome(await readXlsx(buildXlsx(incomeWorkbook())));
  assert.equal(r.error, undefined);
  assert.equal(r.orders.length, 9);
  assert.equal(r.lumped, false);
  const a = r.orders[0];
  assert.deepEqual({ id: a.id, sku: a.sku, price: a.price, fixed: a.fixed_fee, svc: a.service_fee, pi: a.piship, vis: a.visibility, ship: a.ship_buyer, vat: a.vat },
    { id: '2610160A1KEOA', sku: 'Kẹo sữa', price: 74692, fixed: 11951, svc: 7108, pi: 2700, vis: 807, ship: 21500, vat: 747 });
  // không có trang Service Fee Details → so tổng phí dịch vụ (gộp)
  const sheets = incomeWorkbook().slice(0, 2);
  const lumped = parseIncome(await readXlsx(buildXlsx(sheets)));
  assert.equal(lumped.lumped, true);
  const o = lumped.orders[0];
  const p = SKU_PRODUCTS['Kẹo sữa'];
  assert.equal(checkOrder(presets, o, p.categoryRate, p.programs, { lumped: true }).status, 'khop');
});

test('8 đơn thật → 8 Khớp khi gán đúng sản phẩm; đơn thứ 9 Lệch phí cố định (KD7)', async () => {
  let s = catalog();
  const parsed = await readIncomeFile(buildXlsx(incomeWorkbook()));
  for (const o of parsed.orders) s = mapSku(s, o.sku, s.products.find((p) => p.name === o.sku).id);
  assert.equal(s.skuMap['Kẹo sữa'], s.products[0].id);
  const r = runFileCheck(s, presets, parsed, 10, { pro: true });
  const res = r.results;
  assert.deepEqual(res.slice(0, 8).map((x) => x.r.status), Array(8).fill('khop'));
  assert.equal(res[8].r.status, 'lech');
  assert.equal(res[8].r.top_reason, 'category_rate');
  const sum = checkSummary(res);
  assert.deepEqual(sum.count, { khop: 8, lech_nho: 0, lech: 1, dieu_chinh: 0 });
  assert.equal(sum.topReason, 'category_rate');
  assert.equal(sum.totalDiff, 747);
  assert.equal(sum.share[0].key, 'fixed_fee');
  const ev = r.state.events.filter((e) => e.name === 'order_check_completed').at(-1);
  assert.deepEqual(ev.params, { method: 'file', orders_count: 9, mismatch_count: 1, top_reason: 'category_rate' });
  // chỉ lưu kết quả, không lưu nội dung file
  const saved = JSON.stringify(r.state);
  assert.ok(!saved.includes('2610160A1KEOA'), 'không lưu mã đơn');
  assert.equal(r.state.checkHistory.length, 1);
  assert.deepEqual(r.state.checkHistory[0].count, sum.count);
});

test('chưa Pro: tóm tắt + chi tiết 3 đơn đầu', async () => {
  const s = catalog();
  const parsed = await readIncomeFile(buildXlsx(incomeWorkbook()));
  assert.equal(FREE_FILE_DETAILS, 3);
  const r = runFileCheck(s, presets, parsed, 10, { pro: isPro(s, 10) });
  assert.equal(r.results.length, 9, 'tóm tắt đủ 9 đơn');
  assert.equal(r.results.filter((x) => x.locked).length, 6);
});

test('file sai mẫu / không phải xlsx → báo lỗi, không treo (KD8)', async () => {
  const bad = await readIncomeFile(buildXlsx(incomeWorkbook(REAL_ORDERS, { dropColumn: 'Phí cố định' })));
  assert.deepEqual(bad.error, { code: 'missing_column', missing: 'fixed_fee' });
  assert.equal(fileErrorText(bad.error), 'File không đúng mẫu Báo Cáo Doanh Thu');
  const junk = await readIncomeFile(new TextEncoder().encode('đây không phải file excel'));
  assert.equal(junk.error.code, 'not_xlsx');
  const other = await readIncomeFile(buildXlsx([{ name: 'Sheet1', rows: [['Tên', 'Tuổi'], ['A', 1]] }]));
  assert.equal(other.error.code, 'wrong_template');
  assert.ok(EVENT_PARAMS.order_check_file_error);
  assert.deepEqual(EVENT_PARAMS.order_check_file_error, ['error_code', 'missing_column']);
});

test('quyền riêng tư: chính sách ghi tệp báo cáo đọc trên máy; paywall order_check_file trong tracking plan', () => {
  const html = readFileSync(path.join(APP, 'privacy.html'), 'utf8');
  assert.ok(html.includes('Tệp báo cáo bạn chọn được đọc trên thiết bị và không được gửi đi.'));
  const plan = readPlan();
  assert.ok(plan.byName.get('paywall_view').values.includes('order_check_file'));
  assert.ok(plan.byName.has('order_check_file_error'));
});

test('dùng lại cài đặt sản phẩm đã lưu cho từng đơn', () => {
  const s = catalog();
  const a = productCheckArgs(s.products.find((p) => p.name === 'Hạt mèo G'));
  assert.equal(a.vat, false);
  assert.equal(a.catRate, 0.14);
});
