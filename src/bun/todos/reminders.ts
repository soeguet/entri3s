import type { Settings, TodoList } from "../../shared/types";
import { buildReminder } from "./reminder";

// Leichtgewichtiger Interval-Job, der einmal pro Tag eine OS-Benachrichtigung
// über fällige/überfällige Todos auslöst. Alle Abhängigkeiten werden injiziert
// (kein direkter electrobun-Import), damit der Job ohne native Seite testbar ist.
// Bewusst NICHT im Scheduler eingehängt: der kehrt ohne gitlabUrl früh zurück,
// Reminder sollen aber auch ohne GitLab laufen (Muster wie startTodoWatcher).

export interface TodoRemindersDeps {
  getAll: () => Settings;
  getLists: () => Promise<TodoList[]>;
  getLastDate: () => string;
  setLastDate: (d: string) => void;
  notify: (title: string, body: string) => void;
  today: () => string;
  // Aktuelle Berlin-Uhrzeit als nullgepaddetes "HH:mm" für das Zeit-Gate.
  nowTime: () => string;
}

export interface TodoRemindersHandle {
  close(): void;
}

export function startTodoReminders(
  deps: TodoRemindersDeps,
  intervalMs = 60_000,
): TodoRemindersHandle {
  async function tick(): Promise<void> {
    if (!deps.getAll().todoRemindersEnabled) return;

    // Zeit-Gate VOR getLists(): vor der konfigurierten Reminder-Uhrzeit gar nicht
    // erst den Vault scannen. Früher Return rückt lastDate NICHT vor, damit der
    // erste Tick ab reminderTime (auch nach App-Start, Catch-up) noch feuert.
    // Beide Strings sind nullgepaddetes "HH:mm" → String-Vergleich = chronologisch.
    if (deps.nowTime() < deps.getAll().reminderTime) return;

    let lists: TodoList[];
    try {
      lists = await deps.getLists();
    } catch {
      // Kein/ungültiger Todo-Ordner (z.B. TODO_NO_FOLDER) -> still überspringen.
      return;
    }

    const tasks = lists.flatMap((l) => l.tasks);
    const result = buildReminder(tasks, deps.today(), deps.getLastDate());
    if (!result) return;

    deps.notify(result.title, result.body);
    deps.setLastDate(result.lastDate);
  }

  const timer = setInterval(() => void tick(), intervalMs);

  return {
    close() {
      clearInterval(timer);
    },
  };
}
