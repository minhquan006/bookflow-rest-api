# BookFlow

Ứng dụng quản lý thư viện dùng RESTful Web Services cho dự án giữa kỳ
**Web Programming & Applications — 503073**. Stack: React/TypeScript,
Express/TypeScript và PostgreSQL; monolith chia module.

Bản tích hợp trong workspace đã triển khai phần ứng dụng P0/P1 của
[blueprint](docs/PROJECT_BLUEPRINT.md):

- Auth/Users: register/login, JWT, RBAC, trạng thái tài khoản, refresh
  rotation/reuse, CSRF và logout; access token chỉ ở RAM.
- Catalog/Copies: category/book/copy CRUD, search/filter/page, archive,
  availability, ETag/304 và If-Match/428/412.
- Loans/Dashboard/Audit: mượn–trả, hạn mức/overdue/duplicate, transaction và khóa
  hàng, return idempotency, dashboard staff và audit ADMIN.
- UI theo role, Swagger/OpenAPI, Postman, test DB/browser, Docker/Nginx và CI.

Auth/Users (PR #4), Catalog/Copies (PR #5), Loans/Dashboard/Audit (PR #6,
`7221e9e`) và tiếng Việt (PR #7, `d3d614f`) đã merge vào main.
Không áp lại gói bàn giao cũ. Xem [bàn giao](docs/TEAM_HANDOFF.md),
[trạng thái](docs/IMPLEMENTATION_STATUS.md) và
[kiểm tra T1–T3](docs/TU_QUALITY_HANDOFF.md).
Các tài liệu validation cũ giữ nguyên bằng chứng lịch sử tại mốc đã ghi.

## Ngôn ngữ giao diện

Chọn **Language / Ngôn ngữ** ở đầu trang để chuyển giữa **English** và
**Tiếng Việt**. Lựa chọn được lưu trên trình duyệt, không làm mất phiên đăng nhập
hay nội dung biểu mẫu đang nhập. Xem [hướng dẫn ngôn ngữ](docs/LANGUAGES.md).

## Cài và chạy dev

Yêu cầu: **Node 24.19.0** (`.nvmrc`), npm 11, PostgreSQL 17 hoặc Docker
Engine/Desktop có Compose v2. Chạy từ root:

```bash
npm ci
npm run deps
npm run setup
docker compose up -d --wait db
npm --prefix server run build
npm run db:migrate
npm run db:seed
npm run db:test:create
npm run dev
```

`setup` chỉ tạo `.env`, `server/.env`, `client/.env.local` khi chưa có, với
JWT/password local ngẫu nhiên. Chạy lại giữ file hiện hữu. Khi sửa cấu hình,
đồng bộ root `.env` và `server/.env`, rồi restart. Thay `.env` không đổi password
của volume PostgreSQL đã tồn tại. Không đặt secret trong `VITE_*`.

Mặc định DB **5432**, API **3000**, frontend **5173**. Root `.env` cấu hình
`HOST`, `PORT` và `WEB_PORT` cho dev, Vite và Playwright; biến môi trường
process được ưu tiên. Frontend proxy `/api`, `/docs`, `/openapi.yaml` và
`/health` về cùng API; link Swagger là `/docs/`.
Dev kiểm tra cổng trước, Vite dùng strict port; Ctrl+C dừng tiến trình do
launcher tạo. Không dừng dịch vụ khác để lấy cổng.

Checkout mới trên máy Mac của Quân dùng `npm run setup:mac` cho DB **5433**,
API **3100**, web **5174**. Setup giữ file cấu hình đã có, không chuyển profile
hoặc đổi password volume. Nếu cấu hình đã có, đồng bộ root/server `.env`,
hai URL DB và `ALLOWED_ORIGINS` theo [profile dev](docs/DEV_PROFILES.md).
Có thể chạy riêng server/client; giữ cấu hình root/server nhất quán.

Nếu dùng PostgreSQL có sẵn, bỏ bước Docker DB và chỉnh `DATABASE_URL`,
`TEST_DATABASE_URL`. DB test phải có tên kết thúc `_test`. Lệnh npm/Compose
chạy được trên PowerShell/CMD, không cần `source .env`.

## Chạy đầy đủ bằng Docker

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

Web dùng **8080**. Nginx phục vụ React, proxy API/docs/health; API không publish
cổng host. API và Nginx chạy bằng user không phải root. DB chỉ bind loopback tại POSTGRES_PORT (mặc định 5432).
Compose này dành cho demo local, dùng `NODE_ENV=development` để seed. Triển khai
công khai cần HTTPS, cấu hình production và tài khoản riêng.

`docker compose down` giữ volume; **`down -v` xóa dữ liệu**. Sau đổi source,
build lại image và migrate trước khi khởi động API/web. Nếu cloud/công ty có
proxy CA, dùng `npm run compose -- build api web`: CA được mount bằng BuildKit
secret, giữ TLS verification và không đưa CA/credential vào image.

## Tài khoản và màn hình

| Email                     | Role      | Chức năng                              |
| ------------------------- | --------- | -------------------------------------- |
| `member@bookflow.test`    | MEMBER    | Catalog, mượn và loan của mình         |
| `librarian@bookflow.test` | LIBRARIAN | Catalog/copies, loan/return, dashboard |
| `admin@bookflow.test`     | ADMIN     | Staff, quản lý users và audit          |

Password là `SEED_DEMO_PASSWORD` trong `.env` local; không commit hoặc in vào
log/chat. Seed giữ tài khoản/password đã tồn tại. Register luôn tạo MEMBER;
staff/admin không được mượn thay MEMBER.

Routes: `/login`, `/register`, `/books`, `/books/:id`, `/loans`, `/dashboard`,
`/categories`, `/users`, `/audit-logs`. Menu theo role, backend vẫn kiểm tra quyền và ownership.
Reload có thể khôi phục phiên qua refresh cookie hợp lệ.

## Kiểm thử

```bash
npm run check
npm run test:integration
npm run test:e2e
# Khi Docker stack đã chạy:
npm run smoke
# Sau build và chuẩn bị TEST_DATABASE_URL:
npm run benchmark
```

`check` chạy lint, source/test typecheck, hai build, test dev tooling và unit/HTTP/component tests,
contract và format. Integration dùng PostgreSQL thật với schema ngẫu nhiên trong
DB `_test`, chỉ xóa schema của suite; không reset DB dev. Playwright kiểm tra
session, catalog, mượn–trả, dashboard/audit và Swagger ở desktop/mobile.

Chromium `/usr/bin/chromium` được tự chọn nếu có; có thể đặt
`PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH`. Nếu chưa có browser, chạy
`npx playwright install chromium`; Linux CI có thể cần `--with-deps`.

Auth mặc định giới hạn **10** yêu cầu/IP/tài khoản trong 15 phút cho mỗi endpoint
login/register. `AUTH_RATE_LIMIT_MAX` cho phép 1–100. Playwright tự khởi động dev
server với ngưỡng 100 cho nhiều browser context; test bảo mật vẫn kiểm tra mặc
định. Server được tái sử dụng giữ cấu hình lúc khởi động. Test liên tiếp có thể
cần restart với cấu hình test; không bỏ rate limit để làm test đạt.

Xem [TU_QUALITY_HANDOFF](docs/TU_QUALITY_HANDOFF.md) cho kết quả T1–T3;
[FULL_VALIDATION](docs/FULL_VALIDATION.md) giữ kết quả lịch sử và giới hạn,
[BENCHMARK](docs/BENCHMARK.md) cho số đo thật và giới hạn.

## API và Postman

| Endpoint            | Ý nghĩa                                   |
| ------------------- | ----------------------------------------- |
| `GET /health/live`  | Process sống                              |
| `GET /health/ready` | DB/schema sẵn sàng; chưa sẵn sàng trả 503 |
| `GET /api/v1`       | Thông tin dịch vụ                         |
| `GET /docs/`        | Swagger UI                                |
| `GET /openapi.yaml` | OpenAPI 3.1                               |

Trong dev, frontend proxy cả API/docs/OpenAPI/health theo cùng cấu hình. Docker phục vụ
cả API/docs/health qua web 8080. [Postman README](postman/README.md) hướng dẫn smoke,
20-request business workflow, `baseUrl`, `frontendOrigin`, password và cookie/CSRF.
Collection `planned` là bộ ví dụ lịch sử, không thay thế workflow đã kiểm chứng.

## Đóng góp và bài nộp

`server/src/modules` và `client/src/features` chứa phần theo module;
`shared`, `middleware`, `components`, `lib` dùng chung. Đọc
[CONTRIBUTING](CONTRIBUTING.md): controller → service → repository, SQL tham số
hóa, một DB client xuyên transaction, migration đã merge bất biến.

CI có job `quality`/`containers`; cần kiểm tra kết quả thật trên GitHub.
Branch protection do maintainer bật. Mã có AI hỗ trợ phải được người nhận đọc,
chạy thử, chỉnh sửa và tự commit bằng danh tính Git của mình. Không thay author,
force-push nhánh thành viên hoặc tạo lịch sử đóng góp giả.

Quân xác nhận hạn nộp **30/10/2026**, chưa có giờ cụ thể. Đề chính thức là
`docs/503073-Midterm-V1.docx`. Báo cáo Word/PDF tiếng Anh 20–60 trang, slide,
video tiếng Anh có âm thanh tối đa 20 phút và đủ ba người vẫn phải hoàn thiện.
Mẫu Khoa được đề tham chiếu nhưng chưa được cung cấp. Xem
[đối chiếu yêu cầu](docs/REQUIREMENTS_TRACEABILITY.md).
