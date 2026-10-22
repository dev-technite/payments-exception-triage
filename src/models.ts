export const DIRECTIONS = ["INBOUND", "OUTBOUND"] as const;

export type Direction = (typeof DIRECTIONS)[number];

export type TriageAction = "AUTO_CLOSE" | "QUEUE_REVIEW" | "NEEDS_HUMAN";

export interface PaymentException {
  reference: string;
  amountCents: number;
  currency: "AUD";
  bsb: string;
  accountNumber: string;
  reasonCode: string;
  direction: Direction;
}
