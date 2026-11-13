// Đọc đặc tả tracking docs/tracking_plan.csv (nguồn duy nhất cho tên sự kiện + thuộc tính). Không phải test.
// Cột: event, when, properties (tên cách nhau bởi "; "), values (giá trị cho phép, chữ tự do).
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export const PLAN_FILE = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', '..', 'docs', 'tracking_plan.csv');

/** CSV theo RFC 4180 (ngoặc kép, "" bên trong). */
export function parseCsv(text) {
  const rows = [];
  let row = [];
  let cell = '';
  let q = false;
  const s = text.replace(/^﻿/, '');
  for (let i = 0; i < s.length; i += 1) {
    const ch = s[i];
    if (q) {
      if (ch === '"' && s[i + 1] === '"') { cell += '"'; i += 1; } else if (ch === '"') q = false; else cell += ch;
    } else if (ch === '"') q = true;
    else if (ch === ',') { row.push(cell); cell = ''; }
    else if (ch === '\n' || ch === '\r') {
      if (ch === '\r' && s[i + 1] === '\n') i += 1;
      row.push(cell); cell = '';
      if (row.some((c) => c !== '')) rows.push(row);
      row = [];
    } else cell += ch;
  }
  row.push(cell);
  if (row.some((c) => c !== '')) rows.push(row);
  return rows;
}

/** { rows: [{ event, when, properties: [..], values }], byName: Map } */
export function readPlan(file = PLAN_FILE) {
  const [head, ...body] = parseCsv(readFileSync(file, 'utf8'));
  const idx = Object.fromEntries(head.map((h, i) => [h.trim(), i]));
  const rows = body.map((r) => ({
    event: r[idx.event].trim(),
    when: r[idx.when] ?? '',
    properties: (r[idx.properties] ?? '').split(';').map((x) => x.trim()).filter(Boolean),
    values: r[idx.values] ?? '',
  }));
  return { rows, byName: new Map(rows.map((r) => [r.event, r])) };
}
