#!/usr/bin/env node
// Harness Automation Test — bot tự mở app trong Chrome, tự bấm/gõ như người, chụp ảnh từng bước,
// rồi viết báo cáo. Đây là "mắt" của harness: AI không tự nhìn được app, bot nhìn thay.
//
//   node 2-environment/bot.mjs            → chơi, ghi reports/latest/report.html
//   node 2-environment/bot.mjs --quiet    → chỉ in kết quả (verify.sh dùng)
//   GAME_DIR=/thư-mục node 2-environment/bot.mjs → chấm game ở thư mục khác (chỉ kiểm tra chung nếu không có window.__game)
//   node 2-environment/bot.mjs --look     → chỉ MỞ game, chụp 1 ảnh điện thoại + kiểm design → reports/look/look.png
//                                           (AI đọc ảnh đó bằng Read để TỰ NHÌN giao diện mình vừa làm)
//
// Không cần cài gì thêm: điều khiển Chrome qua DevTools Protocol bằng WebSocket có sẵn của Node 22.
import { spawn } from 'node:child_process';
import { existsSync } from 'node:fs';
import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { startServer, APP_DIR } from './serve.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const LOOK = process.argv.includes('--look');
const OUT = path.join(HERE, '..', 'reports', LOOK ? 'look' : 'latest');
const GAME = path.resolve(process.env.GAME_DIR ?? path.join(HERE, '..', APP_DIR));
const QUIET = process.argv.includes('--quiet');
const log = (...a) => { if (!QUIET) console.log(...a); };

export function findChrome() {
  const candidates = [
    process.env.CHROME,
    '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
    '/Applications/Chromium.app/Contents/MacOS/Chromium',
    '/usr/bin/google-chrome', '/usr/bin/google-chrome-stable', '/usr/bin/chromium', '/usr/bin/chromium-browser',
    'C:/Program Files/Google/Chrome/Application/chrome.exe',
    'C:/Program Files (x86)/Google/Chrome/Application/chrome.exe',
    process.env.LOCALAPPDATA && `${process.env.LOCALAPPDATA}/Google/Chrome/Application/chrome.exe`,
    // không có Chrome thì dùng Microsoft Edge (cũng là Chromium, máy Windows nào cũng có)
    'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe', 'C:/Program Files/Microsoft/Edge/Application/msedge.exe',
    '/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge',
  ].filter(Boolean);
  const found = candidates.find((p) => existsSync(p));
  if (!found) throw new Error('Không tìm thấy Chrome. Cài Google Chrome hoặc đặt biến CHROME=/đường/dẫn/chrome');
  return found;
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function launchChrome() {
  const profile = await mkdtemp(path.join(tmpdir(), 'mini-harness-'));
  const proc = spawn(findChrome(), [
    '--headless=new', '--disable-gpu', '--enable-unsafe-swiftshader', '--no-first-run', '--no-default-browser-check',
    '--remote-debugging-port=0', `--user-data-dir=${profile}`, '--window-size=390,844', 'about:blank',
  ], { stdio: ['ignore', 'ignore', 'pipe'] });
  const wsUrl = await new Promise((resolve, reject) => {
    let buf = '';
    const timer = setTimeout(() => reject(new Error('Chrome không khởi động được')), 15000);
    proc.stderr.on('data', (d) => {
      buf += d;
      const m = buf.match(/DevTools listening on (ws:\/\/\S+)/);
      if (m) { clearTimeout(timer); resolve(m[1]); }
    });
  });
  return { proc, profile, wsUrl };
}

/** Kết nối CDP tối giản: send(method, params) và nghe sự kiện. */
async function connect(wsUrl) {
  const ws = new WebSocket(wsUrl);
  await new Promise((r, j) => { ws.onopen = r; ws.onerror = j; });
  let id = 0;
  const pending = new Map();
  const listeners = [];
  ws.onmessage = (ev) => {
    const msg = JSON.parse(ev.data);
    if (msg.id && pending.has(msg.id)) {
      const { resolve, reject } = pending.get(msg.id);
      pending.delete(msg.id);
      msg.error ? reject(new Error(msg.error.message)) : resolve(msg.result);
    } else if (msg.method) listeners.forEach((fn) => fn(msg));
  };
  const send = (method, params = {}, sessionId) =>
    new Promise((resolve, reject) => {
      const msgId = ++id;
      pending.set(msgId, { resolve, reject });
      ws.send(JSON.stringify({ id: msgId, method, params, sessionId }));
    });
  return { send, on: (fn) => listeners.push(fn), close: () => ws.close() };
}

async function run() {
  await rm(OUT, { recursive: true, force: true });
  await mkdir(OUT, { recursive: true });

  const server = await startServer(0);
  const url = `http://127.0.0.1:${server.address().port}/`;
  const chrome = await launchChrome();
  const cdp = await connect(chrome.wsUrl);

  const { targetId } = await cdp.send('Target.createTarget', { url: 'about:blank' });
  const { sessionId } = await cdp.send('Target.attachToTarget', { targetId, flatten: true });
  const page = (m, p) => cdp.send(m, p, sessionId);

  const errors = [];
  cdp.on((msg) => {
    if (msg.sessionId !== sessionId) return;
    if (msg.method === 'Runtime.exceptionThrown') errors.push(msg.params.exceptionDetails.exception?.description ?? msg.params.exceptionDetails.text);
    if (msg.method === 'Runtime.consoleAPICalled' && msg.params.type === 'error') errors.push(msg.params.args.map((a) => a.value ?? a.description).join(' '));
  });
  await page('Runtime.enable');
  await page('Page.enable');
  await page('Emulation.setDeviceMetricsOverride', { width: 390, height: 844, deviceScaleFactor: 2, mobile: true });

  const evaluate = async (expression) => {
    const r = await page('Runtime.evaluate', { expression, awaitPromise: true, returnByValue: true });
    if (r.exceptionDetails) throw new Error(r.exceptionDetails.exception?.description ?? r.exceptionDetails.text);
    return r.result.value;
  };
  const shots = [];
  const overflowAt = []; // màn nào bị tràn ngang (kiểm ở mỗi lần chụp, không chỉ màn đầu)
  const shot = async (label) => {
    // So với bề rộng màn hình máy (390): ở chế độ điện thoại, trang tràn thì trình duyệt nới rộng cả viewport nên không so với innerWidth được.
    const wide = await evaluate('Math.max(document.documentElement.scrollWidth, innerWidth) - screen.width').catch(() => 0);
    if (wide > 1) overflowAt.push(`${label} (+${wide}px)`);
    const { data } = await page('Page.captureScreenshot', { format: 'png' });
    const file = `${String(shots.length + 1).padStart(2, '0')}.png`;
    await writeFile(path.join(OUT, file), Buffer.from(data, 'base64'));
    shots.push({ file, label });
  };
  const checks = [];
  const check = (name, ok, detail = '') => { checks.push({ name, ok, detail }); log(`${ok ? '✓' : '✗'} ${name}${detail ? ` — ${detail}` : ''}`); };

  try {
    await page('Page.navigate', { url });
    let ready = false;
    for (let i = 0; i < 50 && !ready; i++) { await sleep(100); ready = await evaluate('document.readyState === "complete" && !!(window.__app || window.__game)').catch(() => false); }
    const opened = ready || await evaluate('document.readyState === "complete"').catch(() => false);
    check('App mở được', opened);
    if (!opened) throw new Error('stop');
    // Không có window.__game (game làm ngoài harness): vẫn chạy các kiểm tra chung bên dưới, chỉ bỏ kịch bản riêng.
    check('Có window.__app để bot đọc trạng thái', ready, ready ? '' : 'không có — chỉ chạy được kiểm tra chung');
    await sleep(LOOK ? 1500 : 300);
    await shot('Mở app');

    // Kiểm tra design chung (mọi game): xem 1-wiki/design/README.md mục 7.
    const ui = await evaluate(`(() => {
      const font = getComputedStyle(document.body).fontFamily.toLowerCase();
      const overflow = document.documentElement.scrollWidth - innerWidth;
      const imgs = [...document.images];
      const broken = imgs.filter((i) => i.complete && i.naturalWidth === 0).map((i) => i.getAttribute('src'));
      const clickable = [...document.querySelectorAll('button, [role=button], a[href]')]
        .filter((el) => { const r = el.getBoundingClientRect(); const s = getComputedStyle(el);
          return r.width > 0 && r.height > 0 && s.visibility !== 'hidden' && s.display !== 'none'; });
      const small = clickable.filter((el) => { const r = el.getBoundingClientRect(); return r.width < 40 || r.height < 40; })
        .map((el) => (el.id ? '#' + el.id : el.tagName.toLowerCase()) + ' ' + Math.round(el.getBoundingClientRect().width) + '×' + Math.round(el.getBoundingClientRect().height));
      const greyBtn = clickable.filter((el) => el.tagName === 'BUTTON' && getComputedStyle(el).backgroundColor === 'rgb(239, 239, 239)').length;
      // Nút vô hình mà vẫn bấm được: người chơi chạm vào chỗ trống lại kích hoạt nút ẩn.
      const seen = (el) => { for (let e = el; e; e = e.parentElement) if (+getComputedStyle(e).opacity === 0) return false; return true; };
      const ghost = clickable.filter((el) => !seen(el) && getComputedStyle(el).pointerEvents !== 'none')
        .map((el) => (el.id ? '#' + el.id : el.tagName.toLowerCase()));
      // Nút bị đẩy ra ngoài mép màn hình (trang có overflow:hidden nên không hiện thanh cuộn, người chơi không với tới).
      const offscreen = clickable.filter((el) => { const r = el.getBoundingClientRect(); return r.left < -1 || r.right > innerWidth + 1; })
        .map((el) => (el.id ? '#' + el.id : el.tagName.toLowerCase()) + ' ' + Math.round(el.getBoundingClientRect().left) + '→' + Math.round(el.getBoundingClientRect().right) + 'px');
      return { font, overflow, broken, small, greyBtn, ghost, offscreen };
    })()`);
    const defaultFont = /^("?times new roman"?|serif|"?times"?)(,|$)/.test(ui.font);
    check('Design: không dùng font mặc định của trình duyệt', !defaultFont, ui.font.split(',')[0]);
    check('Design: không tràn ngang trên màn điện thoại 390px', ui.overflow <= 1, ui.overflow > 1 ? `tràn ${ui.overflow}px` : '');
    check('Design: mọi hình ảnh tải được', ui.broken.length === 0, ui.broken.slice(0, 3).join(', '));
    check('Design: vật bấm được ≥ 40px (vừa ngón tay)', ui.small.length === 0, ui.small.slice(0, 3).join(', '));
    check('Design: không còn nút xám mặc định', ui.greyBtn === 0, ui.greyBtn ? `${ui.greyBtn} nút` : '');
    check('Không có nút vô hình mà vẫn bấm được', ui.ghost.length === 0, ui.ghost.slice(0, 3).join(', '));
    check('Mọi nút nằm trọn trong màn hình 390px', ui.offscreen.length === 0, ui.offscreen.slice(0, 3).join(', '));

    // Kịch bản chơi RIÊNG của từng game nằm trong game/e2e.mjs (AI viết thêm khi làm tính năng có giao diện).
    const scenario = path.join(GAME, 'e2e.mjs');
    if (LOOK || !ready) {
      log(`Ảnh: ${path.join(OUT, '01.png')} — mở bằng Read để xem`);
    } else if (existsSync(scenario)) {
      const { play } = await import(pathToFileURL(scenario).href);
      // Chạm như NGÓN TAY: bấm vào giữa vật trên màn hình, không gọi el.click() trong code.
      // Nếu vật khác đè lên (vật bị che, lớp vô hình) thì ngón tay không trúng → báo lỗi, đúng như người chơi gặp.
      const click = async (selector) => {
        const hit = await evaluate(`(() => {
          const el = document.querySelector(${JSON.stringify(selector)});
          if (!el) return { err: 'Không thấy ' + ${JSON.stringify(selector)} };
          el.scrollIntoView({ block: 'center', inline: 'center' });
          const r = el.getBoundingClientRect(), x = r.x + r.width / 2, y = r.y + r.height / 2;
          const top = document.elementFromPoint(x, y);
          if (!top || !(el === top || el.contains(top)))
            return { err: 'Ngón tay chạm giữa ' + ${JSON.stringify(selector)} + ' nhưng trúng ' + (top ? (top.id ? '#' + top.id : top.tagName.toLowerCase() + (top.className ? '.' + String(top.className).split(' ')[0] : '')) : 'khoảng trống') + ' (bị che)' };
          return { x, y };
        })()`);
        if (hit.err) throw new Error(hit.err);
        for (const type of ['mousePressed', 'mouseReleased']) await page('Input.dispatchMouseEvent', { type, x: hit.x, y: hit.y, button: 'left', clickCount: 1 });
      };
      // Game vẽ bằng <canvas> (Three.js): không có selector cho từng vật → chạm theo toạ độ màn hình.
      // Game tự cho biết vật nằm đâu: window.__game.screenOf(id) → {x, y}. Bot chạm đúng chỗ đó như ngón tay,
      // game phải tự raycast ra vật — nên chạm trượt/bị che sẽ lộ ra, không lách được.
      const tap = async (x, y) => {
        for (const type of ['mousePressed', 'mouseReleased']) await page('Input.dispatchMouseEvent', { type, x, y, button: 'left', clickCount: 1 });
      };
      // Gõ chữ như bàn phím: chạm vào ô (như ngón tay), bôi đen nội dung cũ, rồi gõ đè (hoặc xoá nếu text rỗng).
      const type = async (selector, text) => {
        await click(selector);
        await evaluate(`(() => { const el = document.querySelector(${JSON.stringify(selector)}); el.focus(); el.select?.(); })()`);
        if (String(text) === '') await evaluate(`document.execCommand('delete')`);
        else await page('Input.insertText', { text: String(text) });
      };
      await play({ evaluate, click, tap, type, shot, check, sleep });
    } else {
      check(`Có kịch bản ${APP_DIR}/e2e.mjs`, false, 'chưa có — tính năng có giao diện phải thêm kịch bản để bot bấm thử');
    }
    if (!LOOK && ready) check('Design: không tràn ngang ở mọi màn bot đã chụp', overflowAt.length === 0, overflowAt.slice(0, 3).join(', '));
    check('Không có lỗi JavaScript trên trang', errors.length === 0, errors.slice(0, 2).join(' | '));
  } catch (e) {
    if (e.message !== 'stop') check('Bot chạy hết kịch bản', false, e.message);
  } finally {
    cdp.close();
    chrome.proc.kill();
    server.close();
    await rm(chrome.profile, { recursive: true, force: true }).catch(() => {});
  }

  const passed = checks.every((c) => c.ok);
  await writeFile(path.join(OUT, 'report.json'), JSON.stringify({ passed, checks, shots, at: new Date().toISOString() }, null, 2));
  await writeFile(path.join(OUT, 'report.html'), reportHtml(passed, checks, shots));
  console.log(passed ? '🟢 Automation test: ĐẠT' : '🔴 Automation test: CHƯA ĐẠT');
  if (!QUIET) console.log(`Báo cáo: ${path.join(OUT, 'report.html')}`);
  return passed;
}

function reportHtml(passed, checks, shots) {
  const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);
  return `<!doctype html><meta charset="utf-8"><title>Báo cáo automation test</title>
<style>body{font:16px system-ui;margin:24px;background:#F6F1E7;color:#1D1B26}h1{margin:0 0 4px}.ok{color:#0F7A70}.no{color:#B23A2A}
ul{padding-left:20px}.grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(180px,1fr));gap:12px;margin-top:16px}
figure{margin:0;background:#fff;border-radius:12px;padding:8px}img{width:100%;border-radius:8px}figcaption{font-size:13px;margin-top:6px}</style>
<h1 class="${passed ? 'ok' : 'no'}">${passed ? '🟢 ĐẠT' : '🔴 CHƯA ĐẠT'}</h1><p>${new Date().toLocaleString('vi-VN')}</p>
<ul>${checks.map((c) => `<li class="${c.ok ? 'ok' : 'no'}">${c.ok ? '✓' : '✗'} ${esc(c.name)}${c.detail ? ` — ${esc(c.detail)}` : ''}</li>`).join('')}</ul>
<div class="grid">${shots.map((s) => `<figure><img src="${s.file}"><figcaption>${esc(s.label)}</figcaption></figure>`).join('')}</div>`;
}

process.exit((await run()) ? 0 : 1);
