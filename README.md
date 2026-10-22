# Payments Exception Triage

## What the solution does

A small HTTP service that triages failed AU-style payment exceptions. It uses synthetic data only.

For each exception posted to the API it:

1. validates the input (shape, amount in cents, AUD only, BSB `XXX-XXX`, account number 6–12 digits);
2. applies deterministic rules to choose an action;
3. tells a mock settlement client about the decision;
4. masks the BSB and account number, stores the case in memory, and logs the outcome as JSON.

| Situation | Action | Status |
|---|---|---|
| Duplicate payment | `AUTO_CLOSE` | `CLOSED` |
| Insufficient funds, invalid account, bank unavailable | `QUEUE_REVIEW` | `QUEUED` |
| Insufficient funds of 1,000,000 cents (AUD 10,000) or more | `NEEDS_HUMAN` | `AWAITING_HUMAN` |
| Unknown reason code (safe abstain, never auto-closed) | `NEEDS_HUMAN` | `AWAITING_HUMAN` |
| Settlement client is down | `DEGRADED` | `DEGRADED` |
| Invalid input | rejected with HTTP 422 | not stored |

## Prerequisites

- Node.js 20 or later
- npm

## Setup

From the repository root:

```bash
npm install
```

## Run

```bash
npm run dev
```

The server listens on `127.0.0.1:3000`. Check it is up:

```bash
curl http://127.0.0.1:3000/health
# {"status":"ok"}
```

| Variable | Default | Meaning |
|---|---|---|
| `PORT` | `3000` | Port to listen on (1–65535) |
| `SETTLEMENT_FAIL` | unset | Set to `true` to make the mock settlement client fail, which degrades cases |

Endpoints: `GET /health`, `POST /exceptions`, `GET /exceptions`, `GET /exceptions/:id`.

## Test and verify

```bash
npm test               # unit and acceptance tests
./scripts/verify.sh    # install, type check, tests, and a smoke test against the real server
```

`./scripts/verify.sh` (also `npm run verify`) is the command a CI pipeline would run. The smoke test starts the server on a free port, posts every file in `sample-data/`, checks the actions and HTTP status codes, then restarts it with `SETTLEMENT_FAIL=true` to check the degrade path. It exits non-zero on the first failed check.

## Example workflows

Start the server with `npm run dev` in one terminal and run these in another. Responses are trimmed: `id`, `reference`, `amountCents`, `currency`, `reasonCode`, `direction` and `createdAt` are omitted.

**1. Happy path: queued for review, bank details masked**

```bash
curl -s -X POST http://127.0.0.1:3000/exceptions \
  -H 'content-type: application/json' \
  -d @sample-data/insufficient-funds.json
```

```json
{
  "maskedBsb": "***-001",
  "maskedAccountNumber": "******789",
  "action": "QUEUE_REVIEW",
  "status": "QUEUED"
}
```

HTTP 201. The raw BSB (`032-001`) and account number never appear in the response, the store, or the logs.

**2. Safe abstain: unknown reason goes to a human**

```bash
curl -s -X POST http://127.0.0.1:3000/exceptions \
  -H 'content-type: application/json' \
  -d @sample-data/unknown-reason.json
```

```json
{
  "maskedBsb": "***-100",
  "maskedAccountNumber": "*****234",
  "action": "NEEDS_HUMAN",
  "status": "AWAITING_HUMAN"
}
```

HTTP 201. An unknown `reasonCode` is never auto-closed.

**3. Validation reject: invalid BSB**

```bash
curl -s -X POST http://127.0.0.1:3000/exceptions \
  -H 'content-type: application/json' \
  -d @sample-data/invalid-bsb.json
```

```json
{
  "errors": [
    { "field": "bsb", "message": "bsb must be in the format XXX-XXX using digits only" }
  ]
}
```

HTTP 422. Nothing is stored or sent to settlement.

**4. Degrade: settlement is down**

Stop the server, then start it with the failure flag:

```bash
SETTLEMENT_FAIL=true npm run dev
```

```bash
curl -s -X POST http://127.0.0.1:3000/exceptions \
  -H 'content-type: application/json' \
  -d @sample-data/insufficient-funds.json
```

```json
{
  "maskedBsb": "***-001",
  "maskedAccountNumber": "******789",
  "action": "DEGRADED",
  "status": "DEGRADED"
}
```

HTTP 201. The case is stored and marked `DEGRADED` rather than reported as a success. The log line records the action the rules chose (`intendedAction`).

`sample-data/exceptions.jsonl` holds one exception per line covering queue, auto-close, high-value and unknown outcomes.

## Known limitations and next steps

Known limitations:

- Cases are kept in memory and are lost when the server restarts.
- Settlement is a mock. Every valid case is sent to it, so any case can degrade when it is down.
- A degraded case stores only `DEGRADED`; the action the rules chose is in the log, not in the case.
- Reason codes are matched exactly. A lowercase or padded value is treated as unknown and goes to a human.
- No authentication, and the server listens on localhost only.
- `GET /exceptions` returns every case with no paging.
- `npm start` runs the TypeScript through `tsx`. The source uses extensionless imports, so the `tsc` output cannot be run directly with `node`; a real deployment would bundle it.

Next steps:

- Replace the in-memory store with a database.
- Put a real settlement client behind the existing interface, with retries and a way to reprocess `DEGRADED` cases.
- Add authentication, metrics and alerting on the `DEGRADED` rate.
- CI/CD path (described only; no pipeline files or Dockerfile are built in this exercise): a pull request runs `./scripts/verify.sh`, then a build artifact is produced (a container image in a real pipeline), deployed to staging with a smoke test on `/health`, promoted to production after a manual approval, with rollback to the previous version.

## Evidence pack

See [`evidence/`](evidence/), starting at [`evidence/intent.md`](evidence/intent.md).
