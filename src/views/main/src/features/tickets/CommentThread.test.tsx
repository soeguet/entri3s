import { test, expect } from "vitest";
import { screen } from "@testing-library/react";
import { renderWithClient } from "../../lib/test-utils";
import { commentFixtures } from "../../fixtures/comments";
import { CommentThread } from "./CommentThread";

test("markiert Kommentare neuer als lastViewedAt mit 'Neu'", () => {
  renderWithClient(
    <CommentThread comments={commentFixtures} lastViewedAt="2024-01-15T09:30:00.000Z" />,
  );
  // Die 10:30- und 11:00-Kommentare sind neuer als 09:30 → "Neu"-Badges.
  expect(screen.getAllByText("Neu").length).toBeGreaterThan(0);
});

test("zeigt kein 'Neu' wenn lastViewedAt null ist", () => {
  renderWithClient(<CommentThread comments={commentFixtures} lastViewedAt={null} />);
  expect(screen.queryByText("Neu")).not.toBeInTheDocument();
});

test("rendert die zweite Note einer Discussion als Reply (eingerückt)", () => {
  const { container } = renderWithClient(
    <CommentThread comments={commentFixtures} lastViewedAt={null} />,
  );
  // disc-3 hat zwei Notes → die zweite (id 4) ist ein Reply mit Einrückungs-Klasse.
  const reply = container.querySelector(".ml-6");
  expect(reply).not.toBeNull();
  expect(reply?.textContent).toContain("Danke, passt jetzt.");
});

test("entpackt gl-emoji im Kommentar-HTML (Emoji sichtbar)", () => {
  renderWithClient(<CommentThread comments={commentFixtures} lastViewedAt={null} />);
  // renderGitlabHtml ersetzt <gl-emoji> durch den Unicode-Fallback → 🎉 sichtbar,
  // ohne <gl-emoji>-Wrapper im DOM.
  expect(screen.getByText(/Umsetzung begonnen. 🎉/)).toBeInTheDocument();
});
