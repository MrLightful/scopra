import type { DenyPolicyAction } from "./actions";
import type { Policy } from "./policy";

/**
 * Request to evaluate user-provided input before the workflow continues.
 */
export type InputEvaluationRequest = {
  /** Identifies the request as user input. */
  readonly type: "input";
  /** Input content to evaluate. */
  readonly content: string;
};

/**
 * Request to evaluate model output before it is returned or used.
 */
export type OutputEvaluationRequest = {
  /** Identifies the request as model output. */
  readonly type: "output";
  /** Output content to evaluate. */
  readonly content: string;
};

/**
 * Request to evaluate a tool invocation before it is executed.
 */
export type ToolEvaluationRequest = {
  /** Identifies the request as a tool invocation. */
  readonly type: "tool";
  /** Tool name to evaluate. */
  readonly name: string;
  /** Tool arguments to evaluate. */
  readonly arguments: Record<string, unknown>;
};

/**
 * Request shape accepted by policy evaluators and policy pipelines.
 */
export type EvaluationRequest =
  | InputEvaluationRequest
  | OutputEvaluationRequest
  | ToolEvaluationRequest;

/**
 * Result for a single policy produced by a policy evaluator.
 */
export type PolicyFinding = {
  /** Identifier of the policy this finding belongs to. */
  readonly policyId: string;
  /** Whether the evaluated request passed this policy. */
  readonly passed: boolean;
  /** Optional explanation for the finding. */
  readonly reason?: string;
  /** Optional confidence score from the evaluator. */
  readonly confidence?: number;
};

/**
 * Context passed to a policy evaluator.
 */
export type PolicyEvaluatorContext = {
  /** Request currently being evaluated. */
  readonly request: EvaluationRequest;
  /** Policies the evaluator should check. */
  readonly policies: readonly Policy[];
};

/**
 * Function that evaluates a request against policies and returns findings.
 */
export type PolicyEvaluator = (
  context: PolicyEvaluatorContext,
) => readonly PolicyFinding[] | Promise<readonly PolicyFinding[]>;

/**
 * Failed finding for a policy whose action denies the evaluated request.
 */
export type PolicyViolation = {
  /** Policy that produced the violation. */
  readonly policy: Policy;
  /** Failed finding returned by the evaluator. */
  readonly finding: PolicyFinding;
  /** Deny action attached to the failed policy. */
  readonly action: DenyPolicyAction;
  /** Denial message returned for this violation. */
  readonly message: string;
};

/**
 * Final policy decision for an evaluated request.
 */
export type PolicyDecision =
  | {
      /** Indicates the request passed without blocking violations. */
      readonly allowed: true;
      /** Request that was evaluated. */
      readonly request: EvaluationRequest;
      /** All findings returned by the evaluator. */
      readonly findings: readonly PolicyFinding[];
      /** Empty because allowed decisions have no blocking violations. */
      readonly violations: readonly [];
    }
  | {
      /** Indicates the request was denied by at least one blocking violation. */
      readonly allowed: false;
      /** Request that was evaluated. */
      readonly request: EvaluationRequest;
      /** All findings returned by the evaluator. */
      readonly findings: readonly PolicyFinding[];
      /** Blocking violations created from failed deny policies. */
      readonly violations: readonly PolicyViolation[];
      /** Denial message from the first blocking violation. */
      readonly message: string;
    };
