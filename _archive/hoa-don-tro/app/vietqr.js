// Chuỗi VietQR theo chuẩn EMVCo / NAPAS 247, tạo ngay trên máy. Spec: 1-wiki/specs/vietqr.md

/** CRC16-CCITT (đa thức 0x1021, khởi tạo 0xFFFF) → 4 ký tự HEX hoa. */
export function crc16(str) {
  let crc = 0xffff;
  for (const byte of new TextEncoder().encode(str)) {
    crc ^= byte << 8;
    for (let i = 0; i < 8; i++) crc = crc & 0x8000 ? ((crc << 1) ^ 0x1021) & 0xffff : (crc << 1) & 0xffff;
  }
  return crc.toString(16).toUpperCase().padStart(4, '0');
}

const tlv = (id, value) => `${id}${String(value.length).padStart(2, '0')}${value}`;

/** Nội dung chuyển khoản: bỏ dấu, chữ hoa, chỉ A–Z 0–9 và khoảng trắng, tối đa 25 ký tự. */
export function toTransferNote(s) {
  return String(s ?? '')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/đ/g, 'd')
    .replace(/Đ/g, 'D')
    .toUpperCase()
    .replace(/[^A-Z0-9 ]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 25)
    .trim();
}

/**
 * VietQR chuyển khoản tới tài khoản.
 *   amount có → QR động (01=12) kèm trường 54; không có → QR tĩnh (01=11).
 */
export function vietqrPayload({ bin, account, amount, purpose }) {
  if (!/^\d{6}$/.test(String(bin ?? ''))) throw new Error('Mã ngân hàng (BIN) phải gồm 6 chữ số');
  const acc = String(account ?? '').replace(/\s/g, '');
  if (!/^[0-9A-Za-z]{1,19}$/.test(acc)) throw new Error('Số tài khoản không hợp lệ');
  const hasAmount = Number.isInteger(amount) && amount > 0;
  const beneficiary = tlv('00', String(bin)) + tlv('01', acc);
  const merchant = tlv('00', 'A000000727') + tlv('01', beneficiary) + tlv('02', 'QRIBFTTA');
  const note = toTransferNote(purpose);
  let p = tlv('00', '01') + tlv('01', hasAmount ? '12' : '11') + tlv('38', merchant) + tlv('53', '704');
  if (hasAmount) p += tlv('54', String(amount));
  p += tlv('58', 'VN');
  if (note) p += tlv('62', tlv('08', note));
  p += '6304';
  return p + crc16(p);
}
