import { useEffect } from "react";

/**
 * Installs a `beforeunload` listener while `isDirty` is true so the browser
 * prompts the user before they close or refresh a tab with unsaved work.
 *
 * The exact message is controlled by the browser (Chrome/Safari/Firefox all
 * show a generic prompt); returning any string from the handler triggers it.
 */
export function useUnsavedChangesGuard(isDirty: boolean, message = "You have unsaved changes. Leave anyway?") {
  useEffect(() => {
    if (!isDirty) return;
    const onBeforeUnload = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      // Legacy browsers require returnValue to be set.
      e.returnValue = message;
      return message;
    };
    window.addEventListener("beforeunload", onBeforeUnload);
    return () => window.removeEventListener("beforeunload", onBeforeUnload);
  }, [isDirty, message]);
}
