// Bộ tính tiền — hàm thuần, không đụng DOM. Spec: 1-wiki/specs/calc-engine.md
// Mọi con số thay đổi được (giá bậc, VAT, giá không khai báo) đọc từ object tariff (app/tariff-default.json).

/** 808218 → "808.218" */
export function formatNumber(n) {
  const neg = n < 0;
  const s = String(Math.abs(Math.round(n))).replace(/\B(?=(\d{3})+(?!\d))/g, '.');
  return neg ? `-${s}` : s;
}

/** 808218 → "808.218đ" */
export const formatVND = (n) => `${formatNumber(n)}đ`;

/** "2026-11" → "Tháng 11/2026" */
export function periodLabel(period) {
  const [y, m] = period.split('-');
  return `Tháng ${Number(m)}/${y}`;
}

/** "2026-11" → "T11" */
export const periodShort = (period) => `T${Number(period.split('-')[1])}`;

export function nextPeriod(period) {
  let [y, m] = period.split('-').map(Number);
  m += 1;
  if (m > 12) { m = 1; y += 1; }
  return `${y}-${String(m).padStart(2, '0')}`;
}

export function daysInPeriod(period) {
  const [y, m] = period.split('-').map(Number);
  return new Date(Date.UTC(y, m, 0)).getUTCDate();
}

/** VAT (%) áp cho kỳ hóa đơn, theo bảng vat trong config. */
export function vatRateFor(period, tariff) {
  const row = tariff.vat.find((v) => period >= v.from && (v.to == null || period <= v.to));
  if (!row) throw new Error(`Không có VAT cho kỳ ${period}`);
  return row.rate;
}

export const clampPeople = (n) => Math.min(20, Math.max(1, Math.round(Number(n) || 1)));

/**
 * Tính tiền điện.
 *   mode 'A' — có khai báo: bậc thang, độ rộng × k (k = người ÷ household_size)
 *   mode 'B' — không khai báo: toàn bộ kWh × undeclared_rate
 */
export function calcBill(kwh, { mode = 'A', people = 4, period }, tariff) {
  if (typeof kwh !== 'number' || !Number.isFinite(kwh) || kwh < 0) throw new Error('Số kWh không hợp lệ');
  const vatRate = vatRateFor(period, tariff);
  let tiers = [];
  let source = tariff.source;
  let k = null;
  if (mode === 'B') {
    tiers = [{ tier: 0, kwh, price: tariff.undeclared_rate, amount: kwh * tariff.undeclared_rate }];
    source = tariff.undeclared_source;
  } else {
    k = clampPeople(people) / tariff.household_size;
    let used = 0;
    tariff.tiers.forEach((t, i) => {
      const width = t.width == null ? Infinity : t.width * k;
      const q = Math.max(0, Math.min(width, kwh - used));
      used += width;
      if (q > 0) tiers.push({ tier: i + 1, kwh: q, price: t.price, amount: Math.round(q * t.price) });
    });
  }
  const preTax = tiers.reduce((s, t) => s + t.amount, 0);
  const total = Math.round((preTax * (100 + vatRate)) / 100);
  return { kwh, mode, people: clampPeople(people), k, period, vatRate, tiers, preTax, vat: total - preTax, total, source };
}

/** Thanh bậc giá: phần trăm độ rộng theo kWh trong từng bậc. */
export function tierBar(result) {
  if (!result.kwh) return [];
  return result.tiers.map((t) => ({
    label: t.tier ? `B${t.tier}` : 'Giá chung',
    tier: t.tier,
    kwh: t.kwh,
    pct: Math.round((t.kwh / result.kwh) * 1000) / 10,
  }));
}

export function kwhBucket(kwh) {
  if (kwh <= 100) return '0-100';
  if (kwh <= 200) return '101-200';
  if (kwh <= 400) return '201-400';
  if (kwh <= 700) return '401-700';
  return '700+';
}

/** "300 kWh · 3 người có khai báo · đã gồm VAT 8%" */
export function resultMeta(r) {
  const who = r.mode === 'B' ? `${r.people} người, không khai báo` : `${r.people} người có khai báo`;
  return `${formatNumber(r.kwh)} kWh · ${who} · đã gồm VAT ${r.vatRate}%`;
}

/** Chỉ số công tơ: chỉ chấp nhận số nguyên không âm (cho phép số 0 đứng đầu). */
function parseReading(s) {
  const t = String(s ?? '').trim();
  if (t === '') return { ok: false, error: 'empty' };
  if (!/^\d+$/.test(t)) return { ok: false, error: 'nan' };
  return { ok: true, value: Number(t) };
}

/** kWh từ chỉ số cũ/mới. replaced = công tơ vừa được thay (đếm lại từ 0). */
export function meterDelta(oldStr, newStr, replaced) {
  const n = parseReading(newStr);
  if (!n.ok) return { ok: false, field: 'new', error: n.error === 'empty' ? 'Nhập chỉ số mới đọc trên công tơ.' : 'Chỉ số chỉ gồm chữ số, không có dấu chấm hay chữ.' };
  if (replaced) return { ok: true, kwh: n.value };
  const o = parseReading(oldStr);
  if (!o.ok) return { ok: false, field: 'old', error: o.error === 'empty' ? 'Nhập chỉ số tháng trước.' : 'Chỉ số chỉ gồm chữ số, không có dấu chấm hay chữ.' };
  if (n.value < o.value) {
    return { ok: false, field: 'new', error: `Chỉ số mới nhỏ hơn tháng trước (${String(oldStr).trim()}). Kiểm tra lại số, hoặc chọn "Công tơ vừa được thay".` };
  }
  return { ok: true, kwh: n.value - o.value };
}

export function parseKwh(s) {
  const r = parseReading(s);
  if (!r.ok) return { ok: false, error: r.error === 'empty' ? 'Nhập số kWh.' : 'Số kWh là số nguyên, ví dụ 300.' };
  return { ok: true, kwh: r.value };
}

/** "1.200.000" / "4000" / "4.000đ" → số; rỗng hoặc sai → null */
export function parseAmount(s) {
  const t = String(s ?? '').replace(/[\s.đ,]/g, '');
  if (!/^\d+$/.test(t)) return null;
  return Number(t);
}

export function overchargeBucket(diff, legal) {
  if (diff <= 0) return 'none';
  const pct = diff / legal;
  if (pct < 0.2) return '<20%';
  if (pct <= 0.5) return '20-50%';
  return '>50%';
}

/** So với số chủ trọ thu. value null → không so (trả null). */
export function compareLandlord({ legalTotal, kwh, value, unit }) {
  if (value == null || value <= 0) return null;
  const landlordTotal = unit === 'total' ? value : Math.round(value * kwh);
  const diff = landlordTotal - legalTotal;
  return { landlordTotal, diff, yearly: diff * 12, status: diff > 0 ? 'over' : 'ok', bucket: overchargeBucket(diff, legalTotal), unit, value };
}

export function yearlyText(yearly) {
  if (yearly >= 1_000_000) {
    const m = (Math.round(yearly / 100_000) / 10).toString().replace('.', ',');
    return `Khoảng ${m} triệu đồng mỗi năm nếu giữ mức này.`;
  }
  return `Khoảng ${formatVND(yearly)} mỗi năm nếu giữ mức này.`;
}

/** Chia total theo trọng số; làm tròn từng phần, người cuối nhận phần còn lại để tổng khớp. */
export function splitAmount(total, weights) {
  if (weights.length === 0) return [];
  let w = weights.map((x) => Math.max(0, Number(x) || 0));
  const sum = w.reduce((a, b) => a + b, 0);
  if (sum === 0) w = w.map(() => 1);
  const S = w.reduce((a, b) => a + b, 0);
  const parts = w.slice(0, -1).map((x) => Math.round((total * x) / S));
  parts.push(total - parts.reduce((a, b) => a + b, 0));
  return parts;
}

/** Chia tiền điện + các khoản cố định cho từng người. type 'equal' | 'days'. */
export function splitBill({ total, type, people, extras = [] }) {
  const weights = people.map((p) => (type === 'days' ? Number(p.days) || 0 : 1));
  const elec = splitAmount(total, weights);
  const extraParts = extras.map((e) => splitAmount(Number(e.amount) || 0, weights));
  const rows = people.map((p, i) => {
    const ex = extraParts.reduce((s, parts) => s + parts[i], 0);
    return { electric: elec[i], extras: ex, total: elec[i] + ex };
  });
  const sum = total + extras.reduce((s, e) => s + (Number(e.amount) || 0), 0);
  return { people: rows, sum };
}

/** Phân bổ hóa đơn tổng theo kWh từng phòng (chế độ C). */
export const allocateTotal = (total, kwhs) => splitAmount(total, kwhs);

/** kWh của một phòng (chủ trọ). */
export function roomKwh(room) {
  const d = meterDelta(room.oldReading, room.newReading, !!room.replaced);
  return d.ok ? d.kwh : 0;
}

/** Tiền từng phòng + tổng nhà trọ theo chế độ của nhà (A/B/C). */
export function houseSummary(house, tariff) {
  const kwhs = house.rooms.map(roomKwh);
  let totals;
  if (house.mode === 'C') {
    totals = allocateTotal(Number(house.evnTotal) || 0, kwhs);
  } else {
    totals = house.rooms.map((r, i) =>
      calcBill(kwhs[i], { mode: house.mode === 'A' && r.declared ? 'A' : 'B', people: r.people, period: house.period }, tariff).total);
  }
  const rooms = house.rooms.map((r, i) => ({ id: r.id, name: r.name, people: r.people, kwh: kwhs[i], total: totals[i], paid: !!r.paid, hasReading: meterDelta(r.oldReading, r.newReading, !!r.replaced).ok }));
  const paid = rooms.filter((r) => r.paid);
  return {
    rooms,
    count: rooms.length,
    paidCount: paid.length,
    collected: paid.reduce((s, r) => s + r.total, 0),
    total: rooms.reduce((s, r) => s + r.total, 0),
  };
}

/** Sang tháng mới: chỉ số mới → cũ, xoá đã thu, kỳ +1. */
export function rollMonth(house) {
  return {
    ...house,
    period: nextPeriod(house.period),
    rooms: house.rooms.map((r) => ({ ...r, oldReading: r.newReading !== '' ? r.newReading : r.oldReading, newReading: '', paid: false, replaced: false })),
  };
}

/** Bảng giá cho màn Nguồn. */
export function tariffRows(tariff) {
  let from = 0;
  return tariff.tiers.map((t, i) => {
    const to = t.width == null ? null : from + t.width;
    const range = to == null ? `từ ${from + 1}` : `${i === 0 ? 0 : from + 1}–${to}`;
    from = to ?? from;
    return { tier: i + 1, range, price: t.price };
  });
}
