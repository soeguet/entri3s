import { test, expect, vi, beforeEach } from "vitest";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { renderHook, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";
import type { TodoTask } from "../../../../../shared/types";
import * as api from "../../api";
import { useTodoMutations } from "./useTodoMutations";

vi.mock("../../api");

function task(id: string, listId: string): TodoTask {
  return {
    id,
    listId,
    section: null,
    title: id,
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
  };
}

function wrapper(client: QueryClient) {
  return (props: { children: ReactNode }) => (
    <QueryClientProvider client={client}>{props.children}</QueryClientProvider>
  );
}

function freshClient(): QueryClient {
  return new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(api.updateTodoTask).mockResolvedValue({ data: undefined, error: null });
});

test("bulk complete ruft updateTodoTask für jeden Task mit done:true und invalidiert", async () => {
  const client = freshClient();
  const spy = vi.spyOn(client, "invalidateQueries");
  const { result } = renderHook(() => useTodoMutations(), { wrapper: wrapper(client) });

  result.current.bulk.mutate({
    kind: "complete",
    tasks: [task("A#0", "A"), task("A#1", "A"), task("B#0", "B")],
  });

  await waitFor(() => expect(result.current.bulk.isSuccess).toBe(true));
  expect(api.updateTodoTask).toHaveBeenCalledTimes(3);
  expect(api.updateTodoTask).toHaveBeenCalledWith(
    expect.objectContaining({ id: "A#0", listId: "A", done: true }),
  );
  expect(api.updateTodoTask).toHaveBeenCalledWith(
    expect.objectContaining({ id: "B#0", listId: "B", done: true }),
  );
  expect(spy).toHaveBeenCalled();
});

test("bulk: ein Teil-Fehler führt zu onError (isError)", async () => {
  // Zweiter Task schlägt fehl → bulk muss als Fehler enden.
  vi.mocked(api.updateTodoTask)
    .mockResolvedValueOnce({ data: undefined, error: null })
    .mockResolvedValueOnce({
      data: null,
      error: { code: "TODO_CONFLICT", message: "egal", retry: false },
    });
  const client = freshClient();
  const { result } = renderHook(() => useTodoMutations(), { wrapper: wrapper(client) });

  result.current.bulk.mutate({
    kind: "complete",
    tasks: [task("A#0", "A"), task("A#1", "A")],
  });

  await waitFor(() => expect(result.current.bulk.isError).toBe(true));
});
