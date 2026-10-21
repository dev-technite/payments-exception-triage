# Westpac AI Engineering Exercise — Incremental Runbook

Use this document during the **3-hour** timed build. Work **one step at a time**: paste a single prompt into your AI coding agent, review the output, run checks, then **commit**. Do not ask the agent to generate the whole solution in one shot.

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
| **Single responsibility** | One reason to change per file: validate, decide, orchestrate, persist, log, or adapt HTTP. Never mix two of those in one module. |
| **Modular** | Flat files, narrow exports. `validation` and `rules` stay pure. `app.ts` only maps HTTP to the service. |
| **Light domain language** | Use clear names (`TriageAction`, `ReasonCode`, `ExceptionCase`). Keep rules and validation **out of** Fastify handlers. Do **not** build hexagonal/DDD folder layers — too heavy for 3 hours. |

### Coding guideline (every slice)

- A file changes for one reason. If a change would touch validation and HTTP, it belongs in two files.
- A function name should tell you the decision it makes (`triage`, `validatePaymentException`, `maskBsb`).
- Delete unused code in the same slice. Do not leave a second way to do the same thing.
- Add a known behaviour with a test first. Do not hide a new branch inside an existing function without a failing test.

### Target modular layout (flat, SRP modules)

```text
src/
  models.ts        # types / domain vocabulary
  validation.ts    # Zod + invariants (pure)
  rules.ts         # triage decisions (pure)
  service.ts       # orchestration only
  store.ts         # case persistence
  settlement.ts    # mock settlement client
  logging.ts       # structured JSON logs
  config.ts        # env/config
  app.ts           # Fastify routes (thin adapters)
  main.ts          # wire + listen
tests/             # unit + acceptance (same folder is fine)
sample-data/
scripts/verify.sh
evidence/
```

**Rule of thumb:** `rules.ts` / `validation.ts` stay pure (no Fastify, no `fs`). `app.ts` only maps HTTP ↔ service. Prefer a few clear files over nested `domain/` / `application/` / `infrastructure/` trees.

---

## Ground rules

1. One prompt → one vertical slice → tests green → one commit.
2. Do **not** squash, rewrite, or collapse history before submission.
3. If the agent overbuilds, paste a steering line (see bottom) and force scope cut.
4. You remain accountable for all code and design decisions.
5. Evidence pack comes **last** so `agentic-workflow.md` reflects what you actually did.
6. Prefer extend over redesign; do not merge modules that should stay SRP-separated.
7. Do **not** introduce Nest, Express, or deep hexagonal scaffolding.

## Timebox map

| Step | Minutes | Outcome | Suggested commit message |
|------|---------|---------|--------------------------|
| 0 | 0–15 | Repo scaffold + `intent.md` + README stub | `Scaffold triage exercise repo` |
| 1 | 15–45 | Validation + unit tests (TDD) | `Add input validation with tests` |
| 2 | 45–75 | Rule engine + abstain tests (TDD) | `Add deterministic triage rules` |
| 3 | 75–120 | Service + store + mock settlement + degrade | `Wire service, store, and degrade path` |
| 4 | 120–150 | Fastify API + acceptance tests | `Expose triage HTTP endpoints` |
| 5 | 150–165 | Sample data + `verify` script | `Add sample data and verify script` |
| 6 | 165–180 | Evidence pack + README polish | `Complete evidence pack and README` |
| +15 | packaging | Final verify; prepare submission notes | — |

---

## Target repo layout (end state)

```text
README.md
package.json
tsconfig.json
vitest.config.ts
src/
  models.ts
  validation.ts
  rules.ts
  service.ts
  store.ts
  settlement.ts
  logging.ts
  config.ts
  app.ts
  main.ts
tests/
sample-data/
scripts/verify.sh
evidence/
  intent.md
  design.md
  agentic-workflow.md
  verify.md
  operate.md
  decisions.md
```

---

## Prompt 0 — Scaffold only (0–15 min)

```text
Create ONLY the scaffold for a Westpac-style AI Engineering interview exercise:
Payments Exception Triage (non-AI product, rules-based).

Stack (fixed):
- Node.js 20+, TypeScript (strict), Fastify, Zod, Vitest, npm

Constraints:
- Empty/minimal repo structure only — no business logic yet
- Flat modular src/ placeholders (empty or stub files OK):
    models, validation, rules, service, store, settlement, logging, config, app, main
- Include: README stub, .gitignore, package.json + tsconfig + vitest config,
  empty tests/ folder, evidence/intent.md with problem/users/assumptions/
  constraints/out-of-scope/success criteria
- Synthetic AU payments domain; no credentials; no Westpac data
- Do NOT implement validation, rules, API, or tests yet
- Do NOT create nested DDD folders (no domain/application/infrastructure trees)

After you finish, list exact files created and stop.
```

**You do:** skim files → `git init` if needed → commit → start timer checkpoint.

---

## Prompt 1 — Validation, TDD (15–45 min)

```text
Next slice ONLY: inbound payment exception validation.

Architecture:
- src/validation.ts (+ types in models.ts as needed)
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

## Prompt 2 — Rules + safe abstain (45–75 min)

```text
Next slice ONLY: deterministic triage rule engine + unit tests (TDD).

Architecture:
- Pure functions in src/rules.ts (no Fastify, no store, no I/O)
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

## Prompt 3 — Service + degrade (75–120 min)

```text
Next slice ONLY: orchestration service + store + mock settlement.

Architecture (modular / SRP):
- src/service.ts — orchestrates validate → rules → settlement → persist → log
- src/store.ts — in-memory case store
- src/settlement.ts — mock client with fail flag
- src/logging.ts — structured JSON logs
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

## Prompt 4 — Fastify HTTP API (120–150 min)

```text
Next slice ONLY: Fastify HTTP API for the triage service.

Architecture:
- src/app.ts — Fastify app factory + thin routes (HTTP ↔ service only)
- src/main.ts — wire store, settlement, service, app, listen
- src/config.ts — port / flags from env
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

## Prompt 5 — Sample data + verify (150–165 min)

```text
Next slice ONLY: sample-data/ + scripts/verify.sh (or npm run verify).

Include:
- valid insufficient funds JSON
- valid duplicate JSON
- invalid BSB JSON
- exceptions.jsonl covering queue/auto-close/high-value/unknown
- verify: npm install, run tests, optional tsc build, optional smoke

Update README with exact setup/run/verify commands for Node/Fastify.
No new product features. Do not reorganize modules unless broken imports block verify.
```

**You do:** run verify → commit.

---

## Prompt 6 — Evidence pack (165–180 min)

```text
Next slice ONLY: concise evidence pack (no code changes unless README links need fixing).

Write:
- evidence/design.md (module map + why rules stay out of Fastify; keep it short — no hexagonal essay)
- evidence/agentic-workflow.md (tools, decomposition, example prompts, where I intervened, how I verified TDD)
- evidence/verify.md
- evidence/operate.md (config env vars, failure modes, local→CI/CD→cloud)
- evidence/decisions.md (3–5 ADRs: rules vs ML, abstain, in-memory, mock settlement, flat modules vs heavy DDD)

Keep each file short. Fill agentic-workflow with what I actually did this session.
```

**You do:** final verify → commit.

---

## Steering lines (paste when the agent overbuilds)

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
Keep flat SRP modules: validation, rules, service, store, settlement, app. No nested DDD folders. Rules stay out of Fastify handlers.
```

```text
TDD only: show the failing test, then the minimal fix. No implementation without a failing test in this slice.
```

```text
Clean code: rename unclear symbols, split mixed-responsibility files, delete unused code. No new features.
```

---

## README checklist (must be true by end of Prompt 6)

- [ ] What the solution does
- [ ] Prerequisites (Node 20+, npm)
- [ ] Setup instructions
- [ ] Command to run the solution (Fastify)
- [ ] Command to run tests / verify
- [ ] One example input/output or workflow
- [ ] Known limitations
- [ ] Where to find the evidence pack
- [ ] Brief note on modular files (validation / rules / service / app)

---

## Submission checklist (exercise brief)

- [ ] ≤ ~3 hours building (+ ≤15 min packaging)
- [ ] Public repo (when you publish) with **incremental** commits
- [ ] Core path runs locally; no private/paid/Westpac credentials
- [ ] One meaningful end-to-end workflow
- [ ] Verify command/script
- [ ] Tests / acceptance checks (TDD evidence in history)
- [ ] Flat modular structure with clear SRP boundaries
- [ ] At least one guarded failure / reject / degrade / abstain path
- [ ] Logs / config / operate notes
- [ ] Evidence pack complete
- [ ] Known gaps and next steps stated

## What to submit

1. Public repository link  
2. Setup notes beyond README (if any)  
3. Approximate time spent  
4. AI coding agent tool(s) used  

---

## Interview talking points (prepare while packaging)

- Why rules over ML for this slice
- Why abstain beats wrong auto-close
- Why flat SRP modules beat heavy DDD folders for a 3-hour slice
- How you verified agent output (TDD, manual review)
- Local → CI (`verify`) → container → staging → prod with approvals
- What you would add with more time (auth, Postgres, real settlement seam, metrics)

---

## Notes

- Sibling reference implementations may exist under other folders; **do not copy them during the timed exercise** if you need authentic incremental history.
- This folder (`final-assignment`) intentionally contains **only this runbook** until you start Prompt 0 in a fresh git repo (here or elsewhere).
- Stack is **Node.js + TypeScript + Fastify + Zod + Vitest** — do not introduce Express, Nest, or Python in this run.
