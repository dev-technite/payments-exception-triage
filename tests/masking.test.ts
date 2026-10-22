import { describe, expect, it } from "vitest";
import { maskAccountNumber, maskBsb } from "../src/masking";

describe("maskBsb", () => {
  it("hides the first three digits and keeps the last three", () => {
    expect(maskBsb("032-001")).toBe("***-001");
  });
});

describe("maskAccountNumber", () => {
  it.each([
    ["123456", "***456"],
    ["123456789", "******789"],
    ["123456789012", "*********012"],
  ])("keeps only the last three digits of %s", (accountNumber, expected) => {
    expect(maskAccountNumber(accountNumber)).toBe(expected);
  });
});
