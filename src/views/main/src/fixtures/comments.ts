import type { TicketComment } from "../../../../shared/types";

export const commentFixtures: TicketComment[] = [
  {
    id: 1,
    ticketId: 1,
    gitlabNoteId: 5001,
    discussionId: "disc-1",
    authorUsername: "mockuser",
    authorName: "Mock User",
    body: "Ich habe mit der Umsetzung begonnen. :tada:",
    bodyHtml: '<p>Ich habe mit der Umsetzung begonnen. <gl-emoji title="tada">🎉</gl-emoji></p>',
    isSystem: false,
    createdAt: "2024-01-15T09:00:00.000Z",
    updatedAt: "2024-01-15T09:00:00.000Z",
  },
  {
    id: 2,
    ticketId: 1,
    gitlabNoteId: 5002,
    discussionId: "disc-2",
    authorUsername: "gitlab-bot",
    authorName: "GitLab",
    body: "assigned to @mockuser",
    bodyHtml: "<p>assigned to @mockuser</p>",
    isSystem: true,
    createdAt: "2024-01-15T09:05:00.000Z",
    updatedAt: "2024-01-15T09:05:00.000Z",
  },
  {
    id: 3,
    ticketId: 1,
    gitlabNoteId: 5003,
    discussionId: "disc-3",
    authorUsername: "reviewer",
    authorName: "Review Person",
    body: "Sieht gut aus, bitte noch Tests ergänzen.",
    // Inline-Bild mit /uploads/-URL → GitlabContent lädt es über den Backend-Proxy
    // (im Mock kommt der graue SVG-Placeholder zurück).
    bodyHtml:
      '<p>Sieht gut aus, bitte noch Tests ergänzen.</p><p><img src="/uploads/abc123/screenshot.png" alt="Screenshot"></p>',
    isSystem: false,
    createdAt: "2024-01-15T10:30:00.000Z",
    updatedAt: "2024-01-15T10:30:00.000Z",
  },
  {
    id: 4,
    ticketId: 1,
    gitlabNoteId: 5004,
    discussionId: "disc-3",
    authorUsername: "reviewer",
    authorName: "Review Person",
    body: "Danke, passt jetzt.",
    bodyHtml: "<p>Danke, passt jetzt.</p>",
    isSystem: false,
    createdAt: "2024-01-15T11:00:00.000Z",
    updatedAt: "2024-01-15T11:00:00.000Z",
  },
];
