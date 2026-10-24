# Đo hiệu năng catalog

Kết quả gốc: [`evidence/benchmark.json`](evidence/benchmark.json), ghi
`2026-10-21T14:00:28.653Z` (21:00 ngày 21/10/2026 tại UTC+7). Phép đo chạy trên bản ghép
Auth + backend Catalog thật của Tú + Loans. Không dùng số của bản Catalog tham
chiếu cũ để đại diện cho backend hiện tại.

## Điều kiện đo

- Dataset tổng hợp: **1.000 books, 3.000 copies, 10.000 historical loans**.
- 500 request đo, 20 client đồng thời,
  20 request warm-up; DB pool tối đa 10.
- Xen kẽ `GET /api/v1/books` phân trang/sort và search `q=Benchmark Book`.
- Node v24.19.0, Linux x64/kernel 6.18.55; CPU host báo AMD EPYC 9V74 80-Core Processor,
  5 logical CPU, availableParallelism 4.
  Host memory được báo khoảng 33,29 GiB; không phải quota CPU/RAM độc quyền.
- Server HTTP loopback tạm và PostgreSQL trên cùng cloud host; dataset được tạo
  trực tiếp bằng SQL và `ANALYZE`, tài khoản fixture bị DISABLED.
- Runner dùng hạn mức HTTP riêng cho phép đo đọc; không đo tác động rate limit
  của ứng dụng demo và không thay cấu hình server đang phục vụ người dùng.

## Kết quả thật

| Chỉ số                        | Kết quả                             |
| ----------------------------- | ----------------------------------- |
| p50                           | 43,67 ms                            |
| p95                           | 73,94 ms                            |
| p99                           | 143,35 ms                           |
| Thời gian phần đo             | 1.184,09 ms                         |
| Throughput quan sát           | 422,27 request/giây                 |
| HTTP 200                      | 500/500                             |
| Lỗi request                   | 0; tỷ lệ 0%                         |
| CPU process trong phần đo     | 774.095 µs user + 235.104 µs system |
| RSS process tại thời điểm ghi | 157.880.320 byte, khoảng 150,57 MiB |

Mục tiêu đọc catalog p95 < 500 ms ở 20 concurrency và không lỗi request đạt trong
phép đo này. Workload ngắn, dữ liệu tổng hợp và HTTP loopback không chứng minh
hiệu năng production, login Argon2id, loan writes hoặc tải kéo dài. Đây cũng
không phải thực nghiệm so sánh REST/GraphQL/SOAP hoặc đo độ trễ Internet/Nginx.

## Chạy lại

Sau khi cài dependencies và config theo README:

```bash
npm run build
npm run db:test:create
npm run benchmark
```

Runner chỉ chấp nhận `TEST_DATABASE_URL` có tên DB kết thúc `_test`, tạo schema
ngẫu nhiên `benchmark_*`, migrate/seed fixture, mở HTTP server tạm và xóa schema
của nó trong `finally`. Không reset public/dev. Kết quả mới ghi đè
`docs/evidence/benchmark.json`; giữ bản cũ nếu cần đối chiếu trước/sau.

Có thể đặt `BENCHMARK_REQUESTS` (1–10.000), `BENCHMARK_CONCURRENCY` (1–100) và
`BENCHMARK_OUTPUT` trong môi trường process để đổi budget/output. Ghi rõ thay đổi
cùng kết quả; không thay số đo bằng mục tiêu hoặc loại lỗi khỏi báo cáo.
`processMemoryBytes` là snapshot sau đo, không phải peak. CPU process được đo
riêng, không bao gồm toàn bộ CPU/RAM PostgreSQL hoặc cả máy.
