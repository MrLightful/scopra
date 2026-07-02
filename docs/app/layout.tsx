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
  <Navbar logo={<strong>Scopra</strong>} projectLink="https://github.com/MrLightful/scopra">
    <a
      aria-label="Scopra on npm"
      className="scopra-navbar-npm"
      href="https://www.npmjs.com/package/scopra"
    >
      <svg role="img" viewBox="0 0 24 24" aria-hidden="true">
        <path d="M1.763 0C.786 0 0 .786 0 1.763v20.474C0 23.214.786 24 1.763 24h20.474c.977 0 1.763-.786 1.763-1.763V1.763C24 .786 23.214 0 22.237 0zM5.13 5.323l13.837.019-.009 13.836h-3.464l.01-10.382h-3.456L12.04 19.17H5.113z" />
      </svg>
    </a>
  </Navbar>
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
