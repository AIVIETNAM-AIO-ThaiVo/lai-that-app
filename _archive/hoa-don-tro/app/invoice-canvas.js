// Vẽ ảnh hóa đơn (PNG) từ invoiceModel — cùng dữ liệu với thẻ #invoice trên màn hình.
import { encodeQR } from './qr.js';
import { formatVND } from './logic.js';

const W = 360;       // bề rộng thiết kế (px CSS)
const SCALE = 3;     // ảnh 1080px
const C = { green: '#1F6F5C', ink: '#15181D', muted: '#5B6270', line: '#858B83', yellow: '#FFD43B', card: '#FFFFFF' };
const FONT = '"Be Vietnam Pro", system-ui, sans-serif';

function fit(ctx, text, max) {
  if (ctx.measureText(text).width <= max) return text;
  let t = text;
  while (t.length > 1 && ctx.measureText(`${t}…`).width > max) t = t.slice(0, -1);
  return `${t}…`;
}

/** Trả Promise<Blob> ảnh PNG. */
export async function renderInvoicePNG(model) {
  try {
    const fonts = Promise.all(['400', '600', '700', '800'].map((w) => document.fonts.load(`${w} 16px "Be Vietnam Pro"`, 'Hóa Đơn đ')));
    await Promise.race([fonts, new Promise((r) => setTimeout(r, 1500))]);
  } catch { /* vẫn vẽ bằng font dự phòng */ }

  const pad = 20, cardX = 16, inner = W - cardX * 2 - pad * 2;
  // Tính chiều cao trước.
  let h = 22 + 16 + (model.houseName ? 18 : 0) + 24 + 12 + 26 * (2 + model.extras.length) + 14;
  h += model.lines.length ? model.lines.length * 26 + 14 : 40 + 14;
  h += model.qr ? 124 : 0;
  h += model.branding ? 30 : 8;
  const H = h + 32 + 20;

  const canvas = document.createElement('canvas');
  canvas.width = W * SCALE;
  canvas.height = H * SCALE;
  const ctx = canvas.getContext('2d');
  ctx.scale(SCALE, SCALE);
  ctx.fillStyle = C.green;
  ctx.fillRect(0, 0, W, H);
  ctx.fillStyle = C.card;
  ctx.beginPath();
  ctx.roundRect(cardX, 16, W - cardX * 2, H - 32, 22);
  ctx.fill();

  const x0 = cardX + pad, x1 = W - cardX - pad;
  let y = 16 + 22;
  const text = (t, x, yy, { size = 15, weight = 400, color = C.ink, align = 'left', max } = {}) => {
    ctx.font = `${weight} ${size}px ${FONT}`;
    ctx.fillStyle = color;
    ctx.textAlign = align;
    ctx.textBaseline = 'alphabetic';
    ctx.fillText(max ? fit(ctx, t, max) : t, x, yy);
  };
  const row = (l, r, opt = {}) => {
    y += 26;
    text(l, x0, y, { size: 15, color: opt.muted ? C.muted : C.ink, max: inner - 120 });
    text(r, x1, y, { size: 15, weight: opt.bold ? 700 : 600, color: opt.muted ? C.muted : C.ink, align: 'right' });
  };
  const dash = () => {
    y += 14;
    ctx.save();
    ctx.strokeStyle = C.line;
    ctx.setLineDash([4, 4]);
    ctx.lineWidth = 1.2;
    ctx.beginPath();
    ctx.moveTo(x0, y);
    ctx.lineTo(x1, y);
    ctx.stroke();
    ctx.restore();
  };

  ctx.font = `600 12px ${FONT}`;
  if ('letterSpacing' in ctx) ctx.letterSpacing = '1px';
  text(model.title, x0, y + 4, { size: 12, weight: 600, color: C.muted });
  if ('letterSpacing' in ctx) ctx.letterSpacing = '0px';
  // tia điện
  ctx.save();
  ctx.strokeStyle = C.ink; ctx.lineWidth = 1.8; ctx.lineJoin = 'round';
  ctx.beginPath(); ctx.moveTo(x1 - 6, y - 8); ctx.lineTo(x1 - 16, y + 6); ctx.lineTo(x1 - 7, y + 6); ctx.lineTo(x1 - 10, y + 18); ctx.lineTo(x1, y + 3); ctx.lineTo(x1 - 9, y + 3); ctx.closePath(); ctx.stroke();
  ctx.restore();
  y += 16;
  if (model.houseName) { y += 18; text(model.houseName, x0, y, { size: 13, weight: 600, color: C.green, max: inner - 30 }); }
  y += 24;
  text(model.heading, x0, y, { size: 18, weight: 800, max: inner - 30 });
  y += 12;
  row(model.readingLine, model.kwhLine, { muted: true });
  row(model.priceLabel, formatVND(model.total), { muted: true });
  for (const x of model.extras) row(x.label, formatVND(x.amount), { muted: true });
  dash();
  if (model.lines.length) {
    for (const l of model.lines) row(l.label, formatVND(l.amount), { bold: true });
  } else {
    y += 34;
    text('Tổng cần thu', x0, y, { size: 15, color: C.muted });
    text(formatVND(model.total), x1, y + 2, { size: 26, weight: 800, align: 'right' });
    y += 6;
  }
  dash();
  if (model.qr) {
    const qr = encodeQR(model.qr.payload);
    const box = 108, qy = y + 12, cell = box / (qr.size + 4);
    ctx.fillStyle = C.card;
    ctx.fillRect(x0, qy, box, box);
    ctx.fillStyle = C.ink;
    for (let r = 0; r < qr.size; r++) for (let c = 0; c < qr.size; c++) {
      if (qr.modules[r][c]) ctx.fillRect(x0 + (c + 2) * cell, qy + (r + 2) * cell, cell + 0.02, cell + 0.02);
    }
    const tx = x0 + box + 14, tmax = x1 - tx;
    text(model.qr.caption, tx, qy + 28, { size: 14, weight: 700, max: tmax });
    text(model.qr.bankLine, tx, qy + 50, { size: 13, color: C.muted, max: tmax });
    text(`Nội dung: ${model.qr.note}`, tx, qy + 70, { size: 13, color: C.muted, max: tmax });
    y = qy + box + 4;
  }
  if (model.branding) {
    y += 26;
    text(model.branding, W / 2, y, { size: 12, color: C.muted, align: 'center', max: inner });
  }
  // toDataURL (đồng bộ) thay cho toBlob: toBlob đôi khi không bao giờ gọi lại trên một số trình duyệt.
  const b64 = canvas.toDataURL('image/png').split(',')[1];
  const bin = atob(b64);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return new Blob([bytes], { type: 'image/png' });
}
