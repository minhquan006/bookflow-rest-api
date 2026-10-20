# Đối chiếu yêu cầu học phần và phạm vi nhóm

**Môn:** Web Programming & Applications — 503073, học kỳ 1 năm học 2026–2027.

**Đề tài số 1:** Restful Web Services.

**Sản phẩm nhóm chọn:** BookFlow — Library Management REST API and Web Application.

| Thành viên       | MSSV     | Phần phát triển chính theo blueprint        |
| ---------------- | -------- | ------------------------------------------- |
| Nguyễn Minh Quân | 52400227 | Auth/Users, nền tảng backend                |
| Phạm Văn Tú      | 52400252 | Catalog/Copies, UI dùng chung               |
| Lê Nguyễn Vạn An | 52400258 | Loans, Dashboard/Audit, kiểm thử/triển khai |

Nguồn yêu cầu là [`503073-Midterm-V1.docx`](503073-Midterm-V1.docx), đặc biệt
mục I, hàng đề tài ID 1 ở mục II, mục III–V và Teamworking Policy. Tệp blueprint
người dùng gửi lại trùng nội dung [`PROJECT_BLUEPRINT.md`](PROJECT_BLUEPRINT.md);
đây là lựa chọn triển khai của nhóm, không thay thế đề bài. Hợp đồng kỹ thuật và
cách chia việc nằm ở [API_CONTRACT.md](API_CONTRACT.md) và
[TEAM_HANDOFF.md](TEAM_HANDOFF.md).

## Yêu cầu chính thức và cách chứng minh

| Căn cứ trong đề                              | Yêu cầu hoặc định hướng                                                                                                                              | Nhóm đáp ứng bằng gì                                                                                                                           | Trạng thái sau phần nền móng / việc tiếp theo                                                                                                                                                |
| -------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| I; III — Research and Comprehension          | Khảo sát lịch sử, nguyên lý, đặc tả, thực hành tốt; phân tích ưu/nhược điểm và giải pháp tương tự; nguồn tin cậy                                     | Báo cáo tiếng Anh có nguồn gốc rõ ràng, sơ đồ và lập luận gắn với demo                                                                         | Blueprint có dàn ý/nguồn tham chiếu; cả nhóm còn phải nghiên cứu, kiểm tra nguồn và viết báo cáo dựa trên kết quả thật                                                                       |
| II — ID 1                                    | Gợi ý khảo sát REST constraints, HTTP GET/POST/PUT/DELETE, JWT/OAuth và so sánh GraphQL/SOAP; đề ghi đây là gợi ý, không phải checklist bảo đảm điểm | Giải thích resource/stateless/uniform interface/cache; minh họa methods/status; JWT thực tế; phân tích OAuth/OIDC và so sánh REST–GraphQL–SOAP | Contract/hạ tầng phục vụ minh họa đã có; endpoint nghiệp vụ và phần lý thuyết vẫn phải hoàn thiện. Không bắt buộc tích hợp OAuth login hay triển khai thêm GraphQL/SOAP để so sánh định tính |
| I; III — Demonstration Website               | Website hoạt động, không quá đơn giản, thể hiện công nghệ đã nghiên cứu; giải thích mục tiêu, đối tượng, kiến trúc và kết quả                        | Luồng MEMBER tra cứu/mượn → staff trả; RBAC, transaction và kiểm thử cạnh tranh; dùng frontend và Postman                                      | Hiện là nền móng middleware/DB/docs/client kết nối. **Chưa phải demo nghiệp vụ hoàn chỉnh**; ba chủ module cần hiện thực và kiểm thử các luồng                                               |
| III — Writing and Presentation               | Báo cáo 20–60 trang, không tính bìa/phụ lục; có cấu trúc, trích dẫn, hình/bảng/sơ đồ phù hợp                                                         | Nhóm dự kiến 30–40 trang tiếng Anh với ERD, sequence, ảnh thật và bảng kết quả                                                                 | 30–40 trang là mục tiêu nhóm, không phải yêu cầu riêng của đề; chưa có báo cáo nộp hoàn chỉnh                                                                                                |
| IV — Complete Report; V — Teamworking Policy | Báo cáo tiếng Anh, Word và PDF, theo mẫu Khoa; thông tin môn/đề tài/giảng viên/thành viên chính xác                                                  | Xuất Word/PDF từ bản được review và kiểm tra mẫu                                                                                               | Cần lấy `Report templates and guidelines.zip` và xác nhận thông tin giảng viên; không đoán mẫu hoặc thông tin còn thiếu                                                                      |
| IV — Source Code and Libraries; Readme.md    | Đầy đủ source, tệp dependency, thư mục rõ ràng, README hướng dẫn yêu cầu hệ thống/cài/chạy/test đã được kiểm chứng                                   | Repository, manifests/lockfiles, migration/seed, hướng dẫn chạy và các suite kiểm thử                                                          | Nền móng có các thành phần này; mỗi module phải cập nhật README và test khi bổ sung chức năng. Sau tích hợp vẫn cần thử checkout sạch trên máy thứ hai                                       |
| IV — Product Presentation Video; V           | Video **có âm thanh**, tối đa 20 phút, tiếng Anh, đủ các thành viên; trình bày lý thuyết, demo, kiến trúc và cách hoạt động                          | Nhóm dự kiến khoảng 18 phút, mỗi người trình bày phần mình                                                                                     | Chưa quay video. Đề nêu thiếu video có âm thanh **hoặc** source đầy đủ kèm hướng dẫn chạy làm phần demo nhận 0 điểm                                                                          |
| I — Overview                                 | Chuẩn bị slide, đăng ký lịch và mỗi thành viên trình bày vào tuần 9–10 tiết lý thuyết                                                                | Slide chung, rehearsal và phân đoạn trình bày cho cả ba                                                                                        | Chưa có slide hoàn chỉnh/lịch đăng ký được xác nhận                                                                                                                                          |
| V — Teamworking Policy                       | Nhóm 2–3 người; phân phối công việc và tham gia trình bày đầy đủ                                                                                     | Ba thành viên làm cả code/test/tài liệu theo module, review chéo và giữ lịch sử đóng góp                                                       | Bàn giao đã chia đầu việc; mỗi thành viên tiếp tục tự commit, review và giải thích được phần mình                                                                                            |

Đề cho phép nhóm chọn công nghệ. Node.js/Express, React, PostgreSQL, Zod, JWT,
Docker Compose, OpenAPI, Postman và bộ kiểm thử là quyết định phù hợp đề tài của
nhóm; không phải danh sách framework giảng viên bắt buộc. JWT không đồng nghĩa
OAuth; JWT có chữ ký không có nghĩa payload được mã hóa.

## Quyết định phạm vi do nhóm tự chốt

| Lựa chọn blueprint                                                  | Ý nghĩa khi triển khai                                                                                                                                        |
| ------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| BookFlow với ba vai trò MEMBER/LIBRARIAN/ADMIN và schema thư viện   | Ngữ cảnh nhóm chọn để minh họa REST; tiếp tục triển khai Auth/Users, Catalog/Copies và Loans theo contract                                                    |
| P0 và P1 trong mục 1.4                                              | Bao gồm refresh rotation/reuse, dashboard/audit, ETag/If-Match, test cạnh tranh/E2E; giữ phạm vi đã chốt, không tự bỏ P1 hoặc báo hoàn thành chỉ vì có schema |
| Tối đa 3 loan, hạn 14 × 24 giờ, chặn overdue và mượn trùng đầu sách | Luật nghiệp vụ của demo; phải hiện thực trong service/transaction và test DB thật                                                                             |
| Kế hoạch **7 ngày** có AI hỗ trợ                                    | Kế hoạch nội bộ; **đề cho 8 tuần**. Hai mốc không thay thế nhau và không xác lập ngày nộp chính thức                                                          |
| Hosting công khai                                                   | Tùy chọn; demo chạy được trên máy chấm là mục tiêu ưu tiên. Không bắt buộc mua dịch vụ/domain hoặc chuyển sang microservices                                  |
| P2: đặt trước, email, OAuth/OIDC login, tìm kiếm toàn văn           | Hướng mở rộng sau bàn giao; không tự thêm thành nghĩa vụ của phần nền móng                                                                                    |

## Chứng cứ phải bổ sung trước khi nộp

- Luồng đăng ký/login/catalog/mượn/trả hoạt động thật, đúng role/ownership; test
  lỗi, rollback, cạnh tranh, refresh/CSRF và optimistic concurrency theo phạm vi.
- Kết quả lint/typecheck/build/unit/integration/E2E và bằng chứng chạy từ checkout
  sạch; ghi riêng test đạt, lỗi, chưa chạy và giới hạn môi trường.
- Ảnh demo, log đã bỏ secret, benchmark có cấu hình/dữ liệu/raw output nếu báo
  kết quả đo; không dùng mockup hoặc số giả làm bằng chứng thành công.
- Word/PDF theo mẫu, slide và video đủ ba người bằng tiếng Anh; tài khoản demo
  local/cách truy cập và hướng dẫn chạy trong gói source.

Chưa được cung cấp ngày nộp chính xác, thông tin giảng viên, mẫu Khoa và yêu cầu
bổ sung trên LMS. Các dữ kiện này không chặn code module nhưng phải xác nhận
trước khi hoàn thiện hồ sơ. Mọi trạng thái kỹ thuật cần đối chiếu kết quả test
hiện tại; việc có foundation hoặc file CI không chứng minh đã đáp ứng toàn bộ
môn học hay bảo đảm mức điểm.
