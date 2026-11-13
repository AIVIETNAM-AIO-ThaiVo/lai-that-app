// Add-on Combo và Kiểm tra đơn (v1, 13/11/2026). Port 1-1 từ tools/addons.py.
// Hàm thuần, dùng chung FeePresets với fee_engine.dart. Tài liệu: docs/addons/ADDONS.md.

import 'dart:math' as math;

import 'fee_engine.dart';

// ---------------------------------------------------------------- Combo

class ComboItem {
  final String name;
  final double cost; // giá vốn 1 đơn vị
  final double price; // giá lẻ 1 đơn vị
  final double categoryRate;
  final int qty;
  final String? productId; // liên kết sản phẩm trong Danh mục (null nếu nhập nhanh)
  const ComboItem({
    required this.name,
    required this.cost,
    required this.price,
    required this.categoryRate,
    this.qty = 1,
    this.productId,
  });

  ComboItem withQty(int q) =>
      ComboItem(name: name, cost: cost, price: price, categoryRate: categoryRate, qty: q, productId: productId);
}

enum DiscountType { none, percent, amount, fixed }

/// promo: Combo Khuyến Mãi / Mua kèm (mỗi món là một sản phẩm, trần voucher theo từng món).
/// bundle: đăng một sản phẩm "Bộ" (gọi FeeEngine lõi với một món).
enum ComboMode { promo, bundle }

class ComboInput {
  final String platform;
  final List<ComboItem> items;
  final DiscountType discountType;
  final double discountValue; // percent: 0.1 = 10%; amount/fixed: đồng
  final ComboMode mode;
  final double bundleCategoryRate; // chỉ dùng cho mode bundle
  final double shipBuyer;
  final double pack;
  final Set<String> programs;
  final bool vat;
  final bool pit;
  final bool registered;
  final double affiliateRate;
  final double? roas;
  final double returnRate;
  final double lossPerReturn;

  const ComboInput({
    required this.platform,
    required this.items,
    this.discountType = DiscountType.none,
    this.discountValue = 0,
    this.mode = ComboMode.promo,
    this.bundleCategoryRate = 0,
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
  });

  ComboInput withDiscount(DiscountType t, double v) => ComboInput(
        platform: platform,
        items: items,
        discountType: t,
        discountValue: v,
        mode: mode,
        bundleCategoryRate: bundleCategoryRate,
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
      );

  ComboInput withItems(List<ComboItem> its, {double? ship}) => ComboInput(
        platform: platform,
        items: its,
        discountType: DiscountType.none,
        mode: mode,
        bundleCategoryRate: bundleCategoryRate,
        shipBuyer: ship ?? shipBuyer,
        pack: pack,
        programs: programs,
        vat: vat,
        pit: pit,
        registered: registered,
        affiliateRate: affiliateRate,
        roas: roas,
        returnRate: returnRate,
        lossPerReturn: lossPerReturn,
      );

  double get gross => items.fold(0.0, (s, i) => s + i.price * i.qty);
  double get totalCost => items.fold(0.0, (s, i) => s + i.cost * i.qty);
  int get unitCount => items.fold(0, (s, i) => s + i.qty);

  /// Giá combo sau giảm (B).
  double get comboPrice {
    switch (discountType) {
      case DiscountType.none:
        return gross;
      case DiscountType.percent:
        return gross * (1 - discountValue);
      case DiscountType.amount:
        return gross - discountValue;
      case DiscountType.fixed:
        return discountValue;
    }
  }
}

class ComboResult {
  final double gross;
  final double price; // B
  final double categoryFee;
  final double transactionFee;
  final double voucherFee;
  final double visibilityFee;
  final double perOrder;
  final double tax;
  final double other;
  final double cost;
  final double profit;
  const ComboResult({
    required this.gross,
    required this.price,
    required this.categoryFee,
    required this.transactionFee,
    required this.voucherFee,
    required this.visibilityFee,
    required this.perOrder,
    required this.tax,
    required this.other,
    required this.cost,
    required this.profit,
  });
  double get discount => gross - price;
  double get discountRate => gross == 0 ? 0 : discount / gross;
  double get platformFees => categoryFee + transactionFee + voucherFee + visibilityFee + perOrder;
  double get margin => price == 0 ? 0 : profit / price;
  double get takeRate => price == 0 ? 0 : (platformFees + tax) / price;
  ProfitState get state =>
      profit < 0 ? ProfitState.loss : (margin < 0.10 ? ProfitState.thin : ProfitState.good);

  /// Các dòng cho bảng chi tiết; perOrder đánh dấu khoản tính một lần cho cả đơn.
  List<FeeLine> get lines => [
        FeeLine('category', 'Phí cố định ngành', categoryFee, 'mỗi sản phẩm · theo ngành, trên giá sau giảm'),
        FeeLine('transaction', 'Phí xử lý giao dịch', transactionFee, 'mỗi đơn · trên giá combo + ship người mua trả'),
        if (voucherFee > 0) FeeLine('voucher', 'Chương trình voucher', voucherFee, 'mỗi sản phẩm · có trần mỗi sản phẩm'),
        if (visibilityFee > 0) FeeLine('visibility', 'Phí dịch vụ hiển thị', visibilityFee, 'mỗi đơn'),
        FeeLine('per_order', 'Phí cố định mỗi đơn', perOrder, 'mỗi đơn · trả một lần cho cả combo'),
      ];
}

/// Giới hạn tối thiểu của công cụ Combo Khuyến Mãi Shopee.
const double kShopeeComboMinPercent = 0.05;
const double kShopeeComboMinAmount = 10000;

class ComboEngine {
  final FeePresets presets;
  final FeeEngine core;
  ComboEngine(this.presets) : core = FeeEngine(presets);

  ComboResult calculate(ComboInput i) {
    final g = i.gross;
    final b = i.comboPrice;
    if (g <= 0 || b <= 0) {
      throw ArgumentError('Giá combo phải lớn hơn 0');
    }
    if (i.mode == ComboMode.bundle) return _bundle(i, b);

    final pf = presets.platforms[i.platform]!;
    final div = i.registered ? pf.registeredDivisor : 1.0;
    final t = pf.transactionRate / div;
    var perOrder = pf.fixedPerOrder / div;
    double vRate = 0, vis = 0;
    double? cap;
    for (final p in pf.programs) {
      if (!i.programs.contains(p.id)) continue;
      if (p.id == 'visibility') {
        vis += p.rate ?? 0.0;
      } else if (p.rate != null) {
        vRate += p.rate!;
        cap = p.cap;
      } else {
        perOrder += p.amountPerOrder ?? 0.0;
      }
    }
    final share = b / g;
    double cat = 0, vx = 0;
    for (final it in i.items) {
      final bi = it.price * share; // chia giảm theo tỷ lệ giá trị
      cat += it.categoryRate / div * bi * it.qty;
      if (vRate > 0) {
        final v = vRate * bi;
        vx += (cap != null ? math.min(v, cap) : v) * it.qty;
      }
    }
    final tx = t * (b + i.shipBuyer);
    final double taxRate = (i.vat ? 0.01 : 0.0) + (i.pit ? 0.005 : 0.0);
    final tax = taxRate * b;
    final ads = (i.roas != null && i.roas! > 0) ? 1 / i.roas! : 0.0;
    final other = (i.affiliateRate + ads) * b;
    final fees = cat + tx + vx + vis * b + perOrder;
    final cost = i.totalCost;
    final ok = b - fees - tax - other - cost - i.pack;
    final profit = (1 - i.returnRate) * ok - i.returnRate * i.lossPerReturn;
    return ComboResult(
      gross: g,
      price: b,
      categoryFee: cat,
      transactionFee: tx,
      voucherFee: vx,
      visibilityFee: vis * b,
      perOrder: perOrder,
      tax: tax,
      other: other,
      cost: cost,
      profit: profit,
    );
  }

  ComboResult _bundle(ComboInput i, double b) {
    final res = core.calculate(CalcInput(
      platform: i.platform,
      categoryRate: i.bundleCategoryRate,
      price: b,
      cost: i.totalCost,
      shipBuyer: i.shipBuyer,
      pack: i.pack,
      programs: i.programs,
      vat: i.vat,
      pit: i.pit,
      registered: i.registered,
      affiliateRate: i.affiliateRate,
      roas: i.roas,
      returnRate: i.returnRate,
      lossPerReturn: i.lossPerReturn,
    ));
    double line(String k) => res.lines.where((l) => l.key == k).fold(0.0, (s, l) => s + l.amount);
    return ComboResult(
      gross: i.gross,
      price: b,
      categoryFee: line('category'),
      transactionFee: line('transaction'),
      voucherFee: line('voucher'),
      visibilityFee: line('visibility'),
      perOrder: line('per_order'),
      tax: res.tax,
      other: res.other,
      cost: i.totalCost,
      profit: res.profit,
    );
  }

  /// Lãi khi bán lẻ cùng số món: mỗi đơn vị là một đơn riêng, không ship người mua trả.
  double separateProfit(ComboInput i) {
    var total = 0.0;
    for (final it in i.items) {
      final one = ComboInput(
        platform: i.platform,
        items: [it.withQty(1)],
        pack: i.pack,
        programs: i.programs,
        vat: i.vat,
        pit: i.pit,
        registered: i.registered,
        affiliateRate: i.affiliateRate,
        roas: i.roas,
        returnRate: i.returnRate,
        lossPerReturn: i.lossPerReturn,
      );
      total += calculate(one).profit * it.qty;
    }
    return total;
  }

  /// Mức giảm % lớn nhất để % lãi combo ≥ m (m = 0 → hòa vốn). null nếu không giảm cũng chưa đạt.
  double? maxDiscount(ComboInput i, double m) {
    if (calculate(i.withDiscount(DiscountType.percent, 0)).margin < m) return null;
    var lo = 0.0, hi = 0.95;
    for (var k = 0; k < 60; k++) {
      final mid = (lo + hi) / 2;
      if (calculate(i.withDiscount(DiscountType.percent, mid)).margin >= m) {
        lo = mid;
      } else {
        hi = mid;
      }
    }
    return lo;
  }

  /// Giá combo thấp nhất để đạt % lãi m, và giá đẹp làm tròn lên.
  (double, double) priceForMargin(ComboInput i, double m) {
    var lo = 0.0, hi = i.gross * 3;
    for (var k = 0; k < 80; k++) {
      final mid = (lo + hi) / 2;
      if (mid > 0 && calculate(i.withDiscount(DiscountType.fixed, mid)).margin >= m) {
        hi = mid;
      } else {
        lo = mid;
      }
    }
    return (hi, nicePrice(hi));
  }

  /// Cảnh báo theo luật công cụ Combo Khuyến Mãi Shopee. null nếu hợp lệ.
  String? shopeeRuleWarning(ComboInput i) {
    if (i.platform != 'shopee' || i.mode != ComboMode.promo) return null;
    if (i.unitCount < 2) return 'Combo cần ít nhất 2 sản phẩm';
    final d = i.gross - i.comboPrice;
    if (d < kShopeeComboMinAmount && d / i.gross < kShopeeComboMinPercent) {
      return 'Shopee yêu cầu giảm tối thiểu 5% hoặc 10.000đ';
    }
    return null;
  }
}

// ---------------------------------------------------------- Kiểm tra đơn

enum CheckStatus { khop, lechNho, lech, dieuChinh }

const Map<CheckStatus, String> kCheckStatusLabel = {
  CheckStatus.khop: 'Khớp',
  CheckStatus.lechNho: 'Lệch nhỏ',
  CheckStatus.lech: 'Lệch',
  CheckStatus.dieuChinh: 'Có điều chỉnh',
};

/// Số đọc từ Doanh thu đơn hàng (nhập tay) hoặc dòng Đơn hàng của Báo Cáo Doanh Thu. Đơn vị: đồng.
class PlatformOrder {
  final String orderRef;
  final double price;
  final double sellerVoucher;
  final double refund;
  final double shipBuyer;
  final double fixedFee;
  final double serviceFee;
  final double transactionFee;
  final double piship;
  final double visibility;
  final double affiliate;
  final double vat;
  final double pit;
  final double adjustment;
  final double compensation;
  final double shipDiscrepancy;
  const PlatformOrder({
    this.orderRef = '',
    required this.price,
    this.sellerVoucher = 0,
    this.refund = 0,
    this.shipBuyer = 0,
    this.fixedFee = 0,
    this.serviceFee = 0,
    this.transactionFee = 0,
    this.piship = 0,
    this.visibility = 0,
    this.affiliate = 0,
    this.vat = 0,
    this.pit = 0,
    this.adjustment = 0,
    this.compensation = 0,
    this.shipDiscrepancy = 0,
  });

  factory PlatformOrder.fromJson(Map<String, dynamic> j) {
    double g(String k) => (j[k] as num?)?.toDouble() ?? 0.0;
    return PlatformOrder(
      orderRef: (j['order_ref'] as String?) ?? '',
      price: g('price'),
      sellerVoucher: g('seller_voucher'),
      refund: g('refund'),
      shipBuyer: g('ship_buyer'),
      fixedFee: g('fixed_fee'),
      serviceFee: g('service_fee'),
      transactionFee: g('transaction_fee'),
      piship: g('piship'),
      visibility: g('visibility'),
      affiliate: g('affiliate'),
      vat: g('vat'),
      pit: g('pit'),
      adjustment: g('adjustment'),
      compensation: g('compensation'),
      shipDiscrepancy: g('ship_discrepancy'),
    );
  }

  bool get hasAdjustment => refund != 0 || adjustment != 0 || compensation != 0 || shipDiscrepancy != 0;
}

class CheckLine {
  final String key;
  final String label;
  final double real; // sàn trừ
  final double expected; // theo biểu phí
  final CheckStatus status;
  final String reason; // reason_code cho tracking
  final String diagnosis;
  const CheckLine(this.key, this.label, this.real, this.expected, this.status, this.reason, this.diagnosis);
  double get diff => real - expected;
}

class OrderCheckResult {
  final double base;
  final List<CheckLine> lines;
  final CheckStatus status;
  final bool adjusted;
  const OrderCheckResult(this.base, this.lines, this.status, this.adjusted);
  List<CheckLine> get mismatches => lines.where((l) => l.status == CheckStatus.lech).toList();
  String get topReason => mismatches.isEmpty ? '' : mismatches.first.reason;
  double get totalDiff =>
      lines.where((l) => l.status != CheckStatus.khop).fold(0.0, (s, l) => s + l.diff.roundToDouble());
}

class OrderChecker {
  final FeePresets presets;
  const OrderChecker(this.presets);

  static CheckStatus statusOf(double diff, double expected, double real, int items) {
    final a = diff.abs();
    if (a <= items + 1) return CheckStatus.khop;
    if (a <= 100 && a <= 0.01 * math.max(expected.abs(), real.abs())) return CheckStatus.lechNho;
    return CheckStatus.lech;
  }

  List<String> categoriesForRate(double rate, {String platform = 'shopee', double tol = 0.0005}) {
    final cats = presets.platforms[platform]?.categories ?? const [];
    return cats
        .where((c) =>
            (c['min'] as num).toDouble() - tol <= rate && rate <= (c['max'] as num).toDouble() + tol)
        .map((c) => c['name'] as String)
        .toList();
  }

  /// Kiểm tra một đơn Shopee. [items] = số sản phẩm trong đơn (dung sai làm tròn).
  OrderCheckResult check(
    PlatformOrder o, {
    required double categoryRate,
    Set<String> programs = const {},
    bool vat = true,
    bool pit = true,
    int items = 1,
    bool newShop = false,
  }) {
    final b = o.price - o.sellerVoucher - o.refund;
    final s = o.shipBuyer;
    final lines = <CheckLine>[];

    void add(String key, String label, double real, double expected, (String, String) Function(double) diag) {
      final st = statusOf(real - expected, expected, real, items);
      var reason = '', text = '';
      if (st == CheckStatus.lech) {
        (reason, text) = diag(real);
      } else if (st == CheckStatus.lechNho) {
        reason = 'rounding';
        text = 'Lệch nhỏ, có thể do làm tròn hoặc mã giảm giá được chia lẻ';
      }
      lines.add(CheckLine(key, label, real, expected.roundToDouble(), st, reason, text));
    }

    String pct(double x) => '${(x * 100).toStringAsFixed(2).replaceAll('.', ',')}%';

    add('fixed_fee', 'Phí cố định', o.fixedFee, newShop ? 0.0 : categoryRate * b, (real) {
      if (real == 0) {
        return ('new_shop_waiver', 'Sàn không thu phí cố định: kiểm tra ưu đãi shop mới (30 ngày) hoặc chương trình riêng');
      }
      final r = real / b;
      final names = categoriesForRate(r);
      final hint = names.isEmpty ? '' : ' (ngành có mức này: ${names.take(3).join(', ')})';
      return ('category_rate', 'Sàn đang tính ${pct(r)} thay vì ${pct(categoryRate)}$hint');
    });

    add('transaction_fee', 'Phí xử lý giao dịch', o.transactionFee, 0.06 * (b + s),
        (real) => ('transaction_base',
            'Tương đương ${pct(real / (b + s))} trên (giá + ship người mua trả ${formatVnd(s)}); kiểm tra ship hoặc chương trình thanh toán'));

    final vxOn = programs.contains('voucher_xtra');
    final vxExp = vxOn ? math.min(0.055 * b, 50000.0) : 0.0;
    add('service_fee', 'Phí dịch vụ (hạ tầng + gói chương trình)', o.serviceFee, 3000 + vxExp, (real) {
      final extra = real - 3000;
      if (!vxOn && extra > 0.04 * b) {
        if ((extra - 50000).abs() <= 2) {
          return ('voucher_program', 'Có phí Voucher Xtra, đã chạm trần 50.000đ, dù bạn ghi là không tham gia');
        }
        return ('voucher_program',
            'Có phí gói chương trình ≈ ${(extra / b * 100).toStringAsFixed(1).replaceAll('.', ',')}% (Voucher Xtra 5,5%) dù bạn ghi là không tham gia');
      }
      if (vxOn && extra < 1000) {
        return ('voucher_program', 'Không thấy phí Voucher Xtra dù bạn ghi là có tham gia');
      }
      return ('unknown', 'Phí dịch vụ khác dự kiến: xem trang Service Fee Details trong Báo Cáo Doanh Thu');
    });

    add('piship', 'PiShip', o.piship, programs.contains('piship') ? 2700.0 : 0.0,
        (real) => ('piship', real > 0 ? 'Đơn bị trừ PiShip 2.700đ: bật PiShip cho sản phẩm' : 'Không thấy PiShip dù bạn ghi là có'));
    add('visibility', 'Phí dịch vụ hiển thị', o.visibility, programs.contains('visibility') ? 0.0108 * b : 0.0,
        (real) => ('visibility',
            real > 0 ? 'Phí hiển thị ≈ ${pct(real / b)} doanh thu đơn: bật phí hiển thị' : 'Không thấy phí hiển thị dù bạn ghi là có'));
    add('vat', 'Thuế GTGT', o.vat, vat ? 0.01 * b : 0.0,
        (real) => ('vat_not_withheld',
            real == 0 ? 'Sàn không khấu trừ GTGT cho đơn này: tắt công tắc GTGT' : 'Sàn khấu trừ GTGT ${pct(real / b)}: bật công tắc GTGT'));
    add('pit', 'Thuế TNCN', o.pit, pit ? 0.005 * b : 0.0,
        (real) => ('vat_not_withheld', 'Thuế TNCN ${pct(real / b)} doanh thu'));

    var worst = CheckStatus.khop;
    for (final l in lines) {
      if (l.status.index > worst.index) worst = l.status;
    }
    final status = (o.hasAdjustment && worst != CheckStatus.lech) ? CheckStatus.dieuChinh : worst;
    return OrderCheckResult(b, lines, status, o.hasAdjustment);
  }

  /// Nội dung khiếu nại để người bán tự gửi qua Kênh Người Bán. Giọng trung tính.
  static String complaintTemplate(String orderRef, CheckLine l, {String feeVersion = '23/05/2026'}) =>
      'Kính gửi Shopee,\nĐơn hàng $orderRef: khoản "${l.label}" đã trừ ${formatVnd(l.real)}. '
      'Theo biểu phí áp dụng từ $feeVersion, khoản này dự kiến ${formatVnd(l.expected)} '
      '(chênh lệch ${formatVnd(l.diff)}). Nhờ Shopee kiểm tra giúp ngành hàng/chương trình áp cho sản phẩm '
      'và hoàn phần chênh lệch nếu có sai sót. Cảm ơn.';
}
