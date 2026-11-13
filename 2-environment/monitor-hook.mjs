#!/usr/bin/env node
// Hook của Claude Code: mỗi lần bạn gõ, mỗi lần AI dùng công cụ, mỗi lần AI trả lời xong
// → ghi 1 dòng vào reports/monitor/events.jsonl để monitor (2-environment/monitor.mjs) hiện ra.
// Được gọi từ .claude/settings.json → "hooks". Không bao giờ làm hỏng phiên làm việc: lỗi gì cũng exit 0.
import { appendFileSync, copyFileSync, existsSync, mkdirSync, readFileSync, readdirSync, statSync, writeFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { spawn } from 'node:child_process';
import { connect } from 'node:net';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const OUT = path.join(ROOT, 'reports', 'monitor', 'events.jsonl');
const cut = (s, n) => { s = String(s ?? '').replace(/\s+/g, ' ').trim(); return s.length > n ? s.slice(0, n - 1) + '…' : s; };
const rel = (p) => { if (!p) return ''; const r = path.relative(ROOT, path.resolve(ROOT, p)); return r.startsWith('..') ? p : r.split(path.sep).join('/'); };

/** Đọc câu trả lời cuối của AI ở lượt NÀY từ transcript. Chỉ nhận câu có stop_reason end_turn
 *  (câu nói giữa chừng trước khi dùng công cụ là tool_use); gặp lời người dùng trước thì là câu cuối chưa ghi xong → ''. */
export function lastAssistantText(file) {
  try {
    const lines = readFileSync(file, 'utf8').trim().split('\n').reverse();
    for (const l of lines) {
      let e;
      try { e = JSON.parse(l); } catch { continue; }  // dòng cuối có thể đang ghi dở
      const c = e.message?.content;
      if (e.type === 'user' && !(Array.isArray(c) && c.some((x) => x.type === 'tool_result'))) return '';
      if (e.type !== 'assistant' || e.message?.stop_reason !== 'end_turn') continue;
      const t = (e.message?.content ?? []).filter((c) => c.type === 'text').map((c) => c.text).join('\n').trim();
      if (t) return t;
    }
  } catch { /* không có transcript thì thôi */ }
  return '';
}

/** Lời AI viết ngay trước lần dùng công cụ này (ví dụ "Tìm ra lỗi: … Đang sửa."), đọc từ transcript. */
export function narration(file) {
  try {
    const lines = readFileSync(file, 'utf8').trim().split('\n').reverse();
    const texts = [];
    let seenAssistant = false;
    for (const l of lines) {
      const e = JSON.parse(l);
      if (e.type === 'user') { if (seenAssistant) break; continue; }
      if (e.type !== 'assistant') continue;
      seenAssistant = true;
      const t = (e.message?.content ?? []).filter((c) => c.type === 'text').map((c) => c.text).join(' ').trim();
      if (t) texts.unshift(t);
    }
    return cut(texts.join(' '), 400);
  } catch { return ''; }
}

/** Monitor tự mở: nếu chưa có monitor chạy ở cổng 5180 thì bật (nó tự mở trình duyệt). Tắt bằng MONITOR_AUTO=0. */
async function ensureMonitor() {
  if (process.env.MONITOR_AUTO === '0') return;
  const port = Number(process.env.MONITOR_PORT ?? 5180);
  const up = await new Promise((r) => { const c = connect(port, '127.0.0.1'); c.on('connect', () => { c.destroy(); r(true); }); c.on('error', () => r(false)); setTimeout(() => { c.destroy(); r(false); }, 400); });
  if (up) return;
  spawn(process.execPath, [path.join(ROOT, '2-environment', 'monitor.mjs'), '--port', String(port)], { cwd: ROOT, detached: true, stdio: 'ignore' }).unref();
}

/** Code cũ → code mới, bất kể AI sửa bằng công cụ gì: giữ bản sao các file code trong reports/monitor/cache,
 *  sau mỗi lần AI dùng công cụ thì so file hiện tại với bản sao, lấy đoạn khác nhau. */
const CODE_EXT = /\.(js|mjs|py|html|css|json)$/;
/** Thư mục code của dự án đang theo dõi: <phiên>/monitor.json → codeDirs; không có thì là game/. */
function codeDirs() {
  try {
    const id = readFileSync(path.join(ROOT, 'reports', 'monitor', 'session'), 'utf8').trim();
    return JSON.parse(readFileSync(path.join(ROOT, id, 'monitor.json'), 'utf8')).codeDirs.map((d) => `${id}/${d}`);
  } catch { return ['game']; }
}
function codeFiles(dir) {
  const out = [];
  const walk = (d) => {
    let ents = [];
    try { ents = readdirSync(path.join(ROOT, d), { withFileTypes: true }); } catch { return; }
    for (const e of ents) {
      const r = `${d}/${e.name}`;
      if (e.isDirectory()) { if (!/^(vendor|assets|node_modules|__pycache__)$/.test(e.name)) walk(r); }
      else if (CODE_EXT.test(e.name)) out.push(r);
    }
  };
  walk(dir);
  return out;
}
export function hunk(oldText, newText, max = 14) {
  const a = oldText.split('\n'), b = newText.split('\n');
  let p = 0; while (p < a.length && p < b.length && a[p] === b[p]) p++;
  let q = 0; while (q < a.length - p && q < b.length - p && a[a.length - 1 - q] === b[b.length - 1 - q]) q++;
  const del = a.slice(p, a.length - q), add = b.slice(p, b.length - q);
  const clip = (xs) => (xs.length > max ? [...xs.slice(0, max), `… (+${xs.length - max} more lines)`] : xs);
  return { line: p + 1, old: clip(del).join('\n'), new: clip(add).join('\n'), removed: del.length, added: add.length };
}
function codeDiffs() {
  const cache = path.join(ROOT, 'reports', 'monitor', 'cache');
  const diffs = [];
  for (const dir of codeDirs()) {
    const first = !existsSync(path.join(cache, dir));
    for (const f of codeFiles(dir)) {
      const cur = readFileSync(path.join(ROOT, f), 'utf8');
      const c = path.join(cache, f);
      const prev = existsSync(c) ? readFileSync(c, 'utf8') : null;
      if (prev === cur) continue;
      mkdirSync(path.dirname(c), { recursive: true });
      writeFileSync(c, cur);
      if (first) continue;  // lần đầu chỉ chụp lại hiện trạng
      diffs.push(prev == null ? { file: f, created: cur.split('\n').length } : { file: f, ...hunk(prev, cur) });
    }
  }
  return diffs;
}

/** Chụp lại ảnh AI vừa xem (file gốc sẽ bị ghi đè ở lần chạy bot sau) → reports/monitor/img/<hash>. */
function snapImage(relPath) {
  try {
    const src = path.join(ROOT, relPath);
    const buf = readFileSync(src);
    const name = createHash('sha1').update(buf).digest('hex').slice(0, 16) + path.extname(src);
    const dir = path.join(ROOT, 'reports', 'monitor', 'img');
    mkdirSync(dir, { recursive: true });
    if (!existsSync(path.join(dir, name))) copyFileSync(src, path.join(dir, name));
    return `reports/monitor/img/${name}`;
  } catch { return null; }
}

/** Ảnh bot chụp ở lần chạy vừa xong (để so "trước / sau" khi AI sửa giao diện). */
function botShots() {
  try {
    const rep = JSON.parse(readFileSync(path.join(ROOT, 'reports', 'latest', 'report.json'), 'utf8'));
    return (rep.shots ?? []).map((x) => ({ file: x.file, label: x.label, snap: snapImage(`reports/latest/${x.file}`) })).filter((x) => x.snap);
  } catch { return []; }
}

/** Các thay thế `sed s|cũ|mới|` trong lệnh, gắn với file ở cuối mỗi dòng lệnh → hiện "code cũ → code mới". */
export function sedChanges(cmd) {
  const out = [];
  for (const line of cmd.split(/\n|&&|;(?=\s*sed)/)) {
    if (!/\bsed\s+-i/.test(line)) continue;
    const file = (line.match(/((?:game|1-wiki|2-environment)\/[\w./-]+)\s*$/) ?? line.match(/((?:game)\/[\w./-]+\.(?:js|mjs|html|css))/) ?? [])[1] ?? '';
    for (const m of line.matchAll(/\bs([|\/#])((?:\\.|(?!\1).)*)\1((?:\\.|(?!\1).)*)\1/g))
      out.push({ file, old: m[2].replace(/\\n/g, '\n').replace(/\\(.)/g, '$1'), new: m[3].replace(/\\n/g, '\n').replace(/\\(.)/g, '$1') });
  }
  return out;
}

/** Một lệnh Bash có thể làm nhiều việc (viết file + chạy bot) → trả về nhiều nhãn. */
export function bashLabels(cmd) {
  const out = [];
  if (READ_ONLY.test(cmd.trim())) {
    // Lệnh chỉ để ĐỌC (ls, cat, head…): ghi tên các file AI đang đọc
    const files = [...new Set(cmd.split(/[;&|\n]+/).flatMap((part) => part.trim().split(/\s+/).slice(1))
      .filter((w) => /[\/.]/.test(w) && !w.startsWith('-') && !/^\d+$/.test(w)).map((w) => w.replace(/^["']|["']$/g, '')))];
    return [{ kind: 'read', text: `Đọc: ${cut(files.join(', ') || cmd, 90)}` }];
  }
  for (const m of cmd.matchAll(/cat\s*>+\s*([^\s<;&|]+)\s*<</g)) {
    const f = m[1];
    out.push(/1-wiki\//.test(f) ? { kind: 'wiki', text: `Viết Wiki: ${f.replace(/^.*1-wiki\//, '')}` }
      : /4-memory\//.test(f) ? { kind: 'memory', text: `Ghi sổ: ${f.replace(/^.*4-memory\//, '')}` }
      : { kind: 'code', text: `Viết code: ${f.replace(/^.*\/game\//, 'game/')}` });
  }
  if (/(bash|sh)\s+\S*verify\.sh|\.\/\S*verify\.sh/.test(cmd)) out.push({ kind: 'verify', text: 'Chạy máy chấm verify.sh' });
  else {
    if (/node --test|-m pytest|\bpytest\b/.test(cmd)) out.push({ kind: 'test', text: 'Chạy unit test' });
    if (/-m app\.cli\b/.test(cmd)) out.push({ kind: 'pipeline', text: `Chạy app: ${cut(cmd.match(/app\.cli\b(.*)/)[1], 70)}` });
    if (/node\s+\S*bot\.mjs/.test(cmd)) out.push({ kind: 'bot', text: /--look/.test(cmd) ? 'Bot chụp 1 ảnh để AI nhìn' : 'Bot mở Chrome, tự chơi game' });
  }
  if (/new-game\.sh/.test(cmd)) out.push({ kind: 'newgame', text: 'Bắt đầu game mới, cất game cũ vào examples/' });
  if (/get-asset\.sh/.test(cmd)) out.push({ kind: 'asset', text: `Lấy icon: ${[...cmd.matchAll(/get-asset\.sh\s+\S+\s+(\S+)/g)].map((m) => m[1]).join(', ') || 'kho icon'}` });
  for (const m of cmd.matchAll(/features\.mjs\s+(claim|block|note|promote)\s+("[^"]*"|\S+)/g)) out.push({ kind: 'memory', text: `Ghi sổ: ${m[1]} ${m[2].replace(/^"|"$/g, '')}` });
  if (/sed -i|python3 -|perl -pi/.test(cmd) && /game\//.test(cmd)) {
    const files = [...new Set([...cmd.matchAll(/(game\/[\w./-]+\.(?:js|mjs|html|css))/g)].map((m) => m[1]))];
    const changes = sedChanges(cmd);
    out.push({ kind: 'code', text: `Sửa code: ${files.join(', ') || 'game/'}`, files, ...(changes.length ? { changes } : {}) });
  }
  if (!out.length) out.push({ kind: 'shell', text: `Chạy lệnh: ${cut(cmd.split('\n')[0], 90)}` });
  return out;
}

const READ_ONLY = /^((ls|cat|head|tail|wc|grep|find|tree|echo|sed -n)\b[^;&|\n]*([;&|\n]+\s*|$))+$/;

/** Đọc kết quả chạy test / bot / máy chấm từ output → để monitor hiện đỏ hay xanh. */
export function result(kind, text) {
  const lastOf = (re) => [...text.matchAll(re)].pop();  // nhiều lần chạy trong một lệnh → lấy kết quả cuối
  const pass = lastOf(/(?:ℹ|#) pass (\d+)/g), fail = lastOf(/(?:ℹ|#) fail (\d+)/g);
  const fails = [...new Set([...text.matchAll(/^\s*not ok \d+ - (.+)$/gm), ...text.matchAll(/^\s*✖ (.+?)(?: \([\d.]+m?s\))?$/gm), ...text.matchAll(/✗ (.+)$/gm)]
    .map((m) => cut(m[1], 160)).filter((n) => !/^(tests?|failing tests:?)$/i.test(n)))].slice(0, 8);
  const withFails = (r) => (r.ok || !fails.length ? r : { ...r, fails });
  if (kind === 'verify') { if (/🟢 XANH/.test(text)) return { ok: true, res: 'PASS' }; if (/🔴 ĐỎ/.test(text)) return withFails({ ok: false, res: 'FAIL' }); }
  if (kind === 'bot') { if (/🟢 Automation test/.test(text)) return { ok: true, res: 'pass' }; if (/🔴 Automation test/.test(text)) return withFails({ ok: false, res: 'fail' }); }
  if (kind === 'test' && !pass) {  // pytest: "2 failed, 70 passed in 3.1s" (có thể không có "failed" hoặc "passed")
    const summary = lastOf(/^[=\s]*((?:\d+ (?:failed|passed|errors?|skipped)(?:, )?)+) in [\d.]+s/gm);
    if (summary) {
      const count = (w) => Number(summary[1].match(new RegExp(`(\\d+) ${w}`))?.[1] ?? 0);
      const p = count('passed'), f = count('failed') + count('error');
      const pyFails = [...text.matchAll(/^(?:FAILED|ERROR) (\S+)/gm)].map((m) => cut(m[1], 160)).slice(0, 8);
      const r = { ok: f === 0, res: f ? `${f} fail · ${p} pass` : `${p}/${p} pass`, pass: p, fail: f };
      return f && pyFails.length ? { ...r, fails: pyFails } : r;
    }
  }
  if (kind === 'test' && pass && fail) {
    const p = Number(pass[1]), f = Number(fail[1]);
    return withFails({ ok: f === 0, res: f ? `${f} fail · ${p} pass` : `${p}/${p} pass`, pass: p, fail: f });
  }
  return null;
}

function labels(ev) {
  const i = ev.tool_input ?? {};
  const name = ev.tool_name ?? '';
  if (name === 'Bash' || name === 'PowerShell') {
    // PostToolUse: tool_response {stdout, stderr}. PostToolUseFailure (lệnh thoát mã lỗi, ví dụ verify.sh ĐỎ): error.
    const r = ev.tool_response ?? {};
    const outText = [typeof r === 'string' ? r : `${r.stdout ?? ''}\n${r.stderr ?? ''}`, typeof ev.error === 'string' ? ev.error : JSON.stringify(ev.error ?? '')].join('\n');
    return bashLabels(String(i.command ?? '')).map((it) => ({ ...it, ...(result(it.kind, outText) ?? {}) }));
  }
  if (name === 'Read') {
    const f = rel(i.file_path);
    if (!/\.(png|jpe?g|webp)$/i.test(f)) return [{ kind: 'read', text: `Đọc: ${f}` }];
    return [{ kind: 'look', text: `AI mở ảnh ra xem: ${f}`, image: f, file: path.basename(f), snap: snapImage(f) }];
  }
  if (name === 'Write' || name === 'Edit' || name === 'MultiEdit') {
    const f = rel(i.file_path);
    const kind = /^(1-wiki|[^/]+\/wiki)\//.test(f) ? 'wiki' : f.startsWith('4-memory/') ? 'memory' : 'code';
    const changes = name === 'Edit' ? [{ file: f, old: String(i.old_string ?? '').slice(0, 600), new: String(i.new_string ?? '').slice(0, 600) }]
      : name === 'MultiEdit' ? (i.edits ?? []).map((x) => ({ file: f, old: String(x.old_string ?? '').slice(0, 600), new: String(x.new_string ?? '').slice(0, 600) }))
      : [{ file: f, write: String(i.content ?? '').split('\n').length }];
    return [{ kind, text: `${name === 'Write' ? 'Viết' : 'Sửa'} ${kind === 'wiki' ? 'Wiki' : kind === 'memory' ? 'sổ' : 'code'}: ${f}`, files: [f], changes }];
  }
  if (name === 'Skill') return [{ kind: 'skill', text: `Dùng hướng dẫn: /${i.skill ?? i.command ?? ''}`.trim() }];
  if (name.startsWith('mcp__playwright')) return [{ kind: 'browser', text: `Trình duyệt (MCP): ${name.replace('mcp__playwright__', '')}` }];
  if (name.startsWith('mcp__')) return [{ kind: 'mcp', text: `Công cụ MCP: ${name.replace(/^mcp__/, '')}` }];
  if (name === 'ToolSearch') return [{ kind: 'read', text: 'Tìm công cụ phù hợp' }];
  if (name === 'Glob' || name === 'Grep') return [{ kind: 'read', text: `Tìm: ${cut(i.pattern, 60)}` }];
  return [{ kind: 'other', text: name }];
}

if (process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1])) try {
  let raw = '';
  for await (const chunk of process.stdin) raw += chunk;
  const ev = JSON.parse(raw || '{}');
  const t = Date.now();
  let rec = null;
  if (ev.hook_event_name === 'UserPromptSubmit') { codeDiffs(); await ensureMonitor(); rec = { t, type: 'user', text: cut(ev.prompt, 400) }; }
  else if (ev.hook_event_name === 'PostToolUse' || ev.hook_event_name === 'PostToolUseFailure') {
    const items = labels(ev).map((it) => ((it.kind === 'verify' || (it.kind === 'bot' && !/ảnh/.test(it.text))) && it.res != null ? { ...it, shots: botShots() } : it));
    rec = { t, type: 'tool', tool: ev.tool_name, items };
    const diffs = codeDiffs();
    if (diffs.length) rec.diffs = diffs;
    if (ev.tool_input?.description) rec.desc = cut(ev.tool_input.description, 200);
    const note = narration(ev.transcript_path);
    if (note) rec.note = note;
  }
  else if (ev.hook_event_name === 'Stop') {
    // Ưu tiên câu Claude Code đưa thẳng cho hook. Không có thì đọc transcript —
    // transcript có khi chưa ghi xong câu cuối lúc Stop chạy → đợi rồi đọc lại (tối đa ~3 giây).
    const given = typeof ev.last_assistant_message === 'string' ? ev.last_assistant_message.trim() : '';
    let text = given || lastAssistantText(ev.transcript_path);
    for (let k = 0; k < 15 && !text; k++) { await new Promise((r) => setTimeout(r, 200)); text = lastAssistantText(ev.transcript_path); }
    if (text) rec = { t, type: 'ai', text: text.slice(0, 4000) };
  }
  if (rec) {
    mkdirSync(path.dirname(OUT), { recursive: true });
    appendFileSync(OUT, JSON.stringify(rec) + '\n');
  }
} catch (e) { if (process.env.MONITOR_DEBUG) console.error(e); /* monitor là phụ: không bao giờ chặn AI */ }
if (process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1])) process.exit(0);
