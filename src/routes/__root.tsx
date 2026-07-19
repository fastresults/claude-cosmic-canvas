import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  Outlet,
  Link,
  createRootRouteWithContext,
  useRouter,
  HeadContent,
  Scripts,
} from "@tanstack/react-router";
import { useEffect, type ReactNode } from "react";

// Side-effect font imports — loaded once at the root.
import "@fontsource/instrument-serif/400.css";
import "@fontsource/inter-tight/400.css";
import "@fontsource/inter-tight/500.css";
import "@fontsource/inter-tight/600.css";
import "@fontsource/inter-tight/700.css";

import appCss from "../styles.css?url";
import { reportLovableError } from "../lib/lovable-error-reporting";
import { supabase } from "@/integrations/supabase/client";
import { ConfirmDialogProvider } from "@/components/confirm-dialog";
import { PromptDialogProvider } from "@/components/prompt-dialog";
import { ThemeProvider } from "@/lib/theme/ThemeProvider";
import { themeBootScript } from "@/lib/theme/theme";


function NotFoundComponent() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-md text-center">
        <h1 className="font-display text-7xl text-foreground">404</h1>
        <h2 className="mt-4 font-display text-2xl text-foreground">Off the map</h2>
        <p className="mt-2 text-sm text-muted-foreground">
          Nothing here yet. Head back to the orb.
        </p>
        <div className="mt-6">
          <Link
            to="/"
            className="inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:opacity-90"
          >
            Back to Eve
          </Link>
        </div>
      </div>
    </div>
  );
}

function ErrorComponent({ error, reset }: { error: Error; reset: () => void }) {
  console.error(error);
  const router = useRouter();
  useEffect(() => {
    reportLovableError(error, { boundary: "tanstack_root_error_component" });
  }, [error]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-md text-center">
        <h1 className="font-display text-2xl text-foreground">
          Something didn't land
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">
          A signal dropped. Try again, or head home.
        </p>
        <div className="mt-6 flex flex-wrap justify-center gap-2">
          <button
            onClick={() => {
              router.invalidate();
              reset();
            }}
            className="inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:opacity-90"
          >
            Try again
          </button>
          <a
            href="/"
            className="inline-flex items-center justify-center rounded-md border border-border bg-background px-4 py-2 text-sm font-medium text-foreground transition-colors hover:bg-secondary"
          >
            Home
          </a>
        </div>
      </div>
    </div>
  );
}

export const Route = createRootRouteWithContext<{ queryClient: QueryClient }>()({
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      { name: "viewport", content: "width=device-width, initial-scale=1, viewport-fit=cover" },
      { name: "theme-color", content: "#08060f" },
      { title: "Eve OS — Speak once. Publish everywhere." },
      {
        name: "description",
        content:
          "Voice-first AI content OS. Hold the orb, say one sentence, and Eve produces a voice-matched draft, image, and scheduled post — with a living Second Brain that shows exactly where every generation came from.",
      },
      { property: "og:title", content: "Eve OS — Speak once. Publish everywhere." },
      {
        property: "og:description",
        content:
          "Voice-first AI content OS. Hold the orb, say one sentence, and Eve produces a voice-matched draft, image, and scheduled post — with a living Second Brain that shows exactly where every generation came from.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
      { name: "twitter:title", content: "Eve OS — Speak once. Publish everywhere." },
      {
        name: "twitter:description",
        content: "Voice-first AI content OS. Hold the orb, say one sentence, and Eve produces a voice-matched draft, image, and scheduled post — with a living Second Brain that shows exactly where every generation came from.",
      },
      { property: "og:image", content: "https://pub-bb2e103a32db4e198524a2e9ed8f35b4.r2.dev/2ada0bcf-99cb-4cc0-bb62-c8afe57fa885/id-preview-70aa527a--becd050e-6f8c-4768-aebd-94a443c94a9a.lovable.app-1783588533388.png" },
      { name: "twitter:image", content: "https://pub-bb2e103a32db4e198524a2e9ed8f35b4.r2.dev/2ada0bcf-99cb-4cc0-bb62-c8afe57fa885/id-preview-70aa527a--becd050e-6f8c-4768-aebd-94a443c94a9a.lovable.app-1783588533388.png" },
    ],
    links: [
      { rel: "stylesheet", href: appCss },
      { rel: "icon", href: "/favicon.ico", type: "image/x-icon" },
      { rel: "manifest", href: "/manifest.webmanifest" },
      { rel: "preconnect", href: "https://fonts.googleapis.com" },
      { rel: "preconnect", href: "https://fonts.gstatic.com", crossOrigin: "anonymous" },
      {
        rel: "stylesheet",
        href: "https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap",
      },
    ],
  }),
  shellComponent: RootShell,
  component: RootComponent,
  notFoundComponent: NotFoundComponent,
  errorComponent: ErrorComponent,
});

function RootShell({ children }: { children: ReactNode }) {
  // suppressHydrationWarning on <html>: the themeBootScript intentionally
  // mutates className/style before React hydrates to prevent FOUC. Without
  // this, React logs a hydration mismatch on every load.
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeBootScript }} />
        <HeadContent />
      </head>
      <body className="bg-background text-foreground" suppressHydrationWarning>
        {children}
        <Scripts />
      </body>
    </html>
  );
}


function RootComponent() {
  const { queryClient } = Route.useRouteContext();
  const router = useRouter();

  // Single auth listener — keeps router + query cache honest on identity transitions.
  useEffect(() => {
    const { data } = supabase.auth.onAuthStateChange((event) => {
      if (event !== "SIGNED_IN" && event !== "SIGNED_OUT" && event !== "USER_UPDATED") return;
      router.invalidate();
      if (event !== "SIGNED_OUT") queryClient.invalidateQueries();
    });
    return () => data.subscription.unsubscribe();
  }, [router, queryClient]);

  return (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider>
        <ConfirmDialogProvider>
          <PromptDialogProvider>
            <Outlet />
          </PromptDialogProvider>
        </ConfirmDialogProvider>
      </ThemeProvider>
    </QueryClientProvider>
  );

}
