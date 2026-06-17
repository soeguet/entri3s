import { createRootRoute, Link, Outlet } from "@tanstack/react-router";
import { Clock, Ticket, Settings, LayoutGrid, CreditCard } from "lucide-react";
import type { ComponentType } from "react";

const NAV: Array<{ to: string; label: string; icon: ComponentType<{ className?: string }> }> = [
  { to: "/entries", label: "Entries", icon: Clock },
  { to: "/tickets", label: "Tickets", icon: Ticket },
  { to: "/booking", label: "Buchungen", icon: CreditCard },
  { to: "/management", label: "Management", icon: LayoutGrid },
  { to: "/settings", label: "Settings", icon: Settings },
];

function RootLayout() {
  return (
    <div className="flex h-screen bg-slate-50 text-slate-900">
      <aside className="flex w-56 shrink-0 flex-col border-r border-slate-200 bg-white">
        <div className="px-5 py-5">
          <span className="text-lg font-bold tracking-tight">entries</span>
        </div>
        <nav className="flex flex-col gap-1 px-3">
          {NAV.map((item) => (
            <Link
              key={item.to}
              to={item.to}
              className="flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium text-slate-600 hover:bg-slate-100"
              activeProps={{ className: "bg-slate-900 text-slate-50 hover:bg-slate-900" }}
            >
              <item.icon className="h-4 w-4" />
              {item.label}
            </Link>
          ))}
        </nav>
      </aside>

      <main className="flex-1 overflow-y-auto">
        <div className="w-full px-8 py-8">
          <Outlet />
        </div>
      </main>
    </div>
  );
}

function NotFound() {
  return (
    <div className="py-20 text-center text-slate-500">
      <p className="text-2xl font-semibold">404</p>
      <p className="mt-2">Seite nicht gefunden.</p>
      <Link to="/entries" className="mt-4 inline-block text-slate-900 underline">
        Zu den Entries
      </Link>
    </div>
  );
}

export const rootRoute = createRootRoute({
  component: RootLayout,
  notFoundComponent: NotFound,
});
