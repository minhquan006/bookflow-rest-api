# Hợp đồng API dùng chung

Nguồn máy đọc là [`openapi.yaml`](openapi.yaml); các quyết định nghiệp vụ gốc ở
[`PROJECT_BLUEPRINT.md`](PROJECT_BLUEPRINT.md). Auth/Users, Catalog/Copies và Loans/Dashboard/Audit đã được tích hợp vào main.
Xem [trạng thái triển khai](IMPLEMENTATION_STATUS.md) và
[kết quả kiểm chứng](SOURCE_FINALIZATION.md) cho phiên bản được kiểm thử.

## Trạng thái triển khai

| Phần                          | Trạng thái trong bản tích hợp                                    |
| ----------------------------- | ---------------------------------------------------------------- |
| `GET /health/live`            | Liveness của tiến trình                                          |
| `GET /health/ready`           | Kiểm tra kết nối DB và migration hiện tại; chưa sẵn sàng trả 503 |
| `GET /api/v1`                 | Kiểm tra kết nối client–API                                      |
| `GET /openapi.yaml`, `/docs/` | Tải contract và Swagger UI                                       |
| Auth/Users                    | Đã triển khai và kiểm thử trên PostgreSQL thật                   |
| Catalog/Copies                | Đã triển khai; có ETag/If-Match và phân quyền staff              |
| Loans, Dashboard/Audit        | Đã triển khai; kiểm thử transaction, RBAC và ownership           |

Các operation hiện tại có `x-implementation-status: implemented` và router
nghiệp vụ thực tế. Các module đã merge qua PR #4–#6; xem
[IMPLEMENTATION_STATUS](IMPLEMENTATION_STATUS.md) để phân biệt trạng thái
Git, bằng chứng lịch sử và vấn đề còn mở.
Endpoint ngoài contract trả 404 chung. Tài nguyên đã biết nhưng method không hỗ trợ
trả 405 và `Allow` theo chính sách bên dưới. Khi đổi contract, cập nhật trạng thái và
test cùng PR; schema hoặc ví dụ JSON không thay thế bằng chứng chạy.

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
5. Frontend dùng Web Locks cho login, refresh và logout giữa các tab cùng origin.
   Request nghiệp vụ dùng Bearer không giữ khóa trong lúc chờ header/body; epoch
   và revision vẫn được kiểm tra trước gửi và sau khi đọc response để loại bỏ
   dữ liệu thuộc phiên cũ. Một mutation treo không được chặn request logout.
   CSRF được đọc lại từ cookie sau khi lấy khóa;
   GET/HEAD 401 được refresh/retry tối đa một lần, mutation không tự retry.
   Marker `bookflow.session.revision` chỉ chứa trạng thái và UUID ngẫu nhiên,
   không chứa token, cookie hoặc hồ sơ. Intent login/logout thông báo để tab khác
   xóa danh tính cũ ngay; response thuộc phiên cũ bị loại bỏ sau khi đọc body.
   Tab khác không tự đăng nhập theo tài khoản mới; reload mới khôi phục phiên hiện tại.
   Logout thất bại vẫn giữ marker signed-out để reload không tự phục hồi cookie cũ.
   UI có nút thử lại thu hồi phiên, tồn tại sau reload nếu cookie còn. Retry kiểm
   tra lại đúng revision dưới khóa, không thu hồi cookie của tài khoản mới ở tab khác.
   Khi thiếu Web Locks hoặc storage bị chặn, thao tác phiên bị từ chối với thông báo;
   xem Catalog và đổi ngôn ngữ vẫn dùng được. Cần trình duyệt mới và HTTPS/localhost.
   Logout phía server thu hồi family và xóa cookie đúng Path. Access token đã cấp
   có thể sống đến hết hạn; thay đổi này không bổ sung JWT revocation.
6. MEMBER chỉ thấy loan của mình; loan của người khác trả 404. ADMIN quản lý
   users; LIBRARIAN/ADMIN quản lý catalog, trả sách và dashboard; chỉ ADMIN đọc audit.

`AuthSession.csrfToken` và tên cookie ở trên là quyết định tích hợp của nền móng;
nếu thay đổi phải sửa OpenAPI, client và test cùng PR. Không dùng localStorage
để lưu access/refresh token. CORS không thay thế auth hoặc kiểm tra ownership.

## 404, 405, HEAD và OPTIONS

`server/src/routes.resources.ts` liệt kê tài nguyên và method đã triển khai;
`contract:check` đối chiếu danh sách này với đủ 32 operation OpenAPI. Khi thêm route,
phải cập nhật handler, registry, OpenAPI/Postman và kiểm thử cùng nhau.

- URI không khớp tài nguyên vẫn 404; route con lạ không thừa hưởng Allow của route cha.
- Method sai trả `METHOD_NOT_ALLOWED`, Problem Details, `X-Request-Id`,
  `Cache-Control: no-store` và `Allow`. GET kéo theo HEAD; thêm OPTIONS được CORS xử lý.
  Ví dụ `/books`: `GET, HEAD, POST, OPTIONS`; `/loans/{id}/return`: `PUT, OPTIONS`.
- Tài nguyên public công khai danh sách method; method ghi hợp lệ vẫn đi qua quyền
  của handler. Tài nguyên riêng yêu cầu xác thực trước 405: `/users/me`, `/loans`
  và `/loans/{id}` cần tài khoản; Categories chi tiết, Copies, Return và Dashboard
  cần staff; Users quản trị và Audit cần ADMIN. Thiếu phiên trả 401, sai role 403,
  không kèm Allow. `/users/me` được ưu tiên trước `/users/{id}`.
- Negotiation xác định dạng đường dẫn, không xác minh UUID hoặc sự tồn tại của
  bản ghi. Method hợp lệ tiếp tục chạy validation, ownership và nghiệp vụ như cũ;
  MEMBER đọc loan người khác vẫn 404. Quy tắc này không xác nhận bản ghi tồn tại.
- HEAD của GET giữ status/header và không có body; HEAD vào endpoint chỉ nhận
  POST trả 405 không body. OPTIONS giữ hành vi CORS 204 hiện có.
  Script khởi tạo Swagger chỉ được phục vụ ở `/docs/swagger-ui-init.js` bằng
  GET/HEAD; method sai trả 405, URL lồng cùng tên script vẫn 404. Static assets
  Swagger ở cấp đầu vẫn được phục vụ. Đây là asset UI, không thêm business operation.
  `Access-Control-Allow-Methods` mô tả preflight toàn API; không thay cho Allow
  theo tài nguyên. Header Allow được expose cho frontend cross-origin.
- CORS, rate limit và parse body có thể từ chối request trước method guard;
  body hỏng/quá lớn/sai media type vẫn có thể trả 400/413/415.

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

Từ root chạy `npm run contract:check` để kiểm tra OpenAPI và JSON các collection.
Khi API chạy, `/docs/` hiển thị Swagger UI. Kiểm tra schema hợp lệ không thay thế
kiểm thử HTTP/DB/browser của endpoint.

Import environment `postman/BookFlow.local.postman_environment.json` và collection
`postman/BookFlow.postman_collection.json` để chạy smoke nền móng; readiness
yêu cầu DB đã migrate. `BookFlow.catalog.postman_collection.json` giữ kiểm tra
Catalog hiện có của Tú. `BookFlow.business.postman_collection.json` chạy tuần tự
20 request nghiệp vụ trên bản tích hợp, gồm refresh/CSRF, ETag và mượn–trả.
Collection thiết kế `planned` cũ đã được bỏ; xem
[Postman README](../postman/README.md) cho các collection đang dùng.
Nhập password/token vào biến local của Postman, không commit environment đã xuất
kèm giá trị thật. Trình Postman tự quản cookie; Origin/CSRF của refresh phải khớp
môi trường dùng thực tế.

Audit Catalog giữ các action uppercase đã có của Tú; Loans/Auth dùng action
được định nghĩa trong module. Bộ lọc Audit nhận chính xác action lưu trong DB;
không đổi tên hàng lịch sử hoặc suy ra action từ label giao diện.
