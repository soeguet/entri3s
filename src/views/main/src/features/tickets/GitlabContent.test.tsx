import { test, expect, vi, beforeEach } from "vitest";
import { screen, waitFor } from "@testing-library/react";
import { renderWithClient } from "../../lib/test-utils";
import * as api from "../../api";
import { GitlabContent } from "./GitlabContent";

vi.mock("../../api");

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(api.getSettings).mockResolvedValue({
    data: {
      gitlabUrl: "https://gitlab.example.com",
      syncIntervalSec: 300,
      todoFolder: "",
      todoRemindersEnabled: true,
      reminderTime: "09:00",
    },
    error: null,
  });
});

test("ersetzt ein /uploads/-Bild bei Erfolg durch die proxy-data-URL", async () => {
  vi.mocked(api.getGitlabImage).mockResolvedValue({
    data: "data:image/png;base64,AAA",
    error: null,
  });

  renderWithClient(<GitlabContent html='<p>Hi</p><img src="/uploads/x/shot.png" alt="Shot">' />);

  // Warten bis das Proxy-Bild mit der data-URL gesetzt ist (ersetzt das Original).
  await waitFor(() => {
    const img = screen.getByAltText("Shot");
    expect(img.getAttribute("src")).toBe("data:image/png;base64,AAA");
  });
  // Klickbar → öffnet die absolute Original-URL in GitLab.
  const link = screen.getByAltText("Shot").closest("a");
  expect(link?.getAttribute("href")).toBe("https://gitlab.example.com/uploads/x/shot.png");
  expect(api.getGitlabImage).toHaveBeenCalledWith("/uploads/x/shot.png");
});

test("zeigt kompakten Fallback-Link, wenn der Proxy scheitert", async () => {
  vi.mocked(api.getGitlabImage).mockResolvedValue({
    data: undefined as never,
    error: { code: "FORBIDDEN", message: "nope", retry: false },
  });

  renderWithClient(<GitlabContent html='<img src="/uploads/x/shot.png">' />);

  const link = await screen.findByText("🖼️ Bild in GitLab öffnen");
  expect(link.getAttribute("href")).toBe("https://gitlab.example.com/uploads/x/shot.png");
});

test("löst lazy-loaded Bild (data-src) auf und entschachtelt den Anker", async () => {
  vi.mocked(api.getGitlabImage).mockResolvedValue({
    data: "data:image/png;base64,BBB",
    error: null,
  });

  renderWithClient(
    <GitlabContent
      html={
        '<p><a href="/-/project/5/uploads/x/image.png" target="_blank">' +
        '<img src="data:image/gif;base64,R0lGODlhAQABAAAA..." ' +
        'data-src="/-/project/5/uploads/x/image.png" class="lazy" alt="image"></a></p>'
      }
    />,
  );

  // Nach Erfolg: gerendertes <img> trägt die Proxy-data-URL (nicht den GIF-Platzhalter).
  await waitFor(() => {
    const img = screen.getByAltText("image");
    expect(img.getAttribute("src")).toBe("data:image/png;base64,BBB");
  });

  // getGitlabImage wurde mit der echten data-src-URL aufgerufen.
  expect(api.getGitlabImage).toHaveBeenCalledWith("/-/project/5/uploads/x/image.png");

  // Genau ein umschließender Anker, absolute URL, keine Verschachtelung.
  const img = screen.getByAltText("image");
  const anchor = img.closest("a");
  expect(anchor?.getAttribute("href")).toBe(
    "https://gitlab.example.com/-/project/5/uploads/x/image.png",
  );
  expect(anchor?.parentElement?.closest("a")).toBeNull();
});

test("lässt externe Bilder unangetastet (kein Proxy)", async () => {
  renderWithClient(
    <GitlabContent html='<img src="https://other.example.org/pic.png" alt="Ext">' />,
  );

  const img = await screen.findByAltText("Ext");
  expect(img.getAttribute("src")).toBe("https://other.example.org/pic.png");
  expect(api.getGitlabImage).not.toHaveBeenCalled();
});
