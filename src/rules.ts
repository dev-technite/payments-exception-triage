import type { TriageAction } from "./types/models";
import type { TriageInput } from "./types/rules.types";

const HIGH_VALUE_THRESHOLD_CENTS = 1_000_000;

export function triage({ reasonCode, amountCents }: TriageInput): TriageAction {
  switch (reasonCode) {
    case "DUPLICATE_PAYMENT":
      return "AUTO_CLOSE";
    case "INSUFFICIENT_FUNDS":
      return isHighValue(amountCents) ? "NEEDS_HUMAN" : "QUEUE_REVIEW";
    case "INVALID_ACCOUNT":
    case "BANK_UNAVAILABLE":
      return "QUEUE_REVIEW";
    default:
      return "NEEDS_HUMAN";
  }
}

function isHighValue(amountCents: number): boolean {
  return amountCents >= HIGH_VALUE_THRESHOLD_CENTS;
}
