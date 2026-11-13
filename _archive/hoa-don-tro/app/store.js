// Trạng thái app — hàm thuần (không DOM, không localStorage). ui.js gọi các hàm này rồi tự lưu.
// Spec: 1-wiki/specs/data-model.md · tracking: 1-wiki/specs/tracking-plan.md
import { periodLabel, periodShort, formatNumber } from './logic.js';
import { vietqrPayload, toTransferNote } from './vietqr.js';
import { bankName } from './banks.js';

export const STORAGE_KEY = 'hdt:v1';
export const FREE_ROOMS = 3;
export const HISTORY_MAX = 50;
export const INTERSTITIAL_GAP_MS = 3 * 60 * 1000;

export const EVENTS = [
  'onboarding_completed', 'reading_entered', 'bill_calculated', 'landlord_compare_done', 'bill_split',
  'bill_image_shared', 'room_added', 'batch_bills_created', 'paywall_viewed', 'purchase_completed',
  'ad_rewarded_completed', 'ad_impression', 'calc_error_reported', 'tariff_config_loaded',
];
const FORBIDDEN_KEYS = /^(account|name|amount|total|bin|payee|money|price|phone|room|value)$/i;

export const PLANS = {
  year: { id: 'year', label: 'Theo năm', price: 399000, savePct: 32 },
  month: { id: 'month', label: 'Theo tháng', price: 49000 },
  renewNote: 'Tự gia hạn qua Google Play (hỗ trợ MoMo) cho đến khi bạn hủy trong Google Play. Giá đang thử nghiệm.',
};

/** Gói Premium cho người thuê (không quảng cáo). */
export const PREMIUM = {
  lifetime: { id: 'lifetime', label: 'Trọn đời', price: 99000, note: 'Trả một lần, dùng mãi' },
  month: { id: 'month', label: 'Theo tháng', price: 19000 },
  renewNote: 'Gói tháng tự gia hạn qua Google Play cho đến khi bạn hủy trong Google Play. Gói trọn đời trả một lần. Giá đang thử nghiệm.',
};

export function currentPeriod(now = Date.now()) {
  const d = new Date(now + 7 * 3600_000); // giờ Việt Nam
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`;
}

export function defaultState() {
  return {
    role: null,
    consent: { analytics: false },
    draft: {
      room: 'P203', period: '2026-11', inputType: 'meter', oldReading: '', newReading: '', kwh: '',
      meterReplaced: false, people: 3, declared: true, landlordValue: '', landlordUnit: 'perKwh',
    },
    split: { type: 'equal', people: [], extras: [] },
    payee: { bin: '', account: '', name: '' },
    history: [],
    house: { name: '', period: '2026-11', mode: 'B', evnTotal: '', rooms: [] },
    plan: { pro: false, period: null, extraRooms: 0 },
    ads: { lastInterstitialAt: 0, exportsDay: '', exportsCount: 0 },
    events: [],
  };
}

/** Đọc từ chuỗi localStorage; hỏng hoặc trống → trạng thái đầu. */
export function loadState(json) {
  if (!json) return defaultState();
  try {
    const raw = JSON.parse(json);
    const base = defaultState();
    return {
      ...base, ...raw,
      consent: { ...base.consent, ...raw.consent },
      draft: { ...base.draft, ...raw.draft },
      split: { ...base.split, ...raw.split },
      payee: { ...base.payee, ...raw.payee },
      house: { ...base.house, ...raw.house },
      plan: { ...base.plan, ...raw.plan },
      ads: { ...base.ads, ...raw.ads },
    };
  } catch {
    return defaultState();
  }
}

export const saveState = (state) => JSON.stringify(state);
export const wipeState = () => defaultState();

export function initialRoute(state) {
  if (state.role === 'tenant') return '#/nhap';
  if (state.role === 'landlord') return '#/nha-tro';
  return '#/chon-vai';
}

/** Ghi event analytics (giả lập Firebase) — chỉ khi đã đồng ý; bỏ khoá cấm; từ chối event ngoài tracking plan. */
export function track(state, name, params = {}, now = Date.now()) {
  if (!state.consent?.analytics || !EVENTS.includes(name)) return state;
  const clean = Object.fromEntries(Object.entries(params).filter(([k]) => !FORBIDDEN_KEYS.test(k)));
  return { ...state, events: [...state.events, { name, params: clean, at: now }].slice(-200) };
}

export function completeOnboarding(state, role, consent, now = Date.now()) {
  if (role !== 'tenant' && role !== 'landlord') throw new Error('Vai không hợp lệ');
  const s = { ...state, role, consent: { analytics: !!consent } };
  return track(s, 'onboarding_completed', { role }, now);
}

export const calculatedEvent = (r) => ({ mode: r.mode, kwh_bucket: kwhBucketOf(r.kwh), people_count: r.people });
function kwhBucketOf(kwh) {
  if (kwh <= 100) return '0-100';
  if (kwh <= 200) return '101-200';
  if (kwh <= 400) return '201-400';
  if (kwh <= 700) return '401-700';
  return '700+';
}
export const splitEvent = (split) => ({ split_type: split.type, people_count: split.people.length });
export const sharedEvent = ({ role, hasQr, channel }) => ({ role, has_vietqr: !!hasQr, channel });

/** Thêm/thay hóa đơn vào lịch sử: cùng phòng + kỳ + vai thì thay; mới nhất trước; tối đa 50. */
export function upsertHistory(history, bill, now = Date.now()) {
  const key = (b) => `${b.role ?? ''}|${b.room}|${b.period}`;
  const rest = history.filter((b) => key(b) !== key(bill));
  const entry = { ...bill, id: bill.id ?? `${now}-${Math.random().toString(36).slice(2, 7)}`, savedAt: now };
  return [entry, ...rest].slice(0, HISTORY_MAX);
}

// ---------------- Chủ trọ ----------------
export const roomLimit = (state) => (state.plan.pro ? Infinity : FREE_ROOMS + (state.plan.extraRooms || 0));
export const canAddRoom = (state) => state.house.rooms.length < roomLimit(state);

export function addRoom(state, room, now = Date.now()) {
  if (!canAddRoom(state)) return { ok: false, reason: 'limit', state };
  const id = `r${now}${state.house.rooms.length}`;
  const r = { id, name: room.name?.trim() || `P${101 + state.house.rooms.length}`, people: room.people ?? 1, declared: !!room.declared,
    oldReading: room.oldReading ?? '', newReading: room.newReading ?? '', replaced: false, paid: false };
  let s = { ...state, house: { ...state.house, rooms: [...state.house.rooms, r] } };
  s = track(s, 'room_added', { room_count: s.house.rooms.length }, now);
  return { ok: true, state: s, id };
}

export function updateRoom(state, id, patch) {
  return { ...state, house: { ...state.house, rooms: state.house.rooms.map((r) => (r.id === id ? { ...r, ...patch } : r)) } };
}

export function removeRoom(state, id) {
  return { ...state, house: { ...state.house, rooms: state.house.rooms.filter((r) => r.id !== id) } };
}

export const setRoomPaid = (state, id, paid) => updateRoom(state, id, { paid: !!paid });
export const unpaidRooms = (state) => state.house.rooms.filter((r) => !r.paid);

// ---------------- Pro & quảng cáo (giả lập, chế độ thử) ----------------
export function purchasePro(state, period, now = Date.now()) {
  const s = { ...state, plan: { ...state.plan, pro: true, period } };
  return track(s, 'purchase_completed', { plan: 'landlord_pro', period }, now);
}

export function grantRewardedRoom(state, now = Date.now()) {
  const s = { ...state, plan: { ...state.plan, extraRooms: (state.plan.extraRooms || 0) + 1 } };
  return track(s, 'ad_rewarded_completed', { placement: 'extra_room' }, now);
}

const dayOf = (now) => new Date(now + 7 * 3600_000).toISOString().slice(0, 10);

/** Quảng cáo xen kẽ trước khi xuất ảnh: không ở lần đầu trong ngày, tối đa 1 lần / 3 phút, không cho Pro. */
export function shouldShowInterstitial(ads, now, pro) {
  if (pro) return false;
  const countToday = ads.exportsDay === dayOf(now) ? ads.exportsCount : 0;
  if (countToday < 1) return false;
  return now - (ads.lastInterstitialAt || 0) >= INTERSTITIAL_GAP_MS;
}

export function recordExport(ads, now) {
  const day = dayOf(now);
  return { ...ads, exportsDay: day, exportsCount: (ads.exportsDay === day ? ads.exportsCount : 0) + 1 };
}

export const markInterstitial = (ads, now) => ({ ...ads, lastInterstitialAt: now });

// ---------------- Hóa đơn ----------------
/**
 * Dữ liệu cho ảnh hóa đơn (DOM và canvas cùng dùng).
 * Người thuê: QR tĩnh (mỗi người tự chuyển phần mình). Chủ trọ: QR có số tiền của phòng.
 */
export function invoiceModel({ role, room, period, oldReading, newReading, kwh, total, vatRate, splitLabel, people = [], extras = [], payee, pro, houseName }) {
  const note = toTransferNote(`${room} ${periodShort(period)} TIEN DIEN`);
  let qr = null;
  if (payee?.bin && payee?.account) {
    try {
      const payload = vietqrPayload({ bin: payee.bin, account: payee.account, amount: role === 'landlord' ? total : undefined, purpose: note });
      qr = {
        payload,
        caption: payee.name ? `Quét để chuyển cho ${payee.name}` : 'Quét để chuyển khoản',
        bankLine: `${bankName(payee.bin) || payee.bin} · ${payee.account}`,
        note,
      };
    } catch { qr = null; }
  }
  return {
    title: 'HÓA ĐƠN TIỀN ĐIỆN',
    houseName: pro && houseName ? houseName : '',
    heading: `Phòng ${room} · ${periodLabel(period)}`,
    readingLine: oldReading !== '' && newReading !== '' && oldReading != null ? `Chỉ số ${oldReading} → ${newReading}` : 'Số kWh nhập trực tiếp',
    kwhLine: `${formatNumber(kwh)} kWh`,
    priceLabel: `Giá bậc thang + VAT ${vatRate}%`,
    total,
    splitLabel: splitLabel ?? '',
    extras: extras.filter((e) => Number(e.amount) > 0).map((e) => ({ label: e.label?.trim() || 'Khoản khác', amount: Number(e.amount) })),
    lines: people.map((p) => ({ label: p.days != null ? `${p.name} · ${p.days} ngày` : p.name, amount: p.total })),
    qr,
    branding: pro ? null : 'Tính bằng Hóa Đơn Trọ · theo QĐ 2892/QĐ-BCT',
  };
}
