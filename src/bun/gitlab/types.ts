import type { CurrentUser } from "../../shared/types";

/** Rohe GitLab-Issue-Form (Teilmenge der REST-API v4 / GraphQL). */
export interface GitLabIssue {
  iid: number;
  globalId: number; // globale Issue-ID (aus der GraphQL-GID), für timelogCreate
  project_id: number; // Pflichtfeld am globalen /issues-Endpoint (projektübergreifend)
  title: string;
  state: string; // "opened" | "closed"
  web_url: string;
  updated_at: string;
  userNotesCount: number; // Anzahl der GitLab-Kommentare (REST: user_notes_count)
  assignees: Array<{ id: number; username: string; name: string }>;
  time_stats?: {
    time_estimate: number; // Sekunden
    total_time_spent: number; // Sekunden
  };
  description: string | null; // Markdown der Issue-Beschreibung
  descriptionHtml: string | null; // von GitLab gerendertes HTML der Beschreibung
  labels: Array<{ title: string; color: string }>;
  author: { username: string; name: string } | null;
  milestoneTitle: string | null;
  dueDate: string | null; // ISO-Date (YYYY-MM-DD) oder null
  issueCreatedAt: string; // ISO-UTC der Issue-Erstellung in GitLab
}

/** Rohe GitLab-Projekt-Form (Teilmenge). `fullPath` kodiert die Gruppenhierarchie. */
export interface GitLabProject {
  id: number; // numerische Projekt-ID (aus der GID)
  fullPath: string; // z.B. "acme/backend/api-service"
  name: string; // Anzeigename des Projekts
}

/**
 * Identifiziert das Issue, auf das gebucht wird. `issueGlobalId` ist die globale
 * GitLab-ID (für die GraphQL-GID bei timelogCreate); `projectId`/`issueIid`
 * dienen dem Idempotenz-Lookup über die projektweite timelogs-Query.
 */
export interface TimelogTarget {
  projectId: number;
  issueIid: number;
  issueGlobalId: number;
}

/** Rohe GitLab-Kommentar-Form (Note) eines Issues (GraphQL discussions-Connection). */
export interface GitLabComment {
  noteId: number;
  discussionId: string; // Hash-Teil der Discussion-GID; gruppiert Reply-Threads
  authorUsername: string;
  authorName: string;
  body: string;
  bodyHtml: string;
  system: boolean;
  createdAt: string;
  updatedAt: string;
}

/** Rohe GitLab-Commit-Form (REST /repository/commits Endpoint). */
export interface GitLabCommit {
  id: string; // volles SHA
  short_id: string;
  title: string;
  author_name: string;
  created_at: string;
  web_url: string;
}

export interface GitLabClient {
  /** Projektübergreifend: alle für den Token erreichbaren Issues. */
  fetchIssues(since?: Date): Promise<GitLabIssue[]>;
  fetchIssue(projectId: number, issueIid: number): Promise<GitLabIssue | null>;
  /** Alle Projekte, in denen der Token-User Mitglied ist (für Metadaten/Hierarchie). */
  fetchProjects(): Promise<GitLabProject[]>;
  /** Legt einen Timelog (mit Summary, ohne Kommentar) an; gibt die Timelog-ID zurück. */
  createTimelog(
    target: TimelogTarget,
    durationMinutes: number,
    spentAt: string,
    summary: string,
  ): Promise<number>;
  /** Sucht einen bereits existierenden, identischen Timelog (Doppelbuchungs-Schutz). */
  findTimelog(
    target: TimelogTarget,
    durationMinutes: number,
    spentAt: string,
    summary: string,
  ): Promise<number | null>;
  /** Entfernt einen Timelog wieder (für Korrektur-Buchungen). */
  deleteTimelog(timelogId: number): Promise<void>;
  /** Commits eines Projekts im Zeitfenster (REST). */
  fetchCommits(
    projectId: number,
    since: string,
    until: string,
    author: string,
  ): Promise<GitLabCommit[]>;
  /** Gibt id/username/name des Token-Besitzers zurueck (gecacht). */
  fetchCurrentUser(): Promise<CurrentUser>;
  /** Leert den in-memory Current-User-Cache (nach Token-Wechsel). */
  clearCurrentUserCache(): void;
  /** Alle Kommentare (Notes) eines Issues (GraphQL, Cursor-Pagination über alle Seiten). */
  fetchTicketComments(projectFullPath: string, issueIid: number): Promise<GitLabComment[]>;
  /**
   * Holt eine GitLab-Upload-Datei (Bild) mit Token und gibt Content-Type sowie
   * die base64-kodierten Bytes zurück. `src` ist die rohe URL aus gerendertem
   * GitLab-HTML (relativ oder absolut, same-origin).
   */
  fetchUpload(src: string): Promise<{ contentType: string; base64: string }>;
}

/** Test-Double — der einzige legitime Mock im Projekt. */
export class FakeGitLabClient implements GitLabClient {
  currentUser: CurrentUser = { id: 1, username: "testuser", name: "Test User" };
  createCalls: Array<{
    target: TimelogTarget;
    durationMinutes: number;
    spentAt: string;
    summary: string;
  }> = [];
  deleteCalls: number[] = [];
  /** In GitLab "gespeicherte" Timelogs — Grundlage für findTimelog. */
  timelogs: Array<{
    projectId: number;
    issueIid: number;
    durationMinutes: number;
    spentAt: string;
    summary: string;
    timelogId: number;
  }> = [];
  issuesToReturn: GitLabIssue[] = [];
  projectsToReturn: GitLabProject[] = [];
  createShouldThrow: Error | null = null;
  deleteShouldThrow: Error | null = null;
  commitsToReturn: GitLabCommit[] = [];
  commentsToReturn: GitLabComment[] = [];
  nextTimelogId = 500;
  clearCurrentUserCacheCalls = 0;
  uploadToReturn: { contentType: string; base64: string } | null = null;
  uploadShouldThrow: Error | null = null;

  async fetchIssues(): Promise<GitLabIssue[]> {
    return this.issuesToReturn;
  }

  async fetchIssue(): Promise<GitLabIssue | null> {
    return this.issuesToReturn[0] ?? null;
  }

  async fetchProjects(): Promise<GitLabProject[]> {
    return this.projectsToReturn;
  }

  async createTimelog(
    target: TimelogTarget,
    durationMinutes: number,
    spentAt: string,
    summary: string,
  ): Promise<number> {
    if (this.createShouldThrow) throw this.createShouldThrow;
    const timelogId = this.nextTimelogId++;
    this.createCalls.push({ target, durationMinutes, spentAt, summary });
    this.timelogs.push({
      projectId: target.projectId,
      issueIid: target.issueIid,
      durationMinutes,
      spentAt,
      summary,
      timelogId,
    });
    return timelogId;
  }

  async findTimelog(
    target: TimelogTarget,
    durationMinutes: number,
    spentAt: string,
    summary: string,
  ): Promise<number | null> {
    const hit = this.timelogs.find(
      (t) =>
        t.projectId === target.projectId &&
        t.issueIid === target.issueIid &&
        t.durationMinutes === durationMinutes &&
        t.spentAt === spentAt &&
        t.summary === summary,
    );
    return hit ? hit.timelogId : null;
  }

  async deleteTimelog(timelogId: number): Promise<void> {
    if (this.deleteShouldThrow) throw this.deleteShouldThrow;
    this.deleteCalls.push(timelogId);
    this.timelogs = this.timelogs.filter((t) => t.timelogId !== timelogId);
  }

  async fetchCommits(
    _projectId: number,
    _since: string,
    _until: string,
    _author: string,
  ): Promise<GitLabCommit[]> {
    return this.commitsToReturn;
  }

  async fetchCurrentUser(): Promise<CurrentUser> {
    return this.currentUser;
  }

  clearCurrentUserCache(): void {
    this.clearCurrentUserCacheCalls++;
  }

  async fetchTicketComments(): Promise<GitLabComment[]> {
    return this.commentsToReturn;
  }

  async fetchUpload(): Promise<{ contentType: string; base64: string }> {
    if (this.uploadShouldThrow) throw this.uploadShouldThrow;
    if (!this.uploadToReturn) throw new Error("FakeGitLabClient: uploadToReturn nicht gesetzt");
    return this.uploadToReturn;
  }
}
