#!/usr/bin/env node
// ④ MEMORY — sổ trạng thái 4-memory/features.json. Chế độ duy nhất: model_led.
// Nội dung tính năng (tên, "Done when") lấy từ Wiki: 1-wiki/features/F*.md. Sổ này chỉ giữ TRẠNG THÁI.
//
//   Model (AI) được dùng:
//     node 4-memory/features.mjs sync               → đọc lại 1-wiki/features/*.md, giữ trạng thái cũ
//     node 4-memory/features.mjs brief              → xem việc: trạng thái + Done when của mọi tính năng
//     node 4-memory/features.mjs claim F2           → "đã làm, chưa chứng minh"  (⏳ → 🟡 claimed)
//     node 4-memory/features.mjs block F2 "lý do"   → bỏ cuộc sau 3 lần verify đỏ, ghi lý do  (→ ⛔)
//     node 4-memory/features.mjs note "đang làm F3" → ghi tiến độ vào progress.md
//   CHỈ Verification được dùng (Model KHÔNG gọi):
//     node 4-memory/features.mjs promote F2 --gate  → 🟡 claimed → ✅ passing, khi verify.sh xanh
import { readFileSync, readdirSync, writeFileSync, existsSync, appendFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(HERE, '..');
const FILE = path.join(HERE, 'features.json');
const PAGES = path.join(ROOT, '1-wiki', 'features');
const STATES = ['pending', 'claimed', 'passing', 'blocked'];
const ICON = { pending: '⏳', claimed: '🟡', passing: '✅', blocked: '⛔' };
const PROGRESS = path.join(HERE, 'progress.md');
const today = () => new Date().toISOString().slice(0, 10);
const note = (line) => appendFileSync(PROGRESS, `- ${today()} · ${line}\n`);

const load = () => (existsSync(FILE) ? JSON.parse(readFileSync(FILE, 'utf8')) : []);
const save = (list) => writeFileSync(FILE, `${JSON.stringify(list, null, 2)}\n`);
const num = (id) => Number(id.slice(1));

/** Đọc một trang feature: "# F5 — Tên" và các dòng "- [ ] …" dưới "## Done when". */
function readPage(file) {
  const text = readFileSync(path.join(PAGES, file), 'utf8');
  const head = text.match(/^#\s+(F\d+)\s+[—-]\s+(.+)$/m);
  if (!head) throw new Error(`${file}: dòng đầu phải dạng "# F5 — Tên tính năng"`);
  const section = text.split(/^##\s+Done when\s*$/m)[1] ?? '';
  const done = [...section.matchAll(/^- \[[ x]\]\s+(.+)$/gm)].map((m) => m[1].trim());
  if (done.length === 0) throw new Error(`${file}: thiếu mục "## Done when" với ít nhất một dòng "- [ ] …"`);
  return { id: head[1], title: head[2].trim(), page: `1-wiki/features/${file}`, done };
}

function sync() {
  const old = Object.fromEntries(load().map((f) => [f.id, f]));
  const pages = readdirSync(PAGES).filter((f) => /^F\d+.*\.md$/.test(f)).map(readPage).sort((a, b) => num(a.id) - num(b.id));
  const ids = new Set();
  for (const p of pages) {
    if (ids.has(p.id)) throw new Error(`trùng id ${p.id} trong 1-wiki/features/`);
    ids.add(p.id);
  }
  // Giữ trạng thái khi cùng id và cùng tên; tính năng đổi nghĩa thì làm lại từ đầu.
  const list = pages.map((p) => {
    const o = old[p.id];
    const same = o && o.title === p.title;
    return { ...p, state: same ? o.state : 'pending', ...(same && o.attempts ? { attempts: o.attempts } : {}), ...(same && o.verified_at ? { verified_at: o.verified_at } : {}) };
  });
  save(list);
  return list;
}

const find = (list, id) => {
  const f = list.find((x) => x.id === id);
  if (!f) { console.error(`Không có tính năng ${id}`); process.exit(1); }
  return f;
};

const [cmd, a, b, c] = process.argv.slice(2);
switch (cmd) {
  case 'sync':
    console.log(`Đã đồng bộ ${sync().length} tính năng từ 1-wiki/features/`);
    break;
  case 'list':
    for (const f of load()) console.log(`${ICON[f.state]} ${f.id.padEnd(4)} ${f.title}${f.state === 'blocked' && f.reason ? `  — ${f.reason}` : ''}`);
    break;
  case 'brief': {
    const list = load();
    const count = (s) => list.filter((f) => f.state === s).length;
    console.log(`model_led · ⏳ ${count('pending')} chờ · 🟡 ${count('claimed')} đã làm chưa chứng minh · ✅ ${count('passing')} đạt · ⛔ ${count('blocked')} bị chặn`);
    console.log('Bạn tự xếp thứ tự: phụ thuộc trước → quan trọng trước → theo số F.');
    for (const f of list) {
      console.log(`\n${ICON[f.state]} ${f.id} — ${f.title}  (${f.page})`);
      if (f.state !== 'passing') for (const d of f.done) console.log(`   - ${d}`);
    }
    break;
  }
  case 'show':
    console.log(JSON.stringify(find(load(), a), null, 2));
    break;
  case 'claim': {
    const list = load();
    const f = find(list, a);
    if (f.state === 'passing') { console.log(`${a} đã ✅ passing rồi.`); break; }
    f.state = 'claimed';
    save(list);
    note(`${a} 🟡 claimed (Model báo đã làm) — chờ verify.sh chứng minh`);
    console.log(`🟡 ${a} claimed. Chưa phải xong: chạy bash 3-verification/verify.sh để chứng minh.`);
    break;
  }
  case 'block': {
    if (!b) { console.error('Cần lý do: node 4-memory/features.mjs block F2 "lý do"'); process.exit(1); }
    const list = load();
    const f = find(list, a);
    f.state = 'blocked';
    f.reason = b;
    save(list);
    note(`${a} ⛔ blocked — ${b}`);
    console.log(`⛔ ${a} blocked. Nhớ ghi một dòng bài học vào 1-wiki/learned.md.`);
    break;
  }
  case 'note':
    note(a);
    break;
  case 'promote': {
    if (b !== '--gate') { console.error('⛔ Chỉ verify.sh được đánh dấu passing. Model: dùng claim rồi chạy bash 3-verification/verify.sh'); process.exit(1); }
    const list = load();
    const f = find(list, a);
    f.state = 'passing';
    f.verified_at = new Date().toISOString();
    save(list);
    note(`${a} ✅ passing (verify.sh xanh)`);
    break;
  }
  case 'reopen': {
    const list = load();
    const f = find(list, a);
    f.state = 'pending';
    delete f.reason;
    save(list);
    note(`${a} ⏳ mở lại`);
    break;
  }
  default:
    console.error('Dùng: sync | list | brief | show <id> | claim <id> | block <id> "lý do" | note "…" | reopen <id>');
    process.exit(1);
}
