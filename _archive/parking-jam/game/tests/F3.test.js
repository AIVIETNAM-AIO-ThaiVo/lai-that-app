// F3 — Chạm xe bị chặn thì xe đứng yên, số xe không đổi.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createState, tap } from '../logic.js';

test('xe A bị xe B chặn nên không đi', () => {
  const before = createState(0);
  const { state, result } = tap(before, 'A');
  assert.equal(result, 'blocked');
  assert.equal(state.cars.length, before.cars.length);
});

test('B đi rồi thì A hết bị chặn', () => {
  const s1 = tap(createState(0), 'B').state;
  assert.equal(tap(s1, 'A').result, 'exited');
});
