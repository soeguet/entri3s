import type { Repository } from "../repository";
import type { GitLabClient, GitLabIssue } from "../gitlab/types";
import type { TicketUpsert } from "../repository/ticket";
import type { TicketState } from "../../shared/types";
import type { AppEmitter } from "../app/emitter";
import { createLogger } from "../lib/logger";

const SYNC_SCHEDULE = "gitlab_sync";
const log = createLogger("sync");

function ninetyDaysAgo(now: Date = new Date()): Date {
  return new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000);
}

function isOrphanState(state: string): boolean {
  return state === "closed" || state === "locked";
}

function toUpsert(issue: GitLabIssue): TicketUpsert {
  return {
    gitlabIid: issue.iid,
    gitlabGlobalId: issue.globalId,
    projectId: issue.project_id,
    title: issue.title,
    state: issue.state as TicketState,
    timeEstimate: issue.time_stats?.time_estimate ?? null,
    timeSpent: issue.time_stats?.total_time_spent ?? null,
    webUrl: issue.web_url,
    notesCount: issue.userNotesCount ?? 0,
    description: issue.description ?? null,
    descriptionHtml: issue.descriptionHtml ?? null,
    authorUsername: issue.author?.username ?? null,
    authorName: issue.author?.name ?? null,
    milestoneTitle: issue.milestoneTitle ?? null,
    labels: issue.labels ?? [],
    dueDate: issue.dueDate ?? null,
    issueCreatedAt: issue.issueCreatedAt ?? null,
  };
}

export function createSyncService(repo: Repository, gl: GitLabClient, emit: AppEmitter) {
  // Verhindert, dass manueller Trigger und Scheduler gleichzeitig syncen.
  let syncing = false;

  /**
   * Projektübergreifender Sync: holt alle für den Token erreichbaren Issues
   * (globaler /issues-Endpoint) und schreibt sie pro Projekt in die Tickets.
   */
  async function syncIssues(): Promise<{ synced: number; orphaned: number }> {
    if (syncing) {
      log.warn("Sync läuft bereits — Aufruf übersprungen");
      return { synced: 0, orphaned: 0 };
    }
    syncing = true;
    try {
      const schedule = repo.schedules.get(SYNC_SCHEDULE);
      const since = schedule?.lastRun ? new Date(schedule.lastRun) : ninetyDaysAgo();
      log.info("Sync gestartet", { since: since.toISOString(), incremental: !!schedule?.lastRun });

      // Projekt-Metadaten zuerst persistieren — daraus leitet das Frontend den
      // Gruppenbaum (fullPath) ab und zeigt Projektnamen statt nur project_id.
      const projects = await gl.fetchProjects();
      for (const project of projects) repo.projects.upsert(project);
      log.info("Projekte gesynct", { count: projects.length });

      // Current User einmalig laden + bei Token-Änderung (Konzept). Fehler hier
      // darf den Sync nicht abbrechen.
      try {
        if (repo.settings.getCurrentUser() === null) {
          repo.settings.setCurrentUser(await gl.fetchCurrentUser());
        }
      } catch (e) {
        log.warn("Current User konnte nicht geladen werden", {
          error: e instanceof Error ? e.message : String(e),
        });
      }

      const issues = await gl.fetchIssues(since);
      let orphaned = 0;
      for (const issue of issues) {
        repo.tickets.upsert(toUpsert(issue));
        const ticket = repo.tickets.getByGitLabIid(issue.iid, issue.project_id);
        if (ticket) {
          repo.tickets.setAssignees(
            ticket.id,
            issue.assignees.map((a) => ({
              gitlabUserId: a.id,
              username: a.username,
              name: a.name,
            })),
          );
        }
        if (isOrphanState(issue.state)) {
          repo.tickets.markOrphaned(issue.iid, issue.project_id);
          orphaned++;
        } else {
          // Wieder geöffnete Issues, die zuvor orphaned waren, reaktivieren.
          repo.tickets.markActive(issue.iid, issue.project_id);
        }
      }

      repo.schedules.updateLastRun(SYNC_SCHEDULE);
      log.info("Sync abgeschlossen", { synced: issues.length, orphaned });
      return { synced: issues.length, orphaned };
    } finally {
      syncing = false;
    }
  }

  return {
    syncIssues,

    /** Read-only: ob gerade ein Sync läuft (In-Memory-Flag) — für die Statusanzeige. */
    isSyncing(): boolean {
      return syncing;
    },

    /**
     * Manueller Sync: stösst den Sync im Hintergrund an und kehrt sofort zurück,
     * damit der RPC-Call nicht über sein Timeout läuft. Ergebnis/Fehler kommen
     * über die syncCompleted/syncFailed/orphanDetected-Events ans Frontend.
     */
    triggerSync(): void {
      void (async () => {
        try {
          const result = await syncIssues();
          emit.syncCompleted();
          if (result.orphaned > 0) emit.orphanDetected(result.orphaned);
        } catch (e) {
          const message = e instanceof Error ? e.message : String(e);
          log.error("Sync fehlgeschlagen", { error: message });
          emit.syncFailed(message);
        }
      })();
    },

    /** Vollabgleich: aktive Tickets, die GitLab nicht mehr (offen) zurückgibt → orphaned. */
    async checkOrphans(): Promise<number> {
      const issues = await gl.fetchIssues();
      const liveKeys = new Set(
        issues.filter((i) => !isOrphanState(i.state)).map((i) => `${i.project_id}:${i.iid}`),
      );

      let orphaned = 0;
      for (const ticket of repo.tickets.list({ status: "active" })) {
        if (!liveKeys.has(`${ticket.projectId}:${ticket.gitlabIid}`)) {
          repo.tickets.markOrphaned(ticket.gitlabIid, ticket.projectId);
          orphaned++;
        }
      }
      return orphaned;
    },
  };
}

export type SyncService = ReturnType<typeof createSyncService>;
