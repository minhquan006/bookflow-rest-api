# Kiểm tra phần Auth/Users — Quân

Đã kiểm tra bản nguồn Auth/Users độc lập, xuất từ Git index mà không chứa source
Catalog hoặc Loans. Cài đặt dùng lockfile và dependency đã chuẩn bị; xác minh
không có import bắt buộc vào module của Tú/An. Ngày ghi nhận21/10/2026.

| Kiểm tra                  | Kết quả                                                                |
| ------------------------- | ---------------------------------------------------------------------- |
| Lint                      | Thành công; còn advisory React về effect/HMR, không tắt rule           |
| Typecheck/build           | Server/client và test types đều đạt                                    |
| Backend unit/HTTP         | 47 tests đạt, gồm phân biệt DB outage503 và lỗi SQL500                 |
| Client unit/component     | 32 tests đạt, gồm 15 ca Auth/Users và các hồi quy logout               |
| PostgreSQL thật           | 28 tests đạt: 8 nền móng và 20 Auth/Users                              |
| Playwright desktop/mobile | 10 ca đạt: đăng ký/login/restore/logout, quản lý role, docs/connection |
| Contract/format           | OpenAPI3.1, PostmanJSON và Prettier đạt                                |

Refresh rotation/reuse revocation, CSRF signature+session binding, Origin checks,
last-admin concurrency, trạng thái/role hiện thời, rollback audit và mass assignment
đều được kiểm tra trên PostgreSQL thật. Access token chỉ ở RAM; cookie refresh
HttpOnly path `/api/v1/auth`, CSRF readable path `/`.

Rà soát độc lập đã tìm và sửa hai race frontend: profile response cũ và protected
GET401 sau logout không được phục hồi user/token. Có test deferred cho cả hai.
Bản đóng gói không chứa `.env`, mật khẩu demo thực, refresh/access token hay
build/browser output. GitHub Actions là kiểm tra riêng sau khi push; kết quả
ở đây là kiểm tra thực tế trong workspace, không tự khẳng định CI đã đạt.

Catalog/Copies và Loans/Dashboard/Audit được bàn giao bằng patch riêng; trang
của các module này chỉ khả dụng đầy đủ sau khi áp dụng các gói tương ứng.
