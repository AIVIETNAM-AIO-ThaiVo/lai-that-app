// F24 / F27 — Thanh toán. Trong app Android (Capacitor, ADR-002): Google Play Billing qua plugin NativePurchases (app/native.js).
// Ngoài app (trình duyệt, bot): chế độ thử — không trừ tiền, lưu giao dịch thử trên máy để "Khôi phục giao dịch".

import { plugin, createNativeBilling } from './native.js';

const TEST_KEY = 'laithat:billing-test';

/** Chọn bộ thanh toán. cfg = app_config (billing_skus, billing_plans). */
export async function getBilling(win = window, cfg = {}) {
  const np = plugin(win, 'NativePurchases');
  if (np) return createNativeBilling(np, { skus: cfg.billing_skus ?? { monthly: 'pro_monthly', yearly: 'pro_yearly' }, plans: cfg.billing_plans ?? { monthly: 'monthly', yearly: 'yearly' } });
  return testBilling(win);
}

function testBilling(win) {
  const read = () => { try { return JSON.parse(win.localStorage.getItem(TEST_KEY) ?? 'null'); } catch { return null; } };
  const write = (v) => { try { win.localStorage.setItem(TEST_KEY, JSON.stringify(v)); } catch { /* riêng tư */ } };
  return {
    mode: 'test',
    async purchase(plan) { return { plan, token: `test-${Date.now()}` }; },
    /** Ghi lại thuê bao thử để khôi phục sau khi xoá dữ liệu app. */
    remember(sub) { write(sub); },
    async restore() { return read(); },
  };
}
