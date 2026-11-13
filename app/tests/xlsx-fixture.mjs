// Dựng file .xlsx tối giản để kiểm F30 (dùng ở F30.test.js và tools/make_sample_xlsx.mjs). Không phải test.
import { deflateRawSync } from 'node:zlib';

const crcTable = Array.from({ length: 256 }, (_, n) => { let c = n; for (let k = 0; k < 8; k += 1) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; return c >>> 0; });
const crc32 = (b) => { let c = 0xffffffff; for (const x of b) c = crcTable[(c ^ x) & 0xff] ^ (c >>> 8); return (c ^ 0xffffffff) >>> 0; };

export function zip(files, { deflate = true } = {}) {
  const enc = new TextEncoder();
  const parts = [];
  const central = [];
  let off = 0;
  for (const [name, text] of Object.entries(files)) {
    const nb = enc.encode(name);
    const raw = typeof text === 'string' ? enc.encode(text) : text;
    const data = deflate ? new Uint8Array(deflateRawSync(raw)) : raw;
    const method = deflate ? 8 : 0;
    const crc = crc32(raw);
    const lh = Buffer.alloc(30);
    lh.writeUInt32LE(0x04034b50, 0); lh.writeUInt16LE(20, 4); lh.writeUInt16LE(method, 8);
    lh.writeUInt32LE(crc, 14); lh.writeUInt32LE(data.length, 18); lh.writeUInt32LE(raw.length, 22); lh.writeUInt16LE(nb.length, 26);
    parts.push(lh, nb, data);
    const ch = Buffer.alloc(46);
    ch.writeUInt32LE(0x02014b50, 0); ch.writeUInt16LE(20, 4); ch.writeUInt16LE(20, 6); ch.writeUInt16LE(method, 10);
    ch.writeUInt32LE(crc, 16); ch.writeUInt32LE(data.length, 20); ch.writeUInt32LE(raw.length, 24); ch.writeUInt16LE(nb.length, 28);
    ch.writeUInt32LE(off, 42);
    central.push(ch, nb);
    off += 30 + nb.length + data.length;
  }
  const cd = Buffer.concat(central);
  const end = Buffer.alloc(22);
  end.writeUInt32LE(0x06054b50, 0); end.writeUInt16LE(Object.keys(files).length, 8); end.writeUInt16LE(Object.keys(files).length, 10);
  end.writeUInt32LE(cd.length, 12); end.writeUInt32LE(off, 16);
  return new Uint8Array(Buffer.concat([...parts, cd, end]));
}

const x = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const colName = (i) => { let s = ''; i += 1; while (i) { const m = (i - 1) % 26; s = String.fromCharCode(65 + m) + s; i = Math.floor((i - 1) / 26); } return s; };

/** sheets: [{ name, rows: [[…]] }] → bytes .xlsx (chữ dùng sharedStrings, có 1 ô inlineStr để kiểm). */
export function buildXlsx(sheets, opts) {
  const shared = [];
  const sidx = (s) => { let i = shared.indexOf(s); if (i < 0) { i = shared.length; shared.push(s); } return i; };
  const files = {
    '[Content_Types].xml': '<?xml version="1.0" encoding="UTF-8"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"/>',
    'xl/workbook.xml': `<?xml version="1.0" encoding="UTF-8"?><workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets>${
      sheets.map((s, i) => `<sheet name="${x(s.name)}" sheetId="${i + 1}" r:id="rId${i + 1}"/>`).join('')}</sheets></workbook>`,
    'xl/_rels/workbook.xml.rels': `<?xml version="1.0" encoding="UTF-8"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">${
      sheets.map((s, i) => `<Relationship Id="rId${i + 1}" Type="worksheet" Target="worksheets/sheet${i + 1}.xml"/>`).join('')}</Relationships>`,
  };
  sheets.forEach((s, si) => {
    const rows = s.rows.map((r, ri) => `<row r="${ri + 1}">${r.map((v, ci) => {
      if (v == null || v === '') return '';
      const ref = `${colName(ci)}${ri + 1}`;
      if (typeof v === 'number') return `<c r="${ref}"><v>${v}</v></c>`;
      if (ri === 0 && ci === 0) return `<c r="${ref}" t="inlineStr"><is><t>${x(v)}</t></is></c>`;
      return `<c r="${ref}" t="s"><v>${sidx(String(v))}</v></c>`;
    }).join('')}</row>`).join('');
    files[`xl/worksheets/sheet${si + 1}.xml`] = `<?xml version="1.0" encoding="UTF-8"?><worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><sheetData>${rows}</sheetData></worksheet>`;
  });
  files['xl/sharedStrings.xml'] = `<?xml version="1.0" encoding="UTF-8"?><sst xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">${shared.map((s) => `<si><t xml:space="preserve">${x(s)}</t></si>`).join('')}</sst>`;
  return zip(files, opts);
}

// 8 đơn Shopee thật đã đối chiếu (raw/orders/real_orders.csv) + 1 đơn lệch. Phí ghi số âm như báo cáo Shopee.
// Phí dịch vụ trong trang Income gộp PiShip + phí hiển thị; trang Service Fee Details tách ra.
export const REAL_ORDERS = [
  { id: '2610160A1KEOA', sku: 'Kẹo sữa', price: 74692, seller_voucher: 0, ship_buyer: 21500, fixed_fee: 11951, svc: 7108, piship: 2700, vis: 807, tx: 5772, aff: 4840, vat: 747, pit: 373 },
  { id: '2610270B2TOPB', sku: 'Đệm topper', price: 325000, seller_voucher: 0, ship_buyer: 34500, fixed_fee: 52000, svc: 20875, piship: 0, vis: 0, tx: 21570, aff: 0, vat: 3250, pit: 1625 },
  { id: '2611020F3DTUF', sku: 'Tai nghe', price: 650000, seller_voucher: 3000, ship_buyer: 0, fixed_fee: 77640, svc: 3000, piship: 2700, vis: 0, tx: 38820, aff: 0, vat: 6470, pit: 3235 },
  { id: '2611030G4MEOG', sku: 'Hạt mèo G', price: 170000, seller_voucher: 0, ship_buyer: 146900, fixed_fee: 23800, svc: 12350, piship: 0, vis: 0, tx: 19014, aff: 0, vat: 0, pit: 850 },
  { id: '2611040H5MEOH', sku: 'Pate mèo', price: 180000, seller_voucher: 0, ship_buyer: 0, fixed_fee: 25200, svc: 12900, piship: 0, vis: 0, tx: 10800, aff: 0, vat: 1800, pit: 900 },
  { id: '2611050I6MYPI', sku: 'Son dưỡng', price: 275000, seller_voucher: 0, ship_buyer: 0, fixed_fee: 46750, svc: 18125, piship: 2700, vis: 0, tx: 16500, aff: 0, vat: 2750, pit: 1375 },
  { id: '2611060J7AOTJ', sku: 'Áo sơ mi', price: 450000, seller_voucher: 18000, ship_buyer: 0, fixed_fee: 71280, svc: 26760, piship: 2700, vis: 0, tx: 25920, aff: 34432, vat: 4320, pit: 2160 },
  { id: '2611070K8VAYK', sku: 'Váy liền', price: 350000, seller_voucher: 0, ship_buyer: 32800, fixed_fee: 57750, svc: 22250, piship: 0, vis: 3780, tx: 22968, aff: 0, vat: 3500, pit: 1750 },
  { id: '2611080L9KEOL', sku: 'Kẹo sữa', price: 74692, seller_voucher: 0, ship_buyer: 21500, fixed_fee: 12698, svc: 7108, piship: 2700, vis: 807, tx: 5772, aff: 0, vat: 747, pit: 373 },
];

/** Sản phẩm trong Danh mục khớp từng SKU (ngành, chương trình, GTGT theo đơn thật). */
export const SKU_PRODUCTS = {
  'Kẹo sữa': { categoryRate: 0.16, programs: ['voucher_xtra', 'piship', 'visibility'], cost: 30000 },
  'Đệm topper': { categoryRate: 0.16, programs: ['voucher_xtra'], cost: 180000 },
  'Tai nghe': { categoryRate: 0.12, programs: ['piship'], cost: 400000 },
  'Hạt mèo G': { categoryRate: 0.14, programs: ['voucher_xtra'], vat: false, cost: 90000 },
  'Pate mèo': { categoryRate: 0.14, programs: ['voucher_xtra'], cost: 100000 },
  'Son dưỡng': { categoryRate: 0.17, programs: ['voucher_xtra', 'piship'], cost: 120000 },
  'Áo sơ mi': { categoryRate: 0.165, programs: ['voucher_xtra', 'piship'], cost: 200000 },
  'Váy liền': { categoryRate: 0.165, programs: ['voucher_xtra', 'visibility'], cost: 160000 },
};

export function incomeWorkbook(orders = REAL_ORDERS, { dropColumn = null } = {}) {
  const head = ['Mã đơn hàng', 'Đơn hàng / Sản phẩm', 'SKU phân loại hàng', 'Giá sản phẩm', 'Số tiền hoàn lại', 'Mã giảm giá của Shop', 'Phí vận chuyển người mua trả (₫)',
    'Phí cố định', 'Phí Dịch Vụ', 'Phí xử lý giao dịch', 'Phí hoa hồng Tiếp thị liên kết', 'Thuế GTGT', 'Thuế TNCN', 'Đền bù', 'Tổng tiền đã thanh toán'];
  const rows = [['Báo Cáo Doanh Thu'], ['Shop: (ẩn)', '', 'Từ 01/10/2026 đến 10/11/2026'], [], head];
  for (const o of orders) {
    const ded = o.fixed_fee + o.svc + o.piship + o.vis + o.tx + o.aff + o.vat + o.pit;
    rows.push([o.id, 'Đơn hàng', '', o.price, 0, -o.seller_voucher, o.ship_buyer, -o.fixed_fee, -(o.svc + o.piship + o.vis), -o.tx, -o.aff, -o.vat, -o.pit, 0, o.price - o.seller_voucher - ded]);
    rows.push([o.id, 'Sản phẩm', o.sku, o.price, '', '', '', '', '', '', '', '', '', '', '']);
  }
  const sfd = [['Mã đơn hàng', 'Phí hạ tầng', 'Voucher Xtra', 'PiShip', 'Phí dịch vụ hiển thị']];
  for (const o of orders) sfd.push([o.id, -3000, -(o.svc - 3000), -o.piship, -o.vis]);
  const sheets = [{ name: 'Summary', rows: [['Tổng quan'], ['Tổng doanh thu', 1]] }, { name: 'Income', rows }, { name: 'Service Fee Details', rows: sfd }];
  if (dropColumn) {
    const i = head.indexOf(dropColumn);
    sheets[1].rows = rows.map((r, k) => (k >= 3 ? r.filter((_, j) => j !== i) : r));
  }
  return sheets;
}
