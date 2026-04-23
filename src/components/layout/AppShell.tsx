import { Link, Outlet, useLocation, useNavigate } from "@tanstack/react-router";
import {
  LayoutDashboard,
  BarChart3,
  Wallet,
  Repeat,
  Scale,
  Settings,
  Search,
  Bell,
  RefreshCw,
  ChevronDown,
  Zap,
  LogOut,
  Menu,
  SlidersHorizontal,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { useAuth } from "@/hooks/useAuth";
import { useIsMobile } from "@/hooks/use-mobile";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { useState } from "react";
import { PeriodPresets } from "@/components/ui/period-presets";
import { FiltersProvider, useFilters, type ViewMode } from "@/lib/filters-context";
import { useCompany } from "@/lib/queries/company";
import {
  useBankAccountOptions,
  useCostCenterOptions,
  useBusinessUnitOptions,
  useFilteredEntryCount,
} from "@/lib/queries/filters";

const NAV = [
  { to: "/", label: "Home", icon: LayoutDashboard },
  { to: "/dre", label: "DRE", icon: BarChart3 },
  { to: "/fluxo-de-caixa", label: "Fluxo de Caixa", icon: Wallet, shortLabel: "Fluxo" },
  { to: "/ciclo-financeiro", label: "Ciclo Financeiro", icon: Repeat, shortLabel: "Ciclo" },
  { to: "/projecao-balanco", label: "Projeção do Balanço", icon: Scale, shortLabel: "Balanço" },
  { to: "/admin", label: "Admin", icon: Settings },
] as const;

const BOTTOM_NAV = NAV.filter((n) => n.label !== "Projeção do Balanço");

export function AppShell() {
  return (
    <FiltersProvider>
      <AppShellInner />
    </FiltersProvider>
  );
}

function AppShellInner() {
  const loc = useLocation();
  const { user, signOut } = useAuth();
  const navigate = useNavigate();
  const { data: company } = useCompany();
  const cid = company?.id;
  const { data: banks = [] } = useBankAccountOptions(cid);
  const { data: ccs = [] } = useCostCenterOptions(cid);
  const { data: bus = [] } = useBusinessUnitOptions(cid);
  const filters = useFilters();
  const { data: matchCount } = useFilteredEntryCount(cid, {
    bankAccountId: filters.bankAccountId,
    costCenterId: filters.costCenterId,
    businessUnit: filters.businessUnit,
  });
  const isMobile = useIsMobile();
  const [navOpen, setNavOpen] = useState(false);
  const [filtersOpen, setFiltersOpen] = useState(false);

  const displayName =
    (user?.user_metadata?.full_name as string) ||
    (user?.user_metadata?.name as string) ||
    user?.email?.split("@")[0] ||
    "Usuário";
  const initials = displayName
    .split(" ")
    .map((s) => s[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();

  const activeFiltersCount =
    (filters.bankAccountId ? 1 : 0) +
    (filters.costCenterId ? 1 : 0) +
    (filters.businessUnit ? 1 : 0) +
    (filters.viewMode !== "consolidado" ? 1 : 0);

  const sidebarContent = (
    <>
      <div className="h-16 flex items-center gap-2.5 px-5 border-b border-sidebar-border">
        <div
          className="size-9 rounded-lg grid place-items-center bg-primary text-primary-foreground"
          style={{ boxShadow: "0 4px 14px -4px oklch(0.93 0.18 102 / 40%)" }}
        >
          <Zap className="size-[18px]" strokeWidth={2.5} />
        </div>
        <div className="leading-tight">
          <div className="text-sm font-semibold tracking-wide">HITECH</div>
          <div className="text-[10px] uppercase tracking-[0.2em] text-muted-foreground mt-0.5">
            Electric · Cockpit
          </div>
        </div>
      </div>

      <nav className="flex-1 p-3 space-y-0.5 overflow-y-auto">
        <div className="px-3 pt-2 pb-1.5 text-[10px] uppercase tracking-[0.2em] text-muted-foreground/70 font-medium">
          Navegação
        </div>
        {NAV.map((n) => {
          const active =
            n.to === "/" ? loc.pathname === "/" : loc.pathname.startsWith(n.to);
          const Icon = n.icon;
          return (
            <Link
              key={n.to}
              to={n.to}
              onClick={() => setNavOpen(false)}
              className={`group relative flex items-center gap-3 rounded-md px-3 py-2.5 text-sm transition-colors duration-150 ${
                active
                  ? "bg-sidebar-accent text-sidebar-accent-foreground"
                  : "text-sidebar-foreground/65 hover:bg-sidebar-accent/50 hover:text-sidebar-foreground"
              }`}
            >
              {active && (
                <span className="absolute left-0 top-1.5 bottom-1.5 w-0.5 rounded-r-full bg-primary" />
              )}
              <Icon
                className={`size-4 transition-colors ${
                  active ? "text-primary" : "group-hover:text-foreground"
                }`}
                strokeWidth={active ? 2.25 : 1.75}
              />
              <span className={active ? "font-medium" : "font-normal"}>{n.label}</span>
            </Link>
          );
        })}
      </nav>

      <div className="p-3 m-3 mt-0 border border-sidebar-border rounded-lg bg-sidebar-accent/30 text-xs text-muted-foreground">
        <div className="flex items-center gap-2 text-foreground/90">
          <span className="relative flex size-2">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-success opacity-60" />
            <span className="relative inline-flex size-2 rounded-full bg-success" />
          </span>
          <span className="font-medium">OMIE conectado</span>
        </div>
        <div className="mt-1.5 text-[11px]">Sincronização ativa</div>
      </div>
    </>
  );

  return (
    <div className="min-h-screen bg-background text-foreground flex selection:bg-primary/30 selection:text-foreground">
      {/* Sidebar — desktop only */}
      <aside className="hidden lg:flex w-60 shrink-0 bg-sidebar text-sidebar-foreground border-r border-sidebar-border flex-col">
        {sidebarContent}
      </aside>

      {/* Mobile drawer */}
      <Sheet open={navOpen} onOpenChange={setNavOpen}>
        <SheetContent
          side="left"
          className="p-0 w-72 bg-sidebar text-sidebar-foreground border-sidebar-border flex flex-col"
        >
          <SheetHeader className="sr-only">
            <SheetTitle>Navegação</SheetTitle>
          </SheetHeader>
          {sidebarContent}
        </SheetContent>
      </Sheet>

      {/* Main */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Header */}
        <header className="h-14 lg:h-16 border-b border-border bg-background/80 backdrop-blur-md flex items-center gap-2 px-3 sm:px-4 lg:px-6 sticky top-0 z-30">
          {/* Mobile menu */}
          <Button
            variant="ghost"
            size="icon"
            className="lg:hidden size-9 -ml-1"
            onClick={() => setNavOpen(true)}
            aria-label="Abrir menu"
          >
            <Menu className="size-5" />
          </Button>

          {/* Mobile brand (no sidebar visible) */}
          <div className="lg:hidden flex items-center gap-2 min-w-0">
            <div className="size-7 rounded-md grid place-items-center bg-primary text-primary-foreground shrink-0">
              <Zap className="size-4" strokeWidth={2.5} />
            </div>
            <span className="text-sm font-semibold tracking-wide">HITECH</span>
          </div>

          {/* Search — desktop */}
          <div className="relative hidden lg:block w-80 max-w-[40vw]">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
            <Input
              placeholder="Buscar conta, fornecedor, cliente…"
              className="pl-9 h-9 bg-input/40 border-border focus-visible:bg-input/70 transition-colors"
            />
            <kbd className="hidden md:inline-flex absolute right-2.5 top-1/2 -translate-y-1/2 h-5 items-center gap-1 rounded border border-border bg-card px-1.5 text-[10px] font-medium text-muted-foreground">
              ⌘K
            </kbd>
          </div>

          <div className="ml-auto flex items-center gap-1">
            <Button
              variant="ghost"
              size="sm"
              className="hidden md:inline-flex text-muted-foreground hover:text-foreground gap-1.5 h-8"
            >
              <RefreshCw className="size-3.5" />
              Atualizar
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="text-muted-foreground hover:text-foreground size-9 relative"
              aria-label="Notificações"
            >
              <Bell className="size-4" />
              <span className="absolute top-2 right-2 size-1.5 rounded-full bg-warning ring-2 ring-background" />
            </Button>
            <span className="hidden sm:block h-5 w-px bg-border mx-1" />
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button className="flex items-center gap-2 outline-none rounded-md px-1.5 py-1 hover:bg-card transition-colors">
                  <div className="size-8 rounded-full bg-gradient-to-br from-primary to-primary/70 text-primary-foreground grid place-items-center text-xs font-semibold">
                    {initials}
                  </div>
                  <div className="leading-tight text-left hidden sm:block">
                    <div className="text-sm font-medium truncate max-w-[140px]">{displayName}</div>
                    <div className="text-[11px] text-muted-foreground truncate max-w-[160px]">
                      {user?.email ?? "—"}
                    </div>
                  </div>
                  <ChevronDown className="size-4 text-muted-foreground hidden sm:block" />
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-56">
                <DropdownMenuLabel>Conta</DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  onClick={async () => {
                    await signOut();
                    navigate({ to: "/auth" });
                  }}
                  className="text-destructive focus:text-destructive"
                >
                  <LogOut className="size-4 mr-2" />
                  Sair
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </header>

        {/* Global filters — desktop */}
        <div className="hidden lg:flex border-b border-border bg-card/10 px-6 py-2.5 flex-wrap items-center gap-2">
          <PeriodPresets defaultValue="30d" />
          <span className="h-5 w-px bg-border mx-1" />
          <FilterSelect
            placeholder="Unidade"
            value={filters.businessUnit ?? "__all"}
            onChange={(v) => filters.setBusinessUnit(v === "__all" ? null : v)}
            items={[
              { v: "__all", l: "Todas as unidades" },
              ...bus.map((u) => ({ v: u, l: u })),
            ]}
            disabled={bus.length === 0}
          />
          <FilterSelect
            placeholder="Conta bancária"
            value={filters.bankAccountId ?? "__all"}
            onChange={(v) => filters.setBankAccountId(v === "__all" ? null : v)}
            items={[
              { v: "__all", l: "Todas as contas" },
              ...banks.map((b) => ({ v: b.id, l: b.label })),
            ]}
            disabled={banks.length === 0}
          />
          <FilterSelect
            placeholder="Centro de custo"
            value={filters.costCenterId ?? "__all"}
            onChange={(v) => filters.setCostCenterId(v === "__all" ? null : v)}
            items={[
              { v: "__all", l: "Todos C. Custo" },
              ...ccs.map((c) => ({ v: c.id, l: c.label })),
            ]}
            disabled={ccs.length === 0}
          />
          <FilterSelect
            placeholder="Visão"
            value={filters.viewMode}
            onChange={(v) => filters.setViewMode(v as ViewMode)}
            items={[
              { v: "consolidado", l: "Consolidado" },
              { v: "realizado", l: "Realizado" },
              { v: "previsto", l: "Previsto" },
            ]}
          />
          <button
            type="button"
            onClick={filters.reset}
            disabled={!filters.isDirty}
            className="h-7 px-2.5 text-[11px] text-muted-foreground hover:text-foreground transition-colors rounded-md disabled:opacity-50"
          >
            Limpar filtros
          </button>
          {filters.isDirty && typeof matchCount === "number" && (
            <Badge
              variant="outline"
              className={
                matchCount === 0
                  ? "border-warning/40 text-warning bg-warning/10 text-[11px]"
                  : "border-primary/30 text-primary bg-primary/5 text-[11px]"
              }
            >
              {matchCount === 0 ? "Nenhum lançamento" : `${matchCount.toLocaleString("pt-BR")} lançamentos`}
            </Badge>
          )}
          <Badge
            variant="outline"
            className="ml-auto border-primary/30 text-primary bg-primary/5 font-medium gap-1.5"
          >
            <span className="size-1.5 rounded-full bg-primary" />
            OMIE • API v2
          </Badge>
        </div>

        {/* Global filters — mobile (button) */}
        <div className="lg:hidden border-b border-border bg-card/10 px-3 py-2 flex items-center gap-2 overflow-x-auto tabs-scroll">
          <Button
            variant="outline"
            size="sm"
            className="h-8 gap-1.5 shrink-0"
            onClick={() => setFiltersOpen(true)}
          >
            <SlidersHorizontal className="size-3.5" />
            Filtros
            {activeFiltersCount > 0 && (
              <span className="ml-0.5 inline-flex size-4 items-center justify-center rounded-full bg-primary text-primary-foreground text-[10px] font-semibold">
                {activeFiltersCount}
              </span>
            )}
          </Button>
          {filters.isDirty && typeof matchCount === "number" && (
            <Badge
              variant="outline"
              className={
                matchCount === 0
                  ? "border-warning/40 text-warning bg-warning/10 text-[10px] shrink-0"
                  : "border-primary/30 text-primary bg-primary/5 text-[10px] shrink-0"
              }
            >
              {matchCount === 0 ? "Nenhum" : `${matchCount.toLocaleString("pt-BR")}`}
            </Badge>
          )}
          <Badge
            variant="outline"
            className="ml-auto border-primary/30 text-primary bg-primary/5 font-medium gap-1.5 shrink-0 text-[10px]"
          >
            <span className="size-1.5 rounded-full bg-primary" />
            OMIE
          </Badge>
        </div>

        {/* Filters bottom sheet */}
        <Sheet open={filtersOpen} onOpenChange={setFiltersOpen}>
          <SheetContent side="bottom" className="max-h-[85vh] overflow-y-auto">
            <SheetHeader className="text-left">
              <SheetTitle className="flex items-center justify-between">
                Filtros
                <button
                  onClick={() => setFiltersOpen(false)}
                  className="text-muted-foreground hover:text-foreground"
                  aria-label="Fechar"
                >
                  <X className="size-4" />
                </button>
              </SheetTitle>
            </SheetHeader>
            <div className="mt-4 space-y-4">
              <FilterField label="Unidade de negócio">
                <FilterSelect
                  placeholder="Unidade"
                  value={filters.businessUnit ?? "__all"}
                  onChange={(v) => filters.setBusinessUnit(v === "__all" ? null : v)}
                  items={[
                    { v: "__all", l: "Todas as unidades" },
                    ...bus.map((u) => ({ v: u, l: u })),
                  ]}
                  disabled={bus.length === 0}
                  fullWidth
                />
              </FilterField>
              <FilterField label="Conta bancária">
                <FilterSelect
                  placeholder="Conta bancária"
                  value={filters.bankAccountId ?? "__all"}
                  onChange={(v) => filters.setBankAccountId(v === "__all" ? null : v)}
                  items={[
                    { v: "__all", l: "Todas as contas" },
                    ...banks.map((b) => ({ v: b.id, l: b.label })),
                  ]}
                  disabled={banks.length === 0}
                  fullWidth
                />
              </FilterField>
              <FilterField label="Centro de custo">
                <FilterSelect
                  placeholder="Centro de custo"
                  value={filters.costCenterId ?? "__all"}
                  onChange={(v) => filters.setCostCenterId(v === "__all" ? null : v)}
                  items={[
                    { v: "__all", l: "Todos C. Custo" },
                    ...ccs.map((c) => ({ v: c.id, l: c.label })),
                  ]}
                  disabled={ccs.length === 0}
                  fullWidth
                />
              </FilterField>
              <FilterField label="Visão">
                <FilterSelect
                  placeholder="Visão"
                  value={filters.viewMode}
                  onChange={(v) => filters.setViewMode(v as ViewMode)}
                  items={[
                    { v: "consolidado", l: "Consolidado" },
                    { v: "realizado", l: "Realizado" },
                    { v: "previsto", l: "Previsto" },
                  ]}
                  fullWidth
                />
              </FilterField>
              {filters.isDirty && typeof matchCount === "number" && (
                <div className="text-xs text-muted-foreground">
                  {matchCount.toLocaleString("pt-BR")} lançamentos correspondem aos filtros
                </div>
              )}
              <div className="flex gap-2 pt-2">
                <Button
                  variant="outline"
                  className="flex-1"
                  onClick={() => filters.reset()}
                  disabled={!filters.isDirty}
                >
                  Limpar
                </Button>
                <Button
                  className="flex-1 bg-primary text-primary-foreground hover:bg-primary/90"
                  onClick={() => setFiltersOpen(false)}
                >
                  Aplicar
                </Button>
              </div>
            </div>
          </SheetContent>
        </Sheet>

        <main className="flex-1 px-4 py-4 lg:p-6 overflow-auto pb-20 md:pb-6">
          <div className="max-w-[1600px] mx-auto anim-fade-in">
            <Outlet />
          </div>
        </main>

        {/* Bottom navigation — mobile only */}
        {isMobile && (
          <nav
            className="fixed bottom-0 left-0 right-0 z-40 grid grid-cols-5 border-t border-border bg-background/95 backdrop-blur md:hidden"
            style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
          >
            {BOTTOM_NAV.map((n) => {
              const active =
                n.to === "/" ? loc.pathname === "/" : loc.pathname.startsWith(n.to);
              const Icon = n.icon;
              const label = "shortLabel" in n ? n.shortLabel : n.label;
              return (
                <Link
                  key={n.to}
                  to={n.to}
                  className={`flex flex-col items-center justify-center gap-0.5 py-2 text-[10px] font-medium transition-colors ${
                    active ? "text-primary" : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  <Icon
                    className="size-5"
                    strokeWidth={active ? 2.25 : 1.75}
                  />
                  <span className="truncate">{label}</span>
                </Link>
              );
            })}
          </nav>
        )}
      </div>
    </div>
  );
}

function FilterField({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <label className="text-[11px] uppercase tracking-wider text-muted-foreground font-medium">
        {label}
      </label>
      {children}
    </div>
  );
}

function FilterSelect({
  placeholder,
  value,
  onChange,
  items,
  disabled,
  fullWidth,
}: {
  placeholder: string;
  value: string;
  onChange: (v: string) => void;
  items: { v: string; l: string }[];
  disabled?: boolean;
  fullWidth?: boolean;
}) {
  return (
    <Select value={value} onValueChange={onChange} disabled={disabled}>
      <SelectTrigger
        className={
          fullWidth
            ? "h-10 w-full bg-input/40 border-border text-sm font-medium hover:bg-input/70 transition-colors disabled:opacity-50"
            : "h-7 w-auto min-w-[130px] bg-input/40 border-border text-[11px] font-medium hover:bg-input/70 transition-colors disabled:opacity-50"
        }
      >
        <SelectValue placeholder={placeholder} />
      </SelectTrigger>
      <SelectContent>
        {items.map((i) => (
          <SelectItem key={i.v} value={i.v} className={fullWidth ? "text-sm" : "text-xs"}>
            {i.l}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
