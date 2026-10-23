# Hợp đồng API dùng chung

Nguồn máy đọc là [`openapi.yaml`](openapi.yaml); các quyết định nghiệp vụ gốc ở
[`PROJECT_BLUEPRINT.md`](PROJECT_BLUEPRINT.md). Auth/Users đã triển khai; các module khác được bàn giao theo từng phần. Không coi endpoint đã có trong OpenAPI là đã có mã nghiệp vụ.

## Trạng thái triển khai

| Phần                                   | Trạng thái trong nền móng                                        |
| -------------------------------------- | ---------------------------------------------------------------- |
| `GET /health/live`                     | Liveness của tiến trình                                          |
| `GET /health/ready`                    | Kiểm tra kết nối DB và migration hiện tại; chưa sẵn sàng trả 503 |
| `GET /api/v1`                          | Kiểm tra kết nối client–API                                      |
| `GET /openapi.yaml`, `/docs/`          | Tải contract và Swagger UI                                       |
| Auth/Users                             | Đã triển khai và kiểm thử trên PostgreSQL thật                   |
| Catalog/Copies, Loans, Dashboard/Audit | Contract đã chốt; bàn giao ở các phần tiếp theo                  |

Mỗi operation có `x-implementation-status: implemented` hoặc `planned`.
Endpoint nghiệp vụ chưa có router trả lỗi 404 chung, không có dữ liệu giả mô phỏng
đăng nhập, mượn sách hay quyền truy cập. Chủ module phải cập nhật trạng thái
OpenAPI trong cùng PR hiện thực và kiểm thử endpoint. Hạ tầng dùng chung
(validation, JWT/RBAC, transaction, lỗi và logging) không thay thế logic nghiệp vụ.

## Quy ước giao tiếp

- Base path nghiệp vụ `/api/v1`; tên JSON camelCase, UUID và ISO 8601 UTC.
- Body JSON tối đa 100 KB, `Content-Type: application/json`; không nhận trường ngoài
  schema. Body hỏng trả 400, quá lớn 413, media type không hỗ trợ 415.
- Resource đơn `{ "data": ... }`; collection `{ "data": [], "pagination": {
"page": 1, "limit": 20, "total": 0, "totalPages": 0 } }`.
- `page >= 1`, `1 <= limit <= 100`; mặc định 1/20. Sort chỉ dùng allowlist và
  thêm `id` làm tie-breaker; không chèn tên cột từ query trực tiếp vào SQL.
- POST tạo resource trả 201 và `Location`; 204/304 không có body. Không retry
  tự động POST tạo loan khi timeout; đọc lại lịch sử để xác định kết quả.
- Mọi response có `X-Request-Id`. Lỗi dùng `application/problem+json`, gồm
  `type`, `title`, `status`, `detail`, `instance`, `code`, `requestId`;
  validation có thể thêm `errors: [{ path, message }]`.
- Không trả stack trace, SQL, password hash, JWT nội bộ hay refresh hash.

Ví dụ lỗi:

```json
{
  "type": "urn:bookflow:problem:book-unavailable",
  "title": "Book unavailable",
  "status": 409,
  "detail": "No copy is currently available for borrowing.",
  "instance": "/api/v1/loans",
  "code": "BOOK_UNAVAILABLE",
  "requestId": "example-request-id"
}
```

Đây là ví dụ contract, không phải kết quả đã chạy của luồng mượn.

## Quyết định dữ liệu để ba module khớp nhau

| Trường                   | Quy tắc                                                                                        |
| ------------------------ | ---------------------------------------------------------------------------------------------- |
| `fullName`               | Trim, 1–120 ký tự                                                                              |
| `email`                  | Trim, lowercase, email hợp lệ, tối đa 254, unique                                              |
| Mật khẩu mới             | 12–128 ký tự; chỉ lưu Argon2id hash                                                            |
| Category `name` / `slug` | Tối đa 100; slug unique dạng `lowercase-kebab`; name trim và unique không phân biệt hoa thường |
| Book `title` / `author`  | Trim, 1–255 ký tự                                                                              |
| Book `description`       | Tối đa 5.000 ký tự; có thể rỗng                                                                |
| Book `isbn`              | `null` hoặc ISBN-10/ISBN-13 không dấu gạch; ISBN-10 cho phép X cuối; unique khi có             |
| Copy `barcode`           | Trim, 1–64 ký tự, unique                                                                       |
| Role                     | `MEMBER`, `LIBRARIAN`, `ADMIN`                                                                 |
| User status              | `ACTIVE`, `DISABLED`                                                                           |
| Copy condition           | `AVAILABLE`, `MAINTENANCE`, `RETIRED`                                                          |

PUT book yêu cầu tất cả `categoryId`, `isbn`, `title`, `author`, `description`;
PATCH chỉ nhận một phần và không chấp nhận `{}`. `AVAILABLE` chỉ là tình trạng
vật lý; khả dụng còn yêu cầu không có loan chưa trả. Quá hạn được tính khi truy vấn,
không lưu cờ riêng.

## Auth, cookies và phân quyền

Các quy tắc Auth dưới đây đã được triển khai và có kiểm thử hồi quy:

1. Register luôn tạo MEMBER; body có role/status bị từ chối. Trả safe User, chưa
   tự tạo phiên. Login trả `{data: {accessToken, tokenType: "Bearer", expiresIn,
csrfToken, user}}`; JWT chứa `sub/iss/aud/iat/exp`, thuật toán HS256 cấu hình.
2. Access token chỉ lưu trong bộ nhớ frontend, gửi `Authorization: Bearer ...`.
   Mỗi request bảo vệ đọc lại role/status từ DB. User bị khóa bị từ chối ngay
   từ request tiếp theo. MEMBER không mặc nhiên thừa hưởng quyền staff và ngược lại.
3. Login/refresh đặt cookie opaque `bookflow_refresh` với `HttpOnly` và
   `Path=/api/v1/auth`. Cookie `bookflow_csrf` có `Path=/`, **không HttpOnly**,
   để JavaScript đọc sau khi tải lại trang và phục hồi phiên qua refresh. Cả hai
   có `SameSite=Strict`, `Secure` khi chạy HTTPS. CSRF token được ký và gắn với
   refresh session; cũng trả `csrfToken` trong body sau login/refresh.
4. Refresh/logout yêu cầu `Origin` khớp allowlist chính xác và `X-CSRF-Token`
   bằng `bookflow_csrf`; không cho thiếu Origin. Refresh rotate nguyên tử,
   DB chỉ lưu hash; phát hiện reuse thu hồi family. Server kiểm tra chữ ký và
   ràng buộc phiên của CSRF token, không chỉ so sánh header/cookie. Tạo token
   bằng nguồn ngẫu nhiên mật mã; không nhận giá trị tùy ý làm bằng chứng.
5. Frontend chỉ gửi một refresh request tại một thời điểm. Logout thu hồi family
   và xóa refresh cookie tại `Path=/api/v1/auth`, CSRF cookie tại `Path=/`. Access
   token đã cấp có thể sống đến hết hạn.
6. MEMBER chỉ thấy loan của mình; loan của người khác trả 404. ADMIN quản lý
   users; LIBRARIAN/ADMIN quản lý catalog, trả sách và dashboard; chỉ ADMIN đọc audit.

`AuthSession.csrfToken` và tên cookie ở trên là quyết định tích hợp của nền móng;
nếu thay đổi phải sửa OpenAPI, client và test cùng PR. Không dùng localStorage
để lưu access/refresh token. CORS không thay thế auth hoặc kiểm tra ownership.

## Cache và cập nhật đồng thời

- Book metadata có strong ETag dạng `"book-<uuid>-v<version>"`. GET với
  `If-None-Match` khớp trả 304 sau khi đã kiểm tra quyền nhìn thấy sách.
- PUT/PATCH/DELETE metadata cần đúng `If-Match`: thiếu 428, stale/không được hỗ trợ 412. Wildcard không dùng cho optimistic concurrency của bản này. So sánh và
  tăng version cùng thao tác nguyên tử; không check-then-write hai bước rời rạc.
- `GET /books/{id}/availability` tính dữ liệu hiện thời, luôn `Cache-Control:
no-store`; availability không nằm trong metadata được cache theo book version.
- Auth, users, loans, dashboard, audit trả `no-store`.

## Transaction và giới hạn nghiệp vụ

Loans service là chủ transaction, truyền **cùng** DB client cho repositories và
bản ghi audit. Khóa theo thứ tự user → book → copy → loan khi có đủ các hàng.
Trả sách xác định copy rồi khóa copy → loan, không khóa user sau copy. Không gọi
HTTP ngoài trong transaction.

Mặc định tối đa 3 loan chưa trả, hạn 14 × 24 giờ; có overdue hoặc đang giữ cùng
đầu sách thì không cho mượn mới. DB có partial unique index bảo vệ một loan mở
trên mỗi copy; kiểm tra hạn mức/ownership vẫn thuộc service. Archive và borrow
cùng khóa book. PUT `/loans/{id}/return` nhận đúng `{}` và giữ nguyên thời điểm,
người trả và số audit khi gọi lại.

Mã lỗi nghiệp vụ cần dùng nhất quán: `BOOK_UNAVAILABLE`, `LOAN_LIMIT_REACHED`,
`OVERDUE_LOANS`, `ALREADY_BORROWED`, `BOOK_HAS_ACTIVE_LOANS`, `CATEGORY_IN_USE`,
`VERSION_MISMATCH`, `PRECONDITION_REQUIRED`. Lỗi unique email/barcode được map
thành 409 phù hợp, không gửi nguyên lỗi PostgreSQL cho client.

## Dùng OpenAPI và Postman

Từ root chạy `npm run contract:check` để kiểm tra contract. Khi API chạy,
`/docs/` hiển thị Swagger UI; các route gắn `planned` chỉ để đọc/thiết kế,
chưa dùng làm bằng chứng chức năng thành công.

Import environment `postman/BookFlow.local.postman_environment.json` và collection
`postman/BookFlow.postman_collection.json`. Collection này chỉ chạy smoke nền móng,
readiness yêu cầu DB đã migrate. `BookFlow.planned.postman_collection.json` là ví dụ
riêng cho nghiệp vụ **chưa hiện thực**; chọn request sau khi module tương ứng merge.
Nhập password/token vào biến local của Postman, không commit environment đã xuất
kèm giá trị thật. Trình Postman tự quản cookie; Origin/CSRF của refresh phải khớp
môi trường dùng thực tế.
