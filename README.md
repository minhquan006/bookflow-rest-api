> **Catalog update on `feat/catalog`:** Public category/book listing and the
> Catalog browsing UI are implemented. See [Catalog status](docs/CATALOG_STATUS.md)
> for verified behavior and remaining work. The foundation descriptions below
> predate this increment; full Catalog CRUD is not implemented yet.

# BookFlow

Ná»n táº£ng cho há»‡ thá»‘ng thÆ° viá»‡n RESTful â€” Web Programming & Applications (503073).
React/TypeScript + Express/TypeScript + PostgreSQL; kiáº¿n trĂºc monolith chia module.

ÄĂ£ cĂ³ cáº¥u hĂ¬nh, database schema/migration/seed, middleware, HTTP client, khung giao diá»‡n,
OpenAPI, kiá»ƒm thá»­, Docker vĂ  CI. **ÄÄƒng nháº­p, CRUD, mÆ°á»£nâ€“tráº£, dashboard vĂ  audit viewer
chÆ°a Ä‘Æ°á»£c triá»ƒn khai.** CĂ¡c má»¥c nĂ y lĂ  pháº§n phĂ¡t triá»ƒn tiáº¿p theo cá»§a nhĂ³m; xem
[bĂ n giao](docs/TEAM_HANDOFF.md) vĂ  [blueprint](docs/PROJECT_BLUEPRINT.md).

## Báº¯t Ä‘áº§u trĂªn mĂ¡y phĂ¡t triá»ƒn

YĂªu cáº§u: Node **24.19.0** (xem `.nvmrc`), npm 11, Docker Engine/Desktop cĂ³ Compose v2.
CĂ³ thá»ƒ dĂ¹ng PostgreSQL 17 cĂ³ sáºµn thay Docker; chá»‰nh hai URL database trong `.env` vĂ 
`server/.env` cho nháº¥t quĂ¡n. CĂ¡c lá»‡nh dÆ°á»›i cháº¡y tá»« thÆ° má»¥c gá»‘c repository.

```bash
npm ci
npm run deps
npm run setup
# Chá»‰ khá»Ÿi Ä‘á»™ng database; khĂ´ng xĂ³a volume Ä‘Ă£ cĂ³.
docker compose up -d --wait db
npm --prefix server run build
npm run db:migrate
npm run db:seed
npm run db:test:create
npm run dev
```

`npm run setup` táº¡o `.env`, `server/.env`, `client/.env.local` náº¿u chÆ°a cĂ³, vá»›i khĂ³a JWT,
máº­t kháº©u DB vĂ  máº­t kháº©u seed ngáº«u nhiĂªn. Cháº¡y láº¡i giá»¯ nguyĂªn file Ä‘Ă£ cĂ³. Náº¿u sá»­a cáº¥u hĂ¬nh,
Ä‘á»“ng bá»™ root `.env` vĂ  `server/.env`, rá»“i restart á»©ng dá»¥ng. KhĂ´ng dĂ¹ng secret trong biáº¿n `VITE_*`.
Náº¿u volume DB Ä‘Ă£ tá»“n táº¡i, giá»¯ máº­t kháº©u tÆ°Æ¡ng á»©ng; Ä‘á»•i file `.env` khĂ´ng Ä‘á»•i máº­t kháº©u trong DB.

Giao diá»‡n dev dĂ¹ng cá»•ng **5173**, API **3000**. Vite proxy `/api` sang API, nĂªn giá»¯ API trĂªn
3000 trá»« khi Ä‘á»“ng thá»i cáº­p nháº­t proxy. `Ctrl+C` dá»«ng hai process dev; database tiáº¿p tá»¥c cháº¡y.
Cháº¡y riĂªng báº±ng `npm --prefix server run dev` vĂ  `npm --prefix client run dev`.

CĂ¡c lá»‡nh npm vĂ  Compose dĂ¹ng Ä‘Æ°á»£c trĂªn PowerShell/CMD; khĂ´ng cáº§n `cp`, `export` hoáº·c
`source .env`. `nvm use` lĂ  tĂ¹y chá»n náº¿u Ä‘Ă£ cĂ i nvm; trĂªn Windows cĂ³ thá»ƒ chá»n Node 24.19.0
qua trĂ¬nh quáº£n lĂ½ phiĂªn báº£n tÆ°Æ¡ng á»©ng.

## Cháº¡y toĂ n bá»™ báº±ng Docker

```bash
npm run setup
docker compose up -d --wait db
docker compose build api web
docker compose run --rm api npm run db:migrate
docker compose run --rm api npm run db:seed
docker compose up -d --wait api web
docker compose ps
npm run smoke
```

Web dĂ¹ng cá»•ng **8080**, Nginx phá»¥c vá»¥ React vĂ  proxy API/docs/health. API vĂ  Nginx cháº¡y
báº±ng user khĂ´ng pháº£i root; API khĂ´ng má»Ÿ cá»•ng ra host. DB chá»‰ bind loopback 5432 Ä‘á»ƒ dĂ¹ng
khi phĂ¡t triá»ƒn. Compose nĂ y phá»¥c vá»¥ demo local; API Ä‘áº·t `NODE_ENV=development` Ä‘á»ƒ cho phĂ©p
seed. Khi triá»ƒn khai tháº­t cáº§n cáº¥u hĂ¬nh production/HTTPS riĂªng vĂ  khĂ´ng dĂ¹ng tĂ i khoáº£n demo.

Dá»«ng báº±ng `docker compose down`, dá»¯ liá»‡u Ä‘Æ°á»£c giá»¯ trong volume. **`down -v` xĂ³a dá»¯ liá»‡u**,
khĂ´ng pháº£i bÆ°á»›c cĂ i Ä‘áº·t hay khá»Ÿi Ä‘á»™ng bĂ¬nh thÆ°á»ng. Sau khi Ä‘á»•i source, build láº¡i image
vĂ  cháº¡y láº¡i bÆ°á»›c migrate trÆ°á»›c khi `up` dá»‹ch vá»¥ API/web.

Trong mĂ´i trÆ°á»ng cloud/cĂ´ng ty cĂ³ proxy CA, dĂ¹ng `npm run compose -- build api web`
thay cho lá»‡nh build trá»±c tiáº¿p. Wrapper dĂ¹ng CA Ä‘Æ°á»£c mĂ´i trÆ°á»ng cung cáº¥p qua
`NODE_EXTRA_CA_CERTS`/`SSL_CERT_FILE` lĂ m BuildKit secret, khĂ´ng Ä‘Æ°a CA hoáº·c credential vĂ o
image; TLS váº«n Ä‘Æ°á»£c xĂ¡c minh. Wrapper cÅ©ng Ä‘áº·t cache Buildx trong thÆ° má»¥c ghi Ä‘Æ°á»£c.

## XĂ¡c minh vĂ  kiá»ƒm thá»­

```bash
npm run check
npm run test:integration
npm run test:e2e
# Khi toĂ n bá»™ stack Docker Ä‘Ă£ cháº¡y:
npm run smoke
```

`check` cháº¡y lint, typecheck, build, unit/HTTP/component tests, kiá»ƒm tra OpenAPI vĂ  Prettier.
Integration test cáº§n `TEST_DATABASE_URL` tá»›i DB cĂ³ tĂªn káº¿t thĂºc `_test`; `npm run db:test:create`
táº¡o DB náº¿u chÆ°a tá»“n táº¡i. Suite tá»± dĂ¹ng schema ngáº«u nhiĂªn riĂªng vĂ  chá»‰ xĂ³a schema cá»§a nĂ³;
khĂ´ng reset dá»¯ liá»‡u dev. Kiá»ƒm tra khĂ³a/rĂ ng buá»™c dĂ¹ng PostgreSQL tháº­t.

Playwright dĂ¹ng Chromium cĂ³ sáºµn táº¡i `/usr/bin/chromium` náº¿u cĂ³; náº¿u khĂ´ng, cháº¡y
`npx playwright install chromium` trÆ°á»›c (Linux CI cĂ³ thá»ƒ cáº§n `--with-deps`). CĂ³ thá»ƒ Ä‘áº·t
`PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH` Ä‘á»ƒ chá»n báº£n Chromium Ä‘Ă£ cĂ i. Browser tests kiá»ƒm tra
káº¿t ná»‘i tháº­t, lá»—i/phá»¥c há»“i vĂ  kĂ­ch thÆ°á»›c desktop/mobile; chÆ°a kiá»ƒm tra luá»“ng nghiá»‡p vá»¥.

Kiá»ƒm tra HTTP ná»n táº£ng:

| Endpoint            | Káº¿t quáº£                                                     |
| ------------------- | --------------------------------------------------------------- |
| `GET /health/live`  | 200: process sá»‘ng                                             |
| `GET /health/ready` | 200: DB vĂ  migration hiá»‡n táº¡i sáºµn sĂ ng; lá»—i tráº£ 503 |
| `GET /api/v1`       | 200: thĂ´ng tin dá»‹ch vá»¥                                     |
| `GET /docs/`        | Swagger UI                                                      |
| `GET /openapi.yaml` | Há»£p Ä‘á»“ng OpenAPI 3.1                                       |

Trong dev, health/docs dĂ¹ng cá»•ng API 3000; frontend chá»‰ proxy `/api`. Trong Docker, toĂ n bá»™
qua cá»•ng web 8080. Import `postman/BookFlow.postman_collection.json` vĂ  local environment,
Ä‘áº·t `baseUrl` theo cá»•ng Ä‘ang dĂ¹ng. Collection `BookFlow.planned...` chá»‰ lĂ  vĂ­ dá»¥ nghiá»‡p vá»¥
Ä‘á»ƒ nhĂ³m triá»ƒn khai, chÆ°a pháº£i test Ä‘Ă£ pass.

Seed cĂ³ ba tĂ i khoáº£n local: `admin@bookflow.test`, `librarian@bookflow.test`,
`member@bookflow.test`. Máº­t kháº©u lĂ  `SEED_DEMO_PASSWORD` trong file `.env` local; khĂ´ng in
vĂ o log hoáº·c commit. Seed khĂ´ng ghi Ä‘Ă¨ máº­t kháº©u/role/tĂ i khoáº£n hiá»‡n há»¯u. ChÆ°a cĂ³ endpoint
login Ä‘á»ƒ sá»­ dá»¥ng tĂ i khoáº£n nĂ y tá»« giao diá»‡n.

## Cáº¥u trĂºc vĂ  quy Æ°á»›c

- `server/src/config`, `middleware`, `shared`: config, JWT/Argon2id, lá»—i, validation, log vĂ  quyá»n.
- `server/src/db`, `server/migrations`: pool/transaction, migration vĂ  seed.
- `client/src/lib`, `components`: HTTP client, cĂ¡c Ä‘iá»u khiá»ƒn vĂ  tráº¡ng thĂ¡i chung.
- `docs/openapi.yaml`: há»£p Ä‘á»“ng nghiá»‡p vá»¥ Ä‘Ă£ chá»‘t; cĂ¡c operation cĂ³ tráº¡ng thĂ¡i triá»ƒn khai.
- `deploy`, `compose.yaml`: cĂ¡ch cháº¡y demo; `.github/workflows/ci.yml`: quality vĂ  container jobs.
- `docs/TEAM_HANDOFF.md`: viá»‡c tiáº¿p theo cho QuĂ¢n, TĂº vĂ  An.

Xem [CONTRIBUTING](CONTRIBUTING.md) trÆ°á»›c khi má»Ÿ PR. Module backend má»›i Ä‘Æ°á»£c táº¡o khi
báº¯t Ä‘áº§u triá»ƒn khai; `createApp` nháº­n `apiRouter` Ä‘á»ƒ ghĂ©p route dÆ°á»›i `/api/v1`, khĂ´ng táº¡o
file placeholder rá»—ng. Schema Ä‘Ă£ cĂ³ báº£ng refresh token nhÆ°ng refresh rotation/CSRF váº«n
lĂ  tĂ¡c vá»¥ cá»§a module Auth. Háº¡n má»©c, khĂ³a hĂ ng user/book/copy, ownership vĂ  admin cuá»‘i cĂ¹ng
pháº£i Ä‘Æ°á»£c triá»ƒn khai trong service; constraint DB khĂ´ng thay tháº¿ cĂ¡c quy táº¯c nĂ y.

CI Ä‘Æ°á»£c lÆ°u trong repository; viá»‡c cháº¡y trĂªn GitHub cáº§n push/PR. Branch protection cáº§n
quáº£n trá»‹ repository báº­t theo [hÆ°á»›ng dáº«n Ä‘Ă³ng gĂ³p](CONTRIBUTING.md). Báº±ng chá»©ng kiá»ƒm tra
trong mĂ´i trÆ°á»ng hiá»‡n táº¡i náº±m á»Ÿ [FOUNDATION_VALIDATION](docs/FOUNDATION_VALIDATION.md).
