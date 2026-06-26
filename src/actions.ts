/**
 * Allows a policy finding to pass without blocking the evaluated request.
 */
export type AllowPolicyAction = {
  /** Identifies this action as non-blocking. */
  readonly type: "allow";
};

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
export type PolicyAction = AllowPolicyAction | DenyPolicyAction;

/**
 * Creates a non-blocking policy action.
 *
 * Use this for policies whose findings should be reported without denying the
 * request.
 */
export function allow(): PolicyAction {
  return {
    type: "allow",
  };
}

/**
 * Creates a blocking policy action with the message returned to callers.
 *
 * Use this for policies that should deny a request when their finding fails.
 */
export function deny(message: string): PolicyAction {
  return {
    type: "deny",
    message,
  };
}
