import { describe, expect, it } from "vitest";
import { createMockSettlementClient } from "../src/settlement";

const request = { reference: "PAY-2026-0001", amountCents: 25_000, action: "QUEUE_REVIEW" } as const;

describe("mock settlement client", () => {
  it("accepts a request by default", async () => {
    const settlement = createMockSettlementClient();

    await expect(settlement.submit(request)).resolves.toBeUndefined();
  });

  it("accepts a request when the fail flag is off", async () => {
    const settlement = createMockSettlementClient({ fail: false });

    await expect(settlement.submit(request)).resolves.toBeUndefined();
  });

  it("rejects every request when the fail flag is on", async () => {
    const settlement = createMockSettlementClient({ fail: true });

    await expect(settlement.submit(request)).rejects.toThrow("settlement unavailable");
    await expect(settlement.submit(request)).rejects.toThrow("settlement unavailable");
  });
});
