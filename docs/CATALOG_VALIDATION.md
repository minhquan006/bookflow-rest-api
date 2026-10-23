# Kiểm tra Catalog/Copies — bản giữ mã và lịch sử của Tú

Bản này hòa giải Auth/Users `f33bd6b` với Catalog thật của Tú tại `1bdf367`.
Merge local nền là `0901559`; backend Books/Categories/Copies, public CatalogPage,
BookDetails, CategoryForm và kiểm thử hiện có được giữ lại. Facade router,
authenticated client và staff screens được bổ sung, có AI hỗ trợ.

## Kết quả trên bản ghép thực tế

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

Mượn–trả cần gói Loans của An sau khi Catalog merge. Bằng chứng toàn bộ bản ghép
sau gói An nằm ở FULL_VALIDATION; không dùng kết quả cũ của reference implementation
để thay kết quả trên mã thật của Tú. Tú vẫn phải review/chạy lại trước khi push.
