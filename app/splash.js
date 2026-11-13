// F20 — Màn mở app: khối giá vuông → mảnh phí tách ra như giọt chất lỏng → còn chữ L → chữ "Lãi Thật" hiện.
// (1-wiki/features/F20-man-mo-app.md). Keyframes trong styles.css sinh bởi brand/logo/motion/build_splash.py.

/** Thời lượng (ms). hideAt: lúc bắt đầu mờ đi; total: lúc gỡ khỏi trang. */
export function splashTiming(reducedMotion) {
  return reducedMotion ? { animate: false, hideAt: 250, total: 450 } : { animate: true, hideAt: 1240, total: 1480 };
}

const L = 'M44 32h56a12 12 0 0 1 12 12v100h100a12 12 0 0 1 12 12v56a12 12 0 0 1-12 12H44a12 12 0 0 1-12-12V44a12 12 0 0 1 12-12z';
const CHIP = 'x="148" y="32" width="76" height="76" rx="12"';

/** Gắn màn mở app vào <body>; tự gỡ, chạm vào thì gỡ ngay. Không có nút, không chặn app tải phía sau. */
export function showSplash(doc = document, win = window) {
  const reduced = win.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false;
  const t = splashTiming(reduced);
  const el = doc.createElement('div');
  el.id = 'splash';
  el.className = `splash${t.animate ? ' animate' : ''}`;
  el.setAttribute('role', 'img');
  el.setAttribute('aria-label', 'Lãi Thật');
  // Lớp chất lỏng: bộ lọc tĩnh (làm mờ + ngưỡng alpha) dính hai khối lại khi gần nhau → cầu nối kéo giãn rồi đứt.
  // Giữ lớp này tới cuối để góc bo không đổi đột ngột (phản hồi 13/11).
  el.innerHTML = `
    <div class="splash-mark">
      <svg viewBox="0 0 256 256" aria-hidden="true">
        <defs>
          <filter id="splash-goo" x="0" y="0" width="256" height="256" filterUnits="userSpaceOnUse" color-interpolation-filters="sRGB">
            <feGaussianBlur in="SourceGraphic" stdDeviation="6" result="blur"/>
            <feColorMatrix in="blur" mode="matrix" values="1 0 0 0 0  0 1 0 0 0  0 0 1 0 0  0 0 0 20 -9" result="goo"/>
            <feComposite in="SourceGraphic" in2="goo" operator="over"/>
          </filter>
        </defs>
        <g class="splash-goo" filter="url(#splash-goo)">
          <path class="splash-l" d="${L}" fill="#FFFFFF"/>
          <g class="splash-chip"><rect ${CHIP} fill="#9FD3C9"/><rect class="splash-cover" x="147" y="31" width="78" height="78" rx="13" fill="#FFFFFF"/></g>
        </g>
      </svg>
      <img class="splash-word" src="assets/logo-wordmark-white.svg" alt="">
    </div>`;
  let gone = false;
  const remove = () => { if (gone) return; gone = true; el.classList.add('out'); setTimeout(() => el.remove(), t.total - t.hideAt); };
  el.addEventListener('pointerdown', remove, { once: true });
  doc.body.appendChild(el);
  setTimeout(remove, t.hideAt);
  return el;
}
