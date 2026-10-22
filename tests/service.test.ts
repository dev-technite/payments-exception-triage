import { describe, expect, it, vi } from "vitest";
import { createJsonLogger } from "../src/logging";
import { createTriageService } from "../src/service";
import { createInMemoryCaseStore } from "../src/store";

const validInput = {
  reference: "PAY-2026-0001",
  amountCents: 25_000,
  currency: "AUD",
  bsb: "032-001",
  accountNumber: "123456789",
  reasonCode: "INSUFFICIENT_FUNDS",
  direction: "INBOUND",
};

function buildService({ settlementFails = false } = {}) {
  const store = createInMemoryCaseStore();
  const submit = vi.fn(async () => {
    if (settlementFails) {
      throw new Error("settlement unavailable");
    }
  });
  const lines: string[] = [];
  const logger = createJsonLogger((line) => lines.push(line));
  let nextId = 0;
  const service = createTriageService({
    store,
    settlement: { submit },
    logger,
    newId: () => `case-${++nextId}`,
    now: () => new Date("2026-10-22T01:02:03.000Z"),
  });
  const logEntries = () => lines.map((line) => JSON.parse(line));
  return { service, store, submit, lines, logEntries };
}

describe("triage service: happy path", () => {
  it("triages, persists and returns a queued case for insufficient funds", async () => {
    const { service, store } = buildService();

    const result = await service.submit(validInput);

    expect(result).toEqual({
      ok: true,
      case: {
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
        createdAt: "2026-10-22T01:02:03.000Z",
      },
    });
    expect(store.findById("case-1")).toEqual(result.ok ? result.case : undefined);
  });

  it("closes a duplicate payment", async () => {
    const { service } = buildService();

    const result = await service.submit({ ...validInput, reasonCode: "DUPLICATE_PAYMENT" });

    expect(result).toMatchObject({ ok: true, case: { action: "AUTO_CLOSE", status: "CLOSED" } });
  });

  it("sends a high-value insufficient funds case to a human", async () => {
    const { service } = buildService();

    const result = await service.submit({ ...validInput, amountCents: 1_000_000 });

    expect(result).toMatchObject({
      ok: true,
      case: { action: "NEEDS_HUMAN", status: "AWAITING_HUMAN" },
    });
  });

  it("sends an unknown reason to a human instead of closing it", async () => {
    const { service } = buildService();

    const result = await service.submit({ ...validInput, reasonCode: "SOMETHING_NEW" });

    expect(result).toMatchObject({
      ok: true,
      case: { action: "NEEDS_HUMAN", status: "AWAITING_HUMAN" },
    });
  });

  it("tells settlement about every triage decision, without bank details", async () => {
    const { service, submit } = buildService();

    await service.submit(validInput);

    expect(submit).toHaveBeenCalledTimes(1);
    expect(submit).toHaveBeenCalledWith({
      reference: "PAY-2026-0001",
      amountCents: 25_000,
      action: "QUEUE_REVIEW",
    });
  });
});

describe("triage service: masking", () => {
  it("never stores or returns the raw BSB or account number", async () => {
    const { service, store } = buildService();

    const result = await service.submit(validInput);

    const everythingVisible = JSON.stringify([result, store.list()]);
    expect(everythingVisible).not.toContain("032-001");
    expect(everythingVisible).not.toContain("123456789");
  });
});

describe("triage service: settlement down (degrade)", () => {
  it("marks the case DEGRADED instead of successful", async () => {
    const { service } = buildService({ settlementFails: true });

    const result = await service.submit(validInput);

    expect(result).toMatchObject({
      ok: true,
      case: { action: "DEGRADED", status: "DEGRADED" },
    });
  });

  it("still persists the degraded case, with masked details", async () => {
    const { service, store } = buildService({ settlementFails: true });

    await service.submit(validInput);

    expect(store.findById("case-1")).toMatchObject({
      action: "DEGRADED",
      status: "DEGRADED",
      maskedBsb: "***-001",
      maskedAccountNumber: "******789",
    });
  });

  it("does not report an auto-close as closed when settlement is down", async () => {
    const { service } = buildService({ settlementFails: true });

    const result = await service.submit({ ...validInput, reasonCode: "DUPLICATE_PAYMENT" });

    expect(result).toMatchObject({ ok: true, case: { action: "DEGRADED", status: "DEGRADED" } });
  });
});

describe("triage service: invalid input", () => {
  it("returns the validation errors", async () => {
    const { service } = buildService();

    const result = await service.submit({ ...validInput, bsb: "032001", amountCents: 0 });

    expect(result).toEqual({
      ok: false,
      errors: [
        { field: "amountCents", message: "amountCents must be a positive whole number of cents" },
        { field: "bsb", message: "bsb must be in the format XXX-XXX using digits only" },
      ],
    });
  });

  it("neither persists nor settles an invalid exception", async () => {
    const { service, store, submit } = buildService();

    await service.submit({ ...validInput, currency: "USD" });

    expect(store.list()).toEqual([]);
    expect(submit).not.toHaveBeenCalled();
  });
});

describe("triage service: logging", () => {
  it("logs case id, reference and action for a triaged case", async () => {
    const { service, logEntries } = buildService();

    await service.submit(validInput);

    expect(logEntries()).toEqual([
      expect.objectContaining({
        level: "info",
        message: "exception triaged",
        caseId: "case-1",
        reference: "PAY-2026-0001",
        action: "QUEUE_REVIEW",
        status: "QUEUED",
      }),
    ]);
  });

  it("logs a warning with the intended action when the case degrades", async () => {
    const { service, logEntries } = buildService({ settlementFails: true });

    await service.submit(validInput);

    expect(logEntries()).toEqual([
      expect.objectContaining({
        level: "warn",
        message: "settlement unavailable, case degraded",
        caseId: "case-1",
        reference: "PAY-2026-0001",
        action: "DEGRADED",
        intendedAction: "QUEUE_REVIEW",
        status: "DEGRADED",
      }),
    ]);
  });

  it("logs a warning naming the invalid fields when input is rejected", async () => {
    const { service, logEntries } = buildService();

    await service.submit({ ...validInput, bsb: "bad" });

    expect(logEntries()).toEqual([
      expect.objectContaining({
        level: "warn",
        message: "exception rejected",
        invalidFields: ["bsb"],
      }),
    ]);
  });

  it("never writes the raw BSB or account number to the logs", async () => {
    const { service, lines } = buildService();

    await service.submit(validInput);
    await service.submit({ ...validInput, bsb: "032001" });

    const everythingLogged = lines.join("\n");
    expect(everythingLogged).not.toContain("032-001");
    expect(everythingLogged).not.toContain("123456789");
  });
});

describe("triage service: reading cases back", () => {
  it("finds a case by id and returns undefined for an unknown id", async () => {
    const { service } = buildService();
    await service.submit(validInput);

    expect(service.getCase("case-1")).toMatchObject({ id: "case-1", reference: "PAY-2026-0001" });
    expect(service.getCase("missing")).toBeUndefined();
  });

  it("lists cases in the order they were created", async () => {
    const { service } = buildService();
    await service.submit({ ...validInput, reference: "PAY-A" });
    await service.submit({ ...validInput, reference: "PAY-B" });

    expect(service.listCases().map((item) => item.reference)).toEqual(["PAY-A", "PAY-B"]);
  });
});
