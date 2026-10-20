# Làm việc cùng nhau

Đọc [README](README.md), [bàn giao nền tảng](docs/TEAM_HANDOFF.md) và
[hợp đồng API](docs/API_CONTRACT.md) trước khi tạo nhánh.

1. Dùng Node trong `.nvmrc`, chạy `npm ci`, `npm run deps`, `npm run setup`.
2. Tạo nhánh `feat/auth`, `feat/catalog`, `feat/loans` hoặc tên tác vụ nhỏ hơn.
3. Thống nhất thay đổi OpenAPI/schema với người phụ trách module liên quan trước khi triển khai.
4. Chạy `npm run check` và test integration/E2E liên quan. Chỉ báo pass cho test đã chạy.
5. Mở PR với mục tiêu, bằng chứng kiểm thử và phần chưa hoàn thành; một thành viên khác review.

Không tạo file rỗng chỉ để đủ cây thư mục. Controller xử lý HTTP; service giữ nghiệp vụ và
transaction; repository nhận DB client, dùng SQL tham số hóa. Dùng shared middleware/errors
và HTTP client thay vì tạo định dạng lỗi riêng. Không import source backend vào client.

Migration đã merge là bất biến; thêm file SQL có số thứ tự tăng dần. Không tự reset DB của
người khác. Test DB dùng `TEST_DATABASE_URL` có tên kết thúc `_test`. Không commit `.env`,
token, password, dump dữ liệu cá nhân hay thư mục dependency.

Commit ví dụ: `feat(loans): enforce active loan limit`. Cập nhật nhánh từ main thường xuyên;
giữ PR nhỏ theo một hành vi kiểm chứng được. Mỗi thành viên tự commit phần đóng góp.

Quản trị repository cần bật branch protection cho `main`: PR trước merge, ít nhất một
approval và yêu cầu các job CI `quality`/`containers` thành công. Đây là cấu hình GitHub
cần thực hiện trên repository; file workflow không tự bật branch protection.
