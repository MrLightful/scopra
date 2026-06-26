# protec

A TypeScript SDK core package for Protec.

## Install

```sh
bun add protec
```

## Usage

```ts
import { createProtecClient } from "protec";

const client = createProtecClient({
  apiKey: "your-api-key",
});

console.log(client.config.baseUrl);
```

## Development

```sh
bun install
bun test
bun run check
bun run build
```

## Publishing

```sh
npm publish
```

