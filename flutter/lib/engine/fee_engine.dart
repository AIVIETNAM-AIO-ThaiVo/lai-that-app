// Bộ máy tính Lãi Thật (v2, 12/11/2026). Port 1-1 từ tools/engine.py.
// Hàm thuần, không phụ thuộc Flutter: chạy được bằng `dart test`.
// Công thức và ký hiệu: wiki/engine/formula.md. Làm tròn chỉ ở bước hiển thị.

import 'dart:math' as math;

class Program {
  final String id;
  final String name;
  final double? rate; // % trên giá sau mã giảm giá shop
  final double? cap; // trần đồng/sản phẩm
  final double? amountPerOrder; // đồng/đơn
  const Program({required this.id, required this.name, this.rate, this.cap, this.amountPerOrder});

  factory Program.fromJson(Map<String, dynamic> j) => Program(
        id: j['id'] as String,
        name: j['name'] as String,
        rate: (j['rate'] as num?)?.toDouble(),
        cap: (j['cap_per_item'] as num?)?.toDouble(),
        amountPerOrder: (j['amount_per_order'] as num?)?.toDouble(),
      );
}

class PlatformFees {
  final String id;
  final String label;
  final double transactionRate;
  final double fixedPerOrder;
  final List<Program> programs;
  final double registeredDivisor;
  final List<Map<String, dynamic>> categories;
  const PlatformFees({
    required this.id,
    required this.label,
    required this.transactionRate,
    required this.fixedPerOrder,
    required this.programs,
    required this.registeredDivisor,
    required this.categories,
  });

  factory PlatformFees.fromJson(String id, Map<String, dynamic> j) {
    final fixed = (j['per_order_fixed'] as List)
        .cast<Map<String, dynamic>>()
        .where((x) => x['amount'] != null)
        .fold<double>(0, (s, x) => s + (x['amount'] as num).toDouble());
    return PlatformFees(
      id: id,
      label: j['label'] as String,
      transactionRate: (j['transaction_fee']['rate'] as num).toDouble(),
      fixedPerOrder: fixed,
      programs: ((j['programs'] as List?) ?? const [])
          .cast<Map<String, dynamic>>()
          .map(Program.fromJson)
          .toList(),
      registeredDivisor:
          ((j['tax_registered_seller'] as Map<String, dynamic>?)?['fee_divisor'] as num?)?.toDouble() ?? 1.0,
      categories: ((j['categories'] as List?) ?? const []).cast<Map<String, dynamic>>(),
    );
  }
}

class FeePresets {
  final String feeVersion;
  final String asOf;
  final Map<String, PlatformFees> platforms;
  const FeePresets({required this.feeVersion, required this.asOf, required this.platforms});

  factory FeePresets.fromJson(Map<String, dynamic> j) => FeePresets(
        feeVersion: j['fee_version'] as String,
        asOf: j['as_of'] as String,
        platforms: (j['platforms'] as Map<String, dynamic>).map(
            (k, v) => MapEntry(k, PlatformFees.fromJson(k, v as Map<String, dynamic>))),
      );
}

/// Mọi đầu vào của một lần tính. Tiền là đồng (VND), tỷ lệ là số thập phân (0.16 = 16%).
class CalcInput {
  final String platform;
  final double categoryRate;
  final double price; // giá niêm yết
  final double cost; // giá vốn
  final double sellerVoucher; // mã giảm giá của shop (đồng)
  final double shipBuyer; // phí ship người mua trả
  final double pack; // đóng gói mỗi đơn
  final Set<String> programs; // id chương trình đang bật
  final bool vat; // sàn khấu trừ GTGT 1%
  final bool pit; // sàn khấu trừ TNCN 0,5%
  final bool registered; // TikTok: shop đã đăng ký + xác minh MST
  final double affiliateRate;
  final double? roas;
  final double returnRate; // r
  final double lossPerReturn; // R
  final double? transactionOverride; // người dùng sửa % giao dịch
  final double? fixedOverride; // người dùng sửa phí cố định/đơn

  const CalcInput({
    required this.platform,
    required this.categoryRate,
    required this.price,
    required this.cost,
    this.sellerVoucher = 0,
    this.shipBuyer = 0,
    this.pack = 0,
    this.programs = const {},
    this.vat = true,
    this.pit = true,
    this.registered = false,
    this.affiliateRate = 0,
    this.roas,
    this.returnRate = 0,
    this.lossPerReturn = 0,
    this.transactionOverride,
    this.fixedOverride,
  });

  CalcInput copyWith({double? price, double? cost, double? sellerVoucher}) => CalcInput(
        platform: platform,
        categoryRate: categoryRate,
        price: price ?? this.price,
        cost: cost ?? this.cost,
        sellerVoucher: sellerVoucher ?? this.sellerVoucher,
        shipBuyer: shipBuyer,
        pack: pack,
        programs: programs,
        vat: vat,
        pit: pit,
        registered: registered,
        affiliateRate: affiliateRate,
        roas: roas,
        returnRate: returnRate,
        lossPerReturn: lossPerReturn,
        transactionOverride: transactionOverride,
        fixedOverride: fixedOverride,
      );
}

/// Một dòng trong bảng chi tiết phí.
class FeeLine {
  final String key;
  final String label;
  final double amount;
  final String basis; // giải thích cơ sở tính, hiện ở nút (i)
  const FeeLine(this.key, this.label, this.amount, this.basis);
}

class CalcResult {
  final double base; // B = giá − mã giảm giá shop
  final List<FeeLine> lines;
  final double platformFees;
  final double tax;
  final double other; // affiliate + quảng cáo
  final double payout; // tiền về cho đơn thành công
  final double profit; // lãi kỳ vọng mỗi đơn (đã tính hoàn hàng)
  double get margin => base == 0 ? 0 : profit / base;
  double get takeRate => base == 0 ? 0 : (platformFees + tax) / base;
  ProfitState get state => profit < 0
      ? ProfitState.loss
      : (margin < 0.10 ? ProfitState.thin : ProfitState.good);
  const CalcResult({
    required this.base,
    required this.lines,
    required this.platformFees,
    required this.tax,
    required this.other,
    required this.payout,
    required this.profit,
  });
}

enum ProfitState { good, thin, loss }

class _Rates {
  final double c, t, v, vis, aff, ads, tax, fixed;
  final double? cap;
  const _Rates(this.c, this.t, this.v, this.cap, this.vis, this.aff, this.ads, this.tax, this.fixed);
  double get k => c + t + vis + aff + ads + tax;
}

class FeeEngine {
  final FeePresets presets;
  const FeeEngine(this.presets);

  _Rates _rates(CalcInput i) {
    final pf = presets.platforms[i.platform]!;
    final div = i.registered ? pf.registeredDivisor : 1.0;
    final t = (i.transactionOverride ?? pf.transactionRate) / div;
    var fixed = (i.fixedOverride ?? pf.fixedPerOrder) / div;
    double v = 0, vis = 0;
    double? cap;
    for (final p in pf.programs) {
      if (!i.programs.contains(p.id)) continue;
      if (p.id == 'visibility') {
        vis += p.rate ?? 0.0;
      } else if (p.rate != null) {
        v += p.rate!;
        cap = p.cap;
      } else {
        fixed += p.amountPerOrder ?? 0.0;
      }
    }
    final double tax = (i.vat ? 0.01 : 0.0) + (i.pit ? 0.005 : 0.0);
    final ads = (i.roas != null && i.roas! > 0) ? 1 / i.roas! : 0.0;
    return _Rates(i.categoryRate / div, t, v, cap, vis, i.affiliateRate, ads, tax, fixed);
  }

  CalcResult calculate(CalcInput i) {
    final q = _rates(i);
    final b = i.price - i.sellerVoucher;
    final vAmt = q.cap != null ? math.min(q.v * b, q.cap!) : q.v * b;
    final lines = <FeeLine>[
      FeeLine('category', 'Phí cố định ngành', q.c * b, '${_pct(q.c)} × giá sau mã giảm giá shop'),
      FeeLine('transaction', 'Phí xử lý giao dịch', q.t * (b + i.shipBuyer),
          '${_pct(q.t)} × (giá sau mã giảm giá shop + ship người mua trả)'),
      if (vAmt > 0) FeeLine('voucher', 'Chương trình voucher', vAmt, '${_pct(q.v)} × giá, tối đa ${q.cap?.round() ?? '-'}đ'),
      if (q.vis > 0) FeeLine('visibility', 'Phí dịch vụ hiển thị', q.vis * b, '${_pct(q.vis)} × giá'),
      FeeLine('per_order', 'Phí cố định mỗi đơn', q.fixed, 'hạ tầng/xử lý đơn + PiShip nếu bật'),
    ];
    final platformFees = lines.fold<double>(0, (s, l) => s + l.amount);
    final tax = q.tax * b;
    final other = (q.aff + q.ads) * b;
    final payout = b - platformFees - tax - other;
    final ok = payout - i.cost - i.pack;
    final profit = (1 - i.returnRate) * ok - i.returnRate * i.lossPerReturn;
    return CalcResult(
      base: b,
      lines: lines,
      platformFees: platformFees,
      tax: tax,
      other: other,
      payout: payout,
      profit: profit,
    );
  }

  /// Giá sau mã giảm giá shop để lãi kỳ vọng = m × giá. m = 0 → giá hòa vốn. Trả về infinity nếu không thể.
  double priceForMargin(CalcInput i, double m) {
    final q = _rates(i);
    final r = i.returnRate;
    final x = q.fixed + q.t * i.shipBuyer + i.cost + i.pack;
    var den = (1 - r) * (1 - q.k - q.v) - m;
    if (den <= 0) return double.infinity;
    var b = ((1 - r) * x + r * i.lossPerReturn) / den;
    if (q.cap != null && q.v * b > q.cap!) {
      den = (1 - r) * (1 - q.k) - m;
      b = den > 0 ? ((1 - r) * (x + q.cap!) + r * i.lossPerReturn) / den : double.infinity;
    }
    return b;
  }

  /// Giá nhập tối đa để vẫn giữ % lãi m ở giá bán hiện tại.
  double maxCost(CalcInput i, double m) {
    final res = calculate(i.copyWith(cost: 0));
    final r = i.returnRate;
    return ((1 - r) * (res.payout - i.pack) - r * i.lossPerReturn - m * res.base) / (1 - r);
  }

  /// Lãi khi chạy Flash Sale giảm d (0.2 = 20%) trên giá niêm yết hiện tại.
  CalcResult flashSale(CalcInput i, double d) =>
      calculate(i.copyWith(sellerVoucher: i.sellerVoucher + (i.price - i.sellerVoucher) * d));
}

/// Làm tròn lên giá đẹp: dưới 100.000đ → x.900đ; từ 100.000đ → x9.000đ.
double nicePrice(double p) {
  if (p.isInfinite) return p;
  if (p < 100000) return (((p + 100) / 1000).ceil() * 1000 - 100).toDouble();
  return (((p + 1000) / 10000).ceil() * 10000 - 1000).toDouble();
}

String _pct(double x) => '${(x * 100).toStringAsFixed(x * 100 % 1 == 0 ? 0 : 2)}%';

/// 17000 → "17.000đ"; -1380 → "−1.380đ"
String formatVnd(double v) {
  final n = v.round();
  final s = n.abs().toString().replaceAllMapped(RegExp(r'\B(?=(\d{3})+(?!\d))'), (_) => '.');
  return '${n < 0 ? '−' : ''}$sđ';
}
