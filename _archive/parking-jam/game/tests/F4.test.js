// F4 — Hết xe thì level hoàn thành. Mọi level đều phải giải được.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { LEVELS, createState, tap, canExit, isComplete } from '../logic.js';

function solve(state) {
  for (let guard = 0; guard < 50 && !isComplete(state); guard++) {
    const car = state.cars.find((c) => canExit(state, c.id));
    if (!car) return state;
    state = tap(state, car.id).state;
  }
  return state;
}

test('level mới chưa hoàn thành', () => {
  assert.equal(isComplete(createState(0)), false);
});

test('mọi level giải được tới khi hết xe', () => {
  LEVELS.forEach((_, i) => assert.ok(isComplete(solve(createState(i))), `level ${i + 1} không giải được`));
});
