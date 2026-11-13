// F7 — Mã VietQR (1-wiki/features/F7-vietqr.md, 1-wiki/specs/vietqr.md)
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { crc16, vietqrPayload, toTransferNote } from '../vietqr.js';
import { rsEncode, encodeQR } from '../qr.js';
import { BANKS } from '../banks.js';

test('CRC16-CCITT chuẩn: "123456789" → 29B1', () => {
  assert.equal(crc16('123456789'), '29B1');
});

test('payload VietQR động có đủ trường EMVCo và CRC đúng', () => {
  const p = vietqrPayload({ bin: '970436', account: '0123456789', amount: 605669, purpose: 'P101 T11 TIEN DIEN' });
  assert.ok(p.startsWith('000201' + '010212'), p);
  assert.ok(p.includes('3854' + '0010A000000727' + '0124' + '0006970436' + '0110' + '0123456789' + '0208QRIBFTTA'), p);
  assert.ok(p.includes('5303704'));
  assert.ok(p.includes('5406605669'));
  assert.ok(p.includes('5802VN'));
  assert.ok(p.includes('6222' + '0818P101 T11 TIEN DIEN'));
  assert.match(p, /6304[0-9A-F]{4}$/);
  assert.equal(p.slice(-4), crc16(p.slice(0, -4)));
});

test('không có số tiền → QR tĩnh (01=11), không có trường 54', () => {
  const p = vietqrPayload({ bin: '970415', account: '1234', purpose: 'P203 T11 TIEN DIEN' });
  assert.ok(p.startsWith('000201010211'));
  assert.ok(!/5303704 ?54/.test(p) && !p.includes('5303704' + '54'));
  assert.equal(p.slice(-4), crc16(p.slice(0, -4)));
  assert.throws(() => vietqrPayload({ bin: '12', account: '1234' }));
  assert.throws(() => vietqrPayload({ bin: '970415', account: '' }));
});

test('nội dung chuyển khoản bỏ dấu, ASCII, ≤ 25 ký tự', () => {
  assert.equal(toTransferNote('P203 T11 Tiền điện'), 'P203 T11 TIEN DIEN');
  assert.equal(toTransferNote('Phòng Đông Hưng – tháng mười một năm nay'), 'PHONG DONG HUNG THANG MUO');
  assert.ok(/^[\x20-\x7E]*$/.test(toTransferNote('Ưu đãi ở Đà Nẵng')));
});

test('Reed–Solomon đúng ví dụ chuẩn HELLO WORLD 1-M', () => {
  const data = [32, 91, 11, 120, 209, 114, 220, 77, 67, 64, 236, 17, 236, 17, 236, 17];
  assert.deepEqual(rsEncode(data, 10), [196, 35, 39, 119, 235, 215, 231, 226, 93, 23]);
});

test('encodeQR: ma trận vuông, 3 ô định vị, đủ chứa 150 byte', () => {
  const text = 'A'.repeat(150);
  const qr = encodeQR(text);
  assert.ok(qr.version >= 8, `version ${qr.version}`);
  assert.equal(qr.size, qr.version * 4 + 17);
  assert.equal(qr.modules.length, qr.size);
  assert.ok(qr.modules.every((row) => row.length === qr.size));
  const finder = (r, c) => {
    for (let i = 0; i < 7; i++) for (let j = 0; j < 7; j++) {
      const ring = Math.max(Math.abs(i - 3), Math.abs(j - 3));
      assert.equal(qr.modules[r + i][c + j], ring !== 2, `ô định vị (${r},${c}) tại ${i},${j}`);
    }
  };
  finder(0, 0);
  finder(0, qr.size - 7);
  finder(qr.size - 7, 0);
  const small = encodeQR(vietqrPayload({ bin: '970436', account: '0123456789', amount: 605669, purpose: 'P101 T11 TIEN DIEN' }));
  assert.ok(small.size >= 21);
});

test('danh sách ngân hàng ≥ 20, BIN 6 số', () => {
  assert.ok(BANKS.length >= 20);
  for (const b of BANKS) {
    assert.match(b.bin, /^\d{6}$/);
    assert.ok(b.name.length > 1);
  }
  assert.equal(new Set(BANKS.map((b) => b.bin)).size, BANKS.length);
});
