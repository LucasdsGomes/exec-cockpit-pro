import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Activity, AlertTriangle, CheckCircle2, FileWarning, RefreshCw } from "lucide-react";
import { useSystemHealth } from "@/lib/queries/health";
import { useCategoryMappings, useUnclassifiedEntries, useReclassify } from "@/lib/queries/admin";
import { toast } from "sonner";

function fmt(d: string | null) {
  if (!d) return "—";
  return new Date(d).toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" });
}

export function SaudeDosDadosCard({
  companyId,
  onGoToPlano,
}: {
  companyId: string | null | undefined;
  onGoToPlano?: () => void;
}) {
  const health = useSystemHealth(companyId);
  const mappings = useCategoryMappings(companyId);
  const unclassified = useUnclassifiedEntries(companyId);
  const reclassify = useReclassify(companyId);

  const totalCats = mappings.data?.length ?? 0;
  const semDre = (mappings.data ?? []).filter((m) => !m.dre_category).length;
  const semDfc = (mappings.data ?? []).filter((m) => !m.dfc_category).length;
  const naoClassificados = unclassified.data?.length ?? 0;

  const handleReclassify = () => {
    toast.promise(reclassify.mutateAsync(), {
      loading: "Reprocessando classificações...",
      success: "Pipeline executado",
      error: (e) => `Erro: ${e.message}`,
    });
  };

  const ok = naoClassificados === 0 && semDre === 0 && semDfc === 0;

  return (
    <Card className="bg-card border-border">
      <CardHeader>
        <CardTitle className="text-base flex items-center gap-2">
          <Activity className="size-4 text-primary" /> Saúde dos dados
          {ok && <Badge variant="outline" className="border-success/40 text-success bg-success/10 ml-2">Tudo certo</Badge>}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {health.isLoading ? (
          <Skeleton className="h-32" />
        ) : (
          <>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <Metric
                label="Última sincronização"
                value={fmt(health.data?.last_sync_at ?? null)}
                tone="muted"
              />
              <Metric
                label="Lançamentos sem categoria"
                value={naoClassificados.toLocaleString("pt-BR")}
                tone={naoClassificados > 0 ? "warning" : "success"}
              />
              <Metric
                label="Categorias sem DRE"
                value={`${semDre} / ${totalCats}`}
                tone={semDre > 0 ? "warning" : "success"}
              />
              <Metric
                label="Categorias sem DFC"
                value={`${semDfc} / ${totalCats}`}
                tone={semDfc > 0 ? "warning" : "success"}
              />
            </div>

            <div className="flex flex-wrap gap-2">
              {(semDre > 0 || semDfc > 0) && onGoToPlano && (
                <Button size="sm" variant="outline" onClick={onGoToPlano} className="gap-2">
                  <AlertTriangle className="size-3.5 text-warning" /> Revisar Plano de Contas
                </Button>
              )}
              {naoClassificados > 0 && (
                <Button size="sm" variant="outline" onClick={handleReclassify} disabled={reclassify.isPending} className="gap-2">
                  <RefreshCw className={`size-3.5 ${reclassify.isPending ? "animate-spin" : ""}`} /> Reprocessar fila ({naoClassificados})
                </Button>
              )}
            </div>

            {(health.data?.unmapped_categories ?? []).length > 0 && (
              <div className="rounded-md border border-warning/30 bg-warning/5 p-3 space-y-1.5">
                <div className="text-xs font-medium flex items-center gap-1.5 text-warning">
                  <FileWarning className="size-3.5" /> Categorias do Omie sem mapeamento
                </div>
                <div className="space-y-1">
                  {health.data!.unmapped_categories.slice(0, 5).map((u) => (
                    <div key={u.category_raw} className="flex items-center justify-between text-xs">
                      <span className="font-mono">{u.category_raw}</span>
                      <span className="text-muted-foreground">{u.count} lanç.</span>
                    </div>
                  ))}
                  {health.data!.unmapped_categories.length > 5 && (
                    <div className="text-[11px] text-muted-foreground pt-1">
                      + {health.data!.unmapped_categories.length - 5} outras
                    </div>
                  )}
                </div>
              </div>
            )}

            {ok && (
              <div className="text-xs text-muted-foreground flex items-center gap-2">
                <CheckCircle2 className="size-3.5 text-success" />
                Todos os lançamentos estão classificados e todas as categorias têm DRE/DFC.
              </div>
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
}

function Metric({ label, value, tone }: { label: string; value: string; tone: "muted" | "success" | "warning" }) {
  const cls =
    tone === "warning" ? "text-warning" : tone === "success" ? "text-success" : "text-foreground";
  return (
    <div className="rounded-md border border-border bg-background/40 px-3 py-2.5">
      <div className="text-[11px] uppercase tracking-wider text-muted-foreground">{label}</div>
      <div className={`text-lg font-semibold tabular-nums mt-0.5 ${cls}`}>{value}</div>
    </div>
  );
}
