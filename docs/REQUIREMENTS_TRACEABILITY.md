# Đối chiếu yêu cầu học phần và phạm vi nhóm

**Môn:** Web Programming & Applications — 503073, học kỳ 1 năm 2026–2027.

**Đề tài 1:** Restful Web Services. **Sản phẩm:** BookFlow — Library Management
REST API and Web Application.

| Thành viên       | MSSV     | Phụ trách chính                     |
| ---------------- | -------- | ----------------------------------- |
| Nguyễn Minh Quân | 52400227 | Auth/Users, nền tảng/tích hợp       |
| Phạm Văn Tú      | 52400252 | Catalog/Copies, UI                  |
| Lê Nguyễn Vạn An | 52400258 | Loans, Dashboard/Audit, test/deploy |

Nguồn chính thức: [`503073-Midterm-V1.docx`](503073-Midterm-V1.docx), mục I,
hàng ID 1 mục II, mục III–V và Teamworking Policy. [Blueprint](PROJECT_BLUEPRINT.md)
là thiết kế nhóm tự chọn, không thay đề bài. Quân xác nhận **hạn 30/10/2026** và
chỉ có đề DOCX trên là yêu cầu giảng viên đã cung cấp; chưa có giờ nộp cụ thể.

## Yêu cầu và bằng chứng

| Căn cứ             | Yêu cầu/định hướng                                                                     | Trạng thái và việc còn lại                                                                                                                                             |
| ------------------ | -------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| I; III — Research  | Lịch sử, nguyên lý, đặc tả, best practices, ưu/nhược điểm, nguồn tin cậy               | Blueprint có dàn ý/nguồn; cả nhóm phải kiểm nguồn và viết báo cáo với trích dẫn thật                                                                                   |
| II — ID1           | Gợi ý REST constraints, HTTP GET/POST/PUT/DELETE, JWT/OAuth, so sánh GraphQL/SOAP      | Source tích hợp có HTTP methods, JWT/RBAC/cache/concurrency để demo; phần lý thuyết/so sánh vẫn phải viết. Đề nói đây là gợi ý, không phải checklist bảo đảm điểm      |
| I; III — Website   | Website hoạt động, không quá đơn giản, giải thích mục tiêu/đối tượng/kiến trúc/kết quả | Bản ghép giữ Catalog thật của Tú, đã có luồng catalog→login→borrow→return, dashboard/audit và test; cần review/merge các PR và chạy lại trên máy thứ hai               |
| III — Report       | 20–60 trang, không tính bìa/phụ lục; cấu trúc/trích dẫn/hình/bảng/sơ đồ                | Chưa có báo cáo nộp hoàn chỉnh;30–40 trang là mục tiêu nhóm tự đặt                                                                                                     |
| IV; V — Word/PDF   | Báo cáo tiếng Anh theo mẫu Khoa, thông tin môn/đề tài/giảng viên/thành viên chính xác  | Cần hoàn thiện và xuất Word/PDF. `Report templates and guidelines.zip` được đề tham chiếu nhưng chưa cung cấp; không đoán mẫu/thông tin giảng viên                     |
| IV — Source/README | Đầy đủ source, dependencies, thư mục, cài/chạy/test đã kiểm chứng                      | Có manifests/lockfiles, migration/seed, README, test, Postman và Docker. Kết quả trong FULL_VALIDATION mô tả tree được test, không tự áp dụng cho các nhánh chưa merge |
| IV; V — Video      | Tiếng Anh, **có âm thanh**, tối đa 20 phút, đủ ba người; lý thuyết/demo/kiến trúc/code | Chưa quay video. Thiếu video có âm thanh hoặc source hoàn chỉnh kèm hướng dẫn làm phần demo nhận 0 điểm theo đề                                                        |
| I — Slides         | Slide, đăng ký lịch, mỗi thành viên trình bày tuần 9–10                                | Chưa có slide hoàn chỉnh/lịch được xác nhận                                                                                                                            |
| V — Teamwork       | Nhóm 2–3 người, phân phối công việc và trình bày đầy đủ                                | Ba người sở hữu module; giữ commit thật của Tú, patch có AI hỗ trợ được người nhận review/test/sửa rồi tự commit                                                       |

Code dùng Node/Express/React/PostgreSQL, OpenAPI, Postman và Docker là lựa chọn
của nhóm; giảng viên cho phép tự chọn stack. JWT có chữ ký không có nghĩa được
mã hóa. Không phải tích hợp OAuth login hoặc triển khai thêm GraphQL/SOAP để
viết so sánh định tính; phải phân biệt khảo sát với thực nghiệm.

## Phạm vi nhóm đã chốt

| Lựa chọn blueprint                                    | Ý nghĩa                                                                                                                                              |
| ----------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------- |
| P0/P1 mục 1.4                                         | Source tích hợp triển khai Auth/Users, Catalog/Copies, Loans, refresh/CSRF, ETag/If-Match, dashboard/audit; xem FULL_VALIDATION để biết kết quả thật |
| Tối đa 3 loan, hạn 14×24 giờ, chặn overdue/mượn trùng | Luật demo tự chọn; có service/transaction và test DB thật, không phải quy định giảng viên                                                            |
| Kế hoạch 7 ngày với AI                                | Kế hoạch nội bộ; đề cho 8 tuần. Hạn30/10/2026 là thông tin Quân xác nhận, không suy ra từ kế hoạch                                                   |
| Hosting công khai                                     | Tùy chọn; chưa cần mua dịch vụ/domain hoặc microservices                                                                                             |
| P2: đặt trước/email/OAuth login/full-text             | Hướng mở rộng; không tự thêm vào phạm vi nộp hiện tại                                                                                                |

## Bằng chứng và đầu ra phải hoàn thiện

[Full validation](FULL_VALIDATION.md) phân biệt native/Docker/CI/máy thứ hai;
[benchmark](BENCHMARK.md) ghi đúng dữ liệu, tải và giới hạn của phép đo local;
`docs/evidence` chứa kết quả tổng hợp không có credentials. Kết quả mô tả bản ghép Auth `f33bd6b` + Catalog thật của Tú `1bdf367` + phần bổ sung
và Loans; không tự áp dụng cho `main` hay những commit thành viên viết thêm sau đó.

Còn cần báo cáo Word/PDF, slide, video, ảnh thật, kiểm tra máy thứ hai và kết quả
CI sau merge. Thông tin giảng viên, mẫu Khoa và giờ nộp chưa có; phải xác nhận
trước khi hoàn thiện hồ sơ. Hoàn thành source không bảo đảm mức điểm hoặc đủ
mọi sản phẩm đầu ra của môn học.
