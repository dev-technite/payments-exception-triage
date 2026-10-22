import type { TriageAction } from "./models";

export interface SettlementRequest {
  reference: string;
  amountCents: number;
  action: TriageAction;
}

export interface SettlementClient {
  submit(request: SettlementRequest): Promise<void>;
}

export interface MockSettlementOptions {
  fail?: boolean;
}
