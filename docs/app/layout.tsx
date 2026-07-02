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
  description: "Business-rule safeguards for AI agents.",
};

const navbar = (
  <Navbar logo={<strong>Scopra</strong>} projectLink="https://github.com/MrLightful/scopra" />
);

const footer = (
  <Footer>
    <span className="scopra-footer-attribution">
      By{" "}
      <a href="https://mrlightful.com">
        <img
          src="https://www.gravatar.com/avatar/42fcc55b28fa774e9a646dd2dd7ae0cf?s=48"
          alt=""
          width="24"
          height="24"
        />
        MrLightful
      </a>
    </span>
  </Footer>
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
