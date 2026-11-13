#!/usr/bin/env node
// MONITOR — xem harness làm việc TRỰC TIẾP: Wiki · Environment · Verification · Memory.
//   node 2-environment/monitor.mjs              → http://localhost:5180, tự cập nhật khi AI làm việc
//   node 2-environment/monitor.mjs --replay     → mở thẳng bản phát lại mẫu (không cần AI, không cần mạng)
//   node 2-environment/monitor.mjs --project comic-narrator → theo dõi dự án trong thư mục con có monitor.json (nhớ cho các lần sau)
//   --dir <thư mục harness khác> · --port 5180 · --no-open
// Tự mở: hook 2-environment/monitor-hook.mjs bật monitor khi bạn gõ yêu cầu đầu tiên (tắt: MONITOR_AUTO=0).
// Nhiều game: mỗi game (mỗi lần /game → new-game.sh) được ghi thành một phiên trong reports/monitor/sessions/<id>/;
// trên monitor chọn game ở ô "Game" để xem lại. Bản mẫu nằm ở 2-environment/monitor-replay/.
// 4 ô = 4 thành phần; bấm ô để xem chi tiết. Verification liệt kê lỗi đã bắt, ảnh trước/sau, code AI đã sửa.
// Hành động của AI (gõ, dùng công cụ, trả lời) do hook ghi vào reports/monitor/events.jsonl. Chỉ cần Node 22.
import { createServer } from 'node:http';
import { spawn } from 'node:child_process';
import { createHash } from 'node:crypto';
import { appendFileSync, copyFileSync, existsSync, mkdirSync, readdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const arg = (k, d) => { const i = process.argv.indexOf(k); return i > 0 && process.argv[i + 1] && !process.argv[i + 1].startsWith('--') ? process.argv[i + 1] : d; };
const has = (k) => process.argv.includes(k);
const ROOT = path.resolve(arg('--dir', path.join(HERE, '..')));
const PORT = Number(arg('--port', process.env.PORT ?? 5180));
const SAMPLE = path.resolve(has('--replay') ? arg('--replay', path.join(HERE, 'monitor-replay')) : path.join(HERE, 'monitor-replay'));
const START_REPLAY = has('--replay');
const SESSIONS = path.join(ROOT, 'reports', 'monitor', 'sessions');
/** Phiên đang chạy: new-game.sh ghi id vào reports/monitor/session; chưa có thì dùng "game". */
const sessionId = () => { try { return readFileSync(path.join(ROOT, 'reports', 'monitor', 'session'), 'utf8').trim().replace(/[^\w.-]/g, '') || 'game'; } catch { return 'game'; } };
if (arg('--project')) {
  if (!existsSync(path.join(ROOT, arg('--project'), 'monitor.json'))) { console.error(`Không thấy ${arg('--project')}/monitor.json`); process.exit(1); }
  mkdirSync(path.join(ROOT, 'reports', 'monitor'), { recursive: true });
  writeFileSync(path.join(ROOT, 'reports', 'monitor', 'session'), arg('--project') + '\n');
}
const TYPES = { '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.webp': 'image/webp', '.svg': 'image/svg+xml', '.json': 'application/json' };

// ---------------------------------------------------------------- đọc trạng thái harness từ đĩa
const read = (p) => { try { return readFileSync(path.join(ROOT, p), 'utf8'); } catch { return null; } };
const json = (p) => { try { return JSON.parse(read(p)); } catch { return null; } };
const mtime = (p) => { try { return statSync(path.join(ROOT, p)).mtimeMs; } catch { return 0; } };
const img = (p) => (p && mtime(p) ? `/f/${p}?v=${Math.round(mtime(p))}` : null);

function walk(dir) {
  const out = [];
  const go = (d) => {
    let ents = [];
    try { ents = readdirSync(path.join(ROOT, d), { withFileTypes: true }); } catch { return; }
    for (const e of ents) {
      const p = `${d}/${e.name}`;
      if (e.isDirectory()) go(p);
      else if (e.name.endsWith('.md')) out.push({ p: p.replace(/^1-wiki\//, ''), t: Math.round(mtime(p)) });
    }
  };
  go(dir);
  return out.sort((a, b) => b.t - a.t);
}

/** Đoạn văn đầu tiên của một trang Wiki (bỏ tiêu đề, dòng in đậm kiểu "Trạng thái:"). */
function firstPara(md) {
  if (!md) return '';
  const out = [];
  for (const l of md.split('\n')) {
    const t = l.trim();
    if (!t) { if (out.length) break; continue; }
    if (/^(#|>|\*\*|\||-|\d+[.)])/.test(t)) { if (out.length) break; continue; }
    out.push(t);
  }
  return out.join(' ').replace(/`/g, '');
}

// ---------------------------------------------------------------- dự án có monitor.json (không phải game)
/** Dự án đang theo dõi: phiên hiện tại là tên một thư mục có monitor.json; game thì không có file này. */
function activeProject() {
  const id = sessionId();
  const m = json(`${id}/monitor.json`);
  return m && { ...m, dir: id };
}
function listDir(p) { try { return readdirSync(path.join(ROOT, p), { withFileTypes: true }); } catch { return []; } }
function newestCode(p) {
  let max = 0;
  for (const d of p.codeDirs ?? []) {
    const go = (dir) => { for (const e of listDir(dir)) {
      const f = `${dir}/${e.name}`;
      if (e.isDirectory()) { if (e.name !== '__pycache__') go(f); }
      else if (e.name.endsWith('.py')) max = Math.max(max, mtime(f));
    } };
    go(`${p.dir}/${d}`);
  }
  return max;
}
/** Trạng thái lấy từ kết quả test thật, không từ lời AI: chưa làm → pending; chưa có bằng chứng → claimed. */
function projectFeature(f, tests, newest) {
  const page = { id: f.id, title: f.title, done: f.done ?? [], summary: f.summary ?? '' };
  if (f.todo) return { ...page, state: 'pending' };
  const mine = Object.entries(tests).filter(([id]) => (f.tests ?? []).some((t) => id.startsWith(t))).map(([, r]) => r);
  const base = { ...page, tests: mine.length, testsOk: mine.filter((r) => r.ok).length };
  if (mine.some((r) => !r.ok)) return { ...base, state: 'failing', note: `${mine.length - base.testsOk}/${mine.length} test đang đỏ.` };
  if (f.unverified) return { ...base, state: 'claimed', note: f.unverified };
  if (!mine.length) return { ...base, state: 'claimed', note: 'Chưa có kết quả test.' };
  if (mine.some((r) => r.t < newest)) return { ...base, state: 'claimed', note: 'Code đã đổi sau lần test gần nhất, cần chạy lại.' };
  return { ...base, state: 'passing' };
}
/** Ảnh đầu ra của chương mới nhất trong workspace; ảnh bìa để cuối nên được hiện lớn. */
function projectShots(p) {
  const base = `${p.dir}/${p.workspace}/build/${p.series}`;
  const ch = listDir(base).filter((e) => e.isDirectory()).map((e) => e.name).sort().pop();
  if (!ch) return [];
  const pages = listDir(`${base}/${ch}/colored`).map((e) => e.name).filter((n) => n.endsWith('.png')).sort()
    .map((n) => ({ url: img(`${base}/${ch}/colored/${n}`), label: `${ch} · colored page ${parseInt(n, 10)}` }));
  return [...pages, { url: img(`${base}/${ch}/thumbnail.png`), label: `${ch} · thumbnail` }].filter((s) => s.url);
}
/** Câu hỏi còn mở: danh sách đánh số dưới tiêu đề "Câu hỏi còn mở" của README. */
function openQuestions(p) {
  const part = (read(`${p.dir}/README.md`) ?? '').split(/^## Câu hỏi còn mở\s*$/m)[1] ?? '';
  return part.split(/^## /m)[0].split('\n').filter((l) => /^\s*\d+[.)]\s/.test(l)).map((l) => l.replace(/^\s*\d+[.)]\s*/, ''));
}
function projectState(p, events, started) {
  const tests = json(`${p.dir}/.test-results.json`)?.tests ?? {};
  const list = Object.entries(tests);
  const failed = list.filter(([, r]) => !r.ok).map(([id]) => id);
  const newest = newestCode(p);
  const lastRun = list.length ? Math.max(...list.map(([, r]) => r.t)) : 0;
  const wiki = `${p.dir}/${p.workspace}/wiki`;
  const log = (read(`${wiki}/log.md`) ?? '').split('\n').filter((l) => l.startsWith('## [')).slice(-6).map((l) => l.replace(/^## /, ''));
  return {
    title: p.title, about: p.about, started, events, questions: [], answers: '', progress: log, po: openQuestions(p),
    features: (p.features ?? []).map((f) => projectFeature(f, tests, newest)),
    report: lastRun ? { passed: !failed.length, at: lastRun, total: list.length, ok: list.length - failed.length, fails: failed, shots: projectShots(p) } : { shots: projectShots(p) },
    verify: null, look: null, wiki: walk(wiki),
    project: { dir: p.dir, stale: lastRun > 0 && lastRun < newest, testCommand: p.testCommand, startCommand: p.startCommand, canvas: p.dashboard && p.canvas ? p.dashboard + p.canvas : null, pipeline },
  };
}
/** Trang quản lý của dự án (nếu đang bật): lần chạy mới nhất đang ở bước nào. */
let pipeline = null;
async function pollPipeline() {
  const p = activeProject();
  if (!p?.dashboard) { pipeline = null; return; }
  const get = async (u) => (await fetch(p.dashboard + u, { signal: AbortSignal.timeout(2000) })).json();
  try {
    const runs = (await get(`/api/series/${p.series}/runs`)).filter((r) => !r.preview).sort((a, b) => b.id - a.id);
    const run = runs[0];
    let step = null;
    if (run?.current) step = (await get(`/api/runs/${run.id}`)).definition?.nodes?.find((n) => n.id === run.current)?.title ?? run.current;
    pipeline = { online: true, step, runs: runs.slice(0, 5).map(({ id, chapter, status, version }) => ({ id, chapter, status, version })) };
  } catch { pipeline = { online: false }; }
}

function snapshot() {
  const proj = activeProject();
  const since = proj?.since ? Date.parse(proj.since) : 0;
  const all = (read('reports/monitor/events.jsonl') ?? '').trim().split('\n').filter(Boolean)
    .map((l) => { try { return JSON.parse(l); } catch { return null; } }).filter((e) => e && e.t >= since);
  const events = all.slice(-80);
  const started = all[0]?.t ?? null;
  if (proj) return projectState(proj, events, started);
  const title = ((read('1-wiki/overview.md') ?? '').match(/^#\s+(.+)$/m)?.[1] ?? '').replace(/^Overview\s*[—-]\s*/i, '').replace(/^Overview$/i, '');
  const features = (json('4-memory/features.json') ?? []).map((f) => ({ id: f.id, title: f.title, state: f.state, done: f.done ?? [], summary: firstPara(read(f.page ?? '')) }));
  const questions = (read('1-wiki/raw/questions.md') ?? '').split('\n').filter((l) => /^\s*\d+[.)]\s/.test(l)).map((l) => l.replace(/^\s*\d+[.)]\s*/, ''));
  const answers = firstPara(read('1-wiki/raw/answers.md'));
  const about = firstPara(read('1-wiki/overview.md'));
  const progress = (read('4-memory/progress.md') ?? '').split('\n').filter((l) => /^\s*[-*]\s/.test(l)).slice(-6).map((l) => l.replace(/^\s*[-*]\s*/, ''));
  const po = (read('4-memory/po-questions.md') ?? '').split('\n').filter((l) => /^\s*(\d+[.)]|[-*])\s/.test(l)).map((l) => l.replace(/^\s*(\d+[.)]|[-*])\s*/, ''));
  const rep = json('reports/latest/report.json');
  const report = rep && {
    passed: rep.passed, at: rep.at, total: rep.checks.length, ok: rep.checks.filter((c) => c.ok).length,
    fails: rep.checks.filter((c) => !c.ok).map((c) => c.name + (c.detail ? ` — ${c.detail}` : '')),
    shots: (rep.shots ?? []).map((s) => ({ url: img(`reports/latest/${s.file}`), label: s.label })).filter((s) => s.url),
  };
  const lookEv = [...events].reverse().find((e) => e.items?.some((i) => i.image));
  const lookPath = lookEv?.items.find((i) => i.image)?.image;
  return {
    title, started, events, features, progress, po, report, questions, answers, about,
    verify: json('reports/verify.json'),
    wiki: walk('1-wiki').filter((f) => !/^(README|plan-checklist)\.md$/.test(f.p)),
    look: lookPath ? { url: img(lookPath), label: lookPath, t: lookEv.t } : null,
  };
}

// ---------------------------------------------------------------- ghi lại (để phát lại sau)
function record(state) {
  const dir = path.join(SESSIONS, sessionId());
  mkdirSync(path.join(dir, 'img'), { recursive: true });
  const fix = (url) => {
    if (!url || !url.startsWith('/f/')) return url;
    const p = decodeURIComponent(url.slice(3).split('?')[0]);
    try {
      const buf = readFileSync(path.join(ROOT, p));
      const name = createHash('sha1').update(buf).digest('hex').slice(0, 16) + path.extname(p);
      if (!existsSync(path.join(dir, 'img', name))) copyFileSync(path.join(ROOT, p), path.join(dir, 'img', name));
      return `img/${name}`;
    } catch { return null; }
  };
  const s = structuredClone(state);
  if (s.look) s.look.url = fix(s.look.url);
  if (s.report) s.report.shots = s.report.shots.map((x) => ({ ...x, url: fix(x.url) })).filter((x) => x.url);
  // ảnh trước/sau gắn trong từng sự kiện (AI xem ảnh, bot chụp) → chép kèm để phát lại vẫn thấy
  for (const e of s.events) for (const it of e.items ?? []) {
    if (it.snap) it.snap = fix(`/f/${it.snap}`);
    if (it.shots) it.shots = it.shots.map((x) => ({ ...x, snap: fix(`/f/${x.snap}`) })).filter((x) => x.snap);
  }
  appendFileSync(path.join(dir, 'frames.jsonl'), JSON.stringify({ t: Date.now(), state: s }) + '\n');
  const done = s.features.filter((f) => f.state === 'passing').length;
  writeFileSync(path.join(dir, 'meta.json'), JSON.stringify({ title: s.title, updated: Date.now(), done, total: s.features.length }));
}

/** Danh sách game để chọn: phiên đang chạy, các game trước, và bản mẫu. */
function sessions() {
  const out = [];
  const live = sessionId();
  let ids = [];
  try { ids = readdirSync(SESSIONS).filter((d) => existsSync(path.join(SESSIONS, d, 'frames.jsonl'))); } catch { /* chưa có */ }
  for (const id of ids) {
    let m = {}; try { m = JSON.parse(readFileSync(path.join(SESSIONS, id, 'meta.json'), 'utf8')); } catch { /* thiếu meta */ }
    out.push({ id, title: m.title || 'New game', updated: m.updated ?? 0, done: m.done ?? 0, total: m.total ?? 0, live: id === live });
  }
  if (!out.some((x) => x.live)) out.push({ id: live, title: current?.title || 'New game', updated: Date.now(), done: 0, total: 0, live: true });
  out.sort((a, b) => (b.live - a.live) || (b.updated - a.updated));
  if (existsSync(path.join(SAMPLE, 'frames.jsonl'))) {
    const lines = readFileSync(path.join(SAMPLE, 'frames.jsonl'), 'utf8').trim().split('\n');
    let t = 'Sample'; try { t = JSON.parse(lines[lines.length - 1]).state.title || t; } catch { /* bỏ qua */ }
    out.push({ id: 'sample', title: t, sample: true });
  }
  return out;
}
const sessionDir = (id) => (id === 'sample' ? SAMPLE : path.join(SESSIONS, id.replace(/[^\w.-]/g, '')));

// ---------------------------------------------------------------- server
const clients = new Set();
let last = '';
let current = null;
function tick() {
  const s = snapshot();
  const key = JSON.stringify(s);
  if (key === last) return;
  last = key; current = s;
  if (s.events.length || s.features.length) record(s);
  for (const res of clients) res.write(`data: ${key}\n\n`);
}

const server = createServer((req, res) => {
  const url = new URL(req.url, 'http://x');
  const send = (code, type, body) => { res.writeHead(code, { 'content-type': type, 'cache-control': 'no-store' }); res.end(body); };
  if (url.pathname === '/') return send(200, 'text/html; charset=utf-8', PAGE);
  if (url.pathname === '/mode') return send(200, 'application/json', JSON.stringify({ mode: START_REPLAY ? 'replay' : 'live', start: START_REPLAY ? 'sample' : sessionId() }));
  if (url.pathname === '/sessions') return send(200, 'application/json', JSON.stringify(sessions()));
  if (url.pathname === '/stream') {
    res.writeHead(200, { 'content-type': 'text/event-stream', 'cache-control': 'no-store', connection: 'keep-alive' });
    clients.add(res);
    if (current) res.write(`data: ${JSON.stringify(current)}\n\n`);
    req.on('close', () => clients.delete(res));
    return;
  }
  if (url.pathname === '/frames') {
    try {
      const lines = readFileSync(path.join(sessionDir(url.searchParams.get('s') ?? 'sample'), 'frames.jsonl'), 'utf8').trim().split('\n');
      return send(200, 'application/json', `[${lines.join(',')}]`);
    } catch { return send(404, 'application/json', '[]'); }
  }
  let base = null, rel = null;
  const m = url.pathname.match(/^\/s\/([\w.-]+)\/(img\/.+)$/);
  if (m) { base = sessionDir(m[1]); rel = m[2]; }
  else if (url.pathname.startsWith('/f/')) { base = ROOT; rel = url.pathname.slice(3); }
  if (base) {
    const file = path.resolve(base, decodeURIComponent(rel));
    if (!file.startsWith(base + path.sep)) return send(403, 'text/plain', 'no');
    try { return send(200, TYPES[path.extname(file).toLowerCase()] ?? 'application/octet-stream', readFileSync(file)); } catch { return send(404, 'text/plain', 'not found'); }
  }
  send(404, 'text/plain', 'not found');
});

const PAGE = String.raw`<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Harness Monitor</title>
<link href="https://fonts.googleapis.com/css2?family=Be+Vietnam+Pro:wght@400;600;800&display=swap" rel="stylesheet">
<style>
:root{--ink:#1D1B26;--muted:#5A5566;--bg:#F6F1E7;--card:#FFFDF8;--line:#E2DACB;--paper:#C9781A;--tools:#4E3DC2;--judge:#B23A2A;--book:#0F7A70;
  --fs:clamp(15px,1.05vw,20px)}
*{box-sizing:border-box;margin:0}
body{background:var(--bg);color:var(--ink);font:var(--fs)/1.45 'Be Vietnam Pro',system-ui,sans-serif;min-height:100vh;display:flex;flex-direction:column;padding:clamp(10px,1.2vw,22px);gap:clamp(10px,1vw,16px)}
button{font:inherit;color:inherit}
header{display:flex;align-items:center;gap:10px 16px;flex-wrap:wrap}
h1{font-size:1.5em;font-weight:800;letter-spacing:-.5px}
.mode{font-size:.75em;font-weight:800;letter-spacing:2px;padding:5px 12px;border-radius:999px;color:#fff;display:flex;align-items:center;gap:8px}
.mode.live{background:var(--judge)} .mode.replay{background:var(--tools)}
.mode.live::before{content:'';width:9px;height:9px;border-radius:50%;background:#fff;animation:blink 1.2s infinite}
@keyframes blink{50%{opacity:.25}}
.game{font-size:1.15em;font-weight:600;color:var(--muted)}
.ctl{display:none;gap:6px;align-items:center;flex-wrap:wrap} .replay-on .ctl{display:flex}
.ctl button{font-weight:800;font-size:.85em;border:2px solid var(--tools);background:var(--card);color:var(--tools);border-radius:10px;padding:4px 10px;cursor:pointer;min-width:44px;min-height:36px}
.ctl button.on{background:var(--tools);color:#fff}
.ctl input{width:clamp(120px,14vw,240px);accent-color:var(--tools)}
.clock{margin-left:auto;color:var(--muted)}
.now{background:var(--ink);color:#fff;border-radius:20px;padding:clamp(12px,1vw,18px) clamp(16px,1.6vw,28px);display:flex;align-items:center;gap:16px;flex-wrap:wrap}
.now .ic{font-size:2.3em;line-height:1}
.now .main{flex:1 1 360px;min-width:0}
.now .lbl{font-size:.75em;letter-spacing:3px;color:#B9B2CC;font-weight:600}
.now .txt{font-size:1.65em;font-weight:800;line-height:1.2}
.you{background:#ECE6DA;color:var(--ink);border-radius:14px;padding:8px 16px;max-width:100%;flex:0 1 auto}
.you b{display:block;font-size:.65em;letter-spacing:2px;color:var(--muted)}
.room{display:grid;grid-template-columns:repeat(auto-fit,minmax(230px,1fr));gap:clamp(10px,1vw,16px)}
.st{all:unset;box-sizing:border-box;cursor:pointer;background:var(--card);border:3px solid var(--line);border-radius:20px;padding:clamp(12px,1vw,18px);display:flex;flex-direction:column;gap:6px;transition:transform .3s cubic-bezier(.16,1,.3,1),box-shadow .3s,border-color .3s}
.st:hover,.st:focus-visible{border-color:var(--c);box-shadow:0 10px 26px rgba(29,27,38,.12)}
.st:focus-visible{outline:3px solid var(--c);outline-offset:3px}
.st .head{display:flex;align-items:center;gap:10px}
.st .em{font-size:2em;line-height:1}
.st .name{font-size:1.2em;font-weight:800;color:var(--c);line-height:1.15}
.st .role{font-size:.78em;color:var(--muted)}
.st .big{font-size:1.9em;font-weight:800;line-height:1.1;margin-top:6px}
.st .say{font-size:.9em;color:var(--muted)}
.st .more{font-size:.8em;font-weight:700;color:var(--c);margin-top:auto;padding-top:4px}
.st.on{border-color:var(--c);transform:translateY(-4px);box-shadow:0 16px 32px rgba(29,27,38,.16);background:#fff}
.tag{display:none;font-size:.62em;font-weight:800;letter-spacing:1.5px;color:#fff;background:var(--c);border-radius:999px;padding:3px 9px;margin-left:auto;white-space:nowrap;animation:blink 1.4s infinite}
.st.on .tag{display:inline-block}
.bottom{display:grid;grid-template-columns:minmax(0,1.5fr) minmax(260px,1fr);gap:clamp(10px,1vw,16px);flex:1}
@media (max-width:900px){.bottom{grid-template-columns:1fr}}
.box{background:var(--card);border:2px solid var(--line);border-radius:20px;padding:clamp(12px,1vw,20px);display:flex;flex-direction:column;gap:10px;min-width:0}
.box h2{font-size:1.1em;font-weight:800}
.legend{font-size:.8em;color:var(--muted)}
.feats{display:grid;grid-template-columns:repeat(auto-fill,minmax(210px,1fr));gap:8px}
.f{all:unset;box-sizing:border-box;cursor:pointer;display:flex;align-items:center;gap:10px;border-radius:12px;padding:9px 14px;font-weight:600;background:#F1ECE3;border:2px solid transparent;transition:background .4s}
.f:hover,.f:focus-visible{border-color:var(--paper)}
.f .e{font-size:1.25em;flex:none} .f.claimed{background:#FBEFC6} .f.passing{background:#DCEFEA} .f.blocked,.f.failing{background:#F3E2DD}
.pipe{display:flex;align-items:center;gap:8px 12px;flex-wrap:wrap;background:#EEEAFB;border-radius:12px;padding:10px 14px;font-weight:600}
.pipe.off{background:#F1ECE3;font-weight:400;color:var(--muted)}
.pipe a{margin-left:auto;font-weight:800;color:var(--tools)}
.pipe code,.card code{font-family:ui-monospace,monospace;font-size:.85em;overflow-wrap:anywhere}
.note{color:var(--muted);font-size:.9em}
.f.new{animation:pop 1.6s ease-out}
@keyframes pop{0%{box-shadow:0 0 0 5px #FBE29A}100%{box-shadow:none}}
.story{display:flex;flex-direction:column;gap:4px}
.story p{font-size:.88em;color:var(--muted);display:flex;gap:10px} .story p:first-child{color:var(--ink);font-weight:600}
.story .t{flex:none;width:3.2em;color:#9A94A6}
.shot{display:flex;flex-direction:column;align-items:center;gap:8px;flex:1}
.shot img{width:auto;max-width:100%;max-height:min(60vh,560px);border-radius:16px;border:4px solid var(--ink);background:#000}
.shot p{font-size:.85em;color:var(--muted);text-align:center}
.empty{color:var(--muted);font-style:italic}
/* bảng chi tiết */
.dlg{position:fixed;inset:0;background:rgba(29,27,38,.45);display:none;align-items:stretch;justify-content:flex-end;z-index:10}
.dlg.open{display:flex}
.panel{background:var(--bg);width:min(760px,100%);height:100%;overflow:auto;padding:clamp(16px,2vw,32px);display:flex;flex-direction:column;gap:16px;border-left:8px solid var(--c);animation:slide .35s cubic-bezier(.16,1,.3,1)}
@keyframes slide{from{transform:translateX(40px);opacity:0}}
.panel .top{display:flex;align-items:center;gap:12px}
.panel .top .em{font-size:2.4em}
.panel h3{font-size:1.6em;font-weight:800;color:var(--c);line-height:1.15}
.panel .role{color:var(--muted)}
.close{all:unset;cursor:pointer;margin-left:auto;font-size:1.6em;line-height:1;width:48px;height:48px;border-radius:12px;display:flex;align-items:center;justify-content:center;background:var(--card);border:2px solid var(--line)}
.close:focus-visible{outline:3px solid var(--c)}
.why{background:var(--ink);color:#fff;border-radius:14px;padding:12px 16px}
.card{background:var(--card);border:2px solid var(--line);border-radius:14px;padding:12px 16px;display:flex;flex-direction:column;gap:6px}
.card b{font-size:1.05em}
.card ul{padding-left:1.2em;color:var(--muted);font-size:.92em}
.pill{display:inline-block;font-size:.8em;font-weight:700;border-radius:999px;padding:2px 10px;background:#F1ECE3}
.pill.passing{background:#DCEFEA;color:var(--book)} .pill.claimed{background:#FBEFC6;color:#6B5200} .pill.blocked,.pill.failing{background:#F3E2DD;color:var(--judge)}
.row{display:flex;gap:10px;align-items:baseline;padding:8px 12px;border-radius:10px;background:var(--card);border:1px solid var(--line)}
.row .t{flex:none;color:#9A94A6;font-size:.85em;width:3.4em}
.row.ok{background:#DCEFEA;border-color:#BFE2D9} .row.bad{background:#F3E2DD;border-color:#E9C9C1}
.gal{display:grid;grid-template-columns:repeat(auto-fill,minmax(130px,1fr));gap:10px}
.gal figure{display:flex;flex-direction:column;gap:4px} .gal img{width:100%;border-radius:10px;border:2px solid var(--ink);background:#000}
.gal figcaption{font-size:.75em;color:var(--muted)}
.inc{background:var(--card);border:2px solid #E9C9C1;border-left:8px solid var(--judge);border-radius:14px;padding:12px 16px;display:flex;flex-direction:column;gap:6px}
.inc.done{border-color:#BFE2D9;border-left-color:var(--book)}
.inc .ih{display:flex;gap:10px;align-items:baseline} .inc .ih .n{color:#9A94A6;font-weight:800} .inc .ih .t{margin-left:auto;color:#9A94A6;font-size:.85em}
.inc .lab{font-size:.75em;font-weight:800;letter-spacing:1.5px;text-transform:uppercase;color:var(--muted);margin-top:4px}
.inc ul{padding-left:1.2em} .inc .q{font-style:italic;color:var(--ink);background:#F1ECE3;border-radius:10px;padding:6px 12px}
.inc code{font-family:ui-monospace,monospace;font-size:.85em;background:#EEEAFB;color:var(--tools);border-radius:6px;padding:1px 6px}
.inc .res{font-weight:800;border-radius:10px;padding:6px 12px;margin-top:4px} .inc .res.ok{background:#DCEFEA;color:var(--book)} .inc .res.bad{background:#F3E2DD;color:var(--judge)}
.ba{display:flex;flex-direction:column;gap:10px}
.pair{display:flex;align-items:center;gap:10px;background:#F1ECE3;border-radius:12px;padding:10px}
.pair figure{flex:1;display:flex;flex-direction:column;align-items:center;gap:4px;min-width:0}
.pair img{max-width:100%;max-height:300px;border-radius:10px;border:3px solid var(--ink);cursor:zoom-in;background:#000}
.pair figcaption{font-size:.75em;color:var(--muted)} .pair .arr{font-size:1.6em;color:var(--muted)}
.noimg{font-size:.8em;color:var(--muted);font-style:italic;padding:30px 8px;text-align:center}
.diff{background:var(--ink);border-radius:10px;padding:8px 12px;font-family:ui-monospace,monospace;font-size:.78em;overflow-x:auto}
.diff p{white-space:pre;margin:0} .diff .fn{color:#B9B2CC;margin-bottom:4px} .diff .del{color:#FF9C8F} .diff .add{color:#8FE3C9}
.zoom{position:fixed;inset:0;z-index:20;background:rgba(29,27,38,.85);display:none;flex-direction:column;align-items:center;justify-content:center;gap:10px;cursor:zoom-out}
.zoom.open{display:flex} .zoom img{max-width:92vw;max-height:86vh;border-radius:14px;border:4px solid #fff} .zoom p{color:#fff}
.pickw{display:flex;align-items:center;gap:8px;font-weight:800;color:var(--muted);font-size:.9em} .pickw select{font:600 1em 'Be Vietnam Pro',system-ui,sans-serif;color:var(--ink);background:var(--card);border:2px solid var(--line);border-radius:10px;padding:6px 10px;min-height:40px;max-width:min(46vw,460px);cursor:pointer} .pickw select:focus-visible{outline:3px solid var(--tools)}
</style></head><body>
<header><h1>Harness Monitor</h1><span id="mode" class="mode live">LIVE</span><label class="pickw">Project <select id="pick" aria-label="Choose a project"></select></label><span class="game" id="game" hidden></span>
<div class="ctl"><button id="play" aria-label="Play / pause">⏸</button><button data-s="1">1×</button><button data-s="4">4×</button><button data-s="12" class="on">12×</button><input id="seek" type="range" min="0" max="1000" value="0" aria-label="Seek"></div>
<span class="clock" id="clock"></span></header>
<div class="now"><span class="ic" id="ic">⏳</span><div class="main"><p class="lbl">NOW</p><p class="txt" id="doing">Waiting for a prompt…</p></div><div class="you" id="you"><b>LATEST PROMPT</b><span>—</span></div></div>
<div class="room">
<button class="st" id="st-paper" data-open="paper" style="--c:var(--paper)"><div class="head"><span class="em">📄</span><div><p class="name">Wiki</p><p class="role">Specs &amp; requirements</p></div><span class="tag">ACTIVE</span></div><p class="big" id="paper-big">–</p><p class="say" id="paper-say"></p><p class="more">View specs ›</p></button>
<button class="st" id="st-tools" data-open="tools" style="--c:var(--tools)"><div class="head"><span class="em">🧰</span><div><p class="name">Environment</p><p class="role">Tools &amp; runtime</p></div><span class="tag">ACTIVE</span></div><p class="big" id="tools-big">–</p><p class="say" id="tools-say"></p><p class="more">View tools used ›</p></button>
<button class="st" id="st-judge" data-open="judge" style="--c:var(--judge)"><div class="head"><span class="em">⚖️</span><div><p class="name">Verification</p><p class="role">Automated testing</p></div><span class="tag">ACTIVE</span></div><p class="big" id="judge-big">–</p><p class="say" id="judge-say"></p><p class="more">View bugs caught &amp; fixed ›</p></button>
<button class="st" id="st-book" data-open="book" style="--c:var(--book)"><div class="head"><span class="em">📒</span><div><p class="name">Memory</p><p class="role">Progress &amp; state</p></div><span class="tag">ACTIVE</span></div><p class="big" id="book-big">–</p><p class="say" id="book-say"></p><p class="more">View progress ›</p></button>
</div>
<div class="bottom">
<div class="box"><h2>Features</h2><p class="legend" id="legend">⏳ pending · 🟡 claimed: AI says done, awaiting verify · ✅ passing: verified · click a feature to see its spec</p><div class="feats" id="feats"></div>
<h2 style="margin-top:6px">Activity log</h2><div class="story" id="story"></div></div>
<div class="box"><div class="pipe" id="pipe" hidden></div><div class="shot"><img id="look" alt="Latest output" data-zoom hidden><p id="lookl" class="empty">No screenshot yet</p></div></div>
</div>
<div class="zoom" id="zoom" role="dialog" aria-label="Enlarged image"><img id="zoomimg" alt="Enlarged image"><p>Click to close</p></div>
<div class="dlg" id="dlg" role="dialog" aria-modal="true" aria-labelledby="dlg-title"><div class="panel" id="panel"></div></div>
<script>
const $=(id)=>document.getElementById(id);
const esc=(s)=>String(s??'').replace(/[&<>"]/g,(c)=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'})[c]);
const clean=(s)=>String(s??'').replace(/\`|\*\*/g,'');
const hhmm=(t)=>new Date(t).toLocaleTimeString('en-GB',{hour:'2-digit',minute:'2-digit'});
const ST={pending:'⏳',claimed:'🟡',passing:'✅',blocked:'⛔',failing:'❌'};
const STX={pending:'pending',claimed:'claimed · awaiting verify',passing:'passing · verified',blocked:'blocked',failing:'failing · tests are red'};
const RUN={waiting:'waiting for you',running:'running',done:'finished',failed:'failed',cancelled:'cancelled'};
const span=(ms)=>{const d=Math.max(0,Math.round(ms/1000));const h=Math.floor(d/3600),m=Math.floor(d%3600/60);return h?h+' h '+m+' min':m+' min '+String(d%60).padStart(2,'0')+' s';};
const errs=(i)=>{const m=String(i.res||'').match(/(\d+) (?:đỏ|fail)/);return m?+m[1]:(i.ok?0:1);};
function plain(i){
  switch(i.kind){
    case 'wiki': return {st:'paper',ic:'📄',t:'AI writes specs into the Wiki'};
    case 'skill': return {st:'paper',ic:'📘',t:'AI reads the workflow guide'};
    case 'read': return /1-wiki|Wiki|\/wiki\//.test(i.text)?{st:'paper',ic:'📖',t:'AI reads specs in the Wiki'}:{st:null,ic:'📖',t:'AI reads source code and docs'};
    case 'code': return {st:'tools',ic:'🛠',t:'AI writes code'};
    case 'asset': return {st:'tools',ic:'🎨',t:'AI downloads assets (icons, images)'};
    case 'bot': return {st:'tools',ic:'🤖',t:i.text.includes('ảnh')?'Bot takes a screenshot for AI to review the UI':'Bot runs the game in Chrome and plays it'};
    case 'look': return {st:'tools',ic:'👁',t:'AI reviews a screenshot of the UI'};
    case 'browser': return {st:'tools',ic:'🌐',t:'AI opens a browser via MCP'};
    case 'pipeline': return {st:'tools',ic:'🎬',t:'AI runs the app'};
    case 'mcp':
      if(/Claude_Browser|claude-in-chrome|playwright/.test(i.text)) return {st:'tools',ic:'🌐',t:'AI uses a browser to check the UI'};
      if(/context7/.test(i.text)) return {st:'tools',ic:'📚',t:'AI looks up docs via MCP'};
      if(/ccd_/.test(i.text)) return {st:null,ic:'⚙️',t:'AI is working'};
      return {st:'tools',ic:'🔌',t:'AI uses an MCP tool'};
    case 'test': return {st:'judge',ic:'🧪',t:i.res==null?'Running unit tests':(i.ok?'Unit tests: all pass 🟢':'Unit tests: '+errs(i)+' failing 🔴')};
    case 'verify': return {st:'judge',ic:'✅',t:i.res==null?'Running full verify':(i.ok?'Full verify: PASS 🟢':'Full verify: FAIL 🔴')};
    case 'memory': return {st:'book',ic:'📒',t:'AI updates Memory'};
    case 'newgame': return {st:'book',ic:'🆕',t:'New game started; the previous one is archived'};
    default: return {st:null,ic:'⚙️',t:'AI is working'};
  }
}
// Không đoán ý AI từ từ khoá trong câu trả lời: hiện đúng câu đầu AI đã viết.
function aiSays(x){
  const line=String(x||'').split('\n').map(l=>l.replace(/^[#>*\-\s]+/,'').replace(/\*\*|\`/g,'').trim()).find(Boolean);
  if(!line) return 'AI replied. Waiting for you';
  const first=(line.match(/^.+?[.!?](?=\s|$)/)||[line])[0];
  return 'AI replied: '+(first.length>110?first.slice(0,109)+'…':first);}
function buildStory(ev){
  const story=[];
  for(const e of ev){
    if(e.type==='user') story.push({t:e.t,ic:'🗣',txt:'Prompt: “'+e.text+'”',st:null});
    else if(e.type==='ai') story.push({t:e.t,ic:'💬',txt:aiSays(e.text),st:null});
    else for(const i of e.items){const p=plain(i);const last=story[story.length-1];
      if(!(last&&last.txt===p.t)) story.push({t:e.t,ic:p.ic,txt:p.t,st:p.st,i});}
  }
  return story;
}
// Ghép các lần kiểm: lần FAIL mở một "sự cố", các lần sửa code sau đó gắn vào, lần PASS kế tiếp đóng lại.
// Thêm loại thứ hai: AI xem screenshot rồi sửa code trước lần kiểm kế tiếp = lỗi giao diện AI tự nhìn thấy.
function incidents(ev){
  const out=[]; const open={}; let look=null;
  const isCheck=(i)=>(i.kind==='test'||i.kind==='verify'||(i.kind==='bot'&&!i.text.includes('ảnh')))&&i.res!=null;
  const grp=(i)=>i.kind==='test'?'test':'verify';
  for(const e of ev){
    if(e.type!=='tool') continue;
    const note=e.note||'';
    // đoạn code thật sự thay đổi (hook so file trước/sau) → gắn vào các sự cố đang mở
    const diffCh=(e.diffs||[]).map(d=>d.created!=null?{file:d.file,write:d.created,created:true}:{file:d.file,old:d.old,new:d.new,line:d.line});
    if(diffCh.length){const targets=[...Object.values(open)]; if(look) targets.push(look);
      for(const x of targets){for(const c of diffCh){x.changes.push(c); if(!x.files.includes(c.file)) x.files.push(c.file);}}}
    // trong cùng một lệnh: sửa code trước, chạy kiểm sau (vd. sed … && verify.sh)
    const items=[...e.items].sort((a,b)=>((a.kind==='code'||a.kind==='wiki')?0:1)-((b.kind==='code'||b.kind==='wiki')?0:1));
    for(const i of items){
      if(i.kind==='code'||i.kind==='wiki'){
        const targets=[...Object.values(open)]; if(look) targets.push(look);
        for(const x of targets){ for(const f of (i.files||[i.text.replace(/^[^:]+:\s*/,'')])) if(!x.files.includes(f)) x.files.push(f); x.edits++; if(note&&!x.notes.includes(note)) x.notes.push(note);
          if(!diffCh.length) for(const c of (i.changes||[])) x.changes.push(c); if(e.desc&&!x.descs.includes(e.desc)) x.descs.push(e.desc); }
        if(look&&!out.includes(look)) out.push(look);
        continue;
      }
      if(i.kind==='look'){
        if(!look||look.closed) look={type:'look',t:e.t,files:[],notes:note?[note]:[],edits:0,image:i.image,closed:false,changes:[],descs:[],before:[],after:[]};
        if(i.snap) (look.edits?look.after:look.before).push({snap:i.snap,file:i.file||'',label:i.image||''});
        continue; }
      if(!isCheck(i)) continue;
      if(look&&out.includes(look)&&!look.closed){look.closed=true;look.end={t:e.t,ok:i.ok,txt:plain(i).t};if(note&&!look.notes.includes(note))look.notes.push(note);
        // chưa có ảnh "sau" → lấy ảnh bot chụp cùng tên ở lần kiểm này
        if(!look.after.length&&i.shots) for(const b of look.before){const a=i.shots.find(x=>x.file===b.file); if(a) look.after.push({snap:a.snap,file:a.file,label:a.label});}}
      look=null;
      const g=grp(i);
      if(!i.ok){
        if(open[g]){ open[g].tries.push({t:e.t,res:i.res,fails:i.fails||[]}); if(note&&!open[g].notes.includes(note)) open[g].notes.push(note); }
        else { open[g]={type:g,t:e.t,label:plain(i).t,fails:i.fails||[],tries:[],files:[],notes:note?[note]:[],edits:0,closed:false,changes:[],descs:[],before:[],after:[]}; out.push(open[g]); }
      } else if(open[g]){ open[g].closed=true; open[g].end={t:e.t,ok:true,txt:plain(i).t}; if(note&&!open[g].notes.includes(note)) open[g].notes.push(note); delete open[g]; }
    }
  }
  return out;
}
// Phần "đã sửa" trong báo cáo cuối của AI (các gạch đầu dòng ngay sau dòng có chữ "sửa").
function fixSummary(ev){
  const ai=[...ev].reverse().find(e=>e.type==='ai'&&/sửa/i.test(e.text||'')); if(!ai) return [];
  const lines=ai.text.split('\n'); const out=[]; let on=false, indent=0;
  for(const l of lines){ const t=l.trim(), ind=l.length-l.trimStart().length;
    if(!on&&/sửa/i.test(t)&&/:\**\s*$/.test(t)){on=true;continue;}
    if(on){ if(out.length&&ind<indent) break;  // gạch đầu dòng nông hơn là mục khác, không còn thuộc danh sách "đã sửa"
      if(/^[-*•]\s+/.test(t)){ if(!out.length) indent=ind; out.push(t.replace(/^[-*•]\s+/,'').replace(/\*\*/g,'')); } else if(t&&out.length) break; }
  }
  return out;
}
let S=null, prev=null, base='', openKey=null;
function render(s, now){
  S=s;
  $('game').textContent=s.title&&!/^overview$/i.test(s.title)?'· '+s.title:'';
  const ev=s.events||[];
  const P=s.project;
  if(ev.length){const from=s.started??ev[0].t;$('clock').textContent=(P?'Since '+new Date(from).toLocaleDateString('en-GB',{day:'2-digit',month:'short'})+' '+hhmm(from)+' · ':'')+span((now??Date.now())-from);}
  const u=[...ev].reverse().find(e=>e.type==='user'); $('you').querySelector('span').textContent=u?u.text:'—';
  const story=buildStory(ev); s._story=story;
  const cur=story[story.length-1];
  $('ic').textContent=cur?cur.ic:'⏳'; $('doing').textContent=cur?cur.txt:'Waiting for a prompt…';
  const active=cur&&cur.st?cur.st:null;
  for(const k of ['paper','tools','judge','book']) $('st-'+k).classList.toggle('on',active===k);
  const feats=s.features||[];
  const done=feats.filter(f=>f.state==='passing').length, claimed=feats.filter(f=>f.state==='claimed').length;
  $('paper-big').textContent=feats.length?feats.length+' features':'No specs yet';
  $('paper-say').textContent=feats.length?'Each feature has acceptance criteria (Done when), written before any code.':'AI clarifies requirements, then writes specs.';
  const toolSteps=story.filter(x=>x.st==='tools'); const lastTool=toolSteps[toolSteps.length-1];
  const looks=story.filter(x=>x.i&&x.i.kind==='look').length, bots=story.filter(x=>x.i&&x.i.kind==='bot').length;
  $('tools-big').textContent=bots?'🤖 bot ran '+bots+'×':(lastTool?lastTool.ic+' in use':'Not used yet');
  $('tools-say').textContent=lastTool?(looks?'AI reviewed '+looks+' screenshots':lastTool.txt):'Chrome, a bot that plays the game, screenshots, bundled libraries.';
  const checks=story.filter(x=>x.st==='judge'&&x.i&&x.i.res!=null); const lc=checks[checks.length-1];
  const reds=checks.filter(x=>!x.i.ok).length;
  const inc=incidents(ev); const fixed=inc.filter(x=>x.closed&&(!x.end||x.end.ok)).length;
  if(lc){$('judge-big').textContent=lc.i.ok?'🟢 Pass':'🔴 '+errs(lc.i)+' failing';$('judge-say').textContent=checks.length+' runs · '+inc.length+' bugs caught · '+fixed+' fixed';}
  else {$('judge-big').textContent='Not run yet';$('judge-say').textContent='Automated tests re-run after every change.';}
  $('book-big').textContent=feats.length?done+' / '+feats.length+' passing':'Empty';
  $('book-say').textContent=claimed?claimed+' feature(s) claimed, awaiting verify':(feats.length&&done===feats.length?'All features passing':'Progress is saved to files; the next session reads it back.');
  if(P) renderProject(s,feats,story,checks);
  $('pipe').hidden=!P; $('legend').textContent=P?'⏳ not built · 🟡 claimed: code exists, no full proof yet · ✅ passing: pytest passed on the current code · ❌ tests are red · click to see details':'⏳ pending · 🟡 claimed: AI says done, awaiting verify · ✅ passing: verified · click a feature to see its spec';
  const pf=new Map((prev?.features||[]).map(f=>[f.id,f.state]));
  $('feats').innerHTML=feats.map(f=>'<button class="f '+f.state+(prev&&pf.get(f.id)!==f.state?' new':'')+'" data-feat="'+esc(f.id)+'" title="'+STX[f.state]+'"><span class="e">'+ST[f.state]+'</span>'+esc(f.title)+'</button>').join('')||'<p class="empty">No features yet. AI writes specs after clarifying requirements.</p>';
  $('story').innerHTML=story.slice(-6).reverse().map(x=>'<p><span class="t">'+hhmm(x.t)+'</span><span>'+x.ic+' '+esc(x.txt)+'</span></p>').join('')||'<p class="empty">Nothing yet</p>';
  const r=s.report; const lk=s.look||(r&&r.shots.length?{url:r.shots[r.shots.length-1].url,label:r.shots[r.shots.length-1].label}:null);
  if(lk){if($('look').getAttribute('src')!==base+lk.url)$('look').src=base+lk.url;$('look').hidden=false;$('lookl').className='';$('lookl').textContent=s.look?'Screenshot the AI just reviewed':P?'Latest output: '+lk.label:'Latest bot screenshot';}
  else {$('look').hidden=true;$('lookl').className='empty';$('lookl').textContent='No screenshot yet';}
  if(openKey) fill(openKey);
  prev=s;
}
// Dự án có monitor.json: 4 ô đọc từ kế hoạch, pytest, trang quản lý và Wiki của dự án, không phải từ game.
function runText(pl){const x=pl.runs[0]; return x?'Run #'+x.id+' · ch-'+String(x.chapter??'?').padStart(4,'0')+' · '+(RUN[x.status]||x.status)+(pl.step&&x.status==='waiting'?' at '+pl.step:''):'No runs yet';}
function renderProject(s,feats,story,checks){
  const P=s.project, pl=P.pipeline, r=s.report||{};
  const open=feats.filter(f=>f.state==='claimed').length, todo=feats.filter(f=>f.state==='pending').length;
  $('paper-big').textContent=feats.length+' features';
  $('paper-say').textContent='Tracked from the plan · '+todo+' not built · '+(s.wiki||[]).length+' wiki pages in the demo workspace.';
  const link=P.canvas?'<a href="'+esc(P.canvas)+'" target="_blank" rel="noopener">Open workflow canvas ↗</a>':'';
  if(pl&&pl.online){$('tools-big').textContent='🟢 Online';$('tools-say').textContent=runText(pl);
    $('pipe').className='pipe';$('pipe').innerHTML='<span>🎬 '+esc(runText(pl))+'</span>'+link;}
  else {$('tools-big').textContent=pl?'⚪ Offline':'–';$('tools-say').textContent='The dashboard is not running.';
    $('pipe').className='pipe off';$('pipe').innerHTML='<span>🎬 Dashboard is off. Run <code>'+esc(P.startCommand||'')+'</code> in '+esc(P.dir)+'/</span>';}
  if(r.total){
    $('judge-big').textContent=r.passed?(P.stale?'🟡 ':'🟢 ')+r.ok+'/'+r.total+' pass':'🔴 '+(r.total-r.ok)+' failing';
    $('judge-say').textContent=(P.stale?'Code changed since the last run · ':'')+'pytest · last run '+hhmm(r.at)+(checks.length?' · seen '+checks.length+'×':'');
  } else {$('judge-big').textContent='Not run yet';$('judge-say').textContent='Run pytest to record results.';}
  $('book-say').textContent=open+' feature(s) without full proof · '+todo+' not built.';
}
// ---------- bảng chi tiết ----------
const PINFO={
  paper:'The plan for this project, split into features. Each feature is tied to the tests that prove it, and the state comes from those tests, not from the AI’s opinion.',
  tools:'What this project runs on: the dashboard and workflow canvas, the sample comic in the demo workspace, and the browser the AI uses to check the UI.',
  judge:'“Done” from the AI is not done. pytest records each test’s result here. If the code changes after a run, the result counts as out of date until pytest runs again.',
  book:'The project’s state lives in files: feature states come from monitor.json and test results, runs are in state.db, and the wiki log records each step of the pipeline.'};
const INFO={
  paper:{em:'📄',name:'Wiki',role:'Specs & requirements',c:'var(--paper)',why:'The project’s source of truth. Before coding, the AI clarifies requirements and writes a spec for each feature with acceptance criteria (Done when). Verification grades against this spec, not against the AI’s opinion.'},
  tools:{em:'🧰',name:'Environment',role:'Tools & runtime',c:'var(--tools)',why:'What the AI is equipped with to build and check its own work: Chrome and a bot that plays the game, screenshots for UI self-review, bundled libraries and assets, and limits on which files it may edit.'},
  judge:{em:'✅',name:'Verification',role:'Automated testing',c:'var(--judge)',why:'“Done” from the AI is not done. After every change, unit tests and the bot re-run everything. On failure the AI must find the cause, fix it and re-run until it passes.'},
  book:{em:'📒',name:'Memory',role:'Progress & state',c:'var(--book)',why:'Each feature’s state is saved to files, independent of chat history. In a new session the AI reads Memory and knows where to continue.'}};
function head(k,extra){const I=INFO[k];$('panel').style.setProperty('--c',I.c);
  return '<div class="top"><span class="em">'+I.em+'</span><div><h3 id="dlg-title">'+(extra||I.name)+'</h3><p class="role">'+I.role+'</p></div><button class="close" id="close" aria-label="Close">✕</button></div><p class="why">'+((S&&S.project&&PINFO[k])||I.why)+'</p>';}
function featCard(f){return '<div class="card"><div><span class="pill '+f.state+'">'+ST[f.state]+' '+STX[f.state]+'</span></div><b>'+esc(f.id)+' · '+esc(f.title)+'</b>'+(f.summary?'<p>'+esc(clean(f.summary))+'</p>':'')+
  (f.tests?'<p class="note">Tests: '+f.testsOk+'/'+f.tests+' pass</p>':'')+(f.note?'<p class="note">'+esc(clean(f.note))+'</p>':'')+
  (f.done&&f.done.length?'<details><summary class="role">Done when: '+f.done.length+' criteria (technical detail)</summary><ul>'+f.done.map(d=>'<li>'+esc(clean(d))+'</li>').join('')+'</ul></details>':'')+'</div>';}
const dur=(a,b)=>{const d=Math.round((b-a)/1000);return d<60?d+' s':Math.floor(d/60)+' min '+(d%60)+' s';};
function incidentCard(x,n){
  const head=x.type==='look'?'👁 AI reviewed a screenshot and spotted a UI problem':'🔴 '+esc(x.label.replace(/\s*[🟢🔴]$/u,''));
  let h='<div class="inc '+(x.closed&&(!x.end||x.end.ok)?'done':'open')+'"><div class="ih"><span class="n">#'+n+'</span><b>'+head+'</b><span class="t">'+hhmm(x.t)+'</span></div>';
  if(x.fails&&x.fails.length) h+='<p class="lab">Bug caught</p><ul>'+x.fails.map(f=>'<li>'+esc(clean(f))+'</li>').join('')+'</ul>';
  else if(x.type!=='look') h+='<p class="lab">Bug caught</p><p class="role">'+esc(x.label.replace(/\s*[🟢🔴]$/u,''))+' (test names not in output)</p>';
  if(x.tries&&x.tries.length) h+='<p class="lab">Re-run, still failing</p>'+x.tries.map(t=>'<p><span class="role">'+hhmm(t.t)+' · '+esc(t.res)+'</span>'+(t.fails.length?': '+t.fails.map(f=>esc(clean(f))).join('; '):'')+'</p>').join('');
  if(x.notes.length) h+='<p class="lab">AI analysis</p>'+x.notes.slice(0,3).map(t=>'<p class="q">“'+esc(clean(t))+'”</p>').join('');
  if(x.before&&x.before.length){
    h+='<p class="lab">Screenshots before and after the fix</p><div class="ba">';
    for(const b of x.before){const a=x.after.find(y=>y.file===b.file)||null;
      h+='<div class="pair"><figure><img src="'+imgUrl(b.snap)+'" alt="Before the fix" data-zoom><figcaption>Before · '+esc(b.file)+'</figcaption></figure>'+
         '<span class="arr">→</span><figure>'+(a?'<img src="'+imgUrl(a.snap)+'" alt="After the fix" data-zoom><figcaption>After · '+esc(a.file)+'</figcaption>':'<div class="noimg">No screenshot after the fix yet</div>')+'</figure></div>';}
    h+='</div>';}
  if(x.files.length){
    h+='<p class="lab">What the AI changed</p><p>'+x.files.map(f=>'<code>'+esc(f)+'</code>').join(' ')+' <span class="role">('+x.edits+' edit'+(x.edits>1?'s':'')+')</span></p>';
    if(x.descs.length) h+='<p class="role">AI’s note on the edit: '+x.descs.map(d=>'<i>'+esc(d)+'</i>').join(' · ')+'</p>';
    for(const c of x.changes.slice(0,6)){
      if(c.write!=null){h+='<p class="role"><code>'+esc(c.file)+'</code> '+(c.created?'new file':'written in full')+' ('+c.write+' lines)</p>';continue;}
      h+='<div class="diff"><p class="fn">'+esc(c.file)+(c.line?' · line '+c.line:'')+'</p>'+(c.old?String(c.old).split('\n'):[]).map(l=>'<p class="del">− '+esc(l)+'</p>').join('')+(c.new?String(c.new).split('\n'):[]).map(l=>'<p class="add">+ '+esc(l)+'</p>').join('')+'</div>';}
    if(x.changes.length>6) h+='<p class="role">… and '+(x.changes.length-6)+' more changes</p>';
  }
  if(x.closed&&x.end) h+='<p class="res '+(x.end.ok?'ok':'bad')+'">'+(x.end.ok?'🟢 ':'🔴 ')+esc(x.end.txt.replace(/ [🟢🔴]$/,''))+' · after '+dur(x.t,x.end.t)+'</p>';
  else h+='<p class="res bad">⏳ Fixing, not re-run yet</p>';
  return h+'</div>';}
const imgUrl=(p)=>!p?'':/^img\//.test(p)?base+p:'/f/'+p;
function fill(k){
  const s=S||{}; const story=s._story||[]; const ev=s.events||[]; let h='';
  if(k.startsWith('feat:')){const f=(s.features||[]).find(x=>x.id===k.slice(5)); h=head('paper','Feature: '+(f?esc(f.title):''))+(f?featCard(f):'<p class="empty">Feature not found.</p>');}
  else if(k==='paper'){
    h=head('paper');
    if(s.about) h+='<div class="card"><b>Product description</b><p>'+esc(clean(s.about))+'</p></div>';
    if(s.questions&&s.questions.length) h+='<div class="card"><b>AI asked '+s.questions.length+' questions to clarify requirements</b><ul>'+s.questions.map(q=>'<li>'+esc(clean(q))+'</li>').join('')+'</ul>'+(s.answers?'<p class="role">Answer: '+esc(clean(s.answers))+'</p>':'')+'</div>';
    h+='<h3 style="font-size:1.15em">'+(s.features||[]).length+' features</h3>'+((s.features||[]).map(featCard).join('')||'<p class="empty">No specs yet.</p>');
    if(s.po&&s.po.length) h+='<div class="card"><b>Open questions for the PO</b><ul>'+s.po.map(q=>'<li>'+esc(clean(q.replace(/^Câu hỏi cho PO:\s*/,'')))+'</li>').join('')+'</ul></div>';
  } else if(k==='tools'){
    h=head('tools');
    const P=s.project, pl=P&&P.pipeline;
    if(pl&&pl.online) h+='<div class="card"><b>Dashboard online</b>'+(P.canvas?'<p><a href="'+esc(P.canvas)+'" target="_blank" rel="noopener">Open workflow canvas ↗</a></p>':'')+(pl.runs.length?'<ul>'+pl.runs.map(x=>'<li>Run #'+x.id+' · ch-'+esc(String(x.chapter??'?').padStart(4,'0'))+' · '+esc(RUN[x.status]||x.status)+' · v'+esc(x.version)+'</li>').join('')+'</ul>':'<p class="note">No runs yet.</p>')+'</div>';
    else if(P) h+='<div class="card"><b>Dashboard offline</b><p class="note">Run <code>'+esc(P.startCommand||'')+'</code> in '+esc(P.dir)+'/</p></div>';
    const steps=story.filter(x=>x.st==='tools').filter((x,k,arr)=>!k||arr[k-1].txt!==x.txt);
    h+=steps.length?steps.slice().reverse().map(x=>'<div class="row"><span class="t">'+hhmm(x.t)+'</span><span>'+x.ic+' '+esc(x.txt)+'</span></div>').join(''):'<p class="empty">No tools used yet.</p>';
    const r=s.report; if(r&&r.shots.length) h+='<h3 style="font-size:1.15em">'+(s.project?'Latest chapter output':'Screenshots taken by the bot')+'</h3><div class="gal">'+r.shots.map(x=>'<figure><img src="'+base+x.url+'" alt="'+esc(x.label)+'"><figcaption>'+esc(x.label)+'</figcaption></figure>').join('')+'</div>';
  } else if(k==='judge'){
    h=head('judge');
    const inc=incidents(ev);
    h+='<h3 style="font-size:1.15em">Bugs caught and how the AI fixed them ('+inc.length+')</h3>';
    h+=inc.length?inc.map((x,n)=>incidentCard(x,n+1)).join(''):'<p class="empty">No bugs caught yet.</p>';
    const sum=fixSummary(ev);
    if(sum.length) h+='<div class="card"><b>AI’s own summary of what it fixed</b><ul>'+sum.map(t=>'<li>'+esc(clean(t))+'</li>').join('')+'</ul></div>';
    const checks=story.filter(x=>x.st==='judge'&&x.i&&x.i.res!=null);
    if(checks.length) h+='<h3 style="font-size:1.15em">Test run history</h3>'+checks.slice().reverse().map(x=>'<div class="row '+(x.i.ok?'ok':'bad')+'"><span class="t">'+hhmm(x.t)+'</span><span>'+esc(x.txt)+'</span></div>').join('');
    const r=s.report; if(r&&r.total) h+='<div class="card"><b>Latest '+(s.project?'pytest':'bot')+' run: '+r.ok+'/'+r.total+' checks passed</b>'+(s.project&&s.project.stale?'<p class="note">Code changed after this run, so re-run it: <code>'+esc(s.project.testCommand)+'</code></p>':'')+(r.fails.length?'<ul>'+r.fails.map(f=>'<li>'+esc(clean(f))+'</li>').join('')+'</ul>':'<p>No failing checks.</p>')+'</div>';
  } else if(k==='book'){
    h=head('book');
    const feats=s.features||[];
    h+=feats.length?feats.map(f=>'<div class="row"><span>'+ST[f.state]+'</span><span><b>'+esc(f.id)+' · '+esc(f.title)+'</b> · '+STX[f.state]+'</span></div>').join(''):'<p class="empty">No data yet.</p>';
    if(s.progress&&s.progress.length) h+='<h3 style="font-size:1.15em">'+(s.project?'Wiki log (latest entries)':'Progress log')+'</h3>'+s.progress.slice().reverse().map(l=>'<div class="row"><span>'+esc(clean(l))+'</span></div>').join('');
  }
  const p=$('panel'); const y=p.scrollTop; p.innerHTML=h; p.scrollTop=y;
  $('close').onclick=closeDlg;
}
function openDlg(k){openKey=k;fill(k);$('dlg').classList.add('open');$('close').focus();}
function closeDlg(){openKey=null;$('dlg').classList.remove('open');}
document.addEventListener('click',(e)=>{const z=e.target.closest('[data-zoom]'); if(z){$('zoomimg').src=z.src;$('zoom').classList.add('open');return;}
  if(e.target.closest('#zoom')){$('zoom').classList.remove('open');return;}
  const b=e.target.closest('[data-open],[data-feat]');if(b){openDlg(b.dataset.open||('feat:'+b.dataset.feat));return;}
  if(e.target===$('dlg')) closeDlg();});
document.addEventListener('keydown',(e)=>{if(e.key==='Escape'){if($('zoom').classList.contains('open'))$('zoom').classList.remove('open');else closeDlg();}});
// ---------- chọn game: trực tiếp (game đang làm) hoặc phát lại (game trước / bản mẫu) ----------
let es=null, liveTimer=null, loopId=0;
function stopAll(){ if(es){es.close();es=null;} if(liveTimer){clearInterval(liveTimer);liveTimer=null;} loopId++; closeDlg(); S=null; prev=null; }
function startLive(){
  stopAll(); document.body.classList.remove('replay-on'); $('mode').className='mode live'; $('mode').textContent='LIVE'; base='';
  es=new EventSource('/stream'); es.onmessage=(e)=>render(JSON.parse(e.data));
  liveTimer=setInterval(()=>S&&render(S),1000);
}
async function startReplay(id){
  stopAll(); const my=loopId;
  document.body.classList.add('replay-on'); $('mode').className='mode replay'; $('mode').textContent='REPLAY'; base='/s/'+id+'/';
  const F=await (await fetch('/frames?s='+encodeURIComponent(id))).json();
  if(my!==loopId||!F.length) return;
  const tl=[0]; for(let i=1;i<F.length;i++) tl.push(tl[i-1]+Math.min(F[i].t-F[i-1].t,6000));
  const total=tl[tl.length-1]||1;
  const q=new URLSearchParams(location.search);
  // chọn game cũ: hiện ngay kết quả cuối; bấm ▶ để xem lại từ đầu
  let speed=12, pos=q.has('at')?Math.max(0,Math.min(1,+q.get('at')))*total:total, playing=false, idx=-1, lastTs=performance.now();
  $('play').textContent=playing?'⏸':'▶';
  const show=(i)=>{ if(i===idx) return; if(i<idx) prev=null; idx=i; render(F[i].state, F[i].t); };
  document.querySelectorAll('[data-s]').forEach(b=>{b.classList.toggle('on',+b.dataset.s===speed);b.onclick=()=>{speed=+b.dataset.s;document.querySelectorAll('[data-s]').forEach(x=>x.classList.toggle('on',x===b));};});
  $('play').onclick=()=>{playing=!playing;$('play').textContent=playing?'⏸':'▶'; if(playing&&pos>=total){pos=0;idx=-1;prev=null;}};
  $('play').title='Replay from the start';
  $('seek').oninput=(e)=>{pos=e.target.value/1000*total;};
  (function loop(ts){ if(my!==loopId) return; if(playing){pos=Math.min(total,pos+(ts-lastTs)*speed); if(pos>=total){playing=false;$('play').textContent='▶';}}
    lastTs=ts; let i=0; while(i+1<tl.length&&tl[i+1]<=pos) i++; show(i);
    if(document.activeElement!==$('seek')) $('seek').value=Math.round(pos/total*1000);
    requestAnimationFrame(loop);})(lastTs);
}
async function loadGames(sel){
  const L=await (await fetch('/sessions')).json();
  $('pick').innerHTML=L.map(x=>'<option value="'+esc(x.id)+'"'+(x.id===sel?' selected':'')+'>'+(x.live?'● Live · ':x.sample?'Sample · ':'Replay · ')+esc(x.title||x.id)+(x.total?' ('+x.done+'/'+x.total+')':'')+'</option>').join('');
  return L;
}
$('pick').onchange=()=>{const id=$('pick').value; const live=$('pick').selectedOptions[0].textContent.startsWith('●'); if(live) startLive(); else startReplay(id);
  const u=new URL(location.href); u.searchParams.set('game',id); u.searchParams.delete('at'); history.replaceState(null,'',u);};
$('pick').onfocus=()=>loadGames($('pick').value);
(async()=>{
  const m=await (await fetch('/mode')).json();
  const want=new URLSearchParams(location.search).get('game')||m.start;
  const L=await loadGames(want);
  const g=L.find(x=>x.id===want)||L[0];
  if(g&&!g.live) startReplay(g.id); else startLive();
})();
</script></body></html>`;

server.on('error', (e) => {
  console.error(e.code === 'EADDRINUSE' ? `Cổng ${PORT} đang bận. Chạy lại với cổng khác, ví dụ: node 2-environment/monitor.mjs --port ${PORT + 1}` : e.message);
  process.exit(1);
});
server.listen(PORT, '127.0.0.1', () => {
  const url = `http://localhost:${PORT}`;
  console.log(`● Monitor ${ROOT}\n  ${url}${START_REPLAY ? '  (mở sẵn bản phát lại mẫu)' : ''}`);
  if (!has('--no-open')) {
    const [cmd, args] = process.platform === 'darwin' ? ['open', [url]] : process.platform === 'win32' ? ['cmd', ['/c', 'start', '', url]] : ['xdg-open', [url]];
    spawn(cmd, args, { stdio: 'ignore', detached: true }).on('error', () => {}).unref();
  }
});
pollPipeline().finally(() => { tick(); setInterval(tick, 700); setInterval(pollPipeline, 3000); });
