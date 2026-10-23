# Bàn giao nền móng cho nhóm

Tài liệu này giúp ba thành viên bắt đầu song song theo
[`PROJECT_BLUEPRINT.md`](PROJECT_BLUEPRINT.md). Hướng dẫn chạy và kiểm thử cụ thể
ở [README gốc](../README.md); hợp đồng chung ở [API_CONTRACT.md](API_CONTRACT.md)
và [OpenAPI](openapi.yaml). Đối chiếu yêu cầu học phần với lựa chọn
nhóm ở [REQUIREMENTS_TRACEABILITY.md](REQUIREMENTS_TRACEABILITY.md).

## Ranh giới bàn giao

Nền móng cung cấp ứng dụng TypeScript hai phía, cấu hình được kiểm tra khi khởi
động, logger/request ID, lỗi Problem Details, validation và tiện ích auth/DB,
migration/seed, giao diện kết nối API, HTTP client, kiểm thử hạ tầng và quy trình
CI/Docker. Bằng chứng chạy và giới hạn môi trường phải đọc trong README/kết quả
kiểm thử hiện tại, không suy ra từ danh sách tính năng thiết kế.

Auth/Users đã có register/login/refresh/logout, quản lý user, kiểm thử HTTP/DB và
màn hình tài khoản. Catalog/Copies và Loans/Dashboard/Audit được đóng gói thành phần
riêng cho chủ module review, chạy thử và commit. Xem [IMPLEMENTATION_STATUS.md](IMPLEMENTATION_STATUS.md).
Bằng chứng của phần nền móng không thay thế kiểm thử nghiệp vụ; mỗi phần được xác nhận
bằng bộ test riêng và bước tích hợp cuối.

## Phân công và việc đầu tiên

| Thành viên                  | Nhánh đề xuất  | Phạm vi sở hữu                                 | PR đầu tiên có thể nghiệm thu                                                                                                                          |
| --------------------------- | -------------- | ---------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Nguyễn Minh Quân — 52400227 | `feat/auth`    | Auth, Users; duy trì config/error/logging      | Register/login và `/users/me`, Argon2id, JWT đúng issuer/audience, kiểm tra DB role/status; test mass assignment, credentials sai và khóa user         |
| Phạm Văn Tú — 52400252      | `feat/catalog` | Categories, Books, Copies; UI dùng chung       | GET/POST categories và books có repository SQL, Zod, phân trang; UI catalog dùng HTTP client; test quyền staff và dữ liệu không hợp lệ                 |
| Lê Nguyễn Vạn An — 52400258 | `feat/loans`   | Loans, Dashboard/Audit; duy trì DB/test/deploy | Transaction borrow/return dùng schema đã chốt; test PostgreSQL thật cho copy cuối, rollback và PUT return lặp; UI My Loans/staff sau khi Auth tích hợp |

Mỗi người làm backend, frontend và test module mình, đồng thời đọc và giải thích
được mã. Tú review PR đầu Auth; An review Catalog; Quân review Loans. Việc sở hữu
không ngăn người khác sửa lỗi, nhưng thay đổi ranh giới chung cần báo trong PR.

## Bắt đầu từ checkout sạch

1. Đọc README, dùng phiên bản Node trong `.nvmrc` và cài theo lockfile.
2. Tạo cấu hình local bằng lệnh setup của root; không copy secret vào chat/commit.
3. Khởi động PostgreSQL, chạy migration và seed theo README. Test phải dùng DB
   riêng `bookflow_test`; không trỏ suite integration vào DB phát triển.
4. Chạy `npm run check`; khởi động dev và xác nhận connection status. Đọc lỗi
   readiness nếu DB/schema chưa có. Đừng sửa test để bỏ qua lỗi cấu hình.
5. Tạo nhánh từ main cập nhật và thực hiện một lát cắt nhỏ có test. Không cần
   dựng lại skeleton hay đổi framework để bắt đầu module.

## Ghép module mà không giẫm chân nhau

- Backend: router/controller → service → repository. Controller không chứa SQL;
  service không import Express; repository không tạo HTTP response. Chỉ tạo file
  có trách nhiệm thực tế, không nhân bản hàng loạt file rỗng.
- Sử dụng config chung, `AppError`, validator, pagination và middleware JWT/role
  đã có. Service tiếp tục kiểm tra ownership và trạng thái bên trong transaction.
  Không có role nào do body hoặc query của client quyết định.
- `withTransaction` giữ một client xuyên suốt; truyền client vào mọi repository
  trong giao dịch. Không dùng `pool.query` xen giữa transaction. Audit thành công
  phải commit cùng thay đổi nghiệp vụ.
- Frontend gọi HTTP client dùng chung; không import source backend, không ghép
  URL/token trong từng component. Access token giữ trong RAM; không tự thêm
  retry cho POST loan. Dùng abort để tránh cập nhật sau unmount.
- Contract thay đổi trước hoặc cùng PR có backend/client/tests. Không đổi tên
  field hoặc status code chỉ ở một phía. Cập nhật
  `x-implementation-status` sau khi endpoint thực sự có mã và test.
- Migration đã merge là bất biến. Mọi thay đổi schema thêm file migration mới;
  không sửa checksum cũ hoặc reset database của thành viên khác. Seed có thể
  chạy lại và không ghi đè người dùng đã tồn tại.
- Dữ liệu demo là tổng hợp. Password qua cấu hình local; không dùng MSSV hoặc
  password mẫu cho triển khai công khai. Không log Authorization/Cookie/body
  auth, không chụp token vào ảnh báo cáo.

## Thứ tự tích hợp

1. Auth cấp được access token; Catalog đã đọc/ghi được qua API. Loans có thể viết
   integration test trực tiếp service/DB bằng tài khoản tổng hợp trước khi UI login.
2. MEMBER login → catalog → borrow → lịch sử; staff login → return. Mỗi lần merge
   chạy lại smoke liên module và regression test có liên quan.
3. Hoàn thiện refresh rotation/reuse/CSRF, users admin, ETag/If-Match,
   dashboard/audit và các UI như phạm vi P1 đã chốt; không tự bỏ P1 khi thiếu giờ.
4. Chạy E2E nghiệp vụ, kiểm thử cạnh tranh, đo hiệu năng có raw output, rồi thử
   checkout sạch trên máy thứ hai. Suite nền móng không thay thế các bước này.

Giới hạn copy cuối, tối đa 3 loan, overdue, duplicate book, archive/borrow race,
return idempotency và last-admin race cần test DB thật. Test giả DB không chứng
minh khóa hàng/transaction đúng. Chốt thời gian test để kiểm tra dueAt/overdue.

## Quy trình Git và Definition of Done cho mỗi PR

Tên commit ví dụ `feat(loans): enforce active loan limit`; không commit `.env`,
`node_modules`, build output hoặc kết quả chứa secret. Không gom toàn bộ lịch sử
đóng góp dưới một tài khoản. Không force-push nhánh người khác hoặc push main
trực tiếp thay review.

- [ ] PR mô tả trigger, hành vi mới, endpoints/schema đổi và phạm vi chưa làm.
- [ ] Lint, typecheck, build, contract và test nền móng đạt; test module kiểm tra
      cả thành công và lỗi/quyền. Integration dùng PostgreSQL test riêng.
- [ ] API đúng OpenAPI; DTO không có password hash hoặc trường DB nội bộ.
- [ ] UI có loading/empty/error, label và focus rõ; có ảnh thật khi UI thay đổi.
- [ ] Migration mới chạy từ DB sạch và schema trước đó; seed lặp không trùng.
- [ ] README/contract được cập nhật khi cách chạy hoặc giao tiếp đổi.
- [ ] Một người khác review và chạy phần liên quan; ghi rõ suite chưa chạy.

CI thành công chỉ là điều kiện merge tối thiểu. Branch protection trên GitHub,
quyền reviewer và quy tắc required checks phải do maintainer bật trong repository
settings; thêm tệp CI không tự bật các chính sách đó.

## Các việc ngoài nền móng vẫn cần cả nhóm

Lấy mẫu báo cáo Khoa, xác nhận giảng viên/hạn nộp/LMS, viết báo cáo tiếng Anh bằng
kết quả thật, làm slide và video có đủ ba người. Lưu ảnh/log/benchmark đã bỏ
thông tin nhạy cảm trong `docs/evidence/` khi có bằng chứng. Không tạo kết quả
benchmark hoặc ảnh demo giả để lấp checklist. Phân công báo cáo/video giữ theo
mục 27 của blueprint.
