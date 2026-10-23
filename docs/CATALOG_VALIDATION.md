# Kiểm tra Catalog/Copies — bản giữ mã và lịch sử của Tú

Bản này hòa giải Auth/Users `f33bd6b` với Catalog thật của Tú tại `1bdf367`.
Merge local nền là `0901559`; backend Books/Categories/Copies, public CatalogPage,
BookDetails, CategoryForm và kiểm thử hiện có được giữ lại. Facade router,
authenticated client và staff screens được bổ sung, có AI hỗ trợ.

## Kết quả trước góp ý PR #5 (`a336740`)

- `npm run check` đạt: lint, typecheck, server/client build, OpenAPI32 operations,
  JSON Postman và Prettier. Lint không có error, còn React effect/HMR advisory.
- 66 server unit/HTTP tests và59 client unit/component tests đạt.
- 87 integration tests PostgreSQL thật đạt:59 Catalog,20 Auth và8 DB.
- Riêng Catalog UI:27 tests đạt, gồm10 test hiện có của Tú và17 test bổ sung.
- 18 browser cases đạt trên desktop/mobile: public search/filter/page,
  inline details/live availability; staff tạo sách/copy, sửa metadata và archive;
  cùng Auth/Users/Swagger/connection regression.

Các suite dùng fixture tổng hợp. Test public không giả định database demo chỉ có
ba sách seed; vẫn kiểm tra tìm kiếm/phân trang sau các lần chạy tạo dữ liệu mới.

## Phạm vi đã kiểm tra

CRUD/strict validation, role/archived visibility, SQL payload, unique/FK,
loan guards, ETag/304, If-Match428/412, hai stale writes và rollback/audit.
Giữ nguyên các mã lỗi đã có của Tú. Audit Catalog hiện dùng tên action uppercase;
Loans dùng tên action đã định nghĩa riêng, bộ lọc Audit nhận giá trị chính xác.

Form PUT chỉ gửi năm trường metadata. Stale-write UI giữ draft và yêu cầu review
phiên bản mới; metadata cache tách khỏi availability no-store. Bảng category/copy
có phân trang20; selector đọc các trang100 với giới hạn/cancellation.
App remount Catalog/BookDetail theo user+role, tránh giữ archived metadata khi
người xem thay đổi. Original CategoryForm được dùng thực tế cho tạo category.

Mượn–trả cần gói Loans của An sau khi Catalog merge. Không dùng kết quả từ bản ghép
Loans khác để xác nhận chức năng trên nhánh Catalog hiện tại. Tú và thành viên khác
vẫn cần review, hiểu mã và đối chiếu kết quả kiểm thử trước khi merge.

## Sửa theo góp ý PR #5

Các nút Borrow this book, Sign in to borrow và My loans bị gỡ khỏi trang sách;
menu Loans và nút View your loans trên trang tài khoản cũng được gỡ cho đến khi
gói Loans được tích hợp. Handler gọi POST /loans được chuyển ra khỏi Catalog.
Trang sách vẫn hiển thị availability thật và thông báo Borrowing is coming soon.

Kiểm thử component xác nhận khách/MEMBER không thấy thao tác mượn, vẫn xem được
availability và trở về Catalog. Các ca 304/live availability và xóa cache sau 404
được kiểm tra qua cập nhật copy của staff, không giả lập Loans hoạt động.
E2E desktop/mobile đăng nhập MEMBER, xem sách và tài khoản, xác nhận không có
nút/điều hướng Loans hoặc request /api/v1/loans. README được cập nhật đúng phạm vi.

Kết quả của lần kiểm tra sau sửa sẽ được ghi riêng trong
[evidence/CATALOG_REVIEW_FIX.md](evidence/CATALOG_REVIEW_FIX.md).
