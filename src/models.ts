export const DIRECTIONS = ["INBOUND", "OUTBOUND"] as const;

export type Direction = (typeof DIRECTIONS)[number];

export interface PaymentException {
  reference: string;
  amountCents: number;
  currency: "AUD";
  bsb: string;
  accountNumber: string;
  reasonCode: string;
  direction: Direction;
}
