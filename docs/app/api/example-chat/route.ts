import { createAnthropic } from "@ai-sdk/anthropic";
import { createGoogleGenerativeAI } from "@ai-sdk/google";
import { createOpenAI } from "@ai-sdk/openai";
import { generateText, type ModelMessage } from "ai";
import { AgentScopePolicy, PolicyPipeline, vercel } from "scopra";

export const runtime = "nodejs";

type Provider = "openai" | "anthropic" | "google";

type ChatRequest = {
  readonly provider?: unknown;
  readonly model?: unknown;
  readonly apiKey?: unknown;
  readonly messages?: unknown;
};

const SUPPORT_SCOPE = [
  "The Acme Support agent may help with billing questions, account access, product troubleshooting, plan comparisons, refund eligibility, and handoff to human support.",
  "The agent must not provide medical, legal, financial, security exploit, academic cheating, marketing strategy, competitor research, or unrelated general assistant work.",
].join(" ");

const AGENT_SYSTEM = [
  "You are Acme Support, a concise and careful customer support agent.",
  "Help with billing, account access, product troubleshooting, plan comparisons, refund eligibility, and support handoff.",
  "If a request is outside Acme Support's scope, briefly say you cannot help with that request and offer an in-scope support path.",
].join(" ");

const PROVIDER_LABELS: Record<Provider, string> = {
  openai: "OpenAI",
  anthropic: "Anthropic",
  google: "Google Gemini",
};

export async function POST(request: Request) {
  const startedAt = performance.now();

  try {
    const body = (await request.json()) as ChatRequest;
    const validated = validateRequest(body);

    if (!validated.ok) {
      return Response.json({ error: validated.error }, { status: 400 });
    }

    const model = createLanguageModel(validated.provider, validated.model, validated.apiKey);
    const userMessage = getLastUserMessage(validated.messages);

    if (userMessage === undefined) {
      return Response.json({ error: "Send at least one user message." }, { status: 400 });
    }

    const chatController = new AbortController();
    const chatPromise = timeAsync(() =>
      generateText({
        model,
        system: AGENT_SYSTEM,
        messages: validated.messages,
        abortSignal: chatController.signal,
        temperature: 0.3,
      }),
    );

    const policyStartedAt = performance.now();
    const policyPipeline = new PolicyPipeline({
      evaluator: vercel(model),
      policies: [
        new AgentScopePolicy({
          scope: SUPPORT_SCOPE,
          denial:
            "Acme Support can only help with support, billing, account, product, plan, refund, and handoff requests.",
        }),
      ],
      modelOptions: {
        temperature: 0,
      },
    });

    const decision = await policyPipeline.evaluate({
      type: "input",
      content: userMessage.content,
    });
    const policyMs = Math.round(performance.now() - policyStartedAt);

    if (!decision.allowed) {
      chatController.abort();
      chatPromise.catch(() => undefined);

      return Response.json({
        allowed: false,
        provider: validated.provider,
        providerLabel: PROVIDER_LABELS[validated.provider],
        model: validated.model,
        answer:
          decision.violations[0]?.denial ?? "This request is outside the configured support scope.",
        decision: serializeDecision(decision),
        timings: {
          policyMs,
          totalMs: Math.round(performance.now() - startedAt),
        },
      });
    }

    const { durationMs: chatMs, value: chatResult } = await chatPromise;

    return Response.json({
      allowed: true,
      provider: validated.provider,
      providerLabel: PROVIDER_LABELS[validated.provider],
      model: validated.model,
      answer: chatResult.text,
      decision: serializeDecision(decision),
      timings: {
        chatMs,
        policyMs,
        totalMs: Math.round(performance.now() - startedAt),
      },
    });
  } catch (error) {
    return Response.json(
      {
        error: toPublicError(error),
      },
      { status: 500 },
    );
  }
}

function validateRequest(body: ChatRequest):
  | {
      readonly ok: true;
      readonly provider: Provider;
      readonly model: string;
      readonly apiKey: string;
      readonly messages: ModelMessage[];
    }
  | { readonly ok: false; readonly error: string } {
  if (!isProvider(body.provider)) {
    return { ok: false, error: "Choose OpenAI, Anthropic, or Google Gemini." };
  }

  if (typeof body.model !== "string" || body.model.trim().length === 0) {
    return { ok: false, error: "Enter a model name." };
  }

  if (typeof body.apiKey !== "string" || body.apiKey.trim().length === 0) {
    return { ok: false, error: "Enter an API key for the selected provider." };
  }

  if (!Array.isArray(body.messages)) {
    return { ok: false, error: "Send messages as an array." };
  }

  const messages: ModelMessage[] = [];

  for (const message of body.messages) {
    if (!isMessage(message)) {
      return { ok: false, error: "Messages must include a role and text content." };
    }

    messages.push({
      role: message.role,
      content: message.content.trim(),
    });
  }

  return {
    ok: true,
    provider: body.provider,
    model: body.model.trim(),
    apiKey: body.apiKey.trim(),
    messages,
  };
}

function createLanguageModel(provider: Provider, model: string, apiKey: string) {
  if (provider === "openai") {
    return createOpenAI({ apiKey })(model);
  }

  if (provider === "anthropic") {
    return createAnthropic({ apiKey })(model);
  }

  return createGoogleGenerativeAI({ apiKey })(model);
}

function getLastUserMessage(
  messages: readonly ModelMessage[],
): { readonly content: string } | undefined {
  for (let index = messages.length - 1; index >= 0; index -= 1) {
    const message = messages[index];

    if (message?.role === "user" && typeof message.content === "string") {
      return {
        content: message.content,
      };
    }
  }

  return undefined;
}

function isProvider(value: unknown): value is Provider {
  return value === "openai" || value === "anthropic" || value === "google";
}

function isMessage(value: unknown): value is {
  readonly role: "user" | "assistant";
  readonly content: string;
} {
  if (typeof value !== "object" || value === null) {
    return false;
  }

  const candidate = value as Record<string, unknown>;

  return (
    (candidate.role === "user" || candidate.role === "assistant") &&
    typeof candidate.content === "string" &&
    candidate.content.trim().length > 0
  );
}

function serializeDecision(decision: Awaited<ReturnType<PolicyPipeline["evaluate"]>>) {
  return {
    allowed: decision.allowed,
    findings: decision.findings.map((finding) => ({
      policyId: finding.policyId,
      passed: finding.passed,
      reason: finding.reason,
      confidence: finding.confidence,
    })),
    violations: decision.violations.map((violation) => ({
      policyId: violation.policy.id,
      policyName: violation.policy.name,
      denial: violation.denial,
      reason: violation.finding.reason,
      confidence: violation.finding.confidence,
    })),
  };
}

function toPublicError(error: unknown) {
  if (error instanceof Error && error.name === "AbortError") {
    return "The request was stopped after Scopra blocked the prompt.";
  }

  if (error instanceof Error && error.message.trim().length > 0) {
    return redactSecrets(error.message);
  }

  return "The model request failed. Check the provider, model name, and API key.";
}

function redactSecrets(message: string) {
  return message.replace(/sk-[A-Za-z0-9_-]{12,}/g, "sk-...");
}

async function timeAsync<T>(operation: () => Promise<T>) {
  const startedAt = performance.now();
  const value = await operation();

  return {
    durationMs: Math.round(performance.now() - startedAt),
    value,
  };
}
