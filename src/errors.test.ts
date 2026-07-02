import { describe, expect, test } from "bun:test";
import { isScopraError, PolicyEvaluationError, type ScopraError } from "./index";

describe("Scopra errors", () => {
  test("narrows Scopra errors", () => {
    const error = new PolicyEvaluationError("Policy evaluator failed.", {
      code: "policy_evaluator_failed",
      cause: new Error("network timeout"),
      context: {
        requestType: "input",
        policyIds: ["agent-scope"],
        phase: "policy_evaluator",
      },
    });

    expect(isScopraError(error)).toBe(true);
    expect(isScopraError(new Error("ordinary error"))).toBe(false);

    if (isScopraError(error)) {
      const narrowed: ScopraError = error;

      expect(narrowed.code).toBe("policy_evaluator_failed");
      expect(narrowed.publicMessage).toBe("The policy check could not be completed.");
    }
  });
});
