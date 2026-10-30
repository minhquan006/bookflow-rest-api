# Trạng thái triển khai và tích hợp

Mốc đã đối chiếu ngày 30/10/2026: main@d3d614f, source tree
5f8a46f16af3f330d12774fb1c73a1c593496d61. Các thay đổi bảo trì sau mốc này
không có nghĩa toàn bộ kiểm thử lịch sử đã được chạy lại.

| Phần                  | Phụ trách       | Trạng thái                                                   |
| --------------------- | --------------- | ------------------------------------------------------------ |
| Auth/Users            | Quân — 52400227 | Đã merge PR #4; register/login, refresh/CSRF, users/RBAC     |
| Catalog/Copies        | Tú — 52400252   | Đã merge PR #5; CRUD, tìm kiếm, ETag/If-Match và UI          |
| Loans/Dashboard/Audit | An — 52400258   | Đã merge PR #6; mượn–trả, transaction, dashboard/audit và UI |
| English/Tiếng Việt    | Quân — 52400227 | Đã merge PR #7; selector, lưu lựa chọn và bản dịch           |

## Lỗi và cải thiện còn mở

- Refresh/logout có thể dùng CSRF trong RAM đã cũ khi tab khác đổi cookie (Q2).
- Loan rows còn hai nhãn tiếng Anh chưa gọi hàm dịch (A2).
- Link Swagger dev ép cổng 3000; cấu hình cổng và trải nghiệm phân trang cần
  cải thiện (T1/T2).
- Thông tin nhận diện phiếu mượn, HTTP 405 và kiểm tra response theo OpenAPI
  là các phần nâng chất lượng tiếp theo (A1–A3/Q3).

Xem [phân công chi tiết](QUALITY_IMPROVEMENT_PLAN.md). Đánh dấu hoàn thành
chỉ khi đã sửa, kiểm tra và review, không dựa trên việc đã lập kế hoạch.

Trong workspace, App đã được tách thành router/layout/Home; tiện ích frontend
dùng chung và tên router backend đã thống nhất. React key hiện dùng role gốc
để tránh reset state khi đổi ngôn ngữ. Hai regression component tests cho bộ
lọc MEMBER và bản nháp LIBRARIAN đã thất bại trước sửa, đạt sau sửa. Checklist
Q1 đầy đủ và review của nhóm vẫn cần xác nhận; thay đổi workspace chưa xác
nhận đã merge vào main. Xem [cấu trúc hiện tại](README.md).

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
