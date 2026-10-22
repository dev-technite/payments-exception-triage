import { randomUUID } from "node:crypto";
import { maskAccountNumber, maskBsb } from "./masking";
import { triage } from "./rules";
import type { CaseAction, CaseStatus, ExceptionCase, PaymentException, TriageAction } from "./types/models";
import type { SubmitResult, TriageService, TriageServiceDependencies } from "./types/service.types";
import { validatePaymentException } from "./validation";

const STATUS_BY_ACTION: Record<CaseAction, CaseStatus> = {
  AUTO_CLOSE: "CLOSED",
  QUEUE_REVIEW: "QUEUED",
  NEEDS_HUMAN: "AWAITING_HUMAN",
  DEGRADED: "DEGRADED",
};

export function createTriageService(dependencies: TriageServiceDependencies): TriageService {
  const { store, settlement, logger, newId = randomUUID, now = () => new Date() } = dependencies;

  async function submit(input: unknown): Promise<SubmitResult> {
    const validation = validatePaymentException(input);
    if (!validation.ok) {
      logger.warn("exception rejected", {
        invalidFields: validation.errors.map((error) => error.field),
      });
      return validation;
    }

    const exception = validation.value;
    const triageAction = triage(exception);
    const action = await settleOrDegrade(exception, triageAction);

    const exceptionCase = buildCase(exception, action, newId(), now());
    store.save(exceptionCase);
    logOutcome(exceptionCase, triageAction);

    return { ok: true, case: exceptionCase };
  }

  async function settleOrDegrade(exception: PaymentException, triageAction: TriageAction): Promise<CaseAction> {
    try {
      await settlement.submit({
        reference: exception.reference,
        amountCents: exception.amountCents,
        action: triageAction,
      });
      return triageAction;
    } catch {
      return "DEGRADED";
    }
  }

  function logOutcome(exceptionCase: ExceptionCase, triageAction: TriageAction): void {
    const fields = {
      caseId: exceptionCase.id,
      reference: exceptionCase.reference,
      action: exceptionCase.action,
      status: exceptionCase.status,
    };
    if (exceptionCase.action === "DEGRADED") {
      logger.warn("settlement unavailable, case degraded", { ...fields, intendedAction: triageAction });
      return;
    }
    logger.info("exception triaged", fields);
  }

  return {
    submit,
    getCase: (id) => store.findById(id),
    listCases: () => store.list(),
  };
}

function buildCase(exception: PaymentException, action: CaseAction, id: string, createdAt: Date): ExceptionCase {
  return {
    id,
    reference: exception.reference,
    amountCents: exception.amountCents,
    currency: exception.currency,
    maskedBsb: maskBsb(exception.bsb),
    maskedAccountNumber: maskAccountNumber(exception.accountNumber),
    reasonCode: exception.reasonCode,
    direction: exception.direction,
    action,
    status: STATUS_BY_ACTION[action],
    createdAt: createdAt.toISOString(),
  };
}
