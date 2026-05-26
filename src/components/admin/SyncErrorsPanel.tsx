import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { AlertOctagon, AlertTriangle, CheckCircle2, RefreshCw } from "lucide-react";
import { toast } from "sonner";
import { useSyncErrorsSummary, useResolveSyncErrors } from "@/lib/queries/admin";
import type { SyncErrorSummaryRow } from "@/lib/queries/admin";

function fmtDateTime(s: string | null) {
  if (!s) return "—";
  const d = new Date(s);
  return d.toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" });
}

function SeverityBadge({ severity }: { severity: SyncErrorSummaryRow["severity"] }) {
  if (severity === "critical") {
    return (
      <Badge variant="destructive" className="gap-1">
        <AlertOctagon className="h-3 w-3" /> Crítico
      </Badge>
    );
  }
  if (severity === "warning") {
    return (
      <Badge variant="outline" className="gap-1 border-amber-500 text-amber-600">
        <AlertTriangle className="h-3 w-3" /> Aviso
      </Badge>
    );
  }
  return (
    <Badge variant="outline" className="gap-1 border-emerald-500 text-emerald-600">
      <CheckCircle2 className="h-3 w-3" /> OK
    </Badge>
  );
}

export function SyncErrorsPanel({ companyId }: { companyId: string | null | undefined }) {
  const { data, isLoading, refetch, isFetching } = useSyncErrorsSummary(companyId);
  const resolve = useResolveSyncErrors(companyId);

  const rows = data ?? [];
  const criticalCount = rows.filter((r) => r.severity === "critical").length;
  const warningCount = rows.filter((r) => r.severity === "warning").length;

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0">
        <div>
          <CardTitle className="text-base">Erros de sincronização por endpoint</CardTitle>
          <p className="text-xs text-muted-foreground mt-1">
            {rows.length === 0
              ? "Nenhum erro registrado."
              : `${criticalCount} crítico(s) · ${warningCount} aviso(s) · ${rows.length} endpoint(s) com histórico`}
          </p>
        </div>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => refetch()}
          disabled={isFetching}
        >
          <RefreshCw className={`h-4 w-4 ${isFetching ? "animate-spin" : ""}`} />
        </Button>
      </CardHeader>
      <CardContent className="space-y-2">
        {isLoading ? (
          <div className="space-y-2">
            <Skeleton className="h-16 w-full" />
            <Skeleton className="h-16 w-full" />
          </div>
        ) : rows.length === 0 ? (
          <div className="text-sm text-muted-foreground text-center py-6">
            Sem erros nos lotes de sincronização. ✓
          </div>
        ) : (
          <div className="divide-y rounded-md border">
            {rows.map((r) => (
              <div
                key={r.source_endpoint}
                className="flex flex-wrap items-start justify-between gap-3 p-3"
              >
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <code className="text-xs font-mono bg-muted px-1.5 py-0.5 rounded">
                      {r.source_endpoint}
                    </code>
                    <SeverityBadge severity={r.severity} />
                    {r.last_batch_status && (
                      <Badge variant="outline" className="text-xs">
                        último lote: {r.last_batch_status}
                      </Badge>
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground mt-1 line-clamp-2 break-words">
                    {r.last_error_message ?? "—"}
                  </p>
                  <div className="flex gap-3 text-xs text-muted-foreground mt-1">
                    <span>
                      <strong className="text-foreground">{r.open_errors}</strong> abertos
                    </span>
                    <span>
                      {r.total_errors} totais
                    </span>
                    <span>último: {fmtDateTime(r.last_error_at)}</span>
                  </div>
                </div>
                {r.open_errors > 0 && (
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={resolve.isPending}
                    onClick={async () => {
                      try {
                        const n = await resolve.mutateAsync(r.source_endpoint);
                        toast.success(`${n} erro(s) marcados como resolvidos`);
                      } catch (e) {
                        toast.error(e instanceof Error ? e.message : "Falha ao resolver");
                      }
                    }}
                  >
                    Marcar resolvidos
                  </Button>
                )}
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}