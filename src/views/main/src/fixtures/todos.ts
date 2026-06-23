import type { TodoList, TodoTask } from "../../../../shared/types";

// Dummy-Datumswerte als yyyy-MM-dd. Bewusst feste Strings statt berechnet:
// Smart-View-Tests übergeben ein explizites `today`, die UI rechnet gegen das
// echte heute. Im Dev-Modus (vite --mode mock) dienen sie nur der Anschauung.
function task(overrides: Partial<TodoTask> & Pick<TodoTask, "id" | "listId" | "title">): TodoTask {
  return {
    section: null,
    done: false,
    priority: "normal",
    due: null,
    scheduled: null,
    start: null,
    created: null,
    doneDate: null,
    recurrence: null,
    recurrenceEditableInApp: true,
    tags: [],
    depth: 0,
    description: null,
    ...overrides,
  };
}

export const todoFixtures: TodoList[] = [
  {
    id: "Arbeit",
    name: "Arbeit",
    sections: ["Heute", "Diese Woche"],
    tasks: [
      task({
        id: "Arbeit#0",
        listId: "Arbeit",
        section: "Heute",
        title: "OAuth-Redirect testen",
        priority: "high",
        due: "2026-06-22",
        tags: ["backend"],
      }),
      task({
        id: "Arbeit#1",
        listId: "Arbeit",
        section: "Heute",
        title: "Subtask: Logs prüfen",
        due: "2026-06-22",
        depth: 1,
      }),
      task({
        id: "Arbeit#2",
        listId: "Arbeit",
        section: "Diese Woche",
        title: "Release vorbereiten",
        priority: "medium",
        due: "2026-06-25",
      }),
      task({
        id: "Arbeit#3",
        listId: "Arbeit",
        section: "Diese Woche",
        title: "Altes Ticket nachfassen",
        priority: "low",
        due: "2026-06-19",
      }),
      task({
        id: "Arbeit#4",
        listId: "Arbeit",
        section: null,
        title: "Standup-Notiz",
        done: true,
        doneDate: "2026-06-21",
      }),
    ],
  },
  {
    id: "Privat",
    name: "Privat",
    sections: [],
    tasks: [
      task({
        id: "Privat#0",
        listId: "Privat",
        title: "Wöchentlich Müll rausbringen",
        recurrence: "every week",
        due: "2026-06-22",
      }),
      task({
        id: "Privat#1",
        listId: "Privat",
        title: "Komplexe Wiederholung (in Obsidian abhaken)",
        recurrence: "every 2nd tuesday when done",
        recurrenceEditableInApp: false,
        due: "2026-06-23",
      }),
    ],
  },
];
