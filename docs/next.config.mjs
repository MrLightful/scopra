import nextra from "nextra";
import path from "node:path";
import { fileURLToPath } from "node:url";

const withNextra = nextra({
  defaultShowCopyCode: true,
});

const docsDir = fileURLToPath(new URL(".", import.meta.url));
const docsNodeModules = path.join(docsDir, "node_modules");
const workspaceSourceDir = path.join(docsDir, "..", "src");
const sharedRuntimeDependencies = new Map([
  ["ai", path.join(docsNodeModules, "ai")],
  ["zod", path.join(docsNodeModules, "zod")],
]);

export default withNextra({
  reactStrictMode: true,
  turbopack: {
    root: import.meta.dirname,
  },
  webpack(config, { webpack }) {
    config.plugins.push(
      new webpack.NormalModuleReplacementPlugin(/^(ai|zod)$/, (resource) => {
        if (!resource.context.startsWith(workspaceSourceDir)) {
          return;
        }

        resource.request = sharedRuntimeDependencies.get(resource.request) ?? resource.request;
      }),
    );

    return config;
  },
});
