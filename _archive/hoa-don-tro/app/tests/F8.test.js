// F8 — Ảnh hóa đơn & chia sẻ (1-wiki/features/F8-anh-hoa-don.md)
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { invoiceModel, sharedEvent } from '../store.js';
import { crc16 } from '../vietqr.js';

const base = {
  role: 'tenant', room: 'P203', period: '2026-11', oldReading: '04221', newReading: '04521', kwh: 300,
  total: 808218, vatRate: 8, splitLabel: 'chia theo ngày ở',
  people: [{ name: 'Linh', days: 30, total: 303082 }, { name: 'Minh', days: 30, total: 303082 }, { name: 'Tú', days: 20, total: 202054 }],
  payee: { bin: '', account: '', name: '' }, pro: false,
};

test('hóa đơn có phòng, kỳ, chỉ số, kWh, tổng, từng người', () => {
  const m = invoiceModel(base);
  assert.equal(m.title, 'HÓA ĐƠN TIỀN ĐIỆN');
  assert.equal(m.heading, 'Phòng P203 · Tháng 11/2026');
  assert.equal(m.readingLine, 'Chỉ số 04221 → 04521');
  assert.equal(m.kwhLine, '300 kWh');
  assert.equal(m.priceLabel, 'Giá bậc thang + VAT 8%');
  assert.equal(m.total, 808218);
  assert.deepEqual(m.lines, [
    { label: 'Linh · 30 ngày', amount: 303082 },
    { label: 'Minh · 30 ngày', amount: 303082 },
    { label: 'Tú · 20 ngày', amount: 202054 },
  ]);
});

test('chưa nhập ngân hàng → không có QR; có ngân hàng + số TK → có QR', () => {
  assert.equal(invoiceModel(base).qr, null);
  const m = invoiceModel({ ...base, payee: { bin: '970436', account: '0123456789', name: 'Linh' } });
  assert.ok(m.qr.payload.includes('0006970436'));
  assert.ok(m.qr.payload.includes('01100123456789'));
  assert.equal(m.qr.payload.slice(-4), crc16(m.qr.payload.slice(0, -4)));
  assert.equal(m.qr.caption, 'Quét để chuyển cho Linh');
  assert.equal(m.qr.note, 'P203 T11 TIEN DIEN');
});

test('dòng "Tính bằng Hóa Đơn Trọ": có ở gói miễn phí, mất ở gói Pro', () => {
  assert.match(invoiceModel(base).branding, /^Tính bằng Hóa Đơn Trọ/);
  assert.equal(invoiceModel({ ...base, pro: true }).branding, null);
});

test('hóa đơn chủ trọ: QR có số tiền của phòng', () => {
  const m = invoiceModel({ ...base, role: 'landlord', people: [], total: 605669, payee: { bin: '970436', account: '0123456789', name: 'Cô Hạnh' } });
  assert.ok(m.qr.payload.includes('5406605669'));
});

test('event bill_image_shared không có số tài khoản', () => {
  assert.deepEqual(sharedEvent({ role: 'tenant', hasQr: true, channel: 'download' }), { role: 'tenant', has_vietqr: true, channel: 'download' });
});
