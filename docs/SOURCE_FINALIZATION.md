# Hoàn thiện mã nguồn trước bài nộp

## Bản đã tích hợp

PR #11 và #13 đã merge. Bản ứng dụng cuối là
`main@ba8b18d9b5c99057d35036fe739aea72769ba2d0`.
[CI của main](https://github.com/minhquan006/bookflow-rest-api/actions/runs/42364111090)
đạt cả quality và containers. Các kết quả phía dưới ghi lần kiểm thử trước merge;
không được hiểu là một lần chạy lại sau merge.

## Phạm vi và trạng thái Git lúc kiểm thử

Nhánh `fix/source-finalization` bắt đầu từ head PR #11
`11c54456bcf67d42e1452fe1a300164b7a03c577`, đã ghép main `e28ff83`.
Giữ toàn bộ T1–T3, Q1–Q3 và A1–A3. Lúc bắt đầu đợt này, #11 đã Ready,
CI đạt nhưng chưa merge và chưa có approval chính thức. Nhánh local không
thay thế main hoặc xác nhận CI của các thay đổi chưa push.

Đợt này cập nhật body-parser 2.3.0 → 2.4.0 trong server lockfile, thêm regression
trên ứng dụng HTTP thật và audit runtime dependencies của server trong CI.
Không thay business contract, schema DB, rate limit hoặc assertions hiện có.
Hạn nộp Quân cập nhật: hết ngày 08/11/2026, giờ Việt Nam.

## Request nén và bản vá bảo mật

Nguồn: [GHSA-27r3-jxmh-p828](https://github.com/advisories/GHSA-27r3-jxmh-p828).
Request gzip có dữ liệu nối sau frame hợp lệ có thể làm decoder phát lỗi sau
khi response đã trả, khiến phiên bản cũ dừng process.

`server/tests/request-body.test.ts` mở ứng dụng qua fixture subprocess để lỗi
uncaught không giết Vitest worker. Kiểm tra JSON thường, gzip/deflate/br hợp lệ,
JSON hỏng, giới hạn kích thước sau giải nén, deflate kết thúc sớm và gzip có
trailing bytes; kiểm tra API còn sống sau response. Fixture không dùng DB.

Đối chứng Node 24.19.0 với dependency 2.3.0: 7/8 đạt; ca gzip trailing bytes
thất bại vì process thoát 1 với Z_DATA_ERROR. Sau cập nhật 2.4.0: 8/8 đạt.

## Kiểm chứng bản hoàn thiện

Môi trường: macOS arm64, Node 24.19.0/npm 11.17.0. Chạy trên working diff
của nhánh này sau khi cài root bằng `npm ci` và hai ứng dụng bằng `npm run deps`.

| Kiểm tra                                                                | Kết quả thực chạy                                                                                            |
| ----------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------ |
| `npm run check`                                                         | 15 tooling + 141 backend + 143 frontend = 299 tests đạt; lint không lỗi, typecheck/build/contract/format đạt |
| `npm run test:integration`                                              | 111/111 đạt trên PostgreSQL thật, DB test mới                                                                |
| Migrate/seed                                                            | Chạy hai lần liên tiếp đạt, giữ tính idempotent                                                              |
| `npm run test:e2e -- --project=chromium --retries=0`                    | 14 UI + 8 session = 22/22 đạt                                                                                |
| `npm run test:e2e -- --project=mobile --retries=0 --reporter=list,html` | 14 UI + 8 session = 22/22 đạt                                                                                |
| `npm run smoke` qua frontend proxy                                      | 11/11 đạt                                                                                                    |
| `npm audit --json --audit-level=high` tại root/server/client            | Cả ba đạt; mỗi lockfile có 0 advisory ở thời điểm chạy                                                       |
| Launcher dev                                                            | SIGINT giải phóng API 3100 và web 5174                                                                       |

Hai lượt E2E không retry, đủ bốn HTML report riêng. Bộ test giữ các ca mô phỏng
lỗi đã có; không coi response mô phỏng là lỗi backend thật. DB test mới kết thúc
`_test` đã được dọn; giữ nguyên ba file env và không reset database phát triển.
Không nới rate limit hoặc bỏ assertion. Lint còn React advisories; native build
trong môi trường NODE_ENV=test có cảnh báo chunk size, Docker build production
không có cảnh báo này. Check không có lỗi. Không chạy lại benchmark/Newman trong
đợt này và không gán số liệu lịch sử cho diff mới.

Số liệu và hash của bốn file thay đổi kiểm thử/lockfile/CI nằm trong
[evidence source](evidence/source-finalization-20261107.json). Các đoạn
"chưa commit/push" trong TU_INTEGRATION_VALIDATION là ghi chép working diff
trước head `11c5445`; không sửa lại thành một lần chạy sau commit.

Docker local cũng đã được kiểm chứng trên stack riêng, DB 5547/web 8087:

- API và web build thành công từ lockfile, migrate/seed đạt.
- PostgreSQL, API và Nginx đều healthy; smoke qua Nginx 11/11 đạt.
- Image API thực chạy Linux arm64, Node 24.19.0, body-parser 2.4.0 và UID 1000.
- Đã dọn đúng container/network/volume của project test mới, xóa env tạm và
  giải phóng hai cổng test; giữ container DB phát triển và SQL Server có sẵn.
- Đây là Docker build/health/HTTP smoke, không phải lượt Docker browser mới.
  44 browser cases trong bảng trên chạy native. CI mới phải chạy sau push.

Log đầy đủ và bản source xuất riêng nằm ngoài repo trong thư mục
`/private/tmp/bookflow-source-finalization-20261107`. Archive được đánh dấu
source candidate từ working diff, không có env riêng/node_modules/.git;
chưa thay thế SHA bản nộp sau GitHub review/merge.

## Sử dụng kết quả trong bài nộp

Quy trình review và merge #11, #13 đã hoàn tất. Khi xuất source, ghi SHA của
commit được xuất và dùng đúng bản đó để demo. Tài liệu này giữ kết quả thử nghiệm
ngày 07/11/2026; thay đổi tài liệu sau đó không tạo thêm kết quả kiểm thử ứng dụng.
Báo cáo, slide và video cần được nhóm kiểm tra riêng trước khi nộp.
