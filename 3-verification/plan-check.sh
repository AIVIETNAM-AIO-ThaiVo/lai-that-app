#!/usr/bin/env bash
# ③ VERIFICATION cho Harness Plan — Wiki đã "đủ để build" chưa? (kiểm tự động, không cần AI)
#   bash 3-verification/plan-check.sh
# Thoát 0 = 🟢 đủ. Khác 0 = 🔴 còn thiếu, in ra thiếu gì.
set -u
cd "$(dirname "$0")/.."
node - <<'EOF'
const fs = require('fs');
const path = require('path');
const W = '1-wiki';
const read = (p) => (fs.existsSync(p) ? fs.readFileSync(p, 'utf8') : '');
const checks = [];
const check = (name, ok, detail = '') => checks.push({ name, ok, detail });

const ov = read(path.join(W, 'overview.md')).toLowerCase();
check('overview.md có nội dung', ov.replace(/[#\s(]/g, '').length > 200 && !ov.includes('/game sẽ viết'));
check('overview: nói rõ cho ai', /cho ai|người chơi|đối tượng/.test(ov));
check('overview: vòng chơi chính (người chơi làm gì)', /vòng chơi|chơi thế nào|mỗi lượt|người chơi (bấm|chạm|kéo|gõ)/.test(ov));
check('overview: thắng / thua / kết thúc', /thắng|thua|kết thúc|hết giờ|game over/.test(ov));
check('overview: điều khiển', /điều khiển|bấm|chạm|kéo|phím/.test(ov));

const fdir = path.join(W, 'features');
const pages = fs.existsSync(fdir) ? fs.readdirSync(fdir).filter((f) => /^F\d+.*\.md$/.test(f)) : [];
check('có 3–8 tính năng', pages.length >= 3 && pages.length <= 8, `${pages.length} trang`);
const weak = [];
for (const p of pages) {
  const t = read(path.join(fdir, p));
  const head = /^#\s+F\d+\s+[—-]\s+.+$/m.test(t);
  const done = (t.split(/^##\s+Done when\s*$/m)[1] || '').match(/^- \[[ x]\]\s+.+$/gm) || [];
  const vague = done.filter((d) => /\b(đẹp|tốt|mượt|hợp lý|phù hợp|nhanh)\b/i.test(d) && !/\d/.test(d));
  if (!head || done.length < 2 || vague.length) weak.push(`${p}${!head ? ' (sai dòng đầu)' : ''}${done.length < 2 ? ' (Done when < 2)' : ''}${vague.length ? ' (Done when mơ hồ)' : ''}`);
}
check('mỗi tính năng có ≥ 2 dòng Done when đo được', pages.length > 0 && weak.length === 0, weak.slice(0, 3).join(', '));

const sdir = path.join(W, 'screens');
check('có ít nhất 1 trang màn hình', fs.existsSync(sdir) && fs.readdirSync(sdir).some((f) => f.endsWith('.md')));

const st = read(path.join(W, 'design', 'style.md'));
const colors = (st.match(/#[0-9a-fA-F]{6}\b/g) || []).length;
check('design/style.md: có 5 màu', colors >= 5, `${colors} mã màu`);
check('design/style.md: có font Google Fonts', /fonts\.googleapis\.com|google fonts/i.test(st));

const all = [ov, ...pages.map((p) => read(path.join(fdir, p)))].join('\n');
check('không còn TODO / ??? trong Wiki', !/\bTODO\b|\?\?\?/.test(all));

let fail = 0;
console.log('┌─ PLAN CHECK · Wiki đủ để build chưa?');
for (const c of checks) {
  console.log(`│ ${c.ok ? '✓' : '✗'} ${c.name}${c.detail ? ` — ${c.detail}` : ''}`);
  if (!c.ok) fail = 1;
}
console.log(fail ? '└─ 🔴 Còn thiếu: bổ sung Wiki rồi chạy lại' : '└─ 🟢 Wiki đủ để build');
process.exit(fail);
EOF
