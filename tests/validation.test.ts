import { describe, expect, it } from "vitest";
import { validatePaymentException } from "../src/validation";

const validInput = {
  reference: "PAY-2026-0001",
  amountCents: 25000,
  currency: "AUD",
  bsb: "032-001",
  accountNumber: "123456789",
  reasonCode: "INSUFFICIENT_FUNDS",
  direction: "INBOUND",
};

function fieldsRejectedFor(input: unknown): string[] {
  const result = validatePaymentException(input);
  if (result.ok) {
    throw new Error("expected validation to reject the input");
  }
  return result.errors.map((error) => error.field);
}

describe("validatePaymentException", () => {
  describe("valid input", () => {
    it("accepts a well-formed exception and returns it unchanged", () => {
      const result = validatePaymentException(validInput);

      expect(result).toEqual({ ok: true, value: validInput });
    });

    it("accepts OUTBOUND direction", () => {
      const result = validatePaymentException({ ...validInput, direction: "OUTBOUND" });

      expect(result.ok).toBe(true);
    });

    it("accepts the shortest and longest account numbers (6 and 12 digits)", () => {
      expect(validatePaymentException({ ...validInput, accountNumber: "123456" }).ok).toBe(true);
      expect(validatePaymentException({ ...validInput, accountNumber: "123456789012" }).ok).toBe(true);
    });

    it("accepts a reason code the rules do not know yet, so rules can abstain on it", () => {
      const result = validatePaymentException({ ...validInput, reasonCode: "SOMETHING_NEW" });

      expect(result.ok).toBe(true);
    });
  });

  describe("reference", () => {
    it("rejects a missing reference", () => {
      const { reference: _omitted, ...withoutReference } = validInput;

      expect(fieldsRejectedFor(withoutReference)).toEqual(["reference"]);
    });

    it("rejects an empty reference", () => {
      expect(fieldsRejectedFor({ ...validInput, reference: "" })).toEqual(["reference"]);
    });

    it("rejects a whitespace-only reference", () => {
      expect(fieldsRejectedFor({ ...validInput, reference: "   " })).toEqual(["reference"]);
    });
  });

  describe("amountCents", () => {
    it("rejects zero", () => {
      expect(fieldsRejectedFor({ ...validInput, amountCents: 0 })).toEqual(["amountCents"]);
    });

    it("rejects a negative amount", () => {
      expect(fieldsRejectedFor({ ...validInput, amountCents: -1 })).toEqual(["amountCents"]);
    });

    it("rejects a fractional amount, because cents are whole numbers", () => {
      expect(fieldsRejectedFor({ ...validInput, amountCents: 10.5 })).toEqual(["amountCents"]);
    });

    it("rejects an amount sent as a string", () => {
      expect(fieldsRejectedFor({ ...validInput, amountCents: "25000" })).toEqual(["amountCents"]);
    });
  });

  describe("currency", () => {
    it("rejects a currency other than AUD", () => {
      expect(fieldsRejectedFor({ ...validInput, currency: "USD" })).toEqual(["currency"]);
    });

    it("rejects lowercase aud", () => {
      expect(fieldsRejectedFor({ ...validInput, currency: "aud" })).toEqual(["currency"]);
    });
  });

  describe("bsb", () => {
    it.each(["032001", "32-001", "032-0011", "abc-def", "032 001", ""])(
      "rejects malformed BSB %j",
      (bsb) => {
        expect(fieldsRejectedFor({ ...validInput, bsb })).toEqual(["bsb"]);
      },
    );

    it("explains the expected BSB format in the error message", () => {
      const result = validatePaymentException({ ...validInput, bsb: "032001" });

      expect(result).toEqual({
        ok: false,
        errors: [{ field: "bsb", message: "bsb must be in the format XXX-XXX using digits only" }],
      });
    });
  });

  describe("accountNumber", () => {
    it.each(["12345", "1234567890123", "12345a", "123 456", ""])(
      "rejects invalid account number %j",
      (accountNumber) => {
        expect(fieldsRejectedFor({ ...validInput, accountNumber })).toEqual(["accountNumber"]);
      },
    );

    it("explains the expected account number format in the error message", () => {
      const result = validatePaymentException({ ...validInput, accountNumber: "12345" });

      expect(result).toEqual({
        ok: false,
        errors: [{ field: "accountNumber", message: "accountNumber must be 6 to 12 digits" }],
      });
    });
  });

  describe("reasonCode", () => {
    it("rejects a missing reason code", () => {
      const { reasonCode: _omitted, ...withoutReasonCode } = validInput;

      expect(fieldsRejectedFor(withoutReasonCode)).toEqual(["reasonCode"]);
    });

    it("rejects an empty reason code", () => {
      expect(fieldsRejectedFor({ ...validInput, reasonCode: "" })).toEqual(["reasonCode"]);
    });
  });

  describe("direction", () => {
    it("rejects a direction that is not INBOUND or OUTBOUND", () => {
      expect(fieldsRejectedFor({ ...validInput, direction: "SIDEWAYS" })).toEqual(["direction"]);
    });

    it("rejects a missing direction", () => {
      const { direction: _omitted, ...withoutDirection } = validInput;

      expect(fieldsRejectedFor(withoutDirection)).toEqual(["direction"]);
    });
  });

  describe("overall shape", () => {
    it("reports every invalid field, not only the first", () => {
      const fields = fieldsRejectedFor({
        ...validInput,
        reference: "",
        amountCents: 0,
        bsb: "bad",
      });

      expect(fields).toEqual(["reference", "amountCents", "bsb"]);
    });

    it.each([null, undefined, "text", 42, []])("rejects non-object input %j", (input) => {
      const result = validatePaymentException(input);

      expect(result).toEqual({
        ok: false,
        errors: [{ field: "body", message: "body must be a JSON object" }],
      });
    });
  });
});
