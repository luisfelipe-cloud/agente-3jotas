"use client";

import { ErrorState } from "@/components/ErrorState";

export default function Error({
  error,
  unstable_retry,
}: {
  error: Error & { digest?: string };
  unstable_retry: () => void;
}) {
  return <ErrorState error={error} onTentarNovamente={unstable_retry} />;
}
