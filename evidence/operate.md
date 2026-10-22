# Operate

## How to run

```bash
npm install
npm run dev        # watch mode on 127.0.0.1:3000
npm start          # run once, no watch
./scripts/verify.sh
```

Status check: `curl http://127.0.0.1:3000/health` returns `{"status":"ok"}`. It reports that the process is up. It does not check settlement.

## Logs

One JSON object per line on standard output, with `level`, `message`, `timestamp` and event fields. Events:

| Message | Level | Fields |
|---|---|---|
| `server listening` | info | `host`, `port`, `settlementFail` |
| `exception triaged` | info | `caseId`, `reference`, `action`, `status` |
| `settlement unavailable, case degraded` | warn | `caseId`, `reference`, `action`, `status`, `intendedAction` |
| `exception rejected` | warn | `invalidFields` |
| `startup failed` | error (stderr) | `reason` |

The raw BSB and account number are never logged. Fastify's own request log is off, so these lines are the single log source.

## Config and secrets

| Variable | Default | Meaning |
|---|---|---|
| `PORT` | `3000` | Port to listen on, a whole number from 1 to 65535 |
| `SETTLEMENT_FAIL` | unset | `true` makes the mock settlement fail every call |

No secrets, credentials or paid services are needed locally. In a deployed environment, secrets would come from a managed secret store and be injected as environment variables; none are kept in the repository.

## Failure modes

| What goes wrong | What happens | What to do |
|---|---|---|
| Invalid input | HTTP 422 with field errors; nothing stored or sent to settlement | Fix the request |
| Malformed or empty JSON body | HTTP 422 `body must be valid JSON` | Fix the request |
| Unknown reason code | Case goes to `NEEDS_HUMAN` | A person reviews it |
| Settlement down | HTTP 201, case stored as `DEGRADED`, warning logged with `intendedAction` | Alert on the warning; reprocess once settlement is back (manual today) |
| Invalid `PORT` | Process logs `startup failed` and exits with code 1 | Fix the variable |
| Port already in use | Startup fails the same way, exit code 1 | Free the port or change `PORT` |
| Process restarts | All cases are lost (in-memory store) | Accepted for this slice |
| Very large body | Fastify's default size limit rejects it | None needed |

## Rollback and degrade

- **Degrade:** a settlement outage does not fail requests. Cases are still triaged and stored, but marked `DEGRADED` so nobody mistakes them for success. Nothing retries them automatically.
- **Rollback:** redeploy the previous artifact. With the in-memory store a rollback also clears state, which is why a database is the first next step.

## Local to CI/CD to cloud

1. **Local:** `npm test` while coding, `./scripts/verify.sh` before pushing.
2. **Pull request:** a pipeline runs `./scripts/verify.sh` on a clean checkout and blocks the merge on failure.
3. **Build:** produce one artifact per commit (a container image in a cloud setup).
4. **Staging:** deploy the artifact, smoke test `/health` and one sample post.
5. **Approval gate:** a person approves promotion.
6. **Production:** deploy the same artifact; roll back to the previous one if the smoke test or the `DEGRADED` rate looks wrong.

Cloud shape: a container behind an authenticated gateway, a managed database, a real settlement client, secrets from a managed store, JSON logs sent to a central service, and an alert on the `DEGRADED` rate. The server currently binds to `127.0.0.1`; a container would need a configurable host. None of the pipeline or container pieces are built in this exercise.
