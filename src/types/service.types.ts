import type { Logger } from "./logging.types";
import type { ExceptionCase } from "./models";
import type { SettlementClient } from "./settlement.types";
import type { CaseStore } from "./store.types";
import type { ValidationError } from "./validation.types";

export interface TriageServiceDependencies {
  store: CaseStore;
  settlement: SettlementClient;
  logger: Logger;
  newId?: () => string;
  now?: () => Date;
}

export type SubmitResult =
  | { ok: true; case: ExceptionCase }
  | { ok: false; errors: ValidationError[] };

export interface TriageService {
  submit(input: unknown): Promise<SubmitResult>;
  getCase(id: string): ExceptionCase | undefined;
  listCases(): ExceptionCase[];
}
