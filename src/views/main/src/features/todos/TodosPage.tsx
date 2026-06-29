import { useEffect, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import type { TodoTask } from "../../../../../shared/types";
import { getSettings, getTodoLists } from "../../api";
import { keys } from "../../lib/queryKeys";
import { unwrap } from "../../lib/errors";
import { todayBerlinYmd } from "../../lib/dates";
import { useTodoKeyboard } from "./useTodoKeyboard";
import { PageHeader } from "../../components/PageHeader";
import { ErrorNote } from "../../components/ErrorNote";
import { Button } from "../../components/ui/button";
import { TodoSidebar } from "./TodoSidebar";
import { TodoList } from "./TodoList";
import { TodoCombinedView } from "./TodoCombinedView";
import { TodoBulkBar } from "./TodoBulkBar";
import { TodoQuickAdd } from "./TodoQuickAdd";
import { useTodoMutations } from "./useTodoMutations";
import { useTodoSelection } from "./useTodoSelection";
import { useTodoActions } from "./useTodoActions";
import { smartViewFilter, smartViewCounts } from "./smartViewFilter";
import { allTagsOf, applyFilterSort } from "./taskFilterSort";
import { combinedLists } from "./combinedLists";
import { useTodoFilterSort } from "./useTodoFilterSort";
import { useTodoUiPrefs } from "./useTodoUiPrefs";
import { loadTodoPrefs, saveTodoPrefs } from "./todoPrefs";
import { useSavedFilters } from "./useSavedFilters";
import { TodoToolbar } from "./TodoToolbar";
import { isNoFolderError } from "./todoError";
import { TodoSearchDialog } from "./TodoSearchDialog";
import { TaskDetailDialog } from "./TaskDetailDialog";
import { resolveDetail } from "./subtaskTree";

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

  // view + selectedList lazy aus localStorage; filter/sort separat (useTodoFilterSort).
  const ui = useTodoUiPrefs();
  const view = ui.view;
  const setView = ui.setView;
  const selectedList = ui.selectedList;
  const setSelectedList = ui.setSelectedList;
  const combined = ui.combined;
  const setCombined = ui.setCombined;
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

  // Detail-Panel: Task per id + dessen Subtree (Lookup in subtaskTree.ts gekapselt).
  const detail = resolveDetail(lists.data ?? [], detailTaskId);

  const selection = useTodoSelection({ allTasks, view, selectedList, bulk: mut.bulk });
  // Initialer filter/sort-Stand aus localStorage (einmalig, Lazy-Init im Hook).
  const fs = useTodoFilterSort(loadTodoPrefs() ?? undefined);
  const saved = useSavedFilters();

  // Persistierte, aber inzwischen gelöschte Liste → sauber auf view zurückfallen,
  // damit kein leerer Listen-Zustand "hängt". Erst nach erfolgreichem Laden prüfen.
  useEffect(() => {
    if (!lists.data || selectedList === null) return;
    if (!lists.data.some((l) => l.id === selectedList)) setSelectedList(null);
  }, [lists.data, selectedList, setSelectedList]);

  // EIN Effect persistiert den kompletten UI-Zustand (View/Liste/Combined/Filter/Sort).
  // selectMode/searchOpen/detail werden bewusst NICHT persistiert.
  useEffect(() => {
    saveTodoPrefs({ view, selectedList, combined, filter: fs.filter, sort: fs.sort });
  }, [view, selectedList, combined, fs.filter, fs.sort]);

  // Task-/Listen-Handler ausgelagert (useTodoActions), damit TodosPage mit der
  // combined-Verzweigung unter dem LOC-Limit bleibt.
  const actions = useTodoActions({
    mut,
    saved,
    lists: lists.data ?? [],
    view,
    selectedList,
    today,
    filter: fs.filter,
    sort: fs.sort,
    setSelectedList,
    setView,
    setCombined,
    setFilterSort: fs.setAll,
  });

  // Sichtbare Tasks: konkrete Liste oder Smart-View über alle. Im Kombi-Modus ist
  // selectedList=null und die Datums-view irrelevant fürs Rendering.
  const activeList = selectedList ? (lists.data ?? []).find((l) => l.id === selectedList) : null;
  const baseTasks = activeList ? activeList.tasks : allTasks;
  const viewTasks = activeList ? baseTasks : smartViewFilter(baseTasks, view, today);
  // Nutzergewählter Facetten-Filter + Sortierung NACH der Smart-View/Listen-Auswahl.
  const visible = applyFilterSort(viewTasks, fs.filter, fs.sort);
  const availableTags = allTagsOf(baseTasks);

  // Aufbereitung für den Kombi-Modus: je Liste gefiltert/sortiert, leere ausgelassen.
  const combinedGroups = combined ? combinedLists(lists.data ?? [], fs.filter, fs.sort) : [];

  // Quick-Add-Ziel: gewählte Liste, sonst erste Liste. sections für TodoList-
  // Gruppierung; der Quick-Add leitet seine Sektionen selbst ab (#6 &Liste).
  const targetListId = selectedList ?? (lists.data ?? [])[0]?.id ?? null;
  const sections = (lists.data ?? []).find((l) => l.id === targetListId)?.sections ?? [];

  // Eingaben leeren, sobald Add/CreateList durchläuft (Remount via key).
  useEffect(() => {
    if (mut.add.isSuccess || mut.createList.isSuccess) setQuickAddKey((k) => k + 1);
  }, [mut.add.isSuccess, mut.createList.isSuccess]);

  // Detail-Dialog NUR bei einem aus dem Dialog ausgelösten Speichern schließen
  // (savedFromDetail.current trennt das vom inline-Toggle mit derselben update-
  // Mutation). Bei Konflikt (isError) bleibt der Dialog offen für den Fehler.
  const savedFromDetail = useRef(false);
  useEffect(() => {
    if (mut.update.isSuccess && savedFromDetail.current) {
      savedFromDetail.current = false;
      setDetailTaskId(null);
    }
  }, [mut.update.isSuccess]);

  const selectedTask = (): TodoTask | undefined => visible.find((t) => t.id === selectedId);
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
    onToggle: actions.onToggle,
    onReschedule: actions.onReschedule,
    onIndent: actions.onIndent,
    openDetail: (task) => setDetailTaskId(task.id),
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
            combined={combined}
            onView={(v) => {
              setCombined(false);
              setSelectedList(null);
              setView(v);
            }}
            onList={(id) => {
              setCombined(false);
              setSelectedList(id);
            }}
            onCombined={() => {
              setSelectedList(null); // combined=true ⇒ selectedList erzwingen=null
              setCombined(true);
            }}
            onCreateList={(name) => mut.createList.mutate(name)}
            createError={mut.createList.isError ? mut.createList.error : null}
            savedFilters={saved.filters}
            onApplyFilter={actions.onApplyFilter}
            onDeleteFilter={saved.removeFilter}
            onSaveCurrent={actions.onSaveCurrent}
          />

          <div className="min-w-0 flex-1">
            <TodoQuickAdd
              key={quickAddKey}
              ref={quickAddRef}
              lists={lists.data ?? []}
              listId={targetListId}
              today={today}
              onAdd={actions.onAdd}
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
            ) : combined ? (
              <TodoCombinedView
                groups={combinedGroups}
                selectedId={selectedId}
                listNames={listNames}
                errorTaskId={errorTaskId}
                error={mut.update.error}
                onSelect={setSelectedId}
                onToggle={actions.onToggle}
                onRename={actions.onRename}
                onReschedule={actions.onReschedule}
                onMove={actions.onMove}
                onOpenDetail={(task) => setDetailTaskId(task.id)}
                onDelete={actions.onDelete}
                selectMode={selection.selectMode}
                selectedIds={selection.selectedIds}
                onSelectBulk={selection.onSelectBulk}
              />
            ) : (
              <TodoList
                tasks={visible}
                sections={sections}
                selectedId={selectedId}
                listNames={listNames}
                reorderable={actions.reorderable}
                errorTaskId={errorTaskId}
                error={mut.update.error}
                onSelect={setSelectedId}
                onToggle={actions.onToggle}
                onRename={actions.onRename}
                onReschedule={actions.onReschedule}
                onMove={actions.onMove}
                onOpenDetail={(task) => setDetailTaskId(task.id)}
                onDelete={actions.onDelete}
                onIndent={actions.onIndent}
                onReorder={actions.onReorder}
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
        task={detail.task}
        subtasks={detail.subtasks}
        onClose={() => setDetailTaskId(null)}
        onUpdate={(patch) => {
          savedFromDetail.current = true;
          mut.update.mutate(patch);
        }}
        onAddSubtask={(title) => {
          if (detail.task) {
            mut.add.mutate({ listId: detail.task.listId, parentId: detail.task.id, title });
          }
        }}
        onToggleSubtask={actions.onToggle}
        onOpenSubtask={(st) => setDetailTaskId(st.id)}
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
