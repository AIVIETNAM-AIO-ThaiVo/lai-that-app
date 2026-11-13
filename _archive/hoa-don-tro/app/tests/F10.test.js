// F10 — Chủ trọ: danh sách phòng, hóa đơn hàng loạt, đã thu (1-wiki/features/F10-chu-tro-nhieu-phong.md)
import { test } from 'node:test';
import assert from 'node:assert/strict';
import tariff from '../tariff-default.json' with { type: 'json' };
import { allocateTotal, houseSummary, rollMonth, nextPeriod } from '../logic.js';
import { defaultState, addRoom, setRoomPaid, canAddRoom, unpaidRooms, completeOnboarding } from '../store.js';

const room = (name, people, n) => ({ name, people, declared: false, oldReading: '0', newReading: String(n) });

function threeRooms(consent = false) {
  let s = completeOnboarding(defaultState(), 'landlord', consent, 1);
  for (const r of [room('P101', 3, 245), room('P102', 2, 180), room('P103', 1, 96)]) s = addRoom(s, r, 2).state;
  return s;
}

test('chủ trọ lần đầu: chưa có phòng, chế độ mặc định B', () => {
  const s = completeOnboarding(defaultState(), 'landlord', false, 1);
  assert.equal(s.house.rooms.length, 0);
  assert.equal(s.house.mode, 'B');
});

test('3 phòng chế độ B → 605.669 · 444.982 · 237.324, tổng 1.287.975', () => {
  const s = threeRooms();
  const sum = houseSummary(s.house, tariff);
  assert.deepEqual(sum.rooms.map((r) => r.total), [605669, 444982, 237324]);
  assert.equal(sum.total, 1287975);
  assert.equal(sum.count, 3);
});

test('đánh dấu đã thu P101 → Đã thu 1/3, 605.669đ', () => {
  let s = threeRooms();
  s = setRoomPaid(s, s.house.rooms[0].id, true);
  const sum = houseSummary(s.house, tariff);
  assert.equal(sum.paidCount, 1);
  assert.equal(sum.collected, 605669);
  assert.equal(unpaidRooms(s).length, 2);
});

test('gói miễn phí tối đa 3 phòng', () => {
  const s = threeRooms();
  assert.equal(canAddRoom(s), false);
  const r = addRoom(s, room('P104', 1, 50), 3);
  assert.equal(r.ok, false);
  assert.equal(r.reason, 'limit');
  assert.equal(r.state.house.rooms.length, 3);
});

test('chế độ C: chia hóa đơn tổng theo kWh, tổng đúng bằng hóa đơn', () => {
  const parts = allocateTotal(1000000, [245, 180, 96]);
  assert.deepEqual(parts.slice(0, 2), [470250, 345489]);
  assert.equal(parts.reduce((a, b) => a + b, 0), 1000000);
  const s = threeRooms();
  const sum = houseSummary({ ...s.house, mode: 'C', evnTotal: 1000000 }, tariff);
  assert.equal(sum.total, 1000000);
});

test('chế độ A trong nhà trọ: theo số người từng phòng', () => {
  const s = threeRooms();
  const house = { ...s.house, mode: 'A', rooms: s.house.rooms.map((r) => ({ ...r, declared: true })) };
  const sum = houseSummary(house, tariff);
  assert.equal(sum.rooms[0].kwh, 245);
  assert.ok(sum.rooms[0].total > 0);
});

test('sang tháng mới: chỉ số mới → cũ, xoá đã thu, kỳ +1', () => {
  let s = threeRooms();
  s = setRoomPaid(s, s.house.rooms[0].id, true);
  const h = rollMonth({ ...s.house, period: '2026-12' });
  assert.equal(h.period, '2027-01');
  assert.deepEqual(h.rooms.map((r) => r.oldReading), ['245', '180', '96']);
  assert.ok(h.rooms.every((r) => r.newReading === '' && r.paid === false));
  assert.equal(nextPeriod('2026-11'), '2026-12');
});

test('event room_added có room_count', () => {
  const s = threeRooms(true);
  const ev = s.events.filter((e) => e.name === 'room_added');
  assert.deepEqual(ev.map((e) => e.params.room_count), [1, 2, 3]);
});
