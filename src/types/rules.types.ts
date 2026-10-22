import type { PaymentException } from "./models";

export type TriageInput = Pick<PaymentException, "reasonCode" | "amountCents">;
