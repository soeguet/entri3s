import { createRoute, createRouter, redirect } from "@tanstack/react-router";
import { rootRoute } from "./__root";
import { EntriesPage } from "../features/entries/EntriesPage";
import { TicketsPage } from "../features/tickets/TicketsPage";
import { ticketsSearchSchema } from "../features/tickets/ticketsSearch";
import { TicketDetailPage } from "../features/tickets/TicketDetailPage";
import { ManagementPage } from "../features/management/ManagementPage";
import { SettingsPage } from "../features/settings/SettingsPage";
import { BookingPage } from "../features/booking/BookingPage";
import { TodosPage } from "../features/todos/TodosPage";

const indexRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/",
  beforeLoad: () => {
    throw redirect({ to: "/entries" });
  },
});

const entriesRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/entries",
  component: EntriesPage,
});

const ticketsRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/tickets",
  component: TicketsPage,
  validateSearch: ticketsSearchSchema,
});

const ticketDetailRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/tickets/$ticketId",
  component: TicketDetailPage,
});

const bookingRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/booking",
  component: BookingPage,
});

const todosRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/todos",
  component: TodosPage,
});

const managementRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/management",
  component: ManagementPage,
});

const settingsRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/settings",
  component: SettingsPage,
});

const routeTree = rootRoute.addChildren([
  indexRoute,
  entriesRoute,
  ticketsRoute,
  ticketDetailRoute,
  bookingRoute,
  todosRoute,
  managementRoute,
  settingsRoute,
]);

export const router = createRouter({ routeTree });

declare module "@tanstack/react-router" {
  interface Register {
    router: typeof router;
  }
}
