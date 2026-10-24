# Bằng chứng thực tế

Kết quả Loans v2 mới nằm ở `loans-v2-validation.json` và
`loans-v2-benchmark.json`; xem [LOANS_VALIDATION](../LOANS_VALIDATION.md).
Các tệp `validation.json`, `benchmark.json`, `postman.json` và ảnh Catalog
bên dưới là bằng chứng lịch sử ngày 21/10/2026, được giữ nguyên từ gói bàn giao.

Các tệp ở đây ghi kết quả trên bản ghép giữ mã và lịch sử Catalog thật của Tú,
Auth/Users của Quân và Loans/Dashboard/Audit bàn giao cho An.

- `validation.json`: kết quả các suite đã chạy, phạm vi nguồn và giới hạn.
- `postman.json`: lần Newman20requests/33assertions qua Docker/Nginx.
- `benchmark.json`: dữ liệu tổng hợp, cấu hình workload và số đo catalog reads.
- `catalog-desktop.png`, `catalog-mobile.png`: ảnh thật của web Docker/Nginx,
  guest tìm sách seed Practical Web Foundations và mở inline details/availability.
  Không phải ảnh dựng; không có token/mật khẩu trong ảnh. Mobile là Chromium
  emulation iPhone13, không phải kiểm tra trực tiếp trên iPhone/Safari.
- `CATALOG_VALIDATION.md`: ghi nhận lịch sử ở nhánh Catalog trước khi tích hợp;
  kết quả hiện tại xem `../CATALOG_VALIDATION.md` và `../FULL_VALIDATION.md`.

Ảnh và JSON là bằng chứng local, không xác nhận CI GitHub, hosting production
hoặc checkout trên máy thành viên thứ hai. Browser/Postman tạo fixture tổng hợp
và giữ lịch sử; không đưa log cookie, JWT, mật khẩu hoặc dữ liệu người dùng thật
vào gói nộp.
