import { test, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { CommandList, type CommandListSection } from "./CommandList";

function makeSections(): {
  sections: CommandListSection[];
  spies: Record<string, ReturnType<typeof vi.fn>>;
} {
  const spies = { alpha: vi.fn(), beta: vi.fn(), gamma: vi.fn() };
  const sections: CommandListSection[] = [
    {
      label: "Gruppe A",
      items: [
        { id: "a", searchText: "alpha eins", content: <span>Alpha</span>, onSelect: spies.alpha },
        { id: "b", searchText: "beta zwei", content: <span>Beta</span>, onSelect: spies.beta },
      ],
    },
    {
      label: "Gruppe B",
      items: [
        { id: "c", searchText: "gamma drei", content: <span>Gamma</span>, onSelect: spies.gamma },
      ],
    },
  ];
  return { sections, spies };
}

test("filtert Items nach Query — nur passende sichtbar", async () => {
  const { sections } = makeSections();
  const user = userEvent.setup();
  render(
    <CommandList placeholder="Suche" sections={sections} emptyText="Leer" onClose={() => {}} />,
  );

  expect(screen.getByText("Alpha")).toBeInTheDocument();
  expect(screen.getByText("Beta")).toBeInTheDocument();
  expect(screen.getByText("Gamma")).toBeInTheDocument();

  await user.type(screen.getByPlaceholderText("Suche"), "beta");
  expect(screen.queryByText("Alpha")).not.toBeInTheDocument();
  expect(screen.getByText("Beta")).toBeInTheDocument();
  expect(screen.queryByText("Gamma")).not.toBeInTheDocument();
});

test("ArrowDown + Enter wählt das zweite Item", () => {
  const { sections, spies } = makeSections();
  render(
    <CommandList placeholder="Suche" sections={sections} emptyText="Leer" onClose={() => {}} />,
  );

  const input = screen.getByPlaceholderText("Suche");
  fireEvent.keyDown(input, { key: "ArrowDown" });
  fireEvent.keyDown(input, { key: "Enter" });

  expect(spies.beta).toHaveBeenCalledTimes(1);
  expect(spies.alpha).not.toHaveBeenCalled();
});

test("Klick auf ein Item ruft dessen onSelect", async () => {
  const { sections, spies } = makeSections();
  const user = userEvent.setup();
  render(
    <CommandList placeholder="Suche" sections={sections} emptyText="Leer" onClose={() => {}} />,
  );

  await user.click(screen.getByText("Gamma"));
  expect(spies.gamma).toHaveBeenCalledTimes(1);
});

test("Esc ruft onClose", () => {
  const onClose = vi.fn();
  const { sections } = makeSections();
  render(
    <CommandList placeholder="Suche" sections={sections} emptyText="Leer" onClose={onClose} />,
  );

  const input = screen.getByPlaceholderText("Suche");
  fireEvent.keyDown(input, { key: "Escape" });
  expect(onClose).toHaveBeenCalledTimes(1);
});

test("leere gefilterte Liste zeigt emptyText", async () => {
  const { sections } = makeSections();
  const user = userEvent.setup();
  render(
    <CommandList
      placeholder="Suche"
      sections={sections}
      emptyText="Nichts gefunden"
      onClose={() => {}}
    />,
  );

  await user.type(screen.getByPlaceholderText("Suche"), "xyzunbekannt");
  expect(screen.getByText("Nichts gefunden")).toBeInTheDocument();
});
