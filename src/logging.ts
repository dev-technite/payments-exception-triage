import type { LogFields, Logger } from "./types/logging.types";

type LogLevel = "info" | "warn";

export function createJsonLogger(write: (line: string) => void = console.log): Logger {
  function log(level: LogLevel, message: string, fields: LogFields = {}): void {
    const entry = { level, message, timestamp: new Date().toISOString(), ...fields };
    write(JSON.stringify(entry));
  }

  return {
    info: (message, fields) => log("info", message, fields),
    warn: (message, fields) => log("warn", message, fields),
  };
}
