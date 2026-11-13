"""Add-on: Combo và Kiểm tra đơn (v1, 13/11/2026). Dùng chung bộ máy tính engine.py.

Combo
  items: [{name, cost, price (giá lẻ), cat (tỷ lệ ngành), qty}]
  discount: ('percent', 0.1) | ('amount', 5000) | ('fixed', 45000)  → giá combo
  Mã giảm giá combo được chia cho từng món theo tỷ lệ giá trị (giá × số lượng).
  Phí % ngành tính theo ngành của từng món; phí mỗi đơn (hạ tầng, PiShip), đóng gói, ship người mua trả: một lần cho cả combo.
  Voucher Xtra: trần 50.000đ cho mỗi sản phẩm (mỗi đơn vị).
Kiểm tra đơn
  So từng dòng phí trên Chi tiết doanh thu / Báo Cáo Doanh Thu với số app tính từ chính giá, mã giảm giá, ship của đơn đó.
"""
import math
from engine import PRESETS, nice_price

TAX = 0.015


def combo(items, discount=None, platform='shopee', ship=0, pack=0, programs=(), vat=True, pit=True,
          aff=0.0, roas=None, registered=False, r=0.0, R=0.0):
    pf = PRESETS['platforms'][platform]
    div = (pf.get('tax_registered_seller') or {}).get('fee_divisor', 1.0) if registered else 1.0
    t = pf['transaction_fee']['rate'] / div
    per_order = sum(x.get('amount', 0) for x in pf['per_order_fixed'] if 'amount' in x) / div
    progs = [p for p in pf.get('programs', []) if p['id'] in programs]
    vx = next((p for p in progs if 'rate' in p and p['id'] != 'visibility'), None)
    vis = sum(p['rate'] for p in progs if p['id'] == 'visibility')
    per_order += sum(p['amount_per_order'] for p in progs if 'amount_per_order' in p)
    gross = sum(i['price'] * i['qty'] for i in items)
    if discount is None:
        B = gross
    elif discount[0] == 'percent':
        B = gross * (1 - discount[1])
    elif discount[0] == 'amount':
        B = gross - discount[1]
    else:
        B = discount[1]
    if B <= 0 or gross <= 0:
        raise ValueError('Giá combo phải lớn hơn 0')
    share = B / gross
    cat_fee = vx_fee = 0.0
    for i in items:
        b_i = i['price'] * share  # giá mỗi đơn vị sau giảm (chia giảm theo tỷ lệ giá trị)
        cat_fee += i['cat'] / div * b_i * i['qty']
        if vx:
            v = vx['rate'] * b_i
            if vx.get('cap_per_item'):
                v = min(v, vx['cap_per_item'])
            vx_fee += v * i['qty']
    tx = t * (B + ship)
    tax = ((0.01 if vat else 0) + (0.005 if pit else 0)) * B
    vis_fee = vis * B
    other = (aff + (1 / roas if roas else 0)) * B
    fees = cat_fee + tx + vx_fee + vis_fee + per_order
    cost = sum(i['cost'] * i['qty'] for i in items)
    ok = B - fees - tax - other - cost - pack
    profit = (1 - r) * ok - r * R
    return dict(gross=gross, price=B, discount=gross - B, cat_fee=cat_fee, tx=tx, vx=vx_fee, vis=vis_fee,
                per_order=per_order, tax=tax, other=other, cost=cost, profit=profit, margin=profit / B,
                take=(fees + tax) / B)


def separate(items, platform='shopee', pack=0, programs=(), vat=True, pit=True, **kw):
    """Bán lẻ: mỗi đơn vị là một đơn riêng (mỗi đơn chịu phí mỗi đơn và đóng gói, không ship người mua trả)."""
    kw.pop('ship', None)
    tot = 0.0
    for i in items:
        one = combo([dict(i, qty=1)], None, platform, 0, pack, programs, vat, pit, **kw)
        tot += one['profit'] * i['qty']
    return tot


def combo_max_discount(items, m, **kw):
    """Mức giảm % lớn nhất để lãi combo ≥ m × giá combo. Tìm nhị phân (hàm đơn điệu)."""
    lo, hi = 0.0, 0.95
    if combo(items, ('percent', 0), **kw)['margin'] < m:
        return None
    for _ in range(60):
        mid = (lo + hi) / 2
        if combo(items, ('percent', mid), **kw)['margin'] >= m:
            lo = mid
        else:
            hi = mid
    return lo


def combo_price_for_margin(items, m, **kw):
    """Giá combo thấp nhất để đạt lãi m (làm tròn giá đẹp)."""
    lo, hi = 0.0, sum(i['price'] * i['qty'] for i in items) * 3
    for _ in range(80):
        mid = (lo + hi) / 2
        if combo(items, ('fixed', mid), **kw)['margin'] >= m:
            hi = mid
        else:
            lo = mid
    return hi, nice_price(hi)


# ---------- Kiểm tra đơn ----------
def status_of(diff, expect, real, items=1):
    """Khớp: |lệch| ≤ 1đ × số sản phẩm + 1đ (sàn làm tròn từng sản phẩm).
       Lệch nhỏ: |lệch| ≤ 100đ và ≤ 1% khoản đó. Còn lại: Lệch."""
    a = abs(diff)
    if a <= items + 1:
        return 'khop'
    if a <= 100 and a <= 0.01 * max(abs(expect), abs(real)):
        return 'lech_nho'
    return 'lech'


def categories_for_rate(rate, platform='shopee', tol=0.0005):
    cats = PRESETS['platforms'][platform].get('categories', [])
    return [c['name'] for c in cats if c['min'] - tol <= rate <= c['max'] + tol]


RANK = {'khop': 0, 'lech_nho': 1, 'lech': 2}


def check_order(o, cat_rate, programs=(), vat=True, pit=True, items=1, new_shop=False):
    """Kiểm tra một đơn Shopee. o: số đọc từ Doanh thu đơn hàng / dòng Đơn hàng của Báo Cáo Doanh Thu (đồng).
       keys: price, seller_voucher, refund, ship_buyer, fixed_fee, service_fee, transaction_fee,
             piship, visibility, affiliate, vat, pit, adjustment, compensation, ship_discrepancy
       Trả về dict: base, lines[{key,label,real,app,diff,status,reason,diag}], status, total_diff, adjusted."""
    B = o['price'] - o.get('seller_voucher', 0) - o.get('refund', 0)
    S = o.get('ship_buyer', 0)
    res = []

    def add(key, label, real, expect, reason='', diag_fn=None):
        d = real - expect
        st = status_of(d, expect, real, items)
        reason_code, diag = '', ''
        if st != 'khop':
            reason_code, diag = diag_fn(real) if diag_fn else ('unknown', '')
            if st == 'lech_nho':
                reason_code, diag = 'rounding', 'Lệch nhỏ, có thể do làm tròn hoặc mã giảm giá được chia lẻ'
        res.append(dict(key=key, label=label, real=real, app=round(expect), diff=round(d), status=st,
                        reason=reason_code, diag=diag))

    def fixed_diag(real):
        if real == 0 and new_shop:
            return 'new_shop_waiver', 'Ưu đãi miễn phí cố định cho shop mới (30 ngày)'
        if real == 0:
            return 'new_shop_waiver', 'Sàn không thu phí cố định: kiểm tra ưu đãi shop mới hoặc chương trình riêng'
        r = real / B
        names = categories_for_rate(r)
        hint = f" (ngành có mức này: {', '.join(names[:3])})" if names else ''
        return 'category_rate', f"Sàn đang tính {r:.2%} thay vì {cat_rate:.2%}{hint}"

    add('fixed_fee', 'Phí cố định', o.get('fixed_fee', 0), 0 if new_shop else cat_rate * B, diag_fn=fixed_diag)

    def tx_diag(real):
        return 'transaction_base', f"Tương đương {real / (B + S):.2%} trên (giá + ship người mua trả {S:,.0f}đ); kiểm tra ship hoặc chương trình thanh toán"
    add('transaction_fee', 'Phí xử lý giao dịch', o.get('transaction_fee', 0), 0.06 * (B + S), diag_fn=tx_diag)

    vx_on = 'voucher_xtra' in programs
    vx_exp = min(0.055 * B, 50000) if vx_on else 0

    def svc_diag(real):
        extra = real - 3000
        if not vx_on and extra > 0.04 * B:
            if abs(extra - 50000) <= 2:
                return 'voucher_program', 'Có phí Voucher Xtra, đã chạm trần 50.000đ, dù bạn ghi là không tham gia'
            return 'voucher_program', f"Có phí gói chương trình ≈ {extra / B:.1%} (Voucher Xtra 5,5%) dù bạn ghi là không tham gia"
        if vx_on and extra < 1000:
            return 'voucher_program', 'Không thấy phí Voucher Xtra dù bạn ghi là có tham gia'
        return 'unknown', 'Phí dịch vụ khác dự kiến: xem trang Service Fee Details trong Báo Cáo Doanh Thu'
    add('service_fee', 'Phí dịch vụ (hạ tầng + gói chương trình)', o.get('service_fee', 0), 3000 + vx_exp, diag_fn=svc_diag)
    add('piship', 'PiShip', o.get('piship', 0), 2700 if 'piship' in programs else 0,
        diag_fn=lambda real: ('piship', 'Đơn bị trừ PiShip 2.700đ: bật PiShip cho sản phẩm' if real else 'Không thấy PiShip dù bạn ghi là có'))
    add('visibility', 'Phí dịch vụ hiển thị', o.get('visibility', 0), 0.0108 * B if 'visibility' in programs else 0,
        diag_fn=lambda real: ('visibility', f"Phí hiển thị ≈ {real / B:.2%} doanh thu đơn: bật phí hiển thị" if real else 'Không thấy phí hiển thị dù bạn ghi là có'))
    add('vat', 'Thuế GTGT', o.get('vat', 0), 0.01 * B if vat else 0,
        diag_fn=lambda real: ('vat_not_withheld', 'Sàn không khấu trừ GTGT cho đơn này: tắt công tắc GTGT') if real == 0
        else ('vat_not_withheld', f"Sàn khấu trừ GTGT {real / B:.2%}: bật công tắc GTGT"))
    add('pit', 'Thuế TNCN', o.get('pit', 0), 0.005 * B if pit else 0,
        diag_fn=lambda real: ('vat_not_withheld', f"Thuế TNCN {real / B:.2%} doanh thu"))
    adj = {k: o.get(k, 0) for k in ('refund', 'adjustment', 'compensation', 'ship_discrepancy') if o.get(k, 0)}
    worst = max((x['status'] for x in res), key=RANK.get)
    status = 'dieu_chinh' if adj and worst != 'lech' else worst
    mism = [x for x in res if x['status'] == 'lech']
    top = mism[0]['reason'] if mism else ''
    return dict(base=B, lines=res, status=status, mismatches=len(mism), top_reason=top, adjusted=adj,
                total_diff=round(sum(x['diff'] for x in res if x['status'] != 'khop')),
                affiliate=o.get('affiliate', 0))


STATUS_LABEL = {'khop': 'Khớp', 'lech_nho': 'Lệch nhỏ', 'lech': 'Lệch', 'dieu_chinh': 'Có điều chỉnh'}


def vnd(x):
    return f"{x:,.0f}".replace(',', '.') + 'đ'


def complaint_template(order_ref, line, fee_version='23/05/2026'):
    return (f"Kính gửi Shopee,\nĐơn hàng {order_ref}: khoản \"{line['label']}\" đã trừ {vnd(line['real'])}. "
            f"Theo biểu phí áp dụng từ {fee_version}, khoản này dự kiến {vnd(line['app'])} "
            f"(chênh lệch {vnd(line['diff'])}). Nhờ Shopee kiểm tra giúp ngành hàng/chương trình áp cho sản phẩm "
            f"và hoàn phần chênh lệch nếu có sai sót. Cảm ơn.")


if __name__ == '__main__':
    mk = dict(name='Móc khóa', cost=8000, price=17000, cat=0.16, qty=3)
    print('3 lẻ', round(separate([mk], pack=1500)))
    for d in (0, .05, .1, .15):
        c = combo([mk], ('percent', d), pack=1500); print('combo3', d, round(c['price']), round(c['profit']), f"{c['margin']:.1%}", f"take {c['take']:.1%}")
    print('maxdisc 20%', combo_max_discount([mk], .2, pack=1500), 'maxdisc 10%', combo_max_discount([mk], .1, pack=1500), 'breakeven', combo_max_discount([mk], 0, pack=1500))
    print('price for 20%', combo_price_for_margin([mk], .2, pack=1500))
    # mua kèm deal sốc: áo thun + móc khóa giảm 30% (giá đặc biệt cho món phụ)
    ao = dict(name='Áo thun', cost=60000, price=149000, cat=0.165, qty=1)
    mk1 = dict(name='Móc khóa (mua kèm)', cost=8000, price=11900, cat=0.16, qty=1)
    a = combo([ao], None, pack=3000); b = combo([ao, mk1], None, pack=3000)
    print('ao', round(a['profit']), 'ao+mk', round(b['profit']), 'tăng', round(b['profit'] - a['profit']))
    # kiểm tra đơn
    A = dict(price=74692, ship_buyer=21500, fixed_fee=11951, service_fee=7108, transaction_fee=5772, piship=2700, visibility=807, vat=747, pit=373)
    rA = check_order(A, .16, ('voucher_xtra', 'piship', 'visibility')); print('KD1', rA['status'], [(x['key'], x['diff']) for x in rA['lines']])
    rA2 = check_order(A, .15, ('piship',)); print('KD2', rA2['status'], rA2['mismatches'], rA2['total_diff'])
    for x in rA2['lines']:
        if x['status'] != 'khop': print('  ', x['label'], x['real'], x['app'], x['diff'], x['reason'], x['diag'])
    G = dict(price=170000, ship_buyer=146900, fixed_fee=23800, service_fee=12350, transaction_fee=19014, vat=0, pit=850)
    rG = check_order(G, .14, ('voucher_xtra',)); print('KD3', rG['status'], [(x['label'], x['diag']) for x in rG['lines'] if x['status'] != 'khop'])
    print('KD3 tắt GTGT', check_order(G, .14, ('voucher_xtra',), vat=False)['status'])
    N = dict(A, fixed_fee=0); print('KD4', check_order(N, .16, ('voucher_xtra', 'piship', 'visibility'), new_shop=True)['status'])
    R = dict(price=94692, refund=20000, ship_buyer=21500, fixed_fee=11951, service_fee=7108, transaction_fee=5772, piship=2700, visibility=807, vat=747, pit=373)
    print('KD5', check_order(R, .16, ('voucher_xtra', 'piship', 'visibility'))['status'])
    M = dict(A, fixed_fee=11953); print('KD6', check_order(M, .16, ('voucher_xtra', 'piship', 'visibility'), items=3)['status'])
    print(complaint_template('…8A2F', rA2['lines'][0]))


def write_vectors(path):
    """Ca kiểm thử chung cho Dart (app/test/addons_test.dart)."""
    import json
    mk = dict(name='Móc khóa', cost=8000, price=17000, cat=0.16, qty=3)
    ao = dict(name='Áo thun', cost=60000, price=149000, cat=0.165, qty=1)
    mk1 = dict(name='Móc khóa mua kèm', cost=8000, price=11900, cat=0.16, qty=1)
    big = dict(name='Nồi', cost=150000, price=300000, cat=0.10, qty=2)
    combos = []
    def add_c(id_, items, disc, **kw):
        c = combo(items, disc, **kw)
        combos.append(dict(id=id_, items=items, discount=list(disc) if disc else None,
                           kw={k: (list(v) if isinstance(v, tuple) else v) for k, v in kw.items()},
                           expect=dict(price=c['price'], profit=c['profit'], margin=c['margin'], vx=c['vx'],
                                       separate=separate(items, **kw))))
    add_c('CB2', [mk], None, pack=1500)
    for d in (.05, .1, .15):
        add_c(f'CB3-{int(d*100)}', [mk], ('percent', d), pack=1500)
    add_c('CB3-amount', [mk], ('amount', 10000), pack=1500)
    add_c('CB3-fixed', [mk], ('fixed', 45000), pack=1500)
    add_c('CB6', [ao, mk1], None, pack=3000)
    add_c('CB7', [big], ('percent', .1), pack=5000, programs=('voucher_xtra', 'piship'))
    add_c('CB7-cap', [dict(big, price=1200000, cost=600000)], None, pack=5000, programs=('voucher_xtra',))
    maxd = [dict(id='CB4-' + str(m), items=[mk], m=m, kw=dict(pack=1500), expect=combo_max_discount([mk], m, pack=1500))
            for m in (0.2, 0.1, 0.0)]
    A = dict(price=74692, ship_buyer=21500, fixed_fee=11951, service_fee=7108, transaction_fee=5772, piship=2700, visibility=807, vat=747, pit=373)
    G = dict(price=170000, ship_buyer=146900, fixed_fee=23800, service_fee=12350, transaction_fee=19014, vat=0, pit=850)
    full = ['voucher_xtra', 'piship', 'visibility']
    cases = [('KD1', A, .16, full, {}), ('KD2', A, .15, ['piship'], {}), ('KD3', G, .14, ['voucher_xtra'], {}),
             ('KD3b', G, .14, ['voucher_xtra'], dict(vat=False)), ('KD4', dict(A, fixed_fee=0), .16, full, dict(new_shop=True)),
             ('KD5', dict(A, price=94692, refund=20000), .16, full, {}), ('KD6', dict(A, fixed_fee=11953), .16, full, dict(items=3))]
    checks = []
    for id_, o, c, p, kw in cases:
        r = check_order(o, c, tuple(p), **kw)
        checks.append(dict(id=id_, order=o, cat_rate=c, programs=p, kw=kw,
                           expect=dict(status=r['status'], mismatches=r['mismatches'], total_diff=r['total_diff'],
                                       lines={x['key']: dict(status=x['status'], reason=x['reason'], diff=x['diff']) for x in r['lines']})))
    json.dump(dict(generated_by='tools/addons.py', combos=combos, max_discount=maxd, checks=checks),
              open(path, 'w'), ensure_ascii=False, indent=1)
    return len(combos) + len(maxd) + len(checks)
