#!/usr/bin/env node
// KIỂM TRA MÁY — đủ đồ nghề để harness chạy chưa? Chạy tự động mỗi khi mở dự án trong Claude (hook SessionStart),
// và gõ tay được: node 2-environment/doctor.mjs        (thêm --full để thử mở Chrome thật bằng bot)
// Thiếu gì thì in ra cách sửa. Không cài thêm gì: chỉ cần Node 22 + Google Chrome (hoặc Microsoft Edge).
import { spawnSync } from 'node:child_process';
import { accessSync, constants, existsSync, mkdirSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const HOOK = process.argv.includes('--hook');
const FULL = process.argv.includes('--full');
const checks = [];
const add = (level, name, fix = '') => checks.push({ level, name, fix }); // level: ok | warn | fail

// 1) Node 22+: bot điều khiển Chrome bằng WebSocket có sẵn từ Node 22.
const major = Number(process.versions.node.split('.')[0]);
if (major >= 22) add('ok', `Node.js ${process.versions.node}`);
else add('fail', `Node.js ${process.versions.node} quá cũ`, 'Cài Node.js 22 LTS ở https://nodejs.org rồi mở lại Claude.');

// 2) Trình duyệt cho bot (Chrome, không có thì Edge).
const browsers = [
  process.env.CHROME,
  '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  '/Applications/Chromium.app/Contents/MacOS/Chromium',
  '/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge',
  '/usr/bin/google-chrome', '/usr/bin/google-chrome-stable', '/usr/bin/chromium', '/usr/bin/chromium-browser',
  'C:/Program Files/Google/Chrome/Application/chrome.exe',
  'C:/Program Files (x86)/Google/Chrome/Application/chrome.exe',
  process.env.LOCALAPPDATA && `${process.env.LOCALAPPDATA}/Google/Chrome/Application/chrome.exe`,
  'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe', 'C:/Program Files/Microsoft/Edge/Application/msedge.exe',
].filter(Boolean);
const browser = browsers.find((p) => existsSync(p));
if (browser) add('ok', `Trình duyệt cho bot: ${path.basename(browser)}`);
else add('fail', 'Không tìm thấy Google Chrome', 'Cài Google Chrome ở https://www.google.com/chrome rồi mở lại Claude.');

// 3) Thư mục ghi được (bot ghi ảnh, monitor ghi nhật ký).
try { mkdirSync(path.join(ROOT, 'reports'), { recursive: true }); accessSync(path.join(ROOT, 'reports'), constants.W_OK); add('ok', 'Ghi được vào thư mục dự án'); }
catch { add('fail', 'Không ghi được vào thư mục dự án', 'Giải nén mini-harness.zip vào Downloads hoặc Documents (không mở thẳng trong file zip).'); }

// 4) Thư viện có sẵn trong kit (không cần mạng).
if (existsSync(path.join(ROOT, 'game', 'vendor', 'three.module.min.js'))) add('ok', 'Thư viện 3D (Three.js) có sẵn');
else add('warn', 'Thiếu game/vendor/three.module.min.js', 'Game 3D sẽ không chạy offline. Giải nén lại mini-harness.zip.');

// 5) Lệnh bash (máy chấm verify.sh viết bằng bash; Windows: Claude Code dùng Git Bash).
const bash = spawnSync('bash', ['-c', 'echo ok'], { encoding: 'utf8' });
if (bash.stdout?.trim() === 'ok') add('ok', 'bash chạy được (cho máy chấm verify.sh)');
else add('fail', 'Không chạy được bash', 'Windows: cài Git for Windows (https://git-scm.com) rồi mở lại Claude.');

// 6) npx: chỉ cần cho công cụ MCP tuỳ chọn (Playwright, context7). Thiếu thì harness vẫn chạy bằng bot.
const npx = spawnSync(process.platform === 'win32' ? 'npx.cmd' : 'npx', ['--version'], { encoding: 'utf8', timeout: 8000 });
if (npx.status === 0) add('ok', `npx ${npx.stdout.trim()} (công cụ MCP tuỳ chọn)`);
else add('warn', 'Không có npx: công cụ MCP tuỳ chọn sẽ tắt', 'Không sao, harness vẫn chạy. Muốn bật thì cài lại Node.js 22.');

// 7) --full: mở Chrome thật, chụp một ảnh game.
if (FULL && browser) {
  const r = spawnSync(process.execPath, [path.join(ROOT, '2-environment', 'bot.mjs'), '--look', '--quiet'], { cwd: ROOT, encoding: 'utf8', timeout: 90000 });
  if (existsSync(path.join(ROOT, 'reports', 'look', '01.png'))) add('ok', 'Bot mở được Chrome và chụp ảnh game');
  else add('fail', 'Bot không mở được Chrome', (r.stderr || r.stdout || '').trim().split('\n').slice(-2).join(' ') || 'Thử mở Chrome một lần bằng tay rồi chạy lại.');
}

const bad = checks.filter((c) => c.level !== 'ok');
if (HOOK) {
  // Hook SessionStart: chỉ lên tiếng khi có vấn đề, để AI báo người dùng cách sửa trước khi làm game.
  if (bad.length) {
    const text = 'KIỂM TRA MÁY (2-environment/doctor.mjs) thấy vấn đề. Trước khi làm game, hãy báo người dùng bằng lời đơn giản và chỉ cách sửa:\n'
      + bad.map((c) => `- ${c.level === 'fail' ? 'LỖI' : 'Lưu ý'}: ${c.name}. Cách sửa: ${c.fix}`).join('\n');
    console.log(JSON.stringify({ hookSpecificOutput: { hookEventName: 'SessionStart', additionalContext: text } }));
  }
  process.exit(0);
}
for (const c of checks) console.log(`${c.level === 'ok' ? '✓' : c.level === 'warn' ? '!' : '✗'} ${c.name}${c.fix ? `\n    → ${c.fix}` : ''}`);
console.log(checks.some((c) => c.level === 'fail') ? '\n🔴 Máy chưa sẵn sàng: sửa các dòng ✗ ở trên.' : '\n🟢 Máy sẵn sàng.');
process.exit(checks.some((c) => c.level === 'fail') ? 1 : 0);
