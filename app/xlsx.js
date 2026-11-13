// F30 — Đọc file Báo Cáo Doanh Thu (.xlsx) của Shopee trên máy, không thư viện, không gửi đi đâu.
// Giải nén bằng DecompressionStream('deflate-raw') của trình duyệt (Node 18+ cũng có). Tìm cột theo TÊN, không theo vị trí.

const u16 = (b, o) => b[o] | (b[o + 1] << 8);
const u32 = (b, o) => (b[o] | (b[o + 1] << 8) | (b[o + 2] << 16) | (b[o + 3] << 24)) >>> 0;

async function inflateRaw(data) {
  const stream = new Blob([data]).stream().pipeThrough(new DecompressionStream('deflate-raw'));
  return new Uint8Array(await new Response(stream).arrayBuffer());
}

/** Giải nén zip → Map(tên → Uint8Array). Hỗ trợ stored (0) và deflate (8). */
export async function unzip(bytes) {
  const b = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);
  let eocd = -1;
  for (let i = b.length - 22; i >= Math.max(0, b.length - 65557); i -= 1) if (u32(b, i) === 0x06054b50) { eocd = i; break; }
  if (eocd < 0) throw Object.assign(new Error('Không phải file .xlsx'), { code: 'not_xlsx' });
  const n = u16(b, eocd + 10);
  let p = u32(b, eocd + 16);
  const out = new Map();
  const dec = new TextDecoder();
  for (let k = 0; k < n; k += 1) {
    if (u32(b, p) !== 0x02014b50) throw Object.assign(new Error('File .xlsx hỏng'), { code: 'not_xlsx' });
    const method = u16(b, p + 10);
    const size = u32(b, p + 20);
    const nameLen = u16(b, p + 28);
    const extra = u16(b, p + 30);
    const comment = u16(b, p + 32);
    const local = u32(b, p + 42);
    const name = dec.decode(b.subarray(p + 46, p + 46 + nameLen));
    const start = local + 30 + u16(b, local + 26) + u16(b, local + 28);
    const raw = b.subarray(start, start + size);
    if (method === 0) out.set(name, raw);
    else if (method === 8) out.set(name, await inflateRaw(raw));
    p += 46 + nameLen + extra + comment;
  }
  return out;
}

const ENT = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'" };
const unesc = (s) => s.replace(/&(#x[0-9a-f]+|#\d+|\w+);/gi, (m, e) => (e[0] === '#'
  ? String.fromCodePoint(e[1].toLowerCase() === 'x' ? parseInt(e.slice(2), 16) : parseInt(e.slice(1), 10)) : ENT[e] ?? m));
const textOf = (xml) => unesc([...xml.matchAll(/<t(?:\s[^>]*)?>([\s\S]*?)<\/t>/g)].map((m) => m[1]).join(''));
const colIndex = (ref) => [...ref.replace(/\d+/g, '')].reduce((s, ch) => s * 26 + ch.charCodeAt(0) - 64, 0) - 1;

/** Đọc .xlsx → [{ name, rows: [[ô…]] }]. Ô số → number, ô chữ → string. */
export async function readXlsx(bytes) {
  const files = await unzip(bytes);
  const dec = new TextDecoder();
  const get = (n) => (files.has(n) ? dec.decode(files.get(n)) : null);
  const wb = get('xl/workbook.xml');
  if (!wb) throw Object.assign(new Error('Không phải file .xlsx'), { code: 'not_xlsx' });
  const rels = Object.fromEntries([...(get('xl/_rels/workbook.xml.rels') ?? '').matchAll(/<Relationship\b[^>]*>/g)]
    .map((m) => [m[0].match(/Id="([^"]+)"/)?.[1], m[0].match(/Target="([^"]+)"/)?.[1]]));
  const shared = [...(get('xl/sharedStrings.xml') ?? '').matchAll(/<si>([\s\S]*?)<\/si>/g)].map((m) => textOf(m[1]));
  const sheets = [];
  for (const m of wb.matchAll(/<sheet\b[^>]*\/?>/g)) {
    const name = unesc(m[0].match(/name="([^"]*)"/)?.[1] ?? '');
    const rid = m[0].match(/r:id="([^"]+)"/)?.[1];
    let target = rels[rid] ?? '';
    target = target.startsWith('/') ? target.slice(1) : `xl/${target}`;
    const xml = get(target) ?? '';
    const rows = [];
    for (const rm of xml.matchAll(/<row\b[^>]*>([\s\S]*?)<\/row>|<row\b[^>]*\/>/g)) {
      const row = [];
      for (const cm of (rm[1] ?? '').matchAll(/<c\b([^>]*?)(?:\/>|>([\s\S]*?)<\/c>)/g)) {
        const attrs = cm[1];
        const ref = attrs.match(/r="([A-Z]+)\d+"/)?.[1];
        const t = attrs.match(/t="([^"]+)"/)?.[1];
        const body = cm[2] ?? '';
        const v = body.match(/<v>([\s\S]*?)<\/v>/)?.[1];
        let val = null;
        if (t === 's') val = shared[Number(v)] ?? '';
        else if (t === 'inlineStr') val = textOf(body);
        else if (t === 'str' || t === 'e') val = v != null ? unesc(v) : '';
        else if (t === 'b') val = v === '1';
        else if (v != null) val = Number(v);
        const idx = ref ? colIndex(ref) : row.length;
        row[idx] = val;
      }
      rows.push(row);
    }
    sheets.push({ name, rows });
  }
  return sheets;
}

// ---------------------------------------------------------------- trang Income
export const norm = (s) => String(s ?? '').normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/đ/g, 'd').replace(/Đ/g, 'd')
  .toLowerCase().replace(/\(.*?\)/g, ' ').replace(/[^a-z0-9/ ]+/g, ' ').replace(/\s+/g, ' ').trim();

/** Tên cột (đã chuẩn hoá) tiếng Việt / tiếng Anh. Thêm tên mới khi Shopee đổi mẫu. */
export const COLUMNS = {
  order_id: ['ma don hang', 'order id', 'order sn', 'ma don'],
  level: ['don hang/san pham', 'don hang / san pham', 'order/product', 'cap'],
  sku: ['sku phan loai hang', 'sku san pham', 'sku', 'ten san pham', 'product name'],
  price: ['gia san pham', 'gia goc', 'product price', 'original price'],
  refund: ['so tien hoan lai', 'refund amount'],
  seller_voucher: ['ma giam gia cua shop', 'ma giam gia shop', 'ma giam gia', 'seller voucher', 'voucher cua shop'],
  ship_buyer: ['phi van chuyen nguoi mua tra', 'phi van chuyen ma nguoi mua tra', 'buyer paid shipping fee'],
  fixed_fee: ['phi co dinh', 'commission fee', 'fixed fee'],
  service_fee: ['phi dich vu', 'service fee'],
  transaction_fee: ['phi xu ly giao dich', 'phi thanh toan', 'transaction fee'],
  affiliate: ['phi hoa hong tiep thi lien ket', 'hoa hong tiep thi lien ket', 'affiliate commission'],
  vat: ['thue gtgt', 'vat'],
  pit: ['thue tncn', 'pit', 'personal income tax'],
  compensation: ['den bu', 'compensation'],
  adjustment: ['dieu chinh', 'adjustment'],
  piship: ['piship', 'phi piship'],
  visibility: ['phi dich vu hien thi', 'phi hien thi', 'visibility fee'],
};
export const REQUIRED = ['order_id', 'price', 'fixed_fee', 'service_fee', 'transaction_fee'];
const FEES = ['fixed_fee', 'service_fee', 'transaction_fee', 'affiliate', 'vat', 'pit', 'piship', 'visibility', 'seller_voucher', 'refund'];

function findHeader(rows) {
  for (let i = 0; i < Math.min(rows.length, 30); i += 1) {
    const cells = (rows[i] ?? []).map(norm);
    if (cells.some((c) => COLUMNS.order_id.includes(c))) return i;
  }
  return -1;
}
function mapColumns(header) {
  const cells = header.map(norm);
  const map = {};
  for (const [key, names] of Object.entries(COLUMNS)) {
    for (const n of names) { const i = cells.indexOf(n); if (i >= 0) { map[key] = i; break; } }
  }
  return map;
}
const numOf = (v) => {
  if (typeof v === 'number') return v;
  const s = String(v ?? '').replace(/[^\d,.-]/g, '').replace(/\./g, '').replace(',', '.');
  return Number(s) || 0;
};

/**
 * Trang Income → { orders: [{ id, sku, items, …số tiền }], lumped } hoặc { error: { code, missing } }.
 * Phí lưu số dương. Trang Service Fee Details (nếu có) tách PiShip / phí hiển thị khỏi Phí dịch vụ.
 */
export function parseIncome(sheets) {
  const income = sheets.find((s) => /income|doanh thu/i.test(norm(s.name))) ?? sheets.find((s) => findHeader(s.rows) >= 0);
  if (!income) return { error: { code: 'wrong_template', missing: 'income_sheet' } };
  const h = findHeader(income.rows);
  if (h < 0) return { error: { code: 'wrong_template', missing: 'order_id' } };
  const col = mapColumns(income.rows[h]);
  const missing = REQUIRED.find((k) => col[k] == null);
  if (missing) return { error: { code: 'missing_column', missing } };
  const orders = [];
  const byId = new Map();
  for (const row of income.rows.slice(h + 1)) {
    const id = String(row[col.order_id] ?? '').trim();
    if (!id) continue;
    const level = col.level != null ? norm(row[col.level]) : '';
    const isProduct = /san pham|product|sku/.test(level);
    if (isProduct) {
      const o = byId.get(id);
      if (o) { o.items += 1; if (!o.sku && col.sku != null) o.sku = String(row[col.sku] ?? '').trim(); }
      continue;
    }
    const o = { id, sku: col.sku != null ? String(row[col.sku] ?? '').trim() : '', items: 0 };
    for (const k of ['price', 'ship_buyer', 'compensation', 'adjustment', ...FEES]) if (col[k] != null) o[k] = Math.abs(numOf(row[col[k]]));
    if (col.adjustment != null) o.adjustment = numOf(row[col.adjustment]);
    orders.push(o);
    byId.set(id, o);
  }
  for (const o of orders) o.items = Math.max(1, o.items);
  let lumped = col.piship == null && col.visibility == null;
  const sfd = sheets.find((s) => /service fee/.test(norm(s.name)) || norm(s.name).includes('chi tiet phi dich vu'));
  if (lumped && sfd) {
    const sh = findHeader(sfd.rows);
    if (sh >= 0) {
      const sc = mapColumns(sfd.rows[sh]);
      if (sc.piship != null || sc.visibility != null) {
        for (const row of sfd.rows.slice(sh + 1)) {
          const o = byId.get(String(row[sc.order_id] ?? '').trim());
          if (!o) continue;
          o.piship = (o.piship ?? 0) + (sc.piship != null ? Math.abs(numOf(row[sc.piship])) : 0);
          o.visibility = (o.visibility ?? 0) + (sc.visibility != null ? Math.abs(numOf(row[sc.visibility])) : 0);
        }
        for (const o of orders) o.service_fee -= (o.piship ?? 0) + (o.visibility ?? 0);
        lumped = false;
      }
    }
  }
  if (!orders.length) return { error: { code: 'empty', missing: '' } };
  return { orders, lumped };
}

/** Đọc + phân tích một file; không bao giờ ném lỗi ra ngoài (không treo app). */
export async function readIncomeFile(bytes) {
  try {
    return parseIncome(await readXlsx(bytes));
  } catch (e) {
    return { error: { code: e.code ?? 'not_xlsx', missing: '' } };
  }
}

export const fileErrorText = (err) => (err.code === 'missing_column' || err.code === 'wrong_template'
  ? 'File không đúng mẫu Báo Cáo Doanh Thu' : err.code === 'empty' ? 'File không có đơn hàng nào' : 'Không đọc được file: hãy chọn file .xlsx tải từ Kênh Người Bán');
