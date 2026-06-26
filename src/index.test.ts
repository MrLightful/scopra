import { describe, expect, test } from "bun:test";
import { createProtecClient } from "./index";

describe("createProtecClient", () => {
  test("creates a client with default config", () => {
    const client = createProtecClient();

    expect(client.config).toEqual({
      baseUrl: "https://api.protec.dev",
    });
  });

  test("normalizes a trailing slash in the base URL", () => {
    const client = createProtecClient({
      apiKey: "secret",
      baseUrl: "https://example.com/",
    });

    expect(client.config).toEqual({
      apiKey: "secret",
      baseUrl: "https://example.com",
    });
  });
});
