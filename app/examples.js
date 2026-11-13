// Sản phẩm mẫu — đúng các ca trong 1-wiki/engine/test-cases.md (dùng cho ví dụ lần đầu và test).
const base = { platform: 'shopee', voucherValue: 0, voucherUnit: 'vnd', sellerVoucher: 0, shipBuyer: 0, programs: [], vat: true, pit: true };

export const EXAMPLES = [
  { id: 'kep-toc', name: 'Kẹp tóc', input: { ...base, categoryName: 'Phụ Kiện Thời Trang', categoryRate: 0.165, price: 12000, cost: 6000, pack: 1500 } },
  { id: 'op-dien-thoai', name: 'Ốp điện thoại', input: { ...base, categoryName: 'Điện Thoại & Phụ Kiện', categoryRate: 0.15, price: 25000, cost: 15000, pack: 1500 } },
  { id: 'moc-khoa', name: 'Móc khóa', input: { ...base, categoryName: 'Sở thích & Sưu tầm', categoryRate: 0.16, price: 17000, cost: 8000, pack: 1500 } },
  { id: 'ao-thun', name: 'Áo thun nữ', input: { ...base, categoryName: 'Thời Trang Nữ', categoryRate: 0.165, price: 149000, cost: 60000, pack: 3000, returnRate: 0.08, lossPerReturn: 30000 } },
];

/** 3 ví dụ nhanh trên màn Tính lãi lần đầu. */
export const QUICK_EXAMPLES = ['moc-khoa', 'ao-thun', 'kep-toc'].map((id) => EXAMPLES.find((e) => e.id === id));
