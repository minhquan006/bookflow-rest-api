# Trạng thái triển khai và tích hợp

Nền hiện tại là `main` tại `50e2dc4`. Auth/Users đã merge qua PR #4;
Catalog/Copies đã merge qua PR #5, gồm bản sửa review `118d20f`.

| Gói                   | Phụ trách       | Trạng thái                                                                                                |
| --------------------- | --------------- | --------------------------------------------------------------------------------------------------------- |
| Auth/Users            | Quân — 52400227 | Đã merge vào main; register/login, refresh/CSRF, users/RBAC và UI                                         |
| Catalog/Copies        | Tú — 52400252   | Đã merge vào main; category/book/copy, availability, ETag/If-Match và UI                                  |
| Loans/Dashboard/Audit | An — 52400258   | Gói v2 đã áp dụng trên `feat/an-loans-5commits`; API/UI/test có trong nhánh, chờ review và CI trước merge |

Gói An v2 dùng chính xác nền `50e2dc4`, không dùng lại bundle/patch An cũ.
Năm bước được chạy riêng, kiểm tra và push từng commit. Kết quả thực thi cloud
ở [LOANS_VALIDATION](LOANS_VALIDATION.md); mỗi bước chạy check, integration và
E2E. Giao diện Borrow/My loans chỉ bật ở bước 4, cùng màn hình Loans thực tế.

Code/test và quá trình áp dụng, review, kiểm thử có AI hỗ trợ. Git identity của
An được giữ nguyên; điều này không có nghĩa An tự viết hoặc đã tự review từng
dòng mã. An cần đọc và giải thích phần tiếp nhận; Quân review độc lập trước merge.
Không đồng nhất kết quả cloud với GitHub Actions hoặc nghiệm thu trên máy thứ hai.

Các kết quả chuẩn bị ngày 21/10 trong FULL_VALIDATION và một số tệp evidence là
lịch sử. Các nhánh/bundle cũ không còn là hướng dẫn tiếp nhận gói v2.

Báo cáo Word/PDF tiếng Anh, slide và video vẫn cần nhóm hoàn thiện bằng bằng
chứng thật. Hạn được ghi trong tài liệu nhóm: **30/10/2026**, chưa có giờ cụ thể.
