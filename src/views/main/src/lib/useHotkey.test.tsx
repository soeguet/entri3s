import { test, expect, vi } from "vitest";
import { render, fireEvent } from "@testing-library/react";
import { useHotkey } from "./useHotkey";

function HotkeyTestHelper(props: {
  combo: string;
  onFire: () => void;
  scope?: "global" | "page";
  enabled?: boolean;
}) {
  useHotkey(props.combo, props.onFire, {
    scope: props.scope,
    enabled: props.enabled,
  });
  return null;
}

test("Einzeltaste 'n' feuert den Handler bei window keydown", () => {
  const handler = vi.fn();
  render(<HotkeyTestHelper combo="n" onFire={handler} />);

  fireEvent.keyDown(window, { key: "n" });
  expect(handler).toHaveBeenCalledTimes(1);
});

test("Input-Guard: bei fokussiertem <input> feuert Einzeltaste 'n' NICHT", () => {
  const handler = vi.fn();
  render(
    <div>
      <HotkeyTestHelper combo="n" onFire={handler} />
      <input data-testid="field" />
    </div>,
  );

  const input = document.querySelector("input")!;
  input.focus();
  fireEvent.keyDown(input, { key: "n" });
  expect(handler).not.toHaveBeenCalled();
});

test("Modal-Guard: page-Binding feuert nicht bei offenem Modal, global schon", () => {
  const pageFn = vi.fn();
  const globalFn = vi.fn();
  render(
    <div>
      <HotkeyTestHelper combo="n" onFire={pageFn} scope="page" />
      <HotkeyTestHelper combo="t" onFire={globalFn} scope="global" />
      <div aria-modal="true" role="dialog">
        Modal
      </div>
    </div>,
  );

  fireEvent.keyDown(window, { key: "n" });
  expect(pageFn).not.toHaveBeenCalled();

  fireEvent.keyDown(window, { key: "t" });
  expect(globalFn).toHaveBeenCalledTimes(1);
});

test("mod+k feuert mit ctrlKey — auch wenn ein Input fokussiert ist", () => {
  const handler = vi.fn();
  render(
    <div>
      <HotkeyTestHelper combo="mod+k" onFire={handler} />
      <input data-testid="field" />
    </div>,
  );

  const input = document.querySelector("input")!;
  input.focus();
  fireEvent.keyDown(input, { key: "k", ctrlKey: true });
  expect(handler).toHaveBeenCalledTimes(1);
});

test("Cleanup: nach Unmount feuert der Handler nicht mehr", () => {
  const handler = vi.fn();
  const { unmount } = render(<HotkeyTestHelper combo="n" onFire={handler} />);

  fireEvent.keyDown(window, { key: "n" });
  expect(handler).toHaveBeenCalledTimes(1);

  unmount();
  fireEvent.keyDown(window, { key: "n" });
  expect(handler).toHaveBeenCalledTimes(1);
});
