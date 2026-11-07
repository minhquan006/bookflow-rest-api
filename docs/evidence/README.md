# Validation evidence

Evidence is organized by execution date, source baseline and environment. Moving
or summarizing a record does not constitute a new test run. Use
[source validation](../SOURCE_FINALIZATION.md) for the integrated application and
[the archive](../archive/README.md) for earlier review narratives.

| Artifact                                                                                     | Scope                                                                                |
| -------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------ |
| [source-finalization-20261107.json](source-finalization-20261107.json)                       | Final application validation summary and hashes of changed implementation/test files |
| [tu-integration-20261106/run-summary.json](tu-integration-20261106/run-summary.json)         | Integrated #11 validation                                                            |
| [tu-integration-20261106/runner-followup.json](tu-integration-20261106/runner-followup.json) | E2E runner argument regression follow-up                                             |
| [tu-review-20261102](tu-review-20261102/README.md)                                           | Q1/A2 browser review, screenshots and reproduction harnesses                         |
| [loans-v2-validation.json](loans-v2-validation.json)                                         | Earlier circulation validation                                                       |
| [loans-v2-benchmark.json](loans-v2-benchmark.json)                                           | Earlier circulation measurements                                                     |
| [validation.json](validation.json)                                                           | Initial integrated validation summary                                                |
| [postman.json](postman.json)                                                                 | Historical Docker/Nginx Newman run: 20 requests, 33 assertions                       |
| [benchmark.json](benchmark.json)                                                             | Historical local catalog benchmark                                                   |

The top-level catalog screenshots and the initial validation/Postman/benchmark
records date from 21 October 2026. The `loans-v2-*` images and records belong to
the later circulation review. Captures use synthetic data; mobile screenshots
use Chromium device emulation rather than a physical iPhone/Safari session.

[Catalog review notes](CATALOG_VALIDATION.md) and
[review fixes](CATALOG_REVIEW_FIX.md) describe their original source context.
Earlier combined results are in [full validation](../archive/FULL_VALIDATION.md).
Do not use these records to claim a new production deployment, another member's
machine, or CI status for an untested commit.

Keep evidence free of passwords, tokens, cookies and personal-data dumps. Store
private logs and local configuration outside Git. Reproduction scripts can create
synthetic application data; read their prerequisites before running them.
