// Video demo Lãi Thật theo docs/DEMO_VIDEO_SCRIPT.md (F26) — quay tự động, không cần ffmpeg.
// Chạy:  node tools/demo_video.mjs        → brand/video/lai-that-demo.webm (+ khung-*.png để kiểm)
// Cách quay: CDP Page.startScreencast gửi khung hình CHỈ của trang app → một trang ghi riêng mã hoá bằng WebCodecs (VP8)
// rồi tự đóng gói WebM. Không dùng getDisplayMedia (có thể quay nhầm cả màn hình máy).
// Bot bấm như ngón tay (có chấm chạm), chữ chú thích to ở cuối màn. Không có âm thanh / lời đọc — nhóm lồng tiếng sau nếu cần.
import { spawn } from 'node:child_process';
import { existsSync } from 'node:fs';
import { mkdir, mkdtemp, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { startServer } from '../2-environment/serve.mjs';

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const OUT = path.join(ROOT, 'brand', 'video');
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
/** Giữ cảnh lâu hơn cho người xem kịp đọc chữ (nhịp video ≈ 2 phút). */
const hold = (ms) => sleep(ms * 1.6);

function findBrowser() {
  const found = [process.env.CHROME,
    'C:/Program Files/Google/Chrome/Application/chrome.exe', 'C:/Program Files (x86)/Google/Chrome/Application/chrome.exe',
    process.env.LOCALAPPDATA && `${process.env.LOCALAPPDATA}/Google/Chrome/Application/chrome.exe`,
    'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe', 'C:/Program Files/Microsoft/Edge/Application/msedge.exe',
    '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', '/usr/bin/google-chrome', '/usr/bin/chromium',
  ].filter(Boolean).find((p) => existsSync(p));
  if (!found) throw new Error('Không tìm thấy Chrome / Edge. Đặt biến CHROME=/đường/dẫn/chrome');
  return found;
}

async function launch(url) {
  const profile = await mkdtemp(path.join(tmpdir(), 'laithat-demo-'));
  const proc = spawn(findBrowser(), ['--headless=new', '--no-first-run', '--no-default-browser-check', '--remote-debugging-port=0',
    `--user-data-dir=${profile}`, '--disable-background-timer-throttling', '--disable-renderer-backgrounding', '--disable-backgrounding-occluded-windows',
    'about:blank'], { stdio: ['ignore', 'ignore', 'pipe'] });
  const wsUrl = await new Promise((resolve, reject) => {
    let buf = '';
    const t = setTimeout(() => reject(new Error('Trình duyệt không khởi động được')), 15000);
    proc.stderr.on('data', (d) => { buf += d; const m = buf.match(/DevTools listening on (ws:\/\/\S+)/); if (m) { clearTimeout(t); resolve(m[1]); } });
  });
  const ws = new WebSocket(wsUrl);
  await new Promise((r, j) => { ws.onopen = r; ws.onerror = j; });
  let id = 0;
  const pending = new Map();
  const listeners = [];
  ws.onmessage = (ev) => {
    const m = JSON.parse(ev.data);
    if (m.id && pending.has(m.id)) { const p = pending.get(m.id); pending.delete(m.id); m.error ? p.reject(new Error(m.error.message)) : p.resolve(m.result); } else if (m.method) listeners.forEach((fn) => fn(m));
  };
  const send = (method, params = {}, sessionId) => new Promise((resolve, reject) => { const i = ++id; pending.set(i, { resolve, reject }); ws.send(JSON.stringify({ id: i, method, params, sessionId })); });
  const open = async (u, w, h) => {
    const { targetId } = await send('Target.createTarget', { url: 'about:blank', newWindow: true });
    const { sessionId } = await send('Target.attachToTarget', { targetId, flatten: true });
    const page = (m, p) => send(m, p, sessionId);
    await page('Runtime.enable');
    await page('Page.enable');
    await page('Emulation.setDeviceMetricsOverride', { width: w, height: h, deviceScaleFactor: 2, mobile: true });
    await page('Page.navigate', { url: u });
    const js = async (expression, userGesture = false) => {
      const r = await page('Runtime.evaluate', { expression, awaitPromise: true, returnByValue: true, userGesture });
      if (r.exceptionDetails) throw new Error(r.exceptionDetails.exception?.description ?? r.exceptionDetails.text);
      return r.result.value;
    };
    return { page, js, sessionId };
  };
  const app = await open(url, 390, 844);
  const close = async () => { ws.close(); proc.kill(); await sleep(300); await rm(profile, { recursive: true, force: true }).catch(() => {}); };
  return { ...app, open, on: (fn) => listeners.push(fn), close };
}

/** Bộ ghi: trang riêng mã hoá từng khung screencast của trang app bằng WebCodecs (VP8, 15 khung/giây theo đồng hồ thật)
 *  rồi tự đóng gói WebM (EBML tối giản: Info có Duration, 1 track VP8, cụm mới ở mỗi khung khoá). Không cần vẽ ra màn hình. */
async function recorder(b, url) {
  const rec = await b.open(`${url}privacy.html`, 390, 844);
  await sleep(800);
  await rec.js(`(() => {
    const W = 780, H = 1688, FPS = 15;
    const enc = new VideoEncoder({
      output: (chunk) => { const d = new Uint8Array(chunk.byteLength); chunk.copyTo(d); window.__chunks.push({ d, ms: Math.round(chunk.timestamp / 1000), key: chunk.type === 'key' }); },
      error: (e) => { window.__err = String(e); },
    });
    enc.configure({ codec: 'vp8', width: W, height: H, bitrate: 1800000, framerate: FPS });
    window.__chunks = []; window.__enc = enc; window.__n = 0; window.__last = null;
    window.__draw = async (src) => { const blob = await (await fetch(src)).blob(); const bmp = await createImageBitmap(blob); window.__last?.close(); window.__last = bmp; };
    const t0 = performance.now();
    // Bơm khung đều theo đồng hồ thật: màn đứng yên thì lặp khung cũ, nên video dài đúng thời gian quay.
    window.__pump = () => {
      if (!window.__last) return;
      const target = Math.floor((performance.now() - t0) * FPS / 1000);
      while (window.__n <= target) {
        const f = new VideoFrame(window.__last, { timestamp: Math.round(window.__n * 1e6 / FPS) });
        enc.encode(f, { keyFrame: window.__n % (FPS * 2) === 0 });
        f.close(); window.__n += 1;
      }
    };
    window.__timer = setInterval(window.__pump, 1000 / FPS);
    window.__webm = async () => {
      clearInterval(window.__timer); window.__pump(); await enc.flush();
      const cat = (parts) => { const n = parts.reduce((s, p) => s + p.length, 0); const o = new Uint8Array(n); let i = 0; for (const p of parts) { o.set(p, i); i += p.length; } return o; };
      const size = (n) => { const b = new Uint8Array(8); b[0] = 1; for (let i = 7; i > 0; i--) { b[i] = n % 256; n = Math.floor(n / 256); } return b; };
      const el = (id, ...body) => { const d = cat(body); return cat([new Uint8Array(id), size(d.length), d]); };
      const u = (v, len = 8) => { const b = new Uint8Array(len); for (let i = len - 1; i >= 0; i--) { b[i] = v % 256; v = Math.floor(v / 256); } return b; };
      const s = (t) => new TextEncoder().encode(t);
      const f64 = (v) => { const b = new Uint8Array(8); new DataView(b.buffer).setFloat64(0, v); return b; };
      const ch = window.__chunks;
      const dur = ch.length ? ch[ch.length - 1].ms + Math.round(1000 / FPS) : 0;
      const header = el([0x1A, 0x45, 0xDF, 0xA3], el([0x42, 0x86], u(1, 1)), el([0x42, 0xF7], u(1, 1)), el([0x42, 0xF2], u(4, 1)), el([0x42, 0xF3], u(8, 1)),
        el([0x42, 0x82], s('webm')), el([0x42, 0x87], u(2, 1)), el([0x42, 0x85], u(2, 1)));
      const info = el([0x15, 0x49, 0xA9, 0x66], el([0x2A, 0xD7, 0xB1], u(1000000, 4)), el([0x44, 0x89], f64(dur)), el([0x4D, 0x80], s('Lai That demo')), el([0x57, 0x41], s('tools/demo_video.mjs')));
      const tracks = el([0x16, 0x54, 0xAE, 0x6B], el([0xAE], el([0xD7], u(1, 1)), el([0x73, 0xC5], u(1, 1)), el([0x83], u(1, 1)), el([0x86], s('V_VP8')),
        el([0xE0], el([0xB0], u(W, 2)), el([0xBA], u(H, 2)))));
      const clusters = [];
      let cur = null;
      for (const c of ch) {
        if (!cur || c.key || c.ms - cur.ms > 30000) { cur = { ms: c.ms, blocks: [] }; clusters.push(cur); }
        const rel = c.ms - cur.ms;
        cur.blocks.push(el([0xA3], new Uint8Array([0x81, (rel >> 8) & 0xff, rel & 0xff, c.key ? 0x80 : 0x00]), c.d));
      }
      const body = clusters.map((cl) => el([0x1F, 0x43, 0xB6, 0x75], el([0xE7], u(cl.ms, 4)), ...cl.blocks));
      // Cues (mục lục để tua): đặt trước các cụm; mọi số dùng độ dài cố định nên tính trước được kích thước.
      const cuePoint = (ms, pos) => el([0xBB], el([0xB3], u(ms, 8)), el([0xB7], el([0xF7], u(1, 1)), el([0xF1], u(pos, 8))));
      const cuesLen = el([0x1C, 0x53, 0xBB, 0x6B], ...clusters.map(() => cuePoint(0, 0))).length;
      let pos = info.length + tracks.length + cuesLen;
      const points = clusters.map((cl, i) => { const p = cuePoint(cl.ms, pos); pos += body[i].length; return p; });
      const cues = el([0x1C, 0x53, 0xBB, 0x6B], ...points);
      const file = cat([header, el([0x18, 0x53, 0x80, 0x67], info, tracks, cues, ...body)]);
      let out = ''; for (let i = 0; i < file.length; i += 0x8000) out += String.fromCharCode(...file.subarray(i, i + 0x8000));
      return { b64: btoa(out), frames: window.__n, ms: dur, err: window.__err ?? null };
    };
  })()`);
  let queue = Promise.resolve();
  let frames = 0;
  b.on((m) => {
    if (m.method !== 'Page.screencastFrame' || m.sessionId !== b.sessionId) return;
    b.page('Page.screencastFrameAck', { sessionId: m.params.sessionId }).catch(() => {});
    const src = `data:image/jpeg;base64,${m.params.data}`;
    frames += 1;
    queue = queue.then(() => rec.js(`window.__draw(${JSON.stringify(src)})`)).catch(() => {});
  });
  await b.page('Page.startScreencast', { format: 'jpeg', quality: 88, maxWidth: 780, maxHeight: 1688, everyNthFrame: 1 });
  return {
    frames: () => frames,
    async stop() {
      await b.page('Page.stopScreencast');
      await queue;
      await sleep(300);
      const r = await rec.js('window.__webm()');
      if (r.err) throw new Error(`Mã hoá video lỗi: ${r.err}`);
      console.log(`Đã mã hoá ${r.frames} khung · ${Math.round(r.ms / 1000)} giây`);
      return r.b64;
    },
  };
}

// Lớp chú thích + chấm chạm + thẻ tiêu đề (chỉ có trong video, không phải giao diện app)
const OVERLAY = `(() => {
  if (document.querySelector('#demo-style')) return;
  const st = document.createElement('style'); st.id = 'demo-style';
  st.textContent = \`
    #demo-cap{position:fixed;left:12px;right:12px;bottom:92px;z-index:1000;padding:14px 16px;border-radius:16px;background:rgba(18,22,28,.92);color:#fff;
      font:700 19px/1.35 'Be Vietnam Pro',sans-serif;text-align:center;box-shadow:0 12px 30px -10px rgba(0,0,0,.5);transition:opacity .3s;pointer-events:none}
    #demo-cap:empty{opacity:0}
    #demo-card{position:fixed;inset:0;z-index:1001;background:#12161C;color:#fff;display:flex;flex-direction:column;justify-content:center;padding:32px;gap:16px;
      font-family:'Be Vietnam Pro',sans-serif;transition:opacity .4s}
    #demo-card h1{font-size:30px;line-height:1.25;margin:0;font-weight:800}
    #demo-card p{font-size:18px;line-height:1.5;margin:0;color:#C9D1DA}
    #demo-card b.n{color:#3CC2AE}
    #demo-card table{border-collapse:collapse;font-size:14px;color:#E6EAEE}
    #demo-card td{padding:5px 6px;border-bottom:1px solid #2A313B} #demo-card td:last-child{text-align:right;color:#3CC2AE;font-weight:700}
    .demo-tap{position:fixed;z-index:1002;width:44px;height:44px;margin:-22px 0 0 -22px;border-radius:50%;background:rgba(10,122,107,.35);border:2px solid #0A7A6B;
      pointer-events:none;animation:demotap .5s ease-out forwards}
    @keyframes demotap{from{transform:scale(.4);opacity:1}to{transform:scale(1.3);opacity:0}}\`;
  document.head.appendChild(st);
  const cap = document.createElement('div'); cap.id = 'demo-cap'; document.body.appendChild(cap);
})()`;

async function main() {
  await mkdir(OUT, { recursive: true });
  const server = await startServer(0);
  const url = `http://127.0.0.1:${server.address().port}/`;
  const b = await launch(url);
  try {
    for (let i = 0; i < 60; i++) { await sleep(100); if (await b.js('document.readyState === "complete" && !!window.__app').catch(() => false)) break; }
    await b.js("window.__app.setConfig({ pro_gates_enabled: false, ads_enabled: false })");
    for (let i = 0; i < 40; i++) { await sleep(100); if (!(await b.js('!!document.querySelector("#splash")'))) break; }
    await b.js(OVERLAY);

    const cap = (t) => b.js(`(() => { const c = document.querySelector('#demo-cap'); if (c) c.textContent = ${JSON.stringify(t)}; })()`);
    const card = (html) => b.js(`(() => { let c = document.querySelector('#demo-card'); if (!c) { c = document.createElement('div'); c.id = 'demo-card'; document.body.appendChild(c); } c.style.opacity = 1; c.innerHTML = ${JSON.stringify(html)}; })()`);
    const uncard = async () => { await b.js(`(() => { const c = document.querySelector('#demo-card'); if (c) c.style.opacity = 0; })()`); await sleep(450); await b.js(`document.querySelector('#demo-card')?.remove()`); };
    const center = (sel) => b.js(`(() => { const el = document.querySelector(${JSON.stringify(sel)}); if (!el) return null; el.scrollIntoView({ block: 'center', behavior: 'instant' }); const r = el.getBoundingClientRect(); return { x: r.x + r.width / 2, y: r.y + r.height / 2 }; })()`);
    const tap = async (sel, pause = 700) => {
      const p = await center(sel);
      if (!p) throw new Error(`Không thấy ${sel}`);
      await sleep(250);
      await b.js(`(() => { const d = document.createElement('div'); d.className = 'demo-tap'; d.style.left = '${p.x}px'; d.style.top = '${p.y}px'; document.body.appendChild(d); setTimeout(() => d.remove(), 600); })()`);
      for (const type of ['mousePressed', 'mouseReleased']) await b.page('Input.dispatchMouseEvent', { type, x: p.x, y: p.y, button: 'left', clickCount: 1 });
      await sleep(pause);
      await b.js(OVERLAY);
    };
    const typeSlow = async (sel, text) => {
      await tap(sel, 200);
      await b.js(`(() => { const el = document.querySelector(${JSON.stringify(sel)}); el.focus(); el.select?.(); })()`);
      for (const ch of text) { await b.page('Input.insertText', { text: ch }); await sleep(110); }
      await sleep(500);
    };
    const scrollBy = async (dy, steps = 12) => { for (let i = 0; i < steps; i++) { await b.js(`window.scrollBy(0, ${dy / steps})`); await sleep(40); } };
    const select = (sel, v) => b.js(`(() => { const el = document.querySelector(${JSON.stringify(sel)}); el.value = ${JSON.stringify(v)}; el.dispatchEvent(new Event('change', { bubbles: true })); })()`);
    const frames = [];
    const still = async (name) => { const { data } = await b.page('Page.captureScreenshot', { format: 'png' }); frames.push(name); await writeFile(path.join(OUT, `khung-${name}.png`), Buffer.from(data, 'base64')); };

    // App mới tinh (màn Chọn sàn) — tải lại TRƯỚC khi ghi, vì tải lại giữa chừng sẽ dừng bộ ghi.
    await b.js(`localStorage.clear(); location.reload()`);
    await sleep(500);
    for (let i = 0; i < 60; i++) { await sleep(100); if (await b.js('!!window.__app').catch(() => false)) break; }
    for (let i = 0; i < 40; i++) { await sleep(100); if (!(await b.js('!!document.querySelector("#splash")'))) break; }
    await b.js(OVERLAY);

    // Bắt đầu ghi tab
    const rec = await recorder(b, url);
    console.log('Đang quay trang app (780×1688)…');

    // 0:00–0:15 — vấn đề
    await card('<p>Người bán hàng online</p><h1>Phí sàn lên <b class="n">23–25%</b> doanh thu.</h1><p>Vẫn đi xin file Excel để biết mình lãi bao nhiêu.</p>');
    await hold(6000);
    await card('<h1>Lãi Thật</h1><p>Tính lãi thật mỗi đơn sau phí sàn — và giá nên bán.</p>');
    await hold(4000);
    // 0:15–0:30 — mở app (màn mở app có logo), chọn sàn
    await b.js(`import('./splash.js').then((m) => m.showSplash())`);
    await sleep(150);
    await b.js(`document.querySelector('#demo-card')?.remove()`);
    await hold(1700);
    await cap('Không cần đăng nhập — chọn sàn là dùng.');
    await hold(1500);
    await tap('#pf-shopee', 900);
    await tap('#onboard-continue', 1200);

    // 0:30–0:55 — tính móc khóa
    await cap('Móc khóa: vốn 8.000đ, bán 17.000đ, gói 1.500đ');
    await select('#category', 'Sở thích & Sưu tầm');
    await sleep(900);
    await typeSlow('#cost', '8000');
    await typeSlow('#price', '17000');
    await tap('#other-costs', 500);
    await typeSlow('#pack', '1500');
    if (await b.js('!!document.querySelector("#key-done")')) await tap('#key-done', 500);
    await b.js('window.scrollTo({ top: 0, behavior: "smooth" })');
    await cap('505đ · Lãi mỏng 3,0% · Hòa vốn 16.340đ');
    await hold(3500);
    await still('1-tinh');
    await cap('Sàn và thuế lấy 41% giá bán.');
    await hold(3000);

    // 0:55–1:15 — chi tiết phí
    await tap('#to-breakdown', 1200);
    await cap('Mỗi khoản phí có cách tính, nguồn và ngày.');
    await tap('.fee-line[data-key="transaction"] .fee-info', 2600);
    await still('2-chi-tiet');
    await cap('Bật gói voucher — thấy lãi giảm ngay.');
    if (await b.js('!!document.querySelector("#prog-voucher_xtra")')) await tap('#prog-voucher_xtra', 2500);
    else if (await b.js('!!document.querySelector("#prog-piship")')) await tap('#prog-piship', 2500);
    if (await b.js('!!document.querySelector("#prog-voucher_xtra:checked")')) await tap('#prog-voucher_xtra', 900);
    if (await b.js('!!document.querySelector("#prog-piship:checked")')) await tap('#prog-piship', 900);

    // 1:15–1:40 — từ % lãi
    await cap('');
    await b.js(`history.back()`);
    await sleep(900);
    await b.js(OVERLAY);
    await tap('#mode-margin', 1200);
    await cap('Muốn lãi 20%: giá nên bán 22.900đ, lãi 5.018đ.');
    await hold(3500);
    await still('3-tu-lai');
    await scrollBy(520, 20);
    await cap('Flash Sale giảm 30% là lỗ. Giá nhập tối đa 8.438đ.');
    await hold(4000);
    await b.js('window.scrollTo({ top: 0, behavior: "smooth" })');
    await sleep(600);
    await tap('#mode-price', 900);

    // 1:40–1:55 — so sánh sàn
    await tap('#tab-so-sanh', 1200);
    await cap('Cùng sản phẩm: TikTok Shop lãi 1.015đ, Shopee 505đ.');
    await hold(4500);
    await still('4-so-sanh');

    // 1:55–2:15 — danh mục + báo động đổi phí
    await tap('#tab-san-pham', 900);
    await cap('Lưu sản phẩm — theo dõi lãi cả danh mục.');
    await tap('#load-examples', 1800);
    await b.js(`(async () => { const p = await (await fetch('assets/fee_presets.json', { cache: 'no-store' })).json();
      p.fee_version = '2026-12-01.1'; p.platforms.shopee.transaction_fee.rate = 0.09; return window.__app.receivePresets(p); })()`);
    await sleep(800);
    await b.js(OVERLAY);
    await b.js('window.scrollTo({ top: 0, behavior: "smooth" })');
    await cap('Sàn đổi phí: app báo sản phẩm nào chuyển lỗ…');
    await hold(3500);
    await still('5-bao-dong');
    await tap('#fee-alert-action', 1200);
    await cap('…và nên bán giá nào.');
    await hold(3500);

    // 2:15–2:30 — đối chiếu đơn thật
    await cap('');
    await card(`<p>Đối chiếu với đơn Shopee thật</p><h1><b class="n">8/8</b> đơn khớp</h1>
      <table>${[['Keo sữa', '34.298đ', '34.297đ'], ['Đệm topper', '99.320đ', '99.320đ'], ['Đồ điện tử', '131.865đ', '131.865đ'], ['Thức ăn mèo', '56.014đ', '56.014đ'],
        ['Thức ăn mèo', '51.600đ', '51.600đ'], ['Mỹ phẩm', '88.200đ', '88.200đ'], ['Thời trang', '167.572đ', '167.572đ'], ['Thời trang', '111.998đ', '111.998đ']]
        .map(([n, a, c]) => `<tr><td>${n}</td><td>sàn trừ ${a}</td><td>app ${c}</td></tr>`).join('')}</table>
      <p>App được build bằng AI theo mẫu LLM Wiki.</p>`);
    await hold(6500);
    await still('6-doi-chieu');
    await card('<h1>Lãi Thật</h1><p>Biết lãi thật trước khi bán.</p><p style="font-size:13px">Công cụ độc lập, không liên kết với sàn nào.</p>');
    await hold(3500);

    // Dừng ghi, lưu file
    console.log(`Đã nhận ${rec.frames()} khung từ trang app`);
    const data = await rec.stop();
    const file = path.join(OUT, 'lai-that-demo.webm');
    await writeFile(file, Buffer.from(data, 'base64'));
    console.log(`Video: brand/video/lai-that-demo.webm (${Math.round(Buffer.from(data, 'base64').length / 1024)} KB) · khung kiểm: ${frames.join(', ')}`);
  } finally {
    await b.close();
    server.close();
  }
}
main().catch((e) => { console.error(e); process.exit(1); });
