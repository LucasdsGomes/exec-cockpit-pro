import { Outlet, Link, createRootRoute, HeadContent, Scripts } from "@tanstack/react-router";

import appCss from "../styles.css?url";
import { AuthProvider } from "@/hooks/useAuth";

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
            Go home
          </Link>
        </div>
      </div>
    </div>
  );
}

export const Route = createRootRoute({
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      { name: "viewport", content: "width=device-width, initial-scale=1" },
      { title: "Hitech Electric — Cockpit Financeiro" },
      { name: "description", content: "Dashboard financeiro-gerencial executivo da Hitech Electric: DRE, Fluxo de Caixa, Ciclo Financeiro e Projeção do Balanço." },
      { name: "author", content: "Hitech Electric" },
      { property: "og:title", content: "Hitech Electric — Cockpit Financeiro" },
      { property: "og:description", content: "Dashboard financeiro-gerencial executivo da Hitech Electric: DRE, Fluxo de Caixa, Ciclo Financeiro e Projeção do Balanço." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { name: "twitter:site", content: "@Lovable" },
      { name: "twitter:title", content: "Hitech Electric — Cockpit Financeiro" },
      { name: "twitter:description", content: "Dashboard financeiro-gerencial executivo da Hitech Electric: DRE, Fluxo de Caixa, Ciclo Financeiro e Projeção do Balanço." },
      { property: "og:image", content: "https://pub-bb2e103a32db4e198524a2e9ed8f35b4.r2.dev/ce35ed9f-25a7-4a11-9cdc-8811c13b6178/id-preview-a6aa2f2e--46625b55-ade5-4a37-932e-8a95254f22e7.lovable.app-1776910962925.png" },
      { name: "twitter:image", content: "https://pub-bb2e103a32db4e198524a2e9ed8f35b4.r2.dev/ce35ed9f-25a7-4a11-9cdc-8811c13b6178/id-preview-a6aa2f2e--46625b55-ade5-4a37-932e-8a95254f22e7.lovable.app-1776910962925.png" },
    ],
    links: [
      {
        rel: "stylesheet",
        href: appCss,
      },
    ],
  }),
  shellComponent: RootShell,
  component: RootComponent,
  notFoundComponent: NotFoundComponent,
});

function RootShell({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
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
  return (
    <AuthProvider>
      <Outlet />
    </AuthProvider>
  );
}
