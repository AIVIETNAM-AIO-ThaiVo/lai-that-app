// F17 — Lịch sale lớn: các ngày "trùng số" 1.1 … 12.12 [ASSUMPTION, xem 4-memory/po-questions.md]. Hàm thuần.

const DAY = 24 * 3600 * 1000;
const utc = (y, m, d) => Date.UTC(y, m - 1, d);
const parse = (iso) => { const [y, m, d] = iso.split('-').map(Number); return utc(y, m, d); };
const isoOf = (t) => new Date(t).toISOString().slice(0, 10);

/** Ngày sale lớn kế tiếp (tính cả hôm nay). today: "YYYY-MM-DD". */
export function nextSale(today) {
  const t = parse(today);
  const y = new Date(t).getUTCFullYear();
  for (const year of [y, y + 1]) {
    for (let m = 1; m <= 12; m++) {
      const d = utc(year, m, m);
      if (d >= t) return { iso: isoOf(d), label: `${m}.${m}`, days: Math.round((d - t) / DAY) };
    }
  }
  return null;
}

/** Nhắc khi còn ≤ 3 ngày. */
export const saleReminderDue = (sale, within = 3) => !!sale && sale.days >= 0 && sale.days <= within;

export const saleLine = (sale) => `Sale gần nhất: ${sale.label} · ${sale.days === 0 ? 'hôm nay' : `còn ${sale.days} ngày`}`;

export const saleBannerText = (sale) => (sale.days === 0 ? `Hôm nay là ${sale.label} — kiểm tra giá Flash Sale` : `Còn ${sale.days} ngày tới ${sale.label} — kiểm tra giá Flash Sale`);

/** Ngày hôm nay theo giờ Việt Nam. */
export const todayVN = (now = Date.now()) => new Date(now + 7 * 3600 * 1000).toISOString().slice(0, 10);
