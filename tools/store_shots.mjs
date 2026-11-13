// Bộ ảnh Google Play cho Lãi Thật (F26): 7 ảnh điện thoại 1080×1920 có chú thích, ảnh đồ hoạ 1024×500, icon 512.
// Chạy:  node tools/store_shots.mjs        → brand/store/
// Luật store (docs/LAUNCH_CHECKLIST.md): không tên / logo / màu của sàn trong ảnh → tên sàn trên màn được thay bằng "Sàn A/B/C".
import { spawn } from 'node:child_process';
import { mkdir, mkdtemp, writeFile, copyFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { startServer } from '../2-environment/serve.mjs';
import { existsSync } from 'node:fs';

// Như 2-environment/bot.mjs (không import file đó vì import là chạy bot).
function findChrome() {
  const found = [process.env.CHROME,
    'C:/Program Files/Google/Chrome/Application/chrome.exe', 'C:/Program Files (x86)/Google/Chrome/Application/chrome.exe',
    process.env.LOCALAPPDATA && `${process.env.LOCALAPPDATA}/Google/Chrome/Application/chrome.exe`,
    'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe', 'C:/Program Files/Microsoft/Edge/Application/msedge.exe',
    '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', '/usr/bin/google-chrome', '/usr/bin/chromium',
  ].filter(Boolean).find((p) => existsSync(p));
  if (!found) throw new Error('Không tìm thấy Chrome / Edge. Đặt biến CHROME=/đường/dẫn/chrome');
  return found;
}

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const OUT = path.join(ROOT, 'brand', 'store');
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const SHOTS = [
  { key: 'tinh', caption: 'Bán 17.000đ lãi bao nhiêu?\nBiết ngay: 505đ' },
  { key: 'chi-tiet', caption: 'Từng khoản phí sàn\ncó nguồn và ngày cập nhật' },
  { key: 'margin', caption: 'Muốn lãi 20%?\nBán 22.900đ là đẹp' },
  { key: 'so-sanh', caption: 'Cùng sản phẩm,\nsàn nào lãi hơn' },
  { key: 'danh-muc', caption: 'Lãi từng sản phẩm\ntrên mọi sàn bạn bán' },
  { key: 'bao-dong', caption: 'Sàn đổi phí?\nBiết món nào chuyển lỗ' },
  { key: 'combo', caption: 'Bán lẻ lãi 1.515đ,\ngộp combo lãi 6.614đ' },
  { key: 'kiem-tra', caption: 'Sàn trừ đúng chưa?\nKiểm tra từng khoản' },
];

async function launch() {
  const profile = await mkdtemp(path.join(tmpdir(), 'laithat-store-'));
  const proc = spawn(findChrome(), ['--headless=new', '--disable-gpu', '--no-first-run', '--no-default-browser-check',
    '--remote-debugging-port=0', `--user-data-dir=${profile}`, 'about:blank'], { stdio: ['ignore', 'ignore', 'pipe'] });
  const wsUrl = await new Promise((resolve, reject) => {
    let buf = '';
    const timer = setTimeout(() => reject(new Error('Chrome không khởi động được')), 15000);
    proc.stderr.on('data', (d) => { buf += d; const m = buf.match(/DevTools listening on (ws:\/\/\S+)/); if (m) { clearTimeout(timer); resolve(m[1]); } });
  });
  const ws = new WebSocket(wsUrl);
  await new Promise((r, j) => { ws.onopen = r; ws.onerror = j; });
  let id = 0;
  const pending = new Map();
  ws.onmessage = (ev) => { const m = JSON.parse(ev.data); if (m.id && pending.has(m.id)) { const p = pending.get(m.id); pending.delete(m.id); m.error ? p.reject(new Error(m.error.message)) : p.resolve(m.result); } };
  const send = (method, params = {}, sessionId) => new Promise((resolve, reject) => { const i = ++id; pending.set(i, { resolve, reject }); ws.send(JSON.stringify({ id: i, method, params, sessionId })); });
  const { targetId } = await send('Target.createTarget', { url: 'about:blank' });
  const { sessionId } = await send('Target.attachToTarget', { targetId, flatten: true });
  const page = (m, p) => send(m, p, sessionId);
  await page('Runtime.enable');
  await page('Page.enable');
  const js = async (expression) => {
    const r = await page('Runtime.evaluate', { expression, awaitPromise: true, returnByValue: true });
    if (r.exceptionDetails) throw new Error(r.exceptionDetails.exception?.description ?? r.exceptionDetails.text);
    return r.result.value;
  };
  const close = async () => { ws.close(); proc.kill(); await sleep(300); await rm(profile, { recursive: true, force: true }).catch(() => {}); };
  return { page, js, close };
}

/** Thay tên sàn bằng nhãn trung tính trong mọi chữ trên màn (chỉ cho ảnh store). */
const NEUTRAL = `(() => {
  const map = [[/TikTok Shop/g, 'Sàn B'], [/TikTok/g, 'Sàn B'], [/Shopee/g, 'Sàn A'], [/Lazada/g, 'Sàn C']];
  const w = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
  for (let n = w.nextNode(); n; n = w.nextNode()) { let t = n.nodeValue; for (const [a, b] of map) t = t.replace(a, b); if (t !== n.nodeValue) n.nodeValue = t; }
  document.querySelectorAll('input, select').forEach((el) => { for (const [a, b] of map) if (el.value && a.test(el.value)) el.value = el.value.replace(a, b); });
  document.querySelectorAll('.toast').forEach((t) => t.remove());
})()`;

async function main() {
  await mkdir(OUT, { recursive: true });
  const server = await startServer(0);
  const url = `http://127.0.0.1:${server.address().port}/`;
  const b = await launch();
  const raw = {};
  try {
    await b.page('Emulation.setDeviceMetricsOverride', { width: 390, height: 844, deviceScaleFactor: 2, mobile: true });
    await b.page('Page.navigate', { url });
    for (let i = 0; i < 60; i++) { await sleep(100); if (await b.js('document.readyState === "complete" && !!window.__app').catch(() => false)) break; }
    await b.js("window.__app.setConfig({ pro_gates_enabled: false, ads_enabled: false })");
    for (let i = 0; i < 40; i++) { await sleep(100); if (!(await b.js('!!document.querySelector("#splash")'))) break; }
    const click = (sel) => b.js(`document.querySelector(${JSON.stringify(sel)}).click()`);
    const setVal = (sel, v, ev = 'input') => b.js(`(() => { const el = document.querySelector(${JSON.stringify(sel)}); el.value = ${JSON.stringify(v)}; el.dispatchEvent(new Event(${JSON.stringify(ev)}, { bubbles: true })); })()`);
    const go = async (hash) => { await b.js(`location.hash = ${JSON.stringify(hash)}`); await sleep(500); };
    const shoot = async (key) => {
      await b.js('window.scrollTo(0, 0); document.activeElement?.blur?.()');
      await sleep(350);
      await b.js(NEUTRAL);
      const { data } = await b.page('Page.captureScreenshot', { format: 'png' });
      raw[key] = data;
    };

    // Chọn sàn → tính móc khóa
    await click('#pf-shopee'); await sleep(150);
    await click('#onboard-continue'); await sleep(500);
    await setVal('#category', 'Sở thích & Sưu tầm', 'change'); await sleep(200);
    await setVal('#cost', '8000'); await setVal('#price', '17000');
    await click('#other-costs'); await sleep(200);
    await setVal('#pack', '1500'); await sleep(300);
    await shoot('tinh');
    await click('#to-breakdown'); await sleep(500);
    await shoot('chi-tiet');
    await go('#/tinh');
    await click('#mode-margin'); await sleep(500);
    await shoot('margin');
    await click('#mode-price'); await sleep(300);
    await go('#/so-sanh');
    await shoot('so-sanh');
    await go('#/tinh');
    await click('#to-hidden'); await sleep(500);
    await click('#hc-return'); await sleep(200);
    await setVal('#return-rate', '8', 'change'); await sleep(200);
    await shoot('chi-phi-an');
    // Danh mục: ví dụ mẫu, bán 2 sàn
    await go('#/san-pham');
    await click('#load-examples'); await sleep(400);
    await go('#/cai-dat');
    await click('#sell-tiktok_shop'); await sleep(200);
    await go('#/san-pham');
    await shoot('danh-muc');
    // Add-on: Combo + Kiểm tra đơn (thêm tạm "Kẹo sữa" ngành 15% + PiShip = đơn thật A; chụp xong thì bỏ)
    const ready = async () => { for (let i = 0; i < 80; i++) { await sleep(100); if (await b.js('document.readyState === "complete" && !!window.__app && !document.querySelector("#splash")').catch(() => false)) return; } };
    const keoSua = "{ id: 'pkeosua', name: 'Kẹo sữa', savedAt: 1, input: { platform: 'shopee', categoryName: '', categoryRate: 0.15, categoryCustom: true, price: 74692, cost: 30000, pack: 1000, programs: ['piship'], vat: true, pit: true, voucherValue: 0, voucherUnit: 'vnd', sellerVoucher: 0, shipBuyer: 0 } }";
    await b.js(`(() => { const k = 'laithat:v1'; const st = JSON.parse(localStorage.getItem(k)); st.products.push(${keoSua}); localStorage.setItem(k, JSON.stringify(st)); location.hash = '#/tinh'; setTimeout(() => location.reload(), 50); })()`);
    await sleep(600); await ready();
    await click('#mode-combo'); await sleep(500);
    await shoot('combo');
    await go('#/kiem-tra');
    await setVal('#check-product', 'pkeosua', 'change'); await sleep(250);
    await click('#check-sample'); await sleep(200);
    await click('#check-run'); await sleep(500);
    await shoot('kiem-tra');
    await b.js(`(() => { const k = 'laithat:v1'; const st = JSON.parse(localStorage.getItem(k)); st.products = st.products.filter((x) => x.id !== 'pkeosua'); st.checkHistory = []; localStorage.setItem(k, JSON.stringify(st)); location.hash = '#/san-pham'; setTimeout(() => location.reload(), 50); })()`);
    await sleep(600); await ready();
    await b.js(`(async () => { const p = await (await fetch('assets/fee_presets.json', { cache: 'no-store' })).json();
      p.fee_version = '2026-12-01.1'; p.platforms.shopee.transaction_fee.rate = 0.09; return window.__app.receivePresets(p); })()`);
    await sleep(600);
    await shoot('bao-dong');

    // Ghép khung: chú thích + điện thoại, 360×640 @3 = 1080×1920
    await b.page('Emulation.setDeviceMetricsOverride', { width: 360, height: 640, deviceScaleFactor: 3, mobile: true });
    for (const [i, s] of SHOTS.entries()) {
      const html = `<!doctype html><html lang="vi"><head><meta charset="utf-8"><link rel="stylesheet" href="fonts/fonts.css"><style>
        html,body{margin:0;width:360px;height:640px;overflow:hidden}
        body{background:#0A7A6B;font-family:'Be Vietnam Pro',sans-serif;color:#fff;display:flex;flex-direction:column;align-items:center}
        h1{font-size:23px;line-height:1.3;font-weight:800;text-align:center;margin:30px 16px 18px;white-space:pre-line;letter-spacing:-0.2px}
        .phone{width:238px;border-radius:28px;border:6px solid #12161C;overflow:hidden;background:#fff;box-shadow:0 24px 50px -16px rgba(0,0,0,.55)}
        .phone img{display:block;width:100%}
      </style></head><body><h1>${s.caption}</h1><div class="phone"><img src="data:image/png;base64,${raw[s.key]}"></div></body></html>`;
      await b.js(`document.open(); document.write(${JSON.stringify(html)}); document.close();`);
      await b.js('document.fonts.ready.then(() => new Promise((r) => setTimeout(r, 200)))');
      const { data } = await b.page('Page.captureScreenshot', { format: 'png' });
      await writeFile(path.join(OUT, `screenshot-${i + 1}.png`), Buffer.from(data, 'base64'));
    }

    // Ảnh đồ hoạ 1024×500 (docs/STORE_LISTING.md): nền #12161C, chữ trắng "Lãi Thật" + "505đ · Lãi mỏng 3,0%" màu #A16207
    await b.page('Emulation.setDeviceMetricsOverride', { width: 1024, height: 500, deviceScaleFactor: 1, mobile: false });
    const fg = `<!doctype html><html lang="vi"><head><meta charset="utf-8"><link rel="stylesheet" href="fonts/fonts.css"><style>
      html,body{margin:0;width:1024px;height:500px;overflow:hidden}
      body{background:#12161C;font-family:'Be Vietnam Pro',sans-serif;display:flex;flex-direction:column;justify-content:center;gap:40px;padding:0 88px;box-sizing:border-box}
      .logo{height:76px;align-self:flex-start}
      .t{color:#fff}
      .t p{margin:0 0 10px;font-size:26px;font-weight:600;color:#C9D1DA}
      .t b{display:block;font-size:66px;line-height:1.05;font-weight:800;color:#A16207;letter-spacing:-1px;white-space:nowrap;font-variant-numeric:tabular-nums}
      .t small{display:block;margin-top:14px;font-size:22px;color:#C9D1DA}
    </style></head><body><img class="logo" src="assets/logo-horizontal-white.svg" alt="Lãi Thật">
      <div class="t"><p>Bán 17.000đ, lãi thật:</p><b>505đ · Lãi mỏng 3,0%</b><small>Phí sàn, thuế, voucher — tính trong 10 giây</small></div></body></html>`;
    await b.js(`document.open(); document.write(${JSON.stringify(fg)}); document.close();`);
    await b.js('document.fonts.ready.then(() => new Promise((r) => setTimeout(r, 300)))');
    const { data } = await b.page('Page.captureScreenshot', { format: 'png' });
    await writeFile(path.join(OUT, 'feature-graphic.png'), Buffer.from(data, 'base64'));
    await copyFile(path.join(ROOT, 'app', 'icons', 'icon-512.png'), path.join(OUT, 'icon-512.png'));
    await writeFile(path.join(OUT, 'README.md'), `# Ảnh Google Play — Lãi Thật\n\nSinh bằng \`node tools/store_shots.mjs\`. Tên sàn trên màn được thay bằng "Sàn A/B/C" (luật store: không tên sàn trong ảnh).\n\n| File | Chú thích |\n|---|---|\n${SHOTS.map((s, i) => `| screenshot-${i + 1}.png | ${s.caption.replace('\n', ' ')} |`).join('\n')}\n| feature-graphic.png | Ảnh đồ hoạ 1024×500 |\n| icon-512.png | Biểu tượng 512×512 |\n`);
    console.log(`Đã ghi ${SHOTS.length} ảnh chụp + ảnh đồ hoạ + icon vào brand/store/`);
  } finally {
    await b.close();
    server.close();
  }
}
main().catch((e) => { console.error(e); process.exit(1); });
