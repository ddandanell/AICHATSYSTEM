"use client";
/**
 * Workspace error boundary. Do not auto-send.
 */

import { Button } from "@/components/ui/button";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";

export default function WorkspaceError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <Alert variant="destructive">
      <AlertTitle>This page failed to load</AlertTitle>
      <AlertDescription>{error.message}</AlertDescription>
      <Button type="button" variant="outline" onClick={reset}>
        Try again
      </Button>
    </Alert>
  );
}
