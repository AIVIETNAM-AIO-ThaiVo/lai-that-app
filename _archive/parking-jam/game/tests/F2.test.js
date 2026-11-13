// F2 — Chạm xe có đường trống thì xe rời bãi.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createState, tap } from '../logic.js';

test('xe B (đường xuống trống) rời bãi khi chạm', () => {
  const before = createState(0);
  const { state, result } = tap(before, 'B');
  assert.equal(result, 'exited');
  assert.ok(!state.cars.some((c) => c.id === 'B'));
  assert.equal(before.cars.length, 3, 'state cũ không được bị sửa');
});
