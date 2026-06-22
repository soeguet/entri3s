import { createRootRoute, Link, Outlet } from "@tanstack/react-router";
import { Clock, Ticket, Settings, LayoutGrid, CreditCard } from "lucide-react";
import type { ComponentType } from "react";
import { DailyProgress } from "../features/entries/DailyProgress";
import { BackgroundStatusWidget } from "../features/background/BackgroundStatusWidget";
import { RunningTimerWidget } from "../features/entries/RunningTimerWidget";
import { Toaster } from "../components/ui/toaster";

const NAV: Array<{ to: string; label: string; icon: ComponentType<{ className?: string }> }> = [
  { to: "/entries", label: "Entries", icon: Clock },
  { to: "/tickets", label: "Tickets", icon: Ticket },
  { to: "/booking", label: "Buchungen", icon: CreditCard },
  { to: "/management", label: "Management", icon: LayoutGrid },
  { to: "/settings", label: "Settings", icon: Settings },
];

function RootLayout() {
  return (
    <div className="flex h-screen bg-background text-foreground">
      <aside className="flex w-56 shrink-0 flex-col border-r border-border bg-card">
        <div className="px-5 py-5">
          <span className="text-lg font-bold tracking-tight">entries</span>
        </div>
        <nav className="flex-1 flex-col gap-1 px-3">
          {NAV.map((item) => (
            <Link
              key={item.to}
              to={item.to}
              className="flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium text-muted-foreground hover:bg-muted"
              activeProps={{ className: "bg-primary text-primary-foreground hover:bg-primary" }}
            >
              <item.icon className="h-4 w-4" />
              {item.label}
            </Link>
          ))}
        </nav>

        <DailyProgress />
        <BackgroundStatusWidget />
        <RunningTimerWidget />
      </aside>

      <main className="flex-1 overflow-y-auto">
        <div className="w-full px-8 py-8">
          <Outlet />
        </div>
      </main>

      <Toaster />
    </div>
  );
}

function NotFound() {
  return (
    <div className="py-20 text-center text-muted-foreground">
      <p className="text-2xl font-semibold">404</p>
      <p className="mt-2">Seite nicht gefunden.</p>
      <Link to="/entries" className="mt-4 inline-block text-foreground underline">
        Zu den Entries
      </Link>
    </div>
  );
}

export const rootRoute = createRootRoute({
  component: RootLayout,
  notFoundComponent: NotFound,
});
