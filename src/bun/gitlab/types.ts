/** Rohe GitLab-Issue-Form (Teilmenge der REST-API v4). */
export interface GitLabIssue {
  iid: number;
  title: string;
  state: string; // "opened" | "closed"
  web_url: string;
  updated_at: string;
  time_stats?: {
    time_estimate: number; // Sekunden
    total_time_spent: number; // Sekunden
  };
}

export interface GitLabClient {
  fetchIssues(projectId: number, since?: Date): Promise<GitLabIssue[]>;
  fetchIssue(projectId: number, issueIid: number): Promise<GitLabIssue | null>;
  bookTime(
    projectId: number,
    issueIid: number,
    durationMinutes: number,
    note: string,
  ): Promise<void>;
}

/** Test-Double — der einzige legitime Mock im Projekt. */
export class FakeGitLabClient implements GitLabClient {
  bookedCalls: Array<{
    projectId: number;
    issueIid: number;
    durationMinutes: number;
    note: string;
  }> = [];
  issuesToReturn: GitLabIssue[] = [];
  bookShouldThrow: Error | null = null;

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
    note: string,
  ): Promise<void> {
    if (this.bookShouldThrow) throw this.bookShouldThrow;
    this.bookedCalls.push({ projectId, issueIid, durationMinutes, note });
  }
}
