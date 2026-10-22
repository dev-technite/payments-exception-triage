# Intent

## Problem

Failed payments (for example insufficient funds, duplicate payment, invalid
account, bank unavailable) arrive as exceptions that operations staff must
sort. Manual sorting is slow and inconsistent, and a wrong automatic closure of
a payment that needed attention is costly. The service ingests a failed
AU-style payment exception, validates it, applies deterministic rules to decide
what happens next, stores the case, and exposes its status.

## Intended users

- Payments operations analysts who work the exception queue.
- Engineers and assessors who run and review this slice locally.

## Assumptions

- All data is synthetic. No customer, staff, or Westpac data is used.
- Amounts are integer cents in AUD. BSBs use the `XXX-XXX` format.
- Reason codes are a small known set. Anything outside it is treated as unknown.
- Settlement is a mock client; a real settlement system is out of reach here.
- State lives in memory and is lost on restart.

## Constraints

- Local run only, no paid APIs, no credentials, no cloud deployment.
- Stack: Node.js 20+, TypeScript (strict), Fastify, Zod, Vitest, npm.
- Flat modules with one responsibility each; no nested DDD layers.
- Built in small, reviewed, incremental commits.

## Out of scope

- UI, authentication and authorisation.
- Real bank or settlement integrations.
- Persistent database.
- Machine learning or any AI in the product itself.
- Cloud deployment and CI/CD pipeline files (described, not built).

## Success criteria

- A valid exception posted to the API returns a case with a triage action and
  status, with BSB and account number masked.
- Invalid input is rejected with a clear error (HTTP 422).
- An unknown reason code is never auto-closed; it goes to `NEEDS_HUMAN`.
- When mock settlement fails, the case is marked `DEGRADED`, not successful.
- One command runs the tests and checks (`./scripts/verify.sh`), and a clean
  checkout can run the core path from the README.
