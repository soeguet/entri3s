import { test, expect, vi } from "vitest";
import { render, screen, act } from "@testing-library/react";
import { useCommands, useRegisteredCommands, type Command } from "./useCommand";

function Producer(props: { commands: Command[] }) {
  useCommands(props.commands);
  return null;
}

function Consumer() {
  const commands = useRegisteredCommands();
  return (
    <ul>
      {commands.map((c) => (
        <li key={c.id}>{c.label}</li>
      ))}
    </ul>
  );
}

test("nach useCommands-Mount erscheinen die Commands in useRegisteredCommands", () => {
  const run = vi.fn();
  render(
    <>
      <Producer commands={[{ id: "test:a", label: "Aktion A", run }]} />
      <Consumer />
    </>,
  );

  expect(screen.getByText("Aktion A")).toBeInTheDocument();
});

test("nach Unmount sind die Commands wieder weg", () => {
  const run = vi.fn();
  const { unmount } = render(
    <>
      <Producer commands={[{ id: "test:b", label: "Aktion B", run }]} />
      <Consumer />
    </>,
  );

  expect(screen.getByText("Aktion B")).toBeInTheDocument();

  // Die Consumer-Komponente muss nach dem Unmount des Producers separat
  // gerendert werden, um den neuen Snapshot zu sehen.
  unmount();

  const { container } = render(<Consumer />);
  expect(container.querySelectorAll("li")).toHaveLength(0);
});

test("run-Proxy delegiert an den aktuellen Ref", () => {
  const first = vi.fn();
  const second = vi.fn();

  let commands: Command[] | null = null;

  function Capturer() {
    commands = useRegisteredCommands();
    return null;
  }

  const { rerender } = render(
    <>
      <Producer commands={[{ id: "test:c", label: "C", run: first }]} />
      <Capturer />
    </>,
  );

  // Re-render mit neuer run-Funktion, gleiche id.
  rerender(
    <>
      <Producer commands={[{ id: "test:c", label: "C", run: second }]} />
      <Capturer />
    </>,
  );

  act(() => commands![0].run());
  expect(first).not.toHaveBeenCalled();
  expect(second).toHaveBeenCalledTimes(1);
});
