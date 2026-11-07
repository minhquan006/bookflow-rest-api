Mình nhờ Codex hỗ trợ bổ sung review frontend/Q1 tại đúng head
`40eb9143866306725767f3121599e678e3fddc7c`.

- Bộ regression mở rộng đạt **16/16**, gồm menu theo role, MEMBER giữ
  search/category/sort/page qua EN–VI–EN, form thêm/sửa/barcode, đổi tài khoản
  hoặc role, không giữ archived/draft cũ, response đến muộn, direct URL guards
  và Back/Forward. Các thao tác đổi ngôn ngữ không phát mutation.
- Đối chứng key dùng role đã dịch: bốn ca hồi quy thất bại đúng kỳ vọng; sau đó
  phục hồi source #9. Typecheck của bộ test mở rộng trên #9 đạt.
- **8 ca browser** desktop/mobile × EN/VI × MEMBER/LIBRARIAN đạt; dùng giao diện
  và CSS thật của #9 nhưng **HTTP mock**, không coi là bằng chứng backend/RBAC.
  Kiểm tra được skip link/focus bàn phím và không tràn ngang trang ở các viewport.

Chưa phát hiện blocker mới trong phạm vi frontend/Q1 này. Bộ test tương tự cũng
đạt trên nhánh Tú để phục vụ tích hợp sau đó; kết quả hai source được ghi riêng.
CI xanh của #9 không được dùng để xác nhận bản ghép #9 + #10 + #11 hoặc Q2/Q3.
Full accessibility audit và phiên nhiều tab chưa nằm trong kết luận này.

Báo cáo, test và ảnh thuộc bộ review của nhánh Tú. Sau khi bộ evidence được
push, có thể dẫn `docs/TU_FRONTEND_REVIEW.md`
và `docs/evidence/tu-review-20261102` trong PR #11 để đối chiếu.
