import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { createJsonLogger } from "../src/logging";
import { createTriageService } from "../src/service";
import { createMockSettlementClient } from "../src/settlement";
import { createInMemoryCaseStore } from "../src/store";

const KNOWN_REASON_CODES = ["DUPLICATE_PAYMENT", "INSUFFICIENT_FUNDS", "INVALID_ACCOUNT", "BANK_UNAVAILABLE"];
const HIGH_VALUE_THRESHOLD_CENTS = 1_000_000;

function readSample(fileName: string): string {
  return readFileSync(new URL(`../sample-data/${fileName}`, import.meta.url), "utf8");
}

function readJsonSample(fileName: string): unknown {
  return JSON.parse(readSample(fileName));
}

function readJsonLines(fileName: string): Record<string, unknown>[] {
  return readSample(fileName)
    .split("\n")
    .filter((line) => line.trim() !== "")
    .map((line) => JSON.parse(line));
}

function buildService() {
  return createTriageService({
    store: createInMemoryCaseStore(),
    settlement: createMockSettlementClient(),
    logger: createJsonLogger(() => undefined),
  });
}

describe("sample data: single exceptions", () => {
  it("insufficient-funds.json is queued for review", async () => {
    const result = await buildService().submit(readJsonSample("insufficient-funds.json"));

    expect(result).toMatchObject({ ok: true, case: { action: "QUEUE_REVIEW", status: "QUEUED" } });
  });

  it("duplicate-payment.json is auto-closed", async () => {
    const result = await buildService().submit(readJsonSample("duplicate-payment.json"));

    expect(result).toMatchObject({ ok: true, case: { action: "AUTO_CLOSE", status: "CLOSED" } });
  });

  it("unknown-reason.json is sent to a human, never auto-closed", async () => {
    const result = await buildService().submit(readJsonSample("unknown-reason.json"));

    expect(result).toMatchObject({ ok: true, case: { action: "NEEDS_HUMAN", status: "AWAITING_HUMAN" } });
  });

  it("invalid-bsb.json is rejected on the bsb field only", async () => {
    const result = await buildService().submit(readJsonSample("invalid-bsb.json"));

    expect(result).toEqual({
      ok: false,
      errors: [{ field: "bsb", message: "bsb must be in the format XXX-XXX using digits only" }],
    });
  });
});

describe("sample data: exceptions.jsonl", () => {
  it("has one valid JSON exception per line, each with a unique reference", () => {
    const exceptions = readJsonLines("exceptions.jsonl");
    const references = exceptions.map((exception) => exception.reference);

    expect(exceptions.length).toBeGreaterThanOrEqual(6);
    expect(new Set(references).size).toBe(references.length);
  });

  it("is accepted in full when replayed through the service", async () => {
    const service = buildService();

    for (const exception of readJsonLines("exceptions.jsonl")) {
      const result = await service.submit(exception);
      expect(result.ok, `rejected ${String(exception.reference)}`).toBe(true);
    }

    expect(service.listCases()).toHaveLength(readJsonLines("exceptions.jsonl").length);
  });

  it("covers queue, auto-close, high-value and unknown outcomes", async () => {
    const service = buildService();
    for (const exception of readJsonLines("exceptions.jsonl")) {
      await service.submit(exception);
    }
    const cases = service.listCases();

    const queued = cases.filter((item) => item.action === "QUEUE_REVIEW");
    const autoClosed = cases.filter((item) => item.action === "AUTO_CLOSE");
    const highValue = cases.filter(
      (item) =>
        item.action === "NEEDS_HUMAN" &&
        item.reasonCode === "INSUFFICIENT_FUNDS" &&
        item.amountCents >= HIGH_VALUE_THRESHOLD_CENTS,
    );
    const unknown = cases.filter(
      (item) => item.action === "NEEDS_HUMAN" && !KNOWN_REASON_CODES.includes(item.reasonCode),
    );

    expect(queued.length).toBeGreaterThan(0);
    expect(autoClosed.length).toBeGreaterThan(0);
    expect(highValue.length).toBeGreaterThan(0);
    expect(unknown.length).toBeGreaterThan(0);
  });

  it("never auto-closes anything with an unknown reason code", async () => {
    const service = buildService();
    for (const exception of readJsonLines("exceptions.jsonl")) {
      await service.submit(exception);
    }

    const wronglyClosed = service
      .listCases()
      .filter((item) => item.action === "AUTO_CLOSE" && item.reasonCode !== "DUPLICATE_PAYMENT");

    expect(wronglyClosed).toEqual([]);
  });
});
