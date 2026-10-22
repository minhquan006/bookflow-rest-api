# BookFlow — Gói bàn giao phần Tú

Phần kỹ thuật: Catalog/Categories/Books/Copies và UI dùng chung.
Tác giả trình bày theo phân công: Phạm Văn Tú — 52400252.

## Mở các tài liệu

- `BookFlow_Tu_Report.docx`: chương báo cáo tiếng Anh, chỉnh sửa được.
- `BookFlow_Tu_Report.pdf`: bản đọc cùng nội dung; **không phải toàn bộ báo cáo nhóm**.
- `BookFlow_Tu_Slides.pptx`: 10 slide chỉnh sửa được, có speaker notes.
- `BookFlow_Tu_Slides.pdf`: bản đọc slide.
- `SPEAKER_SCRIPT.md`: lời trình bày tiếng Anh, target tổng 6 phút.
- `video/tu-catalog-practice.mp4`: ghi hình thao tác thật với phụ đề tiếng Anh, **không có âm thanh**.
- `video/tu-catalog-practice.srt`: phụ đề có thể chỉnh sửa.
- `figures/`: ảnh thực tế từ database test riêng và sơ đồ kiến trúc.
- `logs/`: kết quả kiểm thử local, cùng metadata HTTP đã loại credentials.

Clip practice phục vụ tập trình bày/chọn cảnh. Không dùng riêng clip không có tiếng
để nộp: đề yêu cầu video có âm thanh và cả ba thành viên tự trình bày tiếng Anh.
Nhóm cần tự thu tiếng/ghi hình phần mỗi người, ghép thành video tối đa 20 phút.

## Đã kiểm tra và phần cần nhóm bổ sung

- Đã chạy lại `npm run check`, `npm run test:integration`, `npm run test:e2e`:
  59 + 52 + 10 = **121 test đạt**. Đây là kết quả local, không phải xác nhận GitHub CI.
- Có Word/PDF, slide, ảnh, mã nguồn và OpenAPI/Postman cho phần đã hiện thực.
- Dùng cấu trúc blueprint; chưa có archive mẫu Khoa nên chưa xác nhận đúng mẫu chính thức.
- Chưa có tên giảng viên, hạn nộp chính xác hoặc yêu cầu riêng trên LMS. Không tự điền.
- Báo cáo riêng phần Tú cần ghép với phần Quân/An thành báo cáo nhóm 20–60 trang nội dung.
- Auth refresh/logout, full account UI, Loans, Dashboard/Audit chưa được suy thành đã hoàn thành.
- GitHub đã có nhánh `feat/catalog` khác. Bộ bàn giao này nằm ở nhánh riêng, cần nhóm
  đối chiếu trước merge; không thay thế lịch sử công việc của thành viên khác.

## Tạo lại tài liệu và clip trên Linux

Yêu cầu: chạy setup theo README root; có Node 24.19.0, npm 11, Python 3,
Chromium tại `/usr/bin/chromium` (hoặc `PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH`),
FFmpeg tại `/usr/bin/ffmpeg`, Graphviz và font DejaVu.
Dependencies Python được liệt kê trong `requirements.txt` của thư mục này.

Từ root repository:

```bash
npm run build
# TEST_DATABASE_URL cần trỏ database riêng có tên kết thúc _test.
node scripts/record-tu-demo.mjs
ffmpeg -y -i docs/submission/tu/video/tu-catalog-practice.webm \
  -vf subtitles=docs/submission/tu/video/tu-catalog-practice.srt \
  -c:v libx264 -preset fast -crf 23 -an -movflags +faststart \
  docs/submission/tu/video/tu-catalog-practice.mp4
dot -Tpng docs/submission/tu/figures/architecture.dot \
  -o docs/submission/tu/figures/architecture.png
python3 scripts/build-tu-submission.py
```

Recorder tạo schema ngẫu nhiên trong database `_test` và dọn sau khi xong; dùng
API/Vite riêng trên 3410/5410. Không seed hoặc reset DB phát triển, không dùng tài khoản
thật để quay. Recorder giữ token trong bộ nhớ và chỉ ghi method/path/status/ETag;
không ghi request body/password/token vào evidence.

Ứng dụng chính vẫn dùng hướng dẫn chạy ở README root. Không cần Python/FFmpeg để
chạy Catalog thông thường; các công cụ này chỉ để tạo lại tài liệu/clip.

## Nhánh bàn giao và PR

Đã push mã và tài liệu lên nhánh
[`codex/tu-bookflow-handoff-20261022`](https://github.com/minhquan006/bookflow-rest-api/tree/codex/tu-bookflow-handoff-20261022).

GitHub API từ môi trường này từ chối tạo PR bằng `Forbidden`; chưa có PR mới được xác nhận.
Bạn có thể mở trang Compare của nhánh trên GitHub, chọn base `main`, tạo **Draft PR**
và dùng nội dung [PULL_REQUEST_DRAFT.md](PULL_REQUEST_DRAFT.md).
Nhờ Quân review Auth integration và đối chiếu nhánh `feat/catalog` sẵn có trước merge.
Không merge trực tiếp vào main chỉ vì các test local đã đạt.
