import { Fragment, useState } from "react";
import {
  createColumnHelper,
  flexRender,
  getCoreRowModel,
  getSortedRowModel,
  useReactTable,
  type SortingState,
} from "@tanstack/react-table";
import type { Entry, Ticket } from "../../../../../shared/types";
import { formatDate, formatEndTime, formatTime, formatDuration } from "../../lib/dates";
import { Button } from "../../components/ui/button";
import { Table, THead, TBody, TR, TH, TD } from "../../components/ui/table";
import { EntryStatusBadge } from "./entryStatus";
import { BookingHistory } from "../booking/BookingHistory";

const COLUMN_COUNT = 6;

interface EntryListProps {
  entries: Entry[];
  ticketsById: Map<number, Ticket>;
  onEdit: (entry: Entry) => void;
  onDelete: (entry: Entry) => void;
  onBook: (entry: Entry) => void;
}

const helper = createColumnHelper<Entry>();

export function EntryList(props: EntryListProps) {
  const [sorting, setSorting] = useState<SortingState>([{ id: "date", desc: true }]);
  const [expandedId, setExpandedId] = useState<number | null>(null);

  function toggleExpanded(id: number) {
    setExpandedId((current) => (current === id ? null : id));
  }

  const columns = [
    helper.accessor("date", {
      header: "Datum",
      cell: (c) => {
        const date = c.getValue();
        const durationMinutes = c.row.original.durationMinutes;
        return (
          <span className="whitespace-nowrap">
            {formatDate(date)} · {formatTime(date)} - {formatEndTime(date, durationMinutes)}
          </span>
        );
      },
    }),
    helper.accessor("notes", {
      header: "Notiz",
      enableSorting: false,
      cell: (c) => c.getValue() ?? <span className="text-muted-foreground">–</span>,
    }),
    helper.accessor("durationMinutes", {
      header: "Dauer",
      cell: (c) => formatDuration(c.getValue()),
    }),
    helper.display({
      id: "tickets",
      header: "Ticket(s)",
      cell: (c) => {
        const iids = c.row.original.ticketIds
          .map((id) => props.ticketsById.get(id))
          .filter((t): t is Ticket => Boolean(t))
          .map((t) => `#${t.gitlabIid}`);
        return iids.length > 0 ? iids.join(", ") : <span className="text-muted-foreground">–</span>;
      },
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
            <Button size="sm" variant="ghost" onClick={() => props.onDelete(entry)}>
              Löschen
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
            <TR>
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
  );
}
