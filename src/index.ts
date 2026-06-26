const DEFAULT_BASE_URL = "https://api.protec.dev";

export type ProtecClientConfig = {
  apiKey?: string;
  baseUrl?: string;
};

export type ProtecClient = {
  readonly config: Required<Pick<ProtecClientConfig, "baseUrl">> &
    Pick<ProtecClientConfig, "apiKey">;
};

export function createProtecClient(config: ProtecClientConfig = {}): ProtecClient {
  return {
    config: {
      ...config,
      baseUrl: normalizeBaseUrl(config.baseUrl ?? DEFAULT_BASE_URL),
    },
  };
}

function normalizeBaseUrl(baseUrl: string): string {
  return baseUrl.replace(/\/+$/, "");
}
