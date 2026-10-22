import { describe, expect, it } from "vitest";
import type { ExceptionCase } from "../src/types/models";
import { createInMemoryCaseStore } from "../src/store";

function buildCase(overrides: Partial<ExceptionCase> = {}): ExceptionCase {
  return {
    id: "case-1",
    reference: "PAY-2026-0001",
    amountCents: 25_000,
    currency: "AUD",
    maskedBsb: "***-001",
    maskedAccountNumber: "******789",
    reasonCode: "INSUFFICIENT_FUNDS",
    direction: "INBOUND",
    action: "QUEUE_REVIEW",
    status: "QUEUED",
    createdAt: "2026-10-22T00:00:00.000Z",
    ...overrides,
  };
}

describe("in-memory case store", () => {
  it("returns a saved case by id", () => {
    const store = createInMemoryCaseStore();
    const saved = buildCase();

    store.save(saved);

    expect(store.findById("case-1")).toEqual(saved);
  });

  it("returns undefined for an unknown id", () => {
    const store = createInMemoryCaseStore();

    expect(store.findById("missing")).toBeUndefined();
  });

  it("lists cases in the order they were saved", () => {
    const store = createInMemoryCaseStore();

    store.save(buildCase({ id: "case-1" }));
    store.save(buildCase({ id: "case-2" }));
    store.save(buildCase({ id: "case-3" }));

    expect(store.list().map((item) => item.id)).toEqual(["case-1", "case-2", "case-3"]);
  });

  it("starts empty", () => {
    const store = createInMemoryCaseStore();

    expect(store.list()).toEqual([]);
  });

  it("replaces a case saved again under the same id", () => {
    const store = createInMemoryCaseStore();

    store.save(buildCase({ id: "case-1", status: "QUEUED" }));
    store.save(buildCase({ id: "case-1", status: "CLOSED" }));

    expect(store.list()).toHaveLength(1);
    expect(store.findById("case-1")?.status).toBe("CLOSED");
  });

  it("is not changed by edits to a case the caller still holds", () => {
    const store = createInMemoryCaseStore();
    const saved = buildCase();
    store.save(saved);

    saved.status = "CLOSED";

    expect(store.findById("case-1")?.status).toBe("QUEUED");
  });
});
