import type { Repository } from "../repository";
import type { GitLabClient, GitLabIssue } from "../gitlab/types";
import type { TicketUpsert } from "../repository/ticket";
import type { TicketState } from "../../shared/types";
import { appError } from "../lib/app-error";

const SYNC_SCHEDULE = "gitlab_sync";

function ninetyDaysAgo(now: Date = new Date()): Date {
  return new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000);
}

function isOrphanState(state: string): boolean {
  return state === "closed" || state === "locked";
}

function toUpsert(issue: GitLabIssue, projectId: number): TicketUpsert {
  return {
    gitlabIid: issue.iid,
    projectId,
    title: issue.title,
    state: issue.state as TicketState,
    timeEstimate: issue.time_stats?.time_estimate ?? null,
    timeSpent: issue.time_stats?.total_time_spent ?? null,
    webUrl: issue.web_url,
  };
}

export function createSyncService(repo: Repository, gl: GitLabClient) {
  async function syncIssues(projectId: number): Promise<{ synced: number; orphaned: number }> {
    const schedule = repo.schedules.get(SYNC_SCHEDULE);
    const since = schedule?.lastRun ? new Date(schedule.lastRun) : ninetyDaysAgo();

    const issues = await gl.fetchIssues(projectId, since);
    let orphaned = 0;
    for (const issue of issues) {
      repo.tickets.upsert(toUpsert(issue, projectId));
      if (isOrphanState(issue.state)) {
        repo.tickets.markOrphaned(issue.iid, projectId);
        orphaned++;
      } else {
        // Wieder geöffnete Issues, die zuvor orphaned waren, reaktivieren.
        repo.tickets.markActive(issue.iid, projectId);
      }
    }

    repo.schedules.updateLastRun(SYNC_SCHEDULE);
    return { synced: issues.length, orphaned };
  }

  return {
    syncIssues,

    /** Manueller Sync für das aktuell konfigurierte Projekt. */
    async triggerSync(): Promise<{ synced: number; orphaned: number }> {
      const projectId = repo.settings.getAll().projectId;
      if (!projectId) {
        throw appError("NO_PROJECT", "Kein GitLab-Projekt konfiguriert", false);
      }
      return syncIssues(projectId);
    },

    /** Vollabgleich: aktive Tickets, die GitLab nicht mehr (offen) zurückgibt → orphaned. */
    async checkOrphans(projectId: number): Promise<number> {
      const issues = await gl.fetchIssues(projectId);
      const liveIids = new Set(issues.filter((i) => !isOrphanState(i.state)).map((i) => i.iid));

      let orphaned = 0;
      for (const ticket of repo.tickets.list({ status: "active" })) {
        if (ticket.projectId === projectId && !liveIids.has(ticket.gitlabIid)) {
          repo.tickets.markOrphaned(ticket.gitlabIid, projectId);
          orphaned++;
        }
      }
      return orphaned;
    },
  };
}

export type SyncService = ReturnType<typeof createSyncService>;
