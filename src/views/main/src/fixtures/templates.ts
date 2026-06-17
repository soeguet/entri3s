import type { Template } from "../../../../shared/types";

export const templateFixtures: Template[] = [
  {
    id: 1,
    name: "Daily Standup",
    payload: JSON.stringify({
      durationMinutes: 15,
      notes: null,
      tagIds: [3],
    }),
  },
  {
    id: 2,
    name: "Code Review",
    payload: JSON.stringify({
      durationMinutes: 30,
      notes: null,
      tagIds: [1],
    }),
  },
];
