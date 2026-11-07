# Tú — review frontend Q1 và A2

Ngày kiểm tra: **02/11/2026, UTC+7**. Có AI hỗ trợ đọc mã, viết regression,
chạy kiểm thử và tổng hợp bằng chứng. Báo cáo không tự tạo comment/approval GitHub.
Tú vẫn cần đọc, hiểu và chịu trách nhiệm về kết luận review.

## Source được kiểm tra

| Phạm vi                     | Source                                                      | Cách kiểm tra                                                                  |
| --------------------------- | ----------------------------------------------------------- | ------------------------------------------------------------------------------ |
| Frontend/Q1 của Quân, PR #9 | `40eb9143866306725767f3121599e678e3fddc7c`                  | Bản sao source đúng SHA; thêm bộ regression review, không sửa source sản phẩm  |
| A2 của An, PR #10           | `3d0695d4693621f012d053c4824eebebb6c82f4f`                  | Bản sao đúng SHA, dependencies theo lockfile, API và DB test riêng             |
| T1–T3 của Tú, PR #11        | `0eff395c9192e9b2f06d745a4806860bdfcd3afa` cộng diff review | Bộ Q1 cũng được chạy trên nhánh Tú; bằng chứng này chưa phải CI của commit mới |

Môi trường: Linux, Node 24.19.0/npm 11.9.0, PostgreSQL và system Chromium.
Không coi kết quả này là chạy lại trên Windows/Mac. Giữ nguyên các kết quả
Windows trước đây ở [bàn giao T1–T3](TU_QUALITY_HANDOFF.md).

Nhánh Tú ở `0eff395` cộng diff review đã chạy `npm run check` đạt: **5 tooling,
66 server và 104 client tests (175 tổng cộng)**, lint/typecheck/build,
OpenAPI/Postman và formatting. Đây là kết quả local cloud của diff chưa commit,
không phải CI mới trên GitHub.

## Q1: ma trận và hồi quy

`client/tests/catalog-viewer-review.test.tsx` có **16 ca**, đạt trên cả source
#9 và #11. Typecheck client cũng đạt trên cả hai source.

| Nhóm                       | Số ca | Điều đã xác nhận                                                                          |
| -------------------------- | ----- | ----------------------------------------------------------------------------------------- |
| Menu theo role             | 4     | Anonymous, MEMBER, LIBRARIAN và ADMIN chỉ thấy menu tương ứng                             |
| Bộ lọc MEMBER              | 1     | Giữ search/category/sort/page và draft qua EN–VI–EN; không phát request mới               |
| Form thêm sách             | 1     | Giữ title/author/ISBN/category/description qua EN–VI–EN; không submit                     |
| Form sửa/barcode           | 2     | Giữ draft khi đổi ngôn ngữ; xóa draft khi đổi tài khoản hoặc đổi role cùng ID             |
| Hạ quyền xuống MEMBER      | 1     | Không giữ archived results hoặc form tạo sách của staff                                   |
| Đổi librarian rồi quay lại | 1     | Không khôi phục draft của người xem trước                                                 |
| Response đến muộn          | 1     | Abort request archived cũ; response mô phỏng bỏ qua abort vẫn không đưa dữ liệu cũ vào UI |
| Guard URL trực tiếp        | 4     | MEMBER bị chặn ở categories/dashboard/users/audit-logs mà không gọi API được bảo vệ       |
| Back/Forward               | 1     | Chuyển Catalog ↔ chi tiết qua history đúng màn hình và giữ ngôn ngữ                       |

Đối chứng: trên bản sao #9, chỉ đổi key về cách dùng role đã dịch rồi chạy bốn
ca liên quan đổi ngôn ngữ: **4 thất bại, 12 không được chọn**, đúng kỳ vọng.
Sau phép thử, source #9 được phục hồi đúng nội dung ban đầu. Không sửa test
để chấp nhận hành vi mất state.

Browser Q1 đạt **8 tổ hợp**: desktop 1440×1000/mobile 390×844 × EN/VI ×
MEMBER/LIBRARIAN. Chạy giao diện/CSS thật của #9, **HTTP được mock**:

- Có 25 sách giả lập để thật sự chuyển trang với page size 2 của #9.
- Kiểm tra filter/sort/page, form thêm/sửa/barcode và đổi ngôn ngữ hai chiều.
- Không gửi mutation ngoài ý muốn và không refetch chỉ vì đổi ngôn ngữ.
- Skip link nhận focus bằng Tab, Enter chuyển focus vào main; các field/menu
  được thao tác qua accessible name. Không phát hiện tràn ngang ở hai viewport.

Đây là bằng chứng frontend với HTTP mô phỏng, **không phải** kiểm chứng backend
phân quyền, phiên nhiều tab hoặc đánh giá WCAG đầy đủ.

## A2: review toàn bộ luồng UI trên head mới

| Kiểm tra                            | Kết quả                           | Phạm vi                                                                      |
| ----------------------------------- | --------------------------------- | ---------------------------------------------------------------------------- |
| `npm run check` trên #10            | Đạt: 67 server + 101 client tests | Có 30 ca Loans; lint/typecheck/build/contract/format đạt                     |
| `npm run test:integration` trên #10 | 107/107 đạt                       | PostgreSQL thật, schema cô lập trong DB `_test`                              |
| Business-flow E2E có sẵn            | 2/2 đạt                           | Desktop EN và mobile VI, API/DB thật                                         |
| Browser review bổ sung              | 8/8 tổ hợp đạt                    | Desktop/mobile × EN/VI × LIBRARIAN/ADMIN; mỗi tổ hợp đi qua MEMBER rồi staff |

API review dùng 3105, web 5179 và database riêng
`bookflow_tu_review_20261102_test`. Các cổng này chỉ phục vụ cô lập review,
không xác nhận profile Mac. Không reset hay dùng DB phát triển cho lần này.
API review dùng `AUTH_RATE_LIMIT_MAX=100`, cùng ngưỡng test có giới hạn đã dùng
trong cấu hình Playwright; không xác nhận giới hạn mặc định production bằng
ma trận browser này. Giới hạn API 300 request/phút được giữ nguyên.
Các integration tests chỉ xóa schema của suite; fixture browser nằm trong DB
review riêng, không được nhầm với dữ liệu thư viện thật.

Tám tổ hợp browser đã xác nhận:

- MEMBER thấy tên sách/barcode và chi tiết phiếu của mình, không có cột borrower
  hoặc nút xác nhận trả của staff. DTO tạo loan cho MEMBER không chứa borrower.
- LIBRARIAN và ADMIN thấy đúng sách, barcode và tên người mượn ở xác nhận.
- Cancel không gửi PUT. Pending khóa nút xác nhận/hủy.
- Lỗi mạng được mô phỏng bằng abort request; response 200 sai hình dạng được
  mô phỏng bằng interception. Hai ca này giữ xác nhận, hiện lỗi và không tự retry.
  Chúng không phải bằng chứng backend đang trả dữ liệu sai.
- Thông báo response không thể xác minh đổi EN/VI tại chỗ, giữ xác nhận và không
  phát PUT do đổi ngôn ngữ. Sau đó người dùng mới chủ động xác nhận lại.
- Lần trả thành công thực sự chạy API/DB; UI dùng returnedAt/returnedBy của API,
  hiển thị thời gian theo locale và UTC+7, đóng xác nhận đúng lúc.
- Một staff khác gọi PUT trả lặp vẫn nhận thời gian/người xác nhận ban đầu;
  audit chỉ có một loan.returned cho phiếu đó.
- Không phát hiện tràn ngang ở desktop/mobile trong các trạng thái đã kiểm tra.

Phân trang khi trả phiếu cuối và response đến muộn sau đổi người xem được kiểm
tra trong bộ component Loans: cả trường hợp còn 20/0 kết quả và đổi tài khoản
đi rồi quay lại cùng staff. Không coi tám ca browser là thay thế các assertion này.

Bảng Loans trên mobile vẫn dùng vùng cuộn ngang bên trong bảng để xem các cột;
không coi việc trang ngoài không tràn ngang là mọi cột cùng nằm trong viewport.
Ảnh mobile được chụp sau khi thao tác nút trả, nên vùng bảng có thể đang cuộn
sang các cột bên phải; panel xác nhận vẫn có đủ tên sách, barcode và người mượn.

Lần thử harness đầu có selector timestamp trùng với borrowedAt trong cùng phút;
đã sửa harness để đọc đúng field Returned. Một selector label dropdown quá chặt
cũng được sửa; không cần thay source sản phẩm để làm các ca này đạt.

## Kết luận và tích hợp

Chưa phát hiện blocker mới trong phạm vi frontend/Q1 của #9 và A2 của #10 đã
kiểm tra. Các kết luận gắn với SHA ở trên, không phải lời xác nhận toàn bộ sản
phẩm hoặc bản ghép #9 + #10 + #11.

- GitHub CI trên các head này được đối chiếu riêng; test local bổ sung không
  tự trở thành CI của một commit mới chưa push.
- Main tại checkpoint review vẫn là `d3d614f`; #9/#10 chưa merge và #11 là Draft.
- Sau #9 merge, An cập nhật #10: giữ formatter từ `lib/datetime`, guard
  `isLoanReturnResponse`, DTO mới và shared pagination/router imports.
- Sau đó cập nhật nhánh Tú và giải quyết xung đột thực tế. Không merge các PR
  chưa được nhóm chốt vào PR của Tú để vượt trình tự review.
- Q2/Q3, profile Mac trên máy Quân, Windows cho các harness mới, toàn bộ ma trận
  multi-tab và full accessibility audit vẫn ngoài kết luận này.

## Bằng chứng và cách chạy lại

Xem [gói bằng chứng](../evidence/tu-review-20261102/README.md), JSON ma trận và ảnh
giao diện thật. Hướng dẫn có harness browser để nhóm chạy lại trên source đã
chọn. Đối chiếu SHA/DB của stack trước khi chạy; không đưa credentials vào log.

Các kiểm thử không tạo commit, push, comment, approval hoặc merge tự động.
Commit báo cáo là bước phát hành riêng, chỉ được tạo sau khi Tú đồng ý,
với author và committer đúng
danh tính cá nhân của Tú. AI hỗ trợ được ghi công khai trong báo cáo.
