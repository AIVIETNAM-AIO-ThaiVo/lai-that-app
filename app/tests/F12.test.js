// F12 — Tracking theo docs/TRACKING_PLAN.md (1-wiki/features/F12-tracking.md)
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { EVENTS, EVENT_PARAMS, track, defaultState, marginBucket, calcTracker } from '../store.js';

const plan = readFileSync(path.join(path.dirname(fileURLToPath(import.meta.url)), '..', '..', 'docs', 'TRACKING_PLAN.md'), 'utf8');
const rows = [...plan.matchAll(/^\| `([a-z_]+)` \|[^|]*\|([^|]*)\|/gm)].map((m) => ({ name: m[1], params: [...m[2].matchAll(/`([a-z_]+)`/g)].map((x) => x[1]) }));

test('danh sách sự kiện đúng bằng TRACKING_PLAN.md', () => {
  assert.ok(rows.length >= 20);
  assert.deepEqual([...EVENTS].sort(), rows.map((r) => r.name).sort());
  for (const r of rows) assert.deepEqual([...EVENT_PARAMS[r.name]].sort(), [...r.params].sort(), r.name);
});

test('từ chối sự kiện lạ, bỏ thuộc tính ngoài plan (không giá, giá vốn, tên)', () => {
  assert.equal(track(defaultState(), 'su_kien_la', {}, 1).events.length, 0);
  const s = track(defaultState(), 'product_saved', { catalog_size: 3, state: 'loss', price: 17000, cost: 8000, name: 'Móc khóa' }, 1);
  assert.deepEqual(s.events[0].params, { catalog_size: 3, state: 'loss' });
});

test('margin_bucket', () => {
  assert.equal(marginBucket(-0.01), '<0');
  assert.equal(marginBucket(0.03), '0–5');
  assert.equal(marginBucket(0.05), '5–10');
  assert.equal(marginBucket(0.1), '10–20');
  assert.equal(marginBucket(0.2), '10–20');
  assert.equal(marginBucket(0.21), '>20');
});

test('calc_completed: 1 lần cho một bộ đầu vào, sau khi ngừng gõ 1,5 giây', () => {
  const t = calcTracker(1500);
  t.input('a', 0);
  assert.equal(t.due(1000), null);
  t.input('b', 1200);
  assert.equal(t.due(2600), null);
  assert.equal(t.due(2700), 'b');
  assert.equal(t.due(5000), null, 'không ghi lại cùng bộ đầu vào');
  t.input('b', 6000);
  assert.equal(t.due(8000), null, 'cùng bộ đầu vào đã ghi');
  t.input('c', 9000);
  assert.equal(t.due(10500), 'c');
});
