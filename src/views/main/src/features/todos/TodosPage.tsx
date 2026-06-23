import { useEffect, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import type { TodoTask } from "../../../../../shared/types";
import { getSettings, getTodoLists } from "../../api";
import { keys } from "../../lib/queryKeys";
import { unwrap } from "../../lib/errors";
import { toast } from "../../lib/toast";
import { todayBerlinYmd } from "../../lib/dates";
import { useTodoKeyboard } from "./useTodoKeyboard";
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
import { useSavedFilters } from "./useSavedFilters";
import type { SavedFilter } from "./savedFilters";
import { TodoToolbar } from "./TodoToolbar";
import { isNoFolderError } from "./todoError";
import { TodoSearchDialog } from "./TodoSearchDialog";
import { TaskDetailDialog } from "./TaskDetailDialog";
import { subtasksOf } from "./subtaskTree";

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
  const [detailTaskId, setDetailTaskId] = useState<string | null>(null);
  // key-Remount zum Leeren der Eingaben NACH erfolgreichem Add/CreateList.
  const [quickAddKey, setQuickAddKey] = useState(0);
  const quickAddRef = useRef<HTMLInputElement>(null);

  const today = todayBerlinYmd();
  const listNames = (lists.data ?? []).map((l) => l.id);
  const allTasks = (lists.data ?? []).flatMap((l) => l.tasks);
  const counts = smartViewCounts(allTasks, today);

  // Detail-Panel: Task per id + dessen Subtree aus der geordneten Liste seiner Liste.
  const detailTask = allTasks.find((t) => t.id === detailTaskId) ?? null;
  const detailList = detailTask
    ? (lists.data ?? []).find((l) => l.id === detailTask.listId)
    : undefined;
  const detailSubtasks = detailTask && detailList ? subtasksOf(detailList.tasks, detailTask) : [];

  const selection = useTodoSelection({ allTasks, view, selectedList, bulk: mut.bulk });
  const fs = useTodoFilterSort();
  const saved = useSavedFilters();

  // Aktuellen Zustand (View/Liste + Filter + Sort) als benannten Filter sichern.
  function onSaveCurrent(name: string) {
    saved.addFilter({
      id: crypto.randomUUID(),
      name,
      view: selectedList ? null : view,
      listId: selectedList,
      filter: fs.filter,
      sort: fs.sort,
    });
  }
  // Gespeicherten Filter komplett anwenden: View/Liste setzen, dann Filter+Sort.
  function onApplyFilter(sf: SavedFilter) {
    setSelectedList(sf.listId);
    if (!sf.listId) setView(sf.view ?? "today");
    fs.setAll(sf.filter, sf.sort);
  }

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
    const completing = !task.done;
    // Undo-Toast NUR beim Abhaken nicht-wiederkehrender Tasks. Bei Recurrence
    // rollt das Backend (src/bun/todos/todos.ts) beim Abhaken eine neue Folge-
    // Instanz in die Datei; ein simples done:false revertiert diese Instanz NICHT
    // → ein "Rückgängig" wäre irreführend. Daher kein Undo-Toast für recurrence.
    const offerUndo = completing && task.recurrence === null;
    mut.update.mutate(
      { id: task.id, listId: task.listId, done: completing },
      offerUndo
        ? {
            onSuccess: () => {
              toast.success(`Erledigt: ${task.title}`, {
                label: "Rückgängig",
                // Ohne eigenen onSuccess → kein erneuter Toast (kein Loop).
                onAction: () =>
                  mut.update.mutate({ id: task.id, listId: task.listId, done: false }),
              });
            },
          }
        : undefined,
    );
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

  // Detail-Dialog NUR bei einem aus dem Dialog ausgelösten Speichern schließen.
  // savedFromDetail.current trennt das von inline-Edits (Toggle/Rename), die
  // dieselbe update-Mutation nutzen, aber den Dialog nicht schließen sollen. Bei
  // Konflikt (isError) bleibt der Dialog offen, damit der Fehler sichtbar ist.
  const savedFromDetail = useRef(false);
  useEffect(() => {
    if (mut.update.isSuccess && savedFromDetail.current) {
      savedFromDetail.current = false;
      setDetailTaskId(null);
    }
  }, [mut.update.isSuccess]);

  function selectedTask(): TodoTask | undefined {
    return visible.find((t) => t.id === selectedId);
  }
  function moveSelection(delta: number) {
    if (visible.length === 0) return;
    const idx = visible.findIndex((t) => t.id === selectedId);
    const next = idx === -1 ? 0 : Math.min(visible.length - 1, Math.max(0, idx + delta));
    setSelectedId(visible[next].id);
  }

  useTodoKeyboard({
    quickAddRef,
    today,
    moveSelection,
    selectedTask,
    onToggle,
    onReschedule,
    openSearch: () => setSearchOpen(true),
    setView,
    setSelectedList,
  });

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
            savedFilters={saved.filters}
            onApplyFilter={onApplyFilter}
            onDeleteFilter={saved.removeFilter}
            onSaveCurrent={onSaveCurrent}
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
                onOpenDetail={(task) => setDetailTaskId(task.id)}
                onReorder={onReorder}
                selectMode={selection.selectMode}
                selectedIds={selection.selectedIds}
                onSelectBulk={selection.onSelectBulk}
              />
            )}
          </div>
        </div>
      )}

      <TaskDetailDialog
        open={detailTaskId !== null}
        task={detailTask}
        subtasks={detailSubtasks}
        onClose={() => setDetailTaskId(null)}
        onUpdate={(patch) => {
          savedFromDetail.current = true;
          mut.update.mutate(patch);
        }}
        onAddSubtask={(title) => {
          if (detailTask) {
            mut.add.mutate({ listId: detailTask.listId, parentId: detailTask.id, title });
          }
        }}
        onToggleSubtask={onToggle}
        error={mut.update.isError ? mut.update.error : null}
      />

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
