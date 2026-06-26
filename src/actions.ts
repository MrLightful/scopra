export type AllowPolicyAction = {
  readonly type: "allow";
};

export type DenyPolicyAction = {
  readonly type: "deny";
  readonly message: string;
};

export type PolicyAction = AllowPolicyAction | DenyPolicyAction;

export function allow(): PolicyAction {
  return {
    type: "allow",
  };
}

export function deny(message: string): PolicyAction {
  return {
    type: "deny",
    message,
  };
}
