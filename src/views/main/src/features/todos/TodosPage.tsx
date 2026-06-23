import { useEffect, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import type { TodoTask } from "../../../../../shared/types";
import { getSettings, getTodoLists } from "../../api";
import { keys } from "../../lib/queryKeys";
import { unwrap } from "../../lib/errors";
import { todayBerlinYmd, reschedulePresetDate } from "../../lib/dates";
import { useHotkey } from "../../lib/useHotkey";
import { useCommands } from "../../lib/useCommand";
import { PageHeader } from "../../components/PageHeader";
import { ErrorNote } from "../../components/ErrorNote";
import { Button } from "../../components/ui/button";
import { TodoSidebar } from "./TodoSidebar";
import { TodoList } from "./TodoList";
import { TodoBulkBar } from "./TodoBulkBar";
import { TodoQuickAdd } from "./TodoQuickAdd";
import { useTodoMutations } from "./useTodoMutations";
import { useTodoSelection } from "./useTodoSelection";
import { smartViewFilter, smartViewCounts, type SmartView } from "./smartViewFilter";
import { allTagsOf, applyFilterSort, isFilterActive } from "./taskFilterSort";
import { useTodoFilterSort } from "./useTodoFilterSort";
import { TodoToolbar } from "./TodoToolbar";
import { isNoFolderError } from "./todoError";
import { TodoSearchDialog } from "./TodoSearchDialog";

function EmptyState() {
  return (
    <div className="rounded-lg border border-border bg-card p-8 text-center">
      <p className="text-lg font-semibold">Kein Todo-Ordner konfiguriert</p>
      <p className="mt-1 text-sm text-muted-foreground">
        Lege in den Einstellungen einen dedizierten Vault-Unterordner fest, z.B. .../Vault/todos.
      </p>
      <Link to="/settings" className="mt-4 inline-block">
        <Button>Zu den Einstellungen</Button>
      </Link>
    </div>
  );
}

export function TodosPage() {
  const settings = useQuery({
    queryKey: keys.settings(),
    queryFn: async () => unwrap(await getSettings()),
  });
  const lists = useQuery({
    queryKey: keys.todos(),
    queryFn: async () => unwrap(await getTodoLists()),
  });
  const mut = useTodoMutations();

  const [view, setView] = useState<SmartView>("today");
  const [selectedList, setSelectedList] = useState<string | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [searchOpen, setSearchOpen] = useState(false);
  // key-Remount zum Leeren der Eingaben NACH erfolgreichem Add/CreateList.
  const [quickAddKey, setQuickAddKey] = useState(0);
  const quickAddRef = useRef<HTMLInputElement>(null);

  const today = todayBerlinYmd();
  const listNames = (lists.data ?? []).map((l) => l.id);
  const allTasks = (lists.data ?? []).flatMap((l) => l.tasks);
  const counts = smartViewCounts(allTasks, today);

  const selection = useTodoSelection({ allTasks, view, selectedList, bulk: mut.bulk });
  const fs = useTodoFilterSort();

  // Sichtbare Tasks: entweder eine konkrete Liste oder eine Smart-View über alle.
  const activeList = selectedList ? (lists.data ?? []).find((l) => l.id === selectedList) : null;
  const baseTasks = activeList ? activeList.tasks : allTasks;
  const viewTasks = activeList ? baseTasks : smartViewFilter(baseTasks, view, today);
  // Nutzergewählter Facetten-Filter + Sortierung NACH der Smart-View/Listen-Auswahl.
  const visible = applyFilterSort(viewTasks, fs.filter, fs.sort);
  const availableTags = allTagsOf(baseTasks);
  const sections = activeList ? activeList.sections : [];

  // Quick-Add-Ziel: gewählte Liste, sonst die erste Liste (Smart-View-Modus).
  const targetListId = selectedList ?? (lists.data ?? [])[0]?.id ?? null;

  function onToggle(task: TodoTask) {
    mut.update.mutate({ id: task.id, listId: task.listId, done: !task.done });
  }
  function onRename(task: TodoTask, title: string) {
    mut.update.mutate({ id: task.id, listId: task.listId, title });
  }
  function onReschedule(task: TodoTask, due: string | null) {
    mut.update.mutate({ id: task.id, listId: task.listId, due });
  }
  // toSection wird weggelassen → Backend hängt den Task ans Ende der Ziel-Liste.
  function onMove(task: TodoTask, toList: string) {
    mut.move.mutate({ id: task.id, fromList: task.listId, toList });
  }
  // DnD-Umsortieren nur in der konkreten Listenansicht (selectedList gesetzt),
  // nicht in Smart-Views — dort gibt es keine stabile, listengebundene Reihenfolge.
  // Zusätzlich nur in der unveränderten ("pristine") manuellen Ansicht: sobald
  // gefiltert oder umsortiert wird, entspricht die sichtbare Reihenfolge nicht
  // mehr der Datei-Reihenfolge, ein Reorder wäre dann mehrdeutig.
  const reorderable = selectedList !== null && fs.sort === "manual" && !isFilterActive(fs.filter);
  function onReorder(activeId: string, targetId: string, before: boolean) {
    if (selectedList) mut.reorder.mutate({ listId: selectedList, id: activeId, targetId, before });
  }

  // Eingaben leeren, sobald Add/CreateList durchläuft (Remount via key).
  useEffect(() => {
    if (mut.add.isSuccess || mut.createList.isSuccess) setQuickAddKey((k) => k + 1);
  }, [mut.add.isSuccess, mut.createList.isSuccess]);

  function selectedTask(): TodoTask | undefined {
    return visible.find((t) => t.id === selectedId);
  }
  function moveSelection(delta: number) {
    if (visible.length === 0) return;
    const idx = visible.findIndex((t) => t.id === selectedId);
    const next = idx === -1 ? 0 : Math.min(visible.length - 1, Math.max(0, idx + delta));
    setSelectedId(visible[next].id);
  }

  useHotkey("n", () => quickAddRef.current?.focus());
  useHotkey("j", () => moveSelection(1));
  useHotkey("k", () => moveSelection(-1));
  useHotkey("space", () => {
    const t = selectedTask();
    if (t && !(t.recurrence !== null && !t.recurrenceEditableInApp)) onToggle(t);
  });
  useHotkey("x", () => {
    const t = selectedTask();
    if (t && !(t.recurrence !== null && !t.recurrenceEditableInApp)) onToggle(t);
  });
  useHotkey("t", () => {
    const t = selectedTask();
    if (t) onReschedule(t, today);
  });
  useHotkey("#", () => {
    const t = selectedTask();
    if (t) onReschedule(t, reschedulePresetDate("tomorrow", today));
  });
  useHotkey("f", () => setSearchOpen(true));

  useCommands([
    {
      id: "todos:add",
      label: "Aufgabe hinzufügen",
      section: "Todos",
      run: () => quickAddRef.current?.focus(),
    },
    {
      id: "todos:search",
      label: "Aufgabe suchen",
      section: "Todos",
      run: () => setSearchOpen(true),
    },
    {
      id: "todos:today",
      label: "Smart-View: Heute",
      section: "Todos",
      run: () => {
        setSelectedList(null);
        setView("today");
      },
    },
    {
      id: "todos:overdue",
      label: "Smart-View: Überfällig",
      section: "Todos",
      run: () => {
        setSelectedList(null);
        setView("overdue");
      },
    },
    {
      id: "todos:upcoming",
      label: "Smart-View: Anstehend",
      section: "Todos",
      run: () => {
        setSelectedList(null);
        setView("upcoming");
      },
    },
    {
      id: "todos:all",
      label: "Smart-View: Alle",
      section: "Todos",
      run: () => {
        setSelectedList(null);
        setView("all");
      },
    },
  ]);

  // Empty State: todoFolder leer ODER Backend liefert TODO_NO_FOLDER.
  const noFolder =
    (settings.data && (settings.data.todoFolder ?? "").trim() === "") ||
    isNoFolderError(lists.error);

  // id der Zeile, deren letzte update-Mutation fehlschlug (inline-Konflikt).
  const errorTaskId = mut.update.isError ? (mut.update.variables?.id ?? null) : null;

  return (
    <div>
      <PageHeader title="Todos" description="Aufgaben aus dem Markdown-Vault" />

      {noFolder ? (
        <EmptyState />
      ) : (
        <div className="flex gap-6">
          <TodoSidebar
            lists={lists.data ?? []}
            counts={counts}
            view={view}
            selectedList={selectedList}
            onView={(v) => {
              setSelectedList(null);
              setView(v);
            }}
            onList={setSelectedList}
            onCreateList={(name) => mut.createList.mutate(name)}
            createError={mut.createList.isError ? mut.createList.error : null}
          />

          <div className="min-w-0 flex-1">
            <TodoQuickAdd
              key={quickAddKey}
              ref={quickAddRef}
              listId={targetListId}
              sections={sections}
              today={today}
              onAdd={(input) => mut.add.mutate(input)}
              error={mut.add.isError ? mut.add.error : null}
            />

            {lists.isError && !noFolder ? <ErrorNote error={lists.error} className="mb-3" /> : null}

            <div className="mb-3 flex justify-end">
              <Button
                variant={selection.selectMode ? "default" : "outline"}
                size="sm"
                onClick={selection.toggleSelectMode}
              >
                {selection.selectMode ? "Auswahl beenden" : "Auswählen"}
              </Button>
            </div>

            <TodoToolbar
              filter={fs.filter}
              sort={fs.sort}
              availableTags={availableTags}
              onSort={fs.setSort}
              onToggleTag={fs.toggleTag}
              onTogglePriority={fs.togglePriority}
              onSetStatus={fs.setStatus}
              onReset={fs.reset}
              active={fs.active}
            />

            {selection.selectMode && selection.selectedIds.size > 0 ? (
              <TodoBulkBar
                count={selection.selectedIds.size}
                listNames={listNames}
                currentList={selectedList}
                onComplete={() =>
                  selection.runBulk({ kind: "complete", tasks: selection.selectedTasks })
                }
                onReschedule={(due) =>
                  selection.runBulk({ kind: "reschedule", tasks: selection.selectedTasks, due })
                }
                onMove={(toList) =>
                  selection.runBulk({ kind: "move", tasks: selection.selectedTasks, toList })
                }
                onDelete={() =>
                  selection.runBulk({ kind: "delete", tasks: selection.selectedTasks })
                }
                onClear={selection.clearSelection}
              />
            ) : null}

            {lists.isLoading ? (
              <p className="py-10 text-center text-sm text-muted-foreground">Lädt…</p>
            ) : (
              <TodoList
                tasks={visible}
                sections={sections}
                selectedId={selectedId}
                listNames={listNames}
                reorderable={reorderable}
                errorTaskId={errorTaskId}
                error={mut.update.error}
                onSelect={setSelectedId}
                onToggle={onToggle}
                onRename={onRename}
                onReschedule={onReschedule}
                onMove={onMove}
                onReorder={onReorder}
                selectMode={selection.selectMode}
                selectedIds={selection.selectedIds}
                onSelectBulk={selection.onSelectBulk}
              />
            )}
          </div>
        </div>
      )}

      <TodoSearchDialog
        open={searchOpen}
        onClose={() => setSearchOpen(false)}
        lists={lists.data ?? []}
        onPick={(task) => {
          setSelectedList(task.listId);
          setSelectedId(task.id);
          setSearchOpen(false);
        }}
      />
    </div>
  );
}
