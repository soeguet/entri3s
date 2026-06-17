import { Sun, Moon, Monitor, Check } from "lucide-react";
import type { ComponentType } from "react";
import { useTheme, ACCENTS, type ThemeMode, type AccentName } from "../../lib/theme";
import { Label } from "../../components/ui/label";
import { cn } from "../../lib/utils";

const MODES: { value: ThemeMode; label: string; icon: ComponentType<{ className?: string }> }[] = [
  { value: "system", label: "System", icon: Monitor },
  { value: "light", label: "Hell", icon: Sun },
  { value: "dark", label: "Dunkel", icon: Moon },
];

/** Erscheinungsbild: Hell/Dunkel/System-Modus und Akzentfarbe (lokale Präferenz). */
export function ThemeSettings() {
  const theme = useTheme();

  return (
    <div className="space-y-5 rounded-lg border border-border bg-card p-5">
      <h2 className="text-lg font-semibold">Erscheinungsbild</h2>

      <div>
        <Label>Modus</Label>
        <div className="mt-1.5 inline-flex rounded-md border border-input p-0.5">
          {MODES.map((item) => {
            const active = theme.mode === item.value;
            return (
              <button
                key={item.value}
                type="button"
                onClick={() => theme.setMode(item.value)}
                aria-pressed={active}
                className={cn(
                  "inline-flex items-center gap-1.5 rounded px-3 py-1.5 text-sm font-medium transition-colors",
                  active
                    ? "bg-primary text-primary-foreground"
                    : "text-muted-foreground hover:bg-muted",
                )}
              >
                <item.icon className="h-4 w-4" />
                {item.label}
              </button>
            );
          })}
        </div>
        <p className="mt-1.5 text-xs text-muted-foreground">
          „System" folgt der Einstellung deines Betriebssystems.
        </p>
      </div>

      <div>
        <Label>Akzentfarbe</Label>
        <div className="mt-1.5 flex flex-wrap gap-2">
          {ACCENTS.map((accent) => (
            <AccentSwatch
              key={accent.name}
              name={accent.name}
              label={accent.label}
              swatch={accent.swatch}
              active={theme.accent === accent.name}
              onSelect={() => theme.setAccent(accent.name)}
            />
          ))}
        </div>
      </div>
    </div>
  );
}

interface AccentSwatchProps {
  name: AccentName;
  label: string;
  swatch: string;
  active: boolean;
  onSelect: () => void;
}

function AccentSwatch(props: AccentSwatchProps) {
  return (
    <button
      type="button"
      onClick={props.onSelect}
      title={props.label}
      aria-label={`Akzentfarbe ${props.label}`}
      aria-pressed={props.active}
      className={cn(
        "flex h-9 w-9 items-center justify-center rounded-full ring-offset-2 ring-offset-card transition-shadow focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
        props.active ? "ring-2 ring-ring" : "ring-1 ring-border hover:ring-2 hover:ring-ring",
      )}
      style={{ backgroundColor: props.swatch }}
    >
      {props.active ? <Check className="h-4 w-4 text-white" /> : null}
    </button>
  );
}
