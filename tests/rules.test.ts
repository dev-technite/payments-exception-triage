import { describe, expect, it } from "vitest";
import { triage } from "../src/rules";

const HIGH_VALUE_THRESHOLD_CENTS = 1_000_000;

describe("triage", () => {
  describe("DUPLICATE_PAYMENT", () => {
    it("auto-closes a duplicate payment", () => {
      expect(triage({ reasonCode: "DUPLICATE_PAYMENT", amountCents: 25_000 })).toBe("AUTO_CLOSE");
    });
  });

  describe("INSUFFICIENT_FUNDS", () => {
    it("queues a normal amount for review", () => {
      expect(triage({ reasonCode: "INSUFFICIENT_FUNDS", amountCents: 25_000 })).toBe("QUEUE_REVIEW");
    });

    it("queues an amount just below the high-value threshold for review", () => {
      const amountCents = HIGH_VALUE_THRESHOLD_CENTS - 1;

      expect(triage({ reasonCode: "INSUFFICIENT_FUNDS", amountCents })).toBe("QUEUE_REVIEW");
    });

    it("needs a human at exactly the high-value threshold", () => {
      const amountCents = HIGH_VALUE_THRESHOLD_CENTS;

      expect(triage({ reasonCode: "INSUFFICIENT_FUNDS", amountCents })).toBe("NEEDS_HUMAN");
    });

    it("needs a human above the high-value threshold", () => {
      const amountCents = HIGH_VALUE_THRESHOLD_CENTS + 1;

      expect(triage({ reasonCode: "INSUFFICIENT_FUNDS", amountCents })).toBe("NEEDS_HUMAN");
    });
  });

  describe("INVALID_ACCOUNT and BANK_UNAVAILABLE", () => {
    it.each(["INVALID_ACCOUNT", "BANK_UNAVAILABLE"])("queues %s for review", (reasonCode) => {
      expect(triage({ reasonCode, amountCents: 25_000 })).toBe("QUEUE_REVIEW");
    });

    it.each(["INVALID_ACCOUNT", "BANK_UNAVAILABLE"])(
      "queues %s for review even at a high value",
      (reasonCode) => {
        expect(triage({ reasonCode, amountCents: HIGH_VALUE_THRESHOLD_CENTS })).toBe("QUEUE_REVIEW");
      },
    );
  });

  describe("unknown reason (safe abstain)", () => {
    it.each(["SOMETHING_NEW", "", "duplicate_payment", " DUPLICATE_PAYMENT", "DUPLICATE_PAYMENT "])(
      "needs a human for unknown reason %j",
      (reasonCode) => {
        expect(triage({ reasonCode, amountCents: 25_000 })).toBe("NEEDS_HUMAN");
      },
    );

    it("never auto-closes an unknown reason, whatever the amount", () => {
      const amounts = [1, 25_000, HIGH_VALUE_THRESHOLD_CENTS, 99_999_999];

      for (const amountCents of amounts) {
        expect(triage({ reasonCode: "SOMETHING_NEW", amountCents })).not.toBe("AUTO_CLOSE");
        expect(triage({ reasonCode: "SOMETHING_NEW", amountCents })).toBe("NEEDS_HUMAN");
      }
    });
  });

  describe("determinism", () => {
    it("returns the same action for the same input every time", () => {
      const input = { reasonCode: "INSUFFICIENT_FUNDS", amountCents: 25_000 };

      expect(triage(input)).toBe(triage(input));
    });
  });
});
