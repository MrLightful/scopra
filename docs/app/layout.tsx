import type { ReactNode } from "react";
import { Footer, Layout, Navbar } from "nextra-theme-docs";
import { getPageMap } from "nextra/page-map";
import "nextra-theme-docs/style.css";
import "./styles.css";

export const metadata = {
  title: {
    default: "Scopra Docs",
    template: "%s - Scopra",
  },
  description: "Developer-first TypeScript policy enforcement for AI applications.",
};

const navbar = (
  <Navbar logo={<strong>Scopra</strong>} projectLink="https://github.com/MrLightful/scopra" />
);

const footer = (
  <Footer>MIT Licensed. Built for developer-first TypeScript policy enforcement.</Footer>
);

export default async function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en" dir="ltr" suppressHydrationWarning>
      <body>
        <Layout
          navbar={navbar}
          pageMap={await getPageMap()}
          docsRepositoryBase="https://github.com/MrLightful/scopra/tree/main/docs"
          footer={footer}
        >
          {children}
        </Layout>
      </body>
    </html>
  );
}
