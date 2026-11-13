// Sinh file Báo Cáo Doanh Thu mẫu (8 đơn Shopee thật + 1 đơn lệch) cho bot, video demo và thử tay: app/test/bao-cao-mau.xlsx
import { writeFileSync } from 'node:fs';
import { buildXlsx, incomeWorkbook } from '../app/tests/xlsx-fixture.mjs';

const out = new URL('../app/test/bao-cao-mau.xlsx', import.meta.url);
writeFileSync(out, buildXlsx(incomeWorkbook()));
console.log('Đã ghi', out.pathname);
