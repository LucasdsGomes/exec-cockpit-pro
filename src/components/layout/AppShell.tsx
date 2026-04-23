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
import { sync } from "@/lib/mock-data";
import { useAuth } from "@/hooks/useAuth";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

const NAV = [
  { to: "/", label: "Home", icon: LayoutDashboard },
  { to: "/dre", label: "DRE", icon: BarChart3 },
  { to: "/fluxo-de-caixa", label: "Fluxo de Caixa", icon: Wallet },
  { to: "/ciclo-financeiro", label: "Ciclo Financeiro", icon: Repeat },
  { to: "/projecao-balanco", label: "Projeção do Balanço", icon: Scale },
  { to: "/admin", label: "Admin", icon: Settings },
] as const;

export function AppShell() {
  const loc = useLocation();
  const { user, signOut } = useAuth();
  const navigate = useNavigate();
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
  return (
    <div className="min-h-screen bg-background text-foreground flex">
      {/* Sidebar */}
      <aside className="w-64 shrink-0 bg-sidebar text-sidebar-foreground border-r border-sidebar-border flex flex-col">
        <div className="h-16 flex items-center gap-2 px-5 border-b border-sidebar-border">
          <div className="size-9 rounded-md grid place-items-center bg-primary text-primary-foreground">
            <Zap className="size-5" strokeWidth={2.5} />
          </div>
          <div className="leading-tight">
            <div className="text-sm font-semibold tracking-wide">HITECH</div>
            <div className="text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
              Electric • Cockpit
            </div>
          </div>
        </div>
        <nav className="flex-1 p-3 space-y-1">
          {NAV.map((n) => {
            const active =
              n.to === "/" ? loc.pathname === "/" : loc.pathname.startsWith(n.to);
            const Icon = n.icon;
            return (
              <Link
                key={n.to}
                to={n.to}
                className={`group flex items-center gap-3 rounded-md px-3 py-2.5 text-sm transition-colors ${
                  active
                    ? "bg-sidebar-accent text-sidebar-accent-foreground border-l-2 border-primary pl-[10px]"
                    : "text-sidebar-foreground/70 hover:bg-sidebar-accent/60 hover:text-sidebar-foreground"
                }`}
              >
                <Icon className={`size-4 ${active ? "text-primary" : ""}`} />
                <span className="font-medium">{n.label}</span>
              </Link>
            );
          })}
        </nav>
        <div className="p-4 border-t border-sidebar-border text-xs text-muted-foreground">
          <div className="flex items-center gap-2">
            <span className="size-2 rounded-full bg-success" />
            Integração OMIE conectada
          </div>
          <div className="mt-1">Última sync: {sync.ultima}</div>
        </div>
      </aside>

      {/* Main */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Header */}
        <header className="h-16 border-b border-border bg-card/40 backdrop-blur flex items-center gap-3 px-6">
          <div className="relative w-72">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
            <Input
              placeholder="Buscar conta, fornecedor, cliente..."
              className="pl-9 bg-input/60 border-border"
            />
          </div>
          <div className="ml-auto flex items-center gap-2">
            <Button variant="ghost" size="sm" className="text-muted-foreground hover:text-foreground">
              <RefreshCw className="size-4" />
              Atualizar
            </Button>
            <Button variant="ghost" size="icon" className="text-muted-foreground hover:text-foreground">
              <Bell className="size-4" />
            </Button>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button className="flex items-center gap-2 pl-3 border-l border-border outline-none focus-visible:ring-2 focus-visible:ring-ring rounded-sm">
                  <div className="size-8 rounded-full bg-primary text-primary-foreground grid place-items-center text-xs font-semibold">
                    {initials}
                  </div>
                  <div className="leading-tight text-left">
                    <div className="text-sm font-medium">{displayName}</div>
                    <div className="text-[11px] text-muted-foreground">{user?.email ?? "—"}</div>
                  </div>
                  <ChevronDown className="size-4 text-muted-foreground" />
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

        {/* Global filters */}
        <div className="border-b border-border bg-card/20 px-6 py-3 flex flex-wrap items-center gap-2">
          <span className="text-[11px] uppercase tracking-wider text-muted-foreground mr-1">
            Filtros globais
          </span>
          <FilterSelect placeholder="Período" defaultValue="mes" items={[
            { v: "hoje", l: "Hoje" }, { v: "semana", l: "Esta semana" },
            { v: "mes", l: "Este mês" }, { v: "trimestre", l: "Trimestre" },
            { v: "ano", l: "Ano" }, { v: "ytd", l: "YTD" },
          ]} />
          <FilterSelect placeholder="Empresa / Unidade" defaultValue="todas" items={[
            { v: "todas", l: "Todas as unidades" },
            { v: "matriz", l: "Matriz - SP" },
            { v: "rj", l: "Filial - RJ" },
            { v: "mg", l: "Filial - MG" },
          ]} />
          <FilterSelect placeholder="Conta bancária" defaultValue="todas" items={[
            { v: "todas", l: "Todas as contas" },
            { v: "itau", l: "Itaú CC 12345-6" },
            { v: "brad", l: "Bradesco CC 98765-4" },
            { v: "sant", l: "Santander CC 55555-1" },
          ]} />
          <FilterSelect placeholder="Centro de custo" defaultValue="todos" items={[
            { v: "todos", l: "Todos C. Custo" },
            { v: "com", l: "Comercial" },
            { v: "ope", l: "Operações" },
            { v: "adm", l: "Administrativo" },
          ]} />
          <FilterSelect placeholder="Categoria" defaultValue="todas" items={[
            { v: "todas", l: "Todas categorias" },
            { v: "vendas", l: "Vendas" },
            { v: "pessoal", l: "Pessoal" },
            { v: "impostos", l: "Impostos" },
          ]} />
          <FilterSelect placeholder="Visão" defaultValue="cons" items={[
            { v: "real", l: "Realizado" },
            { v: "prev", l: "Previsto" },
            { v: "cons", l: "Consolidado" },
            { v: "orc", l: "Orçado vs Realizado" },
          ]} />
          <Badge variant="outline" className="ml-auto border-primary/40 text-primary bg-primary/10">
            {sync.fonte}
          </Badge>
        </div>

        <main className="flex-1 p-6 overflow-auto">
          <Outlet />
        </main>
      </div>
    </div>
  );
}

function FilterSelect({
  placeholder, defaultValue, items,
}: { placeholder: string; defaultValue: string; items: { v: string; l: string }[] }) {
  return (
    <Select defaultValue={defaultValue}>
      <SelectTrigger className="h-8 w-auto min-w-[140px] bg-input/60 border-border text-xs">
        <SelectValue placeholder={placeholder} />
      </SelectTrigger>
      <SelectContent>
        {items.map((i) => (
          <SelectItem key={i.v} value={i.v} className="text-xs">{i.l}</SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}