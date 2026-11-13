// F1 — Bãi xe: lưới 6×6, xe của level hiện tại nằm trong bãi và không chồng lên nhau.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { SIZE, LEVELS, createState, cells } from '../logic.js';

test('bãi xe là lưới 6×6', () => {
  assert.equal(SIZE, 6);
});

test('mọi xe của mọi level nằm trong bãi và không chồng nhau', () => {
  LEVELS.forEach((_, i) => {
    const seen = new Set();
    for (const car of createState(i).cars) {
      for (const [x, y] of cells(car)) {
        assert.ok(x >= 0 && y >= 0 && x < SIZE && y < SIZE, `level ${i + 1}: xe ${car.id} ra ngoài bãi`);
        assert.ok(!seen.has(`${x},${y}`), `level ${i + 1}: xe ${car.id} chồng lên xe khác ở ô ${x},${y}`);
        seen.add(`${x},${y}`);
      }
    }
  });
});

test('mỗi xe dài 2 hoặc 3 ô và có hướng chạy', () => {
  for (const car of createState(0).cars) {
    assert.ok([2, 3].includes(car.len));
    assert.ok(['left', 'right', 'up', 'down'].includes(car.dir));
  }
});
