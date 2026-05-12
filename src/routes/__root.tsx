import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  Outlet,
  Link,
  createRootRouteWithContext,
  useRouter,
  HeadContent,
  Scripts,
} from "@tanstack/react-router";
import { useEffect } from "react";

import appCss from "../styles.css?url";
import { AppSidebar } from "@/components/app-sidebar";
// Dark mode only — no theme toggle. The html element has class="dark" permanently.
import { Bell } from "lucide-react";

function NotFoundComponent() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-md text-center">
        <h1 className="text-7xl font-bold text-foreground">404</h1>
        <h2 className="mt-4 text-xl font-semibold text-foreground">Page not found</h2>
        <p className="mt-2 text-sm text-muted-foreground">
          The page you're looking for doesn't exist or has been moved.
        </p>
        <div className="mt-6">
          <Link
            to="/"
            className="inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
          >
            Go to dashboard
          </Link>
        </div>
      </div>
    </div>
  );
}

function ErrorComponent({ error, reset }: { error: Error; reset: () => void }) {
  console.error(error);
  const router = useRouter();
  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-md text-center">
        <h1 className="text-xl font-semibold">Something went wrong</h1>
        <p className="mt-2 text-sm text-muted-foreground">{error.message}</p>
        <button
          onClick={() => {
            router.invalidate();
            reset();
          }}
          className="mt-4 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground"
        >
          Try again
        </button>
      </div>
    </div>
  );
}

export const Route = createRootRouteWithContext<{ queryClient: QueryClient }>()({
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      { name: "viewport", content: "width=device-width, initial-scale=1" },
      { title: "Agentic OS — operator console" },
      {
        name: "description",
        content:
          "Personal AI operator console — read-only dashboard for my Claude Code, skills, memory, and daily Dream review.",
      },
      { property: "og:title", content: "Agentic OS — operator console" },
      { name: "twitter:title", content: "Agentic OS — operator console" },
      {
        property: "og:description",
        content:
          "Personal AI operator console — read-only dashboard for my Claude Code, skills, memory, and daily Dream review.",
      },
      {
        name: "twitter:description",
        content:
          "Personal AI operator console — read-only dashboard for my Claude Code, skills, memory, and daily Dream review.",
      },
      { name: "twitter:card", content: "summary_large_image" },
      { property: "og:type", content: "website" },
      {
        property: "og:image",
        content: "https://raw.githubusercontent.com/sasdsamatt123/agentic-os/main/docs/og.png",
      },
      {
        name: "twitter:image",
        content: "https://raw.githubusercontent.com/sasdsamatt123/agentic-os/main/docs/og.png",
      },
    ],
    links: [
      { rel: "stylesheet", href: appCss },
      { rel: "icon", type: "image/svg+xml", href: "/favicon.svg" },
    ],
  }),
  shellComponent: RootShell,
  component: RootComponent,
  notFoundComponent: NotFoundComponent,
  errorComponent: ErrorComponent,
});

function RootShell({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className="dark">
      <head>
        <HeadContent />
      </head>
      <body>
        {children}
        <Scripts />
      </body>
    </html>
  );
}

function RootComponent() {
  const { queryClient } = Route.useRouteContext();

  // Dark mode is permanent — set in RootShell's <html className="dark">

  return (
    <QueryClientProvider client={queryClient}>
      <div className="flex min-h-screen w-full bg-background text-foreground">
        <AppSidebar />
        <div className="flex flex-1 min-w-0 flex-col">
          <header className="sticky top-0 z-30 flex h-14 items-center justify-between border-b border-border bg-background/85 px-4 backdrop-blur-md md:px-6">
            <div className="flex items-center gap-2.5 text-sm">
              <span className="font-medium tracking-tight">Operator</span>
              <span className="text-muted-foreground/50">/</span>
              <span className="text-muted-foreground tracking-tight">local</span>
            </div>
            <div className="flex items-center gap-1.5">
              <button className="rounded-md p-2 text-muted-foreground hover:bg-accent hover:text-foreground transition-colors">
                <Bell className="h-4 w-4" />
              </button>
              {/* Dark mode only — no theme toggle */}
            </div>
          </header>
          <main className="flex-1 overflow-x-hidden p-4 md:p-6">
            <Outlet />
          </main>
        </div>
      </div>
    </QueryClientProvider>
  );
}
