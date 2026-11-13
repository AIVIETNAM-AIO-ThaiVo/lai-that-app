"""Bộ máy tính tham chiếu của Lãi Thật (v2, 12/11/2026).

Bản Dart trong app/lib/engine/fee_engine.dart phải cho cùng kết quả với file này.
Công thức đã đối chiếu với 8 đơn Shopee thật (xem tools/validate.py, docs/VALIDATION_REPORT.md).

Ký hiệu
  P   giá niêm yết, V_s mã giảm giá của shop (đồng), B = P − V_s  (cơ sở tính mọi phí % và thuế)
  S   phí ship người mua trả (chỉ nằm trong cơ sở phí xử lý giao dịch)
  c   % phí cố định/hoa hồng theo ngành, t % phí xử lý giao dịch, vis % phí hiển thị, a % affiliate
  v   % chương trình voucher (trần cap đồng/sản phẩm), tax = GTGT + TNCN
  F_s phí cố định mỗi đơn của sàn (hạ tầng / xử lý đơn + PiShip + ...), C giá vốn, K đóng gói
  r   tỷ lệ đơn hoàn, R tiền mất mỗi đơn hoàn, ROAS → chi phí quảng cáo = B / ROAS
Lãi đơn thành công  = B·(1 − k) − v_amt − (F_s + t·S + C + K),   k = c + t + vis + a + tax + 1/ROAS
Lãi kỳ vọng        = (1 − r)·Lãi đơn thành công − r·R
Giá cho % lãi m    : B = ((1 − r)·X + r·R) / ((1 − r)·(1 − k − v) − m),  X = F_s + t·S + C + K
                     (nếu v·B vượt trần: v = 0 và cộng cap vào X)
"""
import json, math, os

HERE = os.path.dirname(os.path.abspath(__file__))
PRESETS = json.load(open(os.path.join(HERE, '..', 'app', 'assets', 'fee_presets.json'), encoding='utf-8'))


def rates(platform, cat_rate, programs=(), vat=True, pit=True, registered=False,
          aff=0.0, roas=None, tx_override=None, fixed_override=None):
    pf = PRESETS['platforms'][platform]
    div = pf.get('tax_registered_seller', {}).get('fee_divisor', 1.0) if registered else 1.0
    t = (tx_override if tx_override is not None else pf['transaction_fee']['rate']) / div
    fixed = fixed_override if fixed_override is not None else \
        sum(x.get('amount', 0) for x in pf['per_order_fixed'] if 'amount' in x) / div
    v, cap, vis, per_order = 0.0, None, 0.0, 0.0
    for p in pf.get('programs', []):
        if p['id'] not in programs:
            continue
        if p['id'] == 'visibility':
            vis += p['rate']
        elif 'rate' in p:
            v += p['rate']; cap = p.get('cap_per_item')
        else:
            per_order += p['amount_per_order']
    tax = (0.01 if vat else 0) + (0.005 if pit else 0)
    k = cat_rate / div + t + vis + aff + tax + (1.0 / roas if roas else 0.0)
    return dict(k=k, t=t, v=v, cap=cap, fixed=fixed + per_order, tax=tax, c=cat_rate / div, vis=vis)


def breakdown(price, cost, cat_rate, platform='shopee', seller_voucher=0, ship=0, pack=0,
              r=0.0, R=0.0, **kw):
    q = rates(platform, cat_rate, **kw)
    B = price - seller_voucher
    v_amt = min(q['v'] * B, q['cap']) if q['cap'] else q['v'] * B
    platform_fees = q['c'] * B + q['t'] * (B + ship) + v_amt + q['vis'] * B + q['fixed']
    tax = q['tax'] * B
    other = (q['k'] - q['c'] - q['t'] - q['vis'] - q['tax']) * B   # affiliate + quảng cáo
    payout = B - platform_fees - tax - other
    profit_ok = payout - cost - pack
    profit = (1 - r) * profit_ok - r * R
    return dict(base=B, platform_fees=platform_fees, tax=tax, other=other, payout=payout,
                profit=profit, margin=profit / B if B else 0,
                take_rate=(platform_fees + tax) / B if B else 0)


def price_for_margin(m, cost, cat_rate, platform='shopee', ship=0, pack=0, r=0.0, R=0.0, **kw):
    """Giá sau mã giảm giá shop (B) để lãi kỳ vọng = m × B. m = 0 → giá hòa vốn."""
    q = rates(platform, cat_rate, **kw)
    X = q['fixed'] + q['t'] * ship + cost + pack
    den = (1 - r) * (1 - q['k'] - q['v']) - m
    if den <= 0:
        return math.inf
    B = ((1 - r) * X + r * R) / den
    if q['cap'] and q['v'] * B > q['cap']:
        den = (1 - r) * (1 - q['k']) - m
        B = ((1 - r) * (X + q['cap']) + r * R) / den if den > 0 else math.inf
    return B


def nice_price(p):
    """Làm tròn lên giá đẹp: dưới 100k → x.900; từ 100k → x9.000."""
    if p < 100000:
        return math.ceil((p + 100) / 1000) * 1000 - 100
    return math.ceil((p + 1000) / 10000) * 10000 - 1000


def max_cost(price, m, cat_rate, platform='shopee', seller_voucher=0, ship=0, pack=0, r=0.0, R=0.0, **kw):
    """Giá nhập tối đa để vẫn giữ % lãi m ở giá bán đã cho."""
    b = breakdown(price, 0, cat_rate, platform, seller_voucher, ship, pack, r, R, **kw)
    B = b['base']
    return ((1 - r) * (b['payout'] - pack) - r * R - m * B) / (1 - r)


def roas_breakeven(price, cost, cat_rate, platform='shopee', r=0.0, R=0.0, **kw):
    kw.pop('roas', None)
    b = breakdown(price, cost, cat_rate, platform, r=0.0, R=0.0, **kw)
    room = (b['profit']) - (r * R / (1 - r) if r < 1 else 0)
    return (b['base'] / room if room > 0 else math.inf), room


if __name__ == '__main__':
    mk = breakdown(17000, 8000, 0.16, pack=1500)
    print('Móc khóa Shopee', round(mk['profit']), f"{mk['margin']:.1%}", 'sàn+thuế', f"{mk['take_rate']:.1%}")
    print('  hòa vốn', math.ceil(price_for_margin(0, 8000, 0.16, pack=1500)),
          'giá 20%', math.ceil(price_for_margin(.2, 8000, 0.16, pack=1500)),
          'giá đẹp', nice_price(price_for_margin(.2, 8000, 0.16, pack=1500)))
