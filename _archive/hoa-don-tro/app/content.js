// Văn bản cố định của app: nguồn pháp lý, miễn trừ, quyền riêng tư. Giọng trung lập (1-wiki/design/style.md).

export const DISCLAIMER_SHORT = 'Ứng dụng độc lập, không phải ứng dụng của EVN hay cơ quan nhà nước. Biểu giá theo QĐ 2892/QĐ-BCT.';

export const DISCLAIMER =
  'Hóa Đơn Trọ là ứng dụng độc lập, không phải ứng dụng của EVN hay cơ quan nhà nước. ' +
  'Kết quả tính theo các văn bản dưới đây và mang tính tham khảo; số tiền chính thức là số trên hóa đơn của ngành điện.';

export const SOURCES = [
  { code: 'QĐ 2892/QĐ-BCT', date: '31/10/2026', text: 'Biểu giá bán lẻ điện sinh hoạt 5 bậc, áp dụng từ 1/11/2026.' },
  { code: 'TT 60/2025/TT-BCT', date: '2025', text: 'Giá điện cho người thuê nhà để ở; chủ nhà không được thu vượt số tiền trên hóa đơn.' },
  { code: 'NĐ 133/2026', date: '2026', text: 'Xử phạt hành vi thu tiền điện sai quy định.' },
  { code: 'NQ 204/2025/QH15', date: '2025', text: 'Thuế GTGT 8% áp dụng đến hết 31/12/2026.' },
];

export const MODE_B_NOTE =
  'Giá khi chủ trọ không khai báo đủ người: app đang dùng 2.289đ/kWh (giá khoảng 101–200 kWh theo TT 60/2025). ' +
  'Một số báo đưa tin 2.894đ/kWh. App sẽ cập nhật ngay khi có xác nhận chính thức.';

export const PRIVACY =
  'Mọi dữ liệu (chỉ số công tơ, phòng, tên người, số tài khoản) chỉ lưu trên máy của bạn, không gửi lên máy chủ nào. ' +
  'Thống kê sử dụng ẩn danh chỉ được ghi khi bạn đồng ý, và không bao giờ chứa số tài khoản, tên người hay số tiền.';

export const MODE_LABEL = {
  A: 'Có khai báo · bậc thang theo số người',
  B: 'Không khai báo · giá chung',
  C: 'Chia hóa đơn tổng theo kWh',
};
