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

Mốc mới đã đối chiếu ngày 06/11/2026: main@`e28ff8340c2fc0e492ec7df1a8a76601bf098180`
đã nhận PR #9 → #12 → #10. Q1–Q3 và A1–A3 đã merge; PR #11 T1–T3
đang ghép trên nền này, chưa merge. Xem [kiểm chứng tích hợp của Tú](TU_INTEGRATION_VALIDATION.md).

| Thành viên                  | Phụ trách                                     |
| --------------------------- | --------------------------------------------- |
| Nguyễn Minh Quân — 52400227 | Auth/Users, tích hợp, ngôn ngữ                |
| Phạm Văn Tú — 52400252      | Catalog/Copies và giao diện                   |
| Lê Nguyễn Vạn An — 52400258 | Loans/Dashboard/Audit, kiểm thử và triển khai |

## Công việc tiếp theo

Nhánh Quân `fix/source-finalization` bắt đầu từ head #11 `11c5445` để giữ đầy đủ
T1–T3 cùng Q1–Q3/A1–A3, cập nhật body-parser và bổ sung regression request nén.
Xem [checkpoint source cuối](SOURCE_FINALIZATION.md). Không đẩy nhánh này vào
nhánh Tú; sau khi #11 merge, tạo PR riêng vào main cho phần sửa còn lại.

[Kế hoạch cải thiện chất lượng](QUALITY_IMPROVEMENT_PLAN.md) chia Q1–Q3,
T1–T3 và A1–A3, có phạm vi, phụ thuộc, kiểm thử và review chéo.

Q1–Q3 đã merge qua #12, sau #9; A1–A3 đã merge qua #10 trên nền Q1–Q3.
Giữ lịch sử kiểm chứng tại [Quân](QUAN_VALIDATION.md),
[An](AN_QUALITY_VALIDATION.md), [Tú](TU_QUALITY_HANDOFF.md) và
[review Q1/A2](TU_FRONTEND_REVIEW.md).

Thứ tự thống nhất: #9 → #12 → #10 → #11. Tú đã tích hợp #11 trên main@`e28ff83`
và sửa runner tại head `11c5445`, giữ router/layout, session coordination,
loan DTO/return guard, runtime 405/Allow và cấu hình T1/URL state T2.
Quân đã kiểm tra lại T1/T3 trên Mac; An đã đối chiếu T2 trên head này. CI push
và pull_request của `11c5445` đạt. Checkpoint GitHub lúc bắt đầu nhánh hoàn thiện:
#11 Ready nhưng chưa có approval chính thức và chưa merge. Review từng head
không thay thế CI của commit merge hoặc phần sửa thêm trên nhánh Quân.

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
