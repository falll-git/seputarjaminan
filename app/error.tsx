"use client";

import UnexpectedErrorPage from "./components/UnexpectedErrorPage";

type ErrorBoundaryProps = {
  error: Error & { digest?: string };
  reset: () => void;
};

export default function Error({ reset }: ErrorBoundaryProps) {
  return <UnexpectedErrorPage retry={reset} />;
}
