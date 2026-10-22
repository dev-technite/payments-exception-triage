# Agentic workflow

## Tool

Cursor, using its agent mode (Claude) as the only implementation tool. The agent wrote the code and tests; I set the scope, reviewed every diff, ran the checks, and made every commit.

## How the work was decomposed

Before writing code I wrote `RUNBOOK.md`: seven one-slice prompts (0 to 6), each with its architecture rules, a time window, and a stop point. I then gave the agent one slice at a time. No prompt asks for the whole solution.

| Slice | What it added |
|---|---|
| 0 | Scaffold only: config, empty module stubs, `evidence/intent.md` |
| 1 | Validation, test first |
| 2 | Triage rules and safe abstain, test first |
| 3 | Service, store, mock settlement, masking, logging, degrade path, test first |
| 4 | Fastify API and environment config, test first |
| 5 | Sample data, `verify.sh`, README |
| 6 | This evidence pack |

## Representative prompts

Every slice was started with the same short instruction, which points at that slice's prompt in the runbook:

```text
Read RUNBOOK.md and execute Prompt 2 only. Follow the ground rules and the text of the prompt exactly. Do not start Prompt 3. Do not commit.
```

The slice prompts themselves are in `RUNBOOK.md`. Two examples, shortened:

```text
Next slice ONLY: deterministic triage rule engine + unit tests (TDD).
- Pure functions in src/rules.ts (no Fastify, no store, no I/O)
- INSUFFICIENT_FUNDS and amountCents >= 1000000 -> NEEDS_HUMAN
- unknown reason -> NEEDS_HUMAN (safe abstain; never AUTO_CLOSE)
Do not merge rules into validation.ts.
```

```text
Next slice ONLY: Fastify HTTP API for the triage service.
- src/app.ts: thin routes (HTTP <-> service only); no triage rules in handlers
- Acceptance tests against the app (inject; no real network)
Invalid body -> 422. Keep scope thin; no auth/UI.
```

Steering I gave during the session, in my own words:

- "Don't auto commit. After review I will commit." This became a ground rule.
- "Can we separate the types and interfaces from the core file to make it single responsibility?" This led to `src/types/`.
- "Group non-exported, public and exported code so a reviewer sees the practice." Then: "You don't need to comment it. Just group." Files are grouped by order and blank lines, with no marker comments.

## Where I intervened

- **Brief check.** I compared the runbook with the exercise brief and added the missing evidence-pack contents, the example workflows, and a CI/CD note. A review of the runbook also caught that extensionless imports need `moduleResolution: Bundler`.
- **Commits.** The agent never committed. I read each diff, then committed one slice at a time with a conventional message.
- **Structure.** I asked for types to move into one folder. While doing it, the agent found that `models.ts` held a runtime constant, which broke the "types only" rule, and moved it into `validation.ts`.
- **Agent errors that checks caught:**
  - Two edits to `models.ts` ran at once and one was lost. Vitest still passed, because it does not type check, but `npm run typecheck` failed and the type was restored.
  - The compiled output did not run under `node` (`ERR_MODULE_NOT_FOUND`, because of extensionless imports). `start` now runs through `tsx` and the unusable `build` script was removed.
## How output was reviewed and TDD verified

- For slices 1 to 5, the tests were written and run first, and failed for the right reason before any implementation existed:

| Slice | Red run | Green run |
|---|---|---|
| 1 Validation | 36 of 36 failed | 36 passed |
| 2 Rules | 16 of 16 failed | 52 total passed |
| 3 Service | 29 failed, plus one test file that could not load its module | 85 total passed |
| 4 API and config | 29 of 29 failed | 114 total passed |
| 5 Sample data | 8 of 8 failed (files missing) | 122 total passed |

- **Limit of this evidence.** Each commit holds the tests and the code that makes them pass. The red run is shown by the session output above, not by a separate red commit in the history.
- After each slice I ran the tests and typecheck, read the diff, and checked the scope (no files from later slices). For the API and the verify script I also ran the real server and checked the responses by hand.

## Commit timeline (2026-10-22)

| Commit | Time | Slice |
|---|---|---|
| `33d3881` | 11:32 | Runbook |
| `5398d66` | 11:40 | 0 Scaffold |
| `5fb72ed` | 11:46 | 1 Validation |
| `7131df5` | 11:49 | 2 Rules |
| `8556188` | 12:03 | 3 Service |
| `07b5a68` | 12:07 | 4 API |
| `ce25d7b` | 12:11 | 5 Sample data, verify, README |
