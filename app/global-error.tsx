"use client";

import "@fontsource-variable/schibsted-grotesk";
import "@fontsource-variable/ibm-plex-sans";
import "@fontsource/ibm-plex-mono/400.css";
import "./globals.css";
import "./editorial.css";
import "./routes.css";
import "./design-system.css";
import "./system-states.css";
import UnexpectedErrorPage from "./components/UnexpectedErrorPage";

type GlobalErrorBoundaryProps = {
  error: Error & { digest?: string };
  reset: () => void;
};

export default function GlobalError({ reset }: GlobalErrorBoundaryProps) {
  return (
    <html lang="id">
      <body>
        <title>Gangguan halaman | Seputar Jaminan by ruwang</title>
        <UnexpectedErrorPage retry={reset} />
      </body>
    </html>
  );
}
