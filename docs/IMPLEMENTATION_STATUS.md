# Trạng thái triển khai và tích hợp

Checkpoint local tiếp theo: nhánh `fix/source-finalization` dựa trên #11
`11c5445`, giữ đầy đủ T1–T3/Q1–Q3/A1–A3 và bổ sung bản vá dependency cùng
regression request nén. Xem [SOURCE_FINALIZATION](SOURCE_FINALIZATION.md) để
biết kết quả thực chạy và phần phát hành chưa hoàn tất.

Mốc hiện tại đã đối chiếu ngày 06/11/2026: main@`e28ff8340c2fc0e492ec7df1a8a76601bf098180`
đã merge PR #9 → #12 → #10, gồm Q1–Q3 và A1–A3. Nhánh PR #11 đang
chuẩn bị tích hợp T1–T3 trên nền này, chưa merge. Kiểm chứng mới ghi riêng ở
[TU_INTEGRATION_VALIDATION](TU_INTEGRATION_VALIDATION.md); bằng chứng từng nhánh
ở [AN_QUALITY_VALIDATION](AN_QUALITY_VALIDATION.md),
[QUAN_VALIDATION](QUAN_VALIDATION.md) và [TU_QUALITY_HANDOFF](TU_QUALITY_HANDOFF.md).

Mốc đã đối chiếu ngày 30/10/2026: main@d3d614f, source tree
5f8a46f16af3f330d12774fb1c73a1c593496d61. Các thay đổi bảo trì sau mốc này
không có nghĩa toàn bộ kiểm thử lịch sử đã được chạy lại.

| Phần                  | Phụ trách       | Trạng thái                                                   |
| --------------------- | --------------- | ------------------------------------------------------------ |
| Auth/Users            | Quân — 52400227 | Đã merge PR #4; register/login, refresh/CSRF, users/RBAC     |
| Catalog/Copies        | Tú — 52400252   | Đã merge PR #5; CRUD, tìm kiếm, ETag/If-Match và UI          |
| Loans/Dashboard/Audit | An — 52400258   | Đã merge PR #6; mượn–trả, transaction, dashboard/audit và UI |
| English/Tiếng Việt    | Quân — 52400227 | Đã merge PR #7; selector, lưu lựa chọn và bản dịch           |

## Q1–Q3 đã tích hợp

Nhánh `fix/quan-session-http` bắt đầu từ PR #9 @ `40eb914`, sửa hai P2 An review
trong `eff4c0e`: request nghiệp vụ treo chặn logout và URL Swagger init lồng trả
200; bổ sung retry thu hồi phiên. An đã review lại và approve head `98880e0`
sau khi đổi base sang main. PR #12 đã merge tại main@`b009783`.

Phạm vi Q1–Q3:
Q1 giữ bộ lọc/form khi đổi ngôn ngữ và xóa state khi đổi danh tính/quyền; Q2
phối hợp phiên nhiều tab, CSRF hiện tại và loại bỏ response cũ; Q3 trả 405/Allow
với chính sách quyền và contract tương ứng. Kết quả cụ thể và giới hạn ở
[QUAN_VALIDATION](QUAN_VALIDATION.md); các đoạn ghi còn local/chờ push trong tài liệu
đó là bằng chứng lịch sử, không thay thế mốc Git mới đã đối chiếu ở trên.

## T1–T3 đang tích hợp trong PR #11

A1–A3 đã vào main qua #10: DTO nhận diện sách/bản sách theo quyền, xác nhận trả
EN/VI, response guard và runtime contract assertions 405/Allow. Cấu trúc AppRouter,
AppLayout, Fragment theo viewer và xử lý phiên Q1–Q3 được giữ từ main.

Nhánh Tú giữ shared dev config/proxy/Swagger tương đối của T1; Catalog URL,
page size 12/24/48 và draft/applied filters của T2; cập nhật bàn giao T3.
Head tích hợp `11c5445` đã sửa finding runner, có CI đạt và được Quân kiểm tra
lại T1/T3 trên Mac, An đối chiếu T2. Checkpoint lúc bắt đầu bản hoàn thiện:
#11 đã Ready, còn approval chính thức/merge. Kết quả working diff có bản vá
parser được ghi riêng ở SOURCE_FINALIZATION; không dùng CI của head Tú để
xác nhận phần sửa thêm. Xem [kế hoạch](QUALITY_IMPROVEMENT_PLAN.md).

## Bằng chứng

Validation trong repository ghi các giai đoạn riêng. Kết quả cloud, Mac và
GitHub Actions phải phân biệt. Bộ test Auth/Language chọn lọc đã chạy trong
review gồm 18 test đạt; 5 ca bổ sung tái hiện các lỗi ở trên. Đây là component
checks với HTTP mô phỏng, không phải lần DB integration hoặc E2E mới.

Đợt tái tổ chức sau đó đã chạy check (66 backend + 82 frontend), 105 integration
và 24 E2E desktop/mobile, tất cả đạt trên Mac. Phạm vi, lệnh chạy và giới hạn
được ghi tại [mục kiểm chứng cấu trúc](README.md#kiểm-chứng-đợt-tái-tổ-chức).

Giữ nguyên [FULL_VALIDATION](FULL_VALIDATION.md),
[LOANS_VALIDATION](LOANS_VALIDATION.md), [BENCHMARK](BENCHMARK.md) và evidence
lịch sử. [Repository maintenance](REPOSITORY_MAINTENANCE.md) mô tả phạm vi dọn
source và review PR cũ. Kiểm tra CI của đúng commit trước khi viện dẫn kết quả.

Hồ sơ học phần cần được nhóm xác nhận riêng theo
[REQUIREMENTS_TRACEABILITY](REQUIREMENTS_TRACEABILITY.md). Quân đã cập nhật hạn
nộp là hết ngày 08/11/2026, giờ Việt Nam.
