import { useEffect } from "react";
import { useRouter, type ErrorComponentProps } from "@tanstack/react-router";
import { reportLovableError } from "@/lib/lovable-error-reporting";

/** Per-page error card. Renders inside the app shell so nav stays usable. */
export function RouteError({ error, reset }: ErrorComponentProps) {
  const router = useRouter();
  useEffect(() => {
    console.error(error);
    reportLovableError(error, { boundary: "tanstack_route_error_component" });
  }, [error]);
  const message = error instanceof Error ? error.message : null;

  return (
    <div className="mx-auto flex max-w-md flex-col items-center px-4 py-16 text-center">
      <h2 className="font-display text-xl text-foreground">Something went wrong on this page</h2>
      <p className="mt-2 text-sm text-muted-foreground">
        {message ?? "A signal dropped. Try again in a moment."}
      </p>
      <button
        onClick={() => {
          void router.invalidate();
          reset();
        }}
        className="mt-6 inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:opacity-90"
      >
        Try again
      </button>
    </div>
  );
}
