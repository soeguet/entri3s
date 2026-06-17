/** Rohe GitLab-Issue-Form (Teilmenge der REST-API v4). */
export interface GitLabIssue {
  iid: number;
  project_id: number; // Pflichtfeld am globalen /issues-Endpoint (projektübergreifend)
  title: string;
  state: string; // "opened" | "closed"
  web_url: string;
  updated_at: string;
  time_stats?: {
    time_estimate: number; // Sekunden
    total_time_spent: number; // Sekunden
  };
}

/** Rückreferenz auf die in GitLab erzeugte Note (für die bookings-Tabelle). */
export interface GitLabBookingResult {
  noteId: number;
  createdAt: string; // ISO timestamp von GitLab
}

export interface GitLabClient {
  /** Projektübergreifend: alle für den Token erreichbaren Issues (globaler /issues-Endpoint). */
  fetchIssues(since?: Date): Promise<GitLabIssue[]>;
  fetchIssue(projectId: number, issueIid: number): Promise<GitLabIssue | null>;
  bookTime(
    projectId: number,
    issueIid: number,
    durationMinutes: number,
    spentAt: string,
    note: string,
    marker: string,
  ): Promise<GitLabBookingResult>;
  findBookingNote(
    projectId: number,
    issueIid: number,
    marker: string,
  ): Promise<GitLabBookingResult | null>;
}

/** Test-Double — der einzige legitime Mock im Projekt. */
export class FakeGitLabClient implements GitLabClient {
  bookedCalls: Array<{
    projectId: number;
    issueIid: number;
    durationMinutes: number;
    spentAt: string;
    note: string;
    marker: string;
  }> = [];
  /** In GitLab "gespeicherte" Notes — Grundlage für findBookingNote. */
  notes: Array<{
    projectId: number;
    issueIid: number;
    marker: string;
    noteId: number;
    createdAt: string;
  }> = [];
  issuesToReturn: GitLabIssue[] = [];
  bookShouldThrow: Error | null = null;
  nextNoteId = 500;

  async fetchIssues(): Promise<GitLabIssue[]> {
    return this.issuesToReturn;
  }

  async fetchIssue(): Promise<GitLabIssue | null> {
    return this.issuesToReturn[0] ?? null;
  }

  async bookTime(
    projectId: number,
    issueIid: number,
    durationMinutes: number,
    spentAt: string,
    note: string,
    marker: string,
  ): Promise<GitLabBookingResult> {
    if (this.bookShouldThrow) throw this.bookShouldThrow;
    const noteId = this.nextNoteId++;
    const createdAt = "2024-01-15T10:00:00.000Z";
    this.bookedCalls.push({ projectId, issueIid, durationMinutes, spentAt, note, marker });
    this.notes.push({ projectId, issueIid, marker, noteId, createdAt });
    return { noteId, createdAt };
  }

  async findBookingNote(
    projectId: number,
    issueIid: number,
    marker: string,
  ): Promise<GitLabBookingResult | null> {
    const hit = this.notes.find(
      (n) => n.projectId === projectId && n.issueIid === issueIid && n.marker === marker,
    );
    return hit ? { noteId: hit.noteId, createdAt: hit.createdAt } : null;
  }
}
