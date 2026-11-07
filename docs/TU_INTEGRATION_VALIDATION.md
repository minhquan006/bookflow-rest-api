# Tú — tích hợp PR #11 trên main mới

Checkpoint: **06/11/2026**, Linux cloud, Node 24.19.0/npm 11.9.0,
PostgreSQL 17.6 và system Chromium. Có Codex hỗ trợ giải quyết conflict,
kiểm tra và tổng hợp bằng chứng; Tú chịu trách nhiệm đọc và giải thích thay đổi.

## Source

- Nhánh Tú trước tích hợp: `bcf0fc4401c821adc1bbea47394e8d50be375070`.
- Nền main: `e28ff8340c2fc0e492ec7df1a8a76601bf098180`, đã nhận #9 → #12 → #10.
- Bản ghép đã commit/push thành `43456c32f330b44e9c1cffa21467d3892da53cd0`
  trên PR #11; cả bốn CI checks của head đó đã đạt. PR chưa merge.
- Follow-up runner bên dưới đang là working diff trên `43456c3`, chưa commit/push.
  CI của `43456c3` không xác nhận bản sửa follow-up chưa phát hành.

## Giải quyết conflict

11 file conflict ban đầu:

- `README.md`
- `client/src/App.tsx`
- `client/src/features/catalog/CatalogPage.tsx`
- `client/src/i18n/vi.ts`
- `client/tests/setup.ts`
- `docs/API_CONTRACT.md`
- `docs/IMPLEMENTATION_STATUS.md`
- `docs/QUALITY_IMPROVEMENT_PLAN.md`
- `docs/REQUIREMENTS_TRACEABILITY.md`
- `docs/TEAM_HANDOFF.md`
- `tests/e2e/language.spec.ts`

Giữ `App.tsx` dùng AppRouter/AppLayout của main và Fragment key theo danh tính
Q1. `app/usePath.ts` dùng chung `useBrowserLocation` để router nhận cả thay đổi
pathname/query và sự kiện navigation của T2. Không phục hồi App nguyên khối.
AppLayout giữ logout/retry revocation Q2, dùng link `/docs/` tương đối của T1.

Catalog giữ page size 12/24/48, URL/applied filters, draft riêng, query normalization,
abort/result key theo người xem và shared pagination từ main. Bản dịch giữ cả nhãn
T2 và Q2/A2. Test setup giữ Web Locks cùng reset history/scroll mock. E2E ngôn ngữ
giữ ca MEMBER theo page size thật và ca staff giữ draft không phát mutation.

Giữ backend/session coordination, DTO/return guard, OpenAPI, runtime 405/Allow
và các test Q2/Q3/A1–A3 từ main. Không sửa migration hoặc nới rate limit.
Tài liệu trạng thái mới được cập nhật, giữ báo cáo/bằng chứng lịch sử riêng.

## Kiểm chứng bản tích hợp tại 43456c3

| Kiểm tra                                             | Kết quả thực chạy                                                                                    |
| ---------------------------------------------------- | ---------------------------------------------------------------------------------------------------- |
| `npm run check`                                      | Đạt: 5 tooling + 133 server + 143 client = 281 tests; lint/typecheck/build/contract/format đạt       |
| `npm run test:integration`                           | 111/111 đạt, PostgreSQL thật với schema suite riêng                                                  |
| `npm run test:e2e`                                   | 22 desktop + 22 mobile đạt, không retry; mỗi project gồm 14 UI + 8 session flows                     |
| `SMOKE_BASE_URL=http://127.0.0.1:5196 npm run smoke` | 11/11 đạt qua frontend proxy                                                                         |
| Dev launcher                                         | Khởi động đúng API/web theo cấu hình riêng; gửi SIGINT trực tiếp tới launcher dừng các child process |

E2E dùng API/DB thật; các ca mô phỏng lỗi có sẵn vẫn giữ browser interception
để kiểm chứng hành vi lỗi, không coi response mô phỏng là lỗi backend thực tế.
Giữ các ca Catalog URL/reload/history/detail return, draft/page size/ngôn ngữ,
Q1 identity reset, Q2 multi-tab/revocation/stalled mutations và A2 return/session.

Lượt E2E đầu đạt 19 ca desktop, thất bại 3 ca cuối. Trace xác nhận HTTP 429 tại
availability/book và register do dùng chung ngân sách 300 request/phút. Không
xóa ca hoặc nới rate limit. Launcher `scripts/e2e.mjs` tách full managed suite
thành UI/session, khởi động API mới cho từng nhóm/project; desktop/mobile sau
đó đạt đủ 44 ca. External/custom filtered runs giữ scope và lifecycle đã có.
CI gọi `--project=chromium`/`--project=mobile` cũng dùng cách tách full suite này.

[Tổng hợp số liệu](evidence/tu-integration-20261106/run-summary.json) không chứa
credentials. Log đầy đủ giữ ngoài repository tại
`/workspace/tu-integration-evidence/20261106`, bao gồm lượt thất bại ban đầu.
Lint còn React advisories; không có lint errors. Không coi các cảnh báo này là
lỗi mới đã được sửa trong đợt tích hợp.

Database riêng `bookflow_tu_integration_20261106_test`, Compose project riêng;
DB 5546/API 3146/web 5196 chỉ phục vụ cô lập lần chạy này, không đổi default
dev hoặc profile Mac. Credentials nằm trong env ignored, không có trong báo cáo.

Sau SIGINT, đã xác nhận API/web không còn listener trên 3146/5196. Đây là
kiểm tra signal handler trên Linux, chưa xác nhận thao tác terminal Windows/Mac.

Các số liệu trong bảng là Linux. Sau khi `43456c3` được push, An đã xác nhận
T2; Quân bổ sung kiểm tra Mac nhưng chưa chốt T1/T3 do finding runner bên dưới.
CI `43456c3` đã đạt cả bốn checks; kết quả đó không xác nhận follow-up chưa phát hành.

## Follow-up runner sau review T1/T3

Quân kiểm tra lại `43456c3` trên Mac và phát hiện P2: lệnh
`npm run test:e2e -- --project=chromium --retries=0` không còn chia UI/session,
do runner chỉ nhận diện full suite khi không có cờ hoặc chỉ có cờ project.
Kết quả review Mac là 20 đạt/2 lỗi 429; CI cũ chỉ truyền project nên không
bao phủ trường hợp này. Các lượt chạy thành công trước đó không phủ nhận finding.

Bản sửa phân biệt option thực thi/report với bộ lọc file: hỗ trợ cả `--flag=value`
và giá trị tách rời. Thêm retries/reporter vẫn chạy UI/session trên API mới,
giữ các đối số gốc. File/grep filters và external mode giữ scope đã chọn.
Report project được đặt riêng, tránh lần gọi mobile ghi đè report chromium;
đường dẫn cập nhật trong [DEV_PROFILES](DEV_PROFILES.md).

10 regression kiểm tra launcher bằng subprocess và CLI fixture trong thư mục tạm:
default bốn batch, retries/reporter với/không project, giá trị option tách rời,
report riêng, filtered/external scope và dừng đúng exit code khi batch lỗi.
Đối chứng trên runner `43456c3`: 5 đạt/5 thất bại đúng finding; sau sửa 10/10 đạt.
Đây là test điều phối CLI, không thay thế browser/API/DB tests.

CI được cập nhật chạy chính các lệnh có `--retries=0` và reporter, cùng các
regression mới trong `test:tooling`. Không nới rate limit hoặc đổi assertion UI/API.
Kết quả Linux trên working diff sau sửa:

- `npm run check`: **15 tooling + 133 backend + 143 frontend = 291 tests** đạt;
  lint/typecheck/build/contract/format đạt. 15 tooling gồm 5 ca cấu hình cũ và
  10 ca regression runner mới; không cộng test đối chứng thất bại vào số đạt.
- `npm run test:integration`: **111/111** đạt trên DB test riêng.
- `npm run test:e2e -- --project=chromium --retries=0`: **14 UI + 8 session = 22** đạt.
- `npm run test:e2e -- --project=mobile --retries=0 --reporter=list,html`:
  **14 UI + 8 session = 22** đạt. Hai lượt đều không retry.
- Đã xác nhận đủ bốn HTML report tại các đường dẫn mới trong DEV_PROFILES.

[Tổng hợp follow-up](evidence/tu-integration-20261106/runner-followup.json) ghi
source, lệnh và giới hạn. Log riêng tại `runner-followup/` trong thư mục evidence
local. Bản sửa này chưa có CI/head phát hành; chưa chạy trên Mac/Windows.
Không chạy lại smoke/container/Newman/benchmark cho thay đổi chỉ ở runner này.
Lượt browser mặc định tại `43456c3` ở trên là lịch sử; không đổi thành kết quả
chạy lại mặc định trên diff follow-up. Luồng chia bốn batch mặc định được kiểm
tra bằng regression subprocess mới.
