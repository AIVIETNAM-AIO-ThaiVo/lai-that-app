// Chạy: cd app && dart test test/addons_test.dart
// Ca kiểm thử sinh từ tools/addons.py (write_vectors) → test/addon_vectors.json.
import 'dart:convert';
import 'dart:io';

import 'package:test/test.dart';
import 'package:lai_that/engine/addons.dart';
import 'package:lai_that/engine/fee_engine.dart';

List<ComboItem> _items(List raw) => raw
    .cast<Map<String, dynamic>>()
    .map((j) => ComboItem(
          name: j['name'] as String,
          cost: (j['cost'] as num).toDouble(),
          price: (j['price'] as num).toDouble(),
          categoryRate: (j['cat'] as num).toDouble(),
          qty: j['qty'] as int,
        ))
    .toList();

ComboInput _input(Map<String, dynamic> v) {
  final kw = (v['kw'] as Map<String, dynamic>?) ?? const {};
  final d = v['discount'] as List?;
  final type = d == null
      ? DiscountType.none
      : {'percent': DiscountType.percent, 'amount': DiscountType.amount, 'fixed': DiscountType.fixed}[d[0]]!;
  return ComboInput(
    platform: 'shopee',
    items: _items(v['items'] as List),
    discountType: type,
    discountValue: d == null ? 0 : (d[1] as num).toDouble(),
    pack: (kw['pack'] as num?)?.toDouble() ?? 0,
    programs: ((kw['programs'] as List?) ?? const []).cast<String>().toSet(),
  );
}

void main() {
  final presets = FeePresets.fromJson(
      jsonDecode(File('assets/fee_presets.json').readAsStringSync()) as Map<String, dynamic>);
  final vec = jsonDecode(File('test/addon_vectors.json').readAsStringSync()) as Map<String, dynamic>;
  final combo = ComboEngine(presets);
  final checker = OrderChecker(presets);

  group('Combo khớp bản tham chiếu Python', () {
    for (final v in (vec['combos'] as List).cast<Map<String, dynamic>>()) {
      test(v['id'] as String, () {
        final i = _input(v);
        final r = combo.calculate(i);
        final e = v['expect'] as Map<String, dynamic>;
        expect(r.price, closeTo((e['price'] as num).toDouble(), 0.5));
        expect(r.profit, closeTo((e['profit'] as num).toDouble(), 0.5));
        expect(r.voucherFee, closeTo((e['vx'] as num).toDouble(), 0.5));
        expect(combo.separateProfit(i), closeTo((e['separate'] as num).toDouble(), 0.5));
      });
    }
    for (final v in (vec['max_discount'] as List).cast<Map<String, dynamic>>()) {
      test(v['id'] as String, () {
        final d = combo.maxDiscount(_input(v), (v['m'] as num).toDouble());
        expect(d, closeTo((v['expect'] as num).toDouble(), 1e-4));
      });
    }
  });

  group('Combo: ca thiết kế', () {
    final mk = [const ComboItem(name: 'Móc khóa', cost: 8000, price: 17000, categoryRate: 0.16, qty: 3)];
    test('3 móc khóa: bán lẻ 1.515đ, combo −10% 6.614đ', () {
      final i = ComboInput(platform: 'shopee', items: mk, discountType: DiscountType.percent, discountValue: 0.1, pack: 1500);
      expect(combo.separateProfit(i).round(), 1515);
      expect(combo.calculate(i).profit.round(), 6614);
    });
    test('Giá combo cho lãi 20%: 50.442đ → 50.900đ, dưới mức giảm tối thiểu → cảnh báo', () {
      final i = ComboInput(platform: 'shopee', items: mk, pack: 1500);
      final (p, nice) = combo.priceForMargin(i, 0.2);
      expect(p, closeTo(50442.5, 1));
      expect(nice, 50900);
      expect(combo.shopeeRuleWarning(i.withDiscount(DiscountType.fixed, nice)), isNotNull);
      expect(combo.shopeeRuleWarning(i.withDiscount(DiscountType.percent, 0.05)), isNull);
    });
    test('Chế độ Sản phẩm bộ dùng FeeEngine lõi: một lần phí mỗi đơn, trần voucher một lần', () {
      final i = ComboInput(
          platform: 'shopee',
          items: [const ComboItem(name: 'Nồi', cost: 600000, price: 1200000, categoryRate: 0.10, qty: 2)],
          mode: ComboMode.bundle,
          bundleCategoryRate: 0.10,
          programs: {'voucher_xtra'});
      expect(combo.calculate(i).voucherFee, 50000);
    });
    test('Giá combo ≤ 0 bị từ chối', () {
      final i = ComboInput(platform: 'shopee', items: mk, discountType: DiscountType.percent, discountValue: 1.0);
      expect(() => combo.calculate(i), throwsArgumentError);
    });
  });

  group('Kiểm tra đơn khớp bản tham chiếu Python', () {
    const statusCode = {
      CheckStatus.khop: 'khop',
      CheckStatus.lechNho: 'lech_nho',
      CheckStatus.lech: 'lech',
      CheckStatus.dieuChinh: 'dieu_chinh',
    };
    for (final v in (vec['checks'] as List).cast<Map<String, dynamic>>()) {
      test(v['id'] as String, () {
        final kw = (v['kw'] as Map<String, dynamic>?) ?? const {};
        final r = checker.check(
          PlatformOrder.fromJson(v['order'] as Map<String, dynamic>),
          categoryRate: (v['cat_rate'] as num).toDouble(),
          programs: (v['programs'] as List).cast<String>().toSet(),
          vat: (kw['vat'] as bool?) ?? true,
          items: (kw['items'] as int?) ?? 1,
          newShop: (kw['new_shop'] as bool?) ?? false,
        );
        final e = v['expect'] as Map<String, dynamic>;
        expect(statusCode[r.status], e['status']);
        expect(r.mismatches.length, e['mismatches']);
        final lines = e['lines'] as Map<String, dynamic>;
        for (final l in r.lines) {
          final el = lines[l.key] as Map<String, dynamic>;
          expect(statusCode[l.status], el['status'], reason: l.key);
          expect(l.reason, el['reason'], reason: l.key);
          expect(l.diff, closeTo((el['diff'] as num).toDouble(), 1), reason: l.key);
        }
      });
    }
  });

  test('Mẫu khiếu nại có đủ số liệu, định dạng đồng', () {
    final r = checker.check(
        const PlatformOrder(price: 74692, shipBuyer: 21500, fixedFee: 11951, serviceFee: 7108, transactionFee: 5772, piship: 2700, visibility: 807, vat: 747, pit: 373),
        categoryRate: 0.15,
        programs: {'piship'});
    final t = OrderChecker.complaintTemplate('…8A2F', r.lines.first);
    expect(t, contains('11.951đ'));
    expect(t, contains('11.204đ'));
    expect(t, contains('747đ'));
  });
}
