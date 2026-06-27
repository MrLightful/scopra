import {
  generateObject,
  type LanguageModel,
  type LanguageModelCallOptions,
  type RequestOptions,
} from "ai";
import { z } from "zod";
import type { EvaluationRequest, PolicyEvaluator, PolicyFinding } from "./evaluation";
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

type LlmGenerationOptions = Pick<
  LanguageModelCallOptions,
  | "frequencyPenalty"
  | "maxOutputTokens"
  | "presencePenalty"
  | "reasoning"
  | "seed"
  | "temperature"
  | "topK"
  | "topP"
> &
  Pick<RequestOptions, "abortSignal" | "headers" | "maxRetries">;

/**
 * Options for the Vercel AI SDK-backed evaluator.
 */
export type LlmEvaluatorOptions = LlmGenerationOptions & {
  /** Instructions sent to the model instead of Protec's default evaluator instructions. */
  readonly system?: string;
};

/**
 * Creates a policy evaluator backed by a Vercel AI SDK language model.
 */
export function llm(model: LanguageModel, options: LlmEvaluatorOptions = {}): PolicyEvaluator {
  const { system, ...generationOptions } = options;

  return async ({ request, policies }) => {
    const result = await generateObject({
      model,
      instructions: system ?? DEFAULT_SYSTEM,
      prompt: buildPrompt(request, policies),
      schema: evaluationSchema,
      schemaName: "PolicyEvaluation",
      schemaDescription: "Policy findings for a Protec evaluation request.",
      ...generationOptions,
    });

    const findings = result.object.findings.map(toPolicyFinding);
    assertFindingsMatchPolicies(findings, policies);

    return findings;
  };
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
      throw new Error(`LLM evaluator returned an unknown policy id: ${finding.policyId}`);
    }

    if (seenIds.has(finding.policyId)) {
      throw new Error(
        `LLM evaluator returned duplicate findings for policy id: ${finding.policyId}`,
      );
    }

    seenIds.add(finding.policyId);
  }

  const missingIds = policies
    .map((policy) => policy.id)
    .filter((policyId) => !seenIds.has(policyId));

  if (missingIds.length > 0) {
    throw new Error(`LLM evaluator omitted findings for policy ids: ${missingIds.join(", ")}`);
  }
}
