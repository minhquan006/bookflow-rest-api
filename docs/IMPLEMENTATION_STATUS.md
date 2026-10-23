# Trạng thái triển khai và tích hợp

Mốc bàn giao được chia theo chủ module, trên nền móng đã merge vào main.

| Gói                   | Người phụ trách | Nội dung                                                                    | Trạng thái của nhánh này                            |
| --------------------- | --------------- | --------------------------------------------------------------------------- | --------------------------------------------------- |
| Auth/Users            | Quân — 52400227 | Register/login, JWT, refresh rotation/reuse, CSRF, logout, users/RBAC và UI | Đã triển khai; có kiểm thử DB/browser               |
| Catalog/Copies        | Tú — 52400252   | Categories/books/copies, search/page, ETag/If-Match và UI                   | Bàn giao bằng patch riêng để review/chạy thử/commit |
| Loans/Dashboard/Audit | An — 52400258   | Borrow/return, locking, giới hạn/overdue, dashboard/audit và UI             | Bàn giao sau Catalog bằng patch riêng               |

Quy trình tích hợp: merge Auth/Users → Tú áp dụng và review Catalog → merge Catalog →
An áp dụng và review Loans/Dashboard/Audit → chạy toàn bộ regression/E2E/Docker.
Các patch phải được chủ module đọc, chạy và điều chỉnh trước khi tự commit bằng
cấu hình Git của mình. Mã/test có AI hỗ trợ; commit không thay thế bằng chứng
review, kiểm thử, hiểu mã và phần trình bày của từng người.

Hạn nộp người dùng cung cấp: **30/10/2026**; chưa có giờ nộp cụ thể.
Đề chính thức là `503073-Midterm-V1.docx`. Báo cáo/video/slide vẫn cần cả nhóm
hoàn thiện bằng kết quả thật sau tích hợp; không đồng nhất hoàn thành code với
hoàn thành toàn bộ bài nộp.
