import { useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { Dialog } from "../../components/ui/dialog";
import {
  CommandList,
  type CommandListSection,
  type CommandListItem,
} from "../../components/CommandList";
import { useHotkey } from "../../lib/useHotkey";
import { useRegisteredCommands, type Command } from "../../lib/useCommand";

const NAV_ITEMS: Array<{ label: string; to: string }> = [
  { label: "Zu Entries", to: "/entries" },
  { label: "Zu Tickets", to: "/tickets" },
  { label: "Zu Buchungen", to: "/booking" },
  { label: "Zu Management", to: "/management" },
  { label: "Zu Settings", to: "/settings" },
];

function commandToItem(command: Command, onDone: () => void): CommandListItem {
  return {
    id: command.id,
    searchText: `${command.label} ${command.keywords ?? ""}`,
    content: <span>{command.label}</span>,
    onSelect: () => {
      command.run();
      onDone();
    },
  };
}

export function CommandPalette() {
  const [open, setOpen] = useState(false);
  const navigate = useNavigate();
  const registered = useRegisteredCommands();

  useHotkey("mod+k", () => setOpen((o) => !o), { scope: "global" });

  const close = () => setOpen(false);

  const navSection: CommandListSection = {
    label: "Navigation",
    items: NAV_ITEMS.map((item) => ({
      id: `nav:${item.to}`,
      searchText: item.label,
      content: <span>{item.label}</span>,
      onSelect: () => {
        navigate({ to: item.to });
        close();
      },
    })),
  };

  // Registrierte Commands nach section gruppieren.
  const grouped = new Map<string, Command[]>();
  for (const cmd of registered) {
    const key = cmd.section ?? "Aktionen";
    const list = grouped.get(key) ?? [];
    list.push(cmd);
    grouped.set(key, list);
  }

  const dynamicSections: CommandListSection[] = [...grouped.entries()].map(([label, cmds]) => ({
    label,
    items: cmds.map((c) => commandToItem(c, close)),
  }));

  const sections = [navSection, ...dynamicSections];

  return (
    <Dialog open={open} onClose={close} title="Befehle">
      <CommandList
        placeholder="Befehl suchen..."
        sections={sections}
        emptyText="Kein Befehl gefunden."
        onClose={close}
      />
    </Dialog>
  );
}
