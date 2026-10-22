import { describe, expect, it } from "vitest";
import { buildApp } from "../src/app";
import { createJsonLogger } from "../src/logging";
import { createTriageService } from "../src/service";
import { createMockSettlementClient } from "../src/settlement";
import { createInMemoryCaseStore } from "../src/store";

const validBody = {
  reference: "PAY-2026-0001",
  amountCents: 25_000,
  currency: "AUD",
  bsb: "032-001",
  accountNumber: "123456789",
  reasonCode: "INSUFFICIENT_FUNDS",
  direction: "INBOUND",
};

function buildTestApp({ settlementFail = false } = {}) {
  let nextId = 0;
  const service = createTriageService({
    store: createInMemoryCaseStore(),
    settlement: createMockSettlementClient({ fail: settlementFail }),
    logger: createJsonLogger(() => undefined),
    newId: () => `case-${++nextId}`,
    now: () => new Date("2026-10-22T01:02:03.000Z"),
  });
  return buildApp({ service });
}

describe("GET /health", () => {
  it("reports the service is up", async () => {
    const app = buildTestApp();

    const response = await app.inject({ method: "GET", url: "/health" });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({ status: "ok" });
  });
});

describe("POST /exceptions", () => {
  it("creates a triaged case with masked bank details", async () => {
    const app = buildTestApp();

    const response = await app.inject({ method: "POST", url: "/exceptions", payload: validBody });

    expect(response.statusCode).toBe(201);
    expect(response.json()).toEqual({
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
    });
    expect(response.body).not.toContain("032-001");
    expect(response.body).not.toContain("123456789");
  });

  it("sends an unknown reason to a human instead of closing it", async () => {
    const app = buildTestApp();

    const response = await app.inject({
      method: "POST",
      url: "/exceptions",
      payload: { ...validBody, reasonCode: "SOMETHING_NEW" },
    });

    expect(response.statusCode).toBe(201);
    expect(response.json()).toMatchObject({ action: "NEEDS_HUMAN", status: "AWAITING_HUMAN" });
  });

  it("marks the case DEGRADED when settlement is down", async () => {
    const app = buildTestApp({ settlementFail: true });

    const response = await app.inject({ method: "POST", url: "/exceptions", payload: validBody });

    expect(response.statusCode).toBe(201);
    expect(response.json()).toMatchObject({ action: "DEGRADED", status: "DEGRADED" });
  });

  it("rejects an invalid body with 422 and lists the invalid fields", async () => {
    const app = buildTestApp();

    const response = await app.inject({
      method: "POST",
      url: "/exceptions",
      payload: { ...validBody, bsb: "032001", amountCents: 0 },
    });

    expect(response.statusCode).toBe(422);
    expect(response.json()).toEqual({
      errors: [
        { field: "amountCents", message: "amountCents must be a positive whole number of cents" },
        { field: "bsb", message: "bsb must be in the format XXX-XXX using digits only" },
      ],
    });
  });

  it("does not save a rejected exception", async () => {
    const app = buildTestApp();

    await app.inject({ method: "POST", url: "/exceptions", payload: { ...validBody, currency: "USD" } });
    const list = await app.inject({ method: "GET", url: "/exceptions" });

    expect(list.json()).toEqual([]);
  });

  it("rejects malformed JSON with 422", async () => {
    const app = buildTestApp();

    const response = await app.inject({
      method: "POST",
      url: "/exceptions",
      headers: { "content-type": "application/json" },
      payload: "{not json",
    });

    expect(response.statusCode).toBe(422);
    expect(response.json()).toEqual({
      errors: [{ field: "body", message: "body must be valid JSON" }],
    });
  });

  it("rejects an empty JSON body with 422", async () => {
    const app = buildTestApp();

    const response = await app.inject({
      method: "POST",
      url: "/exceptions",
      headers: { "content-type": "application/json" },
      payload: "",
    });

    expect(response.statusCode).toBe(422);
    expect(response.json()).toEqual({
      errors: [{ field: "body", message: "body must be valid JSON" }],
    });
  });

  it("rejects a request with no body with 422", async () => {
    const app = buildTestApp();

    const response = await app.inject({ method: "POST", url: "/exceptions" });

    expect(response.statusCode).toBe(422);
    expect(response.json()).toEqual({
      errors: [{ field: "body", message: "body must be a JSON object" }],
    });
  });

  it("rejects a JSON array body with 422", async () => {
    const app = buildTestApp();

    const response = await app.inject({ method: "POST", url: "/exceptions", payload: [validBody] });

    expect(response.statusCode).toBe(422);
    expect(response.json()).toEqual({
      errors: [{ field: "body", message: "body must be a JSON object" }],
    });
  });
});

describe("GET /exceptions/:id", () => {
  it("returns a created case", async () => {
    const app = buildTestApp();
    const created = await app.inject({ method: "POST", url: "/exceptions", payload: validBody });

    const response = await app.inject({ method: "GET", url: "/exceptions/case-1" });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual(created.json());
  });

  it("returns 404 for an unknown id", async () => {
    const app = buildTestApp();

    const response = await app.inject({ method: "GET", url: "/exceptions/missing" });

    expect(response.statusCode).toBe(404);
    expect(response.json()).toEqual({ error: "case not found" });
  });
});

describe("GET /exceptions", () => {
  it("returns an empty list when nothing has been created", async () => {
    const app = buildTestApp();

    const response = await app.inject({ method: "GET", url: "/exceptions" });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual([]);
  });

  it("lists cases in the order they were created", async () => {
    const app = buildTestApp();
    await app.inject({ method: "POST", url: "/exceptions", payload: { ...validBody, reference: "PAY-A" } });
    await app.inject({ method: "POST", url: "/exceptions", payload: { ...validBody, reference: "PAY-B" } });

    const response = await app.inject({ method: "GET", url: "/exceptions" });

    expect(response.statusCode).toBe(200);
    expect(response.json().map((item: { reference: string }) => item.reference)).toEqual(["PAY-A", "PAY-B"]);
  });
});
