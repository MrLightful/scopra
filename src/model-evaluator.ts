import { z } from "zod";
import type { EvaluationRequest, PolicyEvaluator, PolicyFinding } from "./evaluation";
import type { ProtecModel, ProtecModelOptions } from "./model";
import type { Policy } from "./policy";

const DEFAULT_SYSTEM = [
  "You are a policy evaluator for an AI application.",
  "Evaluate the request against each policy independently.",
  "Return exactly one finding for every provided policy id.",
  "Set passed to true only when the request satisfies the policy.",
  "When a policy fails, include a concise reason.",
  "When confidence is provided, it must be between 0 and 1.",
].join(" ");

const findingSchema = z.object({
  policyId: z.string(),
  passed: z.boolean(),
  reason: z.string().optional(),
  confidence: z.number().min(0).max(1).optional(),
});

const evaluationSchema = z.object({
  findings: z.array(findingSchema),
});

/**
 * Options for model-backed policy evaluation.
 */
export type ModelEvaluatorOptions = {
  /** Instructions sent to the model instead of Protec's default evaluator instructions. */
  readonly system?: string | undefined;
  /** Optional cancellation signal for model requests. */
  readonly abortSignal?: AbortSignal | undefined;
  /** SDK-specific generation options passed to the configured model adapter. */
  readonly modelOptions?: ProtecModelOptions | undefined;
};

export function createModelEvaluator(
  model: ProtecModel,
  options: ModelEvaluatorOptions = {},
): PolicyEvaluator {
  return async ({ request, policies }) => evaluateWithModel(model, request, policies, options);
}

async function evaluateWithModel(
  model: ProtecModel,
  request: EvaluationRequest,
  policies: readonly Policy[],
  options: ModelEvaluatorOptions,
): Promise<readonly PolicyFinding[]> {
  const result = await model.generateObject({
    system: options.system ?? DEFAULT_SYSTEM,
    prompt: buildPrompt(request, policies),
    schema: evaluationSchema,
    schemaName: "PolicyEvaluation",
    schemaDescription: "Policy findings for a Protec evaluation request.",
    abortSignal: options.abortSignal,
    modelOptions: options.modelOptions,
  });
  const evaluation = evaluationSchema.parse(result);
  const findings = evaluation.findings.map(toPolicyFinding);

  assertFindingsMatchPolicies(findings, policies);

  return findings;
}

function buildPrompt(request: EvaluationRequest, policies: readonly Policy[]): string {
  return JSON.stringify(
    {
      task: "Evaluate this request against the configured policies.",
      output: {
        findings: "Exactly one finding for every policy. Use the policy id as policyId.",
      },
      request,
      policies: policies.map((policy) => ({
        id: policy.id,
        name: policy.name,
        description: policy.description,
        instruction: policy.instruction,
      })),
    },
    null,
    2,
  );
}

function toPolicyFinding(finding: z.infer<typeof findingSchema>): PolicyFinding {
  return {
    policyId: finding.policyId,
    passed: finding.passed,
    ...(finding.reason !== undefined ? { reason: finding.reason } : {}),
    ...(finding.confidence !== undefined ? { confidence: finding.confidence } : {}),
  };
}

function assertFindingsMatchPolicies(
  findings: readonly PolicyFinding[],
  policies: readonly Policy[],
): void {
  const expectedIds = new Set(policies.map((policy) => policy.id));
  const seenIds = new Set<string>();

  for (const finding of findings) {
    if (!expectedIds.has(finding.policyId)) {
      throw new Error(`Model evaluator returned an unknown policy id: ${finding.policyId}`);
    }

    if (seenIds.has(finding.policyId)) {
      throw new Error(
        `Model evaluator returned duplicate findings for policy id: ${finding.policyId}`,
      );
    }

    seenIds.add(finding.policyId);
  }

  const missingIds = policies
    .map((policy) => policy.id)
    .filter((policyId) => !seenIds.has(policyId));

  if (missingIds.length > 0) {
    throw new Error(`Model evaluator omitted findings for policy ids: ${missingIds.join(", ")}`);
  }
}
