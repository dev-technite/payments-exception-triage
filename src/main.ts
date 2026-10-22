import { buildApp } from "./app";
import { loadConfig } from "./config";
import { createJsonLogger } from "./logging";
import { createTriageService } from "./service";
import { createMockSettlementClient } from "./settlement";
import { createInMemoryCaseStore } from "./store";

const LISTEN_HOST = "127.0.0.1";

start().catch((error: unknown) => {
  const reason = error instanceof Error ? error.message : String(error);
  console.error(JSON.stringify({ level: "error", message: "startup failed", reason }));
  process.exit(1);
});

async function start(): Promise<void> {
  const config = loadConfig();
  const logger = createJsonLogger();
  const service = createTriageService({
    store: createInMemoryCaseStore(),
    settlement: createMockSettlementClient({ fail: config.settlementFail }),
    logger,
  });
  const app = buildApp({ service });

  await app.listen({ port: config.port, host: LISTEN_HOST });
  logger.info("server listening", {
    host: LISTEN_HOST,
    port: config.port,
    settlementFail: config.settlementFail,
  });
}
