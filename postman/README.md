# Chạy Postman cho BookFlow

| Collection                                  | Mục đích                                                                  |
| ------------------------------------------- | ------------------------------------------------------------------------- |
| `BookFlow.postman_collection.json`          | Smoke health/readiness/API/docs và lỗi 404                                |
| `BookFlow.catalog.postman_collection.json`  | Ví dụ/kiểm tra Catalog hiện có của Tú                                     |
| `BookFlow.business.postman_collection.json` | 20 request tuần tự kiểm tra luồng nghiệp vụ trên bản tích hợp đủ module   |
| `BookFlow.planned.postman_collection.json`  | Ví dụ request riêng từ thời thiết kế; không phải suite nghiệm thu tự động |

Import collection và `BookFlow.local.postman_environment.json`. Nhập giá trị
local trong Postman, không export/commit environment có password/token thật.

## Cấu hình chạy

- `baseUrl`: API origin, không thêm `/api/v1`. Dev API trực tiếp dùng
  `http://127.0.0.1:3000`; dev business qua Vite có thể dùng
  `http://127.0.0.1:5173`; Docker/Nginx dùng `http://127.0.0.1:8080`.
- `frontendOrigin`: Origin được API cho phép, dev 5173 hoặc Docker 8080 tương ứng.
  Refresh/logout yêu cầu Origin chính xác; không để slash cuối hoặc nhầm cổng.
- `adminEmail`: mặc định `admin@bookflow.test`.
- `adminPassword`: nhập password local đã seed (`SEED_DEMO_PASSWORD`). Nếu seed
  chạy lại, password của tài khoản cũ vẫn giữ, không tự đổi theo file mới.
- Các biến token/CSRF/IDs của lần chạy được collection tạo; không đưa vào Git.

API/DB phải chạy và đã migrate/seed. Trên dev, `/health` và `/docs` nằm ở API 3000,
không được Vite proxy; do đó smoke collection dùng 3000. Docker smoke dùng 8080.

## Business workflow

Chạy **toàn bộ collection theo thứ tự 01–20** sau khi tích hợp đúng các gói.
Nó tạo MEMBER tổng hợp với email/password ngẫu nhiên, login admin, tạo category/
book/copy, GET metadata/304, kiểm tra stale update, login/refresh MEMBER, borrow,
kiểm tra lịch sử/quyền, staff return/idempotency, dashboard/audit, archive và logout.

Postman cookie jar quản refresh cookie HttpOnly; script/header chuyển CSRF và
Origin theo contract. Không sao chép refresh token ra môi trường chia sẻ.
Nếu chạy request lẻ, phải chuẩn bị IDs/token/ETag trước; kết quả đó không thay
thế lần chạy collection đầy đủ.

Runner tạo synthetic data có suffix riêng và giữ returned loan/audit/history.
Nó không purge DB hoặc xóa mọi account/category/book. Chỉ chạy trên local/test
được phép; không dùng dataset thật hoặc môi trường công khai để demo tùy tiện.

## Newman và bằng chứng

Có thể chạy collection bằng Newman 6.x sau khi cài runner. Truyền environment
bằng object trong Node script hoặc tệp cấu hình local được ignore; không đặt
password trực tiếp trong command line/log và không commit JSON có giá trị thật.
Newman cần full integration tree và cùng cấu hình cookie/Origin như Postman.

Lần đã kiểm chứng trên bản ghép giữ mã thật của Tú qua **Docker/Nginx**:
**20 requests, 33 assertions, 0 failures**. Kết quả tổng hợp không chứa credentials
ở [`docs/evidence/postman.json`](../docs/evidence/postman.json), ghi thời gian UTC
và endpointMode của lần chạy thực tế. Đây là kiểm thử local, không xác nhận GitHub CI.

Auth default 10 requests/IP/account trong 15 phút có thể ảnh hưởng nhiều lần chạy
liên tiếp. Dùng server dev/test với budget cho test và restart khi đổi cấu hình;
không bỏ assertion, bỏ rate limit hoặc coi 429 là pass. Collection `planned`
vẫn là bộ ví dụ lịch sử kể cả khi các endpoint hiện đã được triển khai.
