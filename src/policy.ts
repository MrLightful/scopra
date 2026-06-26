import type { PolicyAction } from "./actions";

export type PolicyOptions = {
  readonly id: string;
  readonly name: string;
  readonly description?: string;
  readonly instruction: string;
  readonly action: PolicyAction;
};

export class Policy {
  readonly id: string;
  readonly name: string;
  readonly description: string | undefined;
  readonly instruction: string;
  readonly action: PolicyAction;

  constructor(options: PolicyOptions) {
    this.id = options.id;
    this.name = options.name;
    this.description = options.description;
    this.instruction = options.instruction;
    this.action = options.action;
  }
}
