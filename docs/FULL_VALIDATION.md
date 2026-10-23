# Kiểm chứng bản tích hợp đầy đủ

> Bằng chứng lịch sử của lần chuẩn bị ngày 21/10/2026, không phải lần chạy
> Loans v2 trên main `50e2dc4`. Kết quả mới và phần chưa chạy xem
> [LOANS_VALIDATION](LOANS_VALIDATION.md). Không dùng số Docker/Newman/benchmark
> bên dưới để khẳng định đã chạy lại trên nhánh hiện tại.

Kết quả ngày 21/10/2026 trên source ghép giữ lịch sử và mã Catalog thật của Tú:
Auth `f33bd6b` + Catalog `1bdf367`, merge nền local `0901559`, phần Catalog bổ
sung `e182809`, rồi patch Loans/Dashboard/Audit. Backend Books/Categories/Copies,
public CatalogPage, BookDetails, CategoryForm và các test của Tú tiếp tục được dùng.

Source này đã được kiểm tra trong workspace. Không tự coi mọi phần đã merge
vào main, đã chạy CI của commit merge hoặc đã được thành viên khác nghiệm thu.

## Kết quả đã quan sát

| Kiểm tra                 | Kết quả                                                              |
| ------------------------ | -------------------------------------------------------------------- |
| `npm run check`          | Đạt lint, typecheck, hai build, unit/component, contract và Prettier |
| Server unit/HTTP         | 66 tests đạt                                                         |
| Client unit/component    | 71 tests đạt                                                         |
| PostgreSQL integration   | 105 tests đạt: 59 Catalog, 20 Auth, 18 Loans và 8 DB                 |
| Native Playwright        | 20 cases đạt, desktop/mobile                                         |
| Docker build/health      | API và web build đạt; DB/API/web healthy                             |
| Docker HTTP smoke        | 11 kiểm tra đạt                                                      |
| Docker Playwright        | 20 cases đạt, desktop/mobile, qua Nginx 8080                         |
| OpenAPI/Postman contract | 32 operations hợp lệ; các collection JSON hợp lệ                     |
| Newman qua Docker/Nginx  | 20 requests, 33 assertions, 0 failures                               |
| Catalog read benchmark   | 500 requests / 20 concurrency, p95 73,94 ms, 500 HTTP 200, 0 lỗi     |

Unit/component + PostgreSQL integration + native browser gồm **262 test cases**.
Docker browser chạy lại 20 cases trên stack đóng gói; Newman có 33 assertions riêng.
Không cộng các lần lặp thành số tình huống khác nhau hoặc số người dùng thực tế.
Lint không có error; vẫn có React effect/HMR advisory.

Bằng chứng máy đọc được:

- [`evidence/postman.json`](evidence/postman.json): Newman Docker/Nginx,
  `2026-10-21T14:01:38.191Z`.
- [`evidence/benchmark.json`](evidence/benchmark.json): phép đo trên backend
  Catalog của Tú, `2026-10-21T14:00:28.653Z`.
- [`evidence/validation.json`](evidence/validation.json): tổng hợp suite và phạm vi nguồn.
- [Ảnh thật desktop/mobile](evidence/README.md).
- [CATALOG_VALIDATION](CATALOG_VALIDATION.md): bước nghiệm thu Catalog trước gói An.

Không dùng các số cũ của bản Catalog tham chiếu để mô tả source này. JSON tổng
hợp không chứa password, JWT hoặc session cookie. Kết quả là quan sát từng suite,
không bảo đảm mọi tình huống hoặc mọi máy đều có cùng hành vi/hiệu năng.

## Phạm vi kiểm chứng

- Auth: register mass assignment, password/JWT, role/status, Origin/CSRF,
  rotation/reuse/logout, concurrent refresh và bảo vệ admin hoạt động cuối cùng.
- Catalog: CRUD/strict validation/SQL payload, role/archived visibility,
  unique/FK, availability, ETag/304, missing/stale If-Match và concurrent writes.
- Loans: ownership, role, hạn mức/overdue/duplicate, copy cuối, same-user quota,
  archive/borrow race, loan+audit rollback và return lặp/cạnh tranh.
- Client: public Catalog/inline BookDetails của Tú, staff forms, category/copy
  pagination, metadata cache, stale draft 412, session restore và loan data khi
  đổi tài khoản. App remount Catalog/BookDetail theo user+role.
- Browser: register/login/reload/logout, admin users, public search/filter/page,
  staff create/copy/edit/archive, MEMBER borrow → librarian return → dashboard,
  xác nhận loan/audit qua API, Swagger và connection failure/recovery.

Integration/benchmark dùng schema riêng của DB `_test` và chỉ dọn schema của nó.
Browser/Postman tạo synthetic records qua API và giữ loan/audit history; chạy
lại có thể tăng dữ liệu demo. Không reset DB dev hoặc tuyên bố purge mọi record.

Benchmark chỉ đọc catalog trên dữ liệu tổng hợp và HTTP loopback, không đo
login Argon2id, loan writes, Nginx/Internet hoặc capacity production. Cấu hình,
số liệu và giới hạn nằm trong [BENCHMARK](BENCHMARK.md).

## Chạy lại

```bash
npm run check
npm run test:integration
npm run test:e2e
# Sau build/migrate và khi Docker stack chạy:
npm run smoke
npm run benchmark
```

Postman theo [hướng dẫn riêng](../postman/README.md). Docker browser dùng
`E2E_EXTERNAL=1`, `E2E_BASE_URL=http://127.0.0.1:8080`; cách đặt biến tùy shell.
Suite đa browser dùng `AUTH_RATE_LIMIT_MAX=100` trong process dev/test. Auth mặc
định 10 vẫn được test riêng; sau lần nghiệm thu, Docker trở về cấu hình mặc định.

Một test business mobile từng gặp locator “Sign in” khớp cả header và màn hình
protected-route sau logout. Locator đã scope theo banner và các suite browser
được chạy lại đạt. Không bỏ assertion hoặc tắt kiểm tra quyền để làm test pass.

## Chưa xác nhận hoặc còn phải làm

- Chủ module review, chạy trên máy mình, commit/push và review chéo các PR.
- GitHub Actions trên commit merge, branch protection và required review.
- Checkout sạch trên máy thành viên thứ hai, hệ điều hành khác hoặc máy chấm.
- Publish/restore cloud trong task mới, hosting công khai/HTTPS production.
- Báo cáo Word/PDF tiếng Anh 20–60 trang, mẫu Khoa, slide, video tiếng Anh có âm
  thanh tối đa 20 phút đủ ba người và ảnh minh chứng thật.

[FOUNDATION_VALIDATION](FOUNDATION_VALIDATION.md) và
[AUTH_USERS_VALIDATION](AUTH_USERS_VALIDATION.md) giữ bằng chứng từng giai đoạn;
tài liệu này ghi kết quả bản ghép hiện tại. Hạn Quân xác nhận **30/10/2026**;
giờ nộp, thông tin giảng viên và mẫu Khoa chưa được cung cấp.
