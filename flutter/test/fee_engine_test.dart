// Chạy: cd app && dart test (hoặc flutter test)
import 'dart:convert';
import 'dart:io';

import 'package:test/test.dart';
import 'package:lai_that/engine/fee_engine.dart';

void main() {
  final presets = FeePresets.fromJson(
      jsonDecode(File('assets/fee_presets.json').readAsStringSync()) as Map<String, dynamic>);
  final engine = FeeEngine(presets);

  group('8 đơn Shopee thật: lệch < 1% giá bán', () {
    final vectors = (jsonDecode(File('test/test_vectors.json').readAsStringSync()) as List)
        .cast<Map<String, dynamic>>();
    for (final v in vectors) {
      test(v['id'] as String, () {
        final r = engine.calculate(CalcInput(
          platform: v['platform'] as String,
          categoryRate: (v['category_rate'] as num).toDouble(),
          price: (v['price'] as num).toDouble(),
          cost: 0,
          sellerVoucher: (v['seller_voucher'] as num).toDouble(),
          shipBuyer: (v['ship_buyer'] as num).toDouble(),
          programs: (v['programs'] as List).cast<String>().toSet(),
          vat: v['vat'] as bool,
          affiliateRate: (v['affiliate_rate'] as num).toDouble(),
        ));
        final app = r.platformFees + r.tax + r.other;
        final real = (v['expected_total_deduction'] as num).toDouble();
        expect((app - real).abs() / (v['price'] as num), lessThan(0.01));
        expect((app - real).abs(), lessThanOrEqualTo(2)); // sàn làm tròn từng dòng
      });
    }
  });

  group('Ca thiết kế (khớp canvas UI)', () {
    const mk = CalcInput(platform: 'shopee', categoryRate: 0.16, price: 17000, cost: 8000, pack: 1500);
    test('Móc khóa 17.000đ Shopee: lãi 505đ, mỏng, sàn+thuế 41%', () {
      final r = engine.calculate(mk);
      expect(r.profit.round(), 505);
      expect(r.state, ProfitState.thin);
      expect((r.takeRate * 100).round(), 41);
    });
    test('Hòa vốn 16.340đ, giá 20% = 22.124đ, giá đẹp 22.900đ lãi 5.018đ', () {
      expect(engine.priceForMargin(mk, 0).ceil(), 16340);
      expect(engine.priceForMargin(mk, 0.2).ceil(), 22124);
      expect(nicePrice(engine.priceForMargin(mk, 0.2)), 22900);
      expect(engine.calculate(mk.copyWith(price: 22900)).profit.round(), 5018);
    });
    test('Flash Sale giảm 30% từ 22.900đ thì lỗ 237đ; giá nhập tối đa 8.438đ', () {
      final p = mk.copyWith(price: 22900);
      expect(engine.flashSale(p, 0.3).profit.round(), -237);
      expect(engine.maxCost(p, 0.2).round(), 8438);
    });
    test('TikTok Shop 13%: lãi 1.015đ', () {
      const tk = CalcInput(platform: 'tiktok_shop', categoryRate: 0.13, price: 17000, cost: 8000, pack: 1500);
      expect(engine.calculate(tk).profit.round(), 1015);
    });
    test('Áo thun 149.000đ, hoàn 8%: 41.061đ; + Voucher Xtra: 33.521đ', () {
      const a = CalcInput(
          platform: 'shopee', categoryRate: 0.165, price: 149000, cost: 60000, pack: 3000,
          returnRate: 0.08, lossPerReturn: 30000);
      expect(engine.calculate(a).profit.round(), 41061);
      final vx = CalcInput(
          platform: 'shopee', categoryRate: 0.165, price: 149000, cost: 60000, pack: 3000,
          returnRate: 0.08, lossPerReturn: 30000, programs: const {'voucher_xtra'});
      expect(engine.calculate(vx).profit.round(), 33521);
    });
    test('Voucher Xtra chạm trần 50.000đ', () {
      const n = CalcInput(
          platform: 'shopee', categoryRate: 0.11, price: 1200000, cost: 750000, pack: 10000,
          programs: {'voucher_xtra'});
      final r = engine.calculate(n);
      expect(r.lines.firstWhere((l) => l.key == 'voucher').amount, 50000);
    });
    test('Định dạng tiền', () {
      expect(formatVnd(17000), '17.000đ');
      expect(formatVnd(-1380), '−1.380đ');
    });
  });
}
