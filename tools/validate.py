"""Đối chiếu bộ máy tính với chi tiết doanh thu của đơn thật, rồi xuất app/test/test_vectors.json cho unit test Dart.

So sánh "sàn trừ" = phụ phí + thuế trên màn Chi tiết doanh thu (không gồm giá vốn, không gồm ship do sàn trợ giá).
Ngưỡng đạt: lệch < 1% giá bán (yêu cầu trong Product Plan). Thực tế lệch 0–1đ do sàn làm tròn từng dòng.
"""
import json, os
from engine import breakdown

HERE = os.path.dirname(os.path.abspath(__file__))
FB = "Nhóm Facebook 'Shopee người bán - chia sẻ kinh nghiệm bán hàng Shopee' (groupnguoibanshopee), tìm 'phí xử lý giao dịch'"
ORDERS = [
    # id, nguồn, giá sp, mã giảm giá shop, ship người mua trả, % ngành, chương trình, affiliate đ, GTGT?, sàn trừ thực tế (phụ phí + thuế)
    ("A_keo_sua", "https://www.youtube.com/watch?v=CRe4m3Gp4vI (~8:10), đã nhận tiền 16/10/2026", 74692, 0, 21500, .16, ["voucher_xtra", "piship", "visibility"], 4840, True, 33178 + 1120),
    ("B_dem_topper", "https://www.youtube.com/watch?v=B-7xjG5lnH8 (~18:38), 27/10/2026", 325000, 0, 34500, .16, ["voucher_xtra"], 0, True, 94445 + 4875),
    ("F_dien_tu", FB + ", đơn 11/2026", 650000, 3000, 0, .12, ["piship"], 0, True, 122160 + 9705),
    ("G_thuc_an_meo", FB, 170000, 0, 146900, .14, ["voucher_xtra"], 0, False, 55164 + 850),
    ("H_thuc_an_meo", FB, 180000, 0, 0, .14, ["voucher_xtra"], 0, True, 48900 + 2700),
    ("I_my_pham", FB + ", thanh toán dự kiến 15/09/2026", 275000, 0, 0, .17, ["voucher_xtra", "piship"], 0, True, 84075 + 4125),
    ("J_thoi_trang", FB, 450000, 18000, 0, .165, ["voucher_xtra", "piship"], 34432, True, 161092 + 6480),
    ("K_thoi_trang", FB, 350000, 0, 32800, .165, ["voucher_xtra", "visibility"], 0, True, 106748 + 5250),
]


def run():
    vectors, ok = [], 0
    print(f"{'Đơn':16s} {'Thực tế':>9s} {'App':>10s} {'Lệch':>6s} {'%giá':>6s}")
    for oid, src, price, voucher, ship, cat, progs, aff_amt, vat, real in ORDERS:
        B = price - voucher
        aff = aff_amt / B
        b = breakdown(price, 0, cat, 'shopee', seller_voucher=voucher, ship=ship,
                      programs=tuple(progs), vat=vat, aff=aff)
        app = b['platform_fees'] + b['tax'] + b['other']
        err = abs(app - real) / price
        ok += err < 0.01
        print(f"{oid:16s} {real:>9,} {app:>10,.0f} {app - real:>+6.0f} {err:>6.2%}")
        vectors.append(dict(id=oid, source=src, platform='shopee', price=price, seller_voucher=voucher,
                            ship_buyer=ship, category_rate=cat, programs=progs, affiliate_rate=aff,
                            vat=vat, expected_total_deduction=real, engine_total_deduction=round(app, 2)))
    print(f"Đạt: {ok}/{len(ORDERS)}")
    json.dump(vectors, open(os.path.join(HERE, '..', 'app', 'test', 'test_vectors.json'), 'w', encoding='utf-8'),
              ensure_ascii=False, indent=2)


if __name__ == '__main__':
    run()
