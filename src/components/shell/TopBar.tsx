import { Bell, Flame } from "lucide-react";
import { Link } from "@tanstack/react-router";
import { ThemeToggle } from "./ThemeToggle";
import askEveLogo from "@/assets/askeve-logo.png.asset.json";
import askEveLogoDark from "@/assets/askeve-logo-dark.png.asset.json";


export function TopBar() {
  return (
    <header className="fixed inset-x-0 top-0 z-40 h-14 border-b border-border frosted">
      <div className="mx-auto flex h-full max-w-3xl items-center justify-between px-4">
        <Link to="/" className="flex items-center" aria-label="AskEve home">
          <img src={askEveLogo.url} alt="AskEve" className="block h-8 w-auto dark:hidden" />
          <img src={askEveLogoDark.url} alt="AskEve" className="hidden h-8 w-auto dark:block" />
        </Link>


        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1 rounded-full border border-border bg-surface-elev px-2 py-1 text-xs text-muted-foreground">
            <Flame className="h-3 w-3 text-accent" />
            <span>0</span>
          </div>
          <ThemeToggle />
          <button

            aria-label="Notifications"
            className="rounded-full p-1.5 text-muted-foreground transition-colors hover:bg-surface-elev hover:text-foreground"
          >
            <Bell className="h-4 w-4" />
          </button>
          <Link
            to="/settings"
            aria-label="Account"
            className="grid h-8 w-8 place-items-center rounded-full bg-accent/20 text-xs font-medium text-accent"
          >
            E
          </Link>
        </div>
      </div>
    </header>
  );
}
