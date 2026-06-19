import { test, expect } from "vitest";
import { screen } from "@testing-library/react";
import { renderWithClient } from "../../lib/test-utils";
import { commentFixtures } from "../../fixtures/comments";
import { CommentThread } from "./CommentThread";

test("markiert Kommentare neuer als lastViewedAt mit 'Neu'", () => {
  renderWithClient(
    <CommentThread comments={commentFixtures} lastViewedAt="2024-01-15T09:30:00.000Z" />,
  );
  // Der 10:30-Kommentar ist neuer als 09:30 → "Neu"-Badge.
  expect(screen.getByText("Neu")).toBeInTheDocument();
});

test("zeigt kein 'Neu' wenn lastViewedAt null ist", () => {
  renderWithClient(<CommentThread comments={commentFixtures} lastViewedAt={null} />);
  expect(screen.queryByText("Neu")).not.toBeInTheDocument();
});
