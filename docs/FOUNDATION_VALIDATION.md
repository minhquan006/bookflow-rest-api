# Bằng chứng kiểm tra nền móng

Đã kiểm tra ngày **20/10/2026** trong workspace cloud hiện tại, trên commit gốc
`74fe1f9` cộng các thay đổi nền móng đang có trong workspace. Đây là kết quả hiện
tại; chưa phải kết quả GitHub Actions, máy thành viên thứ hai hoặc bản cloud đã Publish.

Blueprint người dùng đính kèm `PROJECT_BLUEPRINT_RESTFUL_LIBRARY.md` trùng hoàn toàn
với `docs/PROJECT_BLUEPRINT.md` trong repository. Đã đối chiếu thêm đề gốc
`503073-Midterm-V1.docx`: đề tài số 1, nhóm ba người Tú — 52400252, An — 52400258,
Quân — 52400227. Kết quả dưới đây chỉ xác nhận nền tảng phát triển, chưa xác nhận
demo nghiệp vụ hoặc các test T01–T20 của blueprint hoàn thành.

| Kiểm tra thực tế        | Kết quả                                                                                                    |
| ----------------------- | ---------------------------------------------------------------------------------------------------------- |
| Node/npm                | Node 24.19.0, npm 11.9.0 trên host; Docker dùng Node 24.19.0/npm 11                                        |
| Cài lại từ lockfile     | `npm ci` ở root và `npm run deps` thành công                                                               |
| Cấu hình local chạy lặp | `npm run setup` giữ nguyên các `.env` đã có                                                                |
| Chất lượng              | `npm run check`: lint, source/test typecheck, hai build, tests, OpenAPI/Postman và Prettier đạt            |
| Backend                 | 42 tests đạt: config, JWT/Argon2id, validation, lỗi, auth/roles, request log, rate limits và trusted proxy |
| Frontend                | 17 tests đạt: HTTP/ProblemDetails, abort, bearer, 204/HEAD/304, metadata, component states                 |
| PostgreSQL thật         | 8 integration tests đạt trong schema riêng của DB test                                                     |
| Browser                 | 6 Playwright cases đạt trên desktop và mobile ở cả chế độ dev và Docker                                    |
| HTTP qua Nginx          | `npm run smoke`: 6 kiểm tra health/API/docs và 5 kiểm tra lỗi 400/413/415 đạt                              |
| Migration/seed          | Chạy lại migration không áp dụng trùng; seed giữ tài khoản/password và không nhân đôi dữ liệu              |
| Docker                  | Build API/web thành công; DB/API/web đều healthy; API uid 1000, web uid 101                                |
| Script cloud            | Toàn bộ script cài đặt đã chạy lại thành công trước khi lưu vào bản nháp cấu hình                          |
| Repository              | `git diff --check` đạt; `.env`, dependencies, build/browser outputs được ignore                            |

Test PostgreSQL kiểm tra migration cạnh tranh và checksum, seed lặp, từ chối seed
production, rollback loan+audit, hai connection tranh cùng copy, ngày mượn/trả,
foreign keys và chuẩn hóa dữ liệu. Đây là bằng chứng constraint/helper hoạt động;
chưa phải bằng chứng service mượn–trả đã triển khai đúng.

Browser test tải Swagger thật, kết nối API qua proxy, hiển thị lỗi/phục hồi và
kiểm tra không tràn ngang ở màn hình nhỏ. Đã dùng Chromium 154 cài sẵn trong môi
trường. Tải browser bundled của Playwright bị allowlist từ chối; không cần mở
thêm mạng để chạy suite hiện tại. Cấu hình hỗ trợ Chromium hệ thống hoặc đường
dẫn `PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH`.

Docker build ban đầu thiếu CA của proxy. Đã khắc phục bằng BuildKit secret trong
`npm run compose -- build ...`; giữ kiểm tra TLS và checksum, không đưa CA/session
credential vào image. Health check nội bộ web dùng loopback trực tiếp. Nginx
chuyển lỗi body tới Express để trả Problem Details; header forwarding được thay
bằng IP từ kết nối thực và API chỉ tin đúng một proxy trong Compose.

## Chạy lại

Từ root, sau khi cài và chuẩn bị database theo README:

```bash
npm run check
npm run test:integration
npm run test:e2e
# Khi Docker stack đã chạy:
npm run smoke
```

## Chưa được xác nhận

- Các endpoint nghiệp vụ, quyền/ownership trong service, refresh/CSRF,
  ETag/If-Match thực tế và luồng catalog–borrow–return.
- Bộ Postman trong ứng dụng Postman/Newman; hiện đã kiểm tra JSON/contract và
  các endpoint tương ứng bằng HTTP/browser tests.
- Kết quả CI trên GitHub và branch protection cần kiểm tra riêng trên repository;
  các kiểm tra local không chứng minh workflow đã đạt hoặc chính sách đã bật.
- Chạy trên máy thành viên thứ hai; hiệu năng và bằng chứng báo cáo/video.
- Publish và khôi phục cloud trong một task mới. `install_script`/`start_skill`
  đã lưu ở bản nháp; cần review/lưu trong Environment settings rồi Publish.

Không có secret thật trong tài liệu này. Mật khẩu demo lấy từ file cấu hình local
được tạo riêng; không dùng ảnh/log chứa token làm bằng chứng trong báo cáo.
