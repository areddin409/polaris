"use client";

import { Button } from "@/components/ui/button";
import { useState } from "react";
import * as Sentry from "@sentry/nextjs";
import { useAuth } from "@clerk/nextjs";

export default function DemoPage() {
  const { userId } = useAuth();
  const [loading, setLoading] = useState(false);
  const [loadingBackground, setLoadingBackground] = useState(false);

  const handleBlocking = async () => {
    setLoading(true);
    await fetch("/api/demo/blocking", {
      method: "POST",
    });
    setLoading(false);
  };

  const handleBackground = async () => {
    setLoadingBackground(true);
    await fetch("/api/demo/background", {
      method: "POST",
    });
    setLoadingBackground(false);
  };

  const handleClientError = () => {
    Sentry.logger.info(
      `User is about to throw a client-side error for testing purposes.`,
      {
        userId: userId || "unknown",
      }
    );
    throw new Error("This is a test error from the client side.");
  };

  const handleApiError = async () => {
    await fetch("/api/demo/error", {
      method: "POST",
    });
  };

  const handleInngestError = async () => {
    await fetch("/api/demo/inngest-error", {
      method: "POST",
    });
  };

  return (
    <div className="space-x-4 p-8">
      <Button onClick={handleBlocking} disabled={loading}>
        {loading ? "Loading..." : "Blocking"}
      </Button>
      <Button onClick={handleBackground} disabled={loadingBackground}>
        {loadingBackground ? "Loading..." : "Background"}
      </Button>

      <div className="mt-4">
        <Button variant={"destructive"} onClick={handleClientError}>
          Client Error
        </Button>

        <Button
          variant={"destructive"}
          onClick={handleApiError}
          className="ml-4"
        >
          API Error
        </Button>
        <Button
          variant={"destructive"}
          onClick={handleInngestError}
          className="ml-4"
        >
          Inngest Error
        </Button>
      </div>
    </div>
  );
}
