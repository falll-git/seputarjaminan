"use client";

import "./design-tokens.css";
import "./globals.css";
import "./editorial.css";
import "./routes.css";
import "./design-system.css";
import "./system-states.css";
import "./marketplace.css";
import "./foundation.css";
import "./shared-components.css";
import UnexpectedErrorPage from "./components/UnexpectedErrorPage";
import ThemeProvider from "./components/ThemeProvider";
import { fontVariables } from "./fonts";
import { THEME_BOOTSTRAP } from "./lib/theme";

type GlobalErrorBoundaryProps = {
  error: Error & { digest?: string };
  reset: () => void;
};

export default function GlobalError({ reset }: GlobalErrorBoundaryProps) {
  return (
    <html lang="id" className={fontVariables} suppressHydrationWarning>
      <head><script id="sj-theme-bootstrap" dangerouslySetInnerHTML={{ __html: THEME_BOOTSTRAP }} /></head>
      <body>
        <title>Gangguan halaman | Seputar Jaminan by ruwang</title>
        <ThemeProvider><UnexpectedErrorPage retry={reset} /></ThemeProvider>
      </body>
    </html>
  );
}
