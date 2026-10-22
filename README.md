# BookFlow

Nền tảng cho hệ thống thư viện RESTful — Web Programming & Applications (503073).
React/TypeScript + Express/TypeScript + PostgreSQL; kiến trúc monolith chia module.

Đã có cấu hình, database schema/migration/seed, middleware, HTTP client, khung giao diện,
OpenAPI, kiểm thử, Docker và CI. Đã triển khai API đăng ký, đăng nhập và `/users/me`.
Đã có Catalog công khai và giao diện quản lý Categories/Books/Copies cho staff.
**Refresh/logout, giao diện tài khoản đầy đủ, mượn–trả, dashboard và audit viewer chưa được triển khai.** Các mục này là phần phát triển tiếp theo của nhóm; xem
[bàn giao](docs/TEAM_HANDOFF.md) và [blueprint](docs/PROJECT_BLUEPRINT.md).

## Bắt đầu trên máy phát triển

Yêu cầu: Node **24.19.0** (xem `.nvmrc`), npm 11, Docker Engine/Desktop có Compose v2.
Có thể dùng PostgreSQL 17 có sẵn thay Docker; chỉnh hai URL database trong `.env` và
`server/.env` cho nhất quán. Các lệnh dưới chạy từ thư mục gốc repository.

```bash
npm ci
npm run deps
npm run setup
# Chỉ khởi động database; không xóa volume đã có.
docker compose up -d --wait db
npm --prefix server run build
npm run db:migrate
npm run db:seed
npm run db:test:create
npm run dev
```

`npm run setup` tạo `.env`, `server/.env`, `client/.env.local` nếu chưa có, với khóa JWT,
mật khẩu DB và mật khẩu seed ngẫu nhiên. Chạy lại giữ nguyên file đã có. Nếu sửa cấu hình,
đồng bộ root `.env` và `server/.env`, rồi restart ứng dụng. Không dùng secret trong biến `VITE_*`.
Nếu volume DB đã tồn tại, giữ mật khẩu tương ứng; đổi file `.env` không đổi mật khẩu trong DB.

Giao diện dev dùng cổng **5173**, API **3000**. Vite proxy `/api` sang API, nên giữ API trên
3000 trừ khi đồng thời cập nhật proxy. `Ctrl+C` dừng hai process dev; database tiếp tục chạy.
Chạy riêng bằng `npm --prefix server run dev` và `npm --prefix client run dev`.

Các lệnh npm và Compose dùng được trên PowerShell/CMD; không cần `cp`, `export` hoặc
`source .env`. `nvm use` là tùy chọn nếu đã cài nvm; trên Windows có thể chọn Node 24.19.0
qua trình quản lý phiên bản tương ứng.

## Chạy toàn bộ bằng Docker

```bash
npm run setup
docker compose up -d --wait db
docker compose build api web
docker compose run --rm api npm run db:migrate
docker compose run --rm api npm run db:seed
docker compose up -d --wait api web
docker compose ps
npm run smoke
```

Web dùng cổng **8080**, Nginx phục vụ React và proxy API/docs/health. API và Nginx chạy
bằng user không phải root; API không mở cổng ra host. DB chỉ bind loopback 5432 để dùng
khi phát triển. Compose này phục vụ demo local; API đặt `NODE_ENV=development` để cho phép
seed. Khi triển khai thật cần cấu hình production/HTTPS riêng và không dùng tài khoản demo.

Dừng bằng `docker compose down`, dữ liệu được giữ trong volume. **`down -v` xóa dữ liệu**,
không phải bước cài đặt hay khởi động bình thường. Sau khi đổi source, build lại image
và chạy lại bước migrate trước khi `up` dịch vụ API/web.

Trong môi trường cloud/công ty có proxy CA, dùng `npm run compose -- build api web`
thay cho lệnh build trực tiếp. Wrapper dùng CA được môi trường cung cấp qua
`NODE_EXTRA_CA_CERTS`/`SSL_CERT_FILE` làm BuildKit secret, không đưa CA hoặc credential vào
image; TLS vẫn được xác minh. Wrapper cũng đặt cache Buildx trong thư mục ghi được.

## Xác minh và kiểm thử

```bash
npm run check
npm run test:integration
npm run test:e2e
# Khi toàn bộ stack Docker đã chạy:
npm run smoke
```

`check` chạy lint, typecheck, build, unit/HTTP/component tests, kiểm tra OpenAPI và Prettier.
Integration test cần `TEST_DATABASE_URL` tới DB có tên kết thúc `_test`; `npm run db:test:create`
tạo DB nếu chưa tồn tại. Suite tự dùng schema ngẫu nhiên riêng và chỉ xóa schema của nó;
không reset dữ liệu dev. Kiểm tra khóa/ràng buộc dùng PostgreSQL thật.

Playwright dùng Chromium có sẵn tại `/usr/bin/chromium` nếu có; nếu không, chạy
`npx playwright install chromium` trước (Linux CI có thể cần `--with-deps`). Có thể đặt
`PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH` để chọn bản Chromium đã cài. Browser tests kiểm tra kết nối thật, lỗi/phục hồi, Catalog và các thao tác staff trên
desktop/mobile. Catalog dùng API và schema riêng trong database `_test`, tự dọn sau test.

Kiểm tra HTTP nền tảng:

| Endpoint            | Kết quả                                             |
| ------------------- | --------------------------------------------------- |
| `GET /health/live`  | 200: process sống                                   |
| `GET /health/ready` | 200: DB và migration hiện tại sẵn sàng; lỗi trả 503 |
| `GET /api/v1`       | 200: thông tin dịch vụ                              |
| `GET /docs/`        | Swagger UI                                          |
| `GET /openapi.yaml` | Hợp đồng OpenAPI 3.1                                |

Trong dev, health/docs dùng cổng API 3000; frontend chỉ proxy `/api`. Trong Docker, toàn bộ
qua cổng web 8080. Import `postman/BookFlow.postman_collection.json` và local environment,
đặt `baseUrl` theo cổng đang dùng. Collection `BookFlow.planned...` chỉ là ví dụ nghiệp vụ
để nhóm triển khai, chưa phải test đã pass.

Seed có ba tài khoản local: `admin@bookflow.test`, `librarian@bookflow.test`,
`member@bookflow.test`. Mật khẩu là `SEED_DEMO_PASSWORD` trong file `.env` local; không in
vào log hoặc commit. Seed không ghi đè mật khẩu/role/tài khoản hiện hữu. Có thể đăng nhập bằng API hoặc mục Staff sign in trong Catalog.

## Cấu trúc và quy ước

- `server/src/config`, `middleware`, `shared`: config, JWT/Argon2id, lỗi, validation, log và quyền.
- `server/src/db`, `server/migrations`: pool/transaction, migration và seed.
- `client/src/lib`, `components`: HTTP client, các điều khiển và trạng thái chung.
- `docs/openapi.yaml`: hợp đồng nghiệp vụ đã chốt; các operation có trạng thái triển khai.
- `deploy`, `compose.yaml`: cách chạy demo; `.github/workflows/ci.yml`: quality và container jobs.
- `docs/TEAM_HANDOFF.md`: việc tiếp theo cho Quân, Tú và An.

Xem [CONTRIBUTING](CONTRIBUTING.md) trước khi mở PR. Module backend mới được tạo khi
bắt đầu triển khai; `createApp` nhận `apiRouter` để ghép route dưới `/api/v1`, không tạo
file placeholder rỗng. Schema đã có bảng refresh token nhưng refresh rotation/CSRF vẫn
là tác vụ của module Auth. Hạn mức, khóa hàng user/book/copy, ownership và admin cuối cùng
phải được triển khai trong service; constraint DB không thay thế các quy tắc này.

CI được lưu trong repository; việc chạy trên GitHub cần push/PR. Branch protection cần
quản trị repository bật theo [hướng dẫn đóng góp](CONTRIBUTING.md). Bằng chứng kiểm tra
trong môi trường hiện tại nằm ở [FOUNDATION_VALIDATION](docs/FOUNDATION_VALIDATION.md).

## API đăng ký và đăng nhập

- `POST /api/v1/auth/register`: JSON `{fullName, email, password}`, trả 201 và User an toàn;
  tên/email được trim, email lowercase, mật khẩu 12–128 ký tự. Luôn tạo MEMBER/ACTIVE;
  trường lạ (kể cả role/status) trả 400, email trùng trả 409 `EMAIL_ALREADY_EXISTS`.
- `POST /api/v1/auth/login`: JSON `{email, password}`, trả access JWT HS256, thời hạn,
  CSRF token và User. Email không tồn tại, mật khẩu sai và tài khoản khóa cùng trả
  401 `INVALID_CREDENTIALS`. Có giới hạn theo IP và email.
- `GET /api/v1/users/me`: gửi `Authorization: Bearer <accessToken>`, trả hồ sơ an toàn;
  đọc lại role/status từ PostgreSQL ở mỗi request, từ chối tài khoản khóa/xóa.

Auth và users trả `Cache-Control: no-store`; không trả password hash. Login tạo
refresh session chỉ lưu SHA-256 hash; cookie refresh HttpOnly, cookie CSRF có chữ ký
gắn với session, SameSite=Strict và Secure khi HTTPS hoặc production.
**Refresh rotation và logout chưa triển khai**; cookie hiện chưa dùng để phục hồi
phiên. Khi access token hết hạn cần đăng nhập lại; chỉ lưu access token trong RAM.
Đăng ký và login ghi audit cùng transaction với user/session.

Kiểm thử mới ở `server/tests/auth.integration.test.ts`, chạy bằng
`npm run test:integration` trên database `_test` với schema riêng tự dọn dẹp.
Postman có nhóm Auth và Catalog đã triển khai; nhập mật khẩu local trước khi chạy. Nhóm
Register tạo dữ liệu mới nên chỉ chạy trên database phát triển/demo phù hợp.

## Phần Catalog — Phạm Văn Tú

Mở **Catalog** trên thanh điều hướng để tìm theo title/author/ISBN, lọc thể loại,
sắp xếp, phân trang và xem chi tiết cùng số bản có thể mượn. Staff chọn **Staff sign in**
để đăng nhập, quản lý thể loại, tạo/sửa/lưu trữ sách, thêm bản sách và đổi tình trạng.

- Role LIBRARIAN/ADMIN mới được quản lý; MEMBER và khách chỉ đọc Catalog công khai.
- Sách lưu trữ được giữ lịch sử và chỉ staff xem; không lưu trữ nếu còn khoản mượn mở.
- Chỉnh metadata cần ETag/If-Match; form báo xung đột nếu người khác đã sửa trước.
- Availability luôn tính từ DB, loại bản MAINTENANCE/RETIRED và bản đang được mượn.
- Không đổi condition khi bản sách còn loan mở; không xóa thể loại được sách tham chiếu.
- Đăng nhập UI giữ access token trong RAM; tải lại trang cần đăng nhập lại. Sign out
  xóa phiên phía client, chưa thu hồi refresh session phía server.

Xem [bàn giao Catalog](docs/CATALOG_HANDOFF.md) cho danh sách API, quy tắc khóa,
kiểm thử và các bước demo. Chức năng Borrow thuộc module Loans, chưa có trong Catalog.

## Tài liệu báo cáo và trình bày phần Tú

Xem [gói bàn giao báo cáo/slide/demo](docs/submission/tu/README.md).
Có bản Word/PDF, slide chỉnh sửa được, kịch bản tiếng Anh và clip tập trình bày.
Đây là phần Catalog để nhóm tích hợp; video nộp chính thức cần cả ba thành viên
tham gia có âm thanh theo đề môn học.
