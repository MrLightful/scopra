import type { EvaluationRequest } from "./evaluation";
import type { Policy } from "./policy";

/**
 * Stable error codes produced by Scopra.
 */
export type ScopraErrorCode =
  | "policy_evaluator_failed"
  | "policy_findings_invalid"
  | "violation_response_failed";

/**
 * Safe structured context attached to Scopra errors.
 */
export type ScopraErrorContext = {
  /** Evaluation request type, when an error happened while evaluating a request. */
  readonly requestType?: EvaluationRequest["type"] | undefined;
  /** Policy ids involved in the failing operation. */
  readonly policyIds?: readonly string[] | undefined;
  /** Scopra phase where the error happened. */
  readonly phase?: string | undefined;
};

export type ScopraErrorOptions = {
  /** Stable machine-readable error code. */
  readonly code: ScopraErrorCode;
  /** Original error or thrown value that caused this error. */
  readonly cause?: unknown;
  /** Safe structured context for logs and telemetry. */
  readonly context?: ScopraErrorContext | undefined;
  /** Safe message suitable for user-facing fallbacks. */
  readonly publicMessage?: string | undefined;
};

/**
 * Base error type for Scopra failures.
 */
export class ScopraError extends Error {
  readonly code: ScopraErrorCode;
  override cause: unknown;
  readonly context: ScopraErrorContext;
  readonly publicMessage: string;

  constructor(message: string, options: ScopraErrorOptions) {
    super(message, options.cause === undefined ? undefined : { cause: options.cause });
    this.name = "ScopraError";
    this.code = options.code;
    this.cause = options.cause;
    this.context = options.context ?? {};
    this.publicMessage = options.publicMessage ?? "The policy check could not be completed.";
  }
}

/**
 * Error thrown when policy evaluation cannot complete successfully.
 */
export class PolicyEvaluationError extends ScopraError {
  constructor(
    message: string,
    options: Omit<ScopraErrorOptions, "code" | "publicMessage"> & {
      readonly code: "policy_evaluator_failed" | "policy_findings_invalid";
      readonly publicMessage?: string | undefined;
    },
  ) {
    super(message, {
      ...options,
      publicMessage: options.publicMessage ?? "The policy check could not be completed.",
    });
    this.name = "PolicyEvaluationError";
  }
}

/**
 * Error thrown when user-facing violation response generation fails.
 */
export class ViolationResponseError extends ScopraError {
  constructor(
    message: string,
    options: Omit<ScopraErrorOptions, "code" | "publicMessage"> & {
      readonly publicMessage?: string | undefined;
    } = {},
  ) {
    super(message, {
      ...options,
      code: "violation_response_failed",
      publicMessage: options.publicMessage ?? "A policy denial response could not be generated.",
    });
    this.name = "ViolationResponseError";
  }
}

export function isScopraError(error: unknown): error is ScopraError {
  return error instanceof ScopraError;
}

export function createEvaluationErrorContext(
  request: EvaluationRequest,
  policies: readonly Policy[],
  phase: string,
): ScopraErrorContext {
  return {
    requestType: request.type,
    policyIds: policies.map((policy) => policy.id),
    phase,
  };
}
