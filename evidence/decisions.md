# Decisions

Short records of the choices that shape this slice.

## 1. Deterministic rules, not a model

- **Context:** each failure reason maps to a known handling path, and a wrong automatic closure is costly.
- **Decision:** a pure function maps reason and amount to an action.
- **Consequences:** every outcome is explainable and unit tested. The rules cannot learn from data, and a new reason code needs a code change.

## 2. Abstain to a human instead of closing wrongly

- **Context:** a new or malformed reason code could be mistaken for something safe to close.
- **Decision:** only an exact match on `DUPLICATE_PAYMENT` auto-closes. Anything unknown goes to `NEEDS_HUMAN`, as does insufficient funds of 1,000,000 cents or more. Validation accepts any non-empty reason so the rules can abstain.
- **Consequences:** more cases reach a person, but none are closed wrongly. A lowercase `duplicate_payment` is treated as unknown.

## 3. In-memory store

- **Context:** the exercise must run locally with no setup.
- **Decision:** a `Map` behind a small `CaseStore` interface, returning copies so callers cannot change stored cases.
- **Consequences:** no setup and fast tests. Data is lost on restart, and swapping in a database touches only `store.ts` and its interface.

## 4. Mock settlement with a failure flag

- **Context:** the degrade path must be demonstrable without a real downstream system.
- **Decision:** a mock client behind a `SettlementClient` interface. `SETTLEMENT_FAIL=true` makes it fail. When it fails, the case is stored as `DEGRADED`, not as a success. Every valid case is sent to settlement.
- **Consequences:** the failure path is tested and demoable. A degraded case stores only `DEGRADED`; the chosen action is only in the log. Any case can degrade.

## 5. Flat modules with one types folder, not layered DDD

- **Context:** a small slice built in a short time, where each file should have one reason to change.
- **Decision:** behaviour files stay flat in `src/`. Every exported type lives in `src/types/`, and a file in `src/` exports functions only. There are no domain, application or infrastructure layers.
- **Consequences:** a short file list that is easy to navigate and review. It would need layers if it grew into a larger system.

## What I intentionally did not build

- A UI.
- Authentication and authorisation.
- A real settlement integration, and automatic retry of degraded cases.
- A database.
- A CI pipeline file, a container image, or any cloud deployment (the path is described in `operate.md`).
- Machine learning.
- Paging on the list endpoint.
