# Bàn giao các phần BookFlow

Đề tài 1 — RESTful Web Services, môn 503073. Đọc [README](../README.md),
[contract](API_CONTRACT.md), [blueprint](PROJECT_BLUEPRINT.md) và
[kết quả Loans v2](LOANS_VALIDATION.md).

## Trạng thái và phân công

Auth/Users của Quân (PR #4) và Catalog/Copies của Tú (PR #5, gồm sửa review
`118d20f`) đã merge vào `main` tại `50e2dc4`. Nhánh `feat/an-loans-5commits`
bổ sung Loans/Dashboard/Audit từ gói `an-loans-v2`. Chưa coi phần Loans đã merge.

| Thành viên                  | Phạm vi                                                     |
| --------------------------- | ----------------------------------------------------------- |
| Nguyễn Minh Quân — 52400227 | Auth/Users, nền tảng/tích hợp; review Loans                 |
| Phạm Văn Tú — 52400252      | Catalog/Copies, public/staff UI; review Auth                |
| Lê Nguyễn Vạn An — 52400258 | Loans/Dashboard/Audit, transaction, UI/test; review Catalog |

Code/test và quá trình áp dụng, review, chạy kiểm thử có AI hỗ trợ. Các commit
mới dùng Git identity hiện có của An; không sửa author/date hoặc lịch sử người
khác. An vẫn cần đọc, kiểm tra và giải thích được module; kiểm tra bằng AI không
thay thế review độc lập của thành viên khác.

## Gói An v2

Dùng thư mục `an-loans-v2` nằm cạnh checkout, giữ nguyên README, helper,
series.json, patch, file lists và logs. Gói cũ, `loans.patch` đơn lẻ và quy trình
Catalog bundle trước đây không còn là hướng dẫn áp dụng cho nền này.

Trước bước đầu, working tree phải sạch, Node 24.19.0/npm 11, Docker/PostgreSQL
sẵn sàng. Chạy setup/build/migrate/seed/test DB theo README. Cấu hình local root
và server phải nhất quán; DB test kết thúc `_test`. Không gửi mật khẩu/token,
không reset DB dev hoặc dùng `docker compose down -v`.

Helper kiểm tra chính xác tree nền `95da85a3833ec188d8f76dfec04bba58896162fa`.
Nếu main đã có thay đổi mới làm kiểm tra không khớp, dừng để Quân hòa giải;
không reset hoặc sửa series.json để vượt kiểm tra. Nếu bước lỗi, giữ code và
staging để chẩn đoán, không áp lại cùng patch.

| Bước | Nội dung                                                       |
| ---- | -------------------------------------------------------------- |
| 1    | Loans/Dashboard/Audit API, contract/Postman và test PostgreSQL |
| 2    | Màn hình Loans cho MEMBER/staff và component tests             |
| 3    | Dashboard/Audit UI và tests                                    |
| 4    | Điều hướng, nút Borrow và E2E nghiệp vụ                        |
| 5    | Benchmark tooling, tài liệu bàn giao và bằng chứng             |

Từng bước riêng: đọc patch/file list → chạy helper với một số bước → đọc kết
quả và diff → push → bước kế tiếp. Không chạy năm bước bằng vòng lặp. UI mượn
ẩn ở bước 1–3 và chỉ bật ở bước 4. Trong lần tiếp nhận này, tài liệu và bằng
chứng hiện tại được bổ sung vào commit cuối sau khi helper hoàn tất; source
ứng dụng/test vẫn giữ nguyên nội dung v2 đã kiểm thử.

Khi review: kiểm tra đủ năm commit trên nền `50e2dc4`, working tree sạch và
remote branch khớp. Mở PR vào `main` với tiêu đề
`feat(loans): implement borrowing returns and library administration`.
Ghi rõ test đã/chưa chạy và AI hỗ trợ. Quân review code/contract/tích hợp;
chờ GitHub Actions và review đạt rồi dùng **Create a merge commit**.
Không squash hoặc push trực tiếp main để bỏ qua review.

## Nội dung An cần hiểu và giải thích

- Mượn chỉ dành cho MEMBER và lấy userId từ principal, không nhận userId từ body.
- Khóa user → book → copy để tuần tự hóa hạn mức và tranh copy cuối; service
  dùng cùng DB client trong transaction, không gọi HTTP ngoài hoặc xen pool.query.
- Chặn overdue, vượt hạn mức và giữ hai bản cùng đầu sách. Archive và borrow
  khóa cùng hàng book để không mượn sách đã archive.
- Insert loan và audit cùng transaction; audit lỗi thì loan rollback.
- MEMBER chỉ đọc loan của mình, loan của người khác trả404; staff có thể xem
  lịch sử và xác nhận trả. Trả khóa copy → loan, không khóa user sau copy.
- Return lặp giữ nguyên thời điểm/người xác nhận, không thêm audit trùng.
- Dashboard dành cho staff; Audit chỉ ADMIN, lọc action/actor/time/page.
- Loans UI gắn dữ liệu với user+role, abort request cũ và không hiển thị loan
  người trước khi đổi tài khoản. POST borrow không tự retry khi kết quả không rõ.
- Catalog giữ availability riêng với no-store và metadata ETag/304; không tự
  mượn khi chỉ mở chi tiết sách.

Controller giữ HTTP, service giữ nghiệp vụ/transaction, repository giữ SQL tham
số hóa. Không import backend source vào client hoặc sửa migration đã merge.
Các test cạnh tranh/rollback dùng PostgreSQL thật và schema cô lập trong `_test`.

## Các việc còn lại

- An đọc và giải thích mã; Quân review độc lập PR Loans, xác nhận GitHub Actions.
- Chạy stack Docker đầy đủ, Newman/Postman và checkout trên máy thứ hai nếu cần
  nghiệm thu triển khai; không thay bằng kết quả lịch sử trong gói.
- Hoàn thiện báo cáo tiếng Anh Word/PDF 20–60 trang theo mẫu Khoa, slide và video
  tiếng Anh có âm thanh tối đa 20 phút đủ ba thành viên.
- Xác nhận thông tin giảng viên, mẫu Khoa và giờ nộp. Hạn tài liệu nhóm ghi
  **30/10/2026**; chưa có giờ cụ thể.

Xem [REQUIREMENTS_TRACEABILITY](REQUIREMENTS_TRACEABILITY.md). Hoàn thành source
không đồng nghĩa hoàn thành bộ bài nộp hoặc bảo đảm mức điểm.
