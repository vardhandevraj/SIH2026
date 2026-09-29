import { createContext, useContext, useState, useCallback, useMemo, type ReactNode } from "react";

interface DemoContextValue {
  demoMode: boolean;
  setDemoMode: (v: boolean) => void;
}

const DemoContext = createContext<DemoContextValue>({ demoMode: true, setDemoMode: () => undefined });

export function DemoProvider({ children }: { children: ReactNode }) {
  const [demoMode, setDemoModeState] = useState<boolean>(() => {
    try {
      const v = localStorage.getItem("chaintrace-demo");
      return v === null ? true : v === "1";
    } catch {
      return true;
    }
  });

  const setDemoMode = useCallback((v: boolean) => {
    setDemoModeState(v);
    try {
      localStorage.setItem("chaintrace-demo", v ? "1" : "0");
    } catch {
      // localStorage unavailable (private mode) - state still updates in memory
    }
  }, []);

  const value = useMemo(() => ({ demoMode, setDemoMode }), [demoMode, setDemoMode]);

  return <DemoContext.Provider value={value}>{children}</DemoContext.Provider>;
}

export function useDemoMode() {
  return useContext(DemoContext);
}
