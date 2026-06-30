import nextra from "nextra";

const withNextra = nextra({
  defaultShowCopyCode: true,
});

export default withNextra({
  reactStrictMode: true,
  turbopack: {
    root: import.meta.dirname,
  },
});
