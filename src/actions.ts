/**
 * Blocks an evaluated request when the associated policy fails.
 */
export type DenyPolicyAction = {
  /** Identifies this action as blocking. */
  readonly type: "deny";
  /** Message returned on denied decisions for this policy. */
  readonly message: string;
};

/**
 * Action applied when a policy finding fails.
 */
export type PolicyAction = DenyPolicyAction;

/**
 * Creates a blocking policy action with the message returned to callers.
 *
 * Use this for policies that should deny a request when their finding fails.
 */
export function deny(message: string): DenyPolicyAction {
  return {
    type: "deny",
    message,
  };
}
