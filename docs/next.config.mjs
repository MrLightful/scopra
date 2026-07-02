import nextra from "nextra";

const withNextra = nextra({
  defaultShowCopyCode: true,
});

export default withNextra({
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "www.gravatar.com",
      },
    ],
  },
  reactStrictMode: true,
  turbopack: {
    root: import.meta.dirname,
  },
  webpack(config) {
    // Let symlinked MDX outside docs resolve Nextra's internal setup module.
    config.resolve.alias["nextra/setup-page"] = new URL(
      "./node_modules/nextra/dist/client/setup-page.js",
      import.meta.url,
    ).pathname;

    return config;
  },
});
