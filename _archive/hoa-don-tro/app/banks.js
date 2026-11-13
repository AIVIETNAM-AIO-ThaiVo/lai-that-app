// Ngân hàng hỗ trợ VietQR (tên ngắn + BIN NAPAS 6 số).
// [ASSUMPTION] theo hiểu biết chung — cần đối chiếu danh sách chính thức của NAPAS (xem 4-memory/po-questions.md).
export const BANKS = [
  { name: 'Vietcombank', bin: '970436' },
  { name: 'VietinBank', bin: '970415' },
  { name: 'BIDV', bin: '970418' },
  { name: 'Agribank', bin: '970405' },
  { name: 'Techcombank', bin: '970407' },
  { name: 'MB Bank', bin: '970422' },
  { name: 'ACB', bin: '970416' },
  { name: 'VPBank', bin: '970432' },
  { name: 'TPBank', bin: '970423' },
  { name: 'Sacombank', bin: '970403' },
  { name: 'HDBank', bin: '970437' },
  { name: 'VIB', bin: '970441' },
  { name: 'SHB', bin: '970443' },
  { name: 'MSB', bin: '970426' },
  { name: 'OCB', bin: '970448' },
  { name: 'SeABank', bin: '970440' },
  { name: 'Eximbank', bin: '970431' },
  { name: 'LPBank', bin: '970449' },
  { name: 'Nam A Bank', bin: '970428' },
  { name: 'Bac A Bank', bin: '970409' },
  { name: 'ABBANK', bin: '970425' },
  { name: 'BVBank', bin: '970454' },
  { name: 'Kienlongbank', bin: '970452' },
  { name: 'PVcomBank', bin: '970412' },
  { name: 'SCB', bin: '970429' },
];

export const bankName = (bin) => BANKS.find((b) => b.bin === bin)?.name ?? '';
