import type { Project } from "../../../../shared/types";

export const projectFixtures: Project[] = [
  {
    id: 42,
    fullPath: "acme/backend/api-service",
    name: "API Service",
    syncedAt: "2024-01-15T08:00:00.000Z",
  },
  { id: 43, fullPath: "acme/backend/worker", name: "Worker", syncedAt: "2024-01-15T08:00:00.000Z" },
  {
    id: 44,
    fullPath: "acme/frontend/web-app",
    name: "Web App",
    syncedAt: "2024-01-15T08:00:00.000Z",
  },
];
