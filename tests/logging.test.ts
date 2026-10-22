import { describe, expect, it } from "vitest";
import { createJsonLogger } from "../src/logging";

function captureLogger() {
  const lines: string[] = [];
  const logger = createJsonLogger((line) => lines.push(line));
  return { logger, lines };
}

describe("JSON logger", () => {
  it("writes one JSON line with level, message, timestamp and the given fields", () => {
    const { logger, lines } = captureLogger();

    logger.info("exception triaged", { caseId: "case-1", reference: "PAY-1", action: "QUEUE_REVIEW" });

    expect(lines).toHaveLength(1);
    const entry = JSON.parse(lines[0] as string);
    expect(entry).toMatchObject({
      level: "info",
      message: "exception triaged",
      caseId: "case-1",
      reference: "PAY-1",
      action: "QUEUE_REVIEW",
    });
    expect(typeof entry.timestamp).toBe("string");
  });

  it("writes warnings at the warn level", () => {
    const { logger, lines } = captureLogger();

    logger.warn("settlement unavailable");

    expect(JSON.parse(lines[0] as string)).toMatchObject({
      level: "warn",
      message: "settlement unavailable",
    });
  });

  it("works without extra fields", () => {
    const { logger, lines } = captureLogger();

    logger.info("started");

    expect(JSON.parse(lines[0] as string)).toMatchObject({ level: "info", message: "started" });
  });
});
