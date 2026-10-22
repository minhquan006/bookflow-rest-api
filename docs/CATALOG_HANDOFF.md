# Bàn giao phần Phạm Văn Tú — Catalog và UI dùng chung

Phạm vi đã thực hiện: Categories, Books, Copies; tìm kiếm/lọc/phân trang;
chi tiết và availability; UI công khai và quản lý staff trên desktop/mobile.
API và màn hình được nối với PostgreSQL thật, không dùng dữ liệu giả trong UI.
Phần Auth API có từ bước trước được giữ lại để tích hợp đăng nhập staff.

## API đã hiện thực

Base path `/api/v1`; xem request/response đầy đủ trong [OpenAPI](openapi.yaml).

| API                            | Quyền                         | Hành vi                                            |
| ------------------------------ | ----------------------------- | -------------------------------------------------- |
| GET `/categories`              | Công khai                     | Phân trang, sort name/id                           |
| POST `/categories`             | LIBRARIAN/ADMIN               | Tạo tên/slug unique                                |
| PUT `/categories/{id}`         | LIBRARIAN/ADMIN               | Thay name và slug                                  |
| DELETE `/categories/{id}`      | LIBRARIAN/ADMIN               | Chỉ xóa khi không có sách tham chiếu               |
| GET `/books`                   | Công khai; archived chỉ staff | q/title/author/ISBN, categoryId, sort, page/limit  |
| POST `/books`                  | LIBRARIAN/ADMIN               | Tạo metadata, trả Location và ETag                 |
| GET `/books/{id}`              | Công khai; archived chỉ staff | Metadata, ETag, If-None-Match/304                  |
| PUT/PATCH `/books/{id}`        | LIBRARIAN/ADMIN               | If-Match bắt buộc, version tăng sau mỗi lần sửa    |
| DELETE `/books/{id}`           | LIBRARIAN/ADMIN               | Lưu trữ, giữ lịch sử; chặn khi có loan mở          |
| GET `/books/{id}/availability` | Công khai                     | Đếm bản AVAILABLE không có loan mở, no-store       |
| GET `/books/{id}/copies`       | LIBRARIAN/ADMIN               | Danh sách bản sách có phân trang                   |
| POST `/books/{id}/copies`      | LIBRARIAN/ADMIN               | Barcode unique, condition ban đầu AVAILABLE        |
| PATCH `/copies/{id}`           | LIBRARIAN/ADMIN               | AVAILABLE/MAINTENANCE/RETIRED; chặn khi có loan mở |

Không có endpoint xóa sách vật lý hoặc xóa copy; archive/retire giữ lịch sử theo
blueprint. Không nhận role/status/version/archive timestamp tùy ý trong body.
ISBN nhận null hoặc định dạng 10/13 ký tự không gạch theo contract; chưa kiểm checksum ISBN.

## Các file chính và lý do thiết kế

- `server/src/modules/catalog/controller.ts`: HTTP, Zod input, JWT và RBAC, ETag/headers.
- `schemas.ts`: schema strict, chuẩn hóa chuỗi, sort allowlist và pagination hợp lệ.
- `service.ts`: transaction, quyền staff, kiểm tra loan/archive/version và audit.
- `repository.ts`: SQL tham số hóa, DTO camelCase, khóa hàng cần thiết.
- `client/src/features/catalog/Catalog.tsx`: search/filter/list/detail, đăng nhập staff.
- `Management.tsx`: quản lý thể loại và bản sách, xác nhận trước khi xóa thể loại.
- `Forms.tsx`: form tạo/sửa, label, HTML validation và lỗi theo trường từ API.
- `useRemote.ts`: bỏ kết quả cũ khi đổi bộ lọc, hủy request khi chuyển màn hình;
  không cho response đến trễ ghi đè kết quả mới.
- `useSubmission.ts`: trạng thái đang gửi, chống submit lặp, Problem Details.
- Component Button/FormField/Feedback/Pagination và HTTP client dùng chung được tái sử dụng.

Không thêm dependency, không sửa lockfile hay migration đã merge.
Mỗi mutation và bản ghi audit commit/rollback cùng transaction.
Count/rows của collection được đọc trong cùng snapshot repeatable-read.
Search được parameterize và escape wildcard; sort map sang cột SQL cố định, thêm id làm tie-breaker.

## Đồng thời và điểm ghép với Loans của An

- Sửa/archive book lấy `FOR UPDATE` trên hàng book rồi so If-Match trong transaction.
  Hai request cùng ETag chỉ một request thành công; request còn lại trả 412.
- Archive kiểm tra mọi open loan qua copies sau khi giữ khóa book.
- Update condition giữ khóa copy trước khi kiểm tra open loan.
- Borrow cần giữ thứ tự khóa user → book → copy → loan như blueprint và kiểm tra
  lại archived/condition sau khi lấy khóa. Return dùng copy → loan.
- Không gọi service Loans từ Catalog. Những phép đọc loan để bảo vệ archive/copy
  nằm trong Catalog repository để tránh phụ thuộc vòng.
- Availability không thuộc ETag metadata; sau thay đổi loan/copy phải đọc lại.

Test cạnh tranh dùng connection độc lập giữ khóa book/copy, quan sát request Catalog
đang chờ khóa trong PostgreSQL rồi commit loan; Catalog phải trả 409 sau khi tiếp tục.
Các test này kiểm tra Catalog khi ghép với quy ước borrow, không tuyên bố API Loans đã có.

## Chạy và kiểm thử

Theo README để chuẩn bị dependencies và `.env`. Từ root:

```bash
docker compose up -d --wait db
npm run build
npm run db:migrate
npm run db:seed
npm run db:test:create
npm run check
npm run test:integration
npm run test:e2e
npm run dev
```

Không in `.env` vào log/chat. Không reset database dev hoặc dùng `docker compose down -v`.
Integration bắt buộc `TEST_DATABASE_URL` kết thúc `_test`, tự tạo/dọn schema riêng.
Browser Catalog tests chạy API riêng trên cổng 3200 + worker index, cũng dùng schema
riêng trong `_test`; không tạo/sửa/xóa dữ liệu trong database phát triển.
Browser tests dùng compiled server nên cần `npm run build` trước như CI.

Kết quả kiểm thử cuối cùng được báo trong phản hồi bàn giao; không coi ví dụ
Postman hoặc tính năng còn planned là kiểm thử đã đạt.

## Các bước demo cho phần Tú

1. Mở Catalog: chỉ ra dữ liệu thật, search title/author/ISBN, category, sort và phân trang.
2. View một sách: metadata, mô tả, ISBN và số copies available. Khách không có nút quản lý.
3. Staff sign in bằng tài khoản seed librarian/admin; mật khẩu lấy local từ cấu hình
   bằng công cụ bảo mật phù hợp, không ghi vào slide, video hoặc commit.
4. Tạo thể loại mới, tạo sách có đủ metadata, sửa tên/mô tả sách.
5. Thêm barcode mới, đổi condition sang MAINTENANCE rồi AVAILABLE; quan sát availability.
6. Tạo barcode/ISBN hoặc category trùng để demo lỗi; tạo category referenced rồi thử xóa.
7. Mở cùng sách ở hai phiên staff; phiên thứ nhất lưu trước, phiên thứ hai lưu sau sẽ
   báo stale version. Reload book để lấy dữ liệu mới trước khi sửa lại.
8. Archive sách không có loan mở; sách biến mất khỏi danh sách công khai, staff có thể
   bật Include archived books. Lịch sử/copies/category vẫn giữ nguyên.
9. Chuyển sang viewport mobile, demo form và navigation; trình bày kết quả test thật.

Postman: đăng nhập trước, dùng accessToken trong local run; chọn từng request Catalog
với categoryId/bookId/copyId và bookEtag phù hợp. Các ví dụ xóa/archive làm thay đổi dữ liệu,
không chạy toàn collection như một smoke test chỉ đọc.

## Nội dung cần tự trình bày và phần còn ngoài phạm vi

Có thể giải thích luồng: React → HTTP client → controller/validation/auth → service
(transaction) → repository (SQL) → PostgreSQL → DTO/Problem Details. Minh họa vì sao
ẩn nút trên UI không thay thế RBAC, và vì sao ETag/khóa hàng cần thiết khi sửa đồng thời.

Sign in tích hợp phục vụ Catalog; token chỉ giữ RAM, reload cần đăng nhập lại.
Sign out hiện chỉ xóa access token phía client; Auth refresh/logout và thu hồi family
thuộc phần Quân chưa triển khai. Trang tài khoản/đăng ký đầy đủ không nằm trong phần Tú.
Không có nút Borrow giả: nghiệp vụ borrow/return, My Loans, Dashboard/Audit thuộc phần An.

Báo cáo môn học, slide và video cần nhóm bổ sung theo mẫu giảng viên; tài liệu này là
bàn giao kỹ thuật và kịch bản demo, không thay thế sản phẩm báo cáo/video đã ghi thực tế.

## Bằng chứng đã xác minh trong workspace

| Kiểm tra                   | Kết quả                                                                      |
| -------------------------- | ---------------------------------------------------------------------------- |
| `npm run check`            | Đạt lint, typecheck, build, 59 unit/HTTP/component tests, contract và format |
| `npm run test:integration` | 52 tests đạt, gồm 24 Catalog và 28 Auth/foundation                           |
| `npm run test:e2e`         | 10 tests đạt, gồm 4 Catalog desktop/mobile và 6 foundation                   |
| Catalog dev qua Vite proxy | Tải sách seed thật, login librarian, details/copies/categories hiển thị      |

Ảnh chụp từ ứng dụng đang chạy với dữ liệu seed tổng hợp, không phải mockup:

- [Catalog desktop](evidence/catalog-desktop.png)
- [Catalog mobile](evidence/catalog-mobile.png)
- [Quản lý staff và bản sách](evidence/catalog-staff.png)

Test không thay thế review của thành viên khác. Chưa push hoặc mở PR; không tuyên bố
GitHub CI hay triển khai production đã chạy.

## Bộ tài liệu trình bày phần Tú

Gói ở [docs/submission/tu](submission/tu/README.md) gồm chương Word/PDF tiếng Anh,
10 slide có speaker notes, kịch bản khoảng 6 phút, clip thao tác thực tế có phụ đề,
ảnh và log kiểm thử mới. Clip tập không có tiếng, chưa thay thế video nhóm theo đề.
Báo cáo này là phần đóng góp của Tú để ghép vào báo cáo nhóm, chưa xác nhận đúng mẫu Khoa.
