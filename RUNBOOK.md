# Westpac AI Engineering Exercise — Incremental Runbook

Use this document during the **2.5-hour** timed build. Work **one step at a time**: paste a single prompt into your AI coding agent, review the output, run checks, then **commit**. Do not ask the agent to generate the whole solution in one shot.

## Product choice (fixed)

**Payments Exception Triage** — non-AI product, built *with* AI agents.

- Ingest a failed AU-style payment exception
- Validate → deterministic rules → persist → expose status
- Guarded paths: validation reject, safe abstain (`NEEDS_HUMAN`), degrade (`DEGRADED` when mock settlement is down)
- Synthetic data only; no paid APIs, credentials, or Westpac confidential data

## Stack (fixed)

| Layer | Choice |
|-------|--------|
| Runtime | Node.js 20+ |
| Language | TypeScript (strict) |
| HTTP | Fastify |
| Validation | Zod |
| Tests | Vitest (unit + acceptance) |
| Package manager | npm |

Do **not** switch stacks mid-exercise. Prompts below assume this stack.

## Architecture & coding style (non-negotiable)

Enforce these in **every** prompt. If the agent violates them, paste a steering line and redo the slice.

| Principle | What it means here |
|-----------|-------------------|
| **TDD** | Red → green → refactor. Failing test first; minimal code to pass; then tidy. |
| **Clean code** | Names say what the code decides. Small functions. No dead code. No clever one-liners. |
| **Single responsibility** | One reason to change per file: validate, decide, orchestrate, persist, log, or adapt HTTP. Never mix two of those in one module. Types and interfaces are their own concern: they live in `src/types/<module>.types.ts`, not in the file that implements the behaviour. |
| **Modular** | Flat behaviour files in `src/`, plus one `src/types/` folder for types only. Narrow exports. `validation` and `rules` stay pure. `app.ts` only maps HTTP to the service. |
| **Light domain language** | Use clear names (`TriageAction`, `ReasonCode`, `ExceptionCase`). Keep rules and validation **out of** Fastify handlers. Do **not** build hexagonal/DDD folder layers — too heavy for 2.5 hours. |

### Coding guideline (every slice)

- A file changes for one reason. If a change would touch validation and HTTP, it belongs in two files.
- A function name should tell you the decision it makes (`triage`, `validatePaymentException`, `maskBsb`).
- Keep types separate from behaviour, and keep them out of the way. Every exported interface or type lives in the single folder `src/types/`. A module `src/<name>.ts` has its own types in `src/types/<name>.types.ts` (for example `src/types/store.types.ts` holds `CaseStore`). Create a `.types.ts` file in the slice that needs it, not as an empty stub, and only when the module exports a type. Implementation files import types with `import type` from `./types/<name>.types` and export functions only. Files inside `src/types/` import each other as siblings (`./models`). Do not add any other subfolder under `src/`, and do not add a barrel `index.ts`.
- Runtime values never go in `src/types/`. An allowed-values list such as `["INBOUND", "OUTBOUND"]` is a private constant in the module that uses it, typed with `satisfies readonly Direction[]`; the `Direction` type itself lives in `src/types/models.ts`.
- Group each implementation file by visibility, in this order, with one blank line between groups (skip a group that is empty): imports → private constants → private module-level values (such as a Zod schema) → public API (every `export`, kept together) → private helpers (non-exported functions, below the public API that uses them). Nothing exported appears among the private groups, and nothing private appears among the exports. Group by order and blank lines only: do not add marker comments, section banners, or comments that restate the code, so a reviewer sees the practice from the structure alone.
- Shared domain vocabulary that several modules use (`PaymentException`, `ExceptionCase`, `TriageAction`, `CaseAction`, `CaseStatus`, `Direction`) stays in `src/types/models.ts`. Do not put a type there that only one module uses.
- Delete unused code in the same slice. Do not leave a second way to do the same thing.
- Add a known behaviour with a test first. Do not hide a new branch inside an existing function without a failing test.
- Import a sibling module by its file name, with no `.js` or `.ts` suffix. This needs `"module": "ESNext"` and `"moduleResolution": "Bundler"` in `tsconfig.json` (set in Prompt 0), so `tsc` and Vitest both resolve extensionless imports.

### Target modular layout (flat behaviour files + one types folder)

```text
src/
  validation.ts        # Zod + invariants (pure)
  rules.ts             # triage decisions (pure)
  masking.ts           # mask BSB / account number (pure)
  service.ts           # orchestration only
  store.ts             # in-memory case persistence
  settlement.ts        # mock settlement client
  logging.ts           # structured JSON logs
  config.ts            # env/config
  app.ts               # Fastify routes (thin adapters)
  main.ts              # wire + listen
  types/               # types only: no functions, no constants
    models.ts            # shared domain vocabulary
    validation.types.ts  # ValidationError, ValidationResult
    rules.types.ts       # TriageInput
    service.types.ts     # TriageService, TriageServiceDependencies, SubmitResult
    store.types.ts       # CaseStore
    settlement.types.ts  # SettlementClient, SettlementRequest, MockSettlementOptions
    logging.types.ts     # Logger, LogFields
    config.types.ts      # AppConfig (only if config needs a type)
tests/             # unit + acceptance (same folder is fine)
sample-data/
scripts/verify.sh
evidence/
```

Reference shape for any implementation file (`src/validation.ts` is the model). Groups are separated by a blank line and carry no comments:

```ts
import { ... } from "...";

const SOME_LIMIT = 10;

const someSchema = ...;

export function doTheThing(input: unknown): Result { ... }

function smallHelper(...) { ... }
```

Read top to bottom: imports, private constants, private values, public API, private helpers.

**Rule of thumb:** `rules.ts` / `validation.ts` stay pure (no Fastify, no `fs`). `app.ts` only maps HTTP ↔ service. Everything in `src/types/` is types only: no functions, no constants, no runtime code. `src/types/` is the only subfolder of `src/`. Prefer a few clear files over nested `domain/` / `application/` / `infrastructure/` trees.

---

## Ground rules

1. One prompt → one vertical slice → tests green → one commit.
2. Do **not** squash, rewrite, or collapse history before submission.
3. If the agent overbuilds, paste a steering line (see bottom) and force scope cut.
4. You remain accountable for all code and design decisions.
5. Evidence pack comes **last** so `agentic-workflow.md` reflects what you actually did.
6. Prefer extend over redesign; do not merge modules that should stay SRP-separated.
7. Do **not** introduce Nest, Express, or deep hexagonal scaffolding.
8. The agent never commits. It must not run `git commit`, `git commit --amend`, `git reset`, `git rebase`, or `git push`. You review the diff, then commit yourself as soon as the slice's tests pass (optionally one commit at red and one at green for TDD evidence).

## Timebox map

| Step | Minutes | Outcome | Suggested commit message |
|------|---------|---------|--------------------------|
| 0 | 0–10 | Repo scaffold + `intent.md` + README stub | `Scaffold triage exercise repo` |
| 1 | 10–30 | Validation + unit tests (TDD) | `Add input validation with tests` |
| 2 | 30–50 | Rule engine + abstain tests (TDD) | `Add deterministic triage rules` |
| 3 | 50–85 | Service + store + mock settlement + degrade | `Wire service, store, and degrade path` |
| 4 | 85–110 | Fastify API + acceptance tests | `Expose triage HTTP endpoints` |
| 5 | 110–130 | Sample data + `verify` script + README | `Add sample data and verify script` |
| 6 | 130–150 | Evidence pack + README polish | `Complete evidence pack and README` |
| +15 | packaging | Final verify; prepare submission notes | — |

Brief ceiling: ≤3h build + ≤15m packaging. This plan targets 2.5h with a 30m buffer; spend spare time on README and evidence, not new features.

---

## Prompt 0 — Scaffold only (0–10 min)

```text
Create ONLY the scaffold for a Westpac-style AI Engineering interview exercise:
Payments Exception Triage (non-AI product, rules-based).

Git rule (applies to every slice in this session): do NOT run git commit,
git commit --amend, git reset, git rebase, or git push. Leave changes
uncommitted. I will review the diff and commit myself after tests pass.

Stack (fixed):
- Node.js 20+, TypeScript (strict), Fastify, Zod, Vitest, npm

Constraints:
- Empty/minimal repo structure only — no business logic yet
- Flat modular src/ placeholders (empty or stub files OK):
    validation, rules, service, store, settlement, logging, config, app, main
- src/types/models.ts placeholder (types only) in the single src/types/ folder
- tsconfig: strict, "module": "ESNext", "moduleResolution": "Bundler" (so
  extensionless sibling imports work for both tsc and Vitest)
- Include: README stub, .gitignore, package.json + tsconfig + vitest config,
  empty tests/ folder, evidence/intent.md with problem/users/assumptions/
  constraints/out-of-scope/success criteria
- Synthetic AU payments domain; no credentials; no Westpac data
- Do NOT implement validation, rules, API, or tests yet
- Do NOT create nested DDD folders (no domain/application/infrastructure trees)
- Convention for later slices: exported types/interfaces go in
  src/types/<module>.types.ts (not in the implementation file);
  src/types/models.ts holds shared domain types only. src/types/ is the only
  subfolder of src/. Do not create any .types.ts stubs now.

After you finish, list exact files created and stop.
```

**You do:** skim files → `git init` if needed → commit → start timer checkpoint.

---

## Prompt 1 — Validation, TDD (10–30 min)

```text
Next slice ONLY: inbound payment exception validation.

Architecture:
- src/validation.ts — behaviour only, grouped: private constants → private schema → public API → private helpers
- src/types/validation.types.ts — ValidationError, ValidationResult
- src/types/models.ts — shared domain types (PaymentException, Direction)
- The allowed directions list is a private constant in validation.ts, not in src/types/
- tests: write failing tests first, then minimal implementation (TDD)
- SRP: this module only validates shape/invariants; no rules, no store, no Fastify
- Clean code: clear error messages; no god objects

Validate:
- reference non-empty
- amount > 0 (cents)
- currency AUD only
- BSB format XXX-XXX digits
- account number 6–12 digits
- reasonCode + direction (INBOUND|OUTBOUND)

Reject invalid inputs clearly.
Do NOT add rule engine, HTTP, or persistence yet.
Show the failing-then-passing test commands (e.g. npx vitest run).
```

**You do:** run tests → commit.

---

## Prompt 2 — Rules + safe abstain (30–50 min)

```text
Next slice ONLY: deterministic triage rule engine + unit tests (TDD).

Architecture:
- Pure functions in src/rules.ts (no Fastify, no store, no I/O)
- src/types/rules.types.ts — TriageInput; TriageAction goes in src/types/models.ts (shared)
- File grouping per the coding guideline: private constants → public API → private helpers
- SRP: maps reason + amount → TriageAction only
- Clear names: AUTO_CLOSE, QUEUE_REVIEW, NEEDS_HUMAN

Actions:
- DUPLICATE_PAYMENT → AUTO_CLOSE
- INSUFFICIENT_FUNDS → QUEUE_REVIEW
- INSUFFICIENT_FUNDS and amountCents >= 1000000 → NEEDS_HUMAN
- INVALID_ACCOUNT / BANK_UNAVAILABLE → QUEUE_REVIEW
- unknown reason → NEEDS_HUMAN (safe abstain; never AUTO_CLOSE)

Do not change validation behaviour except if tests require tiny fixes.
Do not merge rules into validation.ts.
```

**You do:** run tests → commit.

---

## Prompt 3 — Service + degrade (50–85 min)

```text
Next slice ONLY: orchestration service + store + mock settlement.

Architecture (modular / SRP):
- src/service.ts — orchestrates validate → rules → settlement → persist → log
- src/store.ts — in-memory case store
- src/settlement.ts — mock client with fail flag
- src/logging.ts — structured JSON logs
- src/masking.ts — maskBsb / maskAccountNumber (pure)
- Types in their own files under src/types/, one per module: service.types.ts,
  store.types.ts, settlement.types.ts, logging.types.ts. Shared ExceptionCase,
  CaseAction and CaseStatus go in src/types/models.ts. Implementation files
  export functions only.
- File grouping per the coding guideline in every new file: private constants → public API → private helpers
- Keep rules/validation untouched; service calls them
- Service stays free of Fastify

Add:
- in-memory case store
- mock settlement client with fail flag
- on settlement failure → action DEGRADED, status DEGRADED (not success)
- mask BSB/account before persist
- structured JSON logs (case id, reference, action)

Unit tests (TDD) for happy path + degrade.
No HTTP API yet.
Clean code: small functions; one module per responsibility.
```

**You do:** run tests → commit.

---

## Prompt 4 — Fastify HTTP API (85–110 min)

```text
Next slice ONLY: Fastify HTTP API for the triage service.

Architecture:
- src/app.ts — Fastify app factory + thin routes (HTTP ↔ service only)
- src/main.ts — wire store, settlement, service, app, listen
- src/config.ts — env config: PORT, and SETTLEMENT_FAIL=true to force the mock settlement to fail
- Any exported type (for example AppConfig) goes in src/types/config.types.ts; do not put types in app.ts, main.ts or config.ts
- File grouping per the coding guideline in every new file: private constants → public API → private helpers
- No triage rules inline in route handlers
- Acceptance tests against the Fastify app (inject; avoid real network if possible)

Endpoints:
- GET /health
- POST /exceptions → 201 + case
- GET /exceptions/:id → 200/404
- GET /exceptions (list)

Invalid body → 422.
Acceptance tests for: create/get, validation reject, unknown→NEEDS_HUMAN, settlement fail→DEGRADED.
Keep scope thin; no auth/UI.
```

**You do:** run tests → commit.

---

## Prompt 5 — Sample data + verify (110–130 min)

```text
Next slice ONLY: sample-data/ + scripts/verify.sh (or npm run verify).

Include:
- valid insufficient funds JSON
- valid duplicate JSON
- invalid BSB JSON
- exceptions.jsonl covering queue/auto-close/high-value/unknown
- verify: npm install, run tests, optional tsc build, optional smoke

Update README so a clean checkout can run the core path. Required headings:
- what the solution does
- prerequisites (Node.js 20+, npm)
- setup (`npm install` from the repo root)
- command to run (`npm run dev`) and a health check
- command to run tests (`npm test`) and verify (`./scripts/verify.sh`)
- example workflows with concrete responses, each with a curl command and a
  trimmed JSON response (use sample-data/ for inputs; show how to enable the
  `SETTLEMENT_FAIL=true` flag):
  1) happy path: action, status, masked BSB
  2) safe abstain: unknown reason → NEEDS_HUMAN
  3) validation reject: invalid BSB → 422 with error message
  4) degrade: `SETTLEMENT_FAIL=true` → DEGRADED
- known limitations and next steps; next steps include a short CI/CD path as
  text only (no pipeline files or Dockerfile are built in this exercise): PR runs
  `./scripts/verify.sh` → build artifact (container image in a real pipeline) → deploy to staging with
  smoke test on `/health` → manual approval → production, with rollback to the
  previous version
- where to find the evidence pack (`evidence/`, start at `evidence/intent.md`)

No new product features. Do not reorganize modules unless broken imports block verify.
```

**You do:** run verify → commit.

---

## Prompt 6 — Evidence pack (130–150 min)

```text
Next slice ONLY: concise evidence pack (no code changes unless README links need fixing).

Write:
- evidence/design.md: architecture overview and module map; data flow
  (request → validate → rules → settlement → persist → log → response);
  component boundaries and why rules stay out of Fastify; key trade-offs;
  security/privacy (BSB/account masking, synthetic data only, no credentials);
  technology choices; likely production/cloud shape. No hexagonal essay.
- evidence/agentic-workflow.md: AI agent tool(s) used, how I decomposed the work
  into slices, representative steering prompts, where I intervened, how I
  reviewed generated output and verified TDD (failing test first in history).
- evidence/verify.md: checks run (`npm test`, `./scripts/verify.sh`, tsc build,
  smoke) with actual results; known gaps; which checks run locally versus in a
  PR/pipeline.
- evidence/operate.md: how to run; logs and status (`/health`, JSON logs);
  config env vars and secrets approach (none required locally); failure modes;
  rollback and degrade behaviour; local → CI/CD → cloud considerations
  (PR checks, staging with smoke test, approval gate, production, rollback;
  secrets from a managed secret store, not the repo).
- evidence/decisions.md: 3–5 short ADRs (rules vs ML, abstain over wrong
  auto-close, in-memory store, mock settlement, flat modules vs heavy DDD) plus
  what I intentionally did not build (UI, auth, real settlement, database,
  cloud deploy).
- Known gaps and next steps stated in verify.md and the README.

Keep each file short. Fill agentic-workflow with what I actually did this session.
Representative prompts must be the real one-slice prompts. Do not write one prompt that asks for the whole solution.
Name the stack in this repo only: Node.js, TypeScript, Fastify, Zod, Vitest, in-memory store. Do not mention FastAPI, Pydantic, or SQLite.
```

**You do:** final verify → commit.

---

## Steering lines (paste when the agent overbuilds)

```text
Do not run git commit, git commit --amend, git reset, git rebase, or git push. Leave changes uncommitted. I will review the diff and commit myself after tests pass.
```

```text
Stop. Do not add UI, auth, Docker, cloud deploy, ML, or real bank APIs. This step only.
```

```text
Prefer abstain (NEEDS_HUMAN) over incorrect AUTO_CLOSE. Show that in tests.
```

```text
Commit-sized change only. Summarise files touched and the exact test command.
```

```text
Do not rewrite prior modules unless a test fails. Extend, don't redesign.
```

```text
Keep flat SRP modules: validation, rules, service, store, settlement, app. No nested DDD folders; src/types/ is the only subfolder. Rules stay out of Fastify handlers.
```

```text
Group the file by visibility, separated by blank lines and with no marker comments: imports, then private constants, then private values (such as a schema), then the public API (all exports together), then private helpers below it. No private code among the exports. Behaviour must not change; existing tests stay green.
```

```text
Separate types from behaviour: move exported types/interfaces out of the implementation file into src/types/<module>.types.ts (shared domain types stay in src/types/models.ts; no constants or functions in src/types/). Implementation files export functions only. Behaviour must not change; existing tests stay green.
```

```text
TDD only: show the failing test, then the minimal fix. No implementation without a failing test in this slice.
```

```text
Clean code: rename unclear symbols, split mixed-responsibility files, delete unused code. No new features.
```
