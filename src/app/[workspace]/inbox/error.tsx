/**
 * Inbox route error boundary.
 * Specs: /cursor/stores/bc-5928a827-61d1-4e52-9e4b-2d10bbb58416/docs/inbox-design-system.md
 */
"use client";

import { useEffect } from "react";
import { AlertTriangleIcon } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";

export default function InboxError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <div className="flex min-h-0 flex-1 flex-col items-center justify-center gap-4 p-6">
      <Alert variant="destructive" className="max-w-md">
        <AlertTriangleIcon />
        <AlertTitle>Inbox could not load</AlertTitle>
        <AlertDescription>
          {error.message || "Something went wrong loading the desk. Try again."}
        </AlertDescription>
      </Alert>
      <Button type="button" variant="outline" onClick={reset}>
        Try again
      </Button>
    </div>
  );
}
