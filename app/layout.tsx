import type { Metadata } from "next";
import { headers } from "next/headers";
import "photoswipe/style.css";
import "./design-tokens.css";
import "./globals.css";
import "./editorial.css";
import "./routes.css";
import "./design-system.css";
import "./system-states.css";
import "./marketplace.css";
import "./foundation.css";
import "./shared-components.css";
import ConnectivityNotice from "./components/ConnectivityNotice";
import PublicMotionProvider from "./components/PublicMotionProvider";
import ThemeProvider from "./components/ThemeProvider";
import { fontVariables } from "./fonts";
import { THEME_BOOTSTRAP } from "./lib/theme";

export async function generateMetadata(): Promise<Metadata> {
  const headerList = await headers();
  const host = headerList.get("host") ?? "localhost:3000";
  const protocol = host.startsWith("localhost") || host.startsWith("127.0.0.1") ? "http" : "https";
  const origin = `${protocol}://${host}`;

  return {
    metadataBase: new URL(origin),
    title: "Seputar Jaminan by ruwang",
    description: "Katalog publik aset jaminan dari BPRS yang terhubung melalui ruwang.",
    openGraph: {
      title: "Seputar Jaminan by ruwang",
      description: "Katalog publik aset jaminan dari BPRS yang terhubung melalui ruwang.",
      type: "website",
      images: [{ url: `${origin}/og-v4.png`, width: 1536, height: 1024, alt: "Seputar Jaminan by ruwang" }],
    },
    twitter: {
      card: "summary_large_image",
      title: "Seputar Jaminan by ruwang",
      description: "Katalog publik aset jaminan dari BPRS yang terhubung melalui ruwang.",
      images: [`${origin}/og-v4.png`],
    },
  };
}

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    // Next 16 needs this opt-in to suspend global smooth scrolling during route changes.
    <html lang="id" className={fontVariables} data-scroll-behavior="smooth" suppressHydrationWarning>
      <head><script id="sj-theme-bootstrap" dangerouslySetInnerHTML={{ __html: THEME_BOOTSTRAP }} /></head>
      <body>
        <ThemeProvider>
          <PublicMotionProvider>
            {children}
            <ConnectivityNotice />
          </PublicMotionProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
