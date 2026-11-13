// F29 — Kiểm tra đơn nhập tay (1-wiki/features/F29-kiem-tra-don.md). Ca KD1–KD6 chung với tools/addons.py.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import presets from '../assets/fee_presets.json' with { type: 'json' };
import V from '../test/addon_vectors.json' with { type: 'json' };
import {
  checkOrder, statusOf, fixAction, complaintTemplate, statusHeadline, realProfit, productCheckArgs, ORDER_FIELDS, STATUS_LABEL,
} from '../addons.js';
import { defaultState, saveProduct, applyCheckFix, EVENT_PARAMS } from '../store.js';

const APP = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const optsOf = (kw) => ({ vat: kw.vat ?? true, pit: kw.pit ?? true, items: kw.items ?? 1, newShop: !!kw.new_shop });

test('KD1–KD6 khớp tools/addons.py: trạng thái, số khoản lệch, tổng lệch, từng dòng', () => {
  assert.ok(V.checks.length >= 7);
  for (const c of V.checks) {
    const r = checkOrder(presets, c.order, c.cat_rate, c.programs, optsOf(c.kw));
    assert.equal(r.status, c.expect.status, c.id);
    assert.equal(r.mismatches, c.expect.mismatches, c.id);
    assert.equal(r.total_diff, c.expect.total_diff, c.id);
    for (const l of r.lines) assert.deepEqual({ status: l.status, reason: l.reason, diff: l.diff }, c.expect.lines[l.key], `${c.id} ${l.key}`);
  }
});

test('ngưỡng: Khớp ≤ 1đ × số SP + 1đ; Lệch nhỏ ≤ 100đ và ≤ 1%; còn lại Lệch', () => {
  assert.equal(statusOf(2, 1000, 1002, 1), 'khop');
  assert.equal(statusOf(3, 1000, 1003, 1), 'lech_nho');
  assert.equal(statusOf(4, 1000, 1004, 3), 'khop');
  assert.equal(statusOf(50, 1000, 1050), 'lech');
  assert.equal(statusOf(90, 20000, 20090), 'lech_nho');
  assert.equal(statusOf(150, 20000, 20150), 'lech');
  assert.deepEqual(Object.values(STATUS_LABEL), ['Khớp', 'Lệch nhỏ', 'Lệch', 'Có điều chỉnh']);
});

test('KD2: chẩn đoán + nút sửa; bấm sửa thì kiểm lại → Khớp', () => {
  const A = V.checks.find((c) => c.id === 'KD2').order;
  let s = defaultState();
  const r0 = saveProduct(s, 'Kẹo sữa', { platform: 'shopee', categoryRate: 0.15, price: 74692, cost: 30000, programs: ['piship'], vat: true, pit: true }, presets, 1);
  s = r0.state;
  const prod = () => s.products[0];
  const a0 = productCheckArgs(prod());
  let r = checkOrder(presets, A, a0.catRate, a0.programs, a0);
  assert.equal(r.status, 'lech');
  assert.equal(statusHeadline(r), 'Lệch 3 khoản · sàn trừ nhiều hơn 5.662đ');
  const fixed = r.lines.find((l) => l.key === 'fixed_fee');
  assert.match(fixed.diag, /Sàn đang tính 16,00% thay vì 15,00%/);
  const svc = r.lines.find((l) => l.key === 'service_fee');
  assert.match(svc.diag, /Voucher Xtra 5,5%/);
  const labels = r.lines.map((l) => fixAction(l, r, prod())?.label).filter(Boolean);
  assert.deepEqual(labels, ['Cập nhật ngành 16%', 'Bật Voucher Xtra', 'Bật phí hiển thị']);
  for (const l of r.lines) {
    const a = fixAction(l, r, prod());
    if (a) s = applyCheckFix(s, prod().id, a, 'shopee', 2);
  }
  assert.equal(prod().input.categoryRate, 0.16);
  assert.deepEqual([...prod().input.programs].sort(), ['piship', 'visibility', 'voucher_xtra']);
  const a = productCheckArgs(prod());
  r = checkOrder(presets, A, a.catRate, a.programs, a);
  assert.equal(r.status, 'khop');
  assert.deepEqual(s.events.filter((e) => e.name === 'category_rate_updated_from_check').map((e) => e.params), [{ reason_code: 'category_rate', platform: 'shopee' }]);
});

test('KD3: sàn không khấu trừ GTGT → nút Tắt GTGT', () => {
  const G = V.checks.find((c) => c.id === 'KD3');
  const r = checkOrder(presets, G.order, G.cat_rate, G.programs);
  const vat = r.lines.find((l) => l.key === 'vat');
  assert.equal(vat.status, 'lech');
  assert.equal(fixAction(vat, r, { input: { vat: true } }).label, 'Tắt GTGT');
  assert.deepEqual(fixAction(vat, r, { input: { vat: true } }).patch, { vat: false });
});

test('mẫu khiếu nại: mã đơn, khoản, số đã trừ, số theo biểu phí + ngày, chênh lệch; giọng trung tính', () => {
  const A = V.checks.find((c) => c.id === 'KD2');
  const r = checkOrder(presets, A.order, A.cat_rate, A.programs);
  const t = complaintTemplate('…8A2F', r.lines[0], '23/05/2026');
  assert.match(t, /Đơn hàng …8A2F/);
  assert.match(t, /"Phí cố định" đã trừ 11\.951đ/);
  assert.match(t, /áp dụng từ 23\/05\/2026/);
  assert.match(t, /dự kiến 11\.204đ/);
  assert.match(t, /chênh lệch 747đ/);
  assert.doesNotMatch(t, /sai phí|lừa|gian lận/i);
});

test('lãi thật của đơn theo giá vốn: đơn A về 40.394đ như màn Shopee', () => {
  const A = V.checks.find((c) => c.id === 'KD1').order;
  const p = realProfit({ ...A, affiliate: 4840 }, 30000, 1000);
  assert.equal(p.payout, 40394);
  assert.equal(p.profit, 40394 - 30000 - 1000);
});

test('form theo thứ tự Doanh thu đơn hàng; tracking không gửi số tiền, mã đơn, tên', () => {
  assert.deepEqual(ORDER_FIELDS.buyer.map((f) => f.key), ['price', 'seller_voucher', 'ship_buyer', 'refund']);
  assert.deepEqual(ORDER_FIELDS.platform.map((f) => f.key), ['fixed_fee', 'service_fee', 'transaction_fee', 'piship', 'visibility', 'vat', 'pit', 'affiliate']);
  const plan = readFileSync(path.join(APP, '..', 'docs', 'TRACKING_PLAN.md'), 'utf8');
  for (const e of ['order_check_started', 'order_check_completed', 'mismatch_reason_viewed', 'category_rate_updated_from_check', 'complaint_template_copied']) {
    assert.ok(EVENT_PARAMS[e], e);
    assert.ok(plan.includes(`\`${e}\``), e);
    for (const p of EVENT_PARAMS[e]) assert.ok(!/price|amount|order_id|name/.test(p), p);
  }
});
