import type { Repository } from "../repository";
import type { GitLabClient } from "../gitlab/types";
import type { Commit, Project } from "../../shared/types";
import { appError } from "../lib/app-error";
import { createLogger } from "../lib/logger";

const log = createLogger("commit");

/**
 * Obergrenze für die Anzahl abgefragter Projekte. Verhindert, dass der
 * Rate-Limiter (5 req/s) das harte RPC-Limit (10s) reisst — selbst im
 * Worst Case (10 * 200ms = 2s) bleibt genug Puffer.
 */
const DEFAULT_MAX_PROJECTS = 10;

/**
 * Eigenes Zeitbudget, bewusst < maxRequestTime (10_000ms in handlers.ts),
 * damit der Service VOR dem RPC-Layer abbricht und einen sauberen AppError
 * liefert statt eines stummen RPC-Timeouts.
 */
const DEFAULT_BUDGET_MS = 8_000;

export interface CommitServiceOptions {
  budgetMs?: number;
  maxProjects?: number;
}

export function createCommitService(
  repo: Repository,
  gl: GitLabClient,
  options?: CommitServiceOptions,
) {
  const budgetMs = options?.budgetMs ?? DEFAULT_BUDGET_MS;
  const maxProjects = options?.maxProjects ?? DEFAULT_MAX_PROJECTS;

  /**
   * Ermittelt die relevanten Projekt-IDs für die Commit-Abfrage, statt blind
   * alle Org-Projekte zu laden. Dreistufig:
   * 1. Projekte der Tickets an den Entries dieses Tages.
   * 2. Projekte aller Tickets, die der User je an Entries gehängt hat.
   * 3. Alle lokal gesyncten Projekte (letzter Ausweg).
   * Ergebnis wird auf maxProjects gekappt.
   */
  function selectRelevantProjects(date: string): Project[] {
    const since = `${date}T00:00:00Z`;
    const until = `${date}T23:59:59Z`;

    // Stufe 1: Projekte der Tickets an den Entries DIESES Tages
    const todayEntries = repo.entries.list({ dateFrom: since, dateTo: until });
    const todayTicketIds = [...new Set(todayEntries.flatMap((e) => e.ticketIds))];
    if (todayTicketIds.length > 0) {
      const projectIds = repo.tickets.projectIdsForTickets(todayTicketIds);
      if (projectIds.length > 0) {
        return projectsFromIds(projectIds);
      }
    }

    // Stufe 2: Projekte ALLER jemals an Entries gehängten Tickets
    const allEntries = repo.entries.list({});
    const allTicketIds = [...new Set(allEntries.flatMap((e) => e.ticketIds))];
    if (allTicketIds.length > 0) {
      const projectIds = repo.tickets.projectIdsForTickets(allTicketIds);
      if (projectIds.length > 0) {
        return projectsFromIds(projectIds);
      }
    }

    // Stufe 3: Alle lokal gesyncten Projekte (letzter Ausweg)
    return repo.projects.list().slice(0, maxProjects);
  }

  /** Holt Project-Objekte für IDs, gekappt auf maxProjects. */
  function projectsFromIds(ids: number[]): Project[] {
    const capped = ids.slice(0, maxProjects);
    return capped.map((id) => repo.projects.getById(id)).filter((p): p is Project => p !== null);
  }

  return {
    async getForDate(date: string): Promise<Commit[]> {
      const projects = selectRelevantProjects(date);
      if (projects.length === 0) return [];

      const since = `${date}T00:00:00Z`;
      const until = `${date}T23:59:59Z`;

      const author = (await gl.fetchCurrentUser()).username;

      // In-flight Requests werden bei Timeout verworfen (kein AbortController);
      // bewusste KISS-Entscheidung — durch die Eingrenzung oben ist der Timeout
      // ohnehin selten.
      const fetchPromise = Promise.allSettled(
        projects.map((p: Project) => gl.fetchCommits(p.id, since, until, author)),
      );
      const timeoutPromise = new Promise<"timeout">((resolve) =>
        setTimeout(() => resolve("timeout"), budgetMs),
      );

      const raceResult = await Promise.race([fetchPromise, timeoutPromise]);
      if (raceResult === "timeout") {
        throw appError(
          "TIMEOUT",
          "Commits laden hat zu lange gedauert, bitte erneut versuchen",
          true,
        );
      }

      const results = raceResult;
      const commits: Commit[] = [];
      for (let i = 0; i < results.length; i++) {
        const result = results[i];
        if (result.status === "fulfilled") {
          for (const c of result.value) {
            commits.push({
              hash: c.id,
              shortHash: c.short_id,
              title: c.title,
              authorName: c.author_name,
              createdAt: c.created_at,
              webUrl: c.web_url,
              projectId: projects[i].id,
            });
          }
        } else {
          log.warn(`Commits für Projekt ${projects[i].id} fehlgeschlagen`, {
            error: String(result.reason),
          });
        }
      }

      commits.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
      return commits;
    },
  };
}
