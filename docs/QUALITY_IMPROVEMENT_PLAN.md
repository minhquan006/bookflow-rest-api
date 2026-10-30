# Phân công cải thiện chất lượng BookFlow

Ngày lập: **30/10/2026**. Đây là kế hoạch công việc phần mềm sau review, chưa
phải danh sách thay đổi đã thực hiện hoặc kết quả kiểm thử mới.

Mục tiêu: sửa lỗi đã tái hiện, hoàn thiện luồng sử dụng và tăng độ tin cậy của
hợp đồng API. Phạm vi gồm source, kiểm thử và tài liệu kỹ thuật chạy ứng dụng.
Báo cáo học phần, slide, video và nghiệm thu cuối nằm ngoài đợt phân công này.

## Căn cứ và mức ưu tiên

Checkout lúc lập kế hoạch sạch, ở `feat/vietnamese-language@fb22df2`. Nội dung
source tree `5f8a46f16af3f330d12774fb1c73a1c593496d61` trùng với mốc
`origin/main@d3d614f` đã đối chiếu. Các PR #4–#7 đã merge theo lần xác minh
trước; không áp dụng lại gói bàn giao hoặc patch cũ. Khi bắt đầu thực hiện,
kiểm tra Git thực tế và bảo toàn mọi thay đổi local mới phát sinh.

Review đã chạy 18 test Auth/Language hiện có, tất cả đạt; 5 ca bổ sung tái hiện
3 nhóm lỗi: mất trạng thái khi đổi ngôn ngữ, dùng CSRF cũ sau khi cookie đổi ở
tab khác, và câu hướng dẫn trả sách chưa được dịch. Các ca bổ sung dùng kiểm
tra component với HTTP mô phỏng; không phải bằng chứng browser nhiều tab hoặc
DB integration mới. Cần đưa các ca hồi quy thích hợp vào bộ test chính thức
trong từng thay đổi sửa lỗi.

- **P1:** sửa trước — lỗi mất dữ liệu đang nhập và lỗi phiên đăng nhập nhiều tab.
- **P2:** hoàn thiện tiếp — lỗi bản dịch, cấu hình cổng, khả năng sử dụng,
  HTTP semantics, kiểm tra hợp đồng và tài liệu kỹ thuật.
- Công việc P2 có thể bắt đầu song song khi không phụ thuộc P1. Trạng thái
  của mọi đầu việc dưới đây lúc lập kế hoạch là **chưa thực hiện**.

## Bảng phân công

| Mã  | Người phụ trách | Công việc                                            | Ưu tiên | Người review |
| --- | --------------- | ---------------------------------------------------- | ------- | ------------ |
| Q1  | Quân            | Giữ trạng thái khi đổi ngôn ngữ                      | P1      | Tú           |
| Q2  | Quân            | Phối hợp phiên đăng nhập giữa các tab                | P1      | An           |
| Q3  | Quân            | Phân biệt 404 và 405, trả Allow đúng                 | P2      | An           |
| T1  | Tú              | Cấu hình dev, proxy và link tài liệu nhất quán       | P2      | Quân         |
| T2  | Tú              | Catalog có phân trang hợp lý và trạng thái trong URL | P2      | An           |
| T3  | Tú              | Đồng bộ hướng dẫn chạy và trạng thái kỹ thuật        | P2      | Quân         |
| A1  | An              | Dữ liệu phiếu mượn đủ thông tin theo quyền           | P2      | Quân         |
| A2  | An              | Giao diện phiếu mượn, xác nhận trả và bản dịch       | P2      | Tú           |
| A3  | An              | Kiểm tra response thực tế theo OpenAPI               | P2      | Quân         |

Mỗi người chịu trách nhiệm triển khai, kiểm thử và giải thích phần mình.
Người review đọc diff và kiểm tra tiêu chí hoàn thành; tác giả sửa các góp ý
trước khi nhóm quyết định merge. Không đặt chỉ tiêu số commit.

## Nguyễn Minh Quân

### Q1 Giữ trạng thái khi đổi ngôn ngữ

**Vấn đề:** `App.tsx` dùng role đã dịch trong React key của Catalog và trang
chi tiết sách. Đổi ngôn ngữ làm component được tạo lại và mất state.

**Công việc:**

1. Tạo định danh người xem từ `user.id` và role nguyên gốc. Chỉ dịch role ở
   phần hiển thị. Giữ cơ chế xóa dữ liệu khi thực sự đổi tài khoản hoặc quyền.
2. Kiểm tra Catalog, form thêm sách, form sửa sách và barcode đang nhập.
3. Thêm test ở cấp `App` với người đã đăng nhập; giữ các test đổi ngôn ngữ ở
   trang đăng ký hiện có.

**File chính:** `client/src/App.tsx`, `client/tests/language.test.tsx`,
`client/tests/catalog.test.tsx`, `tests/e2e/language.spec.ts`.

**Tiêu chí hoàn thành:**

- [ ] MEMBER tìm kiếm, chọn thể loại, sort và trang; đổi EN → VI → EN vẫn giữ
      nguyên các giá trị và kết quả đã áp dụng.
- [ ] Staff đang thêm/sửa sách hoặc nhập barcode vẫn giữ form và nội dung.
- [ ] Không phát sinh mutation hoặc submit form do đổi ngôn ngữ.
- [ ] Đổi tài khoản/quyền vẫn loại bỏ dữ liệu của người xem trước.
- [ ] Có regression test thất bại trên source trước sửa và đạt sau sửa.

**Kiểm tra:** `npm run check`, E2E ngôn ngữ/Catalog liên quan. Không cần chạy
DB integration chỉ vì thay đổi định danh component.

### Q2 Phối hợp phiên đăng nhập giữa các tab

**Vấn đề:** CSRF trong RAM có thể cũ sau khi tab khác rotate cookie. Cơ chế
single flight hiện có chỉ phối hợp request trong một AuthProvider.

**Công việc:**

1. Đọc CSRF cookie hiện tại tại thời điểm thực hiện request phiên; xử lý rõ
   trường hợp cookie vắng hoặc không hợp lệ.
2. Thiết kế phối hợp refresh/logout giữa các tab cùng origin. Có thể dùng
   Web Locks khi được hỗ trợ và thông báo thay đổi phiên giữa các tab; xác
   định hành vi fallback khi cơ chế phối hợp không khả dụng.
3. Phối hợp cả khôi phục phiên, refresh chủ động, refresh sau GET 401 và
   logout. Khi đã chờ một thao tác khác, đọc lại cookie trước khi gửi request.
4. Quy định và kiểm tra hành vi khi tab khác đăng nhập tài khoản mới hoặc
   logout; response cũ không được phục hồi danh tính/dữ liệu của người trước.
5. Giữ access token trong RAM, kiểm tra Origin/chữ ký/ràng buộc phiên CSRF,
   refresh rotation và phát hiện reuse. Không tự retry mutation nghiệp vụ.

**File chính:** `client/src/features/auth/AuthContext.tsx`, helper đồng bộ
phiên nếu thực sự cần, `client/tests/auth.test.tsx`,
`tests/e2e/auth-flow.spec.ts` hoặc spec nhiều tab riêng. Backend Auth chỉ sửa
khi có lý do cụ thể; ưu tiên giữ nguyên contract và cơ chế bảo mật hiện có.

**Tiêu chí hoàn thành:**

- [ ] Tab B rotate xong; tab A refresh tiếp vẫn hoạt động với cookie mới.
- [ ] Tab B rotate xong; tab A logout thu hồi được refresh family phía server.
- [ ] Hai tab refresh cùng lúc không tự làm mất phiên hợp lệ do đụng rotation.
- [ ] Logout trong lúc refresh không bị response đến muộn đăng nhập lại.
- [ ] Đổi tài khoản ở tab khác không làm lộ dữ liệu của tài khoản trước.
- [ ] CSRF giả, Origin sai và reuse token thật vẫn bị từ chối như contract.
- [ ] Có E2E dùng **hai page trong cùng browser context** để chia sẻ cookie.
      Hai context riêng không thay thế được tình huống này.

**Kiểm tra:** `npm run check`, E2E Auth/nhiều tab. Chạy
`npm run test:integration` nếu thay đổi backend Auth hoặc nghiệp vụ phiên;
dùng integration phù hợp để xác nhận việc thu hồi thật khi cần.

### Q3 Phân biệt 404 và 405

**Công việc:**

1. Phân biệt đường dẫn không tồn tại và method không được hỗ trợ trên đường
   dẫn đã triển khai. Trả `405` với `Allow` phản ánh method thực tế.
2. Giữ Problem Details, request ID và chính sách auth. Xác định cách xử lý
   route bảo vệ; không tạo đường đi bỏ qua middleware quyền.
3. Bao phủ HEAD, route động và route con như availability/return; giữ CORS
   preflight hoạt động. `Allow` và `Access-Control-Allow-Methods` có mục đích
   khác nhau, không sao chép máy móc danh sách của CORS.
4. Cập nhật OpenAPI và Postman cho hợp đồng thay đổi, phối hợp An trước khi
   sửa các phần chung.

**File chính:** `server/src/app.ts`, khai báo route/middleware dùng chung nếu
cần, `server/tests/app.test.ts`, `docs/openapi.yaml`, Postman liên quan.

**Tiêu chí hoàn thành:** URI không có vẫn 404; method sai ở URI đã biết trả
405 và Allow đúng; method hợp lệ và HEAD giữ hành vi; quyền, CORS, Problem
Details và route ưu tiên không bị hồi quy.

**Kiểm tra:** `npm run check`, test HTTP và integration bảo vệ các route bị
ảnh hưởng. An review đồng thời tính nhất quán với OpenAPI.

## Phạm Văn Tú

### T1 Cấu hình dev và link tài liệu

**Vấn đề:** link Swagger dev cố định cổng 3000; Vite proxy và dev tooling cũng
cần thống nhất cách cấu hình khi máy dùng cổng riêng.

**Công việc:**

1. Thiết lập cách cấu hình cổng frontend và target API dùng chung, có default
   rõ ràng và ví dụ public không chứa secret. Chỉ thêm biến khi thật sự cần.
2. Cho link tài liệu đi qua proxy đúng hoặc cấu hình public phù hợp. Proxy
   nhất quán `/api`, `/docs`, `/openapi.yaml`, `/health` khi dùng trong dev.
3. Giữ cách chạy mặc định của repository và hỗ trợ profile Mac của Quân:
   PostgreSQL 5433, API 3100, web 5174.
4. Cấu hình strict port và lỗi dễ hiểu. Script chỉ dừng tiến trình do chính
   nó tạo; không dừng dịch vụ khác để giành cổng.
5. Đưa cách chạy cần thiết vào repository thay vì bắt buộc người khác phải
   có một helper tải riêng bên ngoài.

**File chính:** `client/vite.config.ts`, `scripts/dev.mjs`,
`client/src/App.tsx` phần link tài liệu, `.env.example` phù hợp,
`playwright.config.ts` nếu cấu hình test cần thay đổi.

**Tiêu chí hoàn thành:** trang web, API, health và Swagger cùng trỏ tới
BookFlow trong cấu hình đang kiểm tra; link không còn ép cổng 3000; cấu hình
Mac giữ 5433/3100/5174; E2E external dùng đúng base URL. Chỉ ghi nhận các cấu
hình thực sự đã chạy, không suy ra mọi profile đều đạt.

**Kiểm tra:** `npm run check`, smoke HTTP mục tiêu và E2E liên quan. Sau Q1
được tích hợp, cập nhật nhánh trước khi sửa phần dùng chung trong `App.tsx`.

### T2 Catalog có phân trang hợp lý và trạng thái trong URL

**Công việc:**

1. Chọn page size hợp lý, ví dụ 12 hoặc 20, hoặc selector có giới hạn; thay
   giá trị 2 đang gắn cố định. Định nghĩa default và allowlist nhất quán.
2. Đồng bộ bộ lọc đã áp dụng và phân trang với query string. Phân biệt draft
   đang gõ với bộ lọc đã submit, tránh request ngoài ý muốn.
3. Khôi phục query khi reload, Back/Forward và khi quay từ chi tiết về Catalog.
   Mở trực tiếp URL có query phải cho kết quả tương ứng.
4. Kiểm tra query sai, đổi filter/page size và trường hợp trang hiện tại vượt
   tổng trang sau thay đổi dữ liệu. Giữ cancellation và dữ liệu theo người xem.
5. URL hoặc local state cũ không được cho MEMBER thấy lựa chọn/data archived
   của staff. Backend vẫn là nơi thực thi phân quyền.

**File chính:** `client/src/features/catalog/CatalogPage.tsx`, phần điều hướng
trong `client/src/App.tsx`, `BookDetailPage.tsx`, helper query khi cần,
`client/tests/CatalogPage.test.tsx`, `client/tests/catalog.test.tsx`, E2E Catalog.

**Tiêu chí hoàn thành:**

- [ ] Filter, sort, page và page size đã áp dụng khớp URL và request API.
- [ ] Reload, Back/Forward, quay từ chi tiết và mở URL trực tiếp khôi phục đúng.
- [ ] Query sai được chuẩn hóa an toàn; đổi filter quay về trang hợp lệ.
- [ ] EN/VI giữ trạng thái; đổi tài khoản không giữ dữ liệu/quyền của người cũ.
- [ ] Test tạo đủ fixture để thực sự có nhiều trang với page size mới.

**Kiểm tra:** `npm run check` và E2E Catalog/ngôn ngữ liên quan. Không cần đổi
API nếu chỉ sử dụng query hiện có. Trao đổi với Quân nếu cần đổi router chung.

### T3 Đồng bộ tài liệu kỹ thuật

**Công việc:**

1. Sửa trạng thái lỗi thời trong README, TEAM_HANDOFF, IMPLEMENTATION_STATUS,
   và các tài liệu trạng thái có liên quan; kiểm tra REQUIREMENTS_TRACEABILITY
   và API_CONTRACT nếu chúng còn mang thông tin tích hợp cũ.
2. Thay hướng dẫn áp dụng gói/patch cũ ở phần hướng dẫn hiện hành bằng quy trình
   phù hợp source đã merge. Giữ phần lịch sử có nhãn rõ ràng khi cần đối chiếu.
3. Viết hướng dẫn cấu hình mặc định và profile Mac sau khi T1 ổn định; ghi các
   biến, lệnh chạy và kiểm tra đúng dịch vụ. Không đưa giá trị secret thật vào ví dụ.
4. Mỗi PR chức năng tự bổ sung bằng chứng của mình. T3 tổng hợp đúng commit,
   môi trường và phạm vi, giữ nguyên tính lịch sử của validation cũ.

**Tiêu chí hoàn thành:** hướng dẫn hiện hành không còn nói Loans/tiếng Việt
chưa merge; người đọc phân biệt source đã có, test đã chạy và phần chưa xác
minh; các lệnh/cổng khớp cấu hình đã kiểm tra. Quân kiểm tra lại đối chiếu Git.

**Kiểm tra:** format Markdown và kiểm tra link/lệnh. Chỉ sửa tài liệu thì
không cần chạy lại toàn bộ test suite.

## Lê Nguyễn Vạn An

### A1 Dữ liệu phiếu mượn đủ thông tin theo quyền

**Công việc:**

1. Chốt với Quân và Tú hợp đồng cho list/detail loan trước khi sửa UI. Giữ
   các ID hiện có và bổ sung thông tin phục vụ nhận diện; không đổi input borrow
   hoặc nhận userId từ người mượn.
2. Đề xuất tối thiểu: `book: { id, title }`, `copy: { id, barcode }`;
   staff thêm `borrower: { id, fullName }`. MEMBER chỉ xem loan của mình và
   không nhận thêm danh sách hoặc thông tin người mượn khác.
3. Dùng JOIN hoặc truy vấn theo lô, không tạo một truy vấn/API call cho mỗi
   hàng. Count, filter, sort và pagination phải giữ đúng.
4. Giữ khả năng đọc lịch sử loan của sách đã archive theo quyền đã chốt.
   Tên sách bổ sung là dữ liệu hiện tại; không tự tuyên bố đó là snapshot tại
   thời điểm mượn hoặc thêm cơ chế snapshot ngoài phạm vi.
5. Cập nhật schema/DTO backend, OpenAPI và Postman; cập nhật type frontend
   trong client, không import backend source vào frontend.

**File chính:** `server/src/modules/loans/loans.repository.ts`,
`loans.schema.ts`, service khi cần, `server/tests/loans.integration.test.ts`,
`docs/openapi.yaml`, `postman/BookFlow.business.postman_collection.json`,
`client/src/features/loans/types.ts`.

**Tiêu chí hoàn thành:** MEMBER chỉ đọc loan của mình, loan người khác vẫn
404; staff có dữ liệu nhận diện cần thiết; không lộ hash/token hoặc dữ liệu
người khác ngoài quyền; response khớp schema và phân trang; không hồi quy
transaction, hạn mức, cạnh tranh và return idempotency.

Ưu tiên không đổi schema DB nếu JOIN hiện có đáp ứng được. Nếu thực sự cần
migration, thêm file mới và cập nhật schema readiness, không sửa migration cũ.

**Kiểm tra:** `npm run check`, `npm run test:integration`; E2E nghiệp vụ khi
tích hợp A2. Quân review phân quyền và hợp đồng trước khi Tú review UI A2.

### A2 Giao diện phiếu mượn và xác nhận trả

**Công việc:**

1. Dùng dữ liệu A1 để hiển thị tên sách, barcode và người mượn cho staff;
   ID vẫn có thể xuất hiện ở chi tiết để tra cứu.
2. Xác nhận trả phải nêu đúng sách, bản sách và người mượn. Khóa thao tác khi
   request đang chạy; thông báo thành công chỉ sau response phù hợp.
3. Khi lỗi mạng làm kết quả không rõ, hướng dẫn đọc lại lịch sử. Giữ tính
   idempotent và sự nhất quán của thời gian/người xác nhận do backend quyết định.
4. Dịch hai câu `Return recorded` và `Return at the library` qua dictionary
   hiện có; rà trạng thái ACTIVE, OVERDUE, RETURNED ở EN/VI, cho MEMBER và staff.
5. Giữ bản sửa trả phiếu cuối ở trang cuối: tự chuyển trang hợp lệ, giữ bộ lọc;
   trường hợp không còn kết quả quay về trang 1.
6. Giữ kiểm soát response đến muộn và dữ liệu theo người xem khi đổi tài khoản.
   Nội dung sách/người dùng không được đưa qua hàm dịch.

**File chính:** `client/src/features/loans/LoansPage.tsx`, `types.ts`,
`client/tests/loans.test.tsx`, `tests/e2e/business-flow.spec.ts`; dictionary
chỉ thêm key khi cần. Phần sửa hai câu dịch có thể làm trước khi A1 hoàn tất.

**Tiêu chí hoàn thành:** thủ thư nhận diện được đúng người–sách–bản sách
trước khi trả; không cần nhớ UUID; EN/VI đầy đủ; loading/empty/error đúng;
trả lặp, phân trang cuối và đổi người xem không hồi quy; desktop/mobile dùng được.

**Kiểm tra:** `npm run check` và E2E nghiệp vụ liên quan. Bằng chứng DB của
hành vi return thuộc integration hiện có/A1, chỉ chạy lại khi thay đổi cần đến.

### A3 Kiểm tra response theo OpenAPI

**Công việc:**

1. Giữ `contract:check` cho việc kiểm spec và JSON Postman. Bổ sung kiểm tra
   response thực tế của test HTTP/integration với schema OpenAPI 3.1.
2. Chọn cách validate phù hợp schema đang dùng và dependency hiện có; nếu cần
   dependency mới, thêm có mục đích và cập nhật đúng lockfile tương ứng.
3. Ưu tiên Auth, book detail/update, loan list/detail/return và lỗi trọng yếu.
   Kiểm tra status, Content-Type, header và body theo từng operation.
4. Bao phủ 201/Location, 204/304 không có body, ETag/If-Match 412/428,
   401/403/404 và 405/Allow sau Q3. Không dùng một schema success chung cho lỗi.
5. Có ca chứng minh validator từ chối response thiếu trường bắt buộc hoặc sai
   kiểu, thay vì chỉ xác nhận đọc được file OpenAPI.
6. Giữ assertion nghiệp vụ/ownership/rollback hiện có. Khi A1 thêm field, sửa
   kỳ vọng theo contract đã thống nhất, không nới assertion chỉ để test đạt.

**File chính:** helper kiểm tra contract trong test hoặc script thích hợp,
`server/tests`, `scripts/check-contract.mjs` và workflow/package scripts chỉ
khi cần. Không bắt buộc đưa validator vào runtime production.

**Tiêu chí hoàn thành:** response thực tế được kiểm tra theo đúng operation
và status; helper phát hiện được sai schema; bộ test vẫn kiểm tra được quyền,
tính idempotent và tác động DB. Ghi rõ những operation chưa được bao phủ.

**Kiểm tra:** `npm run check` và `npm run test:integration` khi helper được dùng
trong integration. E2E chỉ cần khi có thay đổi frontend/tích hợp liên quan.

## Thứ tự thực hiện và phần dùng chung

1. **Chốt hợp đồng nhỏ trước:** An đề xuất DTO A1; Quân review quyền, Tú review
   thông tin cần hiển thị. Thống nhất cách cấu hình T1 và URL state T2.
2. **Sửa lỗi P1:** Quân làm Q1 rồi Q2. Tú có thể làm phần cấu hình T1 và
   Catalog T2; An làm A1 và phần dịch độc lập của A2.
3. **Tích hợp hành vi:** sau khi cập nhật Q1, Tú hoàn tất thay đổi App/router
   của T1/T2; An nối UI A2 với DTO A1. Mỗi người chạy kiểm tra liên quan.
4. **Củng cố HTTP và contract:** Quân làm Q3; An hoàn tất A3 trên contract đã
   cập nhật A1/Q3. Helper A3 có thể chuẩn bị từ trước.
5. **Đồng bộ tài liệu kỹ thuật:** Tú hoàn tất T3 theo kết quả thật của các PR.

| File/phần dùng chung           | Cách phối hợp                                                                                             |
| ------------------------------ | --------------------------------------------------------------------------------------------------------- |
| `client/src/App.tsx`           | Quân sửa key trong Q1; Tú sửa link và điều hướng trong T1/T2 sau khi cập nhật Q1. Review giữ cả hai phần. |
| `client/src/i18n/vi.ts`        | Người thay UI thêm key cần thiết, dùng diff nhỏ và cập nhật nhánh; giữ nguyên nội dung người dùng.        |
| `docs/openapi.yaml` và Postman | An phụ trách A1/A3; Quân phối hợp phần 405 của Q3 trước khi sửa.                                          |
| `tests/e2e/language.spec.ts`   | Quân phụ trách Q1; Tú bổ sung assertion URL/filter sau khi cập nhật thay đổi đó.                          |
| Validation lịch sử             | Không sửa số cũ thành số mới; bổ sung mốc và môi trường mới khi thật sự chạy.                             |

Các thành viên làm trên checkout/nhánh của mình rồi review bằng PR. Trong
workspace dùng chung, không thao tác checkout hoặc sửa cùng file đồng thời.
Kế hoạch này không yêu cầu tạo worktree, thay author hoặc thay lịch sử Git.

## Gói PR và bằng chứng

Gợi ý gói review: Q1; Q2; T1; T2; A1+A2; Q3; A3; T3. Có thể gộp/tách theo
khả năng review và phụ thuộc thực tế; mỗi PR cần tạo một kết quả có thể kiểm
chứng. Nếu A1 và A2 tách PR, chốt rõ hợp đồng và thứ tự tích hợp.

Mỗi PR dùng đúng ba mục trong template repository:

1. **Problem and resulting behavior:** tình huống cụ thể, lỗi trước sửa và
   hành vi sau sửa.
2. **Contract and data:** thay đổi API/schema/migration hoặc ghi rõ không đổi;
   chỉ ra OpenAPI/Postman liên quan.
3. **Validation:** lệnh đã chạy, kết quả, commit/môi trường, regression cases,
   phần chưa chạy và người review.

Mỗi người giữ một danh sách bằng chứng ngắn: mã task, commit, lệnh kiểm tra,
exit code/kết quả, môi trường và giới hạn. Ảnh UI dùng dữ liệu tổng hợp, không
chụp token/password. Người review đối chiếu các checkbox của task trước khi
đánh dấu hoàn tất; review và merge vẫn do nhóm quyết định.

## Quy tắc thực hiện

- Node 24.19.0, npm 11; cài bằng lockfile: `npm ci` ở root, `npm run deps`
  cho server/client khi cần cài lại.
- Source changes chạy `npm run check`; thay đổi DB/nghiệp vụ chạy integration;
  thay đổi UI/tích hợp chạy E2E liên quan. Không tự động chạy lại Docker hoặc
  benchmark cho mọi PR nếu không có thay đổi/rủi ro tương ứng.
- DB test kết thúc `_test`, không reset DB phát triển. Migration đã merge bất biến.
- Giữ cổng Mac 5433/3100/5174; không dừng EduTrack để chạy BookFlow.
- Không commit secret/dependency; không tắt rate limit hoặc nới assertion để
  tạo kết quả đạt. Thiết kế fixture/E2E để tránh lặp request không cần thiết.
- Kết quả cloud, Mac và GitHub Actions phải ghi riêng. Công bố AI assistance
  và trách nhiệm review trung thực.

## Theo dõi tiến độ

| Mã  | Trạng thái ban đầu | Bằng chứng cần bổ sung khi thực hiện                                   |
| --- | ------------------ | ---------------------------------------------------------------------- |
| Q1  | Chưa thực hiện     | Commit, regression mất state, check và E2E                             |
| Q2  | Chưa thực hiện     | Commit, test CSRF cũ, browser nhiều tab, bằng chứng thu hồi phiên      |
| Q3  | Chưa thực hiện     | Commit, ma trận route/method/quyền, OpenAPI/Postman                    |
| T1  | Chưa thực hiện     | Commit, cấu hình thực sự đã chạy, HTTP/E2E liên quan                   |
| T2  | Chưa thực hiện     | Commit, test URL/Back/Forward/pagination và E2E                        |
| T3  | Chưa thực hiện     | Diff tài liệu, mốc Git đã đối chiếu, format/link                       |
| A1  | Chưa thực hiện     | Commit, DTO, ma trận quyền và DB integration                           |
| A2  | Chưa thực hiện     | Commit, UI EN/VI, xác nhận trả, regression phân trang và E2E           |
| A3  | Chưa thực hiện     | Commit, operation/status đã bao phủ và ca validator từ chối schema sai |
