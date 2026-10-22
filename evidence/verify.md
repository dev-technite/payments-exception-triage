# Verify

## Checks run

All results below are from running the checks on this repository.

| Check | Command | Result |
|---|---|---|
| Type check (stands in for a `tsc` build) | `npm run typecheck` | passes, no errors |
| Unit and acceptance tests | `npm test` | 122 tests in 10 files, all pass |
| Smoke test: normal run | `./scripts/verify.sh` | 14 checks pass |
| Smoke test: settlement down | `./scripts/verify.sh` | 1 check passes (`DEGRADED`) |
| Whole pipeline | `./scripts/verify.sh` (or `npm run verify`) | `VERIFY PASSED`, exit code 0 |
| Dependency install | `npm install` | 0 vulnerabilities reported |

Tests per file: validation 36, rules 16, service 17, config 15, app 14, sample-data 8, store 6, masking 4, logging 3, settlement 3.

What the tests cover:

- **Guarded paths:** validation reject (422 with field errors), safe abstain (unknown reason goes to `NEEDS_HUMAN`, never `AUTO_CLOSE`), and degrade (settlement failure gives `DEGRADED`, not success).
- **Privacy:** the raw BSB and account number never appear in a response, the store, or the logs.
- **Edges:** the high-value boundary at 999,999, 1,000,000 and 1,000,001 cents; malformed, empty, missing and array bodies; an invalid `PORT`.
- **Sample data:** every file produces its expected action, and `exceptions.jsonl` covers queue, auto-close, high-value and unknown outcomes.

The smoke test starts the real server, posts every file in `sample-data/`, and checks status codes and actions. It exits non-zero on the first failure; I confirmed that by running it against a deliberately wrong expectation.

## Local versus pipeline

| Where | Checks |
|---|---|
| Local, while coding | `npm test`, `npm run typecheck` |
| Local, before pushing | `./scripts/verify.sh` |
| Pull request pipeline | `./scripts/verify.sh` on a clean checkout (not built here) |
| After merge, staging | Build the artifact, deploy, smoke test `/health` and one sample post (not built here) |
| Production | Manual approval, then deploy, with rollback to the previous version (not built here) |

## Known gaps

- No CI pipeline file; `verify.sh` is the command a pipeline would run.
- No lint or formatting step, and no coverage measurement or gate.
- The build is only type checked. The compiled output cannot run directly under `node` because of extensionless imports, so the service runs through `tsx`.
- The smoke test runs on localhost only. There is no load, soak or restart test.
- Settlement is a mock, so there is no contract test against a real settlement system.
- No dependency audit step beyond what `npm install` reports.

## Next steps

Add a pipeline that runs `./scripts/verify.sh` on every pull request, plus lint, coverage and a dependency audit; build a container image; add a staging smoke test; add a contract test when a real settlement client replaces the mock.
