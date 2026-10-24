# Cập nhật tùy chọn English / Tiếng Việt

Bản cập nhật được chuẩn bị từ `main@7221e9e` sau khi cả ba phần của nhóm đã merge.
Gói này thêm bộ chọn ngôn ngữ và kiểm thử, không chứa Git history, mật khẩu, `.env`
hay `node_modules`. Chưa merge tính năng này vào `main`.

## 1. Giải nén

Giải nén `bookflow-vietnamese-update.zip` trong Downloads. Bạn sẽ có thư mục
`bookflow-vietnamese-update` chứa file `bookflow-vietnamese.patch` và hướng dẫn này.
Không giải nén đè toàn bộ source vào repository đang làm.

## 2. Mở terminal tại dự án trên Mac

```bash
cd "/Users/TDTU/Lập trình web/Mid term/bookflow-rest-api"
git status --short
```

Nếu có file đang thay đổi, lưu/commit công việc đó trước. Không reset hoặc xóa file
để làm sạch. Khi trạng thái sạch, chạy:

```bash
git fetch origin
git switch -c feat/vietnamese-language origin/main
git apply --check "$HOME/Downloads/bookflow-vietnamese-update/bookflow-vietnamese.patch"
```

Nếu `--check` không báo lỗi, áp dụng:

```bash
git apply "$HOME/Downloads/bookflow-vietnamese-update/bookflow-vietnamese.patch"
git diff --stat
npm run check
```

Nếu tên thư mục giải nén khác hoặc file nằm ở vị trí khác, sửa đường dẫn patch cho
đúng. Nếu Git báo conflict hoặc patch không áp dụng được, dừng và giữ nguyên thông
báo lỗi; không dùng force hoặc bỏ qua các file lỗi. Nếu nhánh đã có trên Mac, kiểm
tra nhánh hiện có trước, không tạo lại và không áp dụng patch hai lần.

## 3. Chạy thử

Node vẫn là 24.19.0 và npm 11. Không có dependency mới hoặc migration mới; giữ
nguyên các file cấu hình local hiện có. Database trên Mac của Quân vẫn dùng 5433.

Khởi động BookFlow bằng file `bookflow-mac-dev.mjs` đã dùng trước đó, chạy từ root
repository và giữ terminal đó mở. Web: `http://127.0.0.1:5174`.

Chọn **Language → Tiếng Việt** ở đầu trang. Thử chuyển lại English, tải lại trang,
đăng nhập, tìm sách và xem phiếu mượn. Đổi ngôn ngữ không làm mất phiên hoặc nội dung
biểu mẫu. Tên sách, mô tả, tên thể loại và thông tin người dùng vẫn giữ nguyên.

Ở terminal kiểm thử, giữ cấu hình Mac hiện tại:

```bash
export COMPOSE_FILE="compose.yaml:.cache/bookflow/compose.port-5433.yaml"
export E2E_EXTERNAL=1
export E2E_BASE_URL=http://127.0.0.1:5174
export NO_PROXY="${NO_PROXY:+$NO_PROXY,}127.0.0.1,localhost,::1"
export no_proxy="${no_proxy:+$no_proxy,}127.0.0.1,localhost,::1"
npm run test:e2e
```

Nếu database đang dừng, khởi động lại đúng cấu hình 5433 bằng
`docker compose up -d --wait db`. Không dừng các ứng dụng EduTrack đang dùng cổng
3000/5173. Bằng chứng cloud kèm theo không thay thế kiểm tra trên Mac của bạn.

## 4. Review, commit và tạo PR

Đọc diff và rà lại câu chữ tiếng Việt cùng nhóm. Khi kiểm tra đạt:

```bash
git add README.md client/src client/tests/language.test.tsx docs/AI_ASSISTANCE.md docs/LANGUAGES.md tests/e2e/business-flow.spec.ts tests/e2e/language.spec.ts
git commit -m "feat(ui): add persistent English and Vietnamese language selection"
git push -u origin feat/vietnamese-language
```

Mở PR từ `feat/vietnamese-language` vào `main`, ghi rõ thay đổi và các kiểm tra đã
chạy; nhờ một thành viên review trước khi merge. Giữ phần công bố AI assistance.
Không thêm file cấu hình local hoặc các gói ZIP vào commit.

Chi tiết thiết kế và phạm vi dịch: `docs/LANGUAGES.md` trong bản cập nhật.
