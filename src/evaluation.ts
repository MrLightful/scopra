import type { DenyPolicyAction } from "./actions";
import type { Policy } from "./policy";

export type InputEvaluationRequest = {
  readonly type: "input";
  readonly content: string;
};

export type OutputEvaluationRequest = {
  readonly type: "output";
  readonly content: string;
};

export type ToolEvaluationRequest = {
  readonly type: "tool";
  readonly name: string;
  readonly arguments: Record<string, unknown>;
};

export type EvaluationRequest =
  | InputEvaluationRequest
  | OutputEvaluationRequest
  | ToolEvaluationRequest;

export type PolicyFinding = {
  readonly policyId: string;
  readonly passed: boolean;
  readonly reason?: string;
  readonly confidence?: number;
};

export type PolicyEvaluatorContext = {
  readonly request: EvaluationRequest;
  readonly policies: readonly Policy[];
};

export type PolicyEvaluator = (
  context: PolicyEvaluatorContext,
) => readonly PolicyFinding[] | Promise<readonly PolicyFinding[]>;

export type PolicyViolation = {
  readonly policy: Policy;
  readonly finding: PolicyFinding;
  readonly action: DenyPolicyAction;
  readonly message: string;
};

export type PolicyDecision =
  | {
      readonly allowed: true;
      readonly request: EvaluationRequest;
      readonly findings: readonly PolicyFinding[];
      readonly violations: readonly [];
    }
  | {
      readonly allowed: false;
      readonly request: EvaluationRequest;
      readonly findings: readonly PolicyFinding[];
      readonly violations: readonly PolicyViolation[];
      readonly message: string;
    };
