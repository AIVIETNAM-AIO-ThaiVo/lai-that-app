// F20 — Màn mở app có logo động, tách kiểu chất lỏng (1-wiki/features/F20-man-mo-app.md)
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { splashTiming } from '../splash.js';

const APP = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const ROOT = path.join(APP, '..');
const css = readFileSync(path.join(APP, 'styles.css'), 'utf8');
const splashSrc = readFileSync(path.join(APP, 'splash.js'), 'utf8');
const frames = [...css.matchAll(/@keyframes (splash-[\w-]+)\s*\{([\s\S]*?)\n\}/g)];

test('thời lượng: ≤ 1,5 giây; giảm chuyển động ≤ 0,5 giây', () => {
  const a = splashTiming(false);
  assert.ok(a.total <= 1500 && a.total >= 800, String(a.total));
  assert.ok(a.hideAt < a.total);
  const r = splashTiming(true);
  assert.ok(r.total <= 500, String(r.total));
  assert.equal(r.animate, false);
});

test('hiệu ứng màn mở app chỉ dùng transform / opacity', () => {
  assert.ok(frames.length >= 2, 'có keyframes splash-*');
  for (const [, name, body] of frames) {
    const props = [...body.matchAll(/([a-z-]+)\s*:/g)].map((m) => m[1]);
    for (const p of props) assert.ok(['transform', 'opacity'].includes(p), `${name} dùng ${p}`);
  }
});

test('tách kiểu chất lỏng: bộ lọc goo tĩnh, mảnh phí ≥ 20 khung khoá, giữ bo tròn tới cuối', () => {
  assert.match(splashSrc, /<filter id="splash-goo"/);
  assert.match(splashSrc, /feGaussianBlur/);
  assert.match(splashSrc, /feColorMatrix/);
  assert.match(splashSrc, /class="splash-goo"/);
  assert.doesNotMatch(splashSrc, /splash-crisp/, 'không đổi sang lớp góc nhọn ở cuối (giữ bo tròn)');
  assert.doesNotMatch(css, /splash-goo-off|\.splash-crisp/, 'lớp chất lỏng giữ tới cuối');
  const chip = frames.find(([, n]) => n === 'splash-chip');
  assert.ok(chip, 'có @keyframes splash-chip');
  const stops = chip[2].match(/[\d.]+%\s*\{/g) ?? [];
  assert.ok(stops.length >= 20, `chỉ có ${stops.length} khung khoá`);
});

test('bản Lottie hợp lệ cơ bản: 60 fps, ≤ 1,5 giây, có lớp mảnh phí', () => {
  const f = path.join(ROOT, 'brand/logo/motion/splash-liquid.json');
  assert.ok(existsSync(f), 'thiếu brand/logo/motion/splash-liquid.json');
  assert.ok(existsSync(path.join(ROOT, 'brand/logo/motion/build_splash.py')), 'thiếu bộ sinh chuyển động');
  const l = JSON.parse(readFileSync(f, 'utf8'));
  assert.equal(l.fr, 60);
  assert.ok((l.op - l.ip) / l.fr <= 1.5);
  assert.ok(l.layers.some((x) => /phí|chip/i.test(x.nm)));
});

test('màn Cài đặt không có logo', () => {
  const ui = readFileSync(path.join(APP, 'ui.js'), 'utf8');
  const settings = ui.slice(ui.indexOf('function screenSettings'), ui.indexOf('function openSaveSheet'));
  assert.ok(settings.length > 100);
  assert.ok(!/logo-horizontal|brand-logo|settings-brand/.test(settings));
});
