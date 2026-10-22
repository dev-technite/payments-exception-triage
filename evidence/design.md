# Design

## Architecture overview

A single Node.js process exposes a small HTTP API (Fastify). The API passes each request to one orchestration service. The service validates the input, applies pure rules, notifies a mock settlement client, stores a masked case in memory, and logs the outcome. Nothing else is involved: no database, no queue, no external call.

## Module map

Behaviour files sit flat in `src/`. All exported types live in one folder, `src/types/`.

| Module | Responsibility | Pure? |
|---|---|---|
| `validation.ts` | Zod schema and field checks; returns `ok` or a list of field errors | yes |
| `rules.ts` | `triage(reasonCode, amountCents)` returns `AUTO_CLOSE`, `QUEUE_REVIEW` or `NEEDS_HUMAN` | yes |
| `masking.ts` | Masks the BSB and account number | yes |
| `service.ts` | Orchestrates validate, rules, settlement, persist, log | no |
| `store.ts` | In-memory case store (returns copies) | no |
| `settlement.ts` | Mock settlement client with a fail flag | no |
| `logging.ts` | One JSON log line per event | no |
| `config.ts` | Reads `PORT` and `SETTLEMENT_FAIL` | no |
| `app.ts` | Fastify routes; maps HTTP to service calls and results to status codes | no |
| `main.ts` | Wires the parts together and listens | no |
| `types/` | Shared domain types (`models.ts`) and one `<module>.types.ts` per module | types only |

## Data flow

```text
POST /exceptions
  -> app.ts            (parse JSON; bad JSON -> 422)
  -> service.submit
       -> validation   (invalid -> 422 with field errors; nothing stored)
       -> rules        (reason + amount -> action)
       -> settlement   (failure -> action DEGRADED)
       -> masking + store.save
       -> logging
  <- 201 + case        (masked BSB and account number only)
```

## Boundaries: why rules stay out of Fastify

`rules.ts` and `validation.ts` take plain values and return plain values. They import no Fastify, no store, and do no I/O, so they are tested with ordinary unit tests and can be reused behind any transport. `app.ts` only turns HTTP into a service call and the result into a status code. A change to a triage rule touches one file and one test file, and cannot break routing.

## Key trade-offs

- **Rules over a model.** Fixed rules are explainable and testable line by line. They cannot learn, and new reason codes need a code change.
- **Unknown means a human.** An unrecognised reason goes to `NEEDS_HUMAN` instead of being rejected or closed, so validation accepts any non-empty reason and the rules abstain.
- **Settlement is called for every valid case.** Simple and uniform, but any case can degrade when settlement is down.
- **A degraded case keeps only `DEGRADED`.** The action the rules chose is in the log, not in the stored case.
- **In-memory store.** No setup, but data is lost on restart.

## Security and privacy

- Synthetic data only. No Westpac, customer or staff data.
- The BSB and account number are masked (`***-001`, `******789`) before the case is stored. The raw values never reach the store, the response, or the logs, and settlement receives only the reference, amount and action. Tests assert this.
- No credentials, secrets or paid services are needed.
- The server listens on `127.0.0.1` only. There is no authentication; it is a local slice.
- Input is validated before use; malformed or non-object bodies return 422.

## Technology choices

Node.js 20+ and TypeScript (strict) for one language end to end. Fastify for a small, fast HTTP layer with `inject` for tests without a network. Zod for one schema that validates and types the input. Vitest for fast unit and acceptance tests. npm as the only package manager. The store is a plain in-memory `Map`.

## Likely production and cloud shape

The same modules, with the edges swapped: a containerised service behind an authenticated gateway; a managed database behind the existing `CaseStore` interface; a real settlement client behind `SettlementClient`, with retries and a way to reprocess `DEGRADED` cases; secrets from a managed secret store; JSON logs shipped to a central log service, with alerts on the `DEGRADED` rate; a liveness check on `/health`. The pure rules and validation move unchanged.
