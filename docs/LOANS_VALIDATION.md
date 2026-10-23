# Kiểm chứng Loans v2 trên main đã merge Catalog

Gói `an-loans-v2` được áp dụng trên main
`50e2dc410e3f2e8146da007f58f71f6c7f7af9a5`, gồm Auth/Users PR #4 và
Catalog/Copies PR #5 với sửa review `118d20f`. Checksum toàn bộ gói khớp;
helper được chạy từng bước, không bỏ kiểm tra hoặc sửa series.json.

Đây là kết quả thực thi mới trong cloud với AI hỗ trợ, không phải kết quả
GitHub Actions, review độc lập của Quân hoặc nghiệm thu trên máy riêng của An.
Node 24.19.0, npm 11.9.0, PostgreSQL 17.6 Docker và Chromium hệ thống.
Thời điểm UTC và kết quả máy đọc ở
[evidence/loans-v2-validation.json](evidence/loans-v2-validation.json).

## Kết quả từng bước

| Bước | Server unit/HTTP | Client unit/component | PostgreSQL integration | E2E desktop/mobile |
| ---- | ---------------- | --------------------- | ---------------------- | ------------------ |
| 1    | 66               | 59                    | 105                    | 20                 |
| 2    | 66               | 66                    | 105                    | 20                 |
| 3    | 66               | 71                    | 105                    | 20                 |
| 4    | 66               | 71                    | 105                    | 22                 |
| 5    | 66               | 71                    | 105                    | 22                 |

Mỗi bước chạy thực tế `npm run check`, `npm run test:integration` và
`npm run test:e2e`, tất cả exit 0. Không dùng lại logs từ gói để điền bảng này.
`check` gồm lint, typecheck, server/client build, unit/component, contract và
Prettier. Có React advisories nhưng không có lint error.

Bước cuối có **264 test cases**: 66 + 71 + 105 + 22; không cộng số lần chạy lặp
thành số tình huống riêng. OpenAPI xác nhận 32 operations và JSON Postman hợp lệ.
HTTP smoke trên API dev đạt 11 kiểm tra; frontend và proxy `/api/v1` trả200 với
đúng BookFlow API identity. API/frontend dev được khởi động lại với rate limit
mặc định sau E2E; PostgreSQL giữ volume hiện có.

## Hành vi đã kiểm tra

- MEMBER chỉ mượn cho mình và xem loan thuộc mình; loan người khác trả404.
- Chặn hạn mức, overdue, trùng đầu sách; hai người tranh copy cuối chỉ một
  người thành công, hai yêu cầu cùng user không vượt hạn mức.
- Archive/borrow nhất quán; loan và audit rollback cùng nhau khi audit lỗi.
- Chỉ staff được trả; PUT return cạnh tranh/lặp giữ cùng kết quả và một audit.
- Dashboard staff và Audit ADMIN; DTO/lọc/phân trang đúng quyền.
- Loans component hủy request cũ, xóa chi tiết khi đổi tài khoản.
- E2E desktop/mobile: MEMBER mượn → LIBRARIAN trả → Dashboard; xác nhận
  returnedAt và audit qua API. Xem catalog không tự tạo loan.
- Các regression Catalog availability, ETag/304 và cache/404 được giữ.

Integration dùng schema ngẫu nhiên trong DB `bookflow_test`, chỉ dọn schema
của suite. E2E tạo synthetic records qua API và giữ lịch sử; không reset DB dev.

## Benchmark mới

Chạy `npm run benchmark` với `BENCHMARK_OUTPUT` trỏ ra ngoài checkout, rồi lưu
kết quả không chứa secret tại
[evidence/loans-v2-benchmark.json](evidence/loans-v2-benchmark.json).

Dataset: 1.000 books, 3.000 copies, 10.000 historical loans; 500 requests,
20 concurrency và 20 warm-up. Kết quả: **500 HTTP 200, 0 lỗi, p95 139,99 ms**.
Đây là phép đo đọc catalog tổng hợp qua HTTP loopback trên cloud host, không
phải năng lực production, phép đo login/loan writes hoặc hiệu năng Internet.
Runner dùng schema riêng của `_test` và dọn nó sau khi xong.

## Source, bằng chứng và giới hạn

Năm patch khớp các tree được khai báo; tree cuối gói là
`1ee65d24b3d63400a4c33aaf839bf9e620899fa3`. Sau khi helper bước 5 hoàn tất,
commit cuối được bổ sung tài liệu trạng thái chính xác và bằng chứng mới.
Application/test/dependencies/lockfiles không đổi so với nội dung v2 đã test.
Docs/evidence được kiểm tra format và contract trước khi push commit cuối.
Gói gốc bên ngoài checkout giữ nguyên.

Ảnh Loans thật từ API/frontend dev hiện tại:
[desktop](evidence/loans-v2-desktop.png), [mobile](evidence/loans-v2-mobile.png).
Mobile là Chromium emulation iPhone 13, không phải Safari/iPhone thật.
Ảnh dùng tài khoản librarian demo và dữ liệu tổng hợp, không có password/token.

Các tệp `benchmark.json`, `postman.json`, `validation.json`, ảnh Catalog và
[FULL_VALIDATION](FULL_VALIDATION.md) từ gói là bằng chứng lịch sử ngày 21/10.
Chưa chạy lại full Docker API/web deployment hoặc Newman/Postman runner trong
phiên này; parse JSON Postman không thay thế chạy collection.

An cần đọc và giải thích phần tiếp nhận. Quân review độc lập code/contract và
GitHub Actions phải đạt trước merge. Chưa xác minh máy thứ hai, publish/restore
cloud mới hoặc triển khai HTTPS production. Khi merge, dùng Create a merge
commit để giữ đủ năm commit.
