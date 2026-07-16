import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";

type Ctx = {
  owners: ReadonlySet<string>;
  register: (id: string) => void;
  unregister: (id: string) => void;
};

const VoiceScopeCtx = createContext<Ctx | null>(null);

export function VoiceScopeProvider({ children }: { children: ReactNode }) {
  const [owners, setOwners] = useState<Set<string>>(() => new Set());
  const register = useCallback((id: string) => {
    setOwners((prev) => {
      if (prev.has(id)) return prev;
      const next = new Set(prev);
      next.add(id);
      return next;
    });
  }, []);
  const unregister = useCallback((id: string) => {
    setOwners((prev) => {
      if (!prev.has(id)) return prev;
      const next = new Set(prev);
      next.delete(id);
      return next;
    });
  }, []);
  const value = useMemo(() => ({ owners, register, unregister }), [owners, register, unregister]);
  return <VoiceScopeCtx.Provider value={value}>{children}</VoiceScopeCtx.Provider>;
}

/** A mic surface calls this to declare itself the screen's voice target. */
export function useVoiceScopeOwner(id: string, active = true): void {
  const ctx = useContext(VoiceScopeCtx);
  useEffect(() => {
    if (!ctx || !active) return;
    ctx.register(id);
    return () => ctx.unregister(id);
  }, [ctx, id, active]);
}

/** True when any scoped mic is present — the global ComposerBar mic should hide. */
export function useHasScopedMic(): boolean {
  const ctx = useContext(VoiceScopeCtx);
  return !!ctx && ctx.owners.size > 0;
}
