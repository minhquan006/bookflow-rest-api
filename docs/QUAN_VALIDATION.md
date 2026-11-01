# Q1–Q3 của Quân: triển khai và bàn giao review

Ngày 01/11/2026, Mac arm64, Node 24.19.0/npm 11.17.0. Nhánh local
`fix/quan-session-http` dựa trên PR #9 @ `40eb914`. Thay đổi chưa commit/push/merge;
không coi đây là chức năng đã có trên main @ `d3d614f`.

## Q1 — Ngôn ngữ và state

- Giữ key từ ID/role gốc, không dùng nhãn đã dịch. Fragment theo viewer xóa state
  nghiệp vụ khi đổi tài khoản/quyền, không thêm phần tử DOM hay đổi CSS.
- Form login/register giữ key theo route: background restore không xóa thông tin
  đang gõ. Điều này được kiểm tra bằng response restore đến muộn ở cấp App.
- App tests kiểm tra search/category/sort/page, form tạo/sửa sách và barcode qua
  EN → VI → EN; không phát sinh request/mutation do đổi ngôn ngữ. Hai ca đổi
  account/role kiểm tra draft người trước bị xóa, kể cả khi cả hai role đều là staff.
- E2E dùng API và DB thật cho MEMBER áp dụng đủ bộ lọc, sang trang 2 và giữ kết quả;
  staff giữ create/edit/barcode draft rồi tiếp tục tạo/sửa/cấp bản sách bình thường.
  Dữ liệu fixture đủ `page size + 1`, đọc page size từ response thay vì ép T2 dùng 2.
- Hai regression tests từ đợt refactor đã thất bại trên key cũ và đạt sau sửa.
  Các ca bổ sung không được mô tả là đã chạy trên source cũ.

## Q2 — Phiên dùng chung giữa các tab

`session-coordination.ts` dùng Web Locks cùng origin. Login, refresh, logout và
request có access token cùng dùng khóa; khóa giữ đến sau khi đọc/parse body.
Access token ở RAM. CSRF header lấy từ cookie hiện tại sau khi nhận khóa. Khi
tab khác rotate cookie, access token còn hạn vẫn dùng bình thường; không phát sinh
rotation chỉ vì snapshot cookie khác. GET/HEAD 401 chỉ refresh/retry tối đa một lần; mutation không được tự retry.

LocalStorage chỉ có marker `bookflow.session.revision` chứa trạng thái và UUID:
`pending`, `active`, `signed-out`. Không có token, cookie, email, tên hay role.
Intent login/logout phát marker trước khi chờ khóa, để các tab xóa danh tính và
state cũ ngay. Kiểm tra revision/epoch trước và sau response ngăn dữ liệu đến
muộn hồi sinh phiên cũ. Lắng nghe storage/focus/visibility và sự kiện trong cùng
window; đọc revision hiện tại thay vì tin event đã đến muộn. Refresh đơn thuần
không đổi revision nên các tab vẫn có thể giữ cùng một tài khoản.

Tab khác đổi tài khoản: tab đang mở trở về trạng thái chưa đăng nhập; reload mới
khôi phục tài khoản hiện tại từ cookie chung. Logout lỗi vẫn giữ tombstone
signed-out để reload không tự phục hồi cookie còn lại. Có thông báo khi server
không thu hồi được phiên; signed-out local không được gọi là thu hồi server thành công.

Yêu cầu trình duyệt mới, HTTPS/localhost, Web Locks và writable site storage.
Không có cơ chế này thì từ chối thao tác phiên, không gửi auth request; Catalog
và đổi ngôn ngữ trong lượt truy cập vẫn dùng được. Đây là fallback có chủ đích,
không dùng localStorage làm mutex. Chờ khóa và auth HTTP có giới hạn 15 giây.
Request nghiệp vụ đang được server xử lý có thể đã commit trước logout; loại bỏ
response cũ không hoàn tác transaction hoặc thu hồi JWT còn hiệu lực.

Browser tests dùng **hai page trong cùng context**, chia sẻ cookie, xác nhận:

1. B restore/rotate xong, A tiếp tục proactive refresh bằng cookie mới.
2. Hai tab proactive refresh cùng lượt không tự gây reuse/revoke.
3. B là tab rotate cuối, A logout thành công 204. Gửi lại chính refresh/CSRF
   hiện hành ngay trước logout với Origin đúng nhận 401: có bằng chứng thu hồi thật.
4. Giữ response refresh đang bay, B logout; nhả response cũ không khôi phục A.
5. B đăng nhập tài khoản khác, A không còn danh tính/dữ liệu người trước; reload
   chỉ theo tài khoản hiện tại. Thiếu Web Locks: từ chối login, public Catalog còn dùng được.

Unit tests bổ sung storage bị chặn, tombstone qua reload, stale private response,
CSRF mới, logout đang refresh và phát hiện family đã thu hồi. Backend Auth,
Origin/HMAC CSRF/session binding, rotation và reuse detection được giữ nguyên;
105 integration tests kiểm tra hồi quy trên DB `_test`, schema riêng.

## Q3 — Method và quyền

- Registry `routes.resources.ts` bao phủ 5 foundation + 27 business operations.
  Shared method guard ở composition, không truy cập private Express internals.
- Unknown URI giữ 404, bao gồm URL con lạ dưới `/docs`; Swagger HTML chỉ gắn
  vào GET `/docs`, không dùng middleware HTML bắt toàn bộ prefix. Regression đã
  tái hiện `/docs/not-a-resource` trả 200 trước sửa, sau sửa trả 404.
- Known resource/sai method trả 405 Problem Details và Allow
  đúng resource. GET có HEAD; OPTIONS giữ CORS. Header Allow được expose.
- Authenticated/staff/admin resource vẫn yêu cầu phiên và role tương ứng trước
  405, không lộ Allow ở 401/403. Public resource vẫn giữ quyền riêng của từng
  operation ghi. Static `/users/me` được ưu tiên trước `/users/:id`.
- Method negotiation xét hình dạng đường dẫn, không xác nhận bản ghi tồn tại.
  Method hợp lệ vẫn qua UUID validation, ownership, ETag và nghiệp vụ như cũ.
- 28 HTTP tests trên app/router thật, gồm đủ 24 resource paths, role/status,
  unknown/nested paths, HEAD/CORS/Allow, static route và valid-method guards.
- OpenAPI có response 405/Allow cho đủ 32 operations; contract checker phát hiện
  registry/OpenAPI lệch hoặc thiếu 405. Khi thêm handler phải cập nhật registry
  cùng contract và tests. Foundation Postman thêm known method sai, nested route
  và unknown URI; JSON/schema được kiểm tra, chưa chạy Newman ở đợt này.

Chi tiết chính sách ở [API_CONTRACT](API_CONTRACT.md#404-405-head-và-options).

## Kết quả chạy

- `npm run check`: đạt; 94 backend + 93 frontend tests, lint/typecheck/build,
  32 operation OpenAPI, Postman JSON và format. Còn 11 cảnh báo React hiện có.
- `npm run test:integration`: đạt 105/105, DB `_test`, không reset DB phát triển.
- E2E Chromium desktop: đạt 17/17; mobile Chromium (iPhone 13): đạt 17/17.
  Chạy riêng từng project với `E2E_EXTERNAL=1 E2E_BASE_URL=http://127.0.0.1:5174`
  và `npm run test:e2e -- --project=chromium` / `--project=mobile`.
  Tổng 34 browser tests, không retry ở các lượt xác nhận này.

Cấu hình Mac: PostgreSQL 5433, API 3100, frontend 5174, helper local hiện có.
E2E chạy từng project với API mới để không dùng chung quota IP 300/phút giữa hai
lượt; CI dùng cùng cách tách project như thay đổi đang có trên PR #10 của An.
Không nâng giới hạn API production hoặc bỏ ca kiểm thử. Playwright clock dùng
chung browser context, chỉ install/tick một lần cho hai page.

Chưa build lại Docker, chạy Newman/benchmark hoặc xác nhận CI cho commit mới.
PR #10 của An và source T1–T3 của Tú chưa tích hợp trong nhánh này.
Lần đối chiếu GitHub cuối: #9 ready/unmerged ở `40eb914`, #10 unmerged ở
`3d0695d`; kết quả nhánh này không xác nhận kiểm thử cho head mới của #10. Những lượt
chạy lỗi khi phát triển được dùng sửa race/test fixture; kết quả cuối chỉ tính
lượt chạy trên source ổn định. Không đổi số liệu bằng chứng lịch sử trong docs/evidence.

## Review và tích hợp tiếp theo

- Tú review Q1: AppRouter key, EN/VI không submit, draft/filter/page giữ nguyên,
  đổi account/role phải xóa dữ liệu cũ; phối hợp test URL/Back/Forward của T2.
- An review Q2: khóa nhiều tab, cookie mới sau chờ, logout/revocation và stale
  response. Review Q3: visibility/401/403/405/Allow và contract. Sau khi ghép A3,
  thêm assertion 405 runtime trong helper validator của An.
- Quân tự giải thích và kiểm tra diff trước khi commit bằng danh tính Git thật.
  Giữ PR #9 cho refactor. Nhánh này dựa trên PR #9: khi #9 chưa merge, PR tiếp
  theo có thể dùng base `chore/repository-cleanup`; sau #9 merge thì đổi base sang
  main và kiểm tra diff/CI. Không merge #9 hoặc #10 trong đợt triển khai này.
- Khi ghép #10 với refactor, giữ cả import formatter dùng chung và response guard
  trong `LoansPage.tsx`. Ghép thay đổi OpenAPI theo từng operation, giữ schema DTO
  của An và 405 của Quân; chạy lại contract/integration/E2E trên source đã ghép.

Tài liệu API gốc tham chiếu: [Web Locks](https://www.w3.org/TR/web-locks/),
[Web Storage](https://html.spec.whatwg.org/multipage/webstorage.html),
[HTTP 405](https://www.rfc-editor.org/rfc/rfc9110.html#section-15.5.6).
