/**
 * Blocks an evaluated request when the associated policy fails.
 */
export type DenyPolicyAction = {
  /** Identifies this action as blocking. */
  readonly type: "deny";
  /** Message returned on denied decisions for this policy. */
  readonly message: string;
  /** Optional minimum finding confidence required to deny. */
  readonly confidence?: number;
};

/**
 * Action applied when a policy finding fails.
 */
export type PolicyAction = DenyPolicyAction;

/**
 * Options for creating a deny action.
 */
export type DenyPolicyActionOptions = {
  /** Optional minimum finding confidence required to deny. */
  readonly confidence?: number;
};

/**
 * Creates a blocking policy action with the message returned to callers.
 *
 * Use this for policies that should deny a request when their finding fails.
 * When confidence is set, failed findings only deny at or above that confidence.
 */
export function deny(message: string, options: DenyPolicyActionOptions = {}): DenyPolicyAction {
  return {
    type: "deny",
    message,
    ...(options.confidence === undefined ? {} : { confidence: options.confidence }),
  };
}
