import type { AppConfig, Environment } from "./types/config.types";

const DEFAULT_PORT = 3000;
const MIN_PORT = 1;
const MAX_PORT = 65535;
const PORT_MESSAGE = `PORT must be a whole number between ${MIN_PORT} and ${MAX_PORT}`;

export function loadConfig(env: Environment = process.env): AppConfig {
  return {
    port: parsePort(env.PORT),
    settlementFail: env.SETTLEMENT_FAIL === "true",
  };
}

function parsePort(rawPort: string | undefined): number {
  if (rawPort === undefined) {
    return DEFAULT_PORT;
  }
  if (!/^\d+$/.test(rawPort)) {
    throw new Error(PORT_MESSAGE);
  }

  const port = Number(rawPort);
  if (port < MIN_PORT || port > MAX_PORT) {
    throw new Error(PORT_MESSAGE);
  }
  return port;
}
