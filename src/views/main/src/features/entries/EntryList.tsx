import { Fragment, useState } from "react";
import {
  createColumnHelper,
  flexRender,
  getCoreRowModel,
  getSortedRowModel,
  useReactTable,
  type SortingState,
} from "@tanstack/react-table";
import type { Entry, Tag, Ticket } from "../../../../../shared/types";
import { formatDuration } from "../../lib/dates";
import { Button } from "../../components/ui/button";
import { Table, THead, TBody, TR, TH, TD } from "../../components/ui/table";
import { EntryStatusBadge } from "./entryStatus";
import { BookingHistory } from "../booking/BookingHistory";
import { DateCell, NotesCell, TicketCell, TagsCell } from "./entryCells";
import type { QuickEditField } from "./EntryQuickEditDialog";
import { EntryActionsDialog } from "./EntryActionsDialog";

const COLUMN_COUNT = 7;

interface EntryListProps {
  entries: Entry[];
  ticketsById: Map<number, Ticket>;
  tagsById: Map<number, Tag>;
  onEdit: (entry: Entry) => void;
  onDelete: (entry: Entry) => void;
  onBook: (entry: Entry) => void;
  onResume: (entry: Entry) => void;
  onQuickEdit: (entry: Entry, field: QuickEditField, anchor: HTMLElement) => void;
  onDuplicate: (entry: Entry) => void;
  timerRunning: boolean;
}

const helper = createColumnHelper<Entry>();

export function EntryList(props: EntryListProps) {
  const [sorting, setSorting] = useState<SortingState>([{ id: "date", desc: true }]);
  const [expandedId, setExpandedId] = useState<number | null>(null);
  const [actionsEntry, setActionsEntry] = useState<Entry | null>(null);

  function toggleExpanded(id: number) {
    setExpandedId((current) => (current === id ? null : id));
  }

  const columns = [
    helper.accessor("date", {
      header: "Datum",
      cell: (c) => <DateCell entry={c.row.original} onQuickEdit={props.onQuickEdit} />,
    }),
    helper.accessor("notes", {
      header: "Notiz",
      enableSorting: false,
      cell: (c) => <NotesCell entry={c.row.original} onQuickEdit={props.onQuickEdit} />,
    }),
    helper.accessor("durationMinutes", {
      header: "Dauer",
      cell: (c) => formatDuration(c.getValue()),
    }),
    helper.display({
      id: "tickets",
      header: "Ticket(s)",
      cell: (c) => (
        <TicketCell
          entry={c.row.original}
          ticketsById={props.ticketsById}
          onQuickEdit={props.onQuickEdit}
        />
      ),
    }),
    helper.display({
      id: "tags",
      header: "Tags",
      enableSorting: false,
      cell: (c) => (
        <TagsCell
          entry={c.row.original}
          tagsById={props.tagsById}
          onQuickEdit={props.onQuickEdit}
        />
      ),
    }),
    helper.accessor("status", {
      header: "Status",
      enableSorting: false,
      cell: (c) => <EntryStatusBadge status={c.getValue()} />,
    }),
    helper.display({
      id: "actions",
      header: "",
      cell: (c) => {
        const entry = c.row.original;
        const canBook = entry.status === "draft" && entry.ticketIds.length > 0;
        return (
          <div className="flex justify-end gap-1">
            {canBook ? (
              <Button size="sm" onClick={() => props.onBook(entry)}>
                Buchen
              </Button>
            ) : null}
            {entry.status === "booked" ? (
              <Button
                size="sm"
                variant="outline"
                aria-expanded={expandedId === entry.id}
                onClick={() => toggleExpanded(entry.id)}
              >
                {expandedId === entry.id ? "Buchungen ▲" : "Buchungen ▼"}
              </Button>
            ) : null}
            <Button size="sm" variant="outline" onClick={() => props.onEdit(entry)}>
              Bearbeiten
            </Button>
            <Button
              size="sm"
              variant="ghost"
              aria-label="Weitere Aktionen"
              onClick={() => setActionsEntry(entry)}
            >
              Aktionen
            </Button>
          </div>
        );
      },
    }),
  ];

  const table = useReactTable({
    data: props.entries,
    columns,
    state: { sorting },
    onSortingChange: setSorting,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
  });

  if (props.entries.length === 0) {
    return <p className="py-10 text-center text-sm text-muted-foreground">Keine Entries.</p>;
  }

  return (
    <>
      <Table>
        <THead>
          {table.getHeaderGroups().map((hg) => (
            <TR key={hg.id}>
              {hg.headers.map((header) => (
                <TH
                  key={header.id}
                  onClick={
                    header.column.getCanSort() ? header.column.getToggleSortingHandler() : undefined
                  }
                  className={header.column.getCanSort() ? "cursor-pointer select-none" : ""}
                >
                  {flexRender(header.column.columnDef.header, header.getContext())}
                  {header.column.getIsSorted() === "asc" ? " ▲" : ""}
                  {header.column.getIsSorted() === "desc" ? " ▼" : ""}
                </TH>
              ))}
            </TR>
          ))}
        </THead>
        <TBody>
          {table.getRowModel().rows.map((row) => (
            <Fragment key={row.id}>
              <TR className={row.original.status === "booked" ? "bg-success-surface" : undefined}>
                {row.getVisibleCells().map((cell) => (
                  <TD key={cell.id}>{flexRender(cell.column.columnDef.cell, cell.getContext())}</TD>
                ))}
              </TR>
              {expandedId === row.original.id ? (
                <TR>
                  <TD colSpan={COLUMN_COUNT} className="bg-muted">
                    <BookingHistory entryId={row.original.id} ticketsById={props.ticketsById} />
                  </TD>
                </TR>
              ) : null}
            </Fragment>
          ))}
        </TBody>
      </Table>
      <EntryActionsDialog
        entry={actionsEntry}
        timerRunning={props.timerRunning}
        onResume={props.onResume}
        onDuplicate={props.onDuplicate}
        onDelete={props.onDelete}
        onClose={() => setActionsEntry(null)}
      />
    </>
  );
}
