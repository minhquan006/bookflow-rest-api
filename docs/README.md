# Tài liệu và cấu trúc mã nguồn

Đây là hướng dẫn cấu trúc hiện tại trong workspace. [Blueprint](PROJECT_BLUEPRINT.md)
ghi thiết kế; [trạng thái triển khai](IMPLEMENTATION_STATUS.md) phân biệt các PR
đã merge, thay đổi workspace và công việc còn mở.

## Frontend

```text
client/src/
  main.tsx                 Khởi động React, nạp CSS
  App.tsx                  Ghép LanguageProvider và AuthProvider
  app/
    AppRouter.tsx          Chọn trang, kiểm tra quyền ở UI
    AppLayout.tsx          Header, menu, footer, thông báo phiên
    usePath.ts             Theo dõi và cập nhật browser history
  features/
    home/                  Trang tổng quan, trạng thái kết nối API
    auth/                  Phiên đăng nhập, đăng ký, đăng nhập
    users/                 Quản trị người dùng
    catalog/               Sách, danh mục, bản sách
    loans/                 Mượn và trả sách
    administration/        Dashboard và audit
  components/              Thành phần UI dùng chung
  lib/                     HTTP, lỗi, ngày giờ, kiểu phân trang
  i18n/                    Ngôn ngữ và từ điển
  styles/                  CSS nền, thành phần chung và bố cục
```

Router và layout cùng dùng Auth context; provider chỉ được tạo ở App.
Định danh component dùng ID và role gốc, không dùng nhãn đã dịch. Backend
vẫn quyết định quyền truy cập và ownership.

Tính năng gọi API qua `lib/http.ts`; DTO riêng nằm trong tính năng. Tiện ích
dùng cho nhiều tính năng thuộc `lib/`, tránh lấy hàm định dạng ngày từ Loans
hoặc hàm ánh xạ lỗi từ Auth. Không import source backend vào frontend.

`styles/index.css` là điểm nạp CSS duy nhất: base → components → layout →
các tính năng. CSS riêng của Home/Auth/Catalog/Administration nằm cạnh tính
năng; giữ thứ tự và responsive rules khi chỉnh để tránh đổi cascade ngoài ý muốn.

## Backend

`server.ts` khởi động/dừng process; `app.ts` thiết lập Express và middleware;
`routes.ts` ghép các module. Mỗi module khai báo HTTP trong `*.routes.ts`,
service giữ nghiệp vụ/transaction, repository dùng SQL tham số hóa trên DB
client được truyền vào. Chỉ thêm controller riêng khi có trách nhiệm cần tách.

Catalog ghép Books, Categories và Copies; các module này vẫn ở cùng cấp trong
`server/src/modules/`. Schema sách tập trung ở `books.schema.ts`, parser version
và hàm tạo ETag ở `books-version.ts`. Các thao tác sách phức tạp vẫn có service
và repository riêng để giữ rõ transaction và khóa hàng.

`config/`, `db/`, `middleware/`, `shared/` giữ trách nhiệm dùng chung. Migration
đã merge trong `server/migrations/` là bất biến.

## Kiểm thử và vận hành

- `client/tests/`: component, phiên và HTTP client.
- `server/tests/`: unit/HTTP và các file `*.integration.test.ts` dùng DB `_test`.
- `tests/e2e/`: kiểm thử browser xuyên frontend/API.
- `scripts/`: lệnh phối hợp toàn repository; `deploy/`: Docker/Nginx.
- `postman/`: collection và hướng dẫn kiểm thử HTTP.

Lệnh chạy và cổng xem [README gốc](../README.md), cấu hình Mac xem
[TEAM_HANDOFF](TEAM_HANDOFF.md). Source changes chạy `npm run check`; thay đổi
UI/tích hợp chạy E2E liên quan; thay đổi DB/nghiệp vụ chạy integration.

## Tra cứu tài liệu

- [TEAM_HANDOFF](TEAM_HANDOFF.md): thành viên, cách tiếp tục công việc, cấu hình local.
- [API_CONTRACT](API_CONTRACT.md) và [OpenAPI](openapi.yaml): hợp đồng HTTP.
- [QUALITY_IMPROVEMENT_PLAN](QUALITY_IMPROVEMENT_PLAN.md): lỗi, phân công và tiêu chí.
- [LANGUAGES](LANGUAGES.md): ngôn ngữ, giới hạn và quy tắc bảo trì.
- [REPOSITORY_MAINTENANCE](REPOSITORY_MAINTENANCE.md): đợt dọn repo và PR Catalog cũ.
- [FULL_VALIDATION](FULL_VALIDATION.md), [LOANS_VALIDATION](LOANS_VALIDATION.md),
  [BENCHMARK](BENCHMARK.md) và [evidence](evidence/README.md): kết quả theo từng
  giai đoạn/môi trường; không coi chúng là kết quả chạy lại trên source mới.

## Kiểm chứng đợt tái tổ chức

Ngày 30/10/2026, chạy trên Mac với Node 24.19.0/npm 11.17.0, workspace dựa
trên `dbd61bf`; đây là thay đổi local, chưa xác nhận merge vào main.

- `npm run check`: đạt; 66 test backend và 82 test frontend, typecheck,
  build, OpenAPI/Postman JSON và format đạt. Còn 11 cảnh báo React đã có trước.
- `npm run test:integration`: 105 test đạt trên DB `_test` với schema riêng.
- `E2E_EXTERNAL=1 E2E_BASE_URL=http://127.0.0.1:5174 npm run test:e2e`:
  24 test đạt trên Chromium desktop/mobile, dùng API 3100 và PostgreSQL 5433.
- Hai test mới ở `client/tests/navigation.test.tsx` thất bại trên source trước
  sửa key và đạt sau sửa. Đây là component tests với HTTP mô phỏng; bộ E2E hiện
  có chưa thay thế toàn bộ ma trận Q1, đặc biệt đổi tài khoản/quyền giữa các tab.
- Giữ đủ 153 CSS rules; so sánh computed styles cũ/mới trên Home, Register và
  Catalog ở hai kích thước màn hình: 6 trường hợp, không có khác biệt.

Đợt này chưa build lại Docker hoặc chạy Newman/benchmark. Kết quả trên không
thay thế review của nhóm hay CI trên GitHub của commit sẽ được tạo sau đó.
