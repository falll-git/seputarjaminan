import type { Metadata } from "next";
import { headers } from "next/headers";
import "@fontsource-variable/schibsted-grotesk";
import "@fontsource-variable/ibm-plex-sans";
import "@fontsource/ibm-plex-mono/400.css";
import "photoswipe/style.css";
import "./globals.css";
import "./editorial.css";
import "./routes.css";
import "./design-system.css";
import "./system-states.css";
import ConnectivityNotice from "./components/ConnectivityNotice";
import PublicMotionProvider from "./components/PublicMotionProvider";

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
    <html lang="id">
      <body>
        <PublicMotionProvider>
          {children}
          <ConnectivityNotice />
        </PublicMotionProvider>
      </body>
    </html>
  );
}
