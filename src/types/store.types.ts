import type { ExceptionCase } from "./models";

export interface CaseStore {
  save(exceptionCase: ExceptionCase): void;
  findById(id: string): ExceptionCase | undefined;
  list(): ExceptionCase[];
}
