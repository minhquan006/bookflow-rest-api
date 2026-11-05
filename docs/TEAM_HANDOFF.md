# Bàn giao BookFlow hiện tại

Đề tài RESTful Web Services, môn 503073. Đọc [README](../README.md),
[API contract](API_CONTRACT.md) và [trạng thái triển khai](IMPLEMENTATION_STATUS.md).
Blueprint là thiết kế; validation ghi đúng phiên bản và môi trường đã chạy.

## Phần đã tích hợp

Auth/Users (PR #4), Catalog/Copies (PR #5), Loans/Dashboard/Audit (PR #6)
và English/Tiếng Việt (PR #7) đã merge. Mốc Git đã đối chiếu ngày 30/10/2026
là main@d3d614f, source tree 5f8a46f16af3f330d12774fb1c73a1c593496d61.
Các gói patch và quy trình chia năm commit trước đây là lịch sử, không phải
hướng dẫn áp dụng lại vào main hiện tại.

Mốc mới đã đối chiếu ngày 06/11/2026: main@`b009783ce455faf0a0acb597e3b79d6e09e6f9f7`
đã nhận PR #9 và #12. PR #10/A1–A3 và PR #11/T1–T3 chưa merge.

| Thành viên                  | Phụ trách                                     |
| --------------------------- | --------------------------------------------- |
| Nguyễn Minh Quân — 52400227 | Auth/Users, tích hợp, ngôn ngữ                |
| Phạm Văn Tú — 52400252      | Catalog/Copies và giao diện                   |
| Lê Nguyễn Vạn An — 52400258 | Loans/Dashboard/Audit, kiểm thử và triển khai |

## Công việc tiếp theo

[Kế hoạch cải thiện chất lượng](QUALITY_IMPROVEMENT_PLAN.md) chia Q1–Q3,
T1–T3 và A1–A3, có phạm vi, phụ thuộc, kiểm thử và review chéo.

Q1–Q3 đã merge qua PR #12 tại main@`b009783`, sau PR #9. Tú đã review Q1;
An đã chốt hai finding Q2/Q3 trên `eff4c0e` và approve lại `98880e0` sau khi
đối chiếu source tree không đổi. Giữ đầy đủ lịch sử kiểm chứng của từng head.
Xem [kiểm chứng và bàn giao của Quân](QUAN_VALIDATION.md) cho bằng chứng riêng
của mỗi phiên bản/môi trường. PR #10 của An và PR #11 T1–T3 của Tú vẫn cần
review/tích hợp riêng; không coi review từng nhánh là kiểm chứng bản đã ghép.
Xem [cấu trúc mã nguồn và mục lục tài liệu](README.md) trước khi sửa import.

Thứ tự thống nhất: #9 → #12 → #10 → #11. An đang chuẩn bị cập nhật #10 từ
`0f9ef82` lên nền main@`b009783`, giữ DTO/return guard và bổ sung A3 cho 405/Allow.
Sau khi An tự commit/push, Quân review A1/A3 trên đúng head mới. Tú cập nhật
#11 sau khi #10 merge; không coi test nhánh Tú cũ là kiểm chứng bản tích hợp đó.

## Bắt đầu làm việc

- Kiểm tra Git và bảo toàn thay đổi local trước khi cập nhật nhánh; không
  áp lại patch hoặc reset/clean để vượt qua xung đột.
- Node 24.19.0, npm 11; cài root bằng npm ci, hai ứng dụng bằng npm run deps.
- Chạy/migrate/seed theo README; không reset DB phát triển. DB test kết thúc _test.
- Trên Mac của Quân giữ PostgreSQL 5433, API 3100 và frontend 5174. Override
  Compose local ở .cache/bookflow/compose.port-5433.yaml và helper ngoài repo
  là cấu hình local cần giữ, không phải thư mục rác. Default dev trong repo
  vẫn là API 3000, web 5173; xem T1 trước khi thay cách cấu hình.
- Controller xử lý HTTP, service giữ nghiệp vụ/transaction, repository dùng
  SQL tham số hóa qua cùng DB client. Migration đã merge là bất biến.

## Kiểm chứng và trách nhiệm

Chạy npm run check cho source changes, integration cho DB/nghiệp vụ và E2E
cho UI/tích hợp liên quan. Từng PR ghi lệnh đã chạy, commit, môi trường và phần
chưa kiểm tra. Không coi kết quả cloud là kết quả Mac hoặc GitHub Actions mới.

[FULL_VALIDATION](FULL_VALIDATION.md), [LOANS_VALIDATION](LOANS_VALIDATION.md)
và docs/evidence giữ bằng chứng các giai đoạn; không thay số liệu lịch sử.
[LANGUAGES](LANGUAGES.md) mô tả tính năng và giới hạn ngôn ngữ hiện có.
[Repository maintenance](REPOSITORY_MAINTENANCE.md) ghi review PR Catalog cũ
và cách giữ lịch sử khi dọn nhánh.

Code và kiểm thử có AI hỗ trợ; xem [AI assistance](AI_ASSISTANCE.md).
Mỗi người review, kiểm tra và giải thích được phần mình, tự chịu trách nhiệm
với commit bằng danh tính Git thật. Không sửa author/date hoặc tạo đóng góp giả.

Phần mềm đã tích hợp không xác nhận hồ sơ học phần đã hoàn tất. Các yêu cầu
báo cáo, slide, video và thông tin còn thiếu nằm trong
[REQUIREMENTS_TRACEABILITY](REQUIREMENTS_TRACEABILITY.md).
