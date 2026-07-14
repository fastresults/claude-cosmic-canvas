import { createFileRoute } from "@tanstack/react-router";
import { Sun, Moon, Monitor, Check } from "lucide-react";
import { SettingsPageHeader } from "@/components/settings/SettingsPageHeader";
import { useTheme } from "@/lib/theme/ThemeProvider";
import type { Theme } from "@/lib/theme/theme";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/settings/appearance")({
  component: Appearance,
});

const OPTIONS: { value: Theme; label: string; hint: string; Icon: typeof Sun }[] = [
  { value: "system", label: "System", hint: "Match your device setting", Icon: Monitor },
  { value: "light", label: "Light", hint: "Warm paper, deep ink", Icon: Sun },
  { value: "dark", label: "Dark", hint: "Eve's original night canvas", Icon: Moon },
];

function Appearance() {
  const { theme, setTheme, resolved } = useTheme();

  return (
    <div className="mx-auto max-w-2xl px-4 py-6">
      <SettingsPageHeader
        title="Appearance"
        description={`Choose how Eve looks. Currently showing ${resolved}.`}
      />
      <div className="space-y-2">
        {OPTIONS.map((opt) => {
          const active = theme === opt.value;
          return (
            <button
              key={opt.value}
              type="button"
              onClick={() => setTheme(opt.value)}
              className={cn(
                "flex w-full items-center gap-3 rounded-lg border bg-card px-4 py-3 text-left transition-colors hover:bg-surface-elev",
                active ? "border-accent" : "border-border",
              )}
            >
              <opt.Icon className="h-5 w-5 text-muted-foreground" />
              <div className="flex-1">
                <div className="text-sm font-medium text-foreground">{opt.label}</div>
                <div className="text-xs text-muted-foreground">{opt.hint}</div>
              </div>
              {active && <Check className="h-4 w-4 text-accent" />}
            </button>
          );
        })}
      </div>
    </div>
  );
}
