import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  Outlet,
  Link,
  createRootRouteWithContext,
  useRouter,
  HeadContent,
  Scripts,
  type ErrorComponentProps,
  redirect,
} from "@tanstack/react-router";
import { useEffect, type ReactNode } from "react";

import appCss from "../styles.css?url";
import { AuthProvider } from "@/hooks/use-auth";
import { SiteHeader } from "@/components/SiteHeader";
import { SecretQuestEffects } from "@/components/SecretQuestEffects";
import { AuctionEffects } from "@/components/AuctionEffects";
import { BetaGate } from "@/components/BetaGate";
import { Toaster } from "@/components/ui/sonner";
import { reportLovableError } from "../lib/lovable-error-reporting";
import { isOAuthCallbackPath } from "@/lib/auth";
import { useSyncRarityOverrides } from "@/hooks/use-sync-rarity-overrides";

function NotFoundComponent() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-md text-center">
        <h1 className="text-7xl font-bold text-foreground">404</h1>
        <h2 className="mt-4 text-xl font-semibold text-foreground">Page introuvable</h2>
        <p className="mt-2 text-sm text-muted-foreground">
          Cette page n'existe pas ou a été déplacée.
        </p>
        <div className="mt-6">
          <Link
            to="/"
            className="inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
          >
            Retour à l'accueil
          </Link>
        </div>
      </div>
    </div>
  );
}

function ErrorComponent({ error, reset }: ErrorComponentProps) {
  console.error(error);
  const router = useRouter();
  useEffect(() => {
    reportLovableError(error, { boundary: "tanstack_root_error_component" });
  }, [error]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-md text-center">
        <h1 className="text-xl font-semibold tracking-tight text-foreground">
          Cette page n'a pas pu se charger
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Un problème est survenu. Réessaie ou retourne à l'accueil.
        </p>
        {error ? <pre className="mt-3 max-w-full overflow-x-auto rounded bg-muted/60 p-2 text-left text-xs text-destructive">{error instanceof Error ? error.message : String(error)}</pre> : null}
        <div className="mt-6 flex flex-wrap justify-center gap-2">
          <button
            onClick={() => {
              router.invalidate();
              reset();
            }}
            className="inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
          >
            Réessayer
          </button>
          <a
            href="/"
            className="inline-flex items-center justify-center rounded-md border border-input bg-background px-4 py-2 text-sm font-medium text-foreground transition-colors hover:bg-accent"
          >
            Retour à l'accueil
          </a>
        </div>
      </div>
    </div>
  );
}

export const Route = createRootRouteWithContext<{ queryClient: QueryClient }>()({
  beforeLoad: ({ location }) => {
    if (isOAuthCallbackPath(location.pathname)) {
      throw redirect({ to: "/", replace: true });
    }
  },
  head: () => ({
    // Replace these placeholders with the app's name and description when first building the app.
    // Each content route, / included, must still set its own head(). Never add og:image or
    // twitter:image here: every page without its own would inherit the root's preview image.
    meta: [
      { charSet: "utf-8" },
      { name: "viewport", content: "width=device-width, initial-scale=1" },
      { title: "Zenkai — Collection de cartes anime" },
      { name: "description", content: "Ouvre des boosters gratuits et collectionne des cartes anime sur Zenkai." },
      { property: "og:title", content: "Zenkai — Collection de cartes anime" },
      { property: "og:description", content: "Ouvre des boosters gratuits et collectionne des cartes anime sur Zenkai." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
    links: [
      {
        rel: "stylesheet",
        href: appCss,
      },
      { rel: "icon", href: "/favicon.ico", type: "image/x-icon" },
      { rel: "preconnect", href: "https://fonts.googleapis.com" },
      { rel: "preconnect", href: "https://fonts.gstatic.com", crossOrigin: "anonymous" },
      {
        rel: "stylesheet",
        href: "https://fonts.googleapis.com/css2?family=Sora:wght@400;500;600;700&family=Unbounded:wght@500;700;900&display=swap",
      },
    ],
  }),
  shellComponent: RootShell,
  component: RootComponent,
  notFoundComponent: NotFoundComponent,
  errorComponent: ErrorComponent,
});

function RootShell({ children }: { children: ReactNode }) {
  return (
    <html lang="fr" className="dark">
      <head>
        <HeadContent />
      </head>
      <body className="overflow-x-clip">
        {children}
        <Scripts />
      </body>
    </html>
  );
}

function RootComponent() {
  const { queryClient } = Route.useRouteContext();

  useSyncRarityOverrides(queryClient);
  useEffect(() => {
    const onErr = (ev: ErrorEvent | PromiseRejectionEvent) => {
      const msg = String("reason" in ev ? ev.reason : ev.message ?? "");
      if (/ChunkLoadError|Loading chunk|Failed to fetch dynamically imported module|Importing a module script failed/i.test(msg)) {
        if (!sessionStorage.getItem("zenkai_auto_reload")) {
          sessionStorage.setItem("zenkai_auto_reload", "1");
          window.location.reload();
        }
      }
    };
    window.addEventListener("error", onErr);
    window.addEventListener("unhandledrejection", onErr);
    return () => { window.removeEventListener("error", onErr); window.removeEventListener("unhandledrejection", onErr); };
  }, []);


  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <BetaGate>
        <SecretQuestEffects />
        <AuctionEffects />
        <SiteHeader />
        <main className="min-w-0 overflow-x-clip pb-[calc(4rem+env(safe-area-inset-bottom))] md:pb-0">
          {/* Required: nested routes render here. Removing <Outlet /> breaks all child routes. */}
          <Outlet />
        </main>
        </BetaGate>
        <Toaster position="top-center" />
      </AuthProvider>
    </QueryClientProvider>
  );
}
