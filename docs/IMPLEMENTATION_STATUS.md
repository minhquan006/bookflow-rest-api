# Trạng thái triển khai và tích hợp

Mốc hiện tại đã đối chiếu ngày 06/11/2026: main@`b009783ce455faf0a0acb597e3b79d6e09e6f9f7`
đã merge PR #9 và #12. A1–A3 ở #10 và T1–T3 ở #11 chưa merge. Bản chuẩn bị #10
đang kết hợp nền này với DTO/return guard của An và runtime contract assertions
405/Allow; kết quả và giới hạn ở [AN_QUALITY_VALIDATION](AN_QUALITY_VALIDATION.md).

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

## Lỗi và cải thiện còn mở trên main

- Loan rows còn hai nhãn tiếng Anh chưa gọi hàm dịch (A2).
- Link Swagger dev ép cổng 3000; cấu hình cổng và trải nghiệm phân trang cần
  cải thiện (T1/T2).
- Thông tin nhận diện phiếu mượn và mở rộng kiểm tra response theo OpenAPI
  chờ #10/A1–A3. HTTP 405 đã có từ #12; A3 bổ sung runtime assertions khi ghép #10.

Xem [phân công chi tiết](QUALITY_IMPROVEMENT_PLAN.md). Đánh dấu hoàn thành
chỉ khi đã sửa, kiểm tra và review, không dựa trên việc đã lập kế hoạch.

Trong workspace, App đã được tách thành router/layout/Home; tiện ích frontend
dùng chung và tên router backend đã thống nhất. React key hiện dùng role gốc
để tránh reset state khi đổi ngôn ngữ. Hai regression component tests cho bộ
lọc MEMBER và bản nháp LIBRARIAN đã thất bại trước sửa, đạt sau sửa. Checklist
Tú đã review Q1 tại `fb7abcc`, chưa thấy blocker; An đã approve Q2/Q3 tại
`eff4c0e` và xác nhận lại head `98880e0`. Các phần này đã vào main qua #12;
việc ghép #10/#11 cần CI và review riêng trên các head mới. Xem [cấu trúc hiện tại](README.md).

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
[REQUIREMENTS_TRACEABILITY](REQUIREMENTS_TRACEABILITY.md). Hạn Quân đã cung cấp
là 30/10/2026, chưa có giờ nộp cụ thể.
