import { createContext, useContext, useMemo, useState, type ReactNode } from "react";

export type ViewMode = "consolidado" | "realizado" | "previsto";

export interface GlobalFilters {
  bankAccountId: string | null;
  costCenterId: string | null;
  businessUnit: string | null;
  viewMode: ViewMode;
}

interface Ctx extends GlobalFilters {
  setBankAccountId: (v: string | null) => void;
  setCostCenterId: (v: string | null) => void;
  setBusinessUnit: (v: string | null) => void;
  setViewMode: (v: ViewMode) => void;
  reset: () => void;
  isDirty: boolean;
}

const FiltersContext = createContext<Ctx | null>(null);

export function FiltersProvider({ children }: { children: ReactNode }) {
  const [bankAccountId, setBankAccountId] = useState<string | null>(null);
  const [costCenterId, setCostCenterId] = useState<string | null>(null);
  const [businessUnit, setBusinessUnit] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<ViewMode>("consolidado");

  const value = useMemo<Ctx>(
    () => ({
      bankAccountId,
      costCenterId,
      businessUnit,
      viewMode,
      setBankAccountId,
      setCostCenterId,
      setBusinessUnit,
      setViewMode,
      reset: () => {
        setBankAccountId(null);
        setCostCenterId(null);
        setBusinessUnit(null);
        setViewMode("consolidado");
      },
      isDirty:
        !!bankAccountId || !!costCenterId || !!businessUnit || viewMode !== "consolidado",
    }),
    [bankAccountId, costCenterId, businessUnit, viewMode],
  );

  return <FiltersContext.Provider value={value}>{children}</FiltersContext.Provider>;
}

export function useFilters(): Ctx {
  const ctx = useContext(FiltersContext);
  if (!ctx) throw new Error("useFilters must be used inside FiltersProvider");
  return ctx;
}